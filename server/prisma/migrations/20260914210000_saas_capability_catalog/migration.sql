INSERT INTO "Capability" ("id", "key", "groupKey", "name", "description", "valueType", "defaultEnabled", "defaultLimit", "position", "isActive", "createdAt", "updatedAt") VALUES
  ('cap_profile_access', 'profile.access', 'start', 'Профиль', '', 'BOOLEAN', false, NULL, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_services_access', 'services.access', 'start', 'Услуги', '', 'BOOLEAN', false, NULL, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_clients_access', 'clients.access', 'clients', 'Клиенты', '', 'BOOLEAN', false, NULL, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_workplaces_max', 'workplaces.max', 'start', 'Количество рабочих пространств', '', 'LIMIT', false, NULL, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_timetable_access', 'timetable.access', 'work', 'График', '', 'BOOLEAN', false, NULL, 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_journal_access', 'journal.access', 'work', 'Журнал', '', 'BOOLEAN', false, NULL, 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_online_booking_access', 'online_booking.access', 'sales', 'Онлайн-запись', '', 'BOOLEAN', false, NULL, 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_payments_access', 'payments.access', 'sales', 'Оплаты', '', 'BOOLEAN', false, NULL, 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_finance_access', 'finance.access', 'finance', 'Финансы', '', 'BOOLEAN', false, NULL, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_chat_access', 'chat.access', 'communication', 'Чат', '', 'BOOLEAN', false, NULL, 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_notifications_access', 'notifications.access', 'communication', 'Уведомления', '', 'BOOLEAN', false, NULL, 110, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_integrations_access', 'integrations.access', 'settings', 'Интеграции', '', 'BOOLEAN', false, NULL, 120, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_documents_access', 'documents.access', 'settings', 'Документы', '', 'BOOLEAN', false, NULL, 130, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cap_tags_access', 'tags.access', 'settings', 'Ярлыки', '', 'BOOLEAN', false, NULL, 140, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "groupKey" = EXCLUDED."groupKey",
  "name" = EXCLUDED."name",
  "valueType" = EXCLUDED."valueType",
  "position" = EXCLUDED."position",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Plan" ("id", "key", "name", "description", "position", "isActive", "createdAt", "updatedAt")
VALUES ('plan_starter_clients', 'starter-clients', 'Старт: Клиенты', 'Профиль, услуги, клиенты и одно рабочее пространство', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "position" = EXCLUDED."position",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_profile', p."id", c."id", true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'profile.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = true, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_services', p."id", c."id", true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'services.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = true, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_clients', p."id", c."id", true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'clients.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = true, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_workplaces', p."id", c."id", NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'workplaces.max'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = NULL, "limit" = 1, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_timetable', p."id", c."id", false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'timetable.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = false, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_journal', p."id", c."id", false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'journal.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = false, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_booking', p."id", c."id", false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'online_booking.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = false, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_payments', p."id", c."id", false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'payments.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = false, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_finance', p."id", c."id", false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'finance.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = false, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_chat', p."id", c."id", false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'chat.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = false, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_notifications', p."id", c."id", false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'notifications.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = false, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_integrations', p."id", c."id", false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'integrations.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = false, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_documents', p."id", c."id", false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'documents.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = false, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" ("id", "planId", "capabilityId", "enabled", "limit", "createdAt", "updatedAt")
SELECT 'pc_starter_tags', p."id", c."id", false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Plan" p, "Capability" c WHERE p."key" = 'starter-clients' AND c."key" = 'tags.access'
ON CONFLICT ("planId", "capabilityId") DO UPDATE SET "enabled" = false, "limit" = NULL, "updatedAt" = CURRENT_TIMESTAMP;
