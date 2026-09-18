BEGIN;

ALTER TABLE "LegalDocument"
  DROP COLUMN IF EXISTS "requiredForRegistration",
  DROP COLUMN IF EXISTS "requiredForLive",
  DROP COLUMN IF EXISTS "requiredForPublicBooking";

UPDATE "LegalDocument"
SET "key" = 'user-pd-consent',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "scope" = 'PLATFORM'
  AND "tenantId" IS NULL
  AND "key" = 'master-pd-consent';

COMMIT;
