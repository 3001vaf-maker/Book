CREATE TABLE "TelegramBotConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "botUsername" TEXT NOT NULL DEFAULT '',
    "encryptedToken" TEXT NOT NULL,
    "tokenIv" TEXT NOT NULL,
    "tokenTag" TEXT NOT NULL,
    "webhookKey" TEXT NOT NULL,
    "webhookSecretHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramBotConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramBotConnection_tenantId_key"
    ON "TelegramBotConnection"("tenantId");

CREATE UNIQUE INDEX "TelegramBotConnection_botId_key"
    ON "TelegramBotConnection"("botId");

CREATE UNIQUE INDEX "TelegramBotConnection_webhookKey_key"
    ON "TelegramBotConnection"("webhookKey");

ALTER TABLE "TelegramBotConnection"
    ADD CONSTRAINT "TelegramBotConnection_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
