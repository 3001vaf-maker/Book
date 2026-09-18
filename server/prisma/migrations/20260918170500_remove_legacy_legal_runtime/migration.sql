BEGIN;

DROP TRIGGER IF EXISTS "LegalStateEvent_normalize_actor" ON "LegalStateEvent";
DROP TRIGGER IF EXISTS "LegalAuditEvent_normalize_actor" ON "LegalAuditEvent";
DROP TRIGGER IF EXISTS "LegalStateEvent_append_only" ON "LegalStateEvent";
DROP TRIGGER IF EXISTS "LegalAuditEvent_append_only" ON "LegalAuditEvent";

DROP TABLE IF EXISTS "LegalStateEvent";
DROP TABLE IF EXISTS "LegalAuditEvent";
DROP TABLE IF EXISTS "TenantLegalState";
DROP TABLE IF EXISTS "PlatformLegalState";

DROP FUNCTION IF EXISTS "book_normalize_legal_actor_user"();

COMMIT;
