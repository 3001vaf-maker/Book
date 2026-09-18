BEGIN;

DO $$
DECLARE
  legacy_id TEXT;
  canonical_id TEXT;
BEGIN
  SELECT "id" INTO legacy_id
  FROM "LegalDocument"
  WHERE "scope" = 'PLATFORM'
    AND "tenantId" IS NULL
    AND "key" = 'user-pd-consent'
  LIMIT 1;

  SELECT "id" INTO canonical_id
  FROM "LegalDocument"
  WHERE "scope" = 'PLATFORM'
    AND "tenantId" IS NULL
    AND "key" = 'user-document-pdn-consent'
  LIMIT 1;

  IF legacy_id IS NOT NULL AND canonical_id IS NULL THEN
    UPDATE "LegalDocument"
    SET "key" = 'user-document-pdn-consent',
        "title" = 'Согласие на обработку персональных данных',
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = legacy_id;
  ELSIF legacy_id IS NOT NULL AND canonical_id IS NOT NULL THEN
    UPDATE "LegalDocument"
    SET "isActive" = false,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = legacy_id;
  END IF;
END $$;

COMMIT;
