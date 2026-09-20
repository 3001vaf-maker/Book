import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', '_site']);
const errors = [];
const thisCheck = 'scripts/check-finance-architecture.mjs';
const obsoletePaymentModule = ['core', 'payment.js'].join('/');
const obsoleteFinanceModelAtom = ['core', 'finance', 'model.js'].join('/');
const reservedFinancialModelPaths = [
  ['core', 'financial-model.js'].join('/'),
  ['core', 'finance', 'financial-model.js'].join('/'),
];

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

if (existsSync(join(root, obsoletePaymentModule))) {
  errors.push(`${obsoletePaymentModule} must not exist: Finance owns payment commands`);
}
if (existsSync(join(root, obsoleteFinanceModelAtom))) {
  errors.push(`${obsoleteFinanceModelAtom} must not exist: operational Record calculation belongs to Settlement`);
}
for (const path of reservedFinancialModelPaths) {
  if (existsSync(join(root, path))) {
    errors.push(`${path} is reserved for the future analytical Financial Model and must not be implemented during operational Finance work`);
  }
}

const obsoleteSettlementNames = /\b(?:calculateFinancialPlan|repriceFinancialPlan|calculateFinancialFact|calculateFinancialItemFact|calculateRecordPaymentState|getFinancialFactForRecords|getFinancialItemFact|getRecordFinancialPlanFact|resolveRecordFinancialPlan|recordPlanTotal|hydrateRecordFinance|normalizeRecordFinance|recordFinancialItems|isStoredFinancialPlan|normalizeStoredFinancialPlan)\b/;
for (const file of walk(root)) {
  const path = rel(file);
  if (path === thisCheck) continue;
  const text = readFileSync(file, 'utf8');
  if (text.includes(obsoletePaymentModule)) errors.push(`${path}: obsolete ${obsoletePaymentModule} dependency`);
  if (obsoleteSettlementNames.test(text)) errors.push(`${path}: legacy Financial Model/plan API must use Settlement terminology`);
  if (/from\s+['"][^'"]*financial-model[^'"]*['"]/.test(text)) {
    errors.push(`${path}: Financial Model is reserved and cannot be an operational Finance dependency`);
  }
}

const ownershipRules = [
  ['core/finance/data.js', /from\s+['"][^'"]*(?:financial-model|wallet|record|people|person|ui)[^'"]*['"]/, 'Finance persistence must not depend on Settlement projections, Wallet, Record, People or UI'],
  ['core/finance/rules.js', /from\s+['"][^'"]*(?:wallet|journal|record-data|people|person|ui)[^'"]*['"]/, 'Settlement rules must not depend on manifestations/data owners'],
  ['journal/record-data.js', /core\/dds\.js/, 'Record data must not own/read money movements directly; fact comes through Finance Settlement'],
  ['main/people/metadata.js', /core\/dds\.js/, 'Person metrics must read financial fact through Finance Settlement'],
  ['settings/service/procedures/procedures.js', /core\/dds\.js/, 'Procedure metrics must read financial fact through Finance Settlement'],
  ['settings/service/products/products.js', /core\/dds\.js/, 'Product metrics must read financial fact through Finance Settlement'],
  ['settings/wallets/wallets.js', /core\/dds\.js/, 'Wallet UI must read its own Wallet data owner, not DDS directly'],
  ['ui/payment/index.js', /core\/(?:dds|financial-model)\.js/, 'Payment UI is input/display only and must not own finance logic'],
];

for (const [path, pattern, message] of ownershipRules) {
  if (!existsSync(join(root, path))) continue;
  if (pattern.test(source(path))) errors.push(`${path}: ${message}`);
}

const financeData = source('core/finance/data.js');
if (!/queueAuxiliaryDataset\(['"]finance['"]/.test(financeData)
  || !/let financeState = emptyState\(\)/.test(financeData)
  || !/settlements:\s*\{\}/.test(financeData)
  || !/readStoredSettlement/.test(financeData)) {
  errors.push('core/finance/data.js must own server-backed Settlement and money persistence');
}

const financeService = source('core/finance/service.js');
if (!/export function recordPaymentIncome/.test(financeService)
  || !/export function recordRefundExpense/.test(financeService)
  || !/export function cancelPaymentOperation/.test(financeService)
  || !/export function saveRecordSettlement/.test(financeService)) {
  errors.push('core/finance/service.js must own Settlement plus payment/refund/cancel commands');
}

const financeRead = source('core/finance/read.js');
if (!/export function getActiveDDSMovements/.test(financeRead) || !/status\s*!==\s*['"]cancelled['"]/.test(financeRead)) {
  errors.push('core/finance/read.js must keep cancelled history separate from active financial projections');
}

const financeRules = source('core/finance/rules.js');
if (!/export function calculateSettlement/.test(financeRules) || !/export function calculateSettlementTotals/.test(financeRules)) {
  errors.push('core/finance/rules.js must own Settlement amount-due and paid/refunded calculations');
}
if (!/export function recordSettlementItems/.test(financeRules) || !/sourceType:\s*'product'/.test(financeRules)) {
  errors.push('Finance rules must assemble both procedure and product Record sources');
}

const financeIndex = source('core/finance/index.js');
if (!/recordPaymentIncome/.test(financeIndex) || !/cancelPaymentOperation/.test(financeIndex) || !/calculateSettlement/.test(financeIndex) || !/getRecordPaymentState/.test(financeIndex)) {
  errors.push('core/finance/index.js must expose the complete public Finance/Settlement contract');
}

const walletData = source('settings/wallets/data.js');
if (!/getWalletDDSMovements/.test(walletData) || !/export function getWalletBalance/.test(walletData)) {
  errors.push('Wallet data owner must derive history/balance from DDS movements');
}

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
  errors.push('Payment must be the single editable procedure/product price correction point');
}

const recordPayment = source('journal/record-payment.js');
if (!/procedures:\s*sourcesFromSettlement/.test(recordPayment)
  || !/products:\s*sourcesFromSettlement/.test(recordPayment)
  || !/saveRecordSettlement/.test(recordPayment)) {
  errors.push('Payment-stage source-price correction belongs to Record snapshots while discount/amount-due belongs to Finance Settlement');
}
if (/finance:\s*settlement/.test(recordPayment) || /setRecordAttendance\(completed/.test(recordPayment)) {
  errors.push('Payment UI must not persist Settlement into Record or mutate Record attendance as a payment side effect');
}
if (!/cancelPaymentOperation/.test(recordPayment) || !/data-payment-actions/.test(recordPayment)) {
  errors.push('Paid Record UI must route cancellation through Finance Core and keep it distinct from refund');
}

if (errors.length) {
  console.error('finance architecture check: FAILED');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('finance architecture check: OK');
