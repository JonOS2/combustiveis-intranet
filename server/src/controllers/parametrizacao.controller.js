const { obterIndicador } = require('../services/bcb.service');

const getSerie = async (req, res) => {
  try {
    const codigo = parseInt(req.params.codigo, 10);

    if (!Number.isFinite(codigo)) {
      return res.status(400).json({ error: 'Código SGS inválido.' });
    }

    const nome = req.query.nome || `Série ${codigo}`;
    const dataInicial = typeof req.query.dataInicial === 'string' ? req.query.dataInicial : undefined;
    const dataFinal = typeof req.query.dataFinal === 'string' ? req.query.dataFinal : undefined;
    const indicador = await obterIndicador({ codigo, nome, dataInicial, dataFinal });

    return res.json({
      codigo: indicador.codigo,
      nome: indicador.nome,
      valor: indicador.valor,
      dataReferencia: indicador.dataReferencia,
      validadeAte: indicador.validadeAte,
      atualizadoEm: indicador.updatedAt,
      origem: indicador.origem,
    });
  } catch (error) {
    console.error('❌ Erro getSerie BCB:', error.message);
    res.status(500).json({ error: 'Erro ao buscar série do BCB.' });
  }
};

module.exports = { getSerie };