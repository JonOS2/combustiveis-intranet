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

    const [precosHoje, precos30dias, precosPorBandeira, precosPorMunicipio, precosPorBairro] = await Promise.all([
      prisma.preco.findMany({
        where: where(1),
        include: { posto: { include: { municipio: true } }, combustivel: true },
        orderBy: { valorDeclarado: 'asc' },
      }),

      prisma.preco.groupBy({
        by: ['dataVenda'],
        where: where(30),
        _avg: { valorDeclarado: true, valorVenda: true },
        _min: { valorDeclarado: true },
        _max: { valorDeclarado: true },
        _count: { id: true },
        orderBy: { dataVenda: 'asc' },
      }),

      // Média por bandeira
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

      // Média por município (top 10 — estado inteiro)
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

      // Concentração por bairro no município selecionado
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
    ]);

    let precosBase = precosHoje;
    if (precosBase.length === 0) {
      precosBase = await prisma.preco.findMany({
        where: where(7),
        include: { posto: { include: { municipio: true } }, combustivel: true },
        orderBy: { valorDeclarado: 'asc' },
      });
    }

    const vistos = new Set();
    const precosDeduplicated = precosBase
      .sort((a, b) => new Date(b.dataVenda) - new Date(a.dataVenda))
      .filter((p) => {
        if (vistos.has(p.postoId)) return false;
        vistos.add(p.postoId);
        return true;
      })
      .sort((a, b) => (a.valorDeclarado ?? 0) - (b.valorDeclarado ?? 0));

    const valores = precosDeduplicated.map(p => p.valorDeclarado ?? p.valorVenda).filter(Boolean);
    const mediaAtual = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
    const menorPreco = valores[0] || 0;
    const maiorPreco = valores[valores.length - 1] || 0;

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
    });

  } catch (error) {
    console.error('❌ Erro getDashboard:', error.message);
    res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
  }
};

module.exports = { getDashboard };