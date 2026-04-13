const prisma = require('../database/prisma');
const { ehAditivado } = require('./sefaz.service');

async function salvarRegistro(item, tipoCombustivel) {
  const produto = item.produto;
  const estabelecimento = item.estabelecimento;
  const endereco = estabelecimento.endereco;
  const tipoNormalizado = (
    (tipoCombustivel === 5 || tipoCombustivel === 6) && ehAditivado(produto.descricao)
  ) ? 7 : tipoCombustivel;

  // 1️⃣ Município
  const municipio = await prisma.municipio.upsert({
    where: { codigoIBGE: endereco.codigoIBGE },
    update: { nome: endereco.municipio },
    create: {
      codigoIBGE: endereco.codigoIBGE,
      nome: endereco.municipio
    }
  });

  // 2️⃣ Posto
  // Só atualiza latitude/longitude se a SEFAZ retornar coordenadas válidas (não zero)
  // Isso preserva as coordenadas enriquecidas pelo backfill-coordenadas.js
  const coordenadasValidas = endereco.latitude && endereco.longitude &&
    endereco.latitude !== 0 && endereco.longitude !== 0;

  const posto = await prisma.posto.upsert({
    where: { cnpj: estabelecimento.cnpj },
    update: {
      razaoSocial:  estabelecimento.razaoSocial,
      nomeFantasia: estabelecimento.nomeFantasia,
      endereco:     endereco.nomeLogradouro,
      numero:       endereco.numeroImovel,
      bairro:       endereco.bairro,
      cep:          endereco.cep,
      telefone:     estabelecimento.telefone || null,
      ...(estabelecimento.bandeira && { bandeira: estabelecimento.bandeira }),
      ...(coordenadasValidas && {
        latitude:  endereco.latitude,
        longitude: endereco.longitude,
      }),
      municipioId: municipio.id
    },
    create: {
      cnpj:         estabelecimento.cnpj,
      razaoSocial:  estabelecimento.razaoSocial,
      nomeFantasia: estabelecimento.nomeFantasia,
      endereco:     endereco.nomeLogradouro,
      numero:       endereco.numeroImovel,
      bairro:       endereco.bairro,
      cep:          endereco.cep,
      latitude:     coordenadasValidas ? endereco.latitude : null,
      longitude:    coordenadasValidas ? endereco.longitude : null,
      telefone:     estabelecimento.telefone || null,
      bandeira:     estabelecimento.bandeira || null,
      municipioId:  municipio.id
    }
  });

  // 3️⃣ Combustível
  const combustivel = await prisma.combustivel.upsert({
    where: {
      codigo_tipo: {
        codigo: produto.codigo,
        tipo: tipoNormalizado,
      },
    },
    update: {
      descricao: produto.descricao,
      unidade:   produto.unidadeMedida,
      ...(tipoNormalizado != null && { tipo: tipoNormalizado }),
    },
    create: {
      codigo:    produto.codigo,
      descricao: produto.descricao,
      unidade:   produto.unidadeMedida,
      tipo:      tipoNormalizado ?? null,
    }
  });

  // 4️⃣ Preço
  await prisma.preco.upsert({
    where: {
      postoId_combustivelId_dataVenda: {
        postoId:       posto.id,
        combustivelId: combustivel.id,
        dataVenda:     new Date(produto.venda.dataVenda)
      }
    },
    update: {
      valorDeclarado: produto.venda.valorDeclarado,
      valorVenda:     produto.venda.valorVenda
    },
    create: {
      valorDeclarado: produto.venda.valorDeclarado,
      valorVenda:     produto.venda.valorVenda,
      dataVenda:      new Date(produto.venda.dataVenda),
      postoId:        posto.id,
      combustivelId:  combustivel.id
    }
  });
}

module.exports = { salvarRegistro };