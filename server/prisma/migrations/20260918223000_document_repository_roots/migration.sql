-- DOCUMENT REPOSITORY ROOTS
-- One physical PostgreSQL database, logically separated by tenantId.
-- Platform documents/history are company-owned; BusinessDocumentState/ConsentEvent are tenant-owned.

BEGIN;

ALTER TABLE "BusinessDocumentState"
ADD COLUMN IF NOT EXISTS "consentMigratedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "LegalDocument" (
  "id" TEXT PRIMARY KEY,
  "scope" TEXT NOT NULL,
  "tenantId" TEXT,
  "key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "requiredForRegistration" BOOLEAN NOT NULL DEFAULT false,
  "requiredForLive" BOOLEAN NOT NULL DEFAULT false,
  "requiredForPublicBooking" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalDocument_scope_check" CHECK ("scope" IN ('PLATFORM', 'TENANT')),
  CONSTRAINT "LegalDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "LegalDocument_scope_tenant_key_key"
ON "LegalDocument"("scope", COALESCE("tenantId", ''), "key");
CREATE INDEX IF NOT EXISTS "LegalDocument_tenant_active_idx"
ON "LegalDocument"("tenantId", "isActive");

CREATE TABLE IF NOT EXISTS "LegalDocumentVersion" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "contentSnapshot" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "operatorIdentitySnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),
  CONSTRAINT "LegalDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalDocumentVersion_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "LegalDocumentVersion_documentId_version_key"
ON "LegalDocumentVersion"("documentId", "version");
CREATE INDEX IF NOT EXISTS "LegalDocumentVersion_document_current_idx"
ON "LegalDocumentVersion"("documentId", "supersededAt", "publishedAt");

CREATE TABLE IF NOT EXISTS "LegalAcceptanceEvent" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "userId" TEXT NOT NULL,
  "documentVersionId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT '',
  "technicalEvidence" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalAcceptanceEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LegalAcceptanceEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalAcceptanceEvent_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LegalAcceptanceEvent_action_check" CHECK ("action" IN ('ACCEPTED', 'ACKNOWLEDGED', 'CONSENTED', 'REVOKED', 'DECLINED'))
);

CREATE INDEX IF NOT EXISTS "LegalAcceptanceEvent_user_occurredAt_idx"
ON "LegalAcceptanceEvent"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "LegalAcceptanceEvent_documentVersion_idx"
ON "LegalAcceptanceEvent"("documentVersionId", "occurredAt");

CREATE TABLE IF NOT EXISTS "ConsentEvent" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "contactType" TEXT NOT NULL DEFAULT '',
  "contactValue" TEXT NOT NULL DEFAULT '',
  "documentId" TEXT NOT NULL,
  "documentVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT '',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "migratedFromEventId" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentEvent_subjectType_check" CHECK ("subjectType" IN ('BOOKING_ACCOUNT', 'CONTACT_POINT')),
  CONSTRAINT "ConsentEvent_status_check" CHECK ("status" IN ('accepted', 'revoked', 'declined')),
  CONSTRAINT "ConsentEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ConsentEvent_tenant_subject_document_time_idx"
ON "ConsentEvent"("tenantId", "subjectType", "subjectKey", "documentId", "occurredAt");
CREATE INDEX IF NOT EXISTS "ConsentEvent_tenant_contact_document_time_idx"
ON "ConsentEvent"("tenantId", "contactType", "contactValue", "documentId", "occurredAt");
CREATE INDEX IF NOT EXISTS "ConsentEvent_tenant_migrated_from_idx"
ON "ConsentEvent"("tenantId", "migratedFromEventId");

CREATE OR REPLACE FUNCTION "book_reject_document_event_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'LegalAcceptanceEvent_append_only') THEN
    CREATE TRIGGER "LegalAcceptanceEvent_append_only"
    BEFORE UPDATE OR DELETE ON "LegalAcceptanceEvent"
    FOR EACH ROW EXECUTE FUNCTION "book_reject_document_event_mutation"();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ConsentEvent_append_only') THEN
    CREATE TRIGGER "ConsentEvent_append_only"
    BEFORE UPDATE OR DELETE ON "ConsentEvent"
    FOR EACH ROW EXECUTE FUNCTION "book_reject_document_event_mutation"();
  END IF;
END $$;

COMMIT;
