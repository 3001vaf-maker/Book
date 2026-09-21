BEGIN;

INSERT INTO "TenantAccess" (
  "tenantId",
  "planId",
  "status",
  "isOwnerBook",
  "commercialMode",
  "demoActivatedAt",
  "demoExpiresAt",
  "demoExtendedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  tenant."id",
  NULL,
  'ACTIVE'::"TenantAccessStatus",
  EXISTS (
    SELECT 1
    FROM "Membership" membership
    JOIN "PlatformAdmin" admin
      ON admin."platformAccountId" = membership."platformAccountId"
    WHERE membership."tenantId" = tenant."id"
  ),
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM "TenantInvitation" invitation
      WHERE invitation."tenantId" = tenant."id"
        AND invitation."status" = 'PENDING'
    ) THEN 'DEMO'
    ELSE 'LIVE'
  END,
  (
    SELECT invitation."activatedAt"
    FROM "TenantInvitation" invitation
    WHERE invitation."tenantId" = tenant."id"
      AND invitation."status" = 'PENDING'
    ORDER BY invitation."createdAt" DESC
    LIMIT 1
  ),
  (
    SELECT invitation."demoExpiresAt"
    FROM "TenantInvitation" invitation
    WHERE invitation."tenantId" = tenant."id"
      AND invitation."status" = 'PENDING'
    ORDER BY invitation."createdAt" DESC
    LIMIT 1
  ),
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Tenant" tenant
WHERE NOT EXISTS (
  SELECT 1
  FROM "TenantAccess" access
  WHERE access."tenantId" = tenant."id"
);

UPDATE "TenantAccess" access
SET
  "isOwnerBook" = true,
  "commercialMode" = 'LIVE',
  "status" = 'ACTIVE',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM "Membership" membership
  JOIN "PlatformAdmin" admin
    ON admin."platformAccountId" = membership."platformAccountId"
  WHERE membership."tenantId" = access."tenantId"
);

COMMIT;
