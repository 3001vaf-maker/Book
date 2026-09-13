CREATE TABLE "CommunicationPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardPhone" TEXT NOT NULL,
    "uei" TEXT NOT NULL DEFAULT '',
    "preferredChannels" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationPreference_tenantId_cardPhone_key"
    ON "CommunicationPreference"("tenantId", "cardPhone");

CREATE INDEX "CommunicationPreference_tenantId_uei_idx"
    ON "CommunicationPreference"("tenantId", "uei");

ALTER TABLE "CommunicationPreference"
    ADD CONSTRAINT "CommunicationPreference_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommunicationBroadcastRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "requestedCount" INTEGER NOT NULL DEFAULT 0,
    "eligibleCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CommunicationBroadcastRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunicationBroadcastRun_tenantId_createdAt_idx"
    ON "CommunicationBroadcastRun"("tenantId", "createdAt");

ALTER TABLE "CommunicationBroadcastRun"
    ADD CONSTRAINT "CommunicationBroadcastRun_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
