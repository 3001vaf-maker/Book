CREATE TABLE "NotificationRoutingPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'always',
    "channels" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRoutingPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationRoutingPolicy_tenantId_eventType_key"
    ON "NotificationRoutingPolicy"("tenantId", "eventType");

CREATE INDEX "NotificationRoutingPolicy_tenantId_idx"
    ON "NotificationRoutingPolicy"("tenantId");

ALTER TABLE "NotificationRoutingPolicy"
    ADD CONSTRAINT "NotificationRoutingPolicy_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
