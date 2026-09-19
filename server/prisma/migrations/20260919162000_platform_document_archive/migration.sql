BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "LegalDocument"
    WHERE "scope" <> 'PLATFORM' OR "tenantId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Legacy LegalDocument contains tenant-owned rows; refusing duplicate tenant document archive';
  END IF;
END
$$;

ALTER TABLE "LegalDocument" RENAME TO "PlatformDocument";
ALTER TABLE "PlatformDocument" RENAME CONSTRAINT "LegalDocument_pkey" TO "PlatformDocument_pkey";
ALTER TABLE "PlatformDocument" RENAME CONSTRAINT "LegalDocument_scope_check" TO "PlatformDocument_scope_check";
ALTER TABLE "PlatformDocument" RENAME CONSTRAINT "LegalDocument_tenantId_fkey" TO "PlatformDocument_tenantId_fkey";

ALTER TABLE "LegalDocumentVersion" RENAME TO "PlatformDocumentVersion";
ALTER TABLE "PlatformDocumentVersion" RENAME CONSTRAINT "LegalDocumentVersion_pkey" TO "PlatformDocumentVersion_pkey";
ALTER TABLE "PlatformDocumentVersion" RENAME CONSTRAINT "LegalDocumentVersion_documentId_fkey" TO "PlatformDocumentVersion_documentId_fkey";
ALTER TABLE "PlatformDocumentVersion" RENAME CONSTRAINT "LegalDocumentVersion_version_check" TO "PlatformDocumentVersion_version_check";
ALTER INDEX "LegalDocumentVersion_documentId_version_key" RENAME TO "PlatformDocumentVersion_documentId_version_key";
ALTER INDEX "LegalDocumentVersion_document_current_idx" RENAME TO "PlatformDocumentVersion_document_current_idx";

DROP INDEX "LegalDocument_scope_tenant_key_key";
DROP INDEX "LegalDocument_tenant_active_idx";
ALTER TABLE "PlatformDocument" DROP CONSTRAINT "PlatformDocument_scope_check";
ALTER TABLE "PlatformDocument" DROP CONSTRAINT "PlatformDocument_tenantId_fkey";
ALTER TABLE "PlatformDocument" DROP COLUMN "scope";
ALTER TABLE "PlatformDocument" DROP COLUMN "tenantId";

CREATE UNIQUE INDEX "PlatformDocument_key_key" ON "PlatformDocument"("key");
CREATE INDEX "PlatformDocument_active_idx" ON "PlatformDocument"("isActive");

COMMIT;
