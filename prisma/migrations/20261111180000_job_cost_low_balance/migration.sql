-- AlterTable
ALTER TABLE "user" ADD COLUMN "lowBalanceUsd" REAL;

-- AlterTable
ALTER TABLE "generation_job" ADD COLUMN "estimatedCostUsd" REAL;

-- AlterTable
ALTER TABLE "model_3d_asset" ADD COLUMN "estimatedCostUsd" REAL;

-- CreateIndex
CREATE INDEX "generation_job_createdAt_idx" ON "generation_job"("createdAt");
