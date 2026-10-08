import { apiRequest } from '../auth.js';

let programs = [];

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function list(value){return Array.isArray(value)?value:[];}
async function payload(response,fallback){const value=await response.json().catch(()=>({}));if(!response.ok)throw new Error(value?.message||fallback);return value;}

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
  const key=String(personKey||'').trim();
  if(!key)return [];
  return payload(await apiRequest(`/finance/deposits/person/${encodeURIComponent(key)}`),'Не удалось загрузить депозиты');
}

export async function listAllDeposits(){
  return payload(await apiRequest('/finance/deposits'),'Не удалось загрузить депозиты');
}

export async function fundDeposit({programId='',person=null,amount=0,walletId='',walletName='',occurredAt=null}={}){
  if(!programId||!person?.key||!walletId||!occurredAt)return null;
  return payload(await apiRequest('/finance/deposits/fund',{
    method:'POST',
    body:JSON.stringify({
      programId,
      person,
      amount,
      walletId,
      walletName,
      occurredAt:occurredAt instanceof Date?occurredAt.toISOString():occurredAt,
    }),
  }),'Не удалось оформить депозит');
}

export async function withdrawDeposit({depositId='',amount=0,walletId='',walletName='',reason='',occurredAt=null}={}){
  if(!depositId||!walletId||!occurredAt)return null;
  return payload(await apiRequest(`/finance/deposits/${encodeURIComponent(depositId)}/withdraw`,{
    method:'POST',
    body:JSON.stringify({
      amount,
      walletId,
      walletName,
      reason,
      occurredAt:occurredAt instanceof Date?occurredAt.toISOString():occurredAt,
    }),
  }),'Не удалось вернуть остаток депозита');
}