const prisma = require('../database/prisma');
const {
  buscarPagina,
  enriquecerComBandeiras,
  filtrarPorTipo,
  ordenarRegistros
} = require('../services/sefaz.service');
const { gerarExcel } = require('../services/excel.service');
const { sincronizar } = require('../jobs/sync.worker');

const formatarRegistroDoBanco = (preco) => ({
  produto: {
    codigo: preco.combustivel.codigo,
    descricao: preco.combustivel.descricao,
    unidadeMedida: preco.combustivel.unidade,
    venda: {
      valorVenda: preco.valorVenda,
      valorDeclarado: preco.valorDeclarado,
      dataVenda: preco.dataVenda,
    },
  },
  estabelecimento: {
    cnpj: preco.posto.cnpj,
    razaoSocial: preco.posto.razaoSocial,
    nomeFantasia: preco.posto.nomeFantasia,
    telefone: preco.posto.telefone,
    bandeira: preco.posto.bandeira,
    endereco: {
      nomeLogradouro: preco.posto.endereco,
      numeroImovel: preco.posto.numero,
      bairro: preco.posto.bairro,
      cep: preco.posto.cep,
      municipio: preco.posto.municipio?.nome,
      codigoIBGE: preco.posto.municipio?.codigoIBGE,
      latitude: preco.posto.latitude,
      longitude: preco.posto.longitude,
    },
  },
});

