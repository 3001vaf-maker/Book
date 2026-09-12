CREATE TABLE "TelegramEntryTicket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "TelegramEntryTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramEntryTicket_tokenHash_key"
    ON "TelegramEntryTicket"("tokenHash");

CREATE INDEX "TelegramEntryTicket_tenantId_telegramUserId_idx"
    ON "TelegramEntryTicket"("tenantId", "telegramUserId");

ALTER TABLE "TelegramEntryTicket"
    ADD CONSTRAINT "TelegramEntryTicket_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
