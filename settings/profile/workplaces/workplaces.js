import { actionBlock, button, collectLinks, colorPicker, details, emptyState, entityVisualCard, escapeHtml, field, initColorPickers, initLinks, initPhotoField, initTimePickers, links, listEntries, listEntry, mountEntityCardConstructor, mountModal, modal, openColorPickerAction, openSharedProfileSettingsMenu, openTimeRangeAction, page, phoneField, photoField, searchableSelect, select, setSharedProfilePrimary, textareaField, timePicker } from '../../../ui/ui.js';
import { getProfile } from '../data.js';
import { deleteWorkplace as deleteWorkplaceData, getWorkplaces, upsertWorkplace } from './data.js';
import { workplaceCardAppearance, workplaceCardFields } from '../card-presentation.js';

const CITIES=['Москва','Санкт-Петербург','Казань','Нижний Новгород','Екатеринбург','Новосибирск','Самара','Ростов-на-Дону','Краснодар','Сочи','Уфа','Воронеж','Пермь','Волгоград','Омск','Тула','Калининград'];

function emptyWorkplace(){
  return {photo:'',photoCropX:50,photoCropY:50,name:'',color:'',city:'',address:'',phone:'',currency:'RUB',from:'09:00',to:'18:00',links:[],about:'',cardAppearance:{}};
}

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

export function workplaceForm(existing=null,{sourceOnly=false,bodyActions=false}={}){
  const w=existing||emptyWorkplace();
  const primary=sourceOnly
    ? button('Сохранить',{
        className:'v2-primary-source-only',
        data:`data-workplace-primary data-v2-primary-action data-v2-primary-label="Сохранить" data-v2-primary-visible="${existing?'false':'true'}"`,
        aria:'Сохранить',
      })
    : '';
  const body=bodyActions
    ? actionBlock(`${button('Сохранить',{type:'submit'})}${existing?button('Удалить',{variant:'danger',data:'data-delete-workplace-form'}):''}`)
    : '';
  const settingsFields=bodyActions
    ? `${photoField({
        name:'workplacePhoto',
        value:w.photo||'',
        cropX:w.photoCropX,
        cropY:w.photoCropY,
        cropXName:'workplacePhotoCropX',
        cropYName:'workplacePhotoCropY',
      })}
      ${colorPicker({name:'workplaceColor',value:w.color||'',required:true})}
      <div class="work-time-row"><span class="work-time-row__label">График работы</span><div class="work-time-row__fields">${timePicker({label:'С',name:'workplaceFrom',value:w.from||'09:00'})}${timePicker({label:'До',name:'workplaceTo',value:w.to||'18:00'})}</div></div>`
    : `<input type="hidden" name="workplacePhoto" value="${escapeHtml(w.photo||'')}">
      <input type="hidden" name="workplacePhotoCropX" value="${Number(w.photoCropX||50)}">
      <input type="hidden" name="workplacePhotoCropY" value="${Number(w.photoCropY||50)}">
      <input type="hidden" name="workplaceColor" value="${escapeHtml(w.color||'')}">
      <input type="hidden" name="workplaceFrom" value="${escapeHtml(w.from||'09:00')}">
      <input type="hidden" name="workplaceTo" value="${escapeHtml(w.to||'18:00')}">`;
  return `<form class="compact-form workplace-form" data-workplace-form>
    <input type="hidden" name="workplaceCardAppearance" value="${escapeHtml(JSON.stringify(w.cardAppearance||{}))}">
    ${settingsFields}
    ${field({label:'Название',name:'workplaceName',value:w.name,placeholder:'Название рабочего пространства',required:true})}
    ${searchableSelect({label:'Город',name:'workplaceCity',value:w.city||'',options:CITIES,placeholder:'Город',required:true})}
    ${field({label:'Адрес',name:'workplaceAddress',value:w.address,placeholder:'Адрес'})}
    ${phoneField({label:'Телефон',name:'workplacePhone',value:w.phone||''})}
    ${select({label:'Валюта',name:'workplaceCurrency',value:w.currency||'RUB',options:[{value:'RUB',label:'RUB — ₽'},{value:'EUR',label:'EUR — €'},{value:'USD',label:'USD — $'},{value:'GBP',label:'GBP — £'}]})}
    <div class="array-group"><span class="array-label">Ссылки</span>${links({links:w.links||[],name:'workplace-links'})}</div>
    ${textareaField({label:'О рабочем пространстве',name:'workplaceAbout',value:w.about||'',placeholder:'Коротко о рабочем пространстве'})}
    <div class="form-error" data-workplace-error></div>
    ${primary}
    ${body}
  </form>`;
}
function formSnapshot(form){
  if(!form)return '';
  return JSON.stringify([...new FormData(form).entries()].map(([key,value])=>[key,typeof value==='string'?value:'']));
}

