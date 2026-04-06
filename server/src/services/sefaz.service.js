const axios = require('axios');

const SEFAZ_URL =
  'http://api.sefaz.al.gov.br/sfz-economiza-alagoas-api/api/public/combustivel/pesquisa';

/* =========================
   BUSCA PAGINADA – SEFAZ
========================= */
const buscarPagina = async ({
  tipoCombustivel,
  dias,
  codigoIBGE,
  cnpj,
  pagina,
  registrosPorPagina
}) => {
  const body = {
    produto: { tipoCombustivel },
    dias,
    pagina,
    registrosPorPagina,
    estabelecimento: cnpj
      ? { individual: { cnpj } }
      : { municipio: { codigoIBGE } }
  };

  const response = await axios.post(SEFAZ_URL, body, {
    headers: {
      appToken: process.env.APP_TOKEN,
      'Content-Type': 'application/json'
    },
    timeout: 12000, // reduzido de 30s para 12s — API responde rápido ou não responde
  });

  return response.data;
};

/* =========================
   DETECTA SE É ADITIVADO
========================= */
const ehAditivado = (descricao = '') => {
  const texto = descricao.toUpperCase();
  const palavrasAditivado = ['ADIT', 'GRID', 'ADITIVAD', 'SHELL EVOLUX', 'ADITIVADO'];
  return palavrasAditivado.some(palavra => texto.includes(palavra));
};

/* =========================
   RESOLVE TIPO PARA SEFAZ
   (tipo 7 = S10 aditivado, mas a SEFAZ só conhece o tipo 5)
========================= */
const resolverTipoParaSefaz = (tipoCombustivel) => {
  if (tipoCombustivel === 7) return 5;
  return tipoCombustivel;
};

/* =========================
   ANP – BANDEIRA POR CNPJ
   (com cache em memória para evitar chamadas repetidas)
========================= */
const cacheBandeiras = {};

const buscarBandeiraPorCNPJ = async (cnpj) => {
  if (!cnpj) return null;
  if (cacheBandeiras[cnpj] !== undefined) return cacheBandeiras[cnpj];

  try {
    const res = await axios.get(
      `https://revendedoresapi.anp.gov.br/v1/combustivel?cnpj=${cnpj}`,
      {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CombustiveisIntranet/1.0)',
          'Accept': 'application/json',
        }
      }
    );

    const bandeira = res.data?.data?.[0]?.distribuidora || null;
    cacheBandeiras[cnpj] = bandeira;
    return bandeira;
  } catch (error) {
    console.error(`❌ Erro ANP (${cnpj}):`, error.message);
    cacheBandeiras[cnpj] = null;
    return null;
  }
};

/* =========================
   ENRIQUECE LISTA COM BANDEIRAS
========================= */
const enriquecerComBandeiras = async (registros) => {
  await Promise.all(
    registros.map(async (item) => {
      const cnpj = item?.estabelecimento?.cnpj;
      item.estabelecimento.bandeira = cnpj
        ? await buscarBandeiraPorCNPJ(cnpj)
        : null;
    })
  );
};

/* =========================
   FILTRA POR TIPO (aditivado ou comum)
========================= */
const filtrarPorTipo = (registros, tipoCombustivel) => {
  return registros.filter((item) => {
    const descricao = item?.produto?.descricao;
    const aditivado = ehAditivado(descricao);
    if (tipoCombustivel === 7) return aditivado;
    if (tipoCombustivel === 5) return !aditivado;
    return true;
  });
};

/* =========================
   ORDENA REGISTROS
========================= */
const ordenarRegistros = (registros, ordenarPor) => {
  return [...registros].sort((a, b) => {
    const valorA = ordenarPor === 'venda'
      ? a.produto.venda.valorVenda
      : a.produto.venda.valorDeclarado;
    const valorB = ordenarPor === 'venda'
      ? b.produto.venda.valorVenda
      : b.produto.venda.valorDeclarado;
    return valorA - valorB;
  });
};

module.exports = {
  buscarPagina,
  ehAditivado,
  resolverTipoParaSefaz,
  buscarBandeiraPorCNPJ,
  enriquecerComBandeiras,
  filtrarPorTipo,
  ordenarRegistros
};