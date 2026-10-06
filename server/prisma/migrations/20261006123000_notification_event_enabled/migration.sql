ALTER TABLE "NotificationRoutingPolicy"
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve events that were explicitly configured before enabled-state existed.
UPDATE "NotificationRoutingPolicy"
SET "enabled" = TRUE
WHERE "eventType" <> '__delivery__';
