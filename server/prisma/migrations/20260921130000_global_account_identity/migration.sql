BEGIN;

DO $$
BEGIN
  IF EXISTS (
    WITH contacts AS (
      SELECT "id" AS "accountId", 'EMAIL' AS "type", lower(trim("email")) AS "value"
      FROM "Account"
      WHERE trim("email") <> ''
      UNION ALL
      SELECT "id", 'PHONE',
        CASE
          WHEN length(regexp_replace("phone", '\\D', '', 'g')) = 10
            THEN '7' || regexp_replace("phone", '\\D', '', 'g')
          WHEN length(regexp_replace("phone", '\\D', '', 'g')) = 11
            AND regexp_replace("phone", '\\D', '', 'g') LIKE '8%'
            THEN '7' || substring(regexp_replace("phone", '\\D', '', 'g') from 2)
          ELSE regexp_replace("phone", '\\D', '', 'g')
        END
      FROM "Account"
      WHERE regexp_replace("phone", '\\D', '', 'g') <> ''
      UNION ALL
      SELECT "id", 'TELEGRAM', trim("telegramId")
      FROM "Account"
      WHERE trim("telegramId") <> ''
    )
    SELECT 1
    FROM contacts
    GROUP BY "type", "value"
    HAVING count(DISTINCT "accountId") > 1
  ) THEN
    RAISE EXCEPTION 'Global Account migration found one contact assigned to multiple Accounts; explicit identity resolution is required';
  END IF;
END
$$;

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

INSERT INTO "AccountContact" ("id", "accountId", "type", "value", "isPrimary")
SELECT 'legacy-email-' || "id", "id", 'EMAIL'::"AccountContactType", lower(trim("email")), true
FROM "Account"
WHERE trim("email") <> '';

INSERT INTO "AccountContact" ("id", "accountId", "type", "value", "isPrimary")
SELECT
  'legacy-phone-' || "id",
  "id",
  'PHONE'::"AccountContactType",
  CASE
    WHEN length(regexp_replace("phone", '\\D', '', 'g')) = 10
      THEN '7' || regexp_replace("phone", '\\D', '', 'g')
    WHEN length(regexp_replace("phone", '\\D', '', 'g')) = 11
      AND regexp_replace("phone", '\\D', '', 'g') LIKE '8%'
      THEN '7' || substring(regexp_replace("phone", '\\D', '', 'g') from 2)
    ELSE regexp_replace("phone", '\\D', '', 'g')
  END,
  true
FROM "Account"
WHERE regexp_replace("phone", '\\D', '', 'g') <> '';

INSERT INTO "AccountContact" ("id", "accountId", "type", "value", "isPrimary")
SELECT 'legacy-telegram-' || "id", "id", 'TELEGRAM'::"AccountContactType", trim("telegramId"), true
FROM "Account"
WHERE trim("telegramId") <> '';

COMMIT;
