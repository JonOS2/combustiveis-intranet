const axios = require('axios');
const prisma = require('../database/prisma');

const BASE_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';
const DIAS_VALIDADE_PADRAO = 45;
const DIAS_BUSCA_PADRAO = 45;
const CODIGO_CREDITO_LIVRE = 20635;
const VALOR_CREDITO_LIVRE_MANUAL = 6.28;

const adicionarDias = (data, dias) => {
  const novaData = new Date(data);
  novaData.setDate(novaData.getDate() + dias);
  return novaData;
};

const formatarDataBR = (data) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data);

const parseDataBR = (valor) => {
  const [dia, mes, ano] = valor.split('/').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
};

const parseNumeroBCB = (valor) => {
  const numero = Number(String(valor).replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
};

const obterDataPadrao = () => formatarDataBR(new Date());

const obterDataInicialPadrao = () => {
  const data = new Date();
  data.setDate(data.getDate() - DIAS_BUSCA_PADRAO);
  return formatarDataBR(data);
};

const buscarSerie = async ({ codigo, dataInicial, dataFinal }) => {
  const dataInicialFormatada = dataInicial || obterDataInicialPadrao();
  const dataFinalFormatada = dataFinal || obterDataPadrao();
  const url = `${BASE_URL}.${codigo}/dados?formato=json&dataInicial=${encodeURIComponent(dataInicialFormatada)}&dataFinal=${encodeURIComponent(dataFinalFormatada)}`;
  const response = await axios.get(url, { timeout: 12000 });
  return Array.isArray(response.data) ? response.data : [];
};

const ordenarSerie = (dados) => [...dados].sort((a, b) => parseDataBR(a.data) - parseDataBR(b.data));

const extrairValorSerie = (dados) => {
  if (!Array.isArray(dados) || dados.length === 0) {
    throw new Error('SERIE_SEM_DADOS');
  }

  const serieOrdenada = ordenarSerie(dados);
  const ultimaLeitura = serieOrdenada[serieOrdenada.length - 1];
  const valorBruto = parseNumeroBCB(ultimaLeitura?.valor);

  if (valorBruto == null) {
    throw new Error('SERIE_INVALIDA');
  }

  return {
    valor: valorBruto,
    valorBruto,
    dataReferencia: parseDataBR(ultimaLeitura.data),
  };
};

const obterIndicadorManual = async ({ codigo, nome, validadeDias }) => {
  const agora = new Date();
  const validadeAte = adicionarDias(agora, validadeDias);
  const valor = VALOR_CREDITO_LIVRE_MANUAL;

  const salvo = await prisma.indicadorBCB.upsert({
    where: { codigo },
    update: {
      nome,
      valor,
      valorAtualSerie: valor,
      valorBaseSerie: valor,
      dataReferencia: agora,
      validadeAte,
    },
    create: {
      codigo,
      nome,
      valor,
      valorAtualSerie: valor,
      valorBaseSerie: valor,
      dataReferencia: agora,
      validadeAte,
    },
  });

  return { ...salvo, origem: 'manual' };
};

const obterIndicador = async ({ codigo, nome, dataInicial, dataFinal, validadeDias = DIAS_VALIDADE_PADRAO }) => {
  const agora = new Date();
  const registro = await prisma.indicadorBCB.findUnique({ where: { codigo } });

  if (codigo === CODIGO_CREDITO_LIVRE) {
    return obterIndicadorManual({ codigo, nome, validadeDias });
  }

  if (registro && registro.validadeAte && registro.validadeAte > agora) {
    return { ...registro, origem: 'cache' };
  }

  const serie = await buscarSerie({ codigo, dataInicial, dataFinal });
  const calculado = extrairValorSerie(serie);
  const validadeAte = adicionarDias(agora, validadeDias);

  const salvo = await prisma.indicadorBCB.upsert({
    where: { codigo },
    update: {
      nome,
      valor: calculado.valor,
      valorAtualSerie: calculado.valorBruto,
      valorBaseSerie: calculado.valorBase ?? calculado.valorBruto,
      dataReferencia: calculado.dataReferencia,
      validadeAte,
    },
    create: {
      codigo,
      nome,
      valor: calculado.valor,
      valorAtualSerie: calculado.valorBruto,
      valorBaseSerie: calculado.valorBase ?? calculado.valorBruto,
      dataReferencia: calculado.dataReferencia,
      validadeAte,
    },
  });

  return { ...salvo, origem: 'bcb' };
};

module.exports = {
  obterIndicador,
  extrairValorSerie,
};