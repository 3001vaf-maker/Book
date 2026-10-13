CREATE TABLE IF NOT EXISTS "MessengerConversation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'DIRECT',
  "title" TEXT NOT NULL DEFAULT '',
  "personPhone" TEXT NOT NULL DEFAULT '',
  "uei" TEXT NOT NULL DEFAULT '',
  "archivedAt" TIMESTAMP(3),
  "mutedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessengerConversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessengerConversation_direct_identity_key"
ON "MessengerConversation" ("tenantId", COALESCE(NULLIF("uei", ''), NULLIF("personPhone", '')))
WHERE "type" = 'DIRECT' AND ("uei" <> '' OR "personPhone" <> '');

CREATE INDEX IF NOT EXISTS "MessengerConversation_tenant_updated_idx"
ON "MessengerConversation" ("tenantId", "updatedAt" DESC);

CREATE TABLE IF NOT EXISTS "MessengerParticipant" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "refId" TEXT NOT NULL DEFAULT '',
  "display" TEXT NOT NULL DEFAULT '',
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "MessengerParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessengerParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "MessengerConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessengerParticipant_identity_key"
ON "MessengerParticipant" ("conversationId", "kind", "refId");
CREATE INDEX IF NOT EXISTS "MessengerParticipant_conversation_idx"
ON "MessengerParticipant" ("conversationId", "joinedAt");

ALTER TABLE "CommunicationMessage"
  ADD COLUMN IF NOT EXISTS "conversationId" TEXT,
  ADD COLUMN IF NOT EXISTS "replyToId" TEXT,
  ADD COLUMN IF NOT EXISTS "forwardedFromId" TEXT,
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reactions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "poll" JSONB;

DO $$ BEGIN
  ALTER TABLE "CommunicationMessage"
    ADD CONSTRAINT "CommunicationMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "MessengerConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CommunicationMessage"
    ADD CONSTRAINT "CommunicationMessage_replyToId_fkey"
    FOREIGN KEY ("replyToId") REFERENCES "CommunicationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CommunicationMessage"
    ADD CONSTRAINT "CommunicationMessage_forwardedFromId_fkey"
    FOREIGN KEY ("forwardedFromId") REFERENCES "CommunicationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CommunicationMessage_conversation_created_idx"
ON "CommunicationMessage" ("conversationId", "createdAt", "id");
CREATE INDEX IF NOT EXISTS "CommunicationMessage_search_idx"
ON "CommunicationMessage" ("tenantId", "createdAt" DESC);

INSERT INTO "MessengerConversation" ("id", "tenantId", "type", "personPhone", "uei", "createdAt", "updatedAt")
SELECT md5(m."tenantId" || ':direct:' || COALESCE(NULLIF(m."uei", ''), m."personPhone")),
       m."tenantId", 'DIRECT',
       COALESCE(MAX(NULLIF(m."personPhone", '')), ''),
       COALESCE(MAX(NULLIF(m."uei", '')), ''),
       MIN(m."createdAt"), MAX(m."createdAt")
FROM "CommunicationMessage" m
WHERE m."personPhone" <> '' OR m."uei" <> ''
GROUP BY m."tenantId", COALESCE(NULLIF(m."uei", ''), m."personPhone")
ON CONFLICT DO NOTHING;

UPDATE "CommunicationMessage" m
SET "conversationId" = c."id"
FROM "MessengerConversation" c
WHERE m."conversationId" IS NULL
  AND c."tenantId" = m."tenantId"
  AND c."type" = 'DIRECT'
  AND (
    (m."uei" <> '' AND c."uei" = m."uei")
    OR (m."uei" = '' AND m."personPhone" <> '' AND c."personPhone" = m."personPhone")
  );

INSERT INTO "MessengerParticipant" ("id", "conversationId", "kind", "refId", "display", "role")
SELECT md5(c."id" || ':professional'), c."id", 'PROFESSIONAL', c."tenantId", '', 'OWNER'
FROM "MessengerConversation" c
ON CONFLICT DO NOTHING;

INSERT INTO "MessengerParticipant" ("id", "conversationId", "kind", "refId", "display", "role")
SELECT md5(c."id" || ':person:' || COALESCE(NULLIF(c."uei", ''), c."personPhone")), c."id", 'PERSON',
       COALESCE(NULLIF(c."uei", ''), c."personPhone"), '', 'MEMBER'
FROM "MessengerConversation" c
WHERE c."uei" <> '' OR c."personPhone" <> ''
ON CONFLICT DO NOTHING;
