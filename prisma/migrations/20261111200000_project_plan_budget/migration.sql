-- AlterTable
ALTER TABLE "project" ADD COLUMN "plan" TEXT;
ALTER TABLE "project" ADD COLUMN "budgetUsd" REAL NOT NULL DEFAULT 10;
