CREATE TABLE "NotificationTemplateOverride" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
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

CREATE TABLE "NotificationReminderRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "minutesBefore" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationReminderRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationReminderRule_tenantId_minutesBefore_key"
    ON "NotificationReminderRule"("tenantId", "minutesBefore");

CREATE INDEX "NotificationReminderRule_tenantId_enabled_idx"
    ON "NotificationReminderRule"("tenantId", "enabled");

ALTER TABLE "NotificationReminderRule"
    ADD CONSTRAINT "NotificationReminderRule_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NotificationReminderDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "scheduleKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationReminderDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationReminderDelivery_schedule_key"
    ON "NotificationReminderDelivery"("tenantId", "recordId", "ruleId", "scheduleKey");

CREATE INDEX "NotificationReminderDelivery_tenantId_recordId_idx"
    ON "NotificationReminderDelivery"("tenantId", "recordId");

ALTER TABLE "NotificationReminderDelivery"
    ADD CONSTRAINT "NotificationReminderDelivery_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationReminderDelivery"
    ADD CONSTRAINT "NotificationReminderDelivery_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "NotificationReminderRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
