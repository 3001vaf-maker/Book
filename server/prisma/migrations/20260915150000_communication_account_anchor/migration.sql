ALTER TABLE "CommunicationIdentity"
ADD COLUMN "bookingAccountId" TEXT;

CREATE INDEX "CommunicationIdentity_tenantId_bookingAccountId_channel_idx"
ON "CommunicationIdentity"("tenantId", "bookingAccountId", "channel");

ALTER TABLE "CommunicationIdentity"
ADD CONSTRAINT "CommunicationIdentity_bookingAccountId_fkey"
FOREIGN KEY ("bookingAccountId") REFERENCES "BookingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH phone_matches AS (
  SELECT
    ci."id" AS identity_id,
    ba."id" AS account_id,
    COUNT(*) OVER (PARTITION BY ci."id") AS match_count
  FROM "CommunicationIdentity" ci
  JOIN "BookingAccount" ba
    ON ba."tenantId" = ci."tenantId"
   AND regexp_replace(ba."phone", '[^0-9]', '', 'g') <> ''
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
       WHEN length(regexp_replace(ci."cardPhone", '[^0-9]', '', 'g')) = 10
         THEN '7' || regexp_replace(ci."cardPhone", '[^0-9]', '', 'g')
       WHEN length(regexp_replace(ci."cardPhone", '[^0-9]', '', 'g')) = 11
            AND left(regexp_replace(ci."cardPhone", '[^0-9]', '', 'g'), 1) = '8'
         THEN '7' || substring(regexp_replace(ci."cardPhone", '[^0-9]', '', 'g') from 2)
       ELSE regexp_replace(ci."cardPhone", '[^0-9]', '', 'g')
     END
   )
  WHERE ci."channel" = 'TELEGRAM'
)
UPDATE "CommunicationIdentity" ci
SET "bookingAccountId" = matches.account_id
FROM phone_matches matches
WHERE ci."id" = matches.identity_id
  AND matches.match_count = 1
  AND ci."bookingAccountId" IS NULL;
