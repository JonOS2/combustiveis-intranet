const {
  buscarPagina,
  resolverTipoParaSefaz,
  enriquecerComBandeiras,
  filtrarPorTipo,
  ordenarRegistros
} = require('../services/sefaz.service');

const { gerarExcel } = require('../services/excel.service');

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

    const tipoParaSefaz = resolverTipoParaSefaz(tipoCombustivel);

    const data = await buscarPagina({
      tipoCombustivel: tipoParaSefaz,
      dias,
      codigoIBGE,
      pagina,
      registrosPorPagina
    });

    if (Array.isArray(data?.conteudo)) {
      await enriquecerComBandeiras(data.conteudo);
      data.conteudo = filtrarPorTipo(data.conteudo, tipoCombustivel);
      data.conteudo = ordenarRegistros(data.conteudo, ordenarPor);
    }

    res.json(data);

  } catch (error) {
    console.error('❌ Erro getCombustiveis:', error.message);
    res.status(500).json({ error: 'Erro interno ao buscar combustíveis' });
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
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.send(buffer);

  } catch (error) {
    if (error.message === 'EXPORTACAO_MUITO_GRANDE') {
      return res.status(400).json({ error: 'Exportação muito grande. Refine os filtros.' });
    }

    console.error('❌ Erro exportarExcel:', error.message);
    res.status(500).json({ error: 'Erro ao gerar Excel' });
  }
};

module.exports = { getCombustiveis, exportarExcel };