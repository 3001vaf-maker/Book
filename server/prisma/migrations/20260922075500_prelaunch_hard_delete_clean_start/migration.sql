BEGIN;

-- PRE-LAUNCH TEST MODE
-- All non-OWNER tenants are test data and must be fully removable.
-- OWNER Book remains protected in application code.

-- Retire legacy legal/audit tables that are no longer part of the current Book model.
DROP TABLE IF EXISTS "LegalStateEvent";
DROP TABLE IF EXISTS "LegalAuditEvent";
DROP TABLE IF EXISTS "TenantLegalState";
DROP TABLE IF EXISTS "PlatformLegalState";
DROP TABLE IF EXISTS "DataSubjectRequest";
DROP TABLE IF EXISTS "RetentionPolicy";

-- Test-stage histories must disappear with the test subject.
-- Remove append-only guards for the two current platform event stores.
DROP TRIGGER IF EXISTS "PlatformConsentEvent_append_only" ON "PlatformConsentEvent";
DROP TRIGGER IF EXISTS "PlatformActivityEvent_append_only" ON "PlatformActivityEvent";

-- PlatformConsentEvent had been detached from subjects in a previous cleanup.
-- Reattach it for PRE-LAUNCH test cleanup so deleting a test Tenant/Account removes its test history.
ALTER TABLE IF EXISTS "PlatformConsentEvent"
  DROP CONSTRAINT IF EXISTS "PlatformConsentEvent_tenantId_fkey";
ALTER TABLE IF EXISTS "PlatformConsentEvent"
  DROP CONSTRAINT IF EXISTS "PlatformConsentEvent_platformAccountId_fkey";

ALTER TABLE IF EXISTS "PlatformConsentEvent"
  ADD CONSTRAINT "PlatformConsentEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE IF EXISTS "PlatformConsentEvent"
  ADD CONSTRAINT "PlatformConsentEvent_platformAccountId_fkey"
  FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
