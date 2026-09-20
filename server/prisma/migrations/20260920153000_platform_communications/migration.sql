CREATE TABLE "PlatformCommunication" (
  "id" TEXT NOT NULL,
  "createdByAdminId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "recipientPlatformAccountId" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'EMAIL',
  "purpose" TEXT NOT NULL DEFAULT 'SERVICE',
  "recipientEmail" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL DEFAULT '',
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'created',
  "externalMessageId" TEXT NOT NULL DEFAULT '',
  "error" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),

  CONSTRAINT "PlatformCommunication_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformCommunication_createdByAdminId_fkey"
    FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlatformCommunication_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlatformCommunication_recipientPlatformAccountId_fkey"
    FOREIGN KEY ("recipientPlatformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlatformCommunication_channel_check" CHECK ("channel" = 'EMAIL'),
  CONSTRAINT "PlatformCommunication_purpose_check" CHECK ("purpose" = 'SERVICE'),
  CONSTRAINT "PlatformCommunication_status_check" CHECK ("status" IN ('created', 'sent', 'failed'))
);

CREATE INDEX "PlatformCommunication_tenantId_createdAt_idx"
  ON "PlatformCommunication"("tenantId", "createdAt" DESC);

CREATE INDEX "PlatformCommunication_recipientPlatformAccountId_createdAt_idx"
  ON "PlatformCommunication"("recipientPlatformAccountId", "createdAt" DESC);

CREATE INDEX "PlatformCommunication_createdByAdminId_createdAt_idx"
  ON "PlatformCommunication"("createdByAdminId", "createdAt" DESC);
