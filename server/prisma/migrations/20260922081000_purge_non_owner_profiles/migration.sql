BEGIN;

-- PRE-LAUNCH ONE-TIME CLEAN START.
-- Preserve:
--   * OWNER Book;
--   * a non-owner profile only when an administrator explicitly approved LIVE.
-- A legacy commercialMode='LIVE' value by itself is NOT proof of approval.

CREATE TEMP TABLE "_BookPreservedTenant" (
  "tenantId" TEXT PRIMARY KEY
) ON COMMIT DROP;

DO $purge1$
DECLARE
  tenant_count BIGINT;
  owner_count BIGINT;
BEGIN
  SELECT count(*) INTO tenant_count FROM "Tenant";
  IF tenant_count = 0 THEN
    RETURN;
  END IF;

  SELECT count(*) INTO owner_count
  FROM "TenantAccess"
  WHERE "isOwnerBook" = true;

  IF owner_count <> 1 THEN
    RAISE EXCEPTION 'BOOK_PROFILE_PURGE refused: expected exactly one OWNER Book, found %', owner_count;
  END IF;

  INSERT INTO "_BookPreservedTenant" ("tenantId")
  SELECT "tenantId"
  FROM "TenantAccess"
  WHERE "isOwnerBook" = true;

  -- New explicit approval state.
  INSERT INTO "_BookPreservedTenant" ("tenantId")
  SELECT "tenantId"
  FROM "TenantAccess"
  WHERE "isOwnerBook" = false
    AND "liveApprovedAt" IS NOT NULL
  ON CONFLICT ("tenantId") DO NOTHING;

  -- Compatibility for a genuine admin approval recorded before
  -- liveApprovedAt existed. The admin endpoint was the only production route
  -- that generated COMMERCIAL_MODE_CHANGED.
  INSERT INTO "_BookPreservedTenant" ("tenantId")
  SELECT DISTINCT event."tenantId"
  FROM "PlatformActivityEvent" event
  JOIN "TenantAccess" access ON access."tenantId" = event."tenantId"
  WHERE access."isOwnerBook" = false
    AND event."eventType" = 'COMMERCIAL_MODE_CHANGED'
    AND event."metadata"->>'commercialMode' = 'LIVE'
  ON CONFLICT ("tenantId") DO NOTHING;
END $purge1$;

CREATE TEMP TABLE "_BookIncomingTenant" (
  "tenantId" TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO "_BookIncomingTenant" ("tenantId")
SELECT tenant."id"
FROM "Tenant" tenant
WHERE NOT EXISTS (
  SELECT 1
  FROM "_BookPreservedTenant" preserved
  WHERE preserved."tenantId" = tenant."id"
);

-- Capture master accounts before tenant-scoped Membership rows are removed.
CREATE TEMP TABLE "_BookIncomingPlatformAccount" (
  "platformAccountId" TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO "_BookIncomingPlatformAccount" ("platformAccountId")
SELECT DISTINCT membership."platformAccountId"
FROM "Membership" membership
JOIN "_BookIncomingTenant" incoming
  ON incoming."tenantId" = membership."tenantId";

-- This exception exists only for this transaction. Append-only protection is
-- automatically active again after COMMIT/ROLLBACK.
SET LOCAL "book.allow_test_tenant_delete" = 'on';

-- Remove all tenant-scoped rows for test profiles, including append-only test
-- events. Platform/system catalogues have no tenantId and are not touched.
DO $purge2$
DECLARE
  row_record RECORD;
BEGIN
  FOR row_record IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenantId'
      AND table_name <> 'Tenant'
    ORDER BY table_name
  LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE "tenantId" IN (SELECT "tenantId" FROM "_BookIncomingTenant")',
      row_record.table_name
    );
  END LOOP;
END $purge2$;

DELETE FROM "Tenant" tenant
USING "_BookIncomingTenant" incoming
WHERE tenant."id" = incoming."tenantId";

-- An account may be shared with a preserved Tenant. Delete only accounts that
-- became completely orphaned and are not platform administrators.
CREATE TEMP TABLE "_BookDeletePlatformAccount" (
  "platformAccountId" TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO "_BookDeletePlatformAccount" ("platformAccountId")
SELECT incoming."platformAccountId"
FROM "_BookIncomingPlatformAccount" incoming
WHERE NOT EXISTS (
    SELECT 1 FROM "Membership" membership
    WHERE membership."platformAccountId" = incoming."platformAccountId"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "PlatformAdmin" admin_row
    WHERE admin_row."platformAccountId" = incoming."platformAccountId"
  );

-- Remove account-scoped test residue too (for example consent rows whose
-- tenantId is NULL). This is still limited to orphaned incoming accounts.
DO $purge3$
DECLARE
  row_record RECORD;
BEGIN
  FOR row_record IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'platformAccountId'
      AND table_name <> 'PlatformAccount'
    ORDER BY table_name
  LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE "platformAccountId" IN (SELECT "platformAccountId" FROM "_BookDeletePlatformAccount")',
      row_record.table_name
    );
  END LOOP;

  -- Legacy legal/audit tables used actorUserId before the current naming.
  FOR row_record IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'actorUserId'
    ORDER BY table_name
  LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE "actorUserId" IN (SELECT "platformAccountId" FROM "_BookDeletePlatformAccount")',
      row_record.table_name
    );
  END LOOP;
END $purge3$;

DELETE FROM "PlatformAccount" account_row
USING "_BookDeletePlatformAccount" incoming
WHERE account_row."id" = incoming."platformAccountId";

DO $purge4$
DECLARE
  tenant_count BIGINT;
  owner_count BIGINT;
BEGIN
  SELECT count(*) INTO tenant_count FROM "Tenant";
  IF tenant_count = 0 THEN
    RETURN;
  END IF;

  SELECT count(*) INTO owner_count
  FROM "TenantAccess"
  WHERE "isOwnerBook" = true;

  IF owner_count <> 1 THEN
    RAISE EXCEPTION 'BOOK_PROFILE_PURGE failed: OWNER Book count is %', owner_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Tenant" tenant
    JOIN "TenantAccess" access ON access."tenantId" = tenant."id"
    WHERE access."isOwnerBook" = false
      AND access."liveApprovedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "PlatformActivityEvent" event
        WHERE event."tenantId" = tenant."id"
          AND event."eventType" = 'COMMERCIAL_MODE_CHANGED'
          AND event."metadata"->>'commercialMode' = 'LIVE'
      )
  ) THEN
    RAISE EXCEPTION 'BOOK_PROFILE_PURGE failed: unapproved non-owner profile remains';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "_BookIncomingTenant" incoming
    JOIN "Tenant" tenant ON tenant."id" = incoming."tenantId"
  ) THEN
    RAISE EXCEPTION 'BOOK_PROFILE_PURGE failed: selected test Tenant remains';
  END IF;
END $purge4$;

COMMIT;
