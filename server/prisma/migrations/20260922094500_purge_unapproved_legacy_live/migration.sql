BEGIN;

-- FINAL PRE-LAUNCH CLEAN START.
-- Preserve only:
--   1) OWNER Book;
--   2) a non-owner tenant with the complete proof chain
--      LIVE_REQUESTED -> LIVE_APPROVED_BY_ADMIN.
--
-- Old commercialMode='LIVE' and COMMERCIAL_MODE_CHANGED alone are test residue.

CREATE TEMP TABLE "_BookStrongApprovedTenant" (
  "tenantId" TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO "_BookStrongApprovedTenant" ("tenantId")
SELECT access."tenantId"
FROM "TenantAccess" access
WHERE access."isOwnerBook" = true;

INSERT INTO "_BookStrongApprovedTenant" ("tenantId")
SELECT DISTINCT approval."tenantId"
FROM "PlatformActivityEvent" approval
WHERE approval."eventType" = 'LIVE_APPROVED_BY_ADMIN'
  AND COALESCE(approval."metadata"->>'platformAdminId', '') <> ''
  AND EXISTS (
    SELECT 1
    FROM "PlatformActivityEvent" request
    WHERE request."tenantId" = approval."tenantId"
      AND request."eventType" = 'LIVE_REQUESTED'
      AND request."occurredAt" <= approval."occurredAt"
  )
ON CONFLICT ("tenantId") DO NOTHING;

-- Any approval fields created only by legacy backfill are not trusted.
UPDATE "TenantAccess" access
SET
  "liveApprovedAt" = NULL,
  "liveApprovedByAdminId" = NULL
WHERE access."isOwnerBook" = false
  AND NOT EXISTS (
    SELECT 1
    FROM "_BookStrongApprovedTenant" approved
    WHERE approved."tenantId" = access."tenantId"
  );

CREATE TEMP TABLE "_BookUnapprovedTenant" (
  "tenantId" TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO "_BookUnapprovedTenant" ("tenantId")
SELECT tenant."id"
FROM "Tenant" tenant
WHERE NOT EXISTS (
  SELECT 1
  FROM "_BookStrongApprovedTenant" approved
  WHERE approved."tenantId" = tenant."id"
);

CREATE TEMP TABLE "_BookUnapprovedPlatformAccount" (
  "platformAccountId" TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO "_BookUnapprovedPlatformAccount" ("platformAccountId")
SELECT DISTINCT membership."platformAccountId"
FROM "Membership" membership
JOIN "_BookUnapprovedTenant" doomed
  ON doomed."tenantId" = membership."tenantId";

SET LOCAL "book.allow_test_tenant_delete" = 'on';

DO $tenant_cleanup$
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
      'DELETE FROM public.%I WHERE "tenantId" IN (SELECT "tenantId" FROM "_BookUnapprovedTenant")',
      row_record.table_name
    );
  END LOOP;
END;
$tenant_cleanup$;

DELETE FROM "Tenant" tenant
USING "_BookUnapprovedTenant" doomed
WHERE tenant."id" = doomed."tenantId";

CREATE TEMP TABLE "_BookDeletePlatformAccount" (
  "platformAccountId" TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO "_BookDeletePlatformAccount" ("platformAccountId")
SELECT candidate."platformAccountId"
FROM "_BookUnapprovedPlatformAccount" candidate
WHERE NOT EXISTS (
    SELECT 1
    FROM "Membership" membership
    WHERE membership."platformAccountId" = candidate."platformAccountId"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "PlatformAdmin" admin_row
    WHERE admin_row."platformAccountId" = candidate."platformAccountId"
  );

DO $account_cleanup$
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
END;
$account_cleanup$;

DELETE FROM "PlatformAccount" account_row
USING "_BookDeletePlatformAccount" doomed
WHERE account_row."id" = doomed."platformAccountId";

DO $verify_cleanup$
DECLARE
  owner_count BIGINT;
BEGIN
  SELECT count(*) INTO owner_count
  FROM "TenantAccess"
  WHERE "isOwnerBook" = true;

  IF owner_count <> 1 THEN
    RAISE EXCEPTION 'BOOK_FINAL_CLEAN_START failed: expected exactly one OWNER Book, found %', owner_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "TenantAccess" access
    WHERE access."isOwnerBook" = false
      AND NOT EXISTS (
        SELECT 1
        FROM "PlatformActivityEvent" approval
        WHERE approval."tenantId" = access."tenantId"
          AND approval."eventType" = 'LIVE_APPROVED_BY_ADMIN'
          AND COALESCE(approval."metadata"->>'platformAdminId', '') <> ''
          AND EXISTS (
            SELECT 1
            FROM "PlatformActivityEvent" request
            WHERE request."tenantId" = access."tenantId"
              AND request."eventType" = 'LIVE_REQUESTED'
              AND request."occurredAt" <= approval."occurredAt"
          )
      )
  ) THEN
    RAISE EXCEPTION 'BOOK_FINAL_CLEAN_START failed: unapproved non-owner profile remains';
  END IF;
END;
$verify_cleanup$;

COMMIT;
