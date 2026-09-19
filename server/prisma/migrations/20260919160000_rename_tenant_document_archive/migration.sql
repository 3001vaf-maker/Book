BEGIN;

ALTER TABLE "BusinessDocumentState" RENAME TO "TenantDocumentArchive";

ALTER TABLE "TenantDocumentArchive"
  RENAME CONSTRAINT "BusinessDocumentState_pkey" TO "TenantDocumentArchive_pkey";

ALTER INDEX "BusinessDocumentState_tenantId_key"
  RENAME TO "TenantDocumentArchive_tenantId_key";

ALTER TABLE "TenantDocumentArchive"
  RENAME CONSTRAINT "BusinessDocumentState_tenantId_fkey" TO "TenantDocumentArchive_tenantId_fkey";

COMMIT;
