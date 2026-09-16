CREATE TABLE "TenantTimeZone" (
  "tenantId" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantTimeZone_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "TenantTimeZone_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Existing production workspaces keep Book's current Moscow behavior.
-- New businesses replace this fallback automatically when their first working profile is bootstrapped.
INSERT INTO "TenantTimeZone" ("tenantId", "timeZone")
SELECT "id", 'Europe/Moscow'
FROM "Tenant"
ON CONFLICT ("tenantId") DO NOTHING;
