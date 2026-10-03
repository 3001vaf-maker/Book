import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hydrateProceduresFromServer, getProcedures, reorderProcedures } from '../settings/service/procedures/data.js';
import { hydrateProductsFromServer, getProducts, reorderProducts } from '../settings/service/products/data.js';

hydrateProceduresFromServer({
  procedures: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  procedureHistory: [],
});
assert.equal(reorderProcedures(['b', 'a']), true);
assert.deepEqual(getProcedures().map((item) => item.id), ['b', 'a']);

hydrateProductsFromServer({
  products: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }],
  productHistory: [],
});
assert.equal(reorderProducts(['y', 'x']), true);
assert.deepEqual(getProducts().map((item) => item.id), ['y', 'x']);

const service = readFileSync(new URL('../settings/service/service.js', import.meta.url), 'utf8');
const procedures = readFileSync(new URL('../settings/service/procedures/procedures.js', import.meta.url), 'utf8');
const procedureForm = readFileSync(new URL('../settings/service/procedures/form.js', import.meta.url), 'utf8');
const products = readFileSync(new URL('../settings/service/products/products.js', import.meta.url), 'utf8');
const workplaceSelection = readFileSync(new URL('../settings/service/workplace-selection.js', import.meta.url), 'utf8');
const appearance = readFileSync(new URL('../settings/service/appearance.js', import.meta.url), 'utf8');
const cardPresentation = readFileSync(new URL('../settings/service/card-presentation.js', import.meta.url), 'utf8');
const listEntry = readFileSync(new URL('../ui/lists/list-entry.js', import.meta.url), 'utf8');

assert.match(service, /viewNavigation/);
assert.doesNotMatch(service, /folderList/);
assert.match(service, /c:\s*\{[\s\S]*label:\s*'\+'[\s\S]*data:\s*'data-service-add'/);
assert.doesNotMatch(service, /v2-primary-source-only|openSharedPhotoAction|id:\s*'photo'/);
assert.match(service, /openServiceAppearanceQ/);
assert.doesNotMatch(service, /id:\s*'workplaces'|Редактор процедуры|Редактор товара|label:\s*'Удалить'/);
assert.match(appearance, /openEntityCardAppearanceQ/);
assert.match(appearance, /value:\s*'procedure'[\s\S]*value:\s*'product'/);
assert.match(appearance, /Все процедуры/);
assert.match(appearance, /Все товары/);
assert.match(cardPresentation, /procedureCardAppearance/);
assert.match(cardPresentation, /productCardAppearance/);
assert.match(procedures, /initV2ListReorder/);
assert.match(products, /initV2ListReorder/);
assert.doesNotMatch(procedures, /openProcedureOrder|data-order-up|data-order-down/);
assert.doesNotMatch(procedureForm, /photoField|workplaceSelector|initWorkplaceSelectors/);
assert.doesNotMatch(products, /workplaceSelector|initWorkplaceSelectors|photoField/);
assert.match(workplaceSelection, /notificationSettings/);
assert.match(workplaceSelection, /modal--profile-settings-sheet/);
assert.doesNotMatch(workplaceSelection, /checkList|initCheckList/);
assert.match(listEntry, /initV2ListReorder/);
assert.doesNotMatch(procedureForm, /v2-primary-source-only|button\('Сохранить'/);
assert.doesNotMatch(products, /v2-primary-source-only/);
assert.match(procedures, /data-procedure-editor-primary/);
assert.match(products, /data-product-editor-primary/);
assert.doesNotMatch(procedures, /openSharedPhotoAction|id:\s*'photo'/);
assert.doesNotMatch(products, /openSharedPhotoAction|id:\s*'photo'/);
assert.match(procedures, /entityVisualCard/);
assert.match(products, /entityVisualCard/);
assert.match(procedures, /procedureOverviewCard\(procedure\)[\s\S]*procedureWorkplaceCards\(procedure\)/);
assert.match(products, /productOverviewCard\(product\)[\s\S]*productWorkplaceCards\(product\)/);
assert.match(procedures, /id:\s*'workplaces'[\s\S]*id:\s*'editor'[\s\S]*id:\s*'delete'/);
assert.match(products, /id:\s*'workplaces'[\s\S]*id:\s*'editor'[\s\S]*id:\s*'delete'/);
assert.doesNotMatch(procedures, /id:\s*'appearance'/);
assert.doesNotMatch(products, /id:\s*'appearance'/);

console.log('service UI architecture tests: OK');
