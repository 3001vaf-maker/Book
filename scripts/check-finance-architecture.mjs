import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', '_site']);
const errors = [];
const thisCheck = 'scripts/check-finance-architecture.mjs';

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) files.push(...walk(file));
    else if (/\.(?:js|mjs|ts)$/.test(name)) files.push(file);
  }
  return files;
}

function rel(file) {
  return relative(root, file).replaceAll('\\', '/');
}

function source(path) {
  return readFileSync(join(root, path), 'utf8');
}

function requireFile(path, message) {
  if (!existsSync(join(root, path))) errors.push(message || `${path} must exist`);
}

const forbiddenFiles = [
  'core/payment.js',
  'core/finance/model.js',
  'core/dds.js',
  'core/financial-model.js',
  'core/finance/financial-model.js',
];
for (const path of forbiddenFiles) {
  if (existsSync(join(root, path))) errors.push(`${path} must not exist`);
}

const obsoleteSettlementNames = /\b(?:calculateFinancialPlan|repriceFinancialPlan|calculateFinancialFact|calculateFinancialItemFact|calculateRecordPaymentState|getFinancialFactForRecords|getFinancialItemFact|getRecordFinancialPlanFact|resolveRecordFinancialPlan|recordPlanTotal|hydrateRecordFinance|normalizeRecordFinance|recordFinancialItems|isStoredFinancialPlan|normalizeStoredFinancialPlan)\b/;
for (const file of walk(root)) {
  const path = rel(file);
  if (path === thisCheck) continue;
  const text = readFileSync(file, 'utf8');
  if (obsoleteSettlementNames.test(text)) errors.push(`${path}: legacy Financial Model/plan API must use Settlement terminology`);
  if (/from\s+['"][^'"]*financial-model[^'"]*['"]/.test(text)) {
    errors.push(`${path}: Financial Model is reserved and cannot be an operational Finance dependency`);
  }
  if (/queueAuxiliaryDataset\(\s*['"]finance['"]/.test(text)) {
    errors.push(`${path}: Finance must not be written through auxiliary-state`);
  }
}

requireFile('core/finance/settlement.js');
requireFile('server/src/finance/finance.controller.ts');
requireFile('server/prisma/migrations/20260920220500_finance_settlement_operation_ledger/migration.sql');

const financeData = source('core/finance/data.js');
if (/business-persistence/.test(financeData) || /queueAuxiliaryDataset/.test(financeData)) {
  errors.push('core/finance/data.js must be a read cache only; canonical persistence is server Finance');
}
if (!/settlements:\s*\[\]/.test(financeData) || !/operations:\s*\[\]/.test(financeData) || !/ledger:\s*\[\]/.test(financeData)) {
  errors.push('core/finance/data.js must cache Settlement, Operation and flat Ledger state');
}

const financeService = source('core/finance/service.js');
for (const command of ['recordPaymentIncome', 'recordRefundExpense', 'cancelPaymentOperation']) {
  if (!new RegExp(`export\\s+async\\s+function\\s+${command}`).test(financeService)) {
    errors.push(`core/finance/service.js: ${command} must be an async server-backed command`);
  }
}
if (!/apiRequest\(['"]\/finance\/operations\/payment['"]/.test(financeService)) {
  errors.push('Payment must be sent to server /finance/operations/payment');
}
if (!/saveSettlementSnapshot/.test(financeService) || !/\/finance\/settlements\//.test(financeService)) {
  errors.push('Settlement persistence must go through the Finance API');
}
if (/writeFinanceState/.test(financeService)) errors.push('Browser Finance service must not persist money locally');

const auxiliaryServer = source('server/src/auxiliary-state/auxiliary-state.service.ts');
if (/DATASETS[^\n]*['"]finance['"]/.test(auxiliaryServer)) {
  errors.push('server auxiliary-state must not accept Finance writes after canonical Ledger migration');
}

const schema = source('server/prisma/schema.prisma');
for (const model of ['FinanceSettlement', 'FinanceOperation', 'FinanceLedgerEntry']) {
  if (!new RegExp(`model\\s+${model}\\s+\\{`).test(schema)) errors.push(`Prisma must define ${model}`);
}
if (!/Decimal\s+@db\.Decimal\(14, 2\)/.test(schema)) {
  errors.push('FinanceLedgerEntry.amount must use fixed decimal money storage');
}
if (!/@@unique\(\[tenantId, operationId\]\)/.test(schema)) {
  errors.push('FinanceOperation must have tenant-scoped operation identity');
}

const migration = source('server/prisma/migrations/20260920220500_finance_settlement_operation_ledger/migration.sql');
for (const table of ['FinanceSettlement', 'FinanceOperation', 'FinanceLedgerEntry']) {
  if (!migration.includes(`CREATE TABLE "${table}"`)) errors.push(`Finance migration must create ${table}`);
}

const financeController = source('server/src/finance/finance.controller.ts');
for (const route of [
  /@Get\(\)/,
  /@Put\(['"]settlements\/:sourceType\/:sourceId['"]\)/,
  /@Post\(['"]operations\/payment['"]\)/,
  /@Post\(['"]operations\/:operationId\/refund['"]\)/,
  /@Post\(['"]operations\/:operationId\/cancel['"]\)/,
]) {
  if (!route.test(financeController)) errors.push('FinanceController is missing a canonical Settlement/Operation route');
}

const serverFinance = source('server/src/finance/finance.service.ts');
for (const token of [
  'ensureLegacyMigrated',
  'saveSettlementWith',
  'createOperationWithEntries',
  'recordPayment(',
  'recordRefund(',
  'cancelOperation(',
  'settlementForSource(',
  'financeLedgerEntry',
]) {
  if (!serverFinance.includes(token)) errors.push(`FinanceService missing canonical owner behavior: ${token}`);
}
if (!/canonicalLedgerMigratedAt/.test(serverFinance)) {
  errors.push('FinanceService must migrate legacy auxiliary Finance exactly into canonical storage');
}

const browserRecord = source('core/record/service.js');
if (/from\s+['"][^'"]*finance\/index\.js['"]/.test(browserRecord)) {
  errors.push('Browser Record service must not calculate or persist Settlement');
}
if (!/['"]finance['"]/.test(browserRecord) || !/dataPatchFrom/.test(browserRecord)) {
  errors.push('Browser Record service must explicitly filter Finance projection fields from persistence');
}

const serverRecord = source('server/src/record/record.service.ts');
if (!/this\.finance\.upsertSettlement/.test(serverRecord) || !/this\.finance\.settlementForSource/.test(serverRecord)) {
  errors.push('Server Record must delegate Settlement ownership to Finance');
}
if (!/const \{ finance: _legacyFinance, \.\.\.currentRecord \} = current/.test(serverRecord)) {
  errors.push('Server Record update must strip legacy finance before persisting Record');
}

const financeRead = source('core/finance/read.js');
if (!/export function getLedgerEntries/.test(financeRead) || !/state\.ledger/.test(financeRead)) {
  errors.push('Finance reads must expose the canonical flat Ledger');
}
if (!/getWalletDDSMovements/.test(financeRead) || !/getLedgerEntries\(\)/.test(financeRead)) {
  errors.push('Wallet history must be projected from the canonical Ledger');
}

const financeRules = source('core/finance/rules.js');
if (!/export function calculateSettlement/.test(financeRules) || !/export function calculateSettlementTotals/.test(financeRules)) {
  errors.push('Settlement rules must own amount-due and paid/refunded calculations');
}

const financeIndex = source('core/finance/index.js');
for (const token of ['calculateSettlement', 'getRecordPaymentState', 'getLedgerEntries', 'recordPaymentIncome', 'saveSettlementSnapshot']) {
  if (!financeIndex.includes(token)) errors.push(`core/finance/index.js must expose ${token}`);
}

const walletData = source('settings/wallets/data.js');
if (!/getWalletDDSMovements/.test(walletData) || !/export function getWalletBalance/.test(walletData)) {
  errors.push('Wallet must derive balance from Finance Ledger projection');
}

const financeUI = source('main/finance/finance.js');
if (!/getLedgerEntries/.test(financeUI)) errors.push('DDS UI must render flat Ledger rows');

const recordView = source('journal/record-view.js');
if (/recordViewProcedureCost|data-record-view-procedure-cost/.test(recordView)) {
  errors.push('Created Record card must not correct procedure price; it may correct procedure time only');
}

const recordCreation = source('journal/record.js');
if (/data-record-cost|name=['"]recordCost['"]/.test(recordCreation)) {
  errors.push('Record creation must not correct procedure price; price comes from Price and is corrected only at payment');
}

const paymentUI = source('ui/payment/index.js');
if (!/data-payment-price/.test(paymentUI) || /data-payment-price\s+readonly/.test(paymentUI)) {
  errors.push('Payment must remain the editable procedure/product price correction point');
}

const recordPayment = source('journal/record-payment.js');
if (!/saveSettlementSnapshot/.test(recordPayment) || !/await\s+recordPaymentIncome/.test(recordPayment)) {
  errors.push('Payment UI must save Settlement and await the server money command');
}
if (/finance:\s*settlement/.test(recordPayment)) {
  errors.push('Payment-stage Settlement must not be persisted back into Record');
}
if (!/await\s+recordRefundExpense/.test(recordPayment) || !/await\s+cancelPaymentOperation/.test(recordPayment)) {
  errors.push('Refund and cancellation must await server Finance commands');
}

if (errors.length) {
  console.error('finance architecture check: FAILED');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('finance architecture check: OK');
