ALTER TABLE "CommunicationIdentity" RENAME COLUMN "cardPhone" TO "personPhone";
ALTER TABLE "CommunicationMessage" RENAME COLUMN "cardPhone" TO "personPhone";
ALTER TABLE "CommunicationPreference" RENAME COLUMN "cardPhone" TO "personPhone";
ALTER TABLE "Notification" RENAME COLUMN "cardPhone" TO "personPhone";

ALTER INDEX IF EXISTS "CommunicationIdentity_tenantId_cardPhone_channel_idx"
  RENAME TO "CommunicationIdentity_tenantId_personPhone_channel_idx";
ALTER INDEX IF EXISTS "CommunicationMessage_tenantId_cardPhone_createdAt_idx"
  RENAME TO "CommunicationMessage_tenantId_personPhone_createdAt_idx";
ALTER INDEX IF EXISTS "CommunicationPreference_tenantId_cardPhone_key"
  RENAME TO "CommunicationPreference_tenantId_personPhone_key";
ALTER INDEX IF EXISTS "Notification_tenantId_cardPhone_createdAt_idx"
  RENAME TO "Notification_tenantId_personPhone_createdAt_idx";

UPDATE "CommunicationTemplate"
SET "body" = replace(
  replace(
    replace(
      replace(
        replace("body",
          '{{client.name}}', '{{person.name}}'),
        '{{client.surname}}', '{{person.surname}}'),
      '{{client.phone}}', '{{person.phone}}'),
    '{{client.email}}', '{{person.email}}'),
  '{{client.code}}', '{{person.code}}')
WHERE "body" LIKE '%{{client.%';
