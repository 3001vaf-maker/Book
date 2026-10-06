import { apiRequest } from '../../core/auth.js';
import { hydrateProfileFromServer, setProfileServerReady } from './data.js';
import { hydrateWorkplacesFromServer, setWorkplacesServerReady } from './workplaces/data.js';
async function payload(response,fallback){const value=await response.json().catch(()=>({}));if(!response.ok)throw new Error(value?.message||fallback);return value;}
export async function loadProfileState(){setProfileServerReady(false);setWorkplacesServerReady(false);const remote=await payload(await apiRequest('/profile'),'Не удалось загрузить данные профиля');hydrateProfileFromServer(remote?.profile||{},remote?.customProfessions||[],remote?.professionCatalog||[]);hydrateWorkplacesFromServer(remote?.workplaces||[],remote?.workplaceReferenceData||{});setProfileServerReady(true);setWorkplacesServerReady(true);}
