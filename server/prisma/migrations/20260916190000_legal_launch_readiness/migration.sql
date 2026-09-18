-- LEGAL LAUNCH READINESS
-- Additive, fail-closed server state for the official Book launch.
-- This migration does not clean production data and does not alter historical migrations.

BEGIN;

CREATE TABLE "PlatformLegalState" (
  "id" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'PRE_LAUNCH',
  "filingStatus" TEXT NOT NULL DEFAULT 'NOT_PREPARED',
  "checklist" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "submittedAt" TIMESTAMP(3),
  "submissionReference" TEXT NOT NULL DEFAULT '',
  "evidenceMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "legalReadyAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformLegalState_status_check" CHECK ("status" IN ('PRE_LAUNCH', 'LEGAL_READY')),
  CONSTRAINT "PlatformLegalState_filing_check" CHECK ("filingStatus" IN ('NOT_PREPARED', 'PREPARED', 'SUBMITTED'))
);

INSERT INTO "PlatformLegalState" ("id", "status", "filingStatus")
VALUES ('platform', 'PRE_LAUNCH', 'NOT_PREPARED')
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "TenantLegalState" (
  "tenantId" TEXT PRIMARY KEY,
  "operationMode" TEXT NOT NULL DEFAULT 'DEMO',
  "filingStatus" TEXT NOT NULL DEFAULT 'NOT_PREPARED',
  "checklist" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "preparedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "submissionReference" TEXT NOT NULL DEFAULT '',
  "evidenceMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "liveAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantLegalState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TenantLegalState_mode_check" CHECK ("operationMode" IN ('DEMO', 'LIVE')),
  CONSTRAINT "TenantLegalState_filing_check" CHECK ("filingStatus" IN ('NOT_PREPARED', 'PREPARED', 'SUBMITTED'))
);

-- Existing production tenants are explicitly initialized to the safe non-live state.
-- No tenant becomes LIVE automatically.
INSERT INTO "TenantLegalState" ("tenantId", "operationMode", "filingStatus")
SELECT "id", 'DEMO', 'NOT_PREPARED' FROM "Tenant"
ON CONFLICT ("tenantId") DO NOTHING;

CREATE TABLE "LegalStateEvent" (
  "id" TEXT PRIMARY KEY,
  "scope" TEXT NOT NULL,
  "tenantId" TEXT,
  "actorUserId" TEXT,
  "changeType" TEXT NOT NULL,
  "oldState" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "newState" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "reason" TEXT NOT NULL DEFAULT '',
  "submissionReference" TEXT NOT NULL DEFAULT '',
  "evidenceMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalStateEvent_scope_check" CHECK ("scope" IN ('PLATFORM', 'TENANT')),
  CONSTRAINT "LegalStateEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LegalStateEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "LegalStateEvent_scope_occurredAt_idx" ON "LegalStateEvent"("scope", "occurredAt");
CREATE INDEX "LegalStateEvent_tenantId_occurredAt_idx" ON "LegalStateEvent"("tenantId", "occurredAt");

CREATE TABLE "LegalDocument" (
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
CREATE UNIQUE INDEX "LegalDocument_scope_tenant_key_key" ON "LegalDocument"("scope", COALESCE("tenantId", ''), "key");
CREATE INDEX "LegalDocument_tenant_active_idx" ON "LegalDocument"("tenantId", "isActive");

CREATE TABLE "LegalDocumentVersion" (
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
CREATE UNIQUE INDEX "LegalDocumentVersion_documentId_version_key" ON "LegalDocumentVersion"("documentId", "version");
CREATE INDEX "LegalDocumentVersion_document_current_idx" ON "LegalDocumentVersion"("documentId", "supersededAt", "publishedAt");

CREATE TABLE "LegalAcceptanceEvent" (
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
CREATE INDEX "LegalAcceptanceEvent_user_occurredAt_idx" ON "LegalAcceptanceEvent"("userId", "occurredAt");
CREATE INDEX "LegalAcceptanceEvent_documentVersion_idx" ON "LegalAcceptanceEvent"("documentVersionId", "occurredAt");

CREATE TABLE "LegalAuditEvent" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT '',
  "result" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalAuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "LegalAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "LegalAuditEvent_tenant_occurredAt_idx" ON "LegalAuditEvent"("tenantId", "occurredAt");
CREATE INDEX "LegalAuditEvent_action_occurredAt_idx" ON "LegalAuditEvent"("action", "occurredAt");

CREATE TABLE "DataSubjectRequest" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "requestType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "result" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "DataSubjectRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DataSubjectRequest_type_check" CHECK ("requestType" IN ('EXPORT', 'CORRECTION', 'WITHDRAW_CONSENT', 'DELETE_OR_BLOCK', 'STOP_MARKETING')),
  CONSTRAINT "DataSubjectRequest_status_check" CHECK ("status" IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'))
);
CREATE INDEX "DataSubjectRequest_tenant_status_idx" ON "DataSubjectRequest"("tenantId", "status", "createdAt");

CREATE TABLE "RetentionPolicy" (
  "id" TEXT PRIMARY KEY,
  "scope" TEXT NOT NULL,
  "tenantId" TEXT,
  "dataType" TEXT NOT NULL,
  "legalBasis" TEXT NOT NULL,
  "policy" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetentionPolicy_scope_check" CHECK ("scope" IN ('PLATFORM', 'TENANT')),
  CONSTRAINT "RetentionPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RetentionPolicy_scope_tenant_data_basis_key" ON "RetentionPolicy"("scope", COALESCE("tenantId", ''), "dataType", "legalBasis");

-- Enforce append-only semantics for the new evidence/event stores at the database layer.
CREATE OR REPLACE FUNCTION "book_reject_append_only_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LegalStateEvent_append_only"
BEFORE UPDATE OR DELETE ON "LegalStateEvent"
FOR EACH ROW EXECUTE FUNCTION "book_reject_append_only_mutation"();

CREATE TRIGGER "LegalAcceptanceEvent_append_only"
BEFORE UPDATE OR DELETE ON "LegalAcceptanceEvent"
FOR EACH ROW EXECUTE FUNCTION "book_reject_append_only_mutation"();

CREATE TRIGGER "LegalAuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "LegalAuditEvent"
FOR EACH ROW EXECUTE FUNCTION "book_reject_append_only_mutation"();

COMMIT;
