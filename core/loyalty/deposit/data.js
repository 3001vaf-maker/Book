import { apiRequest } from '../../auth.js';
import { refreshFinanceState } from '../../finance/index.js';

let programs = [];

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function list(value){return Array.isArray(value)?value:[];}
function text(value){return String(value??'').trim();}
async function payload(response,fallback){const value=await response.json().catch(()=>({}));if(!response.ok)throw new Error(value?.message||fallback);return value;}

function normalizeDeposits(value){
  return list(value).map((item)=>{
    const deposit=clone(item);
    deposit.history=list(deposit.history).map((entry)=>({
      ...entry,
      direction:text(entry?.direction).toLowerCase(),
    }));
    return deposit;
  });
}

export function getDepositPrograms(){return programs.map((item)=>clone(item));}

export async function loadDepositPrograms(){
  const remote=await payload(await apiRequest('/auxiliary-state'),'Не удалось загрузить депозитные программы');
  programs=list(remote.depositPrograms).map((item)=>clone(item));
  return getDepositPrograms();
}

export async function saveDepositPrograms(next=[]){
  const values=list(next).map((item)=>clone(item));
  const nextIds=new Set(values.map((item)=>text(item?.id)).filter(Boolean));
  const removedProgramIds=programs.map((item)=>text(item?.id)).filter((id)=>id&&!nextIds.has(id));
  if(removedProgramIds.length){
    for(const programId of removedProgramIds){
      await payload(await apiRequest(`/loyalty/deposits/program/${encodeURIComponent(programId)}`,{method:'DELETE'}),'Не удалось полностью удалить депозитную программу');
    }
    await refreshFinanceState();
    return loadDepositPrograms();
  }
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
  return normalizeDeposits(await payload(await apiRequest(`/loyalty/deposits/person/${encodeURIComponent(key)}`),'Не удалось загрузить депозиты'));
}

export async function listAllDeposits(){
  return normalizeDeposits(await payload(await apiRequest('/loyalty/deposits'),'Не удалось загрузить депозиты'));
}

export async function fundDeposit({programId='',person=null,amount=0,walletId='',walletName='',occurredAt=null}={}){
  if(!programId||!person?.key||!walletId||!occurredAt)return null;
  const result=await payload(await apiRequest('/loyalty/deposits/fund',{
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
  return normalizeDeposits([result])[0]||null;
}

export async function withdrawDeposit({depositId='',amount=0,walletId='',walletName='',reason='',occurredAt=null}={}){
  if(!depositId||!walletId||!occurredAt)return null;
  const result=await payload(await apiRequest(`/loyalty/deposits/${encodeURIComponent(depositId)}/withdraw`,{
    method:'POST',
    body:JSON.stringify({
      amount,
      walletId,
      walletName,
      reason,
      occurredAt:occurredAt instanceof Date?occurredAt.toISOString():occurredAt,
    }),
  }),'Не удалось вернуть остаток депозита');
  return normalizeDeposits([result])[0]||null;
}

export async function deleteDeposit(depositId=''){
  const id=text(depositId);
  if(!id)return false;
  await payload(await apiRequest(`/loyalty/deposits/${encodeURIComponent(id)}`,{method:'DELETE'}),'Не удалось полностью удалить депозит');
  await refreshFinanceState();
  return true;
}
