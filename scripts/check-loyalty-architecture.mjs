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
const personalAccountUI = source('core/loyalty/personal-account/index.js');
const certificateUI = source('core/loyalty/certificate/index.js');
const subscriptionUI = source('core/loyalty/subscription/index.js');
const referralUI = source('core/loyalty/referral/index.js');
const bonusUI = source('core/loyalty/bonus/index.js');
const depositData = source('core/loyalty/deposit/data.js');
const depositUI = source('core/loyalty/deposit/index.js');
const core = source('core.js');
const depositService = source('server/src/loyalty/deposit.service.ts');
const depositState = source('server/src/loyalty/deposit-state.ts');
const priceCondition = source('server/src/loyalty/price-condition.ts');
const auxiliaryState = source('server/src/auxiliary-state/auxiliary-state.service.ts');
const financeService = source('server/src/finance/finance.service.ts');
const prismaSchema = source('server/prisma/schema.prisma');
const loyaltyController = source('server/src/loyalty/loyalty.controller.ts');
const loyaltyModule = source('server/src/loyalty/loyalty.module.ts');
const appModule = source('server/src/app.module.ts');
const financeController = source('server/src/finance/finance.controller.ts');
const accountDeposit = source('server/src/online-booking/account-deposit.controller.ts');
const ownershipMigration = source('server/prisma/migrations/20261009121500_make_deposit_state_server_owned/migration.sql');

for (const token of [
  'Сущность владеет своим состоянием',
  'DepositInstance не должен реконструироваться',
  'Личный счёт',
  'не хранит бонусный баланс',
  'Результат Реферальной программы не записывается в Личный счёт',
  'Результат Бонусной программы не записывается в Личный счёт',
]) {
  if (!architecture.includes(token)) errors.push(`LOYALTY_ARCHITECTURE.md missing normative rule: ${token}`);
}

