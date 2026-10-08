import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const errors = [];

function source(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) {
    errors.push(`${path} must exist`);
    return '';
  }
  return readFileSync(absolute, 'utf8');
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) files.push(...walk(file));
    else files.push(file);
  }
  return files;
}

function rel(path) {
  return relative(root, path).replaceAll('\\', '/');
}

const architecture = source('LOYALTY_ARCHITECTURE.md');
const assignment = source('LOYALTY_ASSIGNMENT_CONTRACT.md');
const finance = source('LOYALTY_FINANCE_CONTRACT.md');
const execution = source('LOYALTY_EXECUTION_CONTRACT.md');
const loyaltyRoot = source('core/loyalty/index.js');
const depositData = source('core/loyalty/deposit/data.js');
const depositUI = source('core/loyalty/deposit/index.js');
const core = source('core.js');
const depositService = source('server/src/loyalty/deposit.service.ts');
const loyaltyController = source('server/src/loyalty/loyalty.controller.ts');
const loyaltyModule = source('server/src/loyalty/loyalty.module.ts');
const appModule = source('server/src/app.module.ts');
const financeController = source('server/src/finance/finance.controller.ts');
const accountDeposit = source('server/src/online-booking/account-deposit.controller.ts');
const migration = source('server/prisma/migrations/20261008130500_loyalty_deposit_instance/migration.sql');

for (const token of [
  'Сущность владеет своим состоянием',
  'DepositInstance не должен реконструироваться',
  'Личный счёт',
  'не хранит бонусный баланс',
  'Результат Реферальной программы **не записывается в Личный счёт**',
  'Результат Бонусной программы **не записывается в Личный счёт**',
]) {
  if (!architecture.includes(token)) errors.push(`LOYALTY_ARCHITECTURE.md missing normative rule: ${token}`);
}

