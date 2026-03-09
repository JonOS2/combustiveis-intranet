const prisma = require('../database/prisma');

async function salvarRegistro(item, tipoCombustivel) {
  const produto = item.produto;
  const estabelecimento = item.estabelecimento;
  const endereco = estabelecimento.endereco;

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
  const posto = await prisma.posto.upsert({
    where: { cnpj: estabelecimento.cnpj },
    update: {
      razaoSocial:  estabelecimento.razaoSocial,
      nomeFantasia: estabelecimento.nomeFantasia,
      endereco:     endereco.nomeLogradouro,
      numero:       endereco.numeroImovel,
      bairro:       endereco.bairro,
      cep:          endereco.cep,
      latitude:     endereco.latitude,
      longitude:    endereco.longitude,
      telefone:     estabelecimento.telefone || null,
      ...(estabelecimento.bandeira && { bandeira: estabelecimento.bandeira }),
      municipioId:  municipio.id
    },
    create: {
      cnpj:         estabelecimento.cnpj,
      razaoSocial:  estabelecimento.razaoSocial,
      nomeFantasia: estabelecimento.nomeFantasia,
      endereco:     endereco.nomeLogradouro,
      numero:       endereco.numeroImovel,
      bairro:       endereco.bairro,
      cep:          endereco.cep,
      latitude:     endereco.latitude,
      longitude:    endereco.longitude,
      telefone:     estabelecimento.telefone || null,
      bandeira:     estabelecimento.bandeira || null,
      municipioId:  municipio.id
    }
  });

  // 3️⃣ Combustível — tipo vem como parâmetro pois a SEFAZ não o retorna no resultado
  const combustivel = await prisma.combustivel.upsert({
    where: { codigo: produto.codigo },
    update: {
      descricao: produto.descricao,
      unidade:   produto.unidadeMedida,
      ...(tipoCombustivel != null && { tipo: tipoCombustivel }),
    },
    create: {
      codigo:    produto.codigo,
      descricao: produto.descricao,
      unidade:   produto.unidadeMedida,
      tipo:      tipoCombustivel ?? null,
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