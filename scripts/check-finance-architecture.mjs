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

function walkEveryFile(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (ignored.has(name)) continue;
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) files.push(...walkEveryFile(file));
    else files.push(file);
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
if (/\bincome\s*:|\bexpense\s*:|legacyOperational|normalizeIncome|normalizeExpense/.test(financeData)) {
  errors.push('core/finance/data.js must not keep duplicate legacy income/expense Finance state');
}

const financeService = source('core/finance/service.js');
for (const command of ['recordPaymentIncome', 'recordRefundExpense', 'cancelPaymentOperation', 'recordManualFinanceOperation', 'recordSpecialFinanceOperation', 'correctFinanceOperation', 'hardDeleteFinanceOperation']) {
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
if (!/occurredAt/.test(financeService)) {
  errors.push('Browser money commands must carry factual occurredAt to the Finance server');
}

const auxiliaryServer = source('server/src/auxiliary-state/auxiliary-state.service.ts');
if (/DATASETS[^\n]*['"]finance['"]/.test(auxiliaryServer)) {
  errors.push('server auxiliary-state must not accept Finance writes after canonical Ledger migration');
}

const schema = source('server/prisma/schema.prisma');
for (const model of ['FinanceSettlement', 'FinanceArticle', 'FinanceOperation', 'FinanceLedgerEntry']) {
  if (!new RegExp(`model\\s+${model}\\s+\\{`).test(schema)) errors.push(`Prisma must define ${model}`);
}
if (!/Decimal\s+@db\.Decimal\(14, 2\)/.test(schema)) {
  errors.push('FinanceLedgerEntry.amount must use fixed decimal money storage');
}
if (!/@@unique\(\[tenantId, operationId\]\)/.test(schema)) {
  errors.push('FinanceOperation must have tenant-scoped operation identity');
}

const migration = source('server/prisma/migrations/20260920220500_finance_settlement_operation_ledger/migration.sql');
const articleMigration = source('server/prisma/migrations/20260921100000_finance_articles/migration.sql');
for (const table of ['FinanceSettlement', 'FinanceOperation', 'FinanceLedgerEntry']) {
  if (!migration.includes(`CREATE TABLE "${table}"`)) errors.push(`Finance migration must create ${table}`);
}
if (!articleMigration.includes('CREATE TABLE "FinanceArticle"')) errors.push('Finance article migration must create FinanceArticle');

const financeController = source('server/src/finance/finance.controller.ts');
for (const route of [
  /@Get\(\)/,
  /@Put\(['"]settlements\/:sourceType\/:sourceId['"]\)/,
  /@Post\(['"]operations\/payment['"]\)/,
  /@Post\(['"]operations\/:operationId\/refund['"]\)/,
  /@Post\(['"]operations\/:operationId\/cancel['"]\)/,
  /@Put\(['"]operations\/:operationId['"]\)/,
  /@Delete\(['"]operations\/:operationId\/hard['"]\)/,
  /@Get\(['"]articles['"]\)/,
  /@Post\(['"]articles['"]\)/,
  /@Put\(['"]articles\/:articleId['"]\)/,
  /@Delete\(['"]articles\/:articleId['"]\)/,
  /@Post\(['"]operations\/manual['"]\)/,
  /@Post\(['"]operations\/special['"]\)/,
]) {
  if (!route.test(financeController)) errors.push('FinanceController is missing a canonical Settlement/Operation route');
}

const serverFinance = source('server/src/finance/finance.service.ts');
for (const token of [
  'saveSettlementWith',
  'repriceSettlement(',
  'createOperationWithEntries',
  'recordPayment(',
  'recordRefund(',
  'cancelOperation(',
  'correctOperation(',
  'replaceOperationWithEntries',
  'hardDeleteOperation(',
  'settlementForSource(',
  'financeLedgerEntry',
  'financeArticle',
  'recordManualOperation(',
  'recordSpecialOperation(',
  'ensureDefaultArticles',
]) {
  if (!serverFinance.includes(token)) errors.push(`FinanceService missing canonical owner behavior: ${token}`);
}
if (!/DEFAULT_FINANCE_ARTICLES/.test(serverFinance) || !/parentArticleId/.test(serverFinance) || !/economicType/.test(serverFinance)) {
  errors.push('FinanceService must own hierarchical Articles with economic semantics');
}
if (!/quantity/.test(serverFinance) || !/unitPrice/.test(serverFinance) || !/manual-income|manual-expense/.test(serverFinance)) {
  errors.push('Manual Income/Expense must support detailed quantity × unit price lines in one Operation');
}
if (!/TransactionIsolationLevel\.Serializable/.test(serverFinance)) {
  errors.push('Finance server must protect authoritative same-source money writes with Serializable transactions');
}
if (!/requiredOccurredAt/.test(serverFinance)) {
  errors.push('Every factual Finance command must require occurredAt instead of silently using write time');
}
if (!/recordedAt:\s*row\.createdAt\.toISOString\(\)/.test(serverFinance)) {
  errors.push('Finance snapshot must expose immutable recordedAt separately from occurredAt');
}
for (const economicType of ['LOAN_RECEIVED', 'LOAN_REPAYMENT', 'INVESTMENT_RECEIVED', 'INVESTMENT_RETURN', 'TRANSFER']) {
  if (!serverFinance.includes(economicType)) errors.push(`FinanceService missing special economic type: ${economicType}`);
}
if (/ensureLegacyMigrated|canonicalLedgerMigratedAt|migrateLegacyPayment|migrateLegacyExpense|legacyReadModel/.test(serverFinance)) {
  errors.push('FinanceService must not contain legacy Finance migration/read-model bridges');
}

const browserRecord = source('core/record/service.js');
if (/from\s+['"][^'"]*finance\/index\.js['"]/.test(browserRecord)) {
  errors.push('Browser Record service must not calculate or persist Settlement');
}
if (!/['"]finance['"]/.test(browserRecord) || !/dataPatchFrom/.test(browserRecord)) {
  errors.push('Browser Record service must explicitly filter Finance projection fields from persistence');
}

const serverRecord = source('server/src/record/record.service.ts');
if (!/this\.finance\.upsertSettlement/.test(serverRecord)
  || !/this\.finance\.settlementForSource/.test(serverRecord)
  || !/this\.finance\.repriceSettlement/.test(serverRecord)) {
  errors.push('Server Record must delegate Settlement ownership and repricing to Finance');
}
if (!/const \{ finance: _financeProjection, \.\.\.currentRecord \} = current/.test(serverRecord)) {
  errors.push('Server Record update must strip transient Finance projection before persisting Record');
}

const financeRead = source('core/finance/read.js');
if (!/export function getLedgerEntries/.test(financeRead) || !/state\.ledger/.test(financeRead)) {
  errors.push('Finance reads must expose the canonical flat Ledger');
}
if (!/getWalletDDSMovements/.test(financeRead) || !/getLedgerEntries\(\)/.test(financeRead)) {
  errors.push('Wallet history must be projected from the canonical Ledger');
}
if (!/recordedAt/.test(financeRead) || !/entry\?\.occurredAt/.test(financeRead)) {
  errors.push('Ledger projections must preserve factual occurredAt and audit recordedAt separately');
}

const financeRules = source('core/finance/rules.js');
if (!/export function calculateSettlement/.test(financeRules) || !/export function calculateSettlementTotals/.test(financeRules)) {
  errors.push('Settlement rules must own amount-due and paid/refunded calculations');
}
if (!/export function financialMoney/.test(financeRules) || !/Math\.round\([^\n]*\* 100\) \/ 100/.test(financeRules)) {
  errors.push('Browser Settlement must use the same cent-level money contract as server Finance');
}

const financeIndex = source('core/finance/index.js');
for (const token of ['calculateSettlement', 'getRecordPaymentState', 'getLedgerEntries', 'getFinanceArticles', 'getZReport', 'recordManualFinanceOperation', 'recordSpecialFinanceOperation', 'recordPaymentIncome', 'correctFinanceOperation', 'hardDeleteFinanceOperation', 'saveSettlementSnapshot']) {
  if (!financeIndex.includes(token)) errors.push(`core/finance/index.js must expose ${token}`);
}

const walletData = source('core/finance/cash/data.js');
const cashEntityData = source('core/finance/cash/entities.js');
if (!/getWalletDDSMovements/.test(walletData) || !/export function getWalletBalance/.test(walletData)) {
  errors.push('Wallet must derive balance from Finance Ledger projection');
}
if (/\bbalance\s*:/.test(walletData)) {
  errors.push('Wallet metadata must not persist an independent balance field');
}

const financeCss = walkEveryFile(join(root, 'core/finance'))
  .map(rel)
  .filter((path) => path.endsWith('.css'));
if (financeCss.length) {
  errors.push(`Finance must not own local CSS: ${financeCss.join(', ')}`);
}

const financeUiFiles = [
  'core/finance/cash/cash.js',
  'core/finance/dds/index.js',
  'core/finance/dds/income-expense.js',
  'core/finance/dds/special-operations.js',
  'core/finance/dds/articles.js',
  'core/finance/z-report/index.js',
];
for (const path of financeUiFiles) {
  const text = source(path);
  if (/variant:\s*['"]technical['"]/.test(text)) errors.push(`${path}: Finance user UI must not use technical modals`);
  if (/<select\b/.test(text)) errors.push(`${path}: Finance user UI must not use raw select elements`);
  if (/\b(?:alert|confirm|prompt)\s*\(/.test(text)) errors.push(`${path}: Finance user UI must not use browser dialogs`);
  for (const form of text.match(/<form\b[^>]*>/g) || []) {
    if (!/\bnovalidate\b/.test(form)) errors.push(`${path}: Finance forms must disable native browser validation UI and surface validation through shared TOP notices`);
  }
}

const modalUI = source('ui/modals/index.js');
if (!/openNotice\(\{ title = 'Внимание', message = '', surface = 'app'/.test(modalUI)
  || !/modal\(content, \{ variant: 'top', surface, title \}\)/.test(modalUI)) {
  errors.push('Shared user notices must be locked to the top modal');
}
if (/data-notice-close|action = 'ОК'/.test(modalUI)) {
  errors.push('Top shared notices must contain information only and close by gesture');
}
if (!/resolvedVariant === 'bottom' \|\| resolvedVariant === 'top' \|\| resolvedVariant === 'compact'/.test(modalUI)) {
  errors.push('Top shared modals must not render a close button');
}

const cashUI = source('core/finance/cash/cash.js');
for (const token of ['workspaceHeaderContext', 'entityVisualCard', 'mountEntityCardConstructor', 'mountV2ZLayer', 'v2ListEntry', 'v2ListEntries', 'readOnlyReceipt']) {
  if (!cashUI.includes(token)) errors.push(`Cash UI must use shared ${token}`);
}
if (!/data-cash-create/.test(cashUI)
  || !/v2Section\('Кошельки'/.test(cashUI)
  || !/v2Section\('Инвестиции'/.test(cashUI)
  || !/v2Section\('Займ'/.test(cashUI)
  || !/entityCardRail/.test(cashUI)) {
  errors.push('Cash Z1 must expose Wallets, Investments and Loan as three horizontal shared sections with Header C create action');
}
for (const label of ['+ Добавить кошелек', '+ Добавить инвестицию', '+ Добавить займ']) {
  if (!cashUI.includes(label)) errors.push(`Cash C create modal missing action: ${label}`);
}
if (!/variant:\s*'quick'/.test(cashUI)) {
  errors.push('Cash C entity choice must use the shared bottom quick modal');
}
if (/entityCardStack/.test(cashUI)) {
  errors.push('Cash Z1 must not fall back to the old vertical entity card stack');
}
if (/entityCard--hero|\bentityCard\s*\(/.test(cashUI)) {
  errors.push('Cash Z1 must use the fixed shared entity visual card, not a local/legacy card');
}
if (/paymentReceipt/.test(cashUI)) {
  errors.push('Cash operation Z3 must use shared readOnlyReceipt, not paymentReceipt');
}
if (/Внесено в систему|Конечный пользователь|За что/.test(cashUI)) {
  errors.push('Cash receipt must not expose recording time, end-user headings or paid-for detail');
}
if (!/operationKind === 'cancel'/.test(cashUI)
  || !/operationStatus === 'cancelled'/.test(cashUI)
  || !/economicType === 'REVERSAL'/.test(cashUI)) {
  errors.push('Cash quick operation list must hide cancelled/deleted operations and reversals');
}
if (!/Math\.abs\(getWalletBalance\(id\)\) > 0\.009/.test(walletData)) {
  errors.push('Ordinary cash deletion must require a zero balance and preserve Finance history');
}
if (!/export function deleteWalletPermanently/.test(walletData)) {
  errors.push('Admin hard-delete flow must remove custom cash metadata only after the server purge');
}
if (!/getInvestmentEntities/.test(cashEntityData)
  || !/getLoanEntities/.test(cashEntityData)
  || !/queueAuxiliaryDataset\('investments'/.test(cashEntityData)
  || !/queueAuxiliaryDataset\('loans'/.test(cashEntityData)) {
  errors.push('Cash Investment and Loan must be persistent auxiliary entities, not visual placeholders');
}

if (!/wallets\/:walletId\/hard/.test(financeController)) {
  errors.push('Finance server must expose the admin-only full cash deletion command');
}
if (!/platformAdmin\.findUnique/.test(serverFinance)
  || !/financeOperation\.deleteMany/.test(serverFinance)
  || !/id === 'cash' \|\| id === 'cashless'/.test(serverFinance)) {
  errors.push('Full cash deletion must be platform-admin gated, purge operation history, and protect system cash');
}

const financeUI = source('core/finance/finance.js');
const ddsUI = source('core/finance/dds/index.js');
if (!/getLedgerEntries/.test(ddsUI) || !/operationGroupsFromLedger/.test(ddsUI)) errors.push('DDS UI must project canonical Ledger into one row per Finance operation');
if (!/renderZReport/.test(financeUI)) {
  errors.push('Finance root must expose Z-report');
}
if (/renderFinanceArticles|renderIncomeExpense|renderSpecialFinanceOperations/.test(financeUI)) {
  errors.push('Finance root must not expose DDS instruments as separate E folders');
}
if (!/workspaceHeaderContext/.test(ddsUI)
  || !/data-finance-dds-settings/.test(ddsUI)
  || !/data-finance-dds-tool/.test(ddsUI)) {
  errors.push('DDS must expose its former Finance E instruments through the DDS A/settings control');
}
for (const label of ['Эксель', 'Финансовые операции', 'Статьи']) {
  if (!ddsUI.includes(label)) errors.push(`DDS A/settings missing instrument: ${label}`);
}
if (!/title: 'Движения денежных средств'/.test(ddsUI)) {
  errors.push('DDS Z1 must expose the full “Движения денежных средств” Header B title');
}
if (!/title: 'Выгрузка ДДС'/.test(ddsUI) || !/data-finance-dds-export-submit/.test(ddsUI)) {
  errors.push('DDS Excel must open Z2 filters and expose Export through Header C');
}
for (const group of ['Доход / Расход', 'Займы', 'Инвестиции', 'Переводы']) {
  if (!ddsUI.includes(group)) errors.push(`DDS financial operation picker missing group: ${group}`);
}
if (!/variant: 'quick'/.test(ddsUI)) {
  errors.push('DDS financial operation choice must use the shared bottom modal');
}
if (!/mountV2ZLayer/.test(ddsUI) || !/v2ZLayer/.test(ddsUI)) {
  errors.push('DDS Excel, operation forms, receipts and Articles must open as real stacked Z layers');
}
for (const token of ['v2ListEntry', 'v2ListEntries', 'readOnlyReceipt', 'openSharedProfileSettingsMenu', 'correctFinanceOperation', 'hardDeleteFinanceOperation']) {
  if (!ddsUI.includes(token)) errors.push(`DDS operation workflow must use shared ${token}`);
}
if (/details\s*\(|list\s*\(\{\s*items:\s*entries/.test(ddsUI)) {
  errors.push('DDS opened operation must be one readOnlyReceipt without legacy details/list duplication');
}
if (!/data-finance-operation-cancel-confirm/.test(ddsUI) || !/data-finance-operation-delete-confirm/.test(ddsUI) || !/correct-operation/.test(ddsUI)) {
  errors.push('DDS operation A/settings must expose correction, cancel and permanent delete flows');
}
if (!/modal--form-sheet/.test(ddsUI) || !/variant:\s*'danger'/.test(ddsUI)) {
  errors.push('DDS cancel must reuse the shared bottom form sheet and shared danger button');
}
if (/datetime-local|type:\s*['"](?:date|time)['"]/.test(ddsUI)) {
  errors.push('DDS must not use native browser date/time controls');
}
if (!/datePicker/.test(ddsUI) || !/initDatePickers/.test(ddsUI)) {
  errors.push('DDS date selection must use the shared calendar owner');
}
if (!/actionOnly:\s*true/.test(ddsUI) || !/openCancellationInfo/.test(ddsUI)) {
  errors.push('DDS cancellation help must use the shared info icon and shared TOP notice owner');
}
if (!/Внесено в систему/.test(ddsUI)) {
  errors.push('DDS export must preserve immutable system recording time');
}
if (!/paymentReceiptGroups/.test(ddsUI)
  || !/groups:\s*paymentReceiptGroups\(entries\)/.test(ddsUI)
  || !/id:\s*'cancel-operation',[\s\S]*variant:\s*'danger'/.test(ddsUI)) {
  errors.push('DDS payment receipt must use grouped shared receipt sections and pink/red Cancel in A/settings');
}
if (/status:\s*first\?\.operationStatus[\s\S]*Факт операции/.test(ddsUI) || /Внесено ·/.test(ddsUI)) {
  errors.push('DDS working receipts must not expose technical status or system recording timestamps');
}
const articlesUI = source('core/finance/dds/articles.js');
if (!/parentArticleId/.test(articlesUI) || !/economicType/.test(articlesUI)) {
  errors.push('Articles UI must support hierarchy and separate economic character');
}
const incomeExpenseUI = source('core/finance/dds/income-expense.js');
if (!/recordManualFinanceOperation/.test(incomeExpenseUI) || !/lineQuantity/.test(incomeExpenseUI) || !/linePrice/.test(incomeExpenseUI)) {
  errors.push('Income / Expense UI must support simple and detailed manual operations');
}
if (!/searchableSelect/.test(incomeExpenseUI) || !/getLedgerEntries/.test(incomeExpenseUI)) {
  errors.push('Manual Finance line names must support reusable history plus free custom entry');
}
if (/<input\b|<select\b|datetime-local|type:\s*['"](?:date|time)['"]/.test(incomeExpenseUI)) {
  errors.push('Manual Finance UI must use shared fields/selectors/calendar instead of raw or native controls');
}

const specialOperationsUI = source('core/finance/dds/special-operations.js');
if (!/recordSpecialFinanceOperation/.test(specialOperationsUI)
  || !/loan-received/.test(specialOperationsUI)
  || !/investment-return/.test(specialOperationsUI)
  || !/transfer/.test(specialOperationsUI)) {
  errors.push('Special Finance UI must expose loans, investments, returns and wallet transfers');
}
if (/datetime-local|type:\s*['"](?:date|time)['"]/.test(specialOperationsUI)
  || !/datePicker/.test(specialOperationsUI)
  || !/initDatePickers/.test(specialOperationsUI)) {
  errors.push('Special Finance operations must use the shared date calendar without native time controls');
}
const zReportUI = source('core/finance/z-report/index.js');
if (!/getZReport/.test(zReportUI) || !/datePicker/.test(zReportUI) || !/initDatePickers/.test(zReportUI)) {
  errors.push('Z-report UI must project Ledger through the shared date calendar');
}
if (/datetime-local|type:\s*['"](?:date|time)['"]/.test(zReportUI)) {
  errors.push('Z-report must not use native browser date/time controls');
}
if (!/export function getZReport/.test(financeRead) || !/getLedgerEntries\(\)/.test(financeRead)) {
  errors.push('Z-report must be a Ledger-only projection');
}


const stagingSeed = source('server/prisma/seed-staging.ts');
if (/financeSettlement\.upsert|financeOperation\.upsert|financeLedgerEntry\.upsert|staging-payment-|staging-ledger-/.test(stagingSeed)) {
  errors.push('Staging fixtures must not create test Finance facts');
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
  errors.push('Payment must remain the editable procedure/product price correction point');
}

const recordPayment = source('journal/record-payment.js');
if (!/saveSettlementSnapshot/.test(recordPayment) || !/await\s+recordPaymentIncome/.test(recordPayment)) {
  errors.push('Payment UI must save Settlement and await the server money command');
}
if (!/recordPaymentOccurredAtValue/.test(recordPayment)
  || !/paymentOccurredAt/.test(recordPayment)
  || !/refundOccurredAt/.test(recordPayment)
  || !/cancelOccurredAt/.test(recordPayment)) {
  errors.push('Payment/refund/cancel UI must capture factual occurredAt; late Record closure must default payment to Record date/time');
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
