BEGIN;

CREATE TABLE IF NOT EXISTS "AccountTenantLink" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountTenantLink_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AccountTenantLink_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountTenantLink_account_tenant_key"
  ON "AccountTenantLink"("accountId", "tenantId");

CREATE INDEX IF NOT EXISTS "AccountTenantLink_tenant_account_idx"
  ON "AccountTenantLink"("tenantId", "accountId");

CREATE INDEX IF NOT EXISTS "AccountTenantLink_account_updated_idx"
  ON "AccountTenantLink"("accountId", "updatedAt");

INSERT INTO "AccountTenantLink" ("id", "accountId", "tenantId", "createdAt", "updatedAt")
SELECT
  concat('atl_', md5(a."id" || ':' || a."createdViaTenantId")),
  a."id",
  a."createdViaTenantId",
  a."createdAt",
  CURRENT_TIMESTAMP
FROM "Account" a
WHERE a."createdViaTenantId" IS NOT NULL
ON CONFLICT ("accountId", "tenantId") DO NOTHING;

INSERT INTO "AccountTenantLink" ("id", "accountId", "tenantId", "createdAt", "updatedAt")
SELECT
  concat('atl_', md5(r."accountId" || ':' || r."tenantId")),
  r."accountId",
  r."tenantId",
  MIN(r."createdAt"),
  CURRENT_TIMESTAMP
FROM "BookingRequest" r
GROUP BY r."accountId", r."tenantId"
ON CONFLICT ("accountId", "tenantId") DO NOTHING;

COMMIT;
