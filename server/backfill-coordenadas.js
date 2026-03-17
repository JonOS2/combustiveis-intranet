/**
 * BACKFILL DE COORDENADAS — Nominatim (OpenStreetMap)
 *
 * Busca postos sem coordenadas (latitude = 0 ou longitude = 0) e
 * geocodifica pelo endereço usando a API gratuita do Nominatim.
 *
 * Como usar:
 *   cd server
 *   node backfill-coordenadas.js
 *
 * Regras do Nominatim:
 *   - Máximo 1 requisição por segundo (o script respeita isso)
 *   - User-Agent identificando a aplicação (obrigatório)
 *   - Sem uso comercial intensivo
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5434/combustiveis';

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const geocodificar = async (posto) => {
  // Monta query do mais específico para o mais genérico
  const queries = [
    // 1. Endereço completo com número
    `${posto.endereco}, ${posto.numero}, ${posto.bairro}, ${posto.municipioNome}, Alagoas, Brasil`,
    // 2. Sem número
    `${posto.endereco}, ${posto.bairro}, ${posto.municipioNome}, Alagoas, Brasil`,
    // 3. Só logradouro + município
    `${posto.endereco}, ${posto.municipioNome}, Alagoas, Brasil`,
    // 4. CEP (mais preciso quando disponível)
    posto.cep ? `${posto.cep}, Brasil` : null,
  ].filter(Boolean);

  for (const q of queries) {
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q, format: 'json', limit: 1, countrycodes: 'br' },
        headers: {
          'User-Agent': 'CombustiveisIntranet/1.0 (uso interno AMGESP Alagoas)',
          'Accept-Language': 'pt-BR',
        },
        timeout: 10000,
      });

      if (res.data?.length > 0) {
        const { lat, lon } = res.data[0];
        return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
      }
    } catch (err) {
      console.error(`  ❌ Nominatim erro: ${err.message}`);
    }

    // Respeita o limite de 1 req/s entre tentativas da mesma query
    await delay(1100);
  }

  return null;
};

const main = async () => {
  const postos = await prisma.posto.findMany({
    where: {
      OR: [
        { latitude: 0 },
        { longitude: 0 },
        { latitude: null },
        { longitude: null },
      ],
    },
    include: { municipio: true },
    orderBy: { id: 'asc' },
  });

  console.log(`🗺️  ${postos.length} postos sem coordenadas encontrados\n`);

  if (postos.length === 0) {
    console.log('✅ Todos os postos já têm coordenadas!');
    await prisma.$disconnect();
    return;
  }

  let atualizados = 0;
  let naoEncontrados = 0;

  for (let i = 0; i < postos.length; i++) {
    const posto = {
      id: postos[i].id,
      endereco: postos[i].endereco || '',
      numero: postos[i].numero || '',
      bairro: postos[i].bairro || '',
      cep: postos[i].cep || '',
      municipioNome: postos[i].municipio?.nome || 'Maceio',
      nomeFantasia: postos[i].nomeFantasia || postos[i].razaoSocial || postos[i].id,
    };

    console.log(`[${i + 1}/${postos.length}] ${posto.nomeFantasia}`);
    console.log(`  📍 ${posto.endereco}, ${posto.numero} — ${posto.bairro}, ${posto.municipioNome}`);

    const coords = await geocodificar(posto);

    if (coords) {
      await prisma.posto.update({
        where: { id: posto.id },
        data: { latitude: coords.latitude, longitude: coords.longitude },
      });
      console.log(`  ✅ ${coords.latitude}, ${coords.longitude}`);
      atualizados++;
    } else {
      console.log(`  ⚠️  Não encontrado`);
      naoEncontrados++;
    }

    // 1.1s entre postos para respeitar o limite do Nominatim
    if (i < postos.length - 1) await delay(1100);
  }

  const duracao = ((postos.length * 1.1) / 60).toFixed(1);
  console.log(`\n✅ Concluído em ~${duracao}min`);
  console.log(`   ${atualizados} atualizados, ${naoEncontrados} não encontrados`);

  await prisma.$disconnect();
};

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});