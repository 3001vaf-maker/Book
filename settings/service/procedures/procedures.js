import { actionBlock, button, collectCost, collectWorkplaceSelections, costField, durationPicker, emptyState, entityCard, escapeHtml, field, iconButton, initCostFields, initDurationPickers, initPhotoField, initWorkplaceSelectors, listEntries, listEntry, mountModal, modal, page, pageHeader, photoField, workplaceSelector } from '../../../ui/ui.js';
import { getWorkplaces } from '../../profile/workplaces/data.js';
import { deleteProcedure as deleteProcedureData, getProcedures, pushProcedureHistory, saveProcedure as saveProcedureData } from './data.js';

const durationText=m=>{m=Number(m)||0;const h=Math.floor(m/60),min=m%60;return h?`${h} ч${min?` ${min} мин`:''}`:`${min} мин`};
const salonCountText=count=>{const n=Math.max(0,Number(count)||0),m10=n%10,m100=n%100;const word=m10===1&&m100!==11?'салон':m10>=2&&m10<=4&&(m100<12||m100>14)?'салона':'салонов';return `${n} ${word}`};
const fmt=v=>v===''||v==null?'':`${Number(v).toLocaleString('ru-RU')} ₽`;
const costParts=cost=>{if(!cost||cost.free)return{rightTop:'Бесплатно'};if(cost.mode==='from-to')return{rightTop:`от ${fmt(cost.from)}`,rightBottom:`до ${fmt(cost.to)}`};if(cost.mode==='from')return{rightTop:`от ${fmt(cost.from??cost.amount)}`};return{rightTop:fmt(cost.amount??cost.from)}};
const cardCostMeta=cost=>{
  if(!cost||cost.free)return[{value:'стоимость',weight:'regular'},{value:'Бесплатно'}];
  if(cost.mode==='from-to')return[{value:`от ${fmt(cost.from)}`,weight:'regular'},{value:`до ${fmt(cost.to)}`,weight:'regular'}];
  if(cost.mode==='from')return[{value:'от',weight:'regular'},{value:fmt(cost.from??cost.amount)}];
  return[{value:'стоимость',weight:'regular'},{value:fmt(cost.amount??cost.from)||'—'}];
};

