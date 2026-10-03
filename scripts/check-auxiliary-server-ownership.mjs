import fs from 'node:fs';

function text(path) { return fs.readFileSync(path, 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const core = text('core.js');
const migration = text('auxiliary-migration.js');
const persistence = text('core/business-persistence.js');
const finance = text('core/finance/data.js');
const wallets = text('core/finance/cash/data.js');
const cashEntities = text('core/finance/cash/entities.js');
const auxiliaryService = text('server/src/auxiliary-state/auxiliary-state.service.ts');
const tags = text('settings/tags/data.js');
const products = text('settings/service/products/data.js');
const schema = text('server/prisma/schema.prisma');
const moduleFile = text('server/src/auxiliary-state/auxiliary-state.module.ts');

assert(core.includes('initializeAuxiliaryState'), 'Core must initialize server-owned Finance and auxiliary state before workspace render.');
assert(migration.includes("apiRequest('/auxiliary-state')") && migration.includes("apiRequest('/auxiliary-state/bootstrap'"), 'Auxiliary startup must read/bootstrap the dedicated server owner directly.');
assert(!/localStorage|readLegacy|\/auxiliary-state\/migrate/.test(migration), 'Auxiliary startup must not depend on browser migration paths.');
assert(migration.includes("apiRequest('/finance')") && migration.includes('hydrateFinanceFromServer'), 'Finance startup must hydrate the dedicated canonical Finance owner.');
assert(migration.includes('hydrateWalletsFromServer') && migration.includes('hydrateCashEntitiesFromServer') && migration.includes('hydrateTagsFromServer') && migration.includes('hydrateProductsFromServer'), 'Auxiliary startup must hydrate Wallets, cash entities, Tags and Products from the auxiliary owner.');
assert(persistence.includes("/auxiliary-state/${encodeURIComponent(key)}"), 'Auxiliary writes must target the dedicated server owner.');
assert(finance.includes('hydrateFinanceFromServer') && !finance.includes('queueAuxiliaryDataset'), 'Finance browser state must be a server-hydrated read cache, not an auxiliary writer.');
assert(wallets.includes('hydrateWalletsFromServer') && wallets.includes("queueAuxiliaryDataset('wallets'"), 'Wallets must use server-hydrated runtime state and server writes.');
assert(cashEntities.includes('hydrateCashEntitiesFromServer')
  && cashEntities.includes("queueAuxiliaryDataset('investments'")
  && cashEntities.includes("queueAuxiliaryDataset('loans'"), 'Investment and loan entities must use server-hydrated auxiliary state and server writes.');
assert(auxiliaryService.includes("'investments'") && auxiliaryService.includes("'loans'"), 'Auxiliary server owner must accept investment and loan entity datasets.');
assert(auxiliaryService.includes("'cardAppearanceTemplates'") && migration.includes('hydrateCardAppearanceTemplates') && migration.includes('cardAppearanceTemplates'), 'Centralized card appearance templates must be server-owned auxiliary data and hydrate before UI rendering.');
assert(tags.includes('hydrateTagsFromServer') && tags.includes("queueAuxiliaryDataset('tags'"), 'Tags must use server-hydrated runtime state and server writes.');
assert(products.includes('hydrateProductsFromServer') && products.includes("queueAuxiliaryDataset('products'") && products.includes("queueAuxiliaryDataset('productHistory'"), 'Products and product history must use server-hydrated runtime state and server writes.');
assert(schema.includes('model BusinessAuxiliaryState'), 'Server must own a dedicated auxiliary business state.');
assert(schema.includes('model FinanceOperation') && schema.includes('model FinanceLedgerEntry'), 'Finance money persistence must be outside BusinessAuxiliaryState.');
assert(/imports:\s*\[[^\]]*AuthModule[^\]]*\]/s.test(moduleFile), 'AuxiliaryStateModule must provide JwtService to JwtAuthGuard through AuthModule.');
assert(/imports:\s*\[[^\]]*SaasAccessModule[^\]]*\]/s.test(moduleFile), 'AuxiliaryStateModule must use the canonical SaaS capability owner for investment role access.');
console.log('auxiliary server ownership check: OK');
