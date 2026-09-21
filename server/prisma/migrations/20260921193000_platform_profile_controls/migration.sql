BEGIN;

CREATE TABLE IF NOT EXISTS "PlatformNotificationPreference" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "platformAccountId" TEXT NOT NULL,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformNotificationPreference_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlatformNotificationPreference_platformAccountId_fkey"
    FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformNotificationPreference_tenant_account_key"
  ON "PlatformNotificationPreference"("tenantId","platformAccountId");
CREATE INDEX IF NOT EXISTS "PlatformNotificationPreference_account_idx"
  ON "PlatformNotificationPreference"("platformAccountId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'PlatformActivityEvent_append_only'
  ) THEN
    CREATE TRIGGER "PlatformActivityEvent_append_only"
    BEFORE UPDATE OR DELETE ON "PlatformActivityEvent"
    FOR EACH ROW EXECUTE FUNCTION "book_reject_document_registry_event_mutation"();
  END IF;
END $$;

COMMIT;
