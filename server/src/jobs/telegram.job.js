const prisma = require('../database/prisma');
const { enviarMensagemTelegram } = require('../services/telegram.service');

const MUNICIPIO_MACEIO = 2704302;
const TIPO_GASOLINA = 1;
const LIMITE = 10;
const TIMEZONE = 'America/Maceio';

const formatarData = (data) => new Intl.DateTimeFormat('pt-BR', { timeZone: TIMEZONE }).format(new Date(data));
const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(valor || 0);

const obterDataHoje = () => {
  const dataStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const inicio = new Date(`${dataStr}T00:00:00Z`);
  const fim = new Date(`${dataStr}T00:00:00Z`);
  fim.setUTCDate(fim.getUTCDate() + 1);

  return { dataStr, inicio, fim };
};

const montarEndereco = (posto) => {
  const partes = [
    posto.endereco,
    posto.numero,
    posto.bairro,
    posto.municipio?.nome,
  ].filter(Boolean);

  return partes.join(', ').trim();
};

const escapeHtml = (valor) => {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const montarLinkMapa = (endereco) => {
  if (!endereco) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;
};

const listarPostosMaisBaratos = async () => {
  const { dataStr, inicio, fim } = obterDataHoje();

  const precosRaw = await prisma.preco.findMany({
    where: {
      dataVenda: { gte: inicio, lt: fim },
      combustivel: { tipo: TIPO_GASOLINA },
      valorDeclarado: { not: null },
      posto: { municipio: { codigoIBGE: MUNICIPIO_MACEIO } },
    },
    include: { posto: { include: { municipio: true } }, combustivel: true },
    orderBy: [{ dataVenda: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
  });

  const vistos = new Set();
  const maisRecentes = [];

  for (const preco of precosRaw) {
    const chave = preco.posto.cnpj;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    maisRecentes.push(preco);
  }

  maisRecentes.sort((a, b) => (a.valorDeclarado ?? Infinity) - (b.valorDeclarado ?? Infinity));

  return { dataStr, postos: maisRecentes.slice(0, LIMITE) };
};

const montarMensagemTopPostos = async () => {
  const { dataStr, postos } = await listarPostosMaisBaratos();

  if (postos.length === 0) {
    return { texto: 'Ainda não houve atualização hoje', parseMode: 'HTML' };
  }

  const linhas = postos.map((p, index) => {
    const nome = escapeHtml(p.posto.nomeFantasia || p.posto.razaoSocial || 'Posto sem nome');
    const endereco = montarEndereco(p.posto);
    const valor = escapeHtml(formatarMoeda(p.valorDeclarado));
    const data = escapeHtml(formatarData(p.dataVenda));
    const linkMapa = montarLinkMapa(endereco);
    const enderecoTexto = endereco
      ? `<a href="${linkMapa}">${escapeHtml(endereco)}</a>`
      : 'Endereço indisponível';

    return `${index + 1}. ${nome} — ${valor} — ${data}\n${enderecoTexto}`;
  });

  const cabecalho = [
    '<b>⛽️ 10 postos de gasolina mais baratos — Maceió</b>',
    `Base: ${escapeHtml(formatarData(new Date(`${dataStr}T00:00:00Z`)))}`,
    '',
  ].join('\n');

  return { texto: `${cabecalho}${linhas.join('\n\n')}`, parseMode: 'HTML' };
};

const enviarTopPostosTelegram = async () => {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.warn('⚠️  Telegram não configurado. Defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID.');
    return;
  }

  const { texto, parseMode } = await montarMensagemTopPostos();
  await enviarMensagemTelegram({ texto, parseMode });
};

module.exports = { enviarTopPostosTelegram, montarMensagemTopPostos };
