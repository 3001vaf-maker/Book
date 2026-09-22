BEGIN;

CREATE TABLE IF NOT EXISTS "PlatformPushSubscription" (
  "id" TEXT PRIMARY KEY,
  "platformAccountId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL UNIQUE,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformPushSubscription_platformAccountId_fkey"
    FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PlatformPushSubscription_account_idx"
  ON "PlatformPushSubscription"("platformAccountId","updatedAt");

COMMIT;
