CREATE TABLE "BusinessAuxiliaryState" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "migrationVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessAuxiliaryState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessAuxiliaryState_tenantId_key" ON "BusinessAuxiliaryState"("tenantId");
ALTER TABLE "BusinessAuxiliaryState" ADD CONSTRAINT "BusinessAuxiliaryState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
