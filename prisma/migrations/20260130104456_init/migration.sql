-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'user',
    "stripeCustomerId" TEXT,
    "subscriptionStatus" TEXT,
    "subscriptionTier" TEXT,
    "subscriptionPeriodEnd" DATETIME,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "hasPlatformAccess" BOOLEAN NOT NULL DEFAULT false,
    "platformPurchaseDate" DATETIME,
    "platformStripePaymentId" TEXT,
    "falApiKey" TEXT,
    "falApiKeyLastFour" TEXT,
    "falApiKeyAddedAt" DATETIME,
    "preferredLlmModel" TEXT,
    "preferredImageModel" TEXT,
    "preferredVideoModel" TEXT,
    "preferredVoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "project_folder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT,
    "manifest" TEXT NOT NULL DEFAULT '{}',
    "width" INTEGER NOT NULL DEFAULT 1080,
    "height" INTEGER NOT NULL DEFAULT 1920,
    "fps" INTEGER NOT NULL DEFAULT 30,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "outputUrl" TEXT,
    "thumbnailUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "project_folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "prompt" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "metadata" TEXT,
    "durationSeconds" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "generation_job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT,
    "error" TEXT,
    "externalId" TEXT,
    "statusUrl" TEXT,
    "responseUrl" TEXT,
    "cancelUrl" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "generation_job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "generation_job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subscription_event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "fromTier" TEXT,
    "toTier" TEXT,
    "metadata" TEXT,
    "stripeEventId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" TEXT,
    "toolCallId" TEXT,
    "toolName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_message_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "model_3d_asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "prompt" TEXT,
    "sourceImageUrls" TEXT,
    "settings" TEXT,
    "modelGlbUrl" TEXT,
    "thumbnailUrl" TEXT,
    "modelUrls" TEXT,
    "textureUrls" TEXT,
    "worldFileUrl" TEXT,
    "gaussianSplatUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestId" TEXT,
    "statusUrl" TEXT,
    "responseUrl" TEXT,
    "cancelUrl" TEXT,
    "error" TEXT,
    "progress" INTEGER,
    "seed" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "model_3d_asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "project_folder_userId_idx" ON "project_folder"("userId");

-- CreateIndex
CREATE INDEX "project_userId_idx" ON "project"("userId");

-- CreateIndex
CREATE INDEX "project_folderId_idx" ON "project"("folderId");

-- CreateIndex
CREATE INDEX "project_status_idx" ON "project"("status");

-- CreateIndex
CREATE INDEX "asset_userId_idx" ON "asset"("userId");

-- CreateIndex
CREATE INDEX "asset_projectId_idx" ON "asset"("projectId");

-- CreateIndex
CREATE INDEX "asset_type_idx" ON "asset"("type");

-- CreateIndex
CREATE INDEX "generation_job_userId_idx" ON "generation_job"("userId");

-- CreateIndex
CREATE INDEX "generation_job_projectId_idx" ON "generation_job"("projectId");

-- CreateIndex
CREATE INDEX "generation_job_status_idx" ON "generation_job"("status");

-- CreateIndex
CREATE INDEX "generation_job_externalId_idx" ON "generation_job"("externalId");

-- CreateIndex
CREATE INDEX "subscription_event_userId_idx" ON "subscription_event"("userId");

-- CreateIndex
CREATE INDEX "subscription_event_event_idx" ON "subscription_event"("event");

-- CreateIndex
CREATE INDEX "subscription_event_createdAt_idx" ON "subscription_event"("createdAt");

-- CreateIndex
CREATE INDEX "chat_message_projectId_idx" ON "chat_message"("projectId");

-- CreateIndex
CREATE INDEX "chat_message_createdAt_idx" ON "chat_message"("createdAt");

-- CreateIndex
CREATE INDEX "model_3d_asset_userId_idx" ON "model_3d_asset"("userId");

-- CreateIndex
CREATE INDEX "model_3d_asset_status_idx" ON "model_3d_asset"("status");

-- CreateIndex
CREATE INDEX "model_3d_asset_createdAt_idx" ON "model_3d_asset"("createdAt");
