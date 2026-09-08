import { actionBlock, button, collectLinks, colorPicker, details, emptyState, entityCard, escapeHtml, field, initColorPickers, initLinks, initPhotoField, initTimePickers, links, listEntries, listEntry, mountModal, modal, page, phoneField, photoField, searchableSelect, select, textareaField, timePicker } from '../../../ui/ui.js';
import { getProfile } from '../data.js';
import { deleteWorkplace as deleteWorkplaceData, getWorkplaces, upsertWorkplace } from './data.js';

const CITIES=['Москва','Санкт-Петербург','Казань','Нижний Новгород','Екатеринбург','Новосибирск','Самара','Ростов-на-Дону','Краснодар','Сочи','Уфа','Воронеж','Пермь','Волгоград','Омск','Тула','Калининград'];

export function workplaceList() {
  const items = getWorkplaces();
  if(!items.length)return emptyState('Рабочих мест пока нет','Добавьте первое рабочее место кнопкой «+».');
  return listEntries(items.map(w=>listEntry({
    title:w.name||'Без названия',
    subtitle:w.city||'',
    image:w.photo||'',
    initial:(w.name||'?').slice(0,1).toUpperCase(),
    rightTop:`с ${w.from||'—'}`,
    rightBottom:`до ${w.to||'—'}`,
    interactive:true,
    data:`data-workplace="${escapeHtml(w.key)}"`,
    aria:`Открыть рабочее место ${w.name||''}`,
    deleteData:w.key,
    deleteAria:`Удалить рабочее место ${w.name||''}`
  })));
}

export function initWorkplaceListDeletion(root,onDeleted=()=>{}) {
  root.querySelectorAll('[data-delete-action]').forEach(el=>el.addEventListener('click',e=>{
    const row=e.target.closest('[data-workplace]');
    if(!row)return;
    e.stopPropagation();
    confirmDeleteWorkplace(root,el.dataset.deleteAction,onDeleted);
  }));
}

export function openWorkplaceModal(root, existing = null, onDone = () => {}) {
  const w=existing||{photo:'',name:'',color:'',city:'',address:'',phone:'',currency:'RUB',from:'09:00',to:'18:00',links:[],about:''};
  const deleteButton=existing?button('Удалить',{variant:'danger',data:'data-delete-workplace-form'}):'';
  const html=`<form class="compact-form" data-workplace-form><div class="modal-title"><h2>${existing?'Изменить рабочее место':'Новое рабочее место'}</h2></div>${photoField({name:'workplacePhoto',value:w.photo||''})}${field({label:'Название',name:'workplaceName',value:w.name,placeholder:'Название рабочего места',required:true})}${colorPicker({name:'workplaceColor',value:w.color||'',required:true})}${searchableSelect({label:'Город',name:'workplaceCity',value:w.city||'',options:CITIES,placeholder:'Начните вводить',required:true})}${field({label:'Адрес',name:'workplaceAddress',value:w.address,placeholder:'Адрес'})}${phoneField({label:'Рабочий телефон',name:'workplacePhone',value:w.phone||''})}${select({label:'Валюта',name:'workplaceCurrency',value:w.currency||'RUB',options:[{value:'RUB',label:'RUB — ₽'},{value:'EUR',label:'EUR — €'},{value:'USD',label:'USD — $'},{value:'GBP',label:'GBP — £'}]})}<div class="work-time-row"><span class="work-time-row__label">График работы</span><div class="work-time-row__fields">${timePicker({label:'с',name:'workplaceFrom',value:w.from||'09:00'})}${timePicker({label:'до',name:'workplaceTo',value:w.to||'18:00'})}</div></div><div class="array-group"><span class="array-label">Рабочие ссылки</span>${links({links:w.links||[],name:'workplace-links'})}</div>${textareaField({label:'О рабочем пространстве',name:'workplaceAbout',value:w.about||'',placeholder:'Коротко о рабочем месте'})}<div class="form-error" data-workplace-error></div>${button('Сохранить',{type:'submit'})}${deleteButton}</form>`;
  const m=mountModal(root,modal(html));
  initPhotoField(m);initColorPickers(m);initTimePickers(m);initLinks(m);
  m.querySelector('[data-workplace-form]')?.addEventListener('submit',e=>{e.preventDefault();saveWorkplace(m,existing,onDone)});
  m.querySelector('[data-delete-workplace-form]')?.addEventListener('click',e=>{e.preventDefault();confirmDeleteWorkplace(root,existing?.key,()=>{m.remove();onDone();})});
}

