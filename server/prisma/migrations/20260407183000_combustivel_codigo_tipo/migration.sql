-- AlterTable
DROP INDEX IF EXISTS "Combustivel_codigo_key";

-- CreateIndex
CREATE UNIQUE INDEX "Combustivel_codigo_tipo_key" ON "Combustivel"("codigo", "tipo");