function parseCardAppearance(value){
  try{
    const parsed=JSON.parse(String(value||'{}'));
    return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
  }catch{return {}}
}

function collectWorkplaceForm(root,existing){
  const form=root.querySelector('[data-workplace-form]');
  const data=new FormData(form);
  const name=String(data.get('workplaceName')||'').trim();
  const city=String(data.get('workplaceCity')||'').trim();
  const color=String(data.get('workplaceColor')||'').trim();
  const profile=getProfile();
  return {
    valid:Boolean(name&&city&&color),
    item:{
      key:existing?.key||crypto.randomUUID(),
      profileId:profile.key,
      photo:String(data.get('workplacePhoto')||''),
      photoCropX:Number(data.get('workplacePhotoCropX')||50),
      photoCropY:Number(data.get('workplacePhotoCropY')||50),
      name,
      color,
      city,
      address:String(data.get('workplaceAddress')||'').trim(),
      phone:String(data.get('workplacePhone')||'').trim(),
      currency:String(data.get('workplaceCurrency')||'RUB'),
      from:String(data.get('workplaceFrom')||''),
      to:String(data.get('workplaceTo')||''),
      links:collectLinks(root,'workplace-links'),
      about:String(data.get('workplaceAbout')||'').trim(),
      cardAppearance:parseCardAppearance(data.get('workplaceCardAppearance')),
      createdAt:existing?.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString(),
    },
  };
}

async function saveWorkplace(root,existing,onDone){
  const {valid,item}=collectWorkplaceForm(root,existing);
  const error=root.querySelector('[data-workplace-error]');
  if(!valid){if(error)error.textContent='Название, город и цвет обязательны.';return false}
  try{
    const saved=await upsertWorkplace(item);
    if(error)error.textContent='';
    onDone?.(saved);
    return true;
  }catch(saveError){
    if(error)error.textContent=saveError instanceof Error?saveError.message:'Не удалось сохранить рабочее пространство';
    return false;
  }
}

export function bindWorkplaceForm(root,existing=null,{onSaved=()=>{},onDeleted=()=>{}}={}){
  const form=root.querySelector('[data-workplace-form]');
  if(!form)return ()=>{};
  if(root.querySelector('[data-photo-field]'))initPhotoField(root);
  if(root.querySelector('[data-color-picker]'))initColorPickers(root);
  if(root.querySelector('[data-time-picker]'))initTimePickers(root);
  initLinks(root);

  const primary=root.querySelector('[data-workplace-primary]');
  const initial=formSnapshot(form);
  let dirty=!existing;

  const syncPrimary=()=>{
    if(!primary)return;
    setSharedProfilePrimary(primary,{visible:dirty,label:'Сохранить'});
  };
  const syncDirty=()=>{
    dirty=!existing||formSnapshot(form)!==initial;
    syncPrimary();
  };

  form.addEventListener('input',syncDirty);
  form.addEventListener('change',syncDirty);
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();
    if(primary)setSharedProfilePrimary(primary,{visible:true,label:'Сохранить',disabled:true});
    const saved=await saveWorkplace(root,existing,onSaved);
    if(!saved&&primary)setSharedProfilePrimary(primary,{visible:true,label:'Сохранить',disabled:false});
  });

  primary?.addEventListener('click',()=>form.requestSubmit());

  root.querySelector('[data-delete-workplace-form]')?.addEventListener('click',(event)=>{
    event.preventDefault();
    if(existing)confirmDeleteWorkplace(root,existing.key,onDeleted);
  });
  syncPrimary();

  return ()=>{
    form.removeEventListener('input',syncDirty);
    form.removeEventListener('change',syncDirty);
  };
}