for (const token of [
  'Пример общего лимита:',
  'одна позиция с количеством',
  'общий лимит на несколько выбранных позиций',
  'первая оплаченная операция приглашённого',
  'многоуровневая программа',
  'максимум от одного приглашённого',
  'каждую N-ю операцию',
  'ступенчатые правила',
  'Срок жизни награды',
  'покупателя, если он отличается от владельца',
]) {
  if (!architecture.includes(token)) errors.push(`LOYALTY_ARCHITECTURE.md lost approved product detail: ${token}`);
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
for (const token of [
  'ближайшей датой окончания',
  '1 бонус = 1 единица валюты профиля / бизнеса',
  'уже созданные начисления не переписываются задним числом',
  'рабочая / фактическая дата события',
  'аудитная дата внесения записи',
]) {
  if (!finance.toLowerCase().includes(token.toLowerCase())) errors.push(`LOYALTY_FINANCE_CONTRACT.md lost approved financial detail: ${token}`);
}

for (const token of ['Фаза A — UI', 'Фаза B — доменные сущности', 'Фаза C — persistence / API', 'Фаза D — интеграции', 'Восстановление после смены / обрыва чата', 'commit SHA', 'Нормативный документ нельзя «упрощать» ценой потери решений']) {
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

if (!/id:\s*['"]loyalty['"][^\n]*label:\s*['"]Лояльность['"]/.test(core)) errors.push('core.js must expose top-level F Loyalty');
if (!/renderLoyaltySection/.test(core)) errors.push('core.js must route Loyalty through its owner renderer');

const ownerModules = [
  ['personal-account', personalAccountUI],
  ['certificate', certificateUI],
  ['subscription', subscriptionUI],
  ['referral', referralUI],
  ['bonus', bonusUI],
];
for (const [name] of ownerModules) {
  if (!loyaltyRoot.includes(`./${name}/index.js`)) errors.push(`core/loyalty/index.js must route ${name} through its dedicated owner module`);
}
if (/data-loyalty-stage-action|previewCards|Интерфейс готов|визуальный mock/i.test(loyaltyRoot)) errors.push('core/loyalty/index.js must not contain placeholder E implementations');

if (!/export async function renderPersonalAccount/.test(personalAccountUI)) errors.push('Personal Account UI owner is missing');
if (/label:\s*['"]\+['"]|data-(?:personal-account|loyalty)-create|data-loyalty-stage-action/.test(personalAccountUI)) errors.push('Personal Account must not expose manual open/create action');
if (/бонус/i.test(personalAccountUI)) errors.push('Personal Account UI must not expose a bonus balance');
if (!/Денежный остаток/.test(personalAccountUI)) errors.push('Personal Account UI must expose money-only balance');

const visualOwners = [
  ['Personal Account', personalAccountUI, 'personal-account'],
  ['Certificate', certificateUI, 'certificate'],
  ['Subscription', subscriptionUI, 'subscription'],
  ['Referral', referralUI, 'referral'],
  ['Bonus', bonusUI, 'bonus'],
];
for (const [label, sourceText, type] of visualOwners) {
  if (!sourceText.includes('entityCardStack')) errors.push(`${label} Z1 must use the shared visual-card stack`);
  if (!sourceText.includes('loyaltyVisualCard')) errors.push(`${label} must render shared entityVisualCard-based cards`);
  if (!sourceText.includes(`type: '${type}'`)) errors.push(`${label} A → View must edit its own card type`);
}
for (const token of ['entityCardStack', 'entityVisualCard', 'openEntityCardAppearanceQ']) {
  if (!depositUI.includes(token)) errors.push(`Deposit must reuse shared ${token}`);
}

if (/\/finance\/deposits/.test(depositData)) errors.push('Deposit browser data must not use /finance/deposits as its canonical API');
for (const route of ['/loyalty/deposits', '/loyalty/deposits/person/']) {
  if (!depositData.includes(route)) errors.push(`Deposit browser data missing canonical route ${route}`);
}

const loyaltyCss = walk(join(root, 'core/loyalty')).map(rel).filter((path) => path.endsWith('.css'));
if (loyaltyCss.length) errors.push(`Loyalty must not own local CSS: ${loyaltyCss.join(', ')}`);
for (const [label, sourceText] of [['Deposit', depositUI], ['Certificate', certificateUI], ['Subscription', subscriptionUI], ['Referral', referralUI], ['Bonus', bonusUI]]) {
  if (/<select\b/.test(sourceText)) errors.push(`${label} UI must use shared selector instead of native select`);
  if (/\b(?:alert|confirm|prompt)\s*\(/.test(sourceText)) errors.push(`${label} UI must not use browser dialogs`);
}

for (const token of ['model LoyaltyDepositProgram', 'model LoyaltyDepositInstance', 'principalBalance', 'benefitBalance']) {
  if (!prismaSchema.includes(token)) errors.push(`Prisma schema missing canonical Deposit model token: ${token}`);
}
for (const token of ['DROP TRIGGER IF EXISTS "LoyaltyDepositFinanceSync"', 'DROP FUNCTION IF EXISTS loyalty_deposit_recalculate', 'LoyaltyDepositProgram']) {
  if (!ownershipMigration.includes(token)) errors.push(`Deposit ownership migration missing retirement token: ${token}`);
}

if (!/loyaltyDepositInstance\.(?:findMany|findUnique)/.test(depositService)) errors.push('DepositService must read canonical Prisma DepositInstance state');
if (/\$queryRaw|\$executeRaw|loyalty_deposit_recalculate/.test(depositService)) errors.push('DepositService must not use raw SQL or Finance replay for canonical state');
if (!/this\.finance\.recordDepositFunding/.test(depositService) || !/this\.finance\.recordDepositWithdrawal/.test(depositService)) errors.push('DepositService must delegate physical money facts to Finance');
if (!/loyaltyDepositProgram/.test(auxiliaryState)) errors.push('Deposit programs must persist through canonical LoyaltyDepositProgram state');
if (!/consumeDepositAllocations/.test(depositState) || !/principalAmount/.test(depositState) || !/benefitAmount/.test(depositState)) errors.push('Deposit state owner must mutate and preserve exact principal/benefit allocation components');
if (!/resolvePersonPriceCondition/.test(priceCondition) || /loyalty_deposit_benefit_/.test(priceCondition)) errors.push('Server price condition must use canonical resolver without SQL helper bridge');
for (const token of ['resolvePersonPricePercent', 'canonicalSettlementInput', 'calculateCanonicalSettlement', 'consumeDepositAllocations', 'restoreDepositAllocations']) {
  if (!financeService.includes(token)) errors.push(`Finance server missing authoritative pricing/deposit step: ${token}`);
}
if (/\$queryRaw[^]*LoyaltyDepositInstance|loyalty_deposit_recalculate|loyalty_deposit_finance_sync/.test(financeService)) errors.push('Finance runtime must not reconstruct Deposit state from Finance operations');

if (!/@Controller\(['"]loyalty['"]\)/.test(loyaltyController) || !/deposits\/fund/.test(loyaltyController)) errors.push('LoyaltyController must own the canonical Deposit HTTP surface');
if (!/FinanceModule/.test(loyaltyModule) || !/DepositService/.test(loyaltyModule)) errors.push('LoyaltyModule must own DepositService and consume Finance as an integration');
if (!/LoyaltyModule/.test(appModule)) errors.push('AppModule must register LoyaltyModule');
if (/@(?:Get|Post)\(['"]deposits(?:\/|['"])/.test(financeController)) errors.push('FinanceController must not expose Deposit entity routes; the HTTP owner is LoyaltyController');
if (/FinanceService/.test(accountDeposit) || /finance\.listDeposits/.test(accountDeposit)) errors.push('End-user Deposit API must read from Loyalty owner, not Finance');
if (!/DepositService/.test(accountDeposit) || !/this\.deposits\.list/.test(accountDeposit)) errors.push('End-user Deposit API must use DepositService');

if (errors.length) {
  console.error('Loyalty architecture check failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Loyalty architecture check passed.');
