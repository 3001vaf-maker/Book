import { actionBlock, button, collectRepeatedField, entityCard, escapeHtml, field, initPhotoField, initRepeatedFields, modal, mountModal, mountV2ZLayer, page, photoField, repeatedField, select, textareaField, v2HorizontalRail, v2Section, workspaceHeaderContext, v2ZLayer, workplaceAddButton, workplaceCountText } from '../../ui/ui.js';
import { getBookLimit } from '../../core/access.js';
import { addCustomProfession, getCustomProfessions, getProfile, saveProfile as saveProfileData } from './data.js';
import { getWorkplaces } from './workplaces/data.js';
import { bindWorkplaceForm, openWorkplaceModal, workplaceForm } from './workplaces/workplaces.js';

const PROFESSIONS=['Парикмахер','Колорист','Барбер','Визажист','Стилист','Маникюр','Педикюр','Бровист','Лэшмейкер','Косметолог','Массажист','Наращивание волос','Перманентный макияж','Другая'];
const EXPERIENCES=['Без опыта','До 1 года','1–3 года','3–5 лет','5–10 лет','10–15 лет','15–20 лет','Более 20 лет'];
const fullName=p=>[p.name,p.surname].filter(Boolean).join(' ')||'Ваш профиль';
const initial=p=>fullName(p).slice(0,1).toUpperCase()||'?';
const crop=v=>Number.isFinite(Number(v))?Math.max(0,Math.min(100,Math.round(Number(v)))):50;
const avatarPosition=p=>`${crop(p.photoCropX)}% ${crop(p.photoCropY)}%`;
const professionOptions=()=>[{value:'',label:'Выберите профессию'},...[...new Set([...PROFESSIONS.filter(p=>p!=='Другая'),...getCustomProfessions(),'Другая'])].map(value=>({value,label:value}))];

export function render(root,navigateBack=()=>{},options={}){renderProfile(root,navigateBack,options)}

function profileContext(p,title='Профиль'){
  return workspaceHeaderContext({
    title,
    a:{kind:'avatar',image:p.photo||'',imagePosition:avatarPosition(p),initials:initial(p),aria:'Настройки профиля'},
    hideD:true,
  });
}

function profileCard(p){
  const workplaceCount=getWorkplaces().length;
  return entityCard({
    title:fullName(p),
    subtitle:p.phones?.[0]||p.phone||'',
    image:p.photo||'',
    initial:initial(p),
    topMeta:[
      {value:p.profession||'—'},
      {value:p.experience||'—'}
    ],
    meta:[
      {value:workplaceCountText(workplaceCount)}
    ],
    metricsLayout:'end',
    interactive:true,
    data:'data-profile-card',
    aria:'Открыть данные профиля',
    className:'entity-card--hero entity-card--top-light'
  });
}

function workplaceRail(){
  const items=getWorkplaces();
  if(!items.length){
    return '<div class="v2-profile-empty">Рабочих пространств пока нет.</div>';
  }
  return v2HorizontalRail(items.map(w=>entityCard({
    title:w.name||'Без названия',
    subtitle:w.city||w.address||'',
    image:w.photo||'',
    initial:(w.name||'?').slice(0,1).toUpperCase(),
    meta:[
      {value:w.city||'—',label:'город'},
      {value:`${w.from||'—'}–${w.to||'—'}`,label:'график'}
    ],
    metricsLayout:'horizontal',
    interactive:true,
    data:`data-workplace="${escapeHtml(w.key)}"`,
    aria:`Открыть рабочее пространство ${w.name||''}`,
    className:'entity-card--hero entity-card--rail entity-card--top-light'
  })).join(''),{className:'v2-profile-workplaces'});
}

