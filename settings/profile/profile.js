import { actionBlock, button, collectRepeatedField, entityVisualCard, escapeHtml, field, initPhotoField, initRepeatedFields, modal, mountModal, mountEntityCardConstructor, mountV2ZLayer, openSharedProfileSettingsMenu, openSharedPasswordAction, page, photoField, repeatedField, searchableSelect, select, setSharedProfilePrimary, textareaField, v2HorizontalRail, v2Section, workspaceHeaderContext, v2ZLayer, workplaceAddButton } from '../../ui/ui.js';
import { canUseBookCapability, getBookAccess, getBookLimit, loadBookAccess, requestLiveMode } from '../../core/access.js';
import { changePassword, logout } from '../../core/auth.js';
import { getProfessionCatalog, getProfile, saveProfile as saveProfileData } from './data.js';
import { getWorkplaces } from './workplaces/data.js';
import { bindWorkplaceForm, openWorkplaceSettingsMenu, workplaceForm } from './workplaces/workplaces.js';
import { profileCardAppearance, profileCardFields, workplaceCardAppearance, workplaceCardFields } from './card-presentation.js';

const EXPERIENCES=['Без опыта','До 1 года','1–3 года','3–5 лет','5–10 лет','10–15 лет','15–20 лет','Более 20 лет'];
const fullName=p=>[p.name,p.surname].filter(Boolean).join(' ')||'Ваш профиль';
const initial=p=>fullName(p).slice(0,1).toUpperCase()||'?';
const crop=v=>Number.isFinite(Number(v))?Math.max(0,Math.min(100,Math.round(Number(v)))):50;
const avatarPosition=p=>`${crop(p.photoCropX)}% ${crop(p.photoCropY)}%`;
const professionOptions=(current='')=>[...new Set([current,...getProfessionCatalog()].map(value=>String(value||'').trim()).filter(Boolean))];

function demoRemainingText(access){
  const expiresAt=new Date(access?.demoExpiresAt||0).getTime();
  if(!Number.isFinite(expiresAt)||!expiresAt)return 'DEMO';
  const diff=Math.max(0,expiresAt-Date.now());
  if(diff<=0)return 'DEMO завершено';
  const hours=Math.ceil(diff/3_600_000);
  if(hours<24)return `DEMO · осталось ${hours} ч.`;
  return `DEMO · осталось ${Math.ceil(hours/24)} дн.`;
}

export function render(root,navigateBack=()=>{},options={}){renderProfile(root,navigateBack,options)}

function profileContext(p,title=fullName(p)){
  return workspaceHeaderContext({
    title,
    a:{kind:'avatar',image:p.photo||'',imagePosition:avatarPosition(p),initials:initial(p),settingsTag:true,aria:'Настройки профиля'},
  });
}

function profileCard(p){
  const workplaces=canUseBookCapability('workplaces.access')?getWorkplaces():[];
  return entityVisualCard({
    appearance:profileCardAppearance(p),
    fields:profileCardFields(p,workplaces),
    image:p.photo||'',
    imagePosition:avatarPosition(p),
    interactive:true,
    data:'data-profile-card',
    aria:'Открыть данные профиля',
  });
}

function workplaceRail(){
  const items=getWorkplaces();
  if(!items.length){
    return '<div class="v2-profile-empty">Рабочих пространств пока нет.</div>';
  }
  const p=getProfile();
  return v2HorizontalRail(items.map(w=>entityVisualCard({
    appearance:workplaceCardAppearance(w),
    fields:workplaceCardFields(w,p),
    image:w.photo||'',
    imagePosition:`${crop(w.photoCropX)}% ${crop(w.photoCropY)}%`,
    interactive:true,
    data:`data-workplace="${escapeHtml(w.key)}"`,
    aria:`Открыть рабочее пространство ${w.name||''}`,
  })).join(''),{className:'v2-profile-workplaces'});
}

