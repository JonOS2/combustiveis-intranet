/**
 * BACKFILL DE BANDEIRAS ANP
 * 
 * Como usar:
 *   cd server
 *   node backfill-bandeiras.js
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// URL local — porta 5434 exposta pelo Docker
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5434/combustiveis';

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const buscarBandeira = async (cnpj) => {
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
    return res.data?.data?.[0]?.distribuidora || null;
  } catch (err) {
    console.error(`  ❌ ANP (${cnpj}): ${err.message}`);
    return null;
  }
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const main = async () => {
  const postos = await prisma.posto.findMany({
    where: { bandeira: null },
    select: { id: true, cnpj: true, nomeFantasia: true },
  });

  console.log(`🔍 ${postos.length} postos sem bandeira encontrados`);

  let atualizados = 0;
  let semBandeira = 0;

  for (let i = 0; i < postos.length; i++) {
    const posto = postos[i];
    console.log(`[${i + 1}/${postos.length}] ${posto.nomeFantasia || posto.cnpj}`);

    const bandeira = await buscarBandeira(posto.cnpj);

    if (bandeira) {
      await prisma.posto.update({
        where: { id: posto.id },
        data: { bandeira },
      });
      console.log(`  ✅ ${bandeira}`);
      atualizados++;
    } else {
      semBandeira++;
    }

    // 2.4 minutos entre requisições = 25 por hora
    if (i < postos.length - 1) await delay(144000);
  }

  console.log(`\n✅ Concluído — ${atualizados} atualizados, ${semBandeira} sem bandeira na ANP`);
  await prisma.$disconnect();
};

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});