CREATE TABLE "NotificationTemplateOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationTemplateOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationTemplateOverride_tenantId_templateKey_key"
    ON "NotificationTemplateOverride"("tenantId", "templateKey");

CREATE INDEX "NotificationTemplateOverride_tenantId_idx"
    ON "NotificationTemplateOverride"("tenantId");

ALTER TABLE "NotificationTemplateOverride"
    ADD CONSTRAINT "NotificationTemplateOverride_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
