ALTER TABLE "NotificationRoutingPolicy"
  ADD COLUMN "titleTemplate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "bodyTemplate" TEXT NOT NULL DEFAULT '';
