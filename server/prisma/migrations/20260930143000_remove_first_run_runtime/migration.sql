BEGIN;

ALTER TABLE "PlatformActivityEvent"
  DROP COLUMN IF EXISTS "sessionId" CASCADE,
  DROP COLUMN IF EXISTS "stepKey" CASCADE,
  DROP COLUMN IF EXISTS "scenarioVersionId" CASCADE;

DO $$
BEGIN
  IF to_regclass('"TenantInvitation"') IS NOT NULL THEN
    ALTER TABLE "TenantInvitation"
      DROP COLUMN IF EXISTS "firstRunScenarioVersionId" CASCADE;
  END IF;
  IF to_regclass('"MasterInvitation"') IS NOT NULL THEN
    ALTER TABLE "MasterInvitation"
      DROP COLUMN IF EXISTS "firstRunScenarioVersionId" CASCADE;
  END IF;
END
$$;

DROP TABLE IF EXISTS "FirstRunStepProgress" CASCADE;
DROP TABLE IF EXISTS "FirstRunProgress" CASCADE;
DROP TABLE IF EXISTS "FirstRunStep" CASCADE;
DROP TABLE IF EXISTS "FirstRunScenarioVersion" CASCADE;
DROP TABLE IF EXISTS "FirstRunScenario" CASCADE;
DROP TABLE IF EXISTS "PlatformSession" CASCADE;

ALTER TABLE "PlatformAccount"
  DROP COLUMN IF EXISTS "onboardingStep" CASCADE,
  DROP COLUMN IF EXISTS "workspaceUnlocked" CASCADE;


COMMIT;
