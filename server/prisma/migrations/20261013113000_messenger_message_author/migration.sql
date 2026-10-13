ALTER TABLE "CommunicationMessage"
  ADD COLUMN IF NOT EXISTS "authorParticipantId" TEXT;

DO $$ BEGIN
  ALTER TABLE "CommunicationMessage"
    ADD CONSTRAINT "CommunicationMessage_authorParticipantId_fkey"
    FOREIGN KEY ("authorParticipantId") REFERENCES "MessengerParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CommunicationMessage_author_idx"
ON "CommunicationMessage" ("authorParticipantId", "createdAt" DESC);

UPDATE "CommunicationMessage" m
SET "authorParticipantId" = p."id"
FROM "MessengerParticipant" p
WHERE m."conversationId" = p."conversationId"
  AND m."authorParticipantId" IS NULL
  AND (
    (m."direction" = 'outbound' AND p."kind" = 'PROFESSIONAL')
    OR (m."direction" = 'inbound' AND p."kind" = 'PERSON')
  );
