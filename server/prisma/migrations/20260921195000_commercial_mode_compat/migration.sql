BEGIN;

ALTER TABLE "TenantAccess"
  ALTER COLUMN "commercialMode" SET DEFAULT 'LIVE';

UPDATE "TenantAccess" AS access
SET "commercialMode" = 'LIVE'
WHERE access."commercialMode" = 'DEMO'
  AND access."demoActivatedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "TenantInvitation" invitation
    WHERE invitation."tenantId" = access."tenantId"
      AND invitation."status" = 'PENDING'
  );

COMMIT;
