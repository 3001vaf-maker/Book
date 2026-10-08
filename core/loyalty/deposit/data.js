import { apiRequest } from '../../auth.js';

let programs = [];

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function list(value){return Array.isArray(value)?value:[];}
function text(value){return String(value??'').trim();}
async function payload(response,fallback){const value=await response.json().catch(()=>({}));if(!response.ok)throw new Error(value?.message||fallback);return value;}

function depositIdentity(item={}){
  const personUei=text(item?.person?.uei).toUpperCase();
  const programUei=text(item?.terms?.programUei||item?.programUei).toUpperCase();
  const depositId=text(item?.depositId||item?.id);
  const suffix=depositId.replace(/[^A-Za-z0-9]/g,'').slice(0,6).toUpperCase();
  const parts=[personUei,programUei,suffix].filter(Boolean);
  return {
    ...clone(item),
    personUei,
    programUei,
    depositUei:parts.join('-'),
    identityKey:[personUei,programUei,depositId].join(':'),
  };
}

function normalizeDeposits(value){return list(value).map((item)=>depositIdentity(item));}

export function getDepositPrograms(){return programs.map((item)=>clone(item));}

export async function loadDepositPrograms(){
  const remote=await payload(await apiRequest('/auxiliary-state'),'Не удалось загрузить депозитные программы');
  programs=list(remote.depositPrograms).map((item)=>clone(item));
  return getDepositPrograms();
}

export async function saveDepositPrograms(next=[]){
  const values=list(next).map((item)=>clone(item));
  const remote=await payload(await apiRequest('/auxiliary-state/depositPrograms',{
    method:'PUT',
    body:JSON.stringify({value:values}),
  }),'Не удалось сохранить депозитные программы');
  programs=list(remote.depositPrograms).map((item)=>clone(item));
  return getDepositPrograms();
}

export async function listPersonDeposits(personKey=''){
  const key=text(personKey);
  if(!key)return [];
  return normalizeDeposits(await payload(await apiRequest(`/finance/deposits/person/${encodeURIComponent(key)}`),'Не удалось загрузить депозиты'));
}

export async function listAllDeposits(){
  return normalizeDeposits(await payload(await apiRequest('/finance/deposits'),'Не удалось загрузить депозиты'));
}

export async function fundDeposit({programId='',person=null,amount=0,walletId='',walletName='',occurredAt=null}={}){
  if(!programId||!person?.key||!walletId||!occurredAt)return null;
  return depositIdentity(await payload(await apiRequest('/finance/deposits/fund',{
    method:'POST',
    body:JSON.stringify({
      programId,
      person,
      amount,
      walletId,
      walletName,
      occurredAt:occurredAt instanceof Date?occurredAt.toISOString():occurredAt,
    }),
  }),'Не удалось оформить депозит'));
}

export async function withdrawDeposit({depositId='',amount=0,walletId='',walletName='',reason='',occurredAt=null}={}){
  if(!depositId||!walletId||!occurredAt)return null;
  return depositIdentity(await payload(await apiRequest(`/finance/deposits/${encodeURIComponent(depositId)}/withdraw`,{
    method:'POST',
    body:JSON.stringify({
      amount,
      walletId,
      walletName,
      reason,
      occurredAt:occurredAt instanceof Date?occurredAt.toISOString():occurredAt,
    }),
  }),'Не удалось вернуть остаток депозита'));
}
