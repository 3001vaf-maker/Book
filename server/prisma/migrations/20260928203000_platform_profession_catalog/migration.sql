CREATE TABLE "PlatformProfession" (
  "id" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformProfession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformProfession_normalizedName_key"
ON "PlatformProfession"("normalizedName");

CREATE INDEX "PlatformProfession_name_idx"
ON "PlatformProfession"("name");

CREATE INDEX "PlatformProfession_lastSeenAt_idx"
ON "PlatformProfession"("lastSeenAt");

WITH observed AS (
  SELECT trim("profession") AS "name"
  FROM "Profile"
  WHERE trim(COALESCE("profession", '')) <> ''

  UNION

  SELECT trim(custom_value) AS "name"
  FROM "Profile" p
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(COALESCE(p."customProfessions", '[]'::jsonb)) = 'array'
        THEN COALESCE(p."customProfessions", '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) AS custom_value
  WHERE trim(custom_value) <> ''
),
cleaned AS (
  SELECT
    regexp_replace("name", '\s+', ' ', 'g') AS "name",
    lower(regexp_replace("name", '\s+', ' ', 'g')) AS "normalizedName"
  FROM observed
),
deduplicated AS (
  SELECT "normalizedName", min("name") AS "name"
  FROM cleaned
  WHERE "normalizedName" <> '' AND "normalizedName" <> 'другая'
  GROUP BY "normalizedName"
)
INSERT INTO "PlatformProfession" (
  "id","normalizedName","name","firstSeenAt","lastSeenAt","createdAt","updatedAt"
)
SELECT
  'profession_' || md5("normalizedName"),
  "normalizedName",
  "name",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM deduplicated
ON CONFLICT ("normalizedName") DO NOTHING;
