const prisma = require('../database/prisma');
const {
  buscarPagina,
  resolverTipoParaSefaz,
  enriquecerComBandeiras,
  filtrarPorTipo,
  ordenarRegistros
} = require('../services/sefaz.service');
const { gerarExcel } = require('../services/excel.service');
const { sincronizar } = require('../jobs/sync.worker');

/* =========================
   HELPERS
========================= */
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

/* =========================
   GET COMBUSTÍVEIS
   POST /api/combustivel
========================= */
const getCombustiveis = async (req, res) => {
  try {
    const {
      tipoCombustivel = 1,
      dias = 7,
      codigoIBGE = 2704302,
      pagina = 1,
      registrosPorPagina = 50,
      ordenarPor = 'declarado'
    } = req.body;

    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);

    const tipoBanco = resolverTipoParaSefaz(tipoCombustivel);

    const where = {
      dataVenda: { gte: dataLimite },
      combustivel: { tipo: tipoBanco },
      posto: { municipio: { codigoIBGE } },
    };

    const total = await prisma.preco.count({ where });

    if (total === 0) {
      console.warn(`⚠️  Banco vazio para IBGE ${codigoIBGE} tipo ${tipoCombustivel} — usando API SEFAZ`);
      const data = await buscarPagina({ tipoCombustivel: tipoBanco, dias, codigoIBGE, pagina, registrosPorPagina });
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
      orderBy: { dataVenda: 'desc' },
    });

    const ultimaAtualizacao = await prisma.preco.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // Deduplica por CNPJ
    const vistos = new Set();
    const precosMaisRecentes = precosRaw.filter((p) => {
      const chave = p.posto.cnpj;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

    // Busca preço anterior para calcular variação
    const postoIds = precosMaisRecentes.map(p => p.postoId);
    const precosAnteriores = await prisma.preco.findMany({
      where: {
        postoId: { in: postoIds },
        combustivel: { tipo: tipoBanco },
        dataVenda: { lt: dataLimite },
      },
      orderBy: { dataVenda: 'desc' },
      select: { postoId: true, valorDeclarado: true },
    });
    const mapaAnteriores = new Map();
    for (const p of precosAnteriores) {
      if (!mapaAnteriores.has(p.postoId)) mapaAnteriores.set(p.postoId, p.valorDeclarado);
    }

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
        item.variacao = {
          anterior: precoAnterior,
          diff: parseFloat(diff.toFixed(3)),
          pct: parseFloat(((diff / precoAnterior) * 100).toFixed(1)),
        };
      } else {
        item.variacao = null;
      }
      return item;
    });

    conteudo = filtrarPorTipo(conteudo, tipoCombustivel);

    res.json({
      conteudo,
      pagina,
      totalPaginas: Math.ceil(totalDeduplicado / registrosPorPagina),
      totalRegistros: totalDeduplicado,
      fonte: 'banco',
      ultimaAtualizacao: ultimaAtualizacao?.createdAt || null,
    });

  } catch (error) {
    console.error('❌ Erro getCombustiveis:', error.message);
    res.status(500).json({ error: 'Erro interno ao buscar combustíveis' });
  }
};

/* =========================
   HISTÓRICO DE PREÇO POR POSTO
   GET /api/combustivel/historico/:cnpj?tipoCombustivel=1
========================= */
const getHistorico = async (req, res) => {
  try {
    const { cnpj } = req.params;
    const tipoCombustivel = parseInt(req.query.tipoCombustivel) || 1;
    const tipoBanco = resolverTipoParaSefaz(tipoCombustivel);

    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);

    const posto = await prisma.posto.findUnique({
      where: { cnpj },
      select: { id: true, nomeFantasia: true, razaoSocial: true, bairro: true, bandeira: true },
    });

    if (!posto) return res.status(404).json({ error: 'Posto não encontrado.' });

    const precos = await prisma.preco.findMany({
      where: {
        postoId: posto.id,
        combustivel: { tipo: tipoBanco },
        dataVenda: { gte: dataLimite },
      },
      orderBy: { dataVenda: 'asc' },
    });

    // Um registro por dia (mais recente do dia)
    const porData = new Map();
    for (const p of [...precos].reverse()) {
      const data = new Date(p.dataVenda).toISOString().split('T')[0];
      if (!porData.has(data)) porData.set(data, p);
    }

    const historico = Array.from(porData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, p]) => ({
        data: new Date(p.dataVenda).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        declarado: p.valorDeclarado,
        venda: p.valorVenda,
      }));

    res.json({
      posto: {
        nome: posto.nomeFantasia || posto.razaoSocial,
        bairro: posto.bairro,
        bandeira: posto.bandeira,
      },
      historico,
    });

  } catch (error) {
    console.error('❌ Erro getHistorico:', error.message);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
};

/* =========================
   EXPORTAR EXCEL
   POST /api/combustivel/excel
========================= */
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

/* =========================
   SYNC MANUAL
   POST /api/combustivel/sync
========================= */
const syncManual = async (req, res) => {
  try {
    res.json({ message: 'Sincronização iniciada em background.' });
    sincronizar().catch((err) => console.error('❌ Erro no sync manual:', err.message));
  } catch (error) {
    console.error('❌ Erro syncManual:', error.message);
    res.status(500).json({ error: 'Erro ao iniciar sincronização' });
  }
};

/* =========================
   STATUS DO SISTEMA
   GET /api/combustivel/status
========================= */
const getStatus = async (req, res) => {
  try {
    const [totalPostos, totalPrecos, totalMunicipios, ultimoPreco, postosSemBandeira] = await Promise.all([
      prisma.posto.count(),
      prisma.preco.count(),
      prisma.municipio.count(),
      prisma.preco.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, dataVenda: true } }),
      prisma.posto.count({ where: { bandeira: null } }),
    ]);
    res.json({
      ultimaSincronizacao: ultimoPreco?.createdAt || null,
      ultimaDataVenda: ultimoPreco?.dataVenda || null,
      totalPostos, totalPrecos, totalMunicipios, postosSemBandeira,
    });
  } catch (error) {
    console.error('❌ Erro getStatus:', error.message);
    res.status(500).json({ error: 'Erro ao buscar status' });
  }
};

module.exports = { getCombustiveis, getHistorico, exportarExcel, syncManual, getStatus };