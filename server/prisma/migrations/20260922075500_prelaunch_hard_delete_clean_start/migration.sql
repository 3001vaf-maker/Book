BEGIN;

-- PRE-LAUNCH TEST MODE
-- Keep Book system tables and platform configuration intact.
-- Only incoming profile/workspace rows are removable during pre-launch.

-- WorkspaceState was originally created without foreign keys.
-- Remove already orphaned rows, then make future profile deletion cascade cleanly.
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

-- During pre-launch, consent/activity rows are test-profile data and must be
-- removable together with the incoming profile.
DROP TRIGGER IF EXISTS "PlatformConsentEvent_append_only" ON "PlatformConsentEvent";
DROP TRIGGER IF EXISTS "PlatformActivityEvent_append_only" ON "PlatformActivityEvent";

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

-- Upgraded production databases can still contain legacy legal event tables.
-- Preserve those tables; only allow their rows to follow deletion of the
-- incoming profile they belong to.
DO $legacy$
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
$legacy$;

COMMIT;
