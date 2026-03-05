const XLSX = require('xlsx');
const {
  buscarPagina,
  resolverTipoParaSefaz,
  enriquecerComBandeiras,
  filtrarPorTipo,
  ordenarRegistros
} = require('./sefaz.service');

/* =========================
   MAPA DE NOMES DE COMBUSTÍVEL
   (para compor o nome do arquivo)
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

/* =========================
   NORMALIZA TEXTO PARA NOME DE ARQUIVO
   (remove acentos, espaços viram hífens, tudo minúsculo)
========================= */
const normalizarTexto = (texto = '') =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();

/* =========================
   GERA NOME DO ARQUIVO
========================= */
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

/* =========================
   CONVERTE REGISTROS EM BUFFER XLSX
========================= */
const gerarBufferExcel = (registros) => {
  const dadosExcel = registros.map(item => ({
    Posto: item.estabelecimento.nomeFantasia || item.estabelecimento.razaoSocial,
    Produto: item.produto.descricao,
    'Valor Declarado (R$)': item.produto.venda.valorDeclarado,
    'Valor Venda (R$)': item.produto.venda.valorVenda,
    Bandeira: item.estabelecimento.bandeira || '—',
    Data: item.produto.venda.dataVenda,
    Bairro: item.estabelecimento.endereco.bairro,
    Município: item.estabelecimento.endereco.municipio,
    CNPJ: item.estabelecimento.cnpj
  }));

  const worksheet = XLSX.utils.json_to_sheet(dadosExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Combustíveis');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/* =========================
   SERVIÇO PRINCIPAL DE EXPORTAÇÃO
   Retorna: { buffer, nomeArquivo }
========================= */
const gerarExcel = async ({
  tipoCombustivel = 1,
  dias = 1,
  codigoIBGE = 2704302,
  registrosPorPagina = 50,
  modo = 'pagina',
  pagina = 1,
  ordenarPor = 'declarado'
}) => {
  // ✅ BUG CORRIGIDO: tipoParaSefaz agora é declarado corretamente
  const tipoParaSefaz = resolverTipoParaSefaz(tipoCombustivel);

  let todosRegistros = [];

  if (modo === 'pagina') {
    const data = await buscarPagina({
      tipoCombustivel: tipoParaSefaz,
      dias,
      codigoIBGE,
      pagina,
      registrosPorPagina
    });
    todosRegistros = data.conteudo || [];
  }

  if (modo === 'tudo') {
    const primeira = await buscarPagina({
      tipoCombustivel: tipoParaSefaz,
      dias,
      codigoIBGE,
      pagina: 1,
      registrosPorPagina
    });

    const totalPaginas =
      primeira.totalPaginas ||
      primeira.paginacao?.totalPaginas ||
      Math.ceil((primeira.paginacao?.totalRegistros || 0) / registrosPorPagina) ||
      1;

    if (totalPaginas > 20) {
      throw new Error('EXPORTACAO_MUITO_GRANDE');
    }

    todosRegistros = primeira.conteudo || [];

    for (let p = 2; p <= totalPaginas; p++) {
      const data = await buscarPagina({
        tipoCombustivel: tipoParaSefaz,
        dias,
        codigoIBGE,
        pagina: p,
        registrosPorPagina
      });
      todosRegistros.push(...(data.conteudo || []));
    }
  }

  // Enriquece com bandeira ANP, filtra por tipo e ordena
  await enriquecerComBandeiras(todosRegistros);
  todosRegistros = filtrarPorTipo(todosRegistros, tipoCombustivel);
  todosRegistros = ordenarRegistros(todosRegistros, ordenarPor);

  const nomeArquivo = gerarNomeArquivo({
    registros: todosRegistros,
    tipoCombustivel,
    ordenarPor,
    modo,
    pagina
  });

  const buffer = gerarBufferExcel(todosRegistros);

  return { buffer, nomeArquivo };
};

module.exports = { gerarExcel };