function profileDataFields(p,emails){
  return `<div class="v2-profile-data-grid">
    ${v2Section('Личные данные',`<div class="form-grid">${photoField({
      name:'profilePhoto',
      value:p.photo||'',
      cropX:p.photoCropX,
      cropY:p.photoCropY,
      cropXName:'profilePhotoCropX',
      cropYName:'profilePhotoCropY',
    })}${field({label:'Имя',name:'profileName',value:p.name,placeholder:'Ваше имя',required:true})}${field({label:'Фамилия',name:'profileSurname',value:p.surname,placeholder:'Ваша фамилия'})}${textareaField({label:'О себе',name:'profileAbout',value:p.about||'',placeholder:'Коротко о себе'})}</div>`)}
    ${v2Section('Контактные данные',repeatedField({label:'Телефон',name:'profilePhones',values:p.phones?.length?p.phones:[p.phone||''],type:'tel'})+repeatedField({label:'Telegram',name:'profileTelegrams',values:p.telegrams||[]})+repeatedField({label:'Email',name:'profileEmails',values:emails,type:'email'}))}
    ${v2Section('Профессиональные данные',`<div class="form-grid">${select({label:'Профессия *',name:'profession',value:p.profession||'',options:professionOptions()})}${select({label:'Опыт работы',name:'experience',value:p.experience||'',options:[{value:'',label:'Не указан'},...EXPERIENCES.map(v=>({value:v,label:v}))]})}${textareaField({label:'О профессии',name:'professionAbout',value:p.professionAbout||'',placeholder:'Расскажите о своей профессии'})}</div>`)}
  </div>`;
}

function profileDataForm(p,options={}, {embedded=false}={}){
  const emails=p.emails?.length?p.emails:(options.accountEmail?[options.accountEmail]:[]);
  const bodySave=embedded?actionBlock(button('Сохранить',{type:'submit',data:'data-save-profile'})):'';
  const primary=embedded?'':button('Сохранить',{
    className:'v2-primary-source-only',
    data:'data-save-profile data-v2-primary-action data-v2-primary-label="Сохранить" data-v2-primary-visible="false"',
    aria:'Сохранить',
  });
  return `<form class="v2-profile-data-form" data-profile-data-form>
    ${profileDataFields(p,emails)}
    <div class="form-error" data-profile-error></div>
    ${primary}
    ${bodySave}
  </form>`;
}

function formSnapshot(form){
  if(!form)return '';
  return JSON.stringify([...new FormData(form).entries()].map(([key,value])=>[key,typeof value==='string'?value:'']));
}

function showProfileError(message){
  mountModal(document.body,modal(`<div class="modal-title"><h2>Не удалось сохранить</h2><p>${escapeHtml(message||'Ошибка сервера')}</p></div>`,{variant:'compact',title:'Не удалось сохранить'}));
}

function openWorkplaceLimitModal(root,limit){
  const current=Number.isFinite(limit)?String(limit):'текущий лимит';
  const m=mountModal(root,modal(`<div class="modal-title"><h2>Работаете в нескольких местах?</h2><p>Сейчас доступно рабочих пространств: ${escapeHtml(current)}.</p></div>${actionBlock(button('Понятно',{data:'data-close-workplace-limit'}))}`,{variant:'compact',title:'Рабочие пространства'}));
  m?.querySelector('[data-close-workplace-limit]')?.addEventListener('click',()=>m.v2Close?.());
}

function applyProfessionValue(root,value){
  const input=root.querySelector('[name="profession"]');
  const trigger=input?.closest('.ui-select')?.querySelector('[data-ui-select-trigger]');
  if(!input||!trigger)return;
  input.value=value;
  const valueNode=trigger.querySelector('.ui-select__value');
  if(valueNode)valueNode.textContent=value||'Выберите профессию';
  trigger.dataset.options=JSON.stringify(professionOptions());
  input.dispatchEvent(new Event('change',{bubbles:true}));
}

function openCustomProfessionModal(root){
  const m=mountModal(root,modal(`<form data-custom-profession-form>${field({label:'Профессия',name:'customProfessionModal',placeholder:'Введите профессию',required:true})}<div class="form-error" data-custom-profession-error></div>${button('Сохранить',{type:'submit'})}</form>`,{variant:'quick',title:'Своя профессия'}));
  if(!m)return;
  const input=m.querySelector('[name="customProfessionModal"]');
  input?.focus();
  m.querySelector('[data-custom-profession-form]')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const value=input?.value.trim()||'';
    const error=m.querySelector('[data-custom-profession-error]');
    if(!value){if(error)error.textContent='Введите профессию.';return}
    try{
      await addCustomProfession(value);
      m.v2Close?.();
      applyProfessionValue(root,value);
    }catch(saveError){
      if(error)error.textContent=saveError instanceof Error?saveError.message:'Не удалось сохранить профессию';
    }
  });
}

