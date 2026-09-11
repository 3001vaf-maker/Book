import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', '_site']);
const errors = [];
const thisCheck = 'scripts/check-finance-architecture.mjs';
const obsoletePaymentModule = ['core', 'payment.js'].join('/');
const reservedFutureModelModule = ['core', 'business-model.js'].join('/');

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) files.push(...walk(file));
    else if (/\.(?:js|mjs)$/.test(name)) files.push(file);
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
  errors.push(`${obsoletePaymentModule} must not exist: DDS owns money movement; Financial Model owns plan/fact`);
}
if (existsSync(join(root, reservedFutureModelModule))) {
  errors.push(`${reservedFutureModelModule} is reserved for a separate future instrument and must not own finance`);
}

for (const file of walk(root)) {
  const path = rel(file);
  if (path === thisCheck) continue;
  const text = readFileSync(file, 'utf8');
  if (text.includes(obsoletePaymentModule)) errors.push(`${path}: obsolete ${obsoletePaymentModule} dependency`);
  if (text.includes(reservedFutureModelModule)) errors.push(`${path}: finance must use core/finance/index.js`);
}

const ownershipRules = [
  ['core/finance/data.js', /from\s+['"][^'"]*(?:financial-model|wallet|record|client|ui)[^'"]*['"]/, 'DDS must not depend on Financial Model, Wallet, Record, Client or UI'],
  ['core/finance/rules.js', /from\s+['"][^'"]*(?:wallet|journal|record-data|client|ui)[^'"]*['"]/, 'Financial Model must not depend on manifestations/data owners'],
  ['journal/record-data.js', /core\/dds\.js/, 'Record data must not own/read money movements directly; fact comes through Financial Model'],
  ['main/clients/metadata.js', /core\/dds\.js/, 'Client metrics must read financial fact through Financial Model'],
  ['settings/service/procedures/procedures.js', /core\/dds\.js/, 'Procedure metrics must read financial fact through Financial Model'],
  ['settings/service/products/products.js', /core\/dds\.js/, 'Product metrics must read financial fact through Financial Model'],
  ['settings/wallets/wallets.js', /core\/dds\.js/, 'Wallet UI must read its own Wallet data owner, not DDS directly'],
  ['ui/payment/index.js', /core\/(?:dds|financial-model)\.js/, 'Payment UI is input/display only and must not own finance logic'],
];

for (const [path, pattern, message] of ownershipRules) {
  if (!existsSync(join(root, path))) continue;
  if (pattern.test(source(path))) errors.push(`${path}: ${message}`);
}

const financeData = source('core/finance/data.js');
if (!/const STORAGE_KEY = ['"]book\.dds['"]/.test(financeData)) errors.push('core/finance/data.js must own DDS movement persistence');

const financeService = source('core/finance/service.js');
if (!/export function recordPaymentIncome/.test(financeService) || !/export function recordRefundExpense/.test(financeService)) {
  errors.push('core/finance/service.js must own payment income and refund expense commands');
}

const financeRules = source('core/finance/rules.js');
if (!/export function calculateFinancialPlan/.test(financeRules) || !/export function calculateFinancialFact/.test(financeRules)) {
  errors.push('core/finance/rules.js must own financial plan/fact calculations');
}
if (!/export function recordFinancialItems/.test(financeRules) || !/sourceType:\s*'product'/.test(financeRules)) {
  errors.push('Finance rules must assemble both procedure and product Record sources');
}

const financeIndex = source('core/finance/index.js');
if (!/recordPaymentIncome/.test(financeIndex) || !/calculateFinancialPlan/.test(financeIndex) || !/getRecordPaymentState/.test(financeIndex)) {
  errors.push('core/finance/index.js must expose the complete public Finance contract');
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
if (!/procedures:\s*sourcesFromFinance/.test(recordPayment) || !/products:\s*sourcesFromFinance/.test(recordPayment)) {
  errors.push('Payment-stage price correction must be persisted back into Record procedures and products');
}

if (errors.length) {
  console.error('finance architecture check: FAILED');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('finance architecture check: OK');
