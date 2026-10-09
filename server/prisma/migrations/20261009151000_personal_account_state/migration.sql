-- Canonical server-owned Personal Account state.
-- Personal Account money never goes below zero. Debt is stored separately.

CREATE TABLE IF NOT EXISTS "LoyaltyPersonalAccount" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "personKey" TEXT NOT NULL,
  "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "spendLimitPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
  "visibleToEndUser" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyPersonalAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoyaltyPersonalAccount_balance_nonnegative" CHECK ("balance" >= 0),
  CONSTRAINT "LoyaltyPersonalAccount_spend_limit" CHECK ("spendLimitPercent" >= 0 AND "spendLimitPercent" <= 100),
  CONSTRAINT "LoyaltyPersonalAccount_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyPersonalAccount_tenant_person_key" ON "LoyaltyPersonalAccount"("tenantId", "personKey");
CREATE INDEX IF NOT EXISTS "LoyaltyPersonalAccount_tenant_updated_idx" ON "LoyaltyPersonalAccount"("tenantId", "updatedAt");

CREATE TABLE IF NOT EXISTS "LoyaltyPersonalAccountMovement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "personKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "balanceAfter" DECIMAL(14,2) NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "LoyaltyPersonalAccountMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoyaltyPersonalAccountMovement_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "LoyaltyPersonalAccountMovement_balance_nonnegative" CHECK ("balanceAfter" >= 0),
  CONSTRAINT "LoyaltyPersonalAccountMovement_direction" CHECK ("direction" IN ('IN', 'OUT')),
  CONSTRAINT "LoyaltyPersonalAccountMovement_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LoyaltyPersonalAccountMovement_person_time_idx" ON "LoyaltyPersonalAccountMovement"("tenantId", "personKey", "occurredAt");
CREATE INDEX IF NOT EXISTS "LoyaltyPersonalAccountMovement_source_idx" ON "LoyaltyPersonalAccountMovement"("tenantId", "sourceType", "sourceId");

CREATE TABLE IF NOT EXISTS "LoyaltyPersonalAccountDebt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "personKey" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "originalAmount" DECIMAL(14,2) NOT NULL,
  "outstandingAmount" DECIMAL(14,2) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyPersonalAccountDebt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoyaltyPersonalAccountDebt_amount_nonnegative" CHECK ("originalAmount" >= 0 AND "outstandingAmount" >= 0),
  CONSTRAINT "LoyaltyPersonalAccountDebt_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyPersonalAccountDebt_source_key" ON "LoyaltyPersonalAccountDebt"("tenantId", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "LoyaltyPersonalAccountDebt_person_time_idx" ON "LoyaltyPersonalAccountDebt"("tenantId", "personKey", "occurredAt");
