-- CreateTable
CREATE TABLE "Municipio" (
    "id" SERIAL NOT NULL,
    "codigoIBGE" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Municipio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posto" (
    "id" SERIAL NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "endereco" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "cep" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "telefone" TEXT,
    "bandeira" TEXT,
    "municipioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Posto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Combustivel" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "unidade" TEXT,
    "tipo" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Combustivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preco" (
    "id" SERIAL NOT NULL,
    "valorDeclarado" DOUBLE PRECISION,
    "valorVenda" DOUBLE PRECISION NOT NULL,
    "dataVenda" DATE NOT NULL,
    "postoId" INTEGER NOT NULL,
    "combustivelId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Municipio_codigoIBGE_key" ON "Municipio"("codigoIBGE");

-- CreateIndex
CREATE UNIQUE INDEX "Posto_cnpj_key" ON "Posto"("cnpj");

-- CreateIndex
CREATE INDEX "Posto_municipioId_idx" ON "Posto"("municipioId");

-- CreateIndex
CREATE INDEX "Posto_bairro_idx" ON "Posto"("bairro");

-- CreateIndex
CREATE UNIQUE INDEX "Combustivel_codigo_key" ON "Combustivel"("codigo");

-- CreateIndex
CREATE INDEX "Preco_dataVenda_idx" ON "Preco"("dataVenda");

-- CreateIndex
CREATE INDEX "Preco_postoId_combustivelId_idx" ON "Preco"("postoId", "combustivelId");

-- CreateIndex
CREATE INDEX "Preco_combustivelId_dataVenda_idx" ON "Preco"("combustivelId", "dataVenda");

-- CreateIndex
CREATE UNIQUE INDEX "Preco_postoId_combustivelId_dataVenda_key" ON "Preco"("postoId", "combustivelId", "dataVenda");

-- AddForeignKey
ALTER TABLE "Posto" ADD CONSTRAINT "Posto_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preco" ADD CONSTRAINT "Preco_postoId_fkey" FOREIGN KEY ("postoId") REFERENCES "Posto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preco" ADD CONSTRAINT "Preco_combustivelId_fkey" FOREIGN KEY ("combustivelId") REFERENCES "Combustivel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
