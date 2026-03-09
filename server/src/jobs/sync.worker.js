const {
  buscarPagina,
  buscarBandeiraPorCNPJ,
} = require('../services/sefaz.service');
const { salvarRegistro } = require('../services/sefazIngest.service');

/* =========================
   MUNICÍPIOS DE ALAGOAS
========================= */
const MUNICIPIOS = [
  2700102, 2700201, 2700300, 2700409, 2700508, 2700607, 2700706, 2700805,
  2700904, 2701001, 2701100, 2701209, 2701308, 2701357, 2701407, 2701506,
  2701605, 2701704, 2701803, 2701902, 2702009, 2702108, 2702207, 2702306,
  2702355, 2702405, 2702504, 2702553, 2702603, 2702702, 2702801, 2702900,
  2703007, 2703106, 2703205, 2703304, 2703403, 2703502, 2703601, 2703700,
  2703759, 2703809, 2703908, 2704005, 2704104, 2704203, 2704302, 2704401,
  2704500, 2704609, 2704708, 2704807, 2704906, 2705002, 2705101, 2705200,
  2705309, 2705408, 2705507, 2705606, 2705705, 2705804, 2705903, 2706000,
  2706109, 2706208, 2706307, 2706406, 2706422, 2706448, 2706505, 2706604,
  2706703, 2706802, 2706901, 2707008, 2707107, 2707206, 2707305, 2707404,
  2707503, 2707602, 2707701, 2707800, 2707909, 2708006, 2708105, 2708204,
  2708303, 2708402, 2708501, 2708600, 2708709, 2708808, 2708907, 2708956,
  2709004, 2709103, 2709152, 2709202, 2709301, 2709400,
];

const TIPOS_COMBUSTIVEL = [1, 2, 3, 4, 5, 6];

/* =========================
   BUSCA TODAS AS PÁGINAS
========================= */
const buscarTodasPaginas = async ({ tipoCombustivel, codigoIBGE, dias = 1 }) => {
  const registrosPorPagina = 100;
  const primeira = await buscarPagina({
    tipoCombustivel,
    dias,
    codigoIBGE,
    pagina: 1,
    registrosPorPagina,
  });

  const conteudo = primeira.conteudo || [];
  const totalPaginas =
    primeira.totalPaginas ||
    Math.ceil((primeira.paginacao?.totalRegistros || 0) / registrosPorPagina) ||
    1;

  if (totalPaginas > 1) {
    const paginas = Array.from({ length: totalPaginas - 1 }, (_, i) => i + 2);
    const resultados = await Promise.all(
      paginas.map((p) =>
        buscarPagina({ tipoCombustivel, dias, codigoIBGE, pagina: p, registrosPorPagina })
      )
    );
    resultados.forEach((r) => conteudo.push(...(r.conteudo || [])));
  }

  return conteudo;
};

/* =========================
   SINCRONIZAÇÃO PRINCIPAL
========================= */
const sincronizar = async () => {
  const inicio = Date.now();
  console.log(`🔄 [SYNC] Iniciando — ${new Date().toLocaleString('pt-BR')}`);

  let totalSalvos = 0;
  let totalErros = 0;
  let municipioAtual = 0;

  for (const codigoIBGE of MUNICIPIOS) {
    municipioAtual++;
    console.log(`📍 [SYNC] Município ${municipioAtual}/${MUNICIPIOS.length} — IBGE ${codigoIBGE}`);

    for (const tipo of TIPOS_COMBUSTIVEL) {
      try {
        const registros = await buscarTodasPaginas({
          tipoCombustivel: tipo,
          codigoIBGE,
          dias: 1,
        });

        if (registros.length === 0) continue;

        console.log(`   ⛽ Tipo ${tipo}: ${registros.length} registros encontrados`);

        for (const item of registros) {
          try {
            // Busca bandeira com timeout curto — não trava o sync se ANP falhar
            const cnpj = item?.estabelecimento?.cnpj;
            item.estabelecimento.bandeira = await Promise.race([
              buscarBandeiraPorCNPJ(cnpj),
              new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
            ]);

            await salvarRegistro(item, tipo);
            totalSalvos++;
          } catch (err) {
            console.error(`   ❌ Erro ao salvar CNPJ ${item?.estabelecimento?.cnpj}:`, err.message);
            totalErros++;
          }
        }
      } catch (err) {
        console.error(`   ❌ Erro IBGE ${codigoIBGE} tipo ${tipo}:`, err.message);
        totalErros++;
      }
    }
  }

  const duracao = ((Date.now() - inicio) / 1000 / 60).toFixed(1);
  console.log(`✅ [SYNC] Concluída em ${duracao}min — ${totalSalvos} salvos, ${totalErros} erros`);
};

module.exports = { sincronizar };