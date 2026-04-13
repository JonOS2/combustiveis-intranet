const XLSX = require('xlsx');
const prisma = require('../database/prisma');
const {
  filtrarPorTipo,
  ordenarRegistros
} = require('./sefaz.service');

// CNPJs credenciados — normalizados (sem pontuação)
const CNPJS_CREDENCIADOS = new Set([
  "33967242000370", "34073062000145", "29540082000149", "29633902000147",
  "07783800000175", "23800197000149", "21309025000141", "17057051000152",
  "40921967000120", "08461170000185", "01242690000239", "12451076000112",
  "12451076000465", "01242690000158", "12486809000235", "10889582000162",
  "07150975000145", "12204558000178", "11206098000154", "29276874000158",
  "23768811000132", "34745647000164", "44687105000136", "24296959000184",
  "07483858000101", "33600518000115", "17348259000120", "05518639000187",
  "04431113000100", "33296262000102", "08422115000186", "14432556000161",
  "05019078000171", "28742913000100", "12236184000172", "13478460000171",
  "03705157000100", "41576958000102", "41964710000119", "32876089000140",
  "20528778000185", "31585795000170", "08158788000170", "27665019000103",
  "09077197000131", "60066994000170", "17336019000106", "05012787000125",
  "08950629000104", "05760532000140", "08203497000157", "13951557000150",
  "35362367000130", "05072232000179", "05900895000134", "11498042000110",
  "05453620000108", "27665019000375", "02804864000191", "09609009000179",
  "42426417000160", "27665019000294", "08801561000282", "08418303000564",
  "50763348000109", "06964197000165", "08850457000105", "05988846000103",
  "17303640000173", "05079209000106", "41163486000247", "16674625000179",
  "07431049000148", "08886885000180", "39805644000192", "09423134000190",
  "05562589000135", "40477733000136", "12275228000173", "12396339000561",
  "12396339000308", "19034367000154", "12486809000316", "00497402000143",
  "22590658000133", "13231916000102", "07839831000109", "20266767000174",
  "12486809000405", "11377428000174", "08529008000232", "26362482000113",
  "08418303000130", "08529008000151", "01332922000169", "28442466000166",
  "11908167000171", "29709059000135", "03223071000141", "07716281000122",
  "12396339000219", "06081417000102", "10635075000283", "06053479000100",
  "07478815000120",
]);

const normalizarCNPJ = (cnpj) => (cnpj || '').replace(/[.\-\/]/g, '');
const isCredenciado = (cnpj) => CNPJS_CREDENCIADOS.has(normalizarCNPJ(cnpj));

const MAPA_COMBUSTIVEL = {
  1: 'gasolina-comum', 2: 'gasolina-aditivada', 3: 'etanol',
  4: 'diesel-comum', 5: 'diesel-s10', 6: 'gnv', 7: 'aditivado'
};

const normalizarTexto = (texto = '') =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').toLowerCase();

const formatarDataUTC = (data) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(data));

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
    Credenciado: isCredenciado(item.estabelecimento.cnpj) ? 'Sim' : 'Não',
    Data: formatarDataUTC(item.produto.venda.dataVenda),
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

const buscarDosBanco = async ({ tipoCombustivel, dias, codigoIBGE, ordenarPor }) => {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);
  const tipoBanco = tipoCombustivel;

  const where = {
    dataVenda: { gte: dataLimite },
    combustivel: { tipo: tipoBanco },
    ...(codigoIBGE ? { posto: { municipio: { codigoIBGE } } } : {}),
  };

  const precosRaw = await prisma.preco.findMany({
    where,
    include: { posto: { include: { municipio: true } }, combustivel: true },
    orderBy: [{ dataVenda: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
  });

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

  const todosRegistros = await buscarDosBanco({ tipoCombustivel, dias, codigoIBGE: ibgeFiltro, ordenarPor });

  if (todosRegistros.length === 0) throw new Error('SEM_DADOS');

  let registros;
  if (modo === 'pagina') {
    const inicio = (pagina - 1) * registrosPorPagina;
    registros = todosRegistros.slice(inicio, inicio + registrosPorPagina);
  } else {
    if (todosRegistros.length > limiteRegistros) throw new Error('EXPORTACAO_MUITO_GRANDE');
    registros = todosRegistros;
  }

  const nomeArquivo = gerarNomeArquivo({ registros, tipoCombustivel, ordenarPor, modo, pagina });
  const buffer = gerarBufferExcel(registros);

  return { buffer, nomeArquivo };
};

module.exports = { gerarExcel };