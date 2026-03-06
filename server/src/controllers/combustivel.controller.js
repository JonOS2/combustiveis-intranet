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

// Converte registro do banco para o formato que o frontend espera
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

    const [precos, total] = await Promise.all([
      prisma.preco.findMany({
        where,
        include: {
          posto: { include: { municipio: true } },
          combustivel: true,
        },
        orderBy: {
          [ordenarPor === 'venda' ? 'valorVenda' : 'valorDeclarado']: 'asc',
        },
        skip: (pagina - 1) * registrosPorPagina,
        take: registrosPorPagina,
      }),
      prisma.preco.count({ where }),
    ]);

    // Fallback para API SEFAZ se banco vazio
    if (total === 0) {
      console.warn(`⚠️  Banco vazio para IBGE ${codigoIBGE} tipo ${tipoCombustivel} — usando API SEFAZ`);

      const data = await buscarPagina({
        tipoCombustivel: tipoBanco,
        dias,
        codigoIBGE,
        pagina,
        registrosPorPagina,
      });

      if (Array.isArray(data?.conteudo)) {
        await enriquecerComBandeiras(data.conteudo);
        data.conteudo = filtrarPorTipo(data.conteudo, tipoCombustivel);
        data.conteudo = ordenarRegistros(data.conteudo, ordenarPor);
      }

      return res.json({ ...data, fonte: 'sefaz' });
    }

    let conteudo = precos.map(formatarRegistroDoBanco);
    conteudo = filtrarPorTipo(conteudo, tipoCombustivel);

    res.json({
      conteudo,
      pagina,
      totalPaginas: Math.ceil(total / registrosPorPagina),
      totalRegistros: total,
      fonte: 'banco',
    });

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

/* =========================
   SYNC MANUAL
   POST /api/combustivel/sync
========================= */
const syncManual = async (req, res) => {
  try {
    res.json({ message: 'Sincronização iniciada em background.' });
    sincronizar().catch((err) =>
      console.error('❌ Erro no sync manual:', err.message)
    );
  } catch (error) {
    console.error('❌ Erro syncManual:', error.message);
    res.status(500).json({ error: 'Erro ao iniciar sincronização' });
  }
};

module.exports = { getCombustiveis, exportarExcel, syncManual };