/* GET COMBUSTÍVEIS */
const getCombustiveis = async (req, res) => {
  try {
    const { tipoCombustivel = 1, dias = 7, codigoIBGE = 2704302, pagina = 1, registrosPorPagina = 50, ordenarPor = 'declarado' } = req.body;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    const tipoBanco = tipoCombustivel;
    const tipoApi = tipoCombustivel === 7 ? 6 : tipoCombustivel;
    const where = { dataVenda: { gte: dataLimite }, combustivel: { tipo: tipoBanco }, posto: { municipio: { codigoIBGE } } };
    const total = await prisma.preco.count({ where });
    if (total === 0) {
      console.warn(`⚠️  Banco vazio para IBGE ${codigoIBGE} tipo ${tipoCombustivel} — usando API SEFAZ`);
      const data = await buscarPagina({ tipoCombustivel: tipoApi, dias, codigoIBGE, pagina, registrosPorPagina });
      if (Array.isArray(data?.conteudo)) {
        await enriquecerComBandeiras(data.conteudo);
        data.conteudo = filtrarPorTipo(data.conteudo, tipoCombustivel);
        data.conteudo = ordenarRegistros(data.conteudo, ordenarPor);
      }
      return res.json({ ...data, fonte: 'sefaz', ultimaAtualizacao: null });
    }
    const precosRaw = await prisma.preco.findMany({
      where,
      include: { posto: { include: { municipio: true } }, combustivel: true },
      orderBy: [{ dataVenda: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
    });
    const ultimaAtualizacao = await prisma.preco.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    const vistos = new Set();
    const precosMaisRecentes = precosRaw.filter((p) => { const c = p.posto.cnpj; if (vistos.has(c)) return false; vistos.add(c); return true; });
    const postoIds = precosMaisRecentes.map(p => p.postoId);
    const precosAnteriores = await prisma.preco.findMany({ where: { postoId: { in: postoIds }, combustivel: { tipo: tipoBanco }, dataVenda: { lt: dataLimite } }, orderBy: [{ dataVenda: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }], select: { postoId: true, valorDeclarado: true } });
    const mapaAnteriores = new Map();
    for (const p of precosAnteriores) { if (!mapaAnteriores.has(p.postoId)) mapaAnteriores.set(p.postoId, p.valorDeclarado); }
    const campo = ordenarPor === 'venda' ? 'valorVenda' : 'valorDeclarado';
    precosMaisRecentes.sort((a, b) => (a[campo] ?? 0) - (b[campo] ?? 0));
    const totalDeduplicado = precosMaisRecentes.length;
    const inicio = (pagina - 1) * registrosPorPagina;
    const paginados = precosMaisRecentes.slice(inicio, inicio + registrosPorPagina);
    let conteudo = paginados.map(p => {
      const item = formatarRegistroDoBanco(p);
      const precoAnterior = mapaAnteriores.get(p.postoId);
      const precoAtual = p.valorDeclarado;
      if (precoAnterior != null && precoAtual != null) {
        const diff = precoAtual - precoAnterior;
        item.variacao = { anterior: precoAnterior, diff: parseFloat(diff.toFixed(3)), pct: parseFloat(((diff / precoAnterior) * 100).toFixed(1)) };
      } else { item.variacao = null; }
      return item;
    });
    conteudo = filtrarPorTipo(conteudo, tipoCombustivel);
    res.json({ conteudo, pagina, totalPaginas: Math.ceil(totalDeduplicado / registrosPorPagina), totalRegistros: totalDeduplicado, fonte: 'banco', ultimaAtualizacao: ultimaAtualizacao?.createdAt || null });
  } catch (error) {
    console.error('❌ Erro getCombustiveis:', error.message);
    res.status(500).json({ error: 'Erro interno ao buscar combustíveis' });
  }
};

/* MAPA DE POSTOS */
const getMapaPostos = async (req, res) => {
  try {
    const tipoCombustivel = parseInt(req.query.tipoCombustivel) || 1;
    const codigoIBGE = parseInt(req.query.codigoIBGE) || 2704302;
    const tipoBanco = tipoCombustivel;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 7);

    // Busca todos os preços recentes do município — filtra coordenadas em JS
    const precosRaw = await prisma.preco.findMany({
      where: {
        dataVenda: { gte: dataLimite },
        combustivel: { tipo: tipoBanco },
        posto: { municipio: { codigoIBGE } },
      },
      include: { posto: { include: { municipio: true } }, combustivel: true },
      orderBy: [{ dataVenda: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
    });

    // Deduplica por CNPJ
    const vistos = new Set();
    const deduplicados = precosRaw.filter((p) => {
      if (vistos.has(p.posto.cnpj)) return false;
      vistos.add(p.posto.cnpj);
      return true;
    });

    // Filtra apenas postos com coordenadas válidas
    const comCoords = deduplicados.filter(p =>
      p.posto.latitude && p.posto.longitude &&
      p.posto.latitude !== 0 && p.posto.longitude !== 0
    );

    // Filtra tipo aditivado/comum
    const filtrados = comCoords.filter(p => {
      const desc = p.combustivel.descricao?.toUpperCase() || '';
      if (tipoCombustivel === 7) return desc.includes('ADIT');
      if (tipoCombustivel === 5) return !desc.includes('ADIT');
      return true;
    });

    const formatados = filtrados.map(p => ({
      cnpj: p.posto.cnpj,
      nome: p.posto.nomeFantasia || p.posto.razaoSocial,
      bandeira: p.posto.bandeira,
      bairro: p.posto.bairro,
      endereco: `${p.posto.endereco || ''}, ${p.posto.numero || ''}`.trim().replace(/,$/, ''),
      latitude: p.posto.latitude,
      longitude: p.posto.longitude,
      valorDeclarado: p.valorDeclarado,
      valorVenda: p.valorVenda,
      dataVenda: p.dataVenda,
    }));

    // Filtro de raio 50km via Haversine
    const centroLat = formatados.reduce((s, p) => s + p.latitude, 0) / (formatados.length || 1);
    const centroLon = formatados.reduce((s, p) => s + p.longitude, 0) / (formatados.length || 1);
    const toRad = (deg) => (deg * Math.PI) / 180;
    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const dentroDoRaio = formatados.filter(p => haversine(centroLat, centroLon, p.latitude, p.longitude) <= 50);

    const valores = dentroDoRaio.map(p => p.valorDeclarado).filter(Boolean);
    const minPreco = valores.length ? Math.min(...valores) : 0;
    const maxPreco = valores.length ? Math.max(...valores) : 0;
    const mediaPreco = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

    res.json({
      postos: dentroDoRaio,
      stats: { minPreco: parseFloat(minPreco.toFixed(3)), maxPreco: parseFloat(maxPreco.toFixed(3)), mediaPreco: parseFloat(mediaPreco.toFixed(3)), total: dentroDoRaio.length },
    });
  } catch (error) {
    console.error('❌ Erro getMapaPostos:', error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do mapa.' });
  }
};

/* HISTÓRICO */
const getHistorico = async (req, res) => {
  try {
    const { cnpj } = req.params;
    const tipoCombustivel = parseInt(req.query.tipoCombustivel) || 1;
    const tipoBanco = tipoCombustivel;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);
    const posto = await prisma.posto.findUnique({ where: { cnpj }, select: { id: true, nomeFantasia: true, razaoSocial: true, bairro: true, bandeira: true } });
    if (!posto) return res.status(404).json({ error: 'Posto não encontrado.' });
    const precos = await prisma.preco.findMany({ where: { postoId: posto.id, combustivel: { tipo: tipoBanco }, dataVenda: { gte: dataLimite } }, orderBy: [{ dataVenda: 'asc' }, { updatedAt: 'asc' }, { id: 'asc' }] });
    const porData = new Map();
    for (const p of [...precos].reverse()) { const data = new Date(p.dataVenda).toISOString().split('T')[0]; if (!porData.has(data)) porData.set(data, p); }
    const historico = Array.from(porData.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, p]) => ({ data: new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(new Date(p.dataVenda)), declarado: p.valorDeclarado, venda: p.valorVenda }));
    res.json({ posto: { nome: posto.nomeFantasia || posto.razaoSocial, bairro: posto.bairro, bandeira: posto.bandeira }, historico });
  } catch (error) {
    console.error('❌ Erro getHistorico:', error.message);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
};

/* EXPORTAR EXCEL */
const exportarExcel = async (req, res) => {
  try {
    const { buffer, nomeArquivo } = await gerarExcel(req.body);
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    if (error.message === 'EXPORTACAO_MUITO_GRANDE') return res.status(400).json({ error: 'Exportação muito grande. Refine os filtros.' });
    if (error.message === 'SEM_DADOS') return res.status(404).json({ error: 'Nenhum dado encontrado para os filtros selecionados.' });
    console.error('❌ Erro exportarExcel:', error.message);
    res.status(500).json({ error: 'Erro ao gerar Excel' });
  }
};

/* SYNC MANUAL */
const syncManual = async (req, res) => {
  try {
    res.json({ message: 'Sincronização iniciada em background.' });
    sincronizar().catch((err) => console.error('❌ Erro no sync manual:', err.message));
  } catch (error) {
    console.error('❌ Erro syncManual:', error.message);
    res.status(500).json({ error: 'Erro ao iniciar sincronização' });
  }
};

/* STATUS */
const getStatus = async (req, res) => {
  try {
    const [totalPostos, totalPrecos, totalMunicipios, ultimoPreco, postosSemBandeira] = await Promise.all([
      prisma.posto.count(), prisma.preco.count(), prisma.municipio.count(),
      prisma.preco.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, dataVenda: true } }),
      prisma.posto.count({ where: { bandeira: null } }),
    ]);
    res.json({ ultimaSincronizacao: ultimoPreco?.createdAt || null, ultimaDataVenda: ultimoPreco?.dataVenda || null, totalPostos, totalPrecos, totalMunicipios, postosSemBandeira });
  } catch (error) {
    console.error('❌ Erro getStatus:', error.message);
    res.status(500).json({ error: 'Erro ao buscar status' });
  }
};

module.exports = { getCombustiveis, getMapaPostos, getHistorico, exportarExcel, syncManual, getStatus };