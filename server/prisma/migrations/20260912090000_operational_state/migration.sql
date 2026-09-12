CREATE TABLE "BusinessOperationalState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "migrationVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessOperationalState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessOperationalState_tenantId_key" ON "BusinessOperationalState"("tenantId");

ALTER TABLE "BusinessOperationalState" ADD CONSTRAINT "BusinessOperationalState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
