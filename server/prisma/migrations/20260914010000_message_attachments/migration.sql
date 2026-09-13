ALTER TABLE "CommunicationMessage"
ADD COLUMN "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb;
