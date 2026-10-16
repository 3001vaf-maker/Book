import { apiRequest } from '../../core/auth.js';
import { PROFESSIONAL_RUNTIME_PRELOADS, takeRuntimePreload } from '../../core/runtime/preload.js';
import { hydrateProfileFromServer, setProfileServerReady } from './data.js';
import { hydrateWorkplacesFromServer, setWorkplacesServerReady } from './workplaces/data.js';
async function payload(response,fallback){const value=await response.json().catch(()=>({}));if(!response.ok)throw new Error(value?.message||fallback);return value;}
export async function loadProfileState(){setProfileServerReady(false);setWorkplacesServerReady(false);const response=await (takeRuntimePreload(PROFESSIONAL_RUNTIME_PRELOADS.profile)||apiRequest('/profile'));const remote=await payload(response,'Не удалось загрузить данные профиля');hydrateProfileFromServer(remote?.profile||{},remote?.customProfessions||[],remote?.professionCatalog||[]);hydrateWorkplacesFromServer(remote?.workplaces||[],remote?.workplaceReferenceData||{});setProfileServerReady(true);setWorkplacesServerReady(true);}
