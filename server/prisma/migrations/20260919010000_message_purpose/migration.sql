ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "purpose" TEXT;

ALTER TABLE "CommunicationMessage"
ADD COLUMN IF NOT EXISTS "purpose" TEXT;

UPDATE "Notification"
SET "purpose" = 'SERVICE'
WHERE "purpose" IS NULL
  AND "type" = 'booking.created';

UPDATE "CommunicationMessage"
SET "purpose" = 'DIRECT'
WHERE "purpose" IS NULL
  AND "direction" = 'inbound';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Notification_purpose_check'
  ) THEN
    ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_purpose_check"
    CHECK ("purpose" IS NULL OR "purpose" IN ('SYSTEM', 'SERVICE', 'DIRECT', 'MARKETING'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CommunicationMessage_purpose_check'
  ) THEN
    ALTER TABLE "CommunicationMessage"
    ADD CONSTRAINT "CommunicationMessage_purpose_check"
    CHECK ("purpose" IS NULL OR "purpose" IN ('SYSTEM', 'SERVICE', 'DIRECT', 'MARKETING'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_tenant_purpose_createdAt_idx"
ON "Notification"("tenantId", "purpose", "createdAt");

CREATE INDEX IF NOT EXISTS "CommunicationMessage_tenant_purpose_createdAt_idx"
ON "CommunicationMessage"("tenantId", "purpose", "createdAt");
