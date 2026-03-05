require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const XLSX = require('xlsx');
const { salvarRegistro } = require('./src/services/sefazIngest.service');

const app = express();

/* =========================
   MIDDLEWARES
========================= */
app.use(cors({
  origin: '*',
  exposedHeaders: ['Content-Disposition']
}));

app.use(express.json());

/* =========================
   CONFIG
========================= */
const SEFAZ_URL =
  'http://api.sefaz.al.gov.br/sfz-economiza-alagoas-api/api/public/combustivel/pesquisa';

const APP_TOKEN = process.env.APP_TOKEN;

if (!APP_TOKEN) {
  console.error('❌ APP_TOKEN não definido no .env');
  process.exit(1);
}

/* =========================
   FUNÇÕES BASE
========================= */
const buscarPagina = async ({
  tipoCombustivel,
  dias,
  codigoIBGE,
  pagina,
  registrosPorPagina
}) => {
  const body = {
    produto: { tipoCombustivel },
    dias,
    estabelecimento: {
      municipio: { codigoIBGE }
    },
    pagina,
    registrosPorPagina
  };

  const response = await axios.post(SEFAZ_URL, body, {
    headers: {
      appToken: APP_TOKEN,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  return response.data;
};

const normalizarTexto = (texto = '') =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();

/* =========================
   ANP – BANDEIRA
========================= */

const ehAditivado = (descricao = '') => {
  const texto = descricao.toUpperCase();

  const palavrasAditivado = [
    'ADIT',
    'GRID',
    'ADITIVAD',
    'SHELL EVOLUX',
    'ADITIVADO'
  ];

  return palavrasAditivado.some(palavra =>
    texto.includes(palavra)
  );
};

const cacheBandeiras = {};

const buscarBandeiraPorCNPJ = async (cnpj) => {
  if (!cnpj) return null;

  if (cacheBandeiras[cnpj]) {
    return cacheBandeiras[cnpj];
  }

  try {
    const res = await axios.get(
      `https://revendedoresapi.anp.gov.br/v1/combustivel?cnpj=${cnpj}`,
      { timeout: 5000 }
    );

    const bandeira = res.data?.data?.[0]?.distribuidora || null;
    cacheBandeiras[cnpj] = bandeira;

    return bandeira;

  } catch (error) {
    console.error(`❌ Erro ANP (${cnpj}):`, error.message);
    return null;
  }
};

/* =========================
   ROTA PRINCIPAL
========================= */
app.post('/api/combustivel', async (req, res) => {
  try {
    const {
      tipoCombustivel = 1,
      dias = 7,
      codigoIBGE = 2704302,
      pagina = 1,
      registrosPorPagina = 50,
      ordenarPor = 'declarado'
    } = req.body;

    let tipoParaSefaz = tipoCombustivel;

    // Se for 7 (S10 aditivado), busca como 5 na SEFAZ
    if (tipoCombustivel === 7) {
      tipoParaSefaz = 5;
    }

    const data = await buscarPagina({
      tipoCombustivel: tipoParaSefaz,
      dias,
      codigoIBGE,
      pagina,
      registrosPorPagina
    });

    if (Array.isArray(data?.conteudo)) {
      await Promise.all(
        data.conteudo.map(async (item) => {
          const cnpj = item?.estabelecimento?.cnpj;
          item.estabelecimento.bandeira =
            await buscarBandeiraPorCNPJ(cnpj);
        })
      );

      data.conteudo = data.conteudo.filter((item) => {
        const descricao = item?.produto?.descricao;
        const aditivado = ehAditivado(descricao);

        if (tipoCombustivel === 7) {
          return aditivado; // só aditivado
        }

        if (tipoCombustivel === 5) {
          return !aditivado; // só comum
        }

        return true;
      });

      // 🔹 ORDENAÇÃO DINÂMICA
      data.conteudo.sort((a, b) => {
        const valorA =
           ordenarPor === 'venda'
            ? a.produto.venda.valorVenda
            : a.produto.venda.valorDeclarado;

        const valorB =
           ordenarPor === 'venda'
            ? b.produto.venda.valorVenda
            : b.produto.venda.valorDeclarado;

        return valorA - valorB;
      });
    }

    res.json(data);

  } catch (error) {
    console.error('❌ Erro API:', error.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* =========================
   EXPORTAÇÃO EXCEL
========================= */
app.post('/api/combustivel/excel', async (req, res) => {
  try {
    const {
      tipoCombustivel = 1,
      dias = 1,
      codigoIBGE = 2704302,
      registrosPorPagina = 50,
      modo = 'pagina',
      pagina = 1,
      ordenarPor = 'declarado'
    } = req.body;

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
        Math.ceil(
          (primeira.paginacao?.totalRegistros || 0) / registrosPorPagina
        ) ||
        1;

      if (totalPaginas > 20) {
        return res.status(400).json({
          error: 'Exportação muito grande. Refine os filtros.'
        });
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

    /* 🔹 ENRIQUECER COM BANDEIRA (ANP) */
    await Promise.all(
      todosRegistros.map(async (item) => {
        const cnpj = item?.estabelecimento?.cnpj;
        item.estabelecimento.bandeira =
          cnpj ? await buscarBandeiraPorCNPJ(cnpj) : null;
      })
    );

    let nomeMunicipio = 'municipio-desconhecido';
    if (todosRegistros.length > 0) {
      nomeMunicipio =
        todosRegistros[0]?.estabelecimento?.endereco?.municipio ||
        nomeMunicipio;
    }

    nomeMunicipio = normalizarTexto(nomeMunicipio);

    const mapaCombustivel = {
        1: 'gasolina-comum',
        2: 'gasolina-aditivada',
        3: 'etanol',
        4: 'diesel-comum',
        5: 'diesel-s10',
        6: 'gnv',
        7: 'diesel-s10-aditivado'
    };

    const tipoNome = mapaCombustivel[tipoCombustivel] || 'combustivel';

    const ordenacaoNome =
        ordenarPor === 'venda'
            ? 'ordenado-por-venda'
            : 'ordenado-por-declarado';

    const nomeArquivo =
        modo === 'tudo'
            ? `combustiveis-${nomeMunicipio}-${tipoNome}-${ordenacaoNome}-completo.xlsx`
            : `combustiveis-${nomeMunicipio}-${tipoNome}-${ordenacaoNome}-pagina-${pagina}.xlsx`;
    
    todosRegistros.sort((a, b) => {
        const valorA =
            ordenarPor === 'venda'
            ? a.produto.venda.valorVenda
            : a.produto.venda.valorDeclarado;

        const valorB =
            ordenarPor === 'venda'
            ? b.produto.venda.valorVenda
            : b.produto.venda.valorDeclarado;

        return valorA - valorB;
    });

    /* 🔹 DADOS DO EXCEL */
    const dadosExcel = todosRegistros.map(item => ({
      Posto:
        item.estabelecimento.nomeFantasia ||
        item.estabelecimento.razaoSocial,

      Produto: item.produto.descricao,

      'Valor Declarado (R$)': item.produto.venda.valorDeclarado,

      'Valor Venda (R$)': item.produto.venda.valorVenda,

      Bandeira: item.estabelecimento.bandeira,

      Data: item.produto.venda.dataVenda,

      Bairro: item.estabelecimento.endereco.bairro,

      Município: item.estabelecimento.endereco.municipio,

      CNPJ: item.estabelecimento.cnpj,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dadosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Combustíveis');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nomeArquivo}"`
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.send(buffer);

  } catch (error) {
    console.error('❌ Erro Excel:', error.message);
    res.status(500).json({ error: 'Erro ao gerar Excel' });
  }
});

/* =========================
   HEALTH
========================= */
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

/* =========================
   SERVER
========================= */
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
