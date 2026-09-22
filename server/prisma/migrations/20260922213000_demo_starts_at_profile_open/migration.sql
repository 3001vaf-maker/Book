BEGIN;

-- DEMO timing correction:
-- opening an invitation or accepting platform documents must not consume DEMO time.
-- For current non-owner DEMO profiles, anchor the 14-day window to the first real
-- opening of the Profile step. If Profile was never opened, clear the old timer so
-- it starts on the next Profile opening. Explicit admin extensions are preserved.

WITH profile_open AS (
  SELECT "tenantId", min("occurredAt") AS "openedAt"
  FROM "PlatformActivityEvent"
  WHERE "eventType" = 'STEP_MODAL_SHOWN'
    AND "stepKey" = 'profile'
  GROUP BY "tenantId"
)
UPDATE "TenantAccess" access
SET
  "demoActivatedAt" = profile_open."openedAt",
  "demoExpiresAt" = profile_open."openedAt" + INTERVAL '14 days'
FROM profile_open
WHERE access."tenantId" = profile_open."tenantId"
  AND access."isOwnerBook" = false
  AND access."commercialMode" = 'DEMO'
  AND access."demoExtendedAt" IS NULL;

UPDATE "TenantAccess" access
SET
  "demoActivatedAt" = NULL,
  "demoExpiresAt" = NULL
WHERE access."isOwnerBook" = false
  AND access."commercialMode" = 'DEMO'
  AND access."demoExtendedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "PlatformActivityEvent" event
    WHERE event."tenantId" = access."tenantId"
      AND event."eventType" = 'STEP_MODAL_SHOWN'
      AND event."stepKey" = 'profile'
  );

UPDATE "TenantInvitation" invitation
SET
  "activatedAt" = access."demoActivatedAt",
  "demoExpiresAt" = access."demoExpiresAt"
FROM "TenantAccess" access
WHERE invitation."tenantId" = access."tenantId"
  AND access."isOwnerBook" = false
  AND access."commercialMode" = 'DEMO'
  AND access."demoExtendedAt" IS NULL;

COMMIT;
