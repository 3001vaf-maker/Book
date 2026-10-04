-- Remove retired pre-registry RKN helper documents once, before deleting transition flags.
UPDATE "TenantDocumentArchive"
SET "data" = jsonb_set(
  COALESCE("data"::jsonb, '{}'::jsonb),
  '{documents}',
  COALESCE((
    SELECT jsonb_agg(document)
    FROM jsonb_array_elements(COALESCE(("data"::jsonb)->'documents', '[]'::jsonb)) AS document
    WHERE COALESCE(document->'attachment'->>'legacyFormat', '') <> 'PRE_REGISTRY_TEMPLATE'
  ), '[]'::jsonb),
  true
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(("data"::jsonb)->'documents', '[]'::jsonb)) AS document
  WHERE document->'attachment'->>'legacyFormat' = 'PRE_REGISTRY_TEMPLATE'
);

ALTER TABLE "Profile" DROP COLUMN IF EXISTS "migrationVerifiedAt";
ALTER TABLE "BusinessStateMeta" DROP COLUMN IF EXISTS "migrationVerifiedAt";
ALTER TABLE "BusinessOperationalState" DROP COLUMN IF EXISTS "migrationVerifiedAt";
ALTER TABLE "TenantDocumentArchive" DROP COLUMN IF EXISTS "migrationVerifiedAt";
ALTER TABLE "BusinessAuxiliaryState" DROP COLUMN IF EXISTS "migrationVerifiedAt";
