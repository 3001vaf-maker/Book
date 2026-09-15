ALTER TABLE "CommunicationMessage"
ADD COLUMN "bookingAccountId" TEXT,
ADD COLUMN "content" JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}'::jsonb,
ADD COLUMN "editedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "CommunicationMessage"
ADD CONSTRAINT "CommunicationMessage_bookingAccountId_fkey"
FOREIGN KEY ("bookingAccountId") REFERENCES "BookingAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CommunicationMessage_tenantId_bookingAccountId_createdAt_idx"
ON "CommunicationMessage"("tenantId", "bookingAccountId", "createdAt");

-- Recover a stable account anchor from legacy messages only when the normalized phone is unique in the tenant.
WITH phone_matches AS (
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
  WHERE m."bookingAccountId" IS NULL
    AND m."channel" = 'IN_APP'
    AND m."cardPhone" <> ''
  GROUP BY m."id"
  HAVING COUNT(*) = 1
)
UPDATE "CommunicationMessage" m
SET "bookingAccountId" = phone_matches."accountId"
FROM phone_matches
WHERE m."id" = phone_matches."messageId";

-- If phone recovery was impossible, use a unique non-empty UEI as a conservative fallback.
WITH uei_matches AS (
  SELECT m."id" AS "messageId", MIN(ba."id") AS "accountId"
  FROM "CommunicationMessage" m
  JOIN "BookingAccount" ba
    ON ba."tenantId" = m."tenantId"
   AND ba."uei" <> ''
   AND ba."uei" = m."uei"
  WHERE m."bookingAccountId" IS NULL
    AND m."channel" = 'IN_APP'
    AND m."uei" <> ''
  GROUP BY m."id"
  HAVING COUNT(*) = 1
)
UPDATE "CommunicationMessage" m
SET "bookingAccountId" = uei_matches."accountId"
FROM uei_matches
WHERE m."id" = uei_matches."messageId";
