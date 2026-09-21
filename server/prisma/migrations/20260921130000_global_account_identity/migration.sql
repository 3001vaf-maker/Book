BEGIN;

DROP INDEX IF EXISTS "Account_tenantId_email_key";
DROP INDEX IF EXISTS "Account_tenantId_idx";
DROP INDEX IF EXISTS "Account_tenantId_phone_idx";

ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_tenantId_fkey";
ALTER TABLE "Account" RENAME COLUMN "tenantId" TO "createdViaTenantId";
ALTER TABLE "Account" ALTER COLUMN "createdViaTenantId" DROP NOT NULL;

ALTER TABLE "Account"
  ADD CONSTRAINT "Account_createdViaTenantId_fkey"
  FOREIGN KEY ("createdViaTenantId") REFERENCES "Tenant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Account_createdViaTenantId_idx"
  ON "Account"("createdViaTenantId");

CREATE TYPE "AccountContactType" AS ENUM ('EMAIL', 'PHONE', 'TELEGRAM');

CREATE TABLE "AccountContact" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "type" "AccountContactType" NOT NULL,
  "value" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountContact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountContact_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AccountContact_value_not_empty"
    CHECK (length(trim("value")) > 0)
);

CREATE UNIQUE INDEX "AccountContact_type_value_key"
  ON "AccountContact"("type", "value");

CREATE INDEX "AccountContact_accountId_type_idx"
  ON "AccountContact"("accountId", "type");

CREATE TEMP TABLE "_AccountContactStage" (
  "accountId" TEXT NOT NULL,
  "type" "AccountContactType" NOT NULL,
  "value" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO "_AccountContactStage" ("accountId", "type", "value", "isPrimary")
SELECT "id", 'EMAIL'::"AccountContactType", lower(trim("email")), true
FROM "Account"
WHERE trim("email") <> '';

INSERT INTO "_AccountContactStage" ("accountId", "type", "value", "isPrimary")
SELECT
  "id",
  'PHONE'::"AccountContactType",
  CASE
    WHEN length(regexp_replace("phone", '[^0-9]', '', 'g')) = 10
      THEN '7' || regexp_replace("phone", '[^0-9]', '', 'g')
    WHEN length(regexp_replace("phone", '[^0-9]', '', 'g')) = 11
      AND regexp_replace("phone", '[^0-9]', '', 'g') LIKE '8%'
      THEN '7' || substring(regexp_replace("phone", '[^0-9]', '', 'g') from 2)
    ELSE regexp_replace("phone", '[^0-9]', '', 'g')
  END,
  true
FROM "Account"
WHERE regexp_replace("phone", '[^0-9]', '', 'g') <> '';

INSERT INTO "_AccountContactStage" ("accountId", "type", "value", "isPrimary")
SELECT "id", 'TELEGRAM'::"AccountContactType", trim("telegramId"), true
FROM "Account"
WHERE trim("telegramId") <> '';

INSERT INTO "AccountContact" ("id", "accountId", "type", "value", "isPrimary")
SELECT
  'legacy-' || lower(s."type"::text) || '-' || s."accountId",
  s."accountId",
  s."type",
  s."value",
  s."isPrimary"
FROM "_AccountContactStage" s
JOIN (
  SELECT "type", "value"
  FROM "_AccountContactStage"
  GROUP BY "type", "value"
  HAVING count(DISTINCT "accountId") = 1
) unique_contact
  ON unique_contact."type" = s."type"
 AND unique_contact."value" = s."value"
ON CONFLICT ("type", "value") DO NOTHING;

COMMIT;
