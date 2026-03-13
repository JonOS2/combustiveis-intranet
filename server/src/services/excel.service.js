const XLSX = require('xlsx');
const prisma = require('../database/prisma');
const {
  resolverTipoParaSefaz,
  filtrarPorTipo,
  ordenarRegistros
} = require('./sefaz.service');

const MAPA_COMBUSTIVEL = {
  1: 'gasolina-comum',
  2: 'gasolina-aditivada',
  3: 'etanol',
  4: 'diesel-comum',
  5: 'diesel-s10',
  6: 'gnv',
  7: 'diesel-s10-aditivado'
};

const normalizarTexto = (texto = '') =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').toLowerCase();

const gerarNomeArquivo = ({ registros, tipoCombustivel, ordenarPor, modo, pagina }) => {
  const tipoNome = MAPA_COMBUSTIVEL[tipoCombustivel] || 'combustivel';
  const ordenacaoNome = ordenarPor === 'venda' ? 'ordenado-por-venda' : 'ordenado-por-declarado';

  if (modo === 'estado') {
    return `combustiveis-alagoas-${tipoNome}-${ordenacaoNome}-completo.xlsx`;
  }

  const nomeMunicipio = normalizarTexto(
    registros[0]?.estabelecimento?.endereco?.municipio || 'municipio-desconhecido'
  );

  return modo === 'tudo'
    ? `combustiveis-${nomeMunicipio}-${tipoNome}-${ordenacaoNome}-completo.xlsx`
    : `combustiveis-${nomeMunicipio}-${tipoNome}-${ordenacaoNome}-pagina-${pagina}.xlsx`;
};

const gerarBufferExcel = (registros) => {
  const dadosExcel = registros.map(item => ({
    Posto: item.estabelecimento.nomeFantasia || item.estabelecimento.razaoSocial,
    Município: item.estabelecimento.endereco.municipio,
    Bairro: item.estabelecimento.endereco.bairro,
    Produto: item.produto.descricao,
    'Valor Declarado (R$)': item.produto.venda.valorDeclarado,
    'Valor Venda (R$)': item.produto.venda.valorVenda,
    Bandeira: item.estabelecimento.bandeira || '—',
    Data: new Date(item.produto.venda.dataVenda).toLocaleDateString('pt-BR'),
    CNPJ: item.estabelecimento.cnpj,
    Telefone: item.estabelecimento.telefone || '—',
    Endereço: `${item.estabelecimento.endereco.nomeLogradouro || ''}, ${item.estabelecimento.endereco.numeroImovel || ''} — ${item.estabelecimento.endereco.bairro || ''}`.trim(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(dadosExcel);

  // Autofit nas colunas
  const colunas = Object.keys(dadosExcel[0] || {});
  worksheet['!cols'] = colunas.map((col) => {
    const maxLen = Math.max(
      col.length,
      ...dadosExcel.map(row => String(row[col] ?? '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });

  // Filtro automático em todas as colunas
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }) };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Combustíveis');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

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
   BUSCA DO BANCO COM DEDUPLICAÇÃO
   codigoIBGE = null → todos os municípios (estado)
========================= */
const buscarDosBanco = async ({ tipoCombustivel, dias, codigoIBGE, ordenarPor }) => {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);

  const tipoBanco = resolverTipoParaSefaz(tipoCombustivel);

  const where = {
    dataVenda: { gte: dataLimite },
    combustivel: { tipo: tipoBanco },
    ...(codigoIBGE ? { posto: { municipio: { codigoIBGE } } } : {}),
  };

  const precosRaw = await prisma.preco.findMany({
    where,
    include: {
      posto: { include: { municipio: true } },
      combustivel: true,
    },
    orderBy: { dataVenda: 'desc' },
  });

  // Deduplica por CNPJ — mantém apenas o registro mais recente por posto
  // (resolve casos onde o mesmo posto tem produtos com códigos diferentes mas mesmo tipo)
  const vistos = new Set();
  const deduplicados = precosRaw.filter((p) => {
    const chave = p.posto.cnpj;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  let registros = deduplicados.map(formatarRegistroDoBanco);
  registros = filtrarPorTipo(registros, tipoCombustivel);
  registros = ordenarRegistros(registros, ordenarPor);

  return registros;
};

/* =========================
   SERVIÇO PRINCIPAL DE EXPORTAÇÃO
========================= */
const gerarExcel = async ({
  tipoCombustivel = 1,
  dias = 1,
  codigoIBGE = 2704302,
  registrosPorPagina = 50,
  modo = 'pagina',
  pagina = 1,
  ordenarPor = 'declarado',
}) => {
  const ibgeFiltro = modo === 'estado' ? null : codigoIBGE;
  const limiteRegistros = modo === 'estado' ? 10000 : 2000;

  const todosRegistros = await buscarDosBanco({
    tipoCombustivel,
    dias,
    codigoIBGE: ibgeFiltro,
    ordenarPor,
  });

  if (todosRegistros.length === 0) {
    throw new Error('SEM_DADOS');
  }

  let registros;

  if (modo === 'pagina') {
    const inicio = (pagina - 1) * registrosPorPagina;
    registros = todosRegistros.slice(inicio, inicio + registrosPorPagina);
  } else {
    if (todosRegistros.length > limiteRegistros) {
      throw new Error('EXPORTACAO_MUITO_GRANDE');
    }
    registros = todosRegistros;
  }

  const nomeArquivo = gerarNomeArquivo({ registros, tipoCombustivel, ordenarPor, modo, pagina });
  const buffer = gerarBufferExcel(registros);

  return { buffer, nomeArquivo };
};

module.exports = { gerarExcel };