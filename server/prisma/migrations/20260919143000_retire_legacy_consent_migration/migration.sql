UPDATE "BusinessDocumentState"
SET "data" = "data" - 'consents'
WHERE "data" ? 'consents';

DROP INDEX IF EXISTS "ConsentEvent_tenant_migrated_from_idx";

ALTER TABLE "ConsentEvent"
DROP COLUMN IF EXISTS "migratedFromEventId";

ALTER TABLE "BusinessDocumentState"
DROP COLUMN IF EXISTS "consentMigratedAt";
