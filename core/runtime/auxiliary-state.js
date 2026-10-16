import { apiRequest } from '../auth.js';
import { hydrateCashEntitiesFromServer, hydrateFinanceFromServer, hydrateWalletsFromServer } from '../finance/index.js';
import { hydrateProductsFromServer } from '../../core/service/products/data.js';
import { hydrateTagsFromServer } from '../../settings/tags/data.js';
import { hydrateCardAppearanceTemplates } from '../card-appearance-templates.js';

let auxiliaryStateReady = false;
let auxiliaryStateLoading = null;

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
async function payload(response,fallback){const value=await response.json().catch(()=>({}));if(!response.ok)throw new Error(value?.message||fallback);return value;}

async function fetchAuxiliaryState(){
  const auxiliaryPromise=payload(await apiRequest('/auxiliary-state'),'Не удалось загрузить связанные данные');
  const financePromise=payload(await apiRequest('/finance'),'Не удалось загрузить Финансы');
  const [remote,finance]=await Promise.all([auxiliaryPromise,financePromise]);
  hydrateWalletsFromServer(Array.isArray(remote.wallets)?clone(remote.wallets):[]);
  hydrateCashEntitiesFromServer({investments:Array.isArray(remote.investments)?clone(remote.investments):[],loans:Array.isArray(remote.loans)?clone(remote.loans):[]});
  hydrateTagsFromServer(Array.isArray(remote.tags)?clone(remote.tags):[]);
  hydrateProductsFromServer({products:Array.isArray(remote.products)?clone(remote.products):[],productHistory:Array.isArray(remote.productHistory)?clone(remote.productHistory):[]});
  hydrateCardAppearanceTemplates(Array.isArray(remote.cardAppearanceTemplates)?clone(remote.cardAppearanceTemplates):[]);
  hydrateFinanceFromServer(finance);
  auxiliaryStateReady = true;
}

export async function loadAuxiliaryState(){
  const loading = fetchAuxiliaryState();
  auxiliaryStateLoading = loading;
  try {
    await loading;
  } finally {
    if (auxiliaryStateLoading === loading) auxiliaryStateLoading = null;
  }
}

export function ensureAuxiliaryState(){
  if (auxiliaryStateReady) return Promise.resolve();
  if (auxiliaryStateLoading) return auxiliaryStateLoading;
  return loadAuxiliaryState();
}
