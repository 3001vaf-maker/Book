BEGIN;

INSERT INTO "Capability" (
  "id","key","groupKey","name","description","valueType",
  "defaultEnabled","defaultLimit","position","isActive","createdAt","updatedAt"
) VALUES
  ('cap_finance_investment_self_access','finance.investment.self.access','finance','Инвестиции · в себя','','BOOLEAN',false,NULL,82,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cap_finance_investment_raise_access','finance.investment.raise.access','finance','Инвестиции · привлекать','','BOOLEAN',false,NULL,84,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
  ('cap_finance_investment_external_access','finance.investment.external.access','finance','Инвестиции · инвестировать','','BOOLEAN',false,NULL,86,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
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
  'pc_' || replace(p."key", '-', '_') || '_' || replace(replace(tool."key", '.', '_'), '-', '_'),
  p."id",
  tool."id",
  COALESCE(old."enabled", false),
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Plan" p
JOIN "Capability" tool ON tool."key" IN (
  'finance.investment.self.access',
  'finance.investment.raise.access',
  'finance.investment.external.access'
)
LEFT JOIN "Capability" old_cap ON old_cap."key" = 'finance.special.access'
LEFT JOIN "PlanCapability" old ON old."planId" = p."id" AND old."capabilityId" = old_cap."id"
ON CONFLICT ("planId","capabilityId") DO NOTHING;

INSERT INTO "TenantCapabilityOverride" (
  "id","tenantId","capabilityId","enabled","limit","createdAt","updatedAt"
)
SELECT
  'tco_' || substr(md5(old."tenantId" || ':' || tool."key"), 1, 24),
  old."tenantId",
  tool."id",
  old."enabled",
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "TenantCapabilityOverride" old
JOIN "Capability" old_cap ON old_cap."id" = old."capabilityId" AND old_cap."key" = 'finance.special.access'
JOIN "Capability" tool ON tool."key" IN (
  'finance.investment.self.access',
  'finance.investment.raise.access',
  'finance.investment.external.access'
)
WHERE old."enabled" IS NOT NULL
ON CONFLICT ("tenantId","capabilityId") DO NOTHING;

COMMIT;
