BEGIN;

CREATE TABLE "AccountContactConflict" (
  "id" TEXT NOT NULL,
  "type" "AccountContactType" NOT NULL,
  "value" TEXT NOT NULL,
  "accountIds" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountContactConflict_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountContactConflict_type_value_key"
  ON "AccountContactConflict"("type", "value");

WITH contacts AS (
  SELECT "id" AS "accountId", 'EMAIL'::"AccountContactType" AS "type", lower(trim("email")) AS "value"
  FROM "Account"
  WHERE trim("email") <> ''

  UNION ALL

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
    END
  FROM "Account"
  WHERE regexp_replace("phone", '[^0-9]', '', 'g') <> ''

  UNION ALL

  SELECT "id", 'TELEGRAM'::"AccountContactType", trim("telegramId")
  FROM "Account"
  WHERE trim("telegramId") <> ''
)
INSERT INTO "AccountContactConflict" ("id", "type", "value", "accountIds")
SELECT
  'legacy-conflict-' || md5("type"::text || ':' || "value"),
  "type",
  "value",
  jsonb_agg(DISTINCT "accountId" ORDER BY "accountId")
FROM contacts
GROUP BY "type", "value"
HAVING count(DISTINCT "accountId") > 1;

COMMIT;