function collectProfileData(root){
  const current=getProfile();
  const phones=collectRepeatedField(root,'profilePhones');
  return {
    ...current,
    key:'profile',
    name:root.querySelector('[name="profileName"]')?.value.trim()||'',
    surname:root.querySelector('[name="profileSurname"]')?.value.trim()||'',
    phone:phones[0]||'',
    phones,
    telegrams:collectRepeatedField(root,'profileTelegrams'),
    emails:collectRepeatedField(root,'profileEmails'),
    about:root.querySelector('[name="profileAbout"]')?.value.trim()||'',
    photo:root.querySelector('[data-photo-value]')?.value||'',
    photoCropX:Number(root.querySelector('[name="profilePhotoCropX"]')?.value||50),
    photoCropY:Number(root.querySelector('[name="profilePhotoCropY"]')?.value||50),
    profession:root.querySelector('[name="profession"]')?.value||'',
    experience:root.querySelector('[name="experience"]')?.value||'',
    professionAbout:root.querySelector('[name="professionAbout"]')?.value.trim()||''
  };
}

async function persistDraft(root){
  const data=collectProfileData(root);
  await saveProfileData(data);
  return data;
}

export function isOnboardingProfileReady(root){
  const data=collectProfileData(root);
  return Boolean(data.name&&data.phones.length&&data.profession&&data.profession!=='Другая'&&getWorkplaces().length);
}

export function isOnboardingProfileIdentityReady(root){
  const data=collectProfileData(root);
  return Boolean(data.name&&data.phones.length&&data.profession&&data.profession!=='Другая');
}

export async function saveOnboardingProfile(root){
  if(!isOnboardingProfileReady(root))return false;
  try{
    await persistDraft(root);
    return true;
  }catch(error){
    showProfileError(error instanceof Error?error.message:'Не удалось сохранить профиль');
    return false;
  }
}

function bindProfileData(layer,p,options,onSaved){
  initPhotoField(layer);
  initRepeatedFields(layer);
  const form=layer.querySelector('[data-profile-data-form]');
  const primary=layer.querySelector('[data-save-profile][data-v2-primary-action]');
  const initial=formSnapshot(form);

  const syncDirty=()=>{
    if(!primary||!form)return;
    primary.dataset.v2PrimaryVisible=formSnapshot(form)!==initial?'true':'false';
  };

  layer.querySelector('[name="profession"]')?.addEventListener('change',e=>{if(e.target.value==='Другая')openCustomProfessionModal(layer)});
  form?.addEventListener('input',syncDirty);
  form?.addEventListener('change',syncDirty);

  const save=async()=>{
    const data=collectProfileData(layer);
    if(!data.name||!data.phones.length||!data.profession||data.profession==='Другая')return false;
    try{
      await saveProfileData(data);
      onSaved?.();
      return true;
    }catch(error){
      const target=layer.querySelector('[data-profile-error]');
      if(target)target.textContent=error instanceof Error?error.message:'Не удалось сохранить профиль';
      else showProfileError(error instanceof Error?error.message:'Не удалось сохранить профиль');
      return false;
    }
  };

  form?.addEventListener('submit',async e=>{e.preventDefault();await save()});
  primary?.addEventListener('click',save);
  syncDirty();
}

function openProfileData(root,navigateBack,options={}){
  const p=getProfile();
  const layer=mountV2ZLayer(root,v2ZLayer(page([
    profileContext(p,'Данные профиля'),
    profileDataForm(p,options)
  ]),{className:'v2-profile-data-layer'}));
  if(!layer)return;
  layer.querySelector('[data-workspace-context-action]')?.addEventListener('click',()=>openProfileSettings(root,navigateBack,options));
  bindProfileData(layer,p,options,()=>{
    layer.v2Close?.();
    renderProfile(root,navigateBack,options);
  });
}