function saveWorkplace(m,existing,onDone){
  const data=new FormData(m.querySelector('[data-workplace-form]')),name=String(data.get('workplaceName')||'').trim(),city=String(data.get('workplaceCity')||'').trim(),color=String(data.get('workplaceColor')||'').trim();
  if(!name||!city||!color){m.querySelector('[data-workplace-error]').textContent='Название, город и цвет обязательны.';return}
  const profile=getProfile();
  const item={key:existing?.key||crypto.randomUUID(),profileId:profile.key,photo:String(data.get('workplacePhoto')||''),name,color,city,address:String(data.get('workplaceAddress')||'').trim(),phone:String(data.get('workplacePhone')||'').trim(),currency:String(data.get('workplaceCurrency')||'RUB'),from:String(data.get('workplaceFrom')||''),to:String(data.get('workplaceTo')||''),links:collectLinks(m,'workplace-links'),about:String(data.get('workplaceAbout')||'').trim(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  upsertWorkplace(item);m.remove();onDone();
}

function confirmDeleteWorkplace(root,key,onDeleted=()=>{}){
  const w=getWorkplaces().find(x=>x.key===key);if(!w)return;
  const m=mountModal(root,modal(`<div class="modal-title"><h2>Удалить?</h2><p>${escapeHtml(w.name||'Рабочее место')} будет удалено.</p></div><div class="modal-actions">${button('Удалить',{variant:'danger',data:'data-confirm-delete-workplace'})}${button('Отмена',{className:'ui-button--secondary',data:'data-cancel-delete-workplace'})}</div>`,{variant:'compact'}));
  if(!m)return;
  m.querySelector('[data-cancel-delete-workplace]').onclick=()=>m.remove();
  m.querySelector('[data-confirm-delete-workplace]').onclick=()=>{if(deleteWorkplaceData(key)){m.remove();onDeleted();}else m.remove()};
}

export function renderWorkplace(root,key,navigateBack=()=>{}){
  const w=getWorkplaces().find(x=>x.key===key);if(!w)return navigateBack();
  const card=entityCard({
    title:w.name||'Без названия',
    subtitle:w.phone||w.address||'',
    image:w.photo||'',
    initial:(w.name||'?').slice(0,1).toUpperCase(),
    meta:[
      {value:w.city||'—',label:'город'},
      {value:`${w.from||'—'}–${w.to||'—'}`,label:'график'},
      {value:w.currency||'—',label:'валюта'}
    ],
    className:'entity-card--hero'
  });
  const info=details([
    {label:'Город',value:w.city||'—'},
    {label:'Адрес',value:w.address||'—'},
    {label:'Валюта',value:w.currency||'—'},
    w.about?{label:'О рабочем пространстве',value:w.about}:null,
    w.links?.length?{label:'Рабочие ссылки',value:w.links.map(l=>`${l.type}: ${l.url}`).join(', ')}:null
  ]);
  root.innerHTML=page([card,info,actionBlock(`${button('Изменить',{data:'data-edit-workplace'})}${button('Назад',{className:'ui-button--secondary',data:'data-back-workplaces'})}${button('Удалить',{variant:'danger',data:'data-delete-workplace-card'})}`)]);
  root.querySelector('[data-back-workplaces]').onclick=navigateBack;
  root.querySelector('[data-edit-workplace]').onclick=()=>openWorkplaceModal(root,w,()=>renderWorkplace(root,key,navigateBack));
  root.querySelector('[data-delete-workplace-card]').onclick=()=>confirmDeleteWorkplace(root,key,navigateBack);
}
