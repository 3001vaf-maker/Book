ALTER TABLE "CommunicationMessage"
ADD COLUMN "profileKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN "actorAccountId" TEXT,
ADD COLUMN "actorPersonKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN "actorName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "actorUei" TEXT NOT NULL DEFAULT '',
ADD COLUMN "content" JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}'::jsonb,
ADD COLUMN "editedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "CommunicationMessage"
ADD CONSTRAINT "CommunicationMessage_actorAccountId_fkey"
FOREIGN KEY ("actorAccountId") REFERENCES "BookingAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CommunicationMessage_tenantId_profileKey_createdAt_idx"
ON "CommunicationMessage"("tenantId", "profileKey", "createdAt");

CREATE INDEX "CommunicationMessage_tenantId_actorAccountId_createdAt_idx"
ON "CommunicationMessage"("tenantId", "actorAccountId", "createdAt");

-- Legacy messages are anchored to the BusinessPerson from which their login/contact originated.
-- Existing rows are never merged or rewritten into a different human merely because data looks similar.
WITH phone_account_matches AS (
  SELECT m."id" AS "messageId", MIN(ba."id") AS "accountId"
  FROM "CommunicationMessage" m
  JOIN "BookingAccount" ba
    ON ba."tenantId" = m."tenantId"
   AND (
     CASE
       WHEN length(regexp_replace(ba."phone", '[^0-9]', '', 'g')) = 10
         THEN '7' || regexp_replace(ba."phone", '[^0-9]', '', 'g')
       WHEN length(regexp_replace(ba."phone", '[^0-9]', '', 'g')) = 11
            AND left(regexp_replace(ba."phone", '[^0-9]', '', 'g'), 1) = '8'
         THEN '7' || substring(regexp_replace(ba."phone", '[^0-9]', '', 'g') from 2)
       ELSE regexp_replace(ba."phone", '[^0-9]', '', 'g')
     END
   ) = (
     CASE
       WHEN length(regexp_replace(m."cardPhone", '[^0-9]', '', 'g')) = 10
         THEN '7' || regexp_replace(m."cardPhone", '[^0-9]', '', 'g')
       WHEN length(regexp_replace(m."cardPhone", '[^0-9]', '', 'g')) = 11
            AND left(regexp_replace(m."cardPhone", '[^0-9]', '', 'g'), 1) = '8'
         THEN '7' || substring(regexp_replace(m."cardPhone", '[^0-9]', '', 'g') from 2)
       ELSE regexp_replace(m."cardPhone", '[^0-9]', '', 'g')
     END
   )
  WHERE m."channel" = 'IN_APP' AND m."cardPhone" <> ''
  GROUP BY m."id"
  HAVING COUNT(*) = 1
), account_people AS (
  SELECT pam."messageId", pam."accountId", bp."key" AS "personKey",
         COALESCE(NULLIF(trim(concat_ws(' ', bp."data"->>'name', bp."data"->>'surname')), ''), '') AS "actorName"
  FROM phone_account_matches pam
  JOIN "CommunicationMessage" m ON m."id" = pam."messageId"
  JOIN "BusinessPerson" bp ON bp."tenantId" = m."tenantId"
  WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(COALESCE(bp."data"->'accounts', '[]'::jsonb)) a(value)
    WHERE a.value = pam."accountId"
  )
)
UPDATE "CommunicationMessage" m
SET "profileKey" = ap."personKey",
    "actorAccountId" = CASE WHEN m."direction" = 'inbound' THEN ap."accountId" ELSE NULL END,
    "actorPersonKey" = CASE WHEN m."direction" = 'inbound' THEN ap."personKey" ELSE '' END,
    "actorName" = CASE WHEN m."direction" = 'inbound' THEN ap."actorName" ELSE '' END
FROM account_people ap
WHERE m."id" = ap."messageId";

-- If an old row already carries a UEI, preserve the master's explicit identity decision.
-- Resolve only an explicit UEI entity owner that still exists as a BusinessPerson in the same tenant.
WITH explicit_uei_owners AS (
  SELECT m."id" AS "messageId", owner."id" AS "personKey"
  FROM "CommunicationMessage" m
  JOIN "BusinessIdentityState" bis ON bis."tenantId" = m."tenantId"
  CROSS JOIN LATERAL jsonb_to_record(
    COALESCE(bis."data"->'entities'->m."uei"->'owner', '{}'::jsonb)
  ) AS owner("type" TEXT, "id" TEXT)
  WHERE m."profileKey" = ''
    AND m."uei" <> ''
    AND owner."type" = 'person'
    AND owner."id" <> ''
    AND EXISTS (
      SELECT 1 FROM "BusinessPerson" bp
      WHERE bp."tenantId" = m."tenantId" AND bp."key" = owner."id"
    )
)
UPDATE "CommunicationMessage" m
SET "profileKey" = e."personKey"
FROM explicit_uei_owners e
WHERE m."id" = e."messageId";

-- Conservative final fallback for old rows without recoverable account/UEI ownership:
-- use a phone only when exactly one BusinessPerson in the tenant owns that normalized phone.
WITH person_phone_matches AS (
  SELECT m."id" AS "messageId", MIN(bp."key") AS "personKey"
  FROM "CommunicationMessage" m
  JOIN "BusinessPerson" bp ON bp."tenantId" = m."tenantId"
  WHERE m."profileKey" = ''
    AND m."cardPhone" <> ''
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(bp."data"->'phones', '[]'::jsonb)) p(value)
      WHERE (
        CASE
          WHEN length(regexp_replace(p.value, '[^0-9]', '', 'g')) = 10
            THEN '7' || regexp_replace(p.value, '[^0-9]', '', 'g')
          WHEN length(regexp_replace(p.value, '[^0-9]', '', 'g')) = 11
               AND left(regexp_replace(p.value, '[^0-9]', '', 'g'), 1) = '8'
            THEN '7' || substring(regexp_replace(p.value, '[^0-9]', '', 'g') from 2)
          ELSE regexp_replace(p.value, '[^0-9]', '', 'g')
        END
      ) = (
        CASE
          WHEN length(regexp_replace(m."cardPhone", '[^0-9]', '', 'g')) = 10
            THEN '7' || regexp_replace(m."cardPhone", '[^0-9]', '', 'g')
          WHEN length(regexp_replace(m."cardPhone", '[^0-9]', '', 'g')) = 11
               AND left(regexp_replace(m."cardPhone", '[^0-9]', '', 'g'), 1) = '8'
            THEN '7' || substring(regexp_replace(m."cardPhone", '[^0-9]', '', 'g') from 2)
          ELSE regexp_replace(m."cardPhone", '[^0-9]', '', 'g')
        END
      )
    )
  GROUP BY m."id"
  HAVING COUNT(*) = 1
)
UPDATE "CommunicationMessage" m
SET "profileKey" = ppm."personKey"
FROM person_phone_matches ppm
WHERE m."id" = ppm."messageId";
