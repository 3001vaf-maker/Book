import { apiRequest } from '../auth.js';
import { queueOperationalDataset } from '../business-persistence.js';
import { hydrateDaysFromServer } from '../day/index.js';
import { configureBreakPersistence, hydrateBreaksFromServer } from '../../journal/break-data.js';
import { hydrateProceduresFromServer } from '../../core/service/procedures/data.js';
import { hydrateBookingSettingsFromServer } from '../booking-settings/index.js';

configureBreakPersistence((rows)=>queueOperationalDataset('breaks',rows));

let operationalStateReady = false;
let operationalStateLoading = null;

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
async function payload(response,fallback){const value=await response.json().catch(()=>({}));if(!response.ok)throw new Error(value?.message||fallback);return value;}

async function fetchOperationalState(){
  const remote=await payload(await apiRequest('/business-state/operational'),'Не удалось загрузить График, процедуры и настройки онлайн-записи');
  hydrateDaysFromServer(Array.isArray(remote.days)?clone(remote.days):[]);
  hydrateBreaksFromServer(Array.isArray(remote.breaks)?clone(remote.breaks):[]);
  hydrateProceduresFromServer({procedures:Array.isArray(remote.procedures)?clone(remote.procedures):[],procedureHistory:Array.isArray(remote.procedureHistory)?clone(remote.procedureHistory):[]});
  hydrateBookingSettingsFromServer(remote.bookingSettings&&typeof remote.bookingSettings==='object'&&!Array.isArray(remote.bookingSettings)?clone(remote.bookingSettings):null);
  operationalStateReady = true;
}

export async function loadOperationalState(){
  const loading = fetchOperationalState();
  operationalStateLoading = loading;
  try {
    await loading;
  } finally {
    if (operationalStateLoading === loading) operationalStateLoading = null;
  }
}

export function ensureOperationalState(){
  if (operationalStateReady) return Promise.resolve();
  if (operationalStateLoading) return operationalStateLoading;
  return loadOperationalState();
}
