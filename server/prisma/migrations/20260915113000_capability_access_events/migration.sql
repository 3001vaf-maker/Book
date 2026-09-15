CREATE TYPE "CapabilityAccessChangeType" AS ENUM ('ENABLED', 'DISABLED');

CREATE TABLE "CapabilityAccessEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "changeType" "CapabilityAccessChangeType" NOT NULL,
    "summaryAcknowledgedAt" TIMESTAMP(3),
    "detailAcknowledgedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapabilityAccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CapabilityAccessEvent_tenantId_createdAt_idx" ON "CapabilityAccessEvent"("tenantId", "createdAt");
CREATE INDEX "CapabilityAccessEvent_tenantId_summaryAcknowledgedAt_idx" ON "CapabilityAccessEvent"("tenantId", "summaryAcknowledgedAt");
CREATE INDEX "CapabilityAccessEvent_tenantId_capabilityId_detailAcknowledgedAt_idx" ON "CapabilityAccessEvent"("tenantId", "capabilityId", "detailAcknowledgedAt");
CREATE INDEX "CapabilityAccessEvent_batchId_idx" ON "CapabilityAccessEvent"("batchId");

ALTER TABLE "CapabilityAccessEvent"
ADD CONSTRAINT "CapabilityAccessEvent_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "TenantAccess"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CapabilityAccessEvent"
ADD CONSTRAINT "CapabilityAccessEvent_capabilityId_fkey"
FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
