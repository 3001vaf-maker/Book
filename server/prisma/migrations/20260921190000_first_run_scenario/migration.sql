BEGIN;

ALTER TABLE "TenantAccess"
  ADD COLUMN IF NOT EXISTS "commercialMode" TEXT NOT NULL DEFAULT 'DEMO',
  ADD COLUMN IF NOT EXISTS "demoActivatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "demoExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "demoExtendedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantAccess_commercialMode_check') THEN
    ALTER TABLE "TenantAccess"
      ADD CONSTRAINT "TenantAccess_commercialMode_check"
      CHECK ("commercialMode" IN ('DEMO', 'LIVE'));
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"TenantInvitation"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "TenantInvitation"
      ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "demoExpiresAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "firstRunScenarioVersionId" TEXT';
  ELSIF to_regclass('"MasterInvitation"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "MasterInvitation"
      ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "demoExpiresAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "firstRunScenarioVersionId" TEXT';
  ELSE
    RAISE EXCEPTION 'Invitation table is missing';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "FirstRunScenario" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "FirstRunScenarioVersion" (
  "id" TEXT PRIMARY KEY,
  "scenarioId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FirstRunScenarioVersion_scenarioId_fkey"
    FOREIGN KEY ("scenarioId") REFERENCES "FirstRunScenario"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FirstRunScenarioVersion_status_check"
    CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "FirstRunScenarioVersion_scenario_version_key"
  ON "FirstRunScenarioVersion"("scenarioId", "version");
CREATE INDEX IF NOT EXISTS "FirstRunScenarioVersion_scenario_status_idx"
  ON "FirstRunScenarioVersion"("scenarioId", "status", "publishedAt");

CREATE TABLE IF NOT EXISTS "FirstRunStep" (
  "id" TEXT PRIMARY KEY,
  "scenarioVersionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "modalTitle" TEXT NOT NULL,
  "modalBody" TEXT NOT NULL,
  "primaryLabel" TEXT NOT NULL DEFAULT 'Далее',
  "skipLabel" TEXT NOT NULL DEFAULT 'Пропустить',
  "route" TEXT NOT NULL DEFAULT '',
  "target" TEXT NOT NULL DEFAULT '',
  "completionKey" TEXT NOT NULL DEFAULT '',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FirstRunStep_scenarioVersionId_fkey"
    FOREIGN KEY ("scenarioVersionId") REFERENCES "FirstRunScenarioVersion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FirstRunStep_kind_check"
    CHECK ("kind" IN ('REQUIRED_ACTION', 'REQUIRED_INFO', 'OPTIONAL_INFO', 'SYSTEM'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "FirstRunStep_version_key_key"
  ON "FirstRunStep"("scenarioVersionId", "key");
CREATE INDEX IF NOT EXISTS "FirstRunStep_version_position_idx"
  ON "FirstRunStep"("scenarioVersionId", "position");

CREATE TABLE IF NOT EXISTS "FirstRunProgress" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "platformAccountId" TEXT NOT NULL,
  "scenarioVersionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "currentStepKey" TEXT NOT NULL DEFAULT '',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FirstRunProgress_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FirstRunProgress_scenarioVersionId_fkey"
    FOREIGN KEY ("scenarioVersionId") REFERENCES "FirstRunScenarioVersion"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FirstRunProgress_status_check"
    CHECK ("status" IN ('IN_PROGRESS', 'COMPLETED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "FirstRunProgress_tenant_account_key"
  ON "FirstRunProgress"("tenantId", "platformAccountId");
CREATE INDEX IF NOT EXISTS "FirstRunProgress_version_status_idx"
  ON "FirstRunProgress"("scenarioVersionId", "status");
CREATE INDEX IF NOT EXISTS "FirstRunProgress_account_updated_idx"
  ON "FirstRunProgress"("platformAccountId", "updatedAt");

CREATE TABLE IF NOT EXISTS "FirstRunStepProgress" (
  "id" TEXT PRIMARY KEY,
  "progressId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "modalSeenAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "skippedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FirstRunStepProgress_progressId_fkey"
    FOREIGN KEY ("progressId") REFERENCES "FirstRunProgress"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FirstRunStepProgress_stepId_fkey"
    FOREIGN KEY ("stepId") REFERENCES "FirstRunStep"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FirstRunStepProgress_status_check"
    CHECK ("status" IN ('NOT_STARTED', 'ACTIVE', 'COMPLETED', 'SKIPPED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "FirstRunStepProgress_progress_step_key"
  ON "FirstRunStepProgress"("progressId", "stepId");
CREATE INDEX IF NOT EXISTS "FirstRunStepProgress_progress_status_idx"
  ON "FirstRunStepProgress"("progressId", "status");

CREATE TABLE IF NOT EXISTS "PlatformSession" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "platformAccountId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "endReason" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PlatformSession_tenant_started_idx"
  ON "PlatformSession"("tenantId", "startedAt");
CREATE INDEX IF NOT EXISTS "PlatformSession_account_started_idx"
  ON "PlatformSession"("platformAccountId", "startedAt");
CREATE INDEX IF NOT EXISTS "PlatformSession_end_lastSeen_idx"
  ON "PlatformSession"("endedAt", "lastSeenAt");

CREATE TABLE IF NOT EXISTS "PlatformActivityEvent" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "platformAccountId" TEXT,
  "sessionId" TEXT,
  "eventType" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL DEFAULT '',
  "scenarioVersionId" TEXT NOT NULL DEFAULT '',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformActivityEvent_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlatformActivityEvent_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "PlatformSession"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

DO $$
DECLARE
  account_table TEXT;
BEGIN
  IF to_regclass('"PlatformAccount"') IS NOT NULL THEN
    account_table := '"PlatformAccount"';
  ELSIF to_regclass('"User"') IS NOT NULL THEN
    account_table := '"User"';
  ELSE
    RAISE EXCEPTION 'Platform account table is missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FirstRunProgress_platformAccountId_fkey') THEN
    EXECUTE format(
      'ALTER TABLE "FirstRunProgress" ADD CONSTRAINT "FirstRunProgress_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES %s("id") ON DELETE CASCADE ON UPDATE CASCADE',
      account_table
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformSession_platformAccountId_fkey') THEN
    EXECUTE format(
      'ALTER TABLE "PlatformSession" ADD CONSTRAINT "PlatformSession_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES %s("id") ON DELETE CASCADE ON UPDATE CASCADE',
      account_table
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformActivityEvent_platformAccountId_fkey') THEN
    EXECUTE format(
      'ALTER TABLE "PlatformActivityEvent" ADD CONSTRAINT "PlatformActivityEvent_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES %s("id") ON DELETE SET NULL ON UPDATE CASCADE',
      account_table
    );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "PlatformActivityEvent_tenant_occurred_idx"
  ON "PlatformActivityEvent"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "PlatformActivityEvent_account_occurred_idx"
  ON "PlatformActivityEvent"("platformAccountId", "occurredAt");
CREATE INDEX IF NOT EXISTS "PlatformActivityEvent_type_occurred_idx"
  ON "PlatformActivityEvent"("eventType", "occurredAt");

CREATE TABLE IF NOT EXISTS "TenantCapabilityOrder" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "capabilityId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantCapabilityOrder_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "TenantAccess"("tenantId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TenantCapabilityOrder_capabilityId_fkey"
    FOREIGN KEY ("capabilityId") REFERENCES "Capability"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantCapabilityOrder_tenant_capability_key"
  ON "TenantCapabilityOrder"("tenantId", "capabilityId");
CREATE INDEX IF NOT EXISTS "TenantCapabilityOrder_tenant_position_idx"
  ON "TenantCapabilityOrder"("tenantId", "position");
CREATE INDEX IF NOT EXISTS "TenantCapabilityOrder_capability_idx"
  ON "TenantCapabilityOrder"("capabilityId");

INSERT INTO "FirstRunScenario" ("id","key","title","isActive","createdAt","updatedAt")
VALUES ('first-run-default','first-run','Первое знакомство',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "title"=EXCLUDED."title","isActive"=true,"updatedAt"=CURRENT_TIMESTAMP;

INSERT INTO "FirstRunScenarioVersion" ("id","scenarioId","version","status","publishedAt","createdAt","updatedAt")
VALUES ('first-run-default-v1','first-run-default',1,'PUBLISHED',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("scenarioId","version") DO NOTHING;

INSERT INTO "FirstRunStep"
("id","scenarioVersionId","key","position","kind","title","modalTitle","modalBody","primaryLabel","skipLabel","route","target","completionKey","metadata","isActive")
VALUES
('frs-v1-profile','first-run-default-v1','profile',10,'REQUIRED_ACTION','Профиль','Профиль','Заполните обязательные личные, контактные и профессиональные данные. Эти сведения помогают системе корректно формировать ваш профиль. Добавьте минимум одно рабочее пространство — оно понадобится для дальнейшей настройки.','Перейти дальше','', 'profile','', 'profile.ready','{"phase":"focused"}',true),
('frs-v1-procedures','first-run-default-v1','procedures',20,'REQUIRED_ACTION','Услуги','Услуги','Создайте минимум одну услугу. Она понадобится, чтобы позже пройти полный сценарий записи и увидеть результат операции.','Далее','', 'procedures','[data-add-procedure]','procedures.ready','{"phase":"focused"}',true),
('frs-v1-products','first-run-default-v1','products',30,'OPTIONAL_INFO','Товары','Товары','Если вы продаёте какие-либо товары, их можно добавить здесь. Если товары вам не нужны, этот этап можно пропустить.','Применить','Пропустить','products','[data-add-product]','products.viewed','{"phase":"focused"}',true),
('frs-v1-online-booking','first-run-default-v1','online-booking',40,'OPTIONAL_INFO','Онлайн-запись','Онлайн-запись','Здесь настраивается онлайн-запись. В реальной работе ссылку можно будет передавать людям для самостоятельного выбора услуги и времени. Во время ознакомления не используйте реальные персональные данные и не распространяйте ссылку как рабочую. Сейчас последовательно посмотрите её настройки.','Понятно','Пропустить','settings','[data-settings-open="online-booking"]','online-booking.viewed','{"phase":"settings"}',true),
('frs-v1-online-booking-welcome','first-run-default-v1','online-booking-welcome',41,'OPTIONAL_INFO','Приветствие онлайн-записи','Приветствие','Здесь задаются заголовок и текст, которые человек увидит при открытии вашей онлайн-записи. Изменять их сейчас необязательно.','Понятно','Пропустить','online-booking','welcome','online-booking.welcome-viewed','{"phase":"settings"}',true),
('frs-v1-online-booking-appearance','first-run-default-v1','online-booking-appearance',42,'OPTIONAL_INFO','Внешний вид онлайн-записи','Внешний вид','Здесь настраивается внешний вид страницы онлайн-записи. Посмотрите доступные параметры оформления.','Понятно','Пропустить','online-booking','appearance','online-booking.appearance-viewed','{"phase":"settings"}',true),
('frs-v1-online-booking-time','first-run-default-v1','online-booking-time',43,'OPTIONAL_INFO','Время онлайн-записи','Время записи','Здесь задаётся шаг доступного времени: как часто человеку показываются возможные начала записи. Длительность услуг при этом не меняется.','Понятно','Пропустить','online-booking','time','online-booking.time-viewed','{"phase":"settings"}',true),
('frs-v1-notifications','first-run-default-v1','notifications',50,'OPTIONAL_INFO','Уведомления','Уведомления','Здесь настраиваются уведомления и доступные внешние каналы. Позже вы сможете выбрать, какие сервисные события и по каким подключённым каналам отправлять.','Понятно','Пропустить','settings','[data-settings-open="communications"]','notifications.viewed','{"phase":"settings"}',true),
('frs-v1-integrations','first-run-default-v1','integrations',60,'OPTIONAL_INFO','Интеграции','Интеграции','Здесь подключаются дополнительные внешние инструменты. Подключать их во время первого знакомства необязательно.','Понятно','Пропустить','settings','[data-settings-open="integrations"]','integrations.viewed','{"phase":"settings"}',true),
('frs-v1-tags','first-run-default-v1','tags',70,'OPTIONAL_INFO','Ярлыки','Ярлыки','Ярлыки помогают группировать и быстрее находить данные там, где такая группировка предусмотрена. Вы можете попробовать создать ярлык или пропустить этот этап.','Применить','Пропустить','settings','[data-settings-open="tags"]','tags.viewed','{"phase":"settings"}',true),
('frs-v1-documents','first-run-default-v1','documents',80,'REQUIRED_INFO','Документы','Документы и персональные данные','Здесь хранятся документы, их версии и история действий. Перед реальной работой с персональными данными важно определить законные основания обработки. Здесь же система впервые предлагает помощь с уведомлением Роскомнадзора и персональную PDF-инструкцию. Рекламное согласие является отдельным и понадобится только для соответствующих маркетинговых отправок.','Далее','', 'settings','[data-settings-open="documents"]','documents.acknowledged','{"phase":"settings","rknGuide":true}',true),
('frs-v1-people','first-run-default-v1','people',90,'REQUIRED_ACTION','Люди','Учебный человек','Не вводите реальные персональные данные во время учебного сценария. Создайте вымышленного человека, чтобы пройти запись и оплату без использования реальных данных.','Далее','', 'main.people','[data-open-people]','people.demo-created','{"phase":"workspace","demoData":true}',true),
('frs-v1-timetable','first-run-default-v1','timetable',100,'REQUIRED_ACTION','График','График','Создайте минимум один рабочий день. Для более полного знакомства можно настроить график на более длительный период.','Далее','', 'timetable','[data-nav="timetable"]','timetable.day-created','{"phase":"workspace"}',true),
('frs-v1-journal-record','first-run-default-v1','journal-record',110,'REQUIRED_ACTION','Запись','Создайте учебную запись','Выберите время, созданного учебного человека и услугу, затем создайте запись. Так вы пройдёте основной рабочий сценарий системы.','Далее','', 'journal','[data-nav="journal"]','record.demo-created','{"phase":"workspace","demoData":true}',true),
('frs-v1-payment','first-run-default-v1','payment',120,'REQUIRED_ACTION','Оплата','Проведите учебную оплату','Проведите оплату по созданной учебной записи. После успешной оплаты обязательная практическая часть знакомства будет завершена.','Далее','', 'journal','', 'payment.demo-completed','{"phase":"workspace","demoData":true}',true),
('frs-v1-journal-month','first-run-default-v1','journal-month',130,'OPTIONAL_INFO','Месяц','Месяц','Откройте представление «Месяц», чтобы увидеть созданную запись в календаре и понять общую загрузку периода.','Понятно','Пропустить','journal','[data-view="month"]','journal.month-viewed','{"phase":"workspace"}',true),
('frs-v1-journal-list','first-run-default-v1','journal-list',140,'OPTIONAL_INFO','Список','Список','Откройте «Список», чтобы увидеть историю записей в списочном представлении. После первого ознакомления подсветка этого шага больше не нужна.','Понятно','Пропустить','journal','[data-view="list"]','journal.list-viewed','{"phase":"workspace"}',true),
('frs-v1-chat','first-run-default-v1','chat',150,'OPTIONAL_INFO','Чат','Чат','Здесь находится общение с людьми. Во время учебного сценария реальные внешние сообщения недоступны. В реальной работе возможности чата зависят от подключённых инструментов и разрешений.','Понятно','Пропустить','chat','[data-nav="chat"]','chat.viewed','{"phase":"workspace","externalBlockedInDemo":true}',true),
('frs-v1-finance-overview','first-run-default-v1','finance-overview',160,'REQUIRED_INFO','Финансы','Результат операции','Откройте финансы и посмотрите, как учебная оплата отразилась в денежных показателях. Это связывает запись, оплату и финансовый результат в одну цепочку.','Далее','', 'main.finance','[data-open-finance]','finance.result-viewed','{"phase":"workspace"}',true),
('frs-v1-finance-cash','first-run-default-v1','finance-cash',161,'OPTIONAL_INFO','Касса и кошельки','Касса и кошельки','Здесь видны кошельки и остатки. Создавать новый кошелёк во время знакомства необязательно.','Понятно','Пропустить','finance','[data-finance-cash]','finance.cash-viewed','{"phase":"workspace"}',true),
('frs-v1-finance-dds','first-run-default-v1','finance-dds',162,'OPTIONAL_INFO','Движение денежных средств','Движение денежных средств','Здесь находится история движения денег. Учебная оплата уже должна быть видна среди финансовых операций.','Понятно','Пропустить','finance','[data-finance-dds]','finance.dds-viewed','{"phase":"workspace"}',true),
('frs-v1-finance-income-expense','first-run-default-v1','finance-income-expense',163,'OPTIONAL_INFO','Доходы и расходы','Доходы и расходы','Здесь можно отдельно работать с доходами и расходами и видеть их структуру.','Понятно','Пропустить','finance','[data-finance-income-expense]','finance.income-expense-viewed','{"phase":"workspace"}',true),
('frs-v1-finance-articles','first-run-default-v1','finance-articles',164,'OPTIONAL_INFO','Статьи','Статьи','Статьи помогают распределять финансовые операции по понятным категориям.','Понятно','Пропустить','finance','[data-finance-articles]','finance.articles-viewed','{"phase":"workspace"}',true),
('frs-v1-finance-special','first-run-default-v1','finance-special',165,'OPTIONAL_INFO','Прочие операции','Прочие операции','Здесь находятся переводы, займы, инвестиции и другие операции, которые не являются обычной оплатой записи.','Понятно','Пропустить','finance','[data-finance-special]','finance.special-viewed','{"phase":"workspace"}',true),
('frs-v1-finance-report','first-run-default-v1','finance-report',166,'OPTIONAL_INFO','Отчёты','Отчёты','Здесь можно посмотреть итоговый финансовый результат за выбранный период.','Понятно','Пропустить','finance','[data-finance-z-report]','finance.report-viewed','{"phase":"workspace"}',true),
('frs-v1-complete','first-run-default-v1','complete',180,'SYSTEM','Завершение','Основные возможности изучены','Основная цепочка знакомства завершена. Вы можете продолжать пользоваться DEMO до окончания доступного срока или перейти к реальной работе, когда это будет доступно для вашего рабочего пространства.','Продолжить','', 'main','', 'first-run.complete','{"phase":"workspace"}',true)
ON CONFLICT ("scenarioVersionId","key") DO NOTHING;

DO $$
DECLARE
  invitation_table TEXT;
BEGIN
  IF to_regclass('"TenantInvitation"') IS NOT NULL THEN
    invitation_table := '"TenantInvitation"';
  ELSIF to_regclass('"MasterInvitation"') IS NOT NULL THEN
    invitation_table := '"MasterInvitation"';
  ELSE
    RAISE EXCEPTION 'Invitation table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TenantInvitation_firstRunScenarioVersionId_fkey'
  ) THEN
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT "TenantInvitation_firstRunScenarioVersionId_fkey" FOREIGN KEY ("firstRunScenarioVersionId") REFERENCES "FirstRunScenarioVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE',
      invitation_table
    );
  END IF;
END
$$;

COMMIT;