if (!assignment.includes('Личный счёт') || !assignment.includes('**не назначается вообще**')) {
  errors.push('LOYALTY_ASSIGNMENT_CONTRACT.md must explicitly exclude Personal Account from assignment');
}
if (!finance.includes('Личный счёт хранит только **реальные деньги')) {
  errors.push('LOYALTY_FINANCE_CONTRACT.md must keep Personal Account money-only');
}
if (/два независимых номинала|бонусный номинал Личного счёта|срок жизни бонусов принадлежит [`']?Личн/i.test(finance)) {
  errors.push('LOYALTY_FINANCE_CONTRACT.md contains retired Personal Account bonus ownership');
}

for (const token of ['Фаза A — UI', 'Фаза B — доменные сущности', 'Фаза C — persistence / API', 'Фаза D — интеграции', 'Восстановление после смены / обрыва чата', 'commit SHA']) {
  if (!execution.includes(token)) errors.push(`LOYALTY_EXECUTION_CONTRACT.md missing execution rule: ${token}`);
}

const expectedNavigation = [
  "{ id: 'deposit', label: 'Депозит' }",
  "{ id: 'personal-account', label: 'Личный счёт' }",
  "{ id: 'certificate', label: 'Сертификат' }",
  "{ id: 'subscription', label: 'Абонемент' }",
  "{ id: 'referral', label: 'Реферальная программа' }",
  "{ id: 'bonus', label: 'Бонусная программа' }",
];
let previousIndex = -1;
for (const item of expectedNavigation) {
  const index = loyaltyRoot.indexOf(item);
  if (index < 0) errors.push(`core/loyalty/index.js missing E: ${item}`);
  if (index >= 0 && index <= previousIndex) errors.push('Loyalty E order must remain Deposit → Personal Account → Certificate → Subscription → Referral → Bonus');
  previousIndex = Math.max(previousIndex, index);
}

if (!/id:\s*['"]loyalty['"][^\n]*label:\s*['"]Лояльность['"]/.test(core)) {
  errors.push('core.js must expose top-level F Loyalty');
}
if (!/renderLoyaltySection/.test(core)) errors.push('core.js must route Loyalty through its owner renderer');

const personalStart = loyaltyRoot.indexOf('function renderPersonalAccount');
const personalEnd = loyaltyRoot.indexOf('function renderCertificate');
const personalBlock = personalStart >= 0 && personalEnd > personalStart ? loyaltyRoot.slice(personalStart, personalEnd) : '';
if (!personalBlock) errors.push('Personal Account UI block is missing');
if (/label:\s*['"]\+['"]|Открыть личный счёт|data-loyalty-stage-action/.test(personalBlock)) {
  errors.push('Personal Account must not expose manual open/create action');
}
if (/бонус/i.test(personalBlock)) errors.push('Personal Account UI must not expose a bonus balance');
if (!/Денежный остаток/.test(personalBlock)) errors.push('Personal Account UI must expose money-only balance');

if (/\/finance\/deposits/.test(depositData)) {
  errors.push('Deposit browser data must not use /finance/deposits as its canonical API');
}
for (const route of ['/loyalty/deposits', '/loyalty/deposits/person/']) {
  if (!depositData.includes(route)) errors.push(`Deposit browser data missing canonical route ${route}`);
}

const loyaltyCss = walk(join(root, 'core/loyalty')).map(rel).filter((path) => path.endsWith('.css'));
if (loyaltyCss.length) errors.push(`Loyalty must not own local CSS: ${loyaltyCss.join(', ')}`);
if (/<select\b/.test(depositUI)) errors.push('Deposit UI must use shared selector instead of native select');
if (/\b(?:alert|confirm|prompt)\s*\(/.test(depositUI)) errors.push('Deposit UI must not use browser dialogs');
for (const token of ['workspaceHeaderContext', 'v2ListEntry', 'v2ListEntries']) {
  if (!depositUI.includes(token)) errors.push(`Deposit UI must reuse shared ${token}`);
}

for (const token of ['CREATE TABLE "LoyaltyDepositInstance"', '"balance" DECIMAL(14,2)', 'loyalty_deposit_recalculate', 'LoyaltyDepositFinanceSync', 'Backfill every Deposit']) {
  if (!migration.includes(token)) errors.push(`Deposit migration missing canonical state guard: ${token}`);
}

if (!/FROM "LoyaltyDepositInstance"/.test(depositService)) {
  errors.push('DepositService must read canonical DepositInstance state');
}
if (/depositDtoFromOperations|\.filter\([^\n]*deposit-funding/.test(depositService)) {
  errors.push('DepositService must not reconstruct DepositInstance identity from Finance operations');
}
if (!/this\.finance\.recordDepositFunding/.test(depositService) || !/this\.finance\.recordDepositWithdrawal/.test(depositService)) {
  errors.push('DepositService must delegate physical money facts to Finance');
}
if (!/@Controller\(['"]loyalty['"]\)/.test(loyaltyController) || !/deposits\/fund/.test(loyaltyController)) {
  errors.push('LoyaltyController must own the canonical Deposit HTTP surface');
}
if (!/FinanceModule/.test(loyaltyModule) || !/DepositService/.test(loyaltyModule)) {
  errors.push('LoyaltyModule must own DepositService and consume Finance as an integration');
}
if (!/LoyaltyModule/.test(appModule)) errors.push('AppModule must register LoyaltyModule');
if (/@(?:Get|Post)\(['"]deposits(?:\/|['"])/.test(financeController)) {
  errors.push('FinanceController must not expose Deposit entity routes; the HTTP owner is LoyaltyController');
}
if (/FinanceService/.test(accountDeposit) || /finance\.listDeposits/.test(accountDeposit)) {
  errors.push('End-user Deposit API must read from Loyalty owner, not Finance');
}
if (!/DepositService/.test(accountDeposit) || !/this\.deposits\.list/.test(accountDeposit)) {
  errors.push('End-user Deposit API must use DepositService');
}

if (errors.length) {
  console.error('Loyalty architecture check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Loyalty architecture check passed.');
