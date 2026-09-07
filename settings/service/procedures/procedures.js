import { actionBlock, button, collectCost, collectWorkplaceSelections, costCardMeta, costField, costListParts, durationPicker, emptyState, entityCard, escapeHtml, field, iconButton, initCostFields, initDurationPickers, initPhotoField, initWorkplaceSelectors, listEntries, listEntry, mountModal, modal, page, pageHeader, photoField, textareaField, workplaceCountText, workplaceSelector } from '../../../ui/ui.js';
import { getWorkplaces } from '../../profile/workplaces/data.js';
import { deleteProcedure as deleteProcedureData, getProcedures, pushProcedureHistory, saveProcedure as saveProcedureData } from './data.js';

const durationText=m=>{m=Number(m)||0;const h=Math.floor(m/60),min=m%60;return h?`${h} ч${min?` ${min} мин`:''}`:`${min} мин`};

function renderList(root,navigateBack){
  const items=getProcedures();
  root.innerHTML=`<div class="entity-page-header">${pageHeader('Процедуры')}<div class="page-header-action">${iconButton('+',{data:'data-add-procedure',aria:'Добавить процедуру'})}</div></div>${items.length?listEntries(items.map(renderRow)):emptyState('Процедур пока нет','Добавьте первую процедуру кнопкой «+».')}${actionBlock(button('Назад',{className:'ui-button--secondary',data:'data-back-procedures'}))}`;
  root.querySelector('[data-add-procedure]')?.addEventListener('click',()=>openForm(root,null,navigateBack));
  root.querySelectorAll('[data-procedure]').forEach(el=>el.addEventListener('click',()=>renderCard(root,el.dataset.procedure,navigateBack)));
  root.querySelectorAll('[data-delete-action]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();confirmDelete(root,el.dataset.deleteAction,navigateBack,()=>renderList(root,navigateBack))}));
  root.querySelector('[data-back-procedures]')?.addEventListener('click',navigateBack);
}

function renderRow(p){
  const price=costListParts(p.cost),workplaceCount=(p.workplaces||[]).length;
  return listEntry({title:p.name||'',subtitle:`${durationText(p.duration)} — ${workplaceCountText(workplaceCount)}`,image:p.photo||'',initial:(p.name||'?').slice(0,1).toUpperCase(),rightTop:price.rightTop||'',rightBottom:price.rightBottom||'',interactive:true,data:`data-procedure="${escapeHtml(p.id)}"`,aria:`Открыть процедуру ${p.name||''}`,deleteData:p.id,deleteAria:`Удалить процедуру ${p.name||''}`});
}

function openForm(root,existing=null,navigateBack=()=>{}){
  const p=existing||{photo:'',name:'',description:'',duration:0,breakDuration:0,cost:{mode:'amount',amount:'',free:false},workplaces:[]};
  const html=`<form class="compact-form" data-procedure-form><div class="modal-title"><h2>${existing?'Изменить процедуру':'Процедура'}</h2></div>${photoField({name:'procedurePhoto',value:p.photo||''})}${field({label:'Название',name:'procedureName',value:p.name||'',placeholder:'Название процедуры',required:true})}${costField({value:p.cost||{},name:'procedureCost'})}<div class="work-time-row__fields">${durationPicker({label:'Длительность',name:'procedureDuration',value:p.duration||0})}${durationPicker({label:'Перерыв',name:'procedureBreak',value:p.breakDuration||0})}</div>${workplaceSelector({name:'procedureWorkplaces',selected:p.workplaces||[],allowMultiple:true,workplaces:getWorkplaces()})}${textareaField({label:'Описание',name:'procedureDescription',value:p.description||'',placeholder:'Описание процедуры'})}${button('Сохранить',{type:'submit'})}</form>`;
  const m=mountModal(root,modal(html));
  initPhotoField(m);initCostFields(m);initDurationPickers(m);initWorkplaceSelectors(m);
  m.querySelector('[data-procedure-form]')?.addEventListener('submit',e=>{e.preventDefault();saveProcedure(root,m,existing,navigateBack)});
}

function saveProcedure(root,m,existing,navigateBack){
  const data=new FormData(m.querySelector('[data-procedure-form]'));const name=String(data.get('procedureName')||'').trim();if(!name)return;
  const item={id:existing?.id||crypto.randomUUID(),photo:String(data.get('procedurePhoto')||''),name,description:String(data.get('procedureDescription')||'').trim(),duration:Number(data.get('procedureDuration')||0),breakDuration:Number(data.get('procedureBreak')||0),cost:collectCost(m,'procedureCost'),workplaces:collectWorkplaceSelections(m,'procedureWorkplaces'),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
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
    topMeta:[{value:workplaceCountText(workplaceNames.length)}],
    topRightMeta:costCardMeta(p.cost),
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