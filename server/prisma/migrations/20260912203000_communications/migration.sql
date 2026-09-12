CREATE TABLE "CommunicationIdentity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardPhone" TEXT NOT NULL,
    "uei" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "display" TEXT NOT NULL DEFAULT '',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardPhone" TEXT NOT NULL,
    "uei" TEXT NOT NULL DEFAULT '',
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'message',
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "externalMessageId" TEXT NOT NULL DEFAULT '',
    "externalThreadId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CommunicationMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationIdentity_tenantId_channel_externalUserId_key"
    ON "CommunicationIdentity"("tenantId", "channel", "externalUserId");

CREATE INDEX "CommunicationIdentity_tenantId_uei_channel_idx"
    ON "CommunicationIdentity"("tenantId", "uei", "channel");

CREATE INDEX "CommunicationIdentity_tenantId_cardPhone_channel_idx"
    ON "CommunicationIdentity"("tenantId", "cardPhone", "channel");

CREATE INDEX "CommunicationMessage_tenantId_uei_createdAt_idx"
    ON "CommunicationMessage"("tenantId", "uei", "createdAt");

CREATE INDEX "CommunicationMessage_tenantId_cardPhone_createdAt_idx"
    ON "CommunicationMessage"("tenantId", "cardPhone", "createdAt");

CREATE INDEX "CommunicationMessage_tenantId_channel_status_createdAt_idx"
    ON "CommunicationMessage"("tenantId", "channel", "status", "createdAt");

CREATE UNIQUE INDEX "CommunicationMessage_external_message_key"
    ON "CommunicationMessage"("tenantId", "channel", "externalMessageId")
    WHERE "externalMessageId" <> '';

ALTER TABLE "CommunicationIdentity"
    ADD CONSTRAINT "CommunicationIdentity_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunicationMessage"
    ADD CONSTRAINT "CommunicationMessage_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
