BEGIN;

ALTER TABLE "LegalAcceptanceEvent" RENAME TO "PlatformConsentEvent";
ALTER TABLE "PlatformConsentEvent" RENAME CONSTRAINT "LegalAcceptanceEvent_pkey" TO "PlatformConsentEvent_pkey";
ALTER TABLE "PlatformConsentEvent" RENAME CONSTRAINT "LegalAcceptanceEvent_tenantId_fkey" TO "PlatformConsentEvent_tenantId_fkey";
ALTER TABLE "PlatformConsentEvent" RENAME CONSTRAINT "LegalAcceptanceEvent_userId_fkey" TO "PlatformConsentEvent_userId_fkey";
ALTER TABLE "PlatformConsentEvent" RENAME CONSTRAINT "LegalAcceptanceEvent_documentVersionId_fkey" TO "PlatformConsentEvent_documentVersionId_fkey";
ALTER TABLE "PlatformConsentEvent" RENAME CONSTRAINT "LegalAcceptanceEvent_action_check" TO "PlatformConsentEvent_action_check";
ALTER INDEX "LegalAcceptanceEvent_user_occurredAt_idx" RENAME TO "PlatformConsentEvent_user_occurredAt_idx";
ALTER INDEX "LegalAcceptanceEvent_documentVersion_idx" RENAME TO "PlatformConsentEvent_documentVersion_idx";
ALTER TRIGGER "LegalAcceptanceEvent_append_only" ON "PlatformConsentEvent" RENAME TO "PlatformConsentEvent_append_only";

ALTER TABLE "ConsentEvent" RENAME TO "TenantConsentEvent";
ALTER TABLE "TenantConsentEvent" RENAME CONSTRAINT "ConsentEvent_pkey" TO "TenantConsentEvent_pkey";
ALTER TABLE "TenantConsentEvent" RENAME CONSTRAINT "ConsentEvent_subjectType_check" TO "TenantConsentEvent_subjectType_check";
ALTER TABLE "TenantConsentEvent" RENAME CONSTRAINT "ConsentEvent_status_check" TO "TenantConsentEvent_status_check";
ALTER TABLE "TenantConsentEvent" RENAME CONSTRAINT "ConsentEvent_tenantId_fkey" TO "TenantConsentEvent_tenantId_fkey";
ALTER INDEX "ConsentEvent_tenant_subject_document_time_idx" RENAME TO "TenantConsentEvent_tenant_subject_document_time_idx";
ALTER INDEX "ConsentEvent_tenant_contact_document_time_idx" RENAME TO "TenantConsentEvent_tenant_contact_document_time_idx";

COMMIT;
