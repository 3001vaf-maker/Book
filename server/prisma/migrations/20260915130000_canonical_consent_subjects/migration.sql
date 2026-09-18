ALTER TABLE "BusinessDocumentState"
ADD COLUMN "consentMigratedAt" TIMESTAMP(3);

CREATE TABLE "ConsentEvent" (
  "id" TEXT NOT NULL,
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

  CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConsentEvent_subjectType_check" CHECK ("subjectType" IN ('BOOKING_ACCOUNT', 'CONTACT_POINT')),
  CONSTRAINT "ConsentEvent_status_check" CHECK ("status" IN ('accepted', 'revoked', 'declined')),
  CONSTRAINT "ConsentEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ConsentEvent_tenant_subject_document_time_idx"
ON "ConsentEvent"("tenantId", "subjectType", "subjectKey", "documentId", "occurredAt");

CREATE INDEX "ConsentEvent_tenant_contact_document_time_idx"
ON "ConsentEvent"("tenantId", "contactType", "contactValue", "documentId", "occurredAt");

CREATE INDEX "ConsentEvent_tenant_migrated_from_idx"
ON "ConsentEvent"("tenantId", "migratedFromEventId");
