BEGIN;

-- Immutable legal/audit events keep historical subject identifiers as plain text.
-- They must not be rewritten or deleted when the referenced tenant/account is removed.
ALTER TABLE IF EXISTS "PlatformConsentEvent"
  DROP CONSTRAINT IF EXISTS "PlatformConsentEvent_tenantId_fkey";
ALTER TABLE IF EXISTS "PlatformConsentEvent"
  DROP CONSTRAINT IF EXISTS "PlatformConsentEvent_platformAccountId_fkey";

ALTER TABLE IF EXISTS "LegalStateEvent"
  DROP CONSTRAINT IF EXISTS "LegalStateEvent_tenantId_fkey";
ALTER TABLE IF EXISTS "LegalStateEvent"
  DROP CONSTRAINT IF EXISTS "LegalStateEvent_actorUserId_fkey";

ALTER TABLE IF EXISTS "LegalAuditEvent"
  DROP CONSTRAINT IF EXISTS "LegalAuditEvent_tenantId_fkey";
ALTER TABLE IF EXISTS "LegalAuditEvent"
  DROP CONSTRAINT IF EXISTS "LegalAuditEvent_actorUserId_fkey";

-- Remove the temporary hard-delete bypass from the append-only trigger.
CREATE OR REPLACE FUNCTION "book_reject_document_registry_event_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

COMMIT;
