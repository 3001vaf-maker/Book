CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key"
    ON "WebPushSubscription"("endpoint");

CREATE INDEX "WebPushSubscription_tenantId_accountId_idx"
    ON "WebPushSubscription"("tenantId", "accountId");

ALTER TABLE "WebPushSubscription"
    ADD CONSTRAINT "WebPushSubscription_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebPushSubscription"
    ADD CONSTRAINT "WebPushSubscription_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "BookingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
