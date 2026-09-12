CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunicationTemplate_tenantId_updatedAt_idx"
    ON "CommunicationTemplate"("tenantId", "updatedAt");

CREATE UNIQUE INDEX "CommunicationTemplate_tenantId_name_key"
    ON "CommunicationTemplate"("tenantId", "name");

ALTER TABLE "CommunicationTemplate"
    ADD CONSTRAINT "CommunicationTemplate_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
