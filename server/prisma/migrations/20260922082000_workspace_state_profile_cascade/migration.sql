BEGIN;

-- WorkspaceState was created before tenant/account foreign keys existed.
-- Remove only already-orphaned workspace rows, then make future profile deletion
-- clean them automatically. Book system/catalogue tables are not touched.

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
