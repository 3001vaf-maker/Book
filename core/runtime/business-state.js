import { apiRequest } from '../auth.js';
import { setBusinessServerReady } from '../business-persistence.js';
import { hydrateUEIFromServer } from '../uei.js';
import { hydrateRecordStateFromServer } from '../record/index.js';
import { hydratePeopleFromServer } from '../people/data.js';
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function normalizeUEI(value={}){return {entities:value?.entities&&typeof value.entities==='object'&&!Array.isArray(value.entities)?clone(value.entities):{},relations:value?.relations&&typeof value.relations==='object'&&!Array.isArray(value.relations)?clone(value.relations):{},revoked:Array.isArray(value?.revoked)?clone(value.revoked):[]};}
async function payload(response,fallback){const value=await response.json().catch(()=>({}));if(!response.ok)throw new Error(value?.message||fallback);return value;}
export async function loadBusinessState(){setBusinessServerReady(false);const remote=await payload(await apiRequest('/business-state'),'Не удалось загрузить People, UEI и Записи');hydratePeopleFromServer(Array.isArray(remote.people)?clone(remote.people):[]);hydrateUEIFromServer(normalizeUEI(remote.uei));hydrateRecordStateFromServer({records:Array.isArray(remote.records)?clone(remote.records):[],recordEvents:Array.isArray(remote.recordEvents)?clone(remote.recordEvents):[]});setBusinessServerReady(true);}
