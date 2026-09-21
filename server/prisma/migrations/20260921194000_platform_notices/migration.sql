BEGIN;

CREATE TABLE IF NOT EXISTS "PlatformNotice" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "platformAccountId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformNotice_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

DO $$
DECLARE
  account_table TEXT;
BEGIN
  IF to_regclass('"PlatformAccount"') IS NOT NULL THEN
    account_table := '"PlatformAccount"';
  ELSIF to_regclass('"User"') IS NOT NULL THEN
    account_table := '"User"';
  ELSE
    RAISE EXCEPTION 'Platform account table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlatformNotice_platformAccountId_fkey'
  ) THEN
    EXECUTE format(
      'ALTER TABLE "PlatformNotice" ADD CONSTRAINT "PlatformNotice_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES %s("id") ON DELETE CASCADE ON UPDATE CASCADE',
      account_table
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "PlatformNotice_tenant_created_idx"
  ON "PlatformNotice"("tenantId","createdAt");
CREATE INDEX IF NOT EXISTS "PlatformNotice_account_read_created_idx"
  ON "PlatformNotice"("platformAccountId","readAt","createdAt");

COMMIT;