function profileDataFields(p,emails,includePhoto=false){
  const photo=includePhoto?photoField({
    name:'profilePhoto',
    value:p.photo||'',
    cropX:p.photoCropX,
    cropY:p.photoCropY,
    cropXName:'profilePhotoCropX',
    cropYName:'profilePhotoCropY',
  }):'';
  return `<div class="v2-profile-data-grid">
    ${v2Section('Личные данные',`<div class="form-grid">${photo}${field({label:'Имя',name:'profileName',value:p.name,placeholder:'Ваше имя',required:true})}${field({label:'Фамилия',name:'profileSurname',value:p.surname,placeholder:'Ваша фамилия'})}${textareaField({label:'О себе',name:'profileAbout',value:p.about||'',placeholder:'Коротко о себе'})}</div>`)}
    ${v2Section('Контактные данные',repeatedField({label:'Телефон',name:'profilePhones',values:p.phones?.length?p.phones:[p.phone||''],type:'tel'})+repeatedField({label:'Telegram',name:'profileTelegrams',values:p.telegrams||[]})+repeatedField({label:'Email',name:'profileEmails',values:emails,type:'email'}))}
    ${v2Section('Профессиональные данные',`<div class="form-grid">${searchableSelect({label:'Профессия',name:'profession',value:p.profession||'',options:professionOptions(p.profession),placeholder:'Введите профессию',required:true})}${select({label:'Опыт работы',name:'experience',value:p.experience||'',options:[{value:'',label:'Не указан'},...EXPERIENCES.map(v=>({value:v,label:v}))]})}${textareaField({label:'О профессии',name:'professionAbout',value:p.professionAbout||'',placeholder:'Расскажите о своей профессии'})}</div>`)}
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
    ${profileDataFields(p,emails,embedded)}
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
    photo:root.querySelector('[data-photo-value]')?.value||current.photo||'',
    photoCropX:Number(root.querySelector('[name="profilePhotoCropX"]')?.value||current.photoCropX||50),
    photoCropY:Number(root.querySelector('[name="profilePhotoCropY"]')?.value||current.photoCropY||50),
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

function bindProfileData(layer,p,options,onSaved){
  if(layer.querySelector('[data-photo-field]'))initPhotoField(layer);
  initRepeatedFields(layer);
  const form=layer.querySelector('[data-profile-data-form]');
  const primary=layer.querySelector('[data-save-profile][data-v2-primary-action]');
  const initial=formSnapshot(form);

  const syncDirty=()=>{
    if(!primary||!form)return;
    setSharedProfilePrimary(primary,{visible:formSnapshot(form)!==initial,label:'Сохранить'});
  };

  form?.addEventListener('input',syncDirty);
  form?.addEventListener('change',syncDirty);

  const save=async()=>{
    const data=collectProfileData(layer);
    if(!data.name||!data.phones.length||!data.profession){
      const target=layer.querySelector('[data-profile-error]');
      if(target)target.textContent='Имя, телефон и профессия обязательны.';
      return false;
    }
    try{
      setSharedProfilePrimary(primary,{visible:true,label:'Сохранить',disabled:true});
      await saveProfileData(data);
      setSharedProfilePrimary(primary,{visible:false,label:'Сохранить',disabled:false});
      onSaved?.();
      return true;
    }catch(error){
      setSharedProfilePrimary(primary,{visible:true,label:'Сохранить',disabled:false});
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

function openProfileAppearance(root,navigateBack,options={}){
  const p=getProfile();
  const workplaces=getWorkplaces();
  const layer=mountV2ZLayer(root,v2ZLayer(page([
    profileContext(p,'Вид'),
    '<div data-profile-card-constructor></div>',
  ]),{className:'v2-profile-appearance-layer'}),{stack:true});
  const host=layer?.querySelector('[data-profile-card-constructor]');
  if(!host)return layer;
  mountEntityCardConstructor(host,{
    appearance:profileCardAppearance(p),
    fields:profileCardFields(p,workplaces),
    photo:p.photo||'',
    photoPosition:avatarPosition(p),
    onSave:async({appearance,photo})=>{
      await saveProfileData({...getProfile(),photo,cardAppearance:appearance});
      layer.v2Close?.();
      renderProfile(root,navigateBack,options);
    },
  });
  return layer;
}

function openProfileSettings(root,navigateBack,options={}){
  const p=getProfile();
  const access=getBookAccess();
  const demoActions=access?.commercialMode==='DEMO'?[
    {id:'demo-status',label:demoRemainingText(access),disabled:true},
    {
      id:'live-request',
      label:access.liveRequestedAt?'Запрос LIVE отправлен':'Запросить LIVE',
      disabled:Boolean(access.liveRequestedAt),
      onSelect:async()=>{
        try{
          await requestLiveMode();
          await loadBookAccess();
        }catch(error){
          showProfileError(error instanceof Error?error.message:'Не удалось отправить запрос LIVE');
        }
      },
    },
  ]:[];
  return openSharedProfileSettingsMenu({
    actions:[
      ...demoActions,
      {id:'appearance',label:'Вид',onSelect:()=>openProfileAppearance(root,navigateBack,options)},
      {id:'password',label:'Изменить пароль',onSelect:()=>openSharedPasswordAction({onSubmit:({currentPassword,newPassword})=>changePassword(currentPassword,newPassword)})},
      {id:'controls',label:'Согласия / Уведомления',onSelect:()=>import('./account-controls.js').then(({openAccountControlsModal})=>openAccountControlsModal())},
      {id:'logout',label:'Выход',variant:'danger',onSelect:()=>logout()},
    ],
  });
}

function openWorkplaceZ2(root,existing,navigateBack,options={}){
  const current=existing||{name:'',photo:'',photoCropX:50,photoCropY:50};
  const title=existing?.name||'Новое рабочее пространство';
  const layer=mountV2ZLayer(root,v2ZLayer(page([
    workspaceHeaderContext({
      title,
      a:{
        kind:'avatar',
        image:current.photo||'',
        imagePosition:`${crop(current.photoCropX)}% ${crop(current.photoCropY)}%`,
        initials:(current.name||'?').slice(0,1).toUpperCase(),
        settingsTag:true,
        aria:'Настройки пространства',
      },
    }),
    workplaceForm(existing,{sourceOnly:true})
  ]),{className:'v2-workplace-data-layer'}));
  if(!layer)return;
  const closeAndRender=()=>{
    layer.v2Close?.();
    renderProfile(root,navigateBack,options);
  };
  layer.querySelector('[data-workspace-context-action]')?.addEventListener('click',()=>openWorkplaceSettingsMenu(layer,existing,{onDeleted:closeAndRender,onAppearanceSaved:()=>renderProfile(root,navigateBack,options)}));
  bindWorkplaceForm(layer,existing,{
    onSaved:closeAndRender,
    onDeleted:closeAndRender,
  });
}

function openWorkplace(root,existing,navigateBack,options={}){
  const workplaceLimit=getBookLimit('workplaces.max');
  if(!existing&&workplaceLimit!==null&&getWorkplaces().length>=workplaceLimit){
    openWorkplaceLimitModal(root,workplaceLimit);
    return;
  }
  openWorkplaceZ2(root,existing,navigateBack,options);
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
  const p=getProfile();
  const workplacesAllowed=canUseBookCapability('workplaces.access');
  root.innerHTML=page([
    profileContext(p),
    profileCard(p),
    workplacesAllowed?v2Section('Рабочие пространства',workplaceRail()):'',
    workplacesAllowed?rootAddSource():''
  ]);
  root.querySelector('[data-workspace-context-action]')?.addEventListener('click',()=>openProfileSettings(root,navigateBack,options));
  root.querySelector('[data-profile-card]')?.addEventListener('click',()=>openProfileData(root,navigateBack,options));
  root.querySelector('[data-add-workplace]')?.addEventListener('click',()=>openWorkplace(root,null,navigateBack,options));
  root.querySelectorAll('[data-workplace]').forEach(el=>el.addEventListener('click',()=>openWorkplace(root,getWorkplaces().find(w=>w.key===el.dataset.workplace)||null,navigateBack,options)));
}