function setWorkplaceDraft(root,name,value){
  const input=root.querySelector(`[name="${CSS.escape(name)}"]`);
  if(!input)return;
  input.value=String(value??'');
  input.dispatchEvent(new Event('change',{bubbles:true}));
}

function syncWorkplaceAvatar(root,photo){
  const source=root.querySelector('[data-workspace-context-action]');
  if(source){
    source.dataset.workspaceAImage=String(photo||'');
    source.dataset.workspaceAImagePosition='50% 50%';
    window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
  }
}

function workplaceDraftFromForm(root,existing=null){
  const form=root.querySelector('[data-workplace-form]');
  if(!form)return existing||emptyWorkplace();
  const data=new FormData(form);
  return {
    ...(existing||emptyWorkplace()),
    name:String(data.get('workplaceName')||'').trim(),
    city:String(data.get('workplaceCity')||'').trim(),
    address:String(data.get('workplaceAddress')||'').trim(),
    phone:String(data.get('workplacePhone')||'').trim(),
    currency:String(data.get('workplaceCurrency')||'RUB'),
    from:String(data.get('workplaceFrom')||''),
    to:String(data.get('workplaceTo')||''),
    photo:String(data.get('workplacePhoto')||''),
    photoCropX:Number(data.get('workplacePhotoCropX')||50),
    photoCropY:Number(data.get('workplacePhotoCropY')||50),
    cardAppearance:parseCardAppearance(data.get('workplaceCardAppearance')),
  };
}

function openWorkplaceAppearance(root,existing=null,{onSaved=()=>{}}={}){
  const draft=workplaceDraftFromForm(root,existing);
  const profile=getProfile();
  const layer=mountModal(document.body,modal('<div data-workplace-card-constructor></div>',{
    variant:'large',
    surface:'app',
    title:'Вид',
    className:'modal--entity-card-constructor',
  }));
  const host=layer?.querySelector('[data-workplace-card-constructor]');
  if(!host)return layer;
  mountEntityCardConstructor(host,{
    appearance:workplaceCardAppearance(draft),
    fields:workplaceCardFields(draft,profile),
    photo:draft.photo||'',
    photoPosition:`${Number(draft.photoCropX||50)}% ${Number(draft.photoCropY||50)}%`,
    onSave:async({appearance,photo})=>{
      setWorkplaceDraft(root,'workplacePhoto',photo);
      setWorkplaceDraft(root,'workplaceCardAppearance',JSON.stringify(appearance));
      syncWorkplaceAvatar(root,photo);
      if(existing){
        const collected=collectWorkplaceForm(root,existing);
        if(!collected.valid)throw new Error('Сначала заполните название, город и цвет.');
        const saved=await upsertWorkplace(collected.item);
        onSaved(saved);
      }
    },
  });
  return layer;
}

export function openWorkplaceSettingsMenu(root,existing=null,{onDeleted=()=>{},onAppearanceSaved=()=>{}}={}){
  const form=root.querySelector('[data-workplace-form]');
  if(!form)return null;
  const data=()=>new FormData(form);
  const actions=[
    {
      id:'appearance',
      label:'Вид',
      onSelect:()=>openWorkplaceAppearance(root,existing,{onSaved:onAppearanceSaved}),
    },
    {
      id:'color',
      label:'Выбор цвета',
      onSelect:()=>openColorPickerAction({
        value:String(data().get('workplaceColor')||''),
        onSelect:(value)=>setWorkplaceDraft(root,'workplaceColor',value),
      }),
    },
    {
      id:'schedule',
      label:'График работы',
      onSelect:()=>openTimeRangeAction({
        from:String(data().get('workplaceFrom')||'09:00'),
        to:String(data().get('workplaceTo')||'18:00'),
        onSave:({from,to})=>{
          setWorkplaceDraft(root,'workplaceFrom',from);
          setWorkplaceDraft(root,'workplaceTo',to);
        },
      }),
    },
  ];
  if(existing){
    actions.push({
      id:'delete',
      label:'Удалить пространство',
      variant:'critical',
      onSelect:()=>confirmDeleteWorkplace(root,existing.key,onDeleted),
    });
  }
  return openSharedProfileSettingsMenu({
    title:'Настройки пространства',
    actions,
    data:'data-workplace-settings-menu',
  });
}