function renderList(root,navigateBack){
  const items=getProcedures();
  root.innerHTML=`<div class="entity-page-header">${pageHeader('Процедуры')}<div class="page-header-action">${iconButton('+',{className:'icon-button--primary',data:'data-add-procedure',aria:'Добавить процедуру'})}</div></div>${items.length?listEntries(items.map(renderRow)):emptyState('Процедур пока нет','Добавьте первую процедуру кнопкой «+».')}${actionBlock(button('Назад',{className:'ui-button--secondary',data:'data-back-procedures'}))}`;
  root.querySelector('[data-add-procedure]')?.addEventListener('click',()=>openForm(root,null,navigateBack));
  root.querySelectorAll('[data-procedure]').forEach(el=>el.addEventListener('click',()=>renderCard(root,el.dataset.procedure,navigateBack)));
  root.querySelectorAll('[data-delete-action]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();confirmDelete(root,el.dataset.deleteAction,navigateBack,()=>renderList(root,navigateBack))}));
  root.querySelector('[data-back-procedures]')?.addEventListener('click',navigateBack);
}

function renderRow(p){
  const price=costParts(p.cost),salons=(p.workplaces||[]).length;
  return listEntry({title:p.name||'',subtitle:`${durationText(p.duration)} — ${salonCountText(salons)}`,image:p.photo||'',initial:(p.name||'?').slice(0,1).toUpperCase(),rightTop:price.rightTop||'',rightBottom:price.rightBottom||'',interactive:true,data:`data-procedure="${escapeHtml(p.id)}"`,aria:`Открыть процедуру ${p.name||''}`,deleteData:p.id,deleteAria:`Удалить процедуру ${p.name||''}`});
}

function openForm(root,existing=null,navigateBack=()=>{}){
  const p=existing||{photo:'',name:'',duration:0,breakDuration:0,cost:{mode:'amount',amount:'',free:false},workplaces:[]};
  const html=`<form class="compact-form" data-procedure-form><div class="modal-title"><h2>${existing?'Изменить процедуру':'Процедура'}</h2></div>${photoField({name:'procedurePhoto',value:p.photo||''})}${field({label:'Название',name:'procedureName',value:p.name||'',placeholder:'Название процедуры',required:true})}${costField({value:p.cost||{},name:'procedureCost'})}<div class="work-time-row__fields">${durationPicker({label:'Длительность',name:'procedureDuration',value:p.duration||0})}${durationPicker({label:'Перерыв',name:'procedureBreak',value:p.breakDuration||0})}</div><div class="array-group"><span class="array-label">Рабочие места</span>${workplaceSelector({name:'procedureWorkplaces',selected:p.workplaces||[],allowMultiple:true,workplaces:getWorkplaces()})}</div>${button('Сохранить',{type:'submit'})}</form>`;
  const m=mountModal(root,modal(html));
  initPhotoField(m);initCostFields(m);initDurationPickers(m);initWorkplaceSelectors(m);
  m.querySelector('[data-procedure-form]')?.addEventListener('submit',e=>{e.preventDefault();saveProcedure(root,m,existing,navigateBack)});
}

function saveProcedure(root,m,existing,navigateBack){
  const data=new FormData(m.querySelector('[data-procedure-form]'));const name=String(data.get('procedureName')||'').trim();if(!name)return;
  const item={id:existing?.id||crypto.randomUUID(),photo:String(data.get('procedurePhoto')||''),name,duration:Number(data.get('procedureDuration')||0),breakDuration:Number(data.get('procedureBreak')||0),cost:collectCost(m,'procedureCost'),workplaces:collectWorkplaceSelections(m,'procedureWorkplaces'),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(existing)pushProcedureHistory(existing,'updated');saveProcedureData(item);m.remove();renderList(root,navigateBack);
}

function renderCard(root,id,navigateBack){
  const p=getProcedures().find(x=>x.id===id);if(!p)return renderList(root,navigateBack);
  const workplaceNames=(p.workplaces||[]).map(w=>w.name||w.workplaceId).filter(Boolean);
  const card=entityCard({
    title:p.name||'',
    subtitle:durationText(p.duration),
    image:p.photo||'',
    initial:(p.name||'?').slice(0,1).toUpperCase(),
    topMeta:[{value:salonCountText(workplaceNames.length)}],
    topRightMeta:cardCostMeta(p.cost),
    meta:workplaceNames.map(name=>({value:name})),
    metricsLayout:'vertical',
    className:'entity-card--hero entity-card--top-dark'
  });
  root.innerHTML=page([card,actionBlock(`${button('Редактировать процедуру',{data:'data-edit-procedure'})}${button('Назад',{className:'ui-button--secondary',data:'data-back-procedures-card'})}${button('Удалить',{variant:'danger',data:'data-delete-card'})}`)]);
  root.querySelector('[data-edit-procedure]').onclick=()=>openForm(root,p,navigateBack);
  root.querySelector('[data-delete-card]').onclick=()=>confirmDelete(root,id,navigateBack,()=>renderList(root,navigateBack));
  root.querySelector('[data-back-procedures-card]').onclick=()=>renderList(root,navigateBack);
}

function confirmDelete(root,id,navigateBack,onDeleted){
  const p=getProcedures().find(x=>x.id===id);if(!p)return;
  const m=mountModal(root,modal(`<div class="modal-title"><h2>Удалить?</h2><p>${escapeHtml(p.name||'Процедура')} будет удалена.</p></div><div class="modal-actions">${button('Удалить',{variant:'danger',data:'data-confirm-delete'})}${button('Отмена',{className:'ui-button--secondary',data:'data-cancel-delete'})}</div>`,{variant:'compact'}));
  if(!m)return;
  m.querySelector('[data-cancel-delete]').onclick=()=>m.remove();
  m.querySelector('[data-confirm-delete]').onclick=()=>{if(deleteProcedureData(id)){m.remove();onDeleted?.()}else m.remove()};
}

export function renderProcedures(root,navigateBack=()=>{}){renderList(root,navigateBack)}
