const XLSX = require('xlsx');
const prisma = require('../database/prisma');
const {
  resolverTipoParaSefaz,
  filtrarPorTipo,
  ordenarRegistros
} = require('./sefaz.service');

/* =========================
   MAPA DE NOMES DE COMBUSTÍVEL
========================= */
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
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();

const gerarNomeArquivo = ({ registros, tipoCombustivel, ordenarPor, modo, pagina }) => {
  const nomeMunicipio = normalizarTexto(
    registros[0]?.estabelecimento?.endereco?.municipio || 'municipio-desconhecido'
  );
  const tipoNome = MAPA_COMBUSTIVEL[tipoCombustivel] || 'combustivel';
  const ordenacaoNome = ordenarPor === 'venda' ? 'ordenado-por-venda' : 'ordenado-por-declarado';
  return modo === 'tudo'
    ? `combustiveis-${nomeMunicipio}-${tipoNome}-${ordenacaoNome}-completo.xlsx`
    : `combustiveis-${nomeMunicipio}-${tipoNome}-${ordenacaoNome}-pagina-${pagina}.xlsx`;
};

const gerarBufferExcel = (registros) => {
  const dadosExcel = registros.map(item => ({
    Posto: item.estabelecimento.nomeFantasia || item.estabelecimento.razaoSocial,
    Produto: item.produto.descricao,
    'Valor Declarado (R$)': item.produto.venda.valorDeclarado,
    'Valor Venda (R$)': item.produto.venda.valorVenda,
    Bandeira: item.estabelecimento.bandeira || '—',
    Data: new Date(item.produto.venda.dataVenda).toLocaleDateString('pt-BR'),
    Bairro: item.estabelecimento.endereco.bairro,
    Município: item.estabelecimento.endereco.municipio,
    CNPJ: item.estabelecimento.cnpj,
    Telefone: item.estabelecimento.telefone || '—',
    Endereço: `${item.estabelecimento.endereco.nomeLogradouro || ''}, ${item.estabelecimento.endereco.numeroImovel || ''} — ${item.estabelecimento.endereco.bairro || ''}`.trim(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(dadosExcel);
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
========================= */
const buscarDosBanco = async ({ tipoCombustivel, dias, codigoIBGE, ordenarPor }) => {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);

  const tipoBanco = resolverTipoParaSefaz(tipoCombustivel);

  const precosRaw = await prisma.preco.findMany({
    where: {
      dataVenda: { gte: dataLimite },
      combustivel: { tipo: tipoBanco },
      posto: { municipio: { codigoIBGE } },
    },
    include: {
      posto: { include: { municipio: true } },
      combustivel: true,
    },
    orderBy: { dataVenda: 'desc' },
  });

  // Deduplica — apenas o mais recente por posto+combustível
  const vistos = new Set();
  const deduplicados = precosRaw.filter((p) => {
    const chave = `${p.postoId}-${p.combustivelId}`;
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
  const todosRegistros = await buscarDosBanco({ tipoCombustivel, dias, codigoIBGE, ordenarPor });

  if (todosRegistros.length === 0) {
    throw new Error('SEM_DADOS');
  }

  let registros;

  if (modo === 'pagina') {
    const inicio = (pagina - 1) * registrosPorPagina;
    registros = todosRegistros.slice(inicio, inicio + registrosPorPagina);
  } else {
    // modo === 'tudo'
    if (todosRegistros.length > 2000) {
      throw new Error('EXPORTACAO_MUITO_GRANDE');
    }
    registros = todosRegistros;
  }

  const nomeArquivo = gerarNomeArquivo({ registros, tipoCombustivel, ordenarPor, modo, pagina });
  const buffer = gerarBufferExcel(registros);

  return { buffer, nomeArquivo };
};

module.exports = { gerarExcel };