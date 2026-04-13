-- CreateTable
CREATE TABLE "IndicadorBCB" (
    "id" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "valorAtualSerie" DOUBLE PRECISION NOT NULL,
    "valorBaseSerie" DOUBLE PRECISION NOT NULL,
    "dataReferencia" DATE NOT NULL,
    "validadeAte" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicadorBCB_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IndicadorBCB_codigo_key" ON "IndicadorBCB"("codigo");

-- CreateIndex
CREATE INDEX "IndicadorBCB_validadeAte_idx" ON "IndicadorBCB"("validadeAte");