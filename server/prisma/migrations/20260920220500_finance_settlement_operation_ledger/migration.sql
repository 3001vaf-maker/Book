CREATE TABLE "FinanceSettlement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceSettlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceOperation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "originalOperationId" TEXT NOT NULL DEFAULT '',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceLedgerEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "financeOperationId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "economicType" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceSettlement_tenantId_sourceType_sourceId_key"
ON "FinanceSettlement"("tenantId", "sourceType", "sourceId");
CREATE INDEX "FinanceSettlement_tenantId_sourceType_idx"
ON "FinanceSettlement"("tenantId", "sourceType");

CREATE UNIQUE INDEX "FinanceOperation_tenantId_operationId_key"
ON "FinanceOperation"("tenantId", "operationId");
CREATE INDEX "FinanceOperation_tenantId_sourceType_sourceId_idx"
ON "FinanceOperation"("tenantId", "sourceType", "sourceId");
CREATE INDEX "FinanceOperation_tenantId_occurredAt_idx"
ON "FinanceOperation"("tenantId", "occurredAt");

CREATE UNIQUE INDEX "FinanceLedgerEntry_tenantId_entryId_key"
ON "FinanceLedgerEntry"("tenantId", "entryId");
CREATE INDEX "FinanceLedgerEntry_tenantId_walletId_occurredAt_idx"
ON "FinanceLedgerEntry"("tenantId", "walletId", "occurredAt");
CREATE INDEX "FinanceLedgerEntry_tenantId_sourceType_sourceId_idx"
ON "FinanceLedgerEntry"("tenantId", "sourceType", "sourceId");
CREATE INDEX "FinanceLedgerEntry_financeOperationId_idx"
ON "FinanceLedgerEntry"("financeOperationId");

ALTER TABLE "FinanceSettlement"
ADD CONSTRAINT "FinanceSettlement_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceOperation"
ADD CONSTRAINT "FinanceOperation_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceLedgerEntry"
ADD CONSTRAINT "FinanceLedgerEntry_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceLedgerEntry"
ADD CONSTRAINT "FinanceLedgerEntry_financeOperationId_fkey"
FOREIGN KEY ("financeOperationId") REFERENCES "FinanceOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
