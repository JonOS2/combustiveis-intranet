/**
 * BACKFILL ANP — Bandeiras + Coordenadas
 *
 * Busca todos os postos e atualiza:
 *   - bandeira (distribuidora)
 *   - latitude/longitude (coordenadas levantadas em campo pela ANP)
 *
 * As coordenadas da ANP são muito mais precisas que o Nominatim,
 * pois foram coletadas por agentes de fiscalização in loco.
 *
 * Como usar:
 *   cd server
 *   node backfill-anp.js
 *
 * Flags opcionais:
 *   --todos         Reprocessa todos os postos (não só sem bandeira/coordenada)
 *   --apenas-coords Atualiza apenas coordenadas (ignora bandeira)
 *
 * Limite da ANP: ~25 req/hora (144s entre requisições)
 * Tempo estimado: ~525 postos = ~21 horas (rodar em background)
 *
 * Para rodar só os sem coordenada (mais rápido):
 *   node backfill-anp.js
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5434/combustiveis';
const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const TODOS = args.includes('--todos');
const APENAS_COORDS = args.includes('--apenas-coords');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const buscarDadosANP = async (cnpj) => {
  try {
    const res = await axios.get(
      `https://revendedoresapi.anp.gov.br/v1/combustivel?cnpj=${cnpj}`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CombustiveisIntranet/1.0)',
          'Accept': 'application/json',
        }
      }
    );

    const dado = res.data?.data?.[0];
    if (!dado) return null;

    const lat = dado.latitude ? parseFloat(dado.latitude) : null;
    const lon = dado.longitude ? parseFloat(dado.longitude) : null;

    return {
      bandeira: dado.distribuidora || null,
      latitude: lat && lon && lat !== 0 && lon !== 0 ? lat : null,
      longitude: lat && lon && lat !== 0 && lon !== 0 ? lon : null,
      acuracia: dado.estimativaAcuracia || null,
    };
  } catch (err) {
    console.error(`  ❌ ANP (${cnpj}): ${err.message}`);
    return null;
  }
};

const main = async () => {
  // Seleciona postos conforme flags
  const where = TODOS ? {} : {
    OR: [
      { bandeira: null },
      { latitude: null },
      { latitude: 0 },
      { longitude: null },
      { longitude: 0 },
    ],
  };

  const postos = await prisma.posto.findMany({
    where,
    select: { id: true, cnpj: true, nomeFantasia: true, razaoSocial: true, bandeira: true, latitude: true, longitude: true },
    orderBy: { id: 'asc' },
  });

  const modo = TODOS ? 'todos os postos' : 'postos sem bandeira ou coordenada';
  console.log(`🔍 ${postos.length} ${modo} encontrados`);
  console.log(`⏱️  Tempo estimado: ~${Math.ceil(postos.length * 60 / 3600)}h (60s entre requisições)\n`);

  if (postos.length === 0) {
    console.log('✅ Nada a atualizar!');
    await prisma.$disconnect();
    return;
  }

  let bandeirasAtualizadas = 0;
  let coordsAtualizadas = 0;
  let naoEncontrados = 0;

  for (let i = 0; i < postos.length; i++) {
    const posto = postos[i];
    const nome = posto.nomeFantasia || posto.razaoSocial || posto.cnpj;
    console.log(`[${i + 1}/${postos.length}] ${nome}`);

    const dados = await buscarDadosANP(posto.cnpj);

    if (!dados) {
      console.log(`  ⚠️  Não encontrado na ANP`);
      naoEncontrados++;
    } else {
      const update = {};

      // Atualiza bandeira se encontrada e não estamos em modo apenas-coords
      if (!APENAS_COORDS && dados.bandeira && dados.bandeira !== posto.bandeira) {
        update.bandeira = dados.bandeira;
        bandeirasAtualizadas++;
      }

      // Atualiza coordenadas se a ANP tiver dado válido
      if (dados.latitude && dados.longitude) {
        update.latitude = dados.latitude;
        update.longitude = dados.longitude;
        coordsAtualizadas++;
      }

      if (Object.keys(update).length > 0) {
        await prisma.posto.update({ where: { id: posto.id }, data: update });
        const partes = [];
        if (update.bandeira) partes.push(`bandeira: ${update.bandeira}`);
        if (update.latitude) partes.push(`coords: ${update.latitude.toFixed(6)}, ${update.longitude.toFixed(6)}${dados.acuracia ? ` (±${dados.acuracia}m)` : ''}`);
        console.log(`  ✅ ${partes.join(' | ')}`);
      } else {
        console.log(`  — Sem novidades`);
      }
    }

    // 60s entre requisições — seguro e mais rápido que os 144s conservadores
    if (i < postos.length - 1) await delay(60000);
  }

  console.log(`\n✅ Concluído`);
  console.log(`   Bandeiras atualizadas: ${bandeirasAtualizadas}`);
  console.log(`   Coordenadas atualizadas: ${coordsAtualizadas}`);
  console.log(`   Não encontrados na ANP: ${naoEncontrados}`);

  await prisma.$disconnect();
};

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});