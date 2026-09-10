import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', '_site']);
const errors = [];
const thisCheck = 'scripts/check-finance-architecture.mjs';
const obsoletePaymentModule = ['core', 'payment.js'].join('/');
const reservedBusinessModelModule = ['core', 'business-model.js'].join('/');

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
if (existsSync(join(root, reservedBusinessModelModule))) {
  errors.push(`${reservedBusinessModelModule} is reserved for future Analytics Business Model and must not own finance`);
}

for (const file of walk(root)) {
  const path = rel(file);
  if (path === thisCheck) continue;
  const text = readFileSync(file, 'utf8');
  if (text.includes(obsoletePaymentModule)) errors.push(`${path}: obsolete ${obsoletePaymentModule} dependency`);
  if (text.includes(reservedBusinessModelModule)) errors.push(`${path}: finance must use core/financial-model.js, not reserved Business Model`);
}

const ownershipRules = [
  ['core/dds.js', /from\s+['"][^'"]*(?:financial-model|wallet|record|client|ui)[^'"]*['"]/, 'DDS must not depend on Financial Model, Wallet, Record, Client or UI'],
  ['core/financial-model.js', /from\s+['"][^'"]*(?:wallet|journal|record-data|client|ui)[^'"]*['"]/, 'Financial Model must not depend on manifestations/data owners'],
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

const dds = source('core/dds.js');
if (!/const STORAGE_KEY = ['"]book\.dds['"]/.test(dds)) errors.push('core/dds.js must remain the only DDS movement store owner');
if (!/export function recordPaymentIncome/.test(dds) || !/export function recordRefundExpense/.test(dds)) {
  errors.push('core/dds.js must own payment income and refund expense movements');
}

const financialModel = source('core/financial-model.js');
if (!/export function calculateFinancialPlan/.test(financialModel) || !/export function calculateFinancialFact/.test(financialModel)) {
  errors.push('core/financial-model.js must own financial plan/fact calculations');
}

const walletData = source('settings/wallets/data.js');
if (!/getWalletDDSMovements/.test(walletData) || !/export function getWalletBalance/.test(walletData)) {
  errors.push('Wallet data owner must derive history/balance from DDS movements');
}

if (errors.length) {
  console.error('finance architecture check: FAILED');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('finance architecture check: OK');
