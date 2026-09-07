import { button, collectLinks, emptyState, entityCard, escapeHtml, initLinks, initPhotoField, initTimePickers, links, mountModal, modal, pageHeader, phoneField, photoField, searchableSelect, select, textareaField, timeInput } from '../../../ui/ui.js';
import { getProfile } from '../data.js';
import { getWorkplaces, upsertWorkplace } from './data.js';

const CITIES=['Москва','Санкт-Петербург','Казань','Нижний Новгород','Екатеринбург','Новосибирск','Самара','Ростов-на-Дону','Краснодар','Сочи','Уфа','Воронеж','Пермь','Волгоград','Омск','Тула','Калининград'];
const fullName=p=>[p.name,p.surname].filter(Boolean).join(' ')||'Ваш профиль';

function fieldRequired(label,name,value,placeholder){return `<label class="field"><span>${escapeHtml(label)} *</span><input name="${escapeHtml(name)}" required value="${escapeHtml(value||'')}" placeholder="${escapeHtml(placeholder||'')}"></label>`}
function fieldOptional(label,name,value,placeholder){return `<label class="field"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" value="${escapeHtml(value||'')}" placeholder="${escapeHtml(placeholder||'')}"></label>`}

export function workplaceList() {
  const items = getWorkplaces();
  if(!items.length)return emptyState('Мест работы пока нет','Добавьте первое место кнопкой «+».');
  return `<div class="workplace-list">${items.map(w=>`<button class="workplace-row" type="button" data-workplace="${escapeHtml(w.key)}"><span><strong>${escapeHtml(w.name||'Без названия')}</strong><small>с ${escapeHtml(w.from||'—')} до ${escapeHtml(w.to||'—')}</small></span><span>›</span></button>`).join('')}</div>`;
}

export function openWorkplaceModal(root, existing = null, onDone = () => {}) {
  const w=existing||{photo:'',name:'',city:'',address:'',phone:'',currency:'RUB',from:'09:00',to:'18:00',links:[],about:''};
  const html=`<form class="compact-form" data-workplace-form><div class="modal-title"><h2>${existing?'Изменить место работы':'Новое место работы'}</h2></div>${photoField({name:'workplacePhoto',value:w.photo||''})}${fieldRequired('Название','workplaceName',w.name,'Название места работы')}${searchableSelect({label:'Город',name:'workplaceCity',value:w.city||'',options:CITIES,placeholder:'Начните вводить',required:true})}${fieldOptional('Адрес','workplaceAddress',w.address,'Адрес')}${phoneField({label:'Рабочий телефон',name:'workplacePhone',value:w.phone||''})}${select({label:'Валюта',name:'workplaceCurrency',value:w.currency||'RUB',options:[{value:'RUB',label:'RUB — ₽'},{value:'EUR',label:'EUR — €'},{value:'USD',label:'USD — $'},{value:'GBP',label:'GBP — £'}]})}<div class="work-time-row"><span class="work-time-row__label">График работы</span><div class="work-time-row__fields">${timeInput({label:'с',name:'workplaceFrom',value:w.from||'09:00'})}${timeInput({label:'до',name:'workplaceTo',value:w.to||'18:00'})}</div></div><div class="array-group"><span class="array-label">Рабочие ссылки</span>${links({links:w.links||[],name:'workplace-links'})}</div>${textareaField({label:'О рабочем пространстве',name:'workplaceAbout',value:w.about||'',placeholder:'Коротко о месте работы'})}<div class="form-error" data-workplace-error></div>${button('Сохранить',{type:'submit'})}</form>`;
  const m=mountModal(root,modal(html));
  initPhotoField(m);initTimePickers(m);initLinks(m);
  m.querySelector('[data-workplace-form]')?.addEventListener('submit',e=>{e.preventDefault();saveWorkplace(m,existing,onDone)});
}

function saveWorkplace(m,existing,onDone){
  const data=new FormData(m.querySelector('[data-workplace-form]')),name=String(data.get('workplaceName')||'').trim(),city=String(data.get('workplaceCity')||'').trim();
  if(!name||!city){m.querySelector('[data-workplace-error]').textContent='Название и город обязательны.';return}
  const profile=getProfile();
  const item={key:existing?.key||crypto.randomUUID(),profileId:profile.key,photo:String(data.get('workplacePhoto')||''),name,city,address:String(data.get('workplaceAddress')||'').trim(),phone:String(data.get('workplacePhone')||'').trim(),currency:String(data.get('workplaceCurrency')||'RUB'),from:String(data.get('workplaceFrom')||''),to:String(data.get('workplaceTo')||''),links:collectLinks(m,'workplace-links'),about:String(data.get('workplaceAbout')||'').trim(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  upsertWorkplace(item);m.remove();onDone();
}

export function renderWorkplace(root,key,navigateBack=()=>{}){
  const w=getWorkplaces().find(x=>x.key===key);if(!w)return navigateBack();
  const p=getProfile();
  root.innerHTML=`${pageHeader(w.name||'Место работы')}${entityCard({image:w.photo||'',initial:(w.name||'?').slice(0,1).toUpperCase(),className:'entity-card--hero entity-card--workplace',top:`<div class="entity-card__workplace-title">${escapeHtml(w.name||'Без названия')}</div><span class="entity-card__workplace-hours">с ${escapeHtml(w.from||'—')} до ${escapeHtml(w.to||'—')}</span>${w.phone?`<span class="entity-card__workplace-phone">${escapeHtml(w.phone)}</span>`:''}`,bottom:`<strong class="entity-card__profile-phone">${escapeHtml(p.phone||'Телефон не указан')}</strong><strong class="entity-card__profile-name">${escapeHtml(fullName(p))}</strong>`,right:`<span class="entity-card__profile-profession">${escapeHtml(p.profession||'Профессия не указана')}</span>`})}<div class="workplace-details"><div><span>Город</span><strong>${escapeHtml(w.city||'—')}</strong></div><div><span>Адрес</span><strong>${escapeHtml(w.address||'—')}</strong></div><div><span>Валюта</span><strong>${escapeHtml(w.currency||'—')}</strong></div>${w.about?`<div><span>О рабочем пространстве</span><strong>${escapeHtml(w.about)}</strong></div>`:''}${w.links?.length?`<div><span>Рабочие ссылки</span><strong>${escapeHtml(w.links.map(l=>`${l.type}: ${l.url}`).join(', '))}</strong></div>`:''}</div><div class="profile-actions">${button('Назад',{className:'ui-button--secondary',data:'data-back-workplaces'})}${button('Изменить',{data:'data-edit-workplace'})}</div>`;
  root.querySelector('[data-back-workplaces]').onclick=navigateBack;
  root.querySelector('[data-edit-workplace]').onclick=()=>openWorkplaceModal(root,w,()=>renderWorkplace(root,key,navigateBack));
}
