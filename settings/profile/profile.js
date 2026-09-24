import { actionBlock, button, collectRepeatedField, entityCard, escapeHtml, field, initPhotoField, initRepeatedFields, mountV2Layer, mountV2ZLayer, page, photoField, repeatedField, select, textareaField, v2HorizontalRail, v2Section, v2WorkspaceContext, v2Layer, v2ZLayer, workplaceAddButton, workplaceCountText } from '../../ui/ui.js';
import { getBookLimit } from '../../core/access.js';
import { addCustomProfession, getCustomProfessions, getProfile, saveProfile as saveProfileData } from './data.js';
import { getWorkplaces } from './workplaces/data.js';
import { openWorkplaceModal } from './workplaces/workplaces.js';

const PROFESSIONS=['Парикмахер','Колорист','Барбер','Визажист','Стилист','Маникюр','Педикюр','Бровист','Лэшмейкер','Косметолог','Массажист','Наращивание волос','Перманентный макияж','Другая'];
const EXPERIENCES=['Без опыта','До 1 года','1–3 года','3–5 лет','5–10 лет','10–15 лет','15–20 лет','Более 20 лет'];
const fullName=p=>[p.name,p.surname].filter(Boolean).join(' ')||'Ваш профиль';
const initial=p=>fullName(p).slice(0,1).toUpperCase()||'?';
const professionOptions=()=>[{value:'',label:'Выберите профессию'},...[...new Set([...PROFESSIONS.filter(p=>p!=='Другая'),...getCustomProfessions(),'Другая'])].map(value=>({value,label:value}))];

export function render(root,navigateBack=()=>{},options={}){renderProfile(root,navigateBack,options)}

function profileContext(p,title='Профиль'){
  return v2WorkspaceContext({
    title,
    a:{kind:'avatar',image:p.photo||'',initials:initial(p),aria:'Настройки профиля'},
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
      {value:`${w.from||'—'}–${w.to||'—'}`,label:'график'}
    ],
    interactive:true,
    data:`data-workplace="${escapeHtml(w.key)}"`,
    aria:`Открыть рабочее пространство ${w.name||''}`,
    className:'entity-card--compact'
  })).join(''),{className:'v2-profile-workplaces'});
}

function profileSettingsFields(p,emails){
  return `<div class="v2-profile-settings-grid">
    ${v2Section('Фото',photoField({name:'profilePhoto',value:p.photo||''}))}
    ${v2Section('Личные данные',`<div class="form-grid">${field({label:'Имя',name:'profileName',value:p.name,placeholder:'Ваше имя',required:true})}${field({label:'Фамилия',name:'profileSurname',value:p.surname,placeholder:'Ваша фамилия'})}${textareaField({label:'О себе',name:'profileAbout',value:p.about||'',placeholder:'Коротко о себе'})}</div>`)}
    ${v2Section('Контактные данные',repeatedField({label:'Телефон',name:'profilePhones',values:p.phones?.length?p.phones:[p.phone||''],type:'tel'})+repeatedField({label:'Telegram',name:'profileTelegrams',values:p.telegrams||[]})+repeatedField({label:'Email',name:'profileEmails',values:emails,type:'email'}))}
    ${v2Section('Профессиональные данные',`<div class="form-grid">${select({label:'Профессия *',name:'profession',value:p.profession||'',options:professionOptions()})}${select({label:'Опыт работы',name:'experience',value:p.experience||'',options:[{value:'',label:'Не указан'},...EXPERIENCES.map(v=>({value:v,label:v}))]})}${textareaField({label:'О профессии',name:'professionAbout',value:p.professionAbout||'',placeholder:'Расскажите о своей профессии'})}</div>`)}
  </div>`;
}

function profileSettingsForm(p,options={}, {embedded=false}={}){
  const emails=p.emails?.length?p.emails:(options.accountEmail?[options.accountEmail]:[]);
  const submit=button('Сохранить',{
    type:'submit',
    data:embedded?'data-save-profile':'data-save-profile data-v2-primary-action data-v2-primary-label="Сохранить"',
  });
  return `<form class="v2-profile-settings-form" data-profile-settings-form>
    ${profileSettingsFields(p,emails)}
    <div data-profile-account-controls-panel></div>
    ${embedded?actionBlock(submit):submit}
  </form>`;
}

function showProfileError(message){
  mountV2Layer(v2Layer(`<div class="modal-title"><h2>Не удалось сохранить</h2><p>${escapeHtml(message||'Ошибка сервера')}</p></div>`,{kind:'system',title:'Не удалось сохранить'}));
}

