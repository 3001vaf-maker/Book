BEGIN;

INSERT INTO "Capability" (
  "id","key","groupKey","name","description","valueType",
  "defaultEnabled","defaultLimit","position","isActive","createdAt","updatedAt"
) VALUES
  ('cap_workplaces_access','workplaces.access','profile','Рабочие пространства','','BOOLEAN',false,NULL,10,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cap_finance_cash_access','finance.cash.access','finance','Касса','','BOOLEAN',false,NULL,40,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cap_finance_dds_access','finance.dds.access','finance','ДДС','','BOOLEAN',false,NULL,50,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cap_finance_income_expense_access','finance.income_expense.access','finance','Доход / Расход','','BOOLEAN',false,NULL,60,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cap_finance_articles_access','finance.articles.access','finance','Статьи','','BOOLEAN',false,NULL,70,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cap_finance_special_access','finance.special.access','finance','Прочие операции','','BOOLEAN',false,NULL,80,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cap_finance_z_report_access','finance.z_report.access','finance','Z-отчёт','','BOOLEAN',false,NULL,90,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cap_journal_day_access','journal.day.access','journal','День','','BOOLEAN',false,NULL,100,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cap_journal_month_access','journal.month.access','journal','Месяц','','BOOLEAN',false,NULL,110,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cap_journal_list_access','journal.list.access','journal','Список','','BOOLEAN',false,NULL,120,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "groupKey" = EXCLUDED."groupKey",
  "name" = EXCLUDED."name",
  "valueType" = EXCLUDED."valueType",
  "position" = EXCLUDED."position",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanCapability" (
  "id","planId","capabilityId","enabled","limit","createdAt","updatedAt"
)
SELECT
  'pc_' || replace(p."key", '-', '_') || '_workplaces_access',
  p."id",
  tool."id",
  CASE
    WHEN old."id" IS NULL THEN false
    WHEN old."limit" IS NULL THEN true
    WHEN old."limit" > 0 THEN true
    ELSE false
  END,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Plan" p
CROSS JOIN "Capability" tool
LEFT JOIN "Capability" old_cap ON old_cap."key" = 'workplaces.max'
LEFT JOIN "PlanCapability" old ON old."planId" = p."id" AND old."capabilityId" = old_cap."id"
WHERE tool."key" = 'workplaces.access'
ON CONFLICT ("planId","capabilityId") DO NOTHING;

INSERT INTO "PlanCapability" (
  "id","planId","capabilityId","enabled","limit","createdAt","updatedAt"
)
SELECT
  'pc_' || replace(p."key", '-', '_') || '_' || replace(replace(tool."key", '.', '_'), '-', '_'),
  p."id",
  tool."id",
  COALESCE(old."enabled", false),
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Plan" p
JOIN "Capability" tool ON tool."key" IN (
  'finance.cash.access',
  'finance.dds.access',
  'finance.income_expense.access',
  'finance.articles.access',
  'finance.special.access',
  'finance.z_report.access'
)
LEFT JOIN "Capability" old_cap ON old_cap."key" = 'finance.access'
LEFT JOIN "PlanCapability" old ON old."planId" = p."id" AND old."capabilityId" = old_cap."id"
ON CONFLICT ("planId","capabilityId") DO NOTHING;

INSERT INTO "PlanCapability" (
  "id","planId","capabilityId","enabled","limit","createdAt","updatedAt"
)
SELECT
  'pc_' || replace(p."key", '-', '_') || '_' || replace(replace(tool."key", '.', '_'), '-', '_'),
  p."id",
  tool."id",
  COALESCE(old."enabled", false),
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Plan" p
JOIN "Capability" tool ON tool."key" IN (
  'journal.day.access',
  'journal.month.access',
  'journal.list.access'
)
LEFT JOIN "Capability" old_cap ON old_cap."key" = 'journal.access'
LEFT JOIN "PlanCapability" old ON old."planId" = p."id" AND old."capabilityId" = old_cap."id"
ON CONFLICT ("planId","capabilityId") DO NOTHING;

COMMIT;