export function openWorkplaceModal(root, existing = null, onDone = () => {}) {
  const html=workplaceForm(existing,{bodyActions:true});
  const m=mountModal(root,modal(html,{variant:'large',title:existing?'Рабочее пространство':'Новое рабочее пространство'}));
  if(!m)return null;
  bindWorkplaceForm(m,existing,{
    onSaved:()=>{m.v2Close?.();onDone();},
    onDeleted:()=>{m.v2Close?.();onDone();},
  });
  return m;
}

export function confirmDeleteWorkplace(root,key,onDeleted=()=>{}){
  const w=getWorkplaces().find(x=>x.key===key);if(!w)return;
  const m=mountModal(root,modal(`<div class="modal-title"><h2>Удалить пространство?</h2><p>${escapeHtml(w.name||'Рабочее пространство')} будет убрано из активных пространств. Исторические данные сохранятся.</p></div><div class="form-error" data-workplace-delete-error></div><div class="modal-actions">${button('Удалить',{variant:'danger',data:'data-confirm-delete-workplace'})}${button('Отмена',{variant:'secondary',data:'data-cancel-delete-workplace'})}</div>`,{variant:'compact',title:'Удаление рабочего пространства'}));
  if(!m)return;
  m.querySelector('[data-cancel-delete-workplace]').onclick=()=>m.v2Close?.();
  m.querySelector('[data-confirm-delete-workplace]').onclick=async()=>{
    try{
      if(await deleteWorkplaceData(key)){m.v2Close?.();onDeleted();}else m.v2Close?.();
    }catch(deleteError){
      const error=m.querySelector('[data-workplace-delete-error]');
      if(error)error.textContent=deleteError instanceof Error?deleteError.message:'Не удалось удалить рабочее пространство';
    }
  };
}

export function renderWorkplace(root,key,navigateBack=()=>{}){
  const w=getWorkplaces().find(x=>x.key===key);if(!w)return navigateBack();
  const profile=getProfile();
  const card=entityVisualCard({
    appearance:workplaceCardAppearance(w),
    fields:workplaceCardFields(w,profile),
    image:w.photo||'',
    imagePosition:`${Number(w.photoCropX||50)}% ${Number(w.photoCropY||50)}%`,
  });
  const info=details([
    {label:'Город',value:w.city||'—'},
    {label:'Адрес',value:w.address||'—'},
    {label:'Валюта',value:w.currency||'—'},
    w.about?{label:'О рабочем пространстве',value:w.about}:null,
    w.links?.length?{label:'Ссылки',value:w.links.map(l=>`${l.type}: ${l.url}`).join(', ')}:null
  ]);
  root.innerHTML=page([card,info,actionBlock(`${button('Изменить',{data:'data-edit-workplace'})}${button('Назад',{variant:'secondary',data:'data-back-workplaces'})}${button('Удалить',{variant:'danger',data:'data-delete-workplace-card'})}`)]);
  root.querySelector('[data-back-workplaces]').onclick=navigateBack;
  root.querySelector('[data-edit-workplace]').onclick=()=>openWorkplaceModal(root,w,()=>renderWorkplace(root,key,navigateBack));
  root.querySelector('[data-delete-workplace-card]').onclick=()=>confirmDeleteWorkplace(root,key,navigateBack);
}
