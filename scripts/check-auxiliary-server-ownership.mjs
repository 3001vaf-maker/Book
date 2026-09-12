import fs from 'node:fs';

function text(path) { return fs.readFileSync(path, 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const core = text('core.js');
const migration = text('auxiliary-migration.js');
const persistence = text('core/business-persistence.js');
const finance = text('core/finance/data.js');
const wallets = text('settings/wallets/data.js');
const tags = text('settings/tags/data.js');
const products = text('settings/service/products/data.js');
const schema = text('server/prisma/schema.prisma');
const moduleFile = text('server/src/auxiliary-state/auxiliary-state.module.ts');

assert(core.includes('initializeAuxiliaryState'), 'Core must initialize server-owned Finance and auxiliary state before workspace render.');
assert(migration.includes('/auxiliary-state/migrate/verify'), 'Auxiliary migration must verify the server copy before switching source.');
assert(migration.includes('hydrateFinanceFromServer') && migration.includes('hydrateWalletsFromServer') && migration.includes('hydrateTagsFromServer') && migration.includes('hydrateProductsFromServer'), 'Auxiliary migration must hydrate every migrated domain from the server.');
assert(persistence.includes("/auxiliary-state/${encodeURIComponent(key)}"), 'Auxiliary writes must target the dedicated server owner.');
assert(finance.includes('hydrateFinanceFromServer') && finance.includes("queueAuxiliaryDataset('finance'"), 'Finance must stop writing browser storage after server hydration.');
assert(wallets.includes('hydrateWalletsFromServer') && wallets.includes("queueAuxiliaryDataset('wallets'"), 'Wallets must stop writing browser storage after server hydration.');
assert(tags.includes('hydrateTagsFromServer') && tags.includes("queueAuxiliaryDataset('tags'"), 'Tags must stop writing browser storage after server hydration.');
assert(products.includes('hydrateProductsFromServer') && products.includes("queueAuxiliaryDataset('products'") && products.includes("queueAuxiliaryDataset('productHistory'"), 'Products and product history must stop writing browser storage after server hydration.');
assert(schema.includes('model BusinessAuxiliaryState'), 'Server must own a dedicated auxiliary business state.');
assert(moduleFile.includes('imports: [AuthModule]'), 'AuxiliaryStateModule must provide JwtService to JwtAuthGuard through AuthModule.');
console.log('auxiliary server ownership check: OK');
