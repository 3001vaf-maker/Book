import { accordion, actionBlock, button, collectRepeatedField, entityCard, escapeHtml, field, folderList, initAccordions, initPhotoField, initRepeatedFields, modal, mountModal, page, photoField, repeatedField, select, textareaField, workplaceAddButton, workplaceCountText } from '../../ui/ui.js';
import { getLimit } from '../../core/access.js';
import { getProfile, saveProfile as saveProfileData } from './data.js';
import { getWorkplaces } from './workplaces/data.js';
import { initWorkplaceListDeletion, openWorkplaceModal, renderWorkplace, workplaceList } from './workplaces/workplaces.js';

const EXPERIENCES=['Без опыта','До 1 года','1–3 года','3–5 лет','5–10 лет','10–15 лет','15–20 лет','Более 20 лет'];
const fullName=p=>[p.name,p.surname].filter(Boolean).join(' ')||'Ваш профиль';
const initial=p=>fullName(p).slice(0,1).toUpperCase()||'?';

export function render(root,navigateBack=()=>{},options={}){renderProfile(root,navigateBack,options)}

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

function showProfileError(message){
  mountModal(document.body,modal(`<div class="modal-title"><h2>Не удалось сохранить</h2><p>${escapeHtml(message||'Ошибка сервера')}</p></div>`,{variant:'compact'}));
}

function openWorkplaceLimitModal(root,limit){
  const current=Number.isFinite(limit)?String(limit):'текущий лимит';
  const choices=folderList([
    {title:'До 3 рабочих пространств'},
    {title:'До 5 рабочих пространств'},
    {title:'Без ограничения'}
  ]);
  const m=mountModal(root,modal(`<div class="modal-title"><h2>Работаете в нескольких местах?</h2><p>Сейчас доступно рабочих пространств: ${escapeHtml(current)}. Система поддерживает несколько мест работы с отдельными адресами и настройками. Дополнительный лимит можно подключить отдельно.</p></div>${choices}${actionBlock(button('Понятно',{data:'data-close-workplace-limit'}))}`,{variant:'medium'}));
  m?.querySelector('[data-close-workplace-limit]')?.addEventListener('click',()=>m.remove());
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
  return Boolean(data.name&&data.phones.length&&data.profession&&getWorkplaces().length);
}

export function isOnboardingProfileIdentityReady(root){
  const data=collectProfileData(root);
  return Boolean(data.name&&data.phones.length&&data.profession);
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

function renderProfile(root,navigateBack,options={}){
  const p=getProfile(),profession=p.profession||'';
  const emails=p.emails?.length?p.emails:(options.accountEmail?[options.accountEmail]:[]);
  const items=[
    {title:'Личные данные',content:`<div class="form-grid">${photoField({name:'profilePhoto',value:p.photo||''})}${field({label:'Имя',name:'profileName',value:p.name,placeholder:'Ваше имя',required:true})}${field({label:'Фамилия',name:'profileSurname',value:p.surname,placeholder:'Ваша фамилия'})}${textareaField({label:'О себе',name:'profileAbout',value:p.about||'',placeholder:'Коротко о себе'})}</div>`},
    {title:'Контактные данные',content:repeatedField({label:'Телефон',name:'profilePhones',values:p.phones?.length?p.phones:[p.phone||''],type:'tel'})+repeatedField({label:'Telegram',name:'profileTelegrams',values:p.telegrams||[]})+repeatedField({label:'Email',name:'profileEmails',values:emails,type:'email'})},
    {title:'Профессиональные данные',content:`<div class="form-grid">${field({label:'Профессия *',name:'profession',value:profession,placeholder:'Укажите профессию',required:true})}${select({label:'Опыт работы',name:'experience',value:p.experience||'',options:[{value:'',label:'Не указан'},...EXPERIENCES.map(v=>({value:v,label:v}))]})}${textareaField({label:'О профессии',name:'professionAbout',value:p.professionAbout||'',placeholder:'Расскажите о своей профессии'})}</div>`}
  ];
  const workplaces=`<section class="workplaces-section"><div class="section-heading"><h2>Рабочие места</h2></div>${actionBlock(`${workplaceAddButton()}${workplaceList()}`)}</section>`;
  root.innerHTML=page([
    profileCard(p),
    accordion(items),
    workplaces,
    actionBlock(`${button('Сохранить',{className:'accordion-save',data:'data-save-profile'})}${button('Назад',{className:'ui-button--secondary',data:'data-profile-back'})}`)
  ]);
  initPhotoField(root);
  initRepeatedFields(root);
  initAccordions(root,{onDirty:()=>root.querySelector('[data-save-profile]')?.classList.add('is-visible')});
  initWorkplaceListDeletion(root,()=>renderProfile(root,navigateBack,options));
  root.querySelector('[data-save-profile]')?.addEventListener('click',()=>{saveProfile(root,navigateBack,options)});
  root.querySelector('[data-profile-back]')?.addEventListener('click',navigateBack);
  root.querySelector('[data-add-workplace]')?.addEventListener('click',async()=>{
    if(options.onboarding){
      try{await persistDraft(root)}catch(error){showProfileError(error instanceof Error?error.message:'Не удалось сохранить профиль');return}
    }
    const workplaceLimit=getLimit('workplaces.max');
    if(workplaceLimit!==null&&getWorkplaces().length>=workplaceLimit){
      openWorkplaceLimitModal(root,workplaceLimit);
      return;
    }
    openWorkplaceModal(root,null,()=>renderProfile(root,navigateBack,options));
  });
  root.querySelectorAll('[data-workplace]').forEach(el=>el.addEventListener('click',async()=>{
    if(options.onboarding){
      try{await persistDraft(root)}catch(error){showProfileError(error instanceof Error?error.message:'Не удалось сохранить профиль');return}
    }
    renderWorkplace(root,el.dataset.workplace,()=>renderProfile(root,navigateBack,options));
  }));
}

async function saveProfile(root,navigateBack,options={}){
  const data=collectProfileData(root);
  if(!data.name||!data.phones.length||!data.profession)return;
  try{
    await saveProfileData(data);
    renderProfile(root,navigateBack,options);
  }catch(error){
    showProfileError(error instanceof Error?error.message:'Не удалось сохранить профиль');
  }
}
