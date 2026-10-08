import { apiRequest } from '../auth.js';
import { hydrateCashEntitiesFromServer, hydrateFinanceFromServer, hydrateWalletsFromServer } from '../finance/index.js';
import { hydrateProductsFromServer } from '../../core/service/products/data.js';
import { hydrateTagsFromServer } from '../../settings/tags/data.js';
import { hydrateCardAppearanceTemplates } from '../card-appearance-templates.js';
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
async function payload(response,fallback){const value=await response.json().catch(()=>({}));if(!response.ok)throw new Error(value?.message||fallback);return value;}
export async function loadAuxiliaryState(){const remote=await payload(await apiRequest('/auxiliary-state'),'Не удалось загрузить связанные данные');hydrateWalletsFromServer(Array.isArray(remote.wallets)?clone(remote.wallets):[]);hydrateCashEntitiesFromServer({investments:Array.isArray(remote.investments)?clone(remote.investments):[],loans:Array.isArray(remote.loans)?clone(remote.loans):[]});hydrateTagsFromServer(Array.isArray(remote.tags)?clone(remote.tags):[]);hydrateProductsFromServer({products:Array.isArray(remote.products)?clone(remote.products):[],productHistory:Array.isArray(remote.productHistory)?clone(remote.productHistory):[]});hydrateCardAppearanceTemplates(Array.isArray(remote.cardAppearanceTemplates)?clone(remote.cardAppearanceTemplates):[]);hydrateFinanceFromServer(await payload(await apiRequest('/finance'),'Не удалось загрузить Финансы'));}
