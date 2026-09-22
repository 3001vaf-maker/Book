BEGIN;

-- PRE-LAUNCH TEST MODE
-- Only incoming non-OWNER profiles/workspaces are test data.
-- Book OWNER, system catalogues, scenarios, document templates and infrastructure are preserved.

-- Current platform consent history belongs to the incoming test profile during pre-launch.
DROP TRIGGER IF EXISTS "PlatformConsentEvent_append_only" ON "PlatformConsentEvent";

ALTER TABLE "PlatformConsentEvent"
  DROP CONSTRAINT IF EXISTS "PlatformConsentEvent_tenantId_fkey";
ALTER TABLE "PlatformConsentEvent"
  DROP CONSTRAINT IF EXISTS "PlatformConsentEvent_platformAccountId_fkey";

ALTER TABLE "PlatformConsentEvent"
  ADD CONSTRAINT "PlatformConsentEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformConsentEvent"
  ADD CONSTRAINT "PlatformConsentEvent_platformAccountId_fkey"
  FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Current activity history is also test-profile data during pre-launch.
DROP TRIGGER IF EXISTS "PlatformActivityEvent_append_only" ON "PlatformActivityEvent";

-- Old legal event tables may still exist in an upgraded production database.
-- Keep the tables themselves; only make their profile references cascade so
-- deleting a test profile removes that profile's old test rows.
DO $cleanup$
BEGIN
  IF to_regclass('"LegalStateEvent"') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS "LegalStateEvent_append_only" ON "LegalStateEvent"';

    ALTER TABLE "LegalStateEvent"
      DROP CONSTRAINT IF EXISTS "LegalStateEvent_tenantId_fkey";
    ALTER TABLE "LegalStateEvent"
      DROP CONSTRAINT IF EXISTS "LegalStateEvent_actorUserId_fkey";

    ALTER TABLE "LegalStateEvent"
      ADD CONSTRAINT "LegalStateEvent_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "LegalStateEvent"
      ADD CONSTRAINT "LegalStateEvent_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "PlatformAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF to_regclass('"LegalAuditEvent"') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS "LegalAuditEvent_append_only" ON "LegalAuditEvent"';

    ALTER TABLE "LegalAuditEvent"
      DROP CONSTRAINT IF EXISTS "LegalAuditEvent_tenantId_fkey";
    ALTER TABLE "LegalAuditEvent"
      DROP CONSTRAINT IF EXISTS "LegalAuditEvent_actorUserId_fkey";

    ALTER TABLE "LegalAuditEvent"
      ADD CONSTRAINT "LegalAuditEvent_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "LegalAuditEvent"
      ADD CONSTRAINT "LegalAuditEvent_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "PlatformAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$cleanup$;

-- One-time clean start: capture only accounts attached to incoming non-OWNER workspaces.
CREATE TEMP TABLE "_book_prelaunch_cleanup_tenants" ON COMMIT DROP AS
SELECT "tenantId"
FROM "TenantAccess"
WHERE "isOwnerBook" = false;

CREATE TEMP TABLE "_book_prelaunch_cleanup_accounts" ON COMMIT DROP AS
SELECT DISTINCT membership."platformAccountId"
FROM "Membership" membership
JOIN "_book_prelaunch_cleanup_tenants" cleanup
  ON cleanup."tenantId" = membership."tenantId";

-- Delete only incoming test workspaces. Tenant-scoped rows follow their declared cascades.
DELETE FROM "Tenant" tenant
USING "_book_prelaunch_cleanup_tenants" cleanup
WHERE tenant."id" = cleanup."tenantId";

-- Delete only now-orphaned incoming platform profiles.
-- OWNER/admin accounts and accounts still attached to another workspace are preserved.
DELETE FROM "PlatformAccount" account
USING "_book_prelaunch_cleanup_accounts" cleanup
WHERE account."id" = cleanup."platformAccountId"
  AND NOT EXISTS (
    SELECT 1 FROM "Membership" membership
    WHERE membership."platformAccountId" = account."id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "PlatformAdmin" admin
    WHERE admin."platformAccountId" = account."id"
  );

COMMIT;