function openWorkplaceLimitModal(root,limit){
  const current=Number.isFinite(limit)?String(limit):'текущий лимит';
  const m=mountV2Layer(v2Layer(`<div class="modal-title"><h2>Работаете в нескольких местах?</h2><p>Сейчас доступно рабочих пространств: ${escapeHtml(current)}.</p></div>${actionBlock(button('Понятно',{data:'data-close-workplace-limit'}))}`,{kind:'system',title:'Рабочие пространства'}));
  m?.querySelector('[data-close-workplace-limit]')?.addEventListener('click',()=>m.remove());
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
  const m=mountV2Layer(v2Layer(`<form data-custom-profession-form>${field({label:'Профессия',name:'customProfessionModal',placeholder:'Введите профессию',required:true})}<div class="form-error" data-custom-profession-error></div>${button('Сохранить',{type:'submit'})}</form>`,{kind:'quick',title:'Своя профессия'}));
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
      m.remove();
      applyProfessionValue(root,value);
    }catch(saveError){
      if(error)error.textContent=saveError instanceof Error?saveError.message:'Не удалось сохранить профессию';
    }
  });
}

function collectProfileData(root){
  const current=getProfile();
  const phones=collectRepeatedField(root,'profilePhones');
  return {...current,key:'profile',name:root.querySelector('[name="profileName"]')?.value.trim()||'',surname:root.querySelector('[name="profileSurname"]')?.value.trim()||'',phone:phones[0]||'',phones,telegrams:collectRepeatedField(root,'profileTelegrams'),emails:collectRepeatedField(root,'profileEmails'),about:root.querySelector('[name="profileAbout"]')?.value.trim()||'',photo:root.querySelector('[data-photo-value]')?.value||'',profession:root.querySelector('[name="profession"]')?.value||'',experience:root.querySelector('[name="experience"]')?.value||'',professionAbout:root.querySelector('[name="professionAbout"]')?.value.trim()||''};
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

function bindProfileSettings(layer,p,navigateBack,options,onSaved){
  initPhotoField(layer);
  initRepeatedFields(layer);
  layer.querySelector('[name="profession"]')?.addEventListener('change',e=>{if(e.target.value==='Другая')openCustomProfessionModal(layer)});
  layer.querySelector('[data-profile-settings-form]')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const data=collectProfileData(layer);
    if(!data.name||!data.phones.length||!data.profession||data.profession==='Другая')return;
    try{
      await saveProfileData(data);
      onSaved?.();
    }catch(error){
      showProfileError(error instanceof Error?error.message:'Не удалось сохранить профиль');
    }
  });
  if(!options.onboarding){
    import('./account-controls.js').then(({renderAccountControlsPanel})=>{
      const host=layer.querySelector('[data-profile-account-controls-panel]');
      if(host)renderAccountControlsPanel(host);
    });
  }
}

function openProfileSettings(root,navigateBack,options={}){
  const p=getProfile();
  const layer=mountV2ZLayer(root,v2ZLayer(page([
    profileContext(p,'Настройки профиля'),
    profileSettingsForm(p,options)
  ]),{className:'v2-profile-settings-layer'}));
  if(!layer)return;
  layer.querySelector('[data-v2-context-action]')?.addEventListener('click',()=>{});
  bindProfileSettings(layer,p,navigateBack,options,()=>{
    layer.v2Close?.();
    renderProfile(root,navigateBack,options);
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
    openWorkplaceModal(root,existing,()=>renderProfile(root,navigateBack,options));
  };
  open();
}

function renderOnboarding(root,navigateBack,options={}){
  const p=getProfile();
  root.innerHTML=page([
    profileSettingsForm(p,options,{embedded:true}),
    v2Section('Рабочие пространства',workplaceRail()),
    actionBlock(workplaceAddButton())
  ]);
  bindProfileSettings(root,p,navigateBack,options,()=>{});
  root.querySelector('[data-add-workplace]')?.addEventListener('click',()=>openWorkplace(root,null,navigateBack,options));
  root.querySelectorAll('[data-workplace]').forEach(el=>el.addEventListener('click',()=>openWorkplace(root,getWorkplaces().find(w=>w.key===el.dataset.workplace)||null,navigateBack,options)));
}

function promotePrimaryWorkplaceAction(root){
  const control=root.querySelector('[data-add-workplace]');
  if(!control)return;
  control.setAttribute('data-v2-primary-action','');
  control.dataset.v2PrimaryLabel='Добавить';
  control.setAttribute('aria-label','Добавить рабочее пространство');
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
    workplaceAddButton()
  ]);
  promotePrimaryWorkplaceAction(root);
  root.querySelector('[data-v2-context-action]')?.addEventListener('click',()=>openProfileSettings(root,navigateBack,options));
  root.querySelector('[data-add-workplace]')?.addEventListener('click',()=>openWorkplace(root,null,navigateBack,options));
  root.querySelectorAll('[data-workplace]').forEach(el=>el.addEventListener('click',()=>openWorkplace(root,getWorkplaces().find(w=>w.key===el.dataset.workplace)||null,navigateBack,options)));
}
