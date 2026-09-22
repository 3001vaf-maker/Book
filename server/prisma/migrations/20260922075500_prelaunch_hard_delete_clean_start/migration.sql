BEGIN;

-- RECOVERY OF THE FAILED PRE-LAUNCH MIGRATION.
-- Keep permanent legal/audit protections intact.
-- The only permanent schema fixes here are:
--   1) explicit proof that LIVE was requested by the user and approved by an administrator;
--   2) missing WorkspaceState foreign keys;
--   3) a transaction-local hard-delete gate for pre-launch test cleanup.
-- No append-only trigger is removed and no legal/system table is dropped.

ALTER TABLE "TenantAccess"
  ADD COLUMN IF NOT EXISTS "liveRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "liveRequestedByPlatformAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "liveApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "liveApprovedByAdminId" TEXT;

-- New workspaces start in DEMO. OWNER Book is assigned LIVE explicitly by the
-- owner seed; no ordinary profile can become LIVE merely because a row was created.
ALTER TABLE "TenantAccess"
  ALTER COLUMN "commercialMode" SET DEFAULT 'DEMO';

-- Older manual admin transitions already have an audit event even though the
-- explicit approval columns did not exist yet. Backfill only from that event.
WITH legacy_admin_live AS (
  SELECT
    "tenantId",
    max("occurredAt") AS "approvedAt"
  FROM "PlatformActivityEvent"
  WHERE "eventType" = 'COMMERCIAL_MODE_CHANGED'
    AND "metadata"->>'commercialMode' = 'LIVE'
  GROUP BY "tenantId"
)
UPDATE "TenantAccess" access
SET "liveApprovedAt" = legacy."approvedAt"
FROM legacy_admin_live legacy
WHERE access."tenantId" = legacy."tenantId"
  AND access."isOwnerBook" = false
  AND access."liveApprovedAt" IS NULL;

-- Append-only remains the default. The exception exists only while an
-- administrator/pre-launch cleanup explicitly enables the LOCAL transaction
-- setting. SET LOCAL disappears automatically at COMMIT/ROLLBACK.
CREATE OR REPLACE FUNCTION "book_reject_document_registry_event_mutation"() RETURNS trigger AS $book$
DECLARE
  allow_test_delete TEXT;
BEGIN
  allow_test_delete := current_setting('book.allow_test_tenant_delete', true);

  IF TG_OP = 'DELETE' AND allow_test_delete = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$book$ LANGUAGE plpgsql;

-- Some upgraded databases can still have legacy append-only triggers pointing
-- at this older function. Preserve the same default protection and the same
-- transaction-local pre-launch exception instead of dropping those triggers.
CREATE OR REPLACE FUNCTION "book_reject_append_only_mutation"() RETURNS trigger AS $book$
DECLARE
  allow_test_delete TEXT;
BEGIN
  allow_test_delete := current_setting('book.allow_test_tenant_delete', true);

  IF TG_OP = 'DELETE' AND allow_test_delete = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$book$ LANGUAGE plpgsql;

-- WorkspaceState was created before these foreign keys existed.
-- Remove only rows already orphaned by earlier test failures, then align the
-- database with the Prisma relations.
DELETE FROM "WorkspaceState" workspace
WHERE NOT EXISTS (
    SELECT 1 FROM "Tenant" tenant
    WHERE tenant."id" = workspace."tenantId"
  )
  OR NOT EXISTS (
    SELECT 1 FROM "PlatformAccount" account
    WHERE account."id" = workspace."platformAccountId"
  );

ALTER TABLE "WorkspaceState"
  DROP CONSTRAINT IF EXISTS "WorkspaceState_tenantId_fkey";
ALTER TABLE "WorkspaceState"
  DROP CONSTRAINT IF EXISTS "WorkspaceState_platformAccountId_fkey";

ALTER TABLE "WorkspaceState"
  ADD CONSTRAINT "WorkspaceState_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceState"
  ADD CONSTRAINT "WorkspaceState_platformAccountId_fkey"
  FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
