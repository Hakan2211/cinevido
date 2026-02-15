-- AlterTable
ALTER TABLE "user" ADD COLUMN "bunnyApiKey" TEXT;
ALTER TABLE "user" ADD COLUMN "bunnyApiKeyLastFour" TEXT;
ALTER TABLE "user" ADD COLUMN "bunnyCdnUrl" TEXT;
ALTER TABLE "user" ADD COLUMN "bunnyStorageAddedAt" DATETIME;
ALTER TABLE "user" ADD COLUMN "bunnyStorageZone" TEXT;
