BEGIN;

-- PRE-LAUNCH ONE-TIME CLEAN START
-- Remove only incoming/non-owner Book profiles and their tenant-scoped data.
-- Preserve OWNER Book, all data inside OWNER Book, platform catalogs and application configuration.

CREATE TEMP TABLE "_BookPreservedOwnerTenant" (
  "tenantId" TEXT PRIMARY KEY
) ON COMMIT DROP;

DO $$
DECLARE
  tenant_count BIGINT;
  owner_count BIGINT;
BEGIN
  SELECT count(*) INTO tenant_count FROM "Tenant";

  -- Fresh empty databases must still be able to apply the migration.
  IF tenant_count = 0 THEN
    RETURN;
  END IF;

  SELECT count(*) INTO owner_count
  FROM "TenantAccess"
  WHERE "isOwnerBook" = true;

  IF owner_count <> 1 THEN
    RAISE EXCEPTION 'BOOK_PROFILE_PURGE refused: expected exactly one OWNER Book, found %', owner_count;
  END IF;

  INSERT INTO "_BookPreservedOwnerTenant" ("tenantId")
  SELECT "tenantId"
  FROM "TenantAccess"
  WHERE "isOwnerBook" = true;
END $$;

CREATE TEMP TABLE "_BookIncomingTenant" (
  "tenantId" TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO "_BookIncomingTenant" ("tenantId")
SELECT t."id"
FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1
  FROM "_BookPreservedOwnerTenant" owner_row
  WHERE owner_row."tenantId" = t."id"
);

-- Tenant cascades remove only the incoming profile's own workspace/profile/business rows.
DELETE FROM "Tenant" t
USING "_BookIncomingTenant" incoming
WHERE t."id" = incoming."tenantId";

-- Remove master accounts left orphaned by deleted incoming profiles.
-- Preserve the platform admin and any account still used by another Tenant.
DELETE FROM "PlatformAccount" account_row
WHERE NOT EXISTS (
    SELECT 1
    FROM "Membership" membership_row
    WHERE membership_row."platformAccountId" = account_row."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "PlatformAdmin" admin_row
    WHERE admin_row."platformAccountId" = account_row."id"
  );

DO $$
DECLARE
  tenant_count BIGINT;
  non_owner_count BIGINT;
  owner_count BIGINT;
BEGIN
  SELECT count(*) INTO tenant_count FROM "Tenant";
  SELECT count(*) INTO owner_count
  FROM "TenantAccess"
  WHERE "isOwnerBook" = true;
  SELECT count(*) INTO non_owner_count
  FROM "TenantAccess"
  WHERE "isOwnerBook" = false;

  IF tenant_count = 0 THEN
    -- Empty fresh DB is a valid state before owner bootstrap.
    RETURN;
  END IF;

  IF owner_count <> 1 THEN
    RAISE EXCEPTION 'BOOK_PROFILE_PURGE failed: OWNER Book count is %', owner_count;
  END IF;

  IF non_owner_count <> 0 THEN
    RAISE EXCEPTION 'BOOK_PROFILE_PURGE failed: non-owner profiles remain (%)', non_owner_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Tenant" t
    WHERE NOT EXISTS (
      SELECT 1
      FROM "TenantAccess" ta
      WHERE ta."tenantId" = t."id"
        AND ta."isOwnerBook" = true
    )
  ) THEN
    RAISE EXCEPTION 'BOOK_PROFILE_PURGE failed: non-owner Tenant remains';
  END IF;
END $$;

COMMIT;