function openProfileSettings(root,navigateBack,options={}){
  const p=getProfile();
  const layer=mountV2ZLayer(root,v2ZLayer(page([
    profileContext(p,'Настройки профиля'),
    '<div data-profile-account-controls-panel></div>'
  ]),{className:'v2-profile-settings-layer'}));
  if(!layer)return;
  layer.querySelector('[data-workspace-context-action]')?.addEventListener('click',()=>{});
  import('./account-controls.js').then(({renderAccountControlsPanel})=>{
    const host=layer.querySelector('[data-profile-account-controls-panel]');
    if(host)renderAccountControlsPanel(host);
  });
}

function openWorkplaceZ2(root,existing,navigateBack,options={}){
  const profile=getProfile();
  const title=existing?'Рабочее пространство':'Новое рабочее пространство';
  const layer=mountV2ZLayer(root,v2ZLayer(page([
    workspaceHeaderContext({title,hideD:true}),
    workplaceForm(existing,{sourceOnly:true})
  ]),{className:'v2-workplace-data-layer'}));
  if(!layer)return;
  bindWorkplaceForm(layer,existing,{
    onSaved:()=>{
      layer.v2Close?.();
      renderProfile(root,navigateBack,options);
    },
    onDeleted:()=>{
      layer.v2Close?.();
      renderProfile(root,navigateBack,options);
    },
  });
}

function openWorkplace(root,existing,navigateBack,options={}){
  const open=async()=>{
    if(options.onboarding){
      try{await persistDraft(root)}catch(error){showProfileError(error instanceof Error?error.message:'Не удалось сохранить профиль');return}
    }
    const workplaceLimit=getBookLimit('workplaces.max');
    if(!existing&&workplaceLimit!==null&&getWorkplaces().length>=workplaceLimit){
      openWorkplaceLimitModal(root,workplaceLimit);
      return;
    }
    if(options.onboarding){
      openWorkplaceModal(root,existing,()=>renderProfile(root,navigateBack,options));
      return;
    }
    openWorkplaceZ2(root,existing,navigateBack,options);
  };
  open();
}

function renderOnboarding(root,navigateBack,options={}){
  const p=getProfile();
  root.innerHTML=page([
    profileDataForm(p,options,{embedded:true}),
    v2Section('Рабочие пространства',workplaceRail()),
    actionBlock(workplaceAddButton())
  ]);
  bindProfileData(root,p,options,()=>{});
  root.querySelector('[data-add-workplace]')?.addEventListener('click',()=>openWorkplace(root,null,navigateBack,options));
  root.querySelectorAll('[data-workplace]').forEach(el=>el.addEventListener('click',()=>openWorkplace(root,getWorkplaces().find(w=>w.key===el.dataset.workplace)||null,navigateBack,options)));
}

function rootAddSource(){
  return workplaceAddButton({
    label:'+',
    className:'v2-primary-source-only',
    variant:'',
    data:'data-add-workplace data-v2-primary-action data-v2-primary-label="+"',
  });
}

function renderProfile(root,navigateBack,options={}){
  if(options.onboarding){
    renderOnboarding(root,navigateBack,options);
    return;
  }
  const p=getProfile();
  root.innerHTML=page([
    profileContext(p),
    profileCard(p),
    v2Section('Рабочие пространства',workplaceRail()),
    rootAddSource()
  ]);
  root.querySelector('[data-workspace-context-action]')?.addEventListener('click',()=>openProfileSettings(root,navigateBack,options));
  root.querySelector('[data-profile-card]')?.addEventListener('click',()=>openProfileData(root,navigateBack,options));
  root.querySelector('[data-add-workplace]')?.addEventListener('click',()=>openWorkplace(root,null,navigateBack,options));
  root.querySelectorAll('[data-workplace]').forEach(el=>el.addEventListener('click',()=>openWorkplace(root,getWorkplaces().find(w=>w.key===el.dataset.workplace)||null,navigateBack,options)));
}
