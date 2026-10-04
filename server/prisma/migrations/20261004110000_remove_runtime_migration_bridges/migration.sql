
-- Backfill canonical Record events and Finance settlements before removing embedded projections.

INSERT INTO "FinanceSettlement" (
  "id","tenantId","sourceType","sourceId","data","createdAt","updatedAt"
)
SELECT
  'record-settlement-backfill-' || r."id",
  r."tenantId",
  'record',
  r."recordId",
  r."data"->'finance',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "BusinessRecord" r
WHERE jsonb_typeof(r."data"->'finance') = 'object'
  AND jsonb_typeof(r."data"->'finance'->'items') = 'array'
  AND NOT EXISTS (
    SELECT 1
    FROM "FinanceSettlement" s
    WHERE s."tenantId" = r."tenantId"
      AND s."sourceType" = 'record'
      AND s."sourceId" = r."recordId"
  );

INSERT INTO "BusinessRecordEvent" (
  "id","tenantId","eventId","recordId","position","data","createdAt","updatedAt"
)
SELECT
  'record-event-created-backfill-' || r."id",
  r."tenantId",
  'record-event-created-backfill-' || r."id",
  r."recordId",
  0,
  jsonb_build_object(
    'id', 'record-event-created-backfill-' || r."id",
    'recordId', r."recordId",
    'type', 'created',
    'category', 'action',
    'at', COALESCE(
      NULLIF(r."data"->>'createdAt',''),
      to_char(r."createdAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'source', COALESCE(r."data"->>'source',''),
    'actor', '{}'::jsonb,
    'subject', '{}'::jsonb,
    'payload', '{}'::jsonb
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "BusinessRecord" r
WHERE NOT EXISTS (
  SELECT 1 FROM "BusinessRecordEvent" e
  WHERE e."tenantId" = r."tenantId"
    AND e."recordId" = r."recordId"
    AND e."data"->>'type' = 'created'
);

INSERT INTO "BusinessRecordEvent" (
  "id","tenantId","eventId","recordId","position","data","createdAt","updatedAt"
)
SELECT
  'record-event-confirmed-backfill-' || r."id",
  r."tenantId",
  'record-event-confirmed-backfill-' || r."id",
  r."recordId",
  1,
  jsonb_build_object(
    'id', 'record-event-confirmed-backfill-' || r."id",
    'recordId', r."recordId",
    'type', 'confirmed',
    'category', 'status',
    'at', COALESCE(
      NULLIF(r."data"->>'confirmedAt',''),
      NULLIF(r."data"->>'updatedAt',''),
      NULLIF(r."data"->>'createdAt',''),
      to_char(r."updatedAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'source', COALESCE(r."data"->>'source',''),
    'actor', '{}'::jsonb,
    'subject', '{}'::jsonb,
    'payload', '{}'::jsonb
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "BusinessRecord" r
WHERE COALESCE((r."data"->>'confirmed')::boolean, false) = true
  AND NOT EXISTS (
    SELECT 1 FROM "BusinessRecordEvent" e
    WHERE e."tenantId" = r."tenantId"
      AND e."recordId" = r."recordId"
      AND e."data"->>'type' = 'confirmed'
  );

INSERT INTO "BusinessRecordEvent" (
  "id","tenantId","eventId","recordId","position","data","createdAt","updatedAt"
)
SELECT
  'record-event-attendance-backfill-' || r."id",
  r."tenantId",
  'record-event-attendance-backfill-' || r."id",
  r."recordId",
  2,
  jsonb_build_object(
    'id', 'record-event-attendance-backfill-' || r."id",
    'recordId', r."recordId",
    'type', r."data"->>'attendance',
    'category', 'attendance',
    'at', COALESCE(
      NULLIF(r."data"->>'attendanceAt',''),
      NULLIF(r."data"->>'updatedAt',''),
      NULLIF(r."data"->>'createdAt',''),
      to_char(r."updatedAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'source', COALESCE(r."data"->>'source',''),
    'actor', '{}'::jsonb,
    'subject', '{}'::jsonb,
    'payload', '{}'::jsonb
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "BusinessRecord" r
WHERE r."data"->>'attendance' IN ('arrived','no-show')
  AND NOT EXISTS (
    SELECT 1 FROM "BusinessRecordEvent" e
    WHERE e."tenantId" = r."tenantId"
      AND e."recordId" = r."recordId"
      AND e."data"->>'type' = r."data"->>'attendance'
  );

INSERT INTO "BusinessRecordEvent" (
  "id","tenantId","eventId","recordId","position","data","createdAt","updatedAt"
)
SELECT
  'record-event-cancelled-backfill-' || r."id",
  r."tenantId",
  'record-event-cancelled-backfill-' || r."id",
  r."recordId",
  3,
  jsonb_build_object(
    'id', 'record-event-cancelled-backfill-' || r."id",
    'recordId', r."recordId",
    'type', 'cancelled',
    'category', 'action',
    'at', COALESCE(
      NULLIF(r."data"->>'cancelledAt',''),
      NULLIF(r."data"->>'updatedAt',''),
      NULLIF(r."data"->>'createdAt',''),
      to_char(r."updatedAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ),
    'source', COALESCE(r."data"->>'source',''),
    'actor', '{}'::jsonb,
    'subject', '{}'::jsonb,
    'payload', '{}'::jsonb
  ),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "BusinessRecord" r
WHERE r."data"->>'status' = 'cancelled'
  AND NOT EXISTS (
    SELECT 1 FROM "BusinessRecordEvent" e
    WHERE e."tenantId" = r."tenantId"
      AND e."recordId" = r."recordId"
      AND e."data"->>'type' = 'cancelled'
  );

UPDATE "BusinessRecord"
SET "data" = "data" - ARRAY[
  'status','confirmed','attendance','confirmedAt','attendanceAt','cancelledAt',
  'lifecycleUpdatedAt','finance','payment'
]::text[]
WHERE "data" ?| ARRAY[
  'status','confirmed','attendance','confirmedAt','attendanceAt','cancelledAt',
  'lifecycleUpdatedAt','finance','payment'
]::text[];

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
DROP TABLE IF EXISTS "BusinessStateMeta";
ALTER TABLE "BusinessOperationalState" DROP COLUMN IF EXISTS "migrationVerifiedAt";
ALTER TABLE "TenantDocumentArchive" DROP COLUMN IF EXISTS "migrationVerifiedAt";
ALTER TABLE "BusinessAuxiliaryState" DROP COLUMN IF EXISTS "migrationVerifiedAt";
