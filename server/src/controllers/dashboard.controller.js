const prisma = require('../database/prisma');

const diasAtras = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getDashboard = async (req, res) => {
  try {
    const tipoCombustivel = parseInt(req.query.tipoCombustivel) || 1;
    const codigoIBGE = parseInt(req.query.codigoIBGE) || 2704302;

    const where = (dias) => ({
      dataVenda: { gte: diasAtras(dias) },
      combustivel: { tipo: tipoCombustivel },
      posto: { municipio: { codigoIBGE } },
    });

    const [precosHoje, precos30dias, precosPorBandeira, precosPorMunicipio, precosPorBairro, indiceEtanol] = await Promise.all([
      prisma.preco.findMany({
        where: where(1),
        include: { posto: { include: { municipio: true } }, combustivel: true },
        orderBy: { dataVenda: 'desc' },
      }),

      prisma.preco.groupBy({
        by: ['dataVenda'],
        where: where(30),
        _avg: { valorDeclarado: true },
        _min: { valorDeclarado: true },
        _max: { valorDeclarado: true },
        _count: { id: true },
        orderBy: { dataVenda: 'asc' },
      }),

      prisma.$queryRaw`
        SELECT po.bandeira, AVG(pr."valorDeclarado") as media, COUNT(pr.id) as total
        FROM "Preco" pr
        JOIN "Posto" po ON po.id = pr."postoId"
        JOIN "Municipio" m ON m.id = po."municipioId"
        JOIN "Combustivel" c ON c.id = pr."combustivelId"
        WHERE pr."dataVenda" >= ${diasAtras(7)}
          AND c.tipo = ${tipoCombustivel}
          AND m."codigoIBGE" = ${codigoIBGE}
          AND po.bandeira IS NOT NULL
        GROUP BY po.bandeira
        ORDER BY media ASC
      `,

      prisma.$queryRaw`
        SELECT m.nome as municipio, AVG(pr."valorDeclarado") as media, COUNT(DISTINCT po.id) as postos
        FROM "Preco" pr
        JOIN "Posto" po ON po.id = pr."postoId"
        JOIN "Municipio" m ON m.id = po."municipioId"
        JOIN "Combustivel" c ON c.id = pr."combustivelId"
        WHERE pr."dataVenda" >= ${diasAtras(7)}
          AND c.tipo = ${tipoCombustivel}
        GROUP BY m.nome
        HAVING COUNT(DISTINCT po.id) >= 2
        ORDER BY media ASC
        LIMIT 10
      `,

      prisma.$queryRaw`
        SELECT po.bairro, COUNT(DISTINCT po.id) as postos, AVG(pr."valorDeclarado") as media
        FROM "Preco" pr
        JOIN "Posto" po ON po.id = pr."postoId"
        JOIN "Municipio" m ON m.id = po."municipioId"
        JOIN "Combustivel" c ON c.id = pr."combustivelId"
        WHERE pr."dataVenda" >= ${diasAtras(7)}
          AND c.tipo = ${tipoCombustivel}
          AND m."codigoIBGE" = ${codigoIBGE}
          AND po.bairro IS NOT NULL
        GROUP BY po.bairro
        ORDER BY postos DESC
        LIMIT 12
      `,

      // Índice etanol/gasolina — postos que vendem os dois tipos
      // Só faz sentido quando o filtro é gasolina comum (tipo 1) ou etanol (tipo 3)
      prisma.$queryRaw`
        SELECT
          po.id,
          po."nomeFantasia",
          po."razaoSocial",
          po.bairro,
          MAX(CASE WHEN c.tipo = 1 THEN pr."valorDeclarado" END) as gasolina,
          MAX(CASE WHEN c.tipo = 3 THEN pr."valorDeclarado" END) as etanol
        FROM "Preco" pr
        JOIN "Posto" po ON po.id = pr."postoId"
        JOIN "Municipio" m ON m.id = po."municipioId"
        JOIN "Combustivel" c ON c.id = pr."combustivelId"
        WHERE pr."dataVenda" >= ${diasAtras(1)}
          AND c.tipo IN (1, 3)
          AND m."codigoIBGE" = ${codigoIBGE}
        GROUP BY po.id, po."nomeFantasia", po."razaoSocial", po.bairro
        HAVING
          MAX(CASE WHEN c.tipo = 1 THEN pr."valorDeclarado" END) IS NOT NULL
          AND MAX(CASE WHEN c.tipo = 3 THEN pr."valorDeclarado" END) IS NOT NULL
        ORDER BY (MAX(CASE WHEN c.tipo = 3 THEN pr."valorDeclarado" END) /
                  MAX(CASE WHEN c.tipo = 1 THEN pr."valorDeclarado" END)) ASC
        LIMIT 20
      `,
    ]);

    // Se não tem dados hoje, busca últimos 7 dias
    let precosBase = precosHoje;
    if (precosBase.length === 0) {
      precosBase = await prisma.preco.findMany({
        where: where(7),
        include: { posto: { include: { municipio: true } }, combustivel: true },
        orderBy: { dataVenda: 'desc' },
      });
    }

    // Deduplica por CNPJ — mantém apenas o registro mais recente por posto
    const vistos = new Set();
    const precosDeduplicated = precosBase
      .filter((p) => {
        const cnpj = p.posto.cnpj;
        if (vistos.has(cnpj)) return false;
        vistos.add(cnpj);
        return true;
      })
      .sort((a, b) => (a.valorDeclarado ?? 0) - (b.valorDeclarado ?? 0));

    const valores = precosDeduplicated.map(p => p.valorDeclarado ?? p.valorVenda).filter(Boolean);
    const mediaAtual = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
    const menorPreco = valores.length ? Math.min(...valores) : 0;
    const maiorPreco = valores.length ? Math.max(...valores) : 0;

    const precosSemanaAnterior = await prisma.preco.findMany({
      where: {
        dataVenda: { gte: diasAtras(14), lt: diasAtras(7) },
        combustivel: { tipo: tipoCombustivel },
        posto: { municipio: { codigoIBGE } },
      },
      select: { valorDeclarado: true },
    });
    const valoresSemanaAnterior = precosSemanaAnterior.map(p => p.valorDeclarado).filter(Boolean);
    const mediaSemanaAnterior = valoresSemanaAnterior.length
      ? valoresSemanaAnterior.reduce((a, b) => a + b, 0) / valoresSemanaAnterior.length
      : null;

    const variacaoMedia = mediaSemanaAnterior
      ? ((mediaAtual - mediaSemanaAnterior) / mediaSemanaAnterior) * 100
      : null;

    const top10 = precosDeduplicated.slice(0, 10).map(p => ({
      posto: p.posto.nomeFantasia || p.posto.razaoSocial || p.posto.cnpj,
      bairro: p.posto.bairro,
      bandeira: p.posto.bandeira,
      valorDeclarado: p.valorDeclarado,
      valorVenda: p.valorVenda,
      dataVenda: p.dataVenda,
    }));

    const faixas = {};
    valores.forEach(v => {
      const faixa = (Math.floor(v * 10) / 10).toFixed(1);
      faixas[faixa] = (faixas[faixa] || 0) + 1;
    });
    const histograma = Object.entries(faixas)
      .map(([faixa, count]) => ({ faixa: `R$ ${faixa}`, count }))
      .sort((a, b) => parseFloat(a.faixa.replace('R$ ', '')) - parseFloat(b.faixa.replace('R$ ', '')));

    const postosAcimaMedia = valores.filter(v => v > mediaAtual).length;
    const percentualAcimaMedia = valores.length ? (postosAcimaMedia / valores.length) * 100 : 0;

    // Formata índice etanol/gasolina
    const indiceEtanolFormatado = indiceEtanol.map(p => {
      const gasolina = parseFloat(p.gasolina);
      const etanol = parseFloat(p.etanol);
      const indice = etanol / gasolina;
      return {
        posto: p.nomeFantasia || p.razaoSocial || '—',
        bairro: p.bairro || '—',
        gasolina: parseFloat(gasolina.toFixed(3)),
        etanol: parseFloat(etanol.toFixed(3)),
        indice: parseFloat((indice * 100).toFixed(1)), // em %
        valeEtanol: indice <= 0.7,
      };
    });

    res.json({
      metricas: {
        mediaAtual,
        mediaSemanaAnterior,
        variacaoMedia,
        menorPreco,
        maiorPreco,
        totalPostos: precosDeduplicated.length,
        postosAcimaMedia,
        percentualAcimaMedia,
      },
      top10,
      historico: precos30dias.map(d => ({
        data: new Date(d.dataVenda).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        media: parseFloat((d._avg.valorDeclarado || 0).toFixed(3)),
        minimo: parseFloat((d._min.valorDeclarado || 0).toFixed(3)),
        maximo: parseFloat((d._max.valorDeclarado || 0).toFixed(3)),
        postos: d._count.id,
      })),
      porBandeira: precosPorBandeira.map(b => ({
        bandeira: b.bandeira || 'Sem bandeira',
        media: parseFloat(parseFloat(b.media).toFixed(3)),
        total: parseInt(b.total),
      })),
      porMunicipio: precosPorMunicipio.map(m => ({
        municipio: m.municipio,
        media: parseFloat(parseFloat(m.media).toFixed(3)),
        postos: parseInt(m.postos),
      })),
      porBairro: precosPorBairro.map(b => ({
        bairro: b.bairro,
        postos: parseInt(b.postos),
        media: parseFloat(parseFloat(b.media).toFixed(3)),
      })),
      histograma,
      indiceEtanol: indiceEtanolFormatado,
    });

  } catch (error) {
    console.error('❌ Erro getDashboard:', error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
  }
};

module.exports = { getDashboard };