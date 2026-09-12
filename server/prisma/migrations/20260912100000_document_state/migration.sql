CREATE TABLE "BusinessDocumentState" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "migrationVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessDocumentState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessDocumentState_tenantId_key" ON "BusinessDocumentState"("tenantId");
ALTER TABLE "BusinessDocumentState" ADD CONSTRAINT "BusinessDocumentState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
