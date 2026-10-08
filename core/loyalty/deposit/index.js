import {
  button,
  datePicker,
  entityCardStack,
  entityVisualCard,
  escapeHtml,
  field,
  initDatePickers,
  modal,
  mountModal,
  mountV2ZLayer,
  openNotice,
  page,
  select,
  shortDateTime,
  textareaField,
  v2ListEntries,
  v2ListEntry,
  v2Section,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../../ui/ui.js';
import { getWallets } from '../../finance/index.js';
import { personDisplay } from '../../people/presentation.js';
import {
  fundDeposit,
  getDepositPrograms,
  listPersonDeposits,
  loadDepositPrograms,
  saveDepositPrograms,
  withdrawDeposit,
} from './data.js';
import {
  depositCardAppearance,
  depositCardFields,
  depositCardPhoto,
  depositCardPhotoPosition,
} from './card-presentation.js';

const money=(value)=>`${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(value||0)).replaceAll('\u00a0',' ')} ₽`;
const text=(value)=>String(value??'').trim();
const uid=()=>globalThis.crypto?.randomUUID?.()||`deposit-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function notifyContext(){window.dispatchEvent(new CustomEvent('book:v2-context-changed'));}
function formObject(form){return Object.fromEntries([...new FormData(form).entries()].map(([key,value])=>[key,typeof value==='string'?value.trim():value]));}
function personLabel(person){const display=personDisplay(person||{});return display.name||'Без имени';}

function programFields(program){
  return depositCardFields({
    title:program.name||'Депозит',
    subtitle:program.termRule||'Депозит',
    status:program.status==='paused'?'Приостановлен':program.status==='closed'?'Закрыт':'Активен',
    metaLeft:program.benefit||program.description||'Условия программы',
    metaRight:program.amount?money(program.amount):'',
  });
}

function depositFields(deposit){
  return depositCardFields({
    title:deposit.programName||'Депозит',
    subtitle:personLabel(deposit.person),
    status:deposit.status==='closed'?'Закрыт':'Активен',
    metaLeft:`Внесено ${money(deposit.fundedAmount)}`,
    metaRight:`Остаток ${money(deposit.balance)}`,
  });
}

function card(fields,{data='',aria='',interactive=true}={}){
  return entityVisualCard({
    appearance:depositCardAppearance(),
    fields,
    image:depositCardPhoto(),
    imagePosition:depositCardPhotoPosition(),
    interactive,
    data,
    aria,
  });
}

function header(title,{c=null}={}){
  return workspaceHeaderContext({title,c,hideD:false});
}

function programInfo(program){
  const rows=[
    ['Статус',program.status==='paused'?'Приостановлен':program.status==='closed'?'Закрыт':'Активен'],
    ['Сумма',program.amount?money(program.amount):'Свободная'],
    ['Срок',program.termRule||'Бессрочно'],
    ['Выгода',program.benefit||'Без дополнительной выгоды'],
    ['Условия',program.description||'—'],
    ['Создано',shortDateTime(program.createdAt,'—')],
  ];
  return v2ListEntries(rows.map(([title,subtitle])=>v2ListEntry({title,subtitle:String(subtitle),interactive:false})));
}

async function openCreateProgramQ(root,onSaved){
  const layer=mountModal(root,modal(`${header('Новая депозитная программа',{c:{label:'Сохранить',data:'data-deposit-program-save',aria:'Сохранить депозитную программу'}})}
    <form class="form-grid" data-deposit-program-form>
      ${field({label:'Название',name:'name',required:true})}
      ${field({label:'Сумма программы',name:'amount',type:'number',min:'0',step:'0.01',inputmode:'decimal'})}
      ${field({label:'Срок / правило срока',name:'termRule',placeholder:'Например: 12 месяцев или бессрочно'})}
      ${field({label:'Выгода',name:'benefit',placeholder:'Например: скидка 10%'})}
      ${textareaField({label:'Условия',name:'description'})}
      <div class="form-error" data-deposit-program-error></div>
    </form>`,{variant:'q',surface:'app',title:'Новая депозитная программа'}));
  if(!layer)return null;
  const form=layer.querySelector('[data-deposit-program-form]');
  layer.querySelector('[data-deposit-program-save]')?.addEventListener('click',async()=>{
    const values=formObject(form);
    const error=layer.querySelector('[data-deposit-program-error]');
    if(!values.name){if(error)error.textContent='Введите название';return;}
    const now=new Date().toISOString();
    const program={
      id:uid(),
      name:values.name,
      amount:Math.max(0,Number(String(values.amount||'0').replace(',','.'))||0),
      termRule:values.termRule||'',
      benefit:values.benefit||'',
      description:values.description||'',
      status:'active',
      createdAt:now,
      updatedAt:now,
    };
    try{
      await saveDepositPrograms([...getDepositPrograms(),program]);
      layer.v2Close?.();
      await onSaved?.();
    }catch(cause){if(error)error.textContent=String(cause?.message||'Не удалось сохранить программу');}
  });
  notifyContext();
  return layer;
}

async function openFundQ(root,program,person,onSaved){
  const wallets=getWallets();
  const display=personDisplay(person||{});
  const layer=mountModal(root,modal(`${header('Оформить депозит',{c:{label:'Оформить',data:'data-deposit-fund-save',aria:'Оформить депозит'}})}
    <form class="form-grid" data-deposit-fund-form>
      ${field({label:'Человек',name:'personName',value:display.name||'',disabled:true})}
      ${field({label:'Сумма',name:'amount',type:'number',min:'0.01',step:'0.01',inputmode:'decimal',value:program.amount||''})}
      ${select({label:'Кошелёк приёма денег',name:'walletId',value:'',options:[{value:'',label:'Выберите кошелёк'},...wallets.map((wallet)=>({value:wallet.id,label:wallet.name}))]})}
      ${datePicker({label:'Дата внесения',name:'occurredAt',value:new Date().toISOString().slice(0,10),showYear:true,modalVariant:'bottom',modalSurface:'app',allowClear:false})}
      <div class="form-error" data-deposit-fund-error></div>
    </form>`,{variant:'q',surface:'app',title:'Оформить депозит'}));
  if(!layer)return null;
  initDatePickers(layer);
  const form=layer.querySelector('[data-deposit-fund-form]');
  layer.querySelector('[data-deposit-fund-save]')?.addEventListener('click',async()=>{
    const values=formObject(form);
    const error=layer.querySelector('[data-deposit-fund-error]');
    const wallet=wallets.find((item)=>String(item.id)===String(values.walletId));
    const amount=Math.max(0,Number(String(values.amount||'0').replace(',','.'))||0);
    if(!amount||!wallet){if(error)error.textContent='Укажите сумму и кошелёк';return;}
    try{
      await fundDeposit({
        programId:program.id,
        person:{key:person.key||person.id||'',uei:display.uei||'',name:display.name||''},
        amount,
        walletId:wallet.id,
        walletName:wallet.name,
        occurredAt:new Date(`${values.occurredAt}T12:00:00`),
      });
      layer.v2Close?.();
      openNotice({title:'Депозит оформлен',message:`Принято ${money(amount)}. Деньги проведены финансовой операцией.`});
      await onSaved?.();
    }catch(cause){if(error)error.textContent=String(cause?.message||'Не удалось оформить депозит');}
  });
  notifyContext();
  return layer;
}

async function openWithdrawX(root,deposit,onSaved){
  const wallets=getWallets();
  const layer=mountModal(root,modal(`<div class="form-grid">
    ${field({label:'Сумма возврата',name:'amount',type:'number',min:'0.01',max:deposit.balance,step:'0.01',inputmode:'decimal',value:deposit.balance})}
    ${select({label:'Кошелёк возврата',name:'walletId',value:'',options:[{value:'',label:'Выберите кошелёк'},...wallets.map((wallet)=>({value:wallet.id,label:wallet.name}))]})}
    ${datePicker({label:'Дата возврата',name:'occurredAt',value:new Date().toISOString().slice(0,10),showYear:true,modalVariant:'bottom',modalSurface:'app',allowClear:false})}
    ${textareaField({label:'Комментарий',name:'reason'})}
    ${button('Вернуть',{variant:'danger',data:'data-deposit-withdraw-save'})}
    <div class="form-error" data-deposit-withdraw-error></div>
  </div>`,{variant:'x',surface:'app',title:'Возврат депозита'}));
  if(!layer)return null;
  initDatePickers(layer);
  layer.querySelector('[data-deposit-withdraw-save]')?.addEventListener('click',async()=>{
    const values=formObject(layer);
    const error=layer.querySelector('[data-deposit-withdraw-error]');
    const wallet=wallets.find((item)=>String(item.id)===String(values.walletId));
    const amount=Math.max(0,Number(String(values.amount||'0').replace(',','.'))||0);
    if(!amount||amount>Number(deposit.balance||0)||!wallet){if(error)error.textContent='Проверьте сумму и кошелёк';return;}
    try{
      await withdrawDeposit({depositId:deposit.depositId,amount,walletId:wallet.id,walletName:wallet.name,reason:values.reason||'',occurredAt:new Date(`${values.occurredAt}T12:00:00`)});
      layer.v2Close?.();
      await onSaved?.();
    }catch(cause){if(error)error.textContent=String(cause?.message||'Не удалось вернуть депозит');}
  });
  return layer;
}

function historyMarkup(deposit){
  const items=Array.isArray(deposit.history)?deposit.history:[];
  if(!items.length)return '<p>Движений пока нет.</p>';
  const kindLabel=(kind)=>kind==='deposit-funding'?'Внесение':kind==='deposit-withdrawal'?'Возврат остатка':kind==='refund'?'Возврат оплаты':'Использование при оплате';
  return v2ListEntries([...items].reverse().map((item)=>v2ListEntry({
    title:kindLabel(item.kind),
    subtitle:shortDateTime(item.occurredAt,'—'),
    rightTop:`${item.direction==='in'?'+':'−'}${money(item.amount)}`,
    interactive:false,
  })));
}

async function openDepositLayer(root,depositId,person){
  const refresh=async()=>{
    const deposits=await listPersonDeposits(person.key||person.id||'');
    const deposit=deposits.find((item)=>String(item.depositId)===String(depositId));
    if(!deposit)return;
    layer.innerHTML=page([
      header(deposit.programName||'Депозит',{c:Number(deposit.balance||0)>0.009?{label:'Возврат',data:'data-deposit-withdraw',aria:'Вернуть остаток депозита'}:null}),
      `<section>${card(depositFields(deposit),{interactive:false})}</section>`,
      v2Section('Условия',programInfo({...deposit.terms,name:deposit.programName,status:deposit.status,createdAt:deposit.fundedAt})),
      v2Section('История',historyMarkup(deposit)),
    ]);
    layer.querySelector('[data-deposit-withdraw]')?.addEventListener('click',()=>openWithdrawX(root,deposit,refresh));
    notifyContext();
  };
  const layer=mountV2ZLayer(root,v2ZLayer('',{className:'loyalty-deposit-instance-z'}),{stack:true});
  if(!layer)return null;
  await refresh();
  return layer;
}

async function openProgramLayer(root,programId,person,rerenderRoot){
  const program=getDepositPrograms().find((item)=>String(item.id)===String(programId));
  if(!program)return null;
  const layer=mountV2ZLayer(root,v2ZLayer(page([
    header(program.name,{c:program.status==='active'?{label:'Оформить',data:'data-deposit-program-fund',aria:'Оформить депозит'}:null}),
    `<section>${card(programFields(program),{interactive:false})}</section>`,
    v2Section('Условия',programInfo(program)),
  ]),{className:'loyalty-deposit-program-z'}),{stack:true});
  layer?.querySelector('[data-deposit-program-fund]')?.addEventListener('click',()=>openFundQ(root,program,person,async()=>{layer.v2Close?.();await rerenderRoot();}));
  notifyContext();
  return layer;
}

export async function openDepositForPerson(root,person){
  await loadDepositPrograms();
  let deposits=await listPersonDeposits(person.key||person.id||'');
  const layer=mountV2ZLayer(root,v2ZLayer('',{className:'loyalty-deposit-z'}),{stack:true});
  if(!layer)return null;

  const render=async()=>{
    await loadDepositPrograms();
    deposits=await listPersonDeposits(person.key||person.id||'');
    const programs=getDepositPrograms();
    const programCards=programs.length
      ? entityCardStack(programs.map((program)=>card(programFields(program),{data:`data-deposit-program="${escapeHtml(program.id)}"`,aria:`Открыть депозитную программу ${program.name}`})))
      : '<p>Депозитных программ пока нет.</p>';
    const depositCards=deposits.length
      ? entityCardStack(deposits.map((deposit)=>card(depositFields(deposit),{data:`data-person-deposit="${escapeHtml(deposit.depositId)}"`,aria:`Открыть депозит ${deposit.programName}`})))
      : '<p>У человека пока нет депозитов.</p>';
    layer.innerHTML=page([
      header('Депозит',{c:{label:'+',data:'data-deposit-program-add',aria:'Создать депозитную программу'}}),
      v2Section(personLabel(person),depositCards),
      v2Section('Программы',programCards),
    ]);
    layer.querySelector('[data-deposit-program-add]')?.addEventListener('click',()=>openCreateProgramQ(root,render));
    layer.querySelectorAll('[data-deposit-program]').forEach((node)=>node.addEventListener('click',()=>openProgramLayer(root,node.dataset.depositProgram,person,render)));
    layer.querySelectorAll('[data-person-deposit]').forEach((node)=>node.addEventListener('click',()=>openDepositLayer(root,node.dataset.personDeposit,person)));
    notifyContext();
  };

  await render();
  return layer;
}
