import { accordion, actionBlock, button, collectRepeatedField, entityCard, field, initAccordions, initPhotoField, initRepeatedFields, modal, mountModal, page, photoField, repeatedField, select, textareaField, workplaceAddButton, workplaceCountText } from '../../ui/ui.js?v=settings-architecture-20260907';
import { addCustomProfession, getCustomProfessions, getProfile, saveProfile as saveProfileData } from './data.js';
import { getWorkplaces } from './workplaces/data.js';
import { initWorkplaceListDeletion, openWorkplaceModal, renderWorkplace, workplaceList } from './workplaces/workplaces.js';

const PROFESSIONS=['Парикмахер','Колорист','Барбер','Визажист','Стилист','Мастер маникюра','Мастер педикюра','Бровист','Лэшмейкер','Косметолог','Массажист','Мастер по наращиванию волос','Мастер перманентного макияжа','Другая'];
const EXPERIENCES=['Без опыта','До 1 года','1–3 года','3–5 лет','5–10 лет','10–15 лет','15–20 лет','Более 20 лет'];
const fullName=p=>[p.name,p.surname].filter(Boolean).join(' ')||'Ваш профиль';
const initial=p=>fullName(p).slice(0,1).toUpperCase()||'?';
const professionOptions=()=>[...new Set([...PROFESSIONS.filter(p=>p!=='Другая'),...getCustomProfessions(),'Другая'])].map(value=>({value,label:value}));

export function render(root,navigateBack=()=>{}){renderProfile(root,navigateBack)}

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

function applyProfessionValue(root,value){
  const input=root.querySelector('[name="profession"]');
  const trigger=input?.closest('.ui-select')?.querySelector('[data-ui-select-trigger]');
  if(!input||!trigger)return;
  input.value=value;
  const valueNode=trigger.querySelector('.ui-select__value');
  if(valueNode)valueNode.textContent=value;
  trigger.dataset.options=JSON.stringify(professionOptions());
  input.dispatchEvent(new Event('change',{bubbles:true}));
}

function openCustomProfessionModal(root){
  const m=mountModal(root,modal(`<form data-custom-profession-form><div class="modal-title"><h2>Своя профессия</h2></div>${field({label:'Профессия',name:'customProfessionModal',placeholder:'Введите профессию',required:true})}<div class="form-error" data-custom-profession-error></div>${button('Сохранить',{type:'submit'})}</form>`,{variant:'compact'}));
  if(!m)return;
  const input=m.querySelector('[name="customProfessionModal"]');
  input?.focus();
  m.querySelector('[data-custom-profession-form]')?.addEventListener('submit',e=>{
    e.preventDefault();
    const value=input?.value.trim()||'';
    if(!value){m.querySelector('[data-custom-profession-error]').textContent='Введите профессию.';return}
    addCustomProfession(value);
    m.remove();
    applyProfessionValue(root,value);
  });
}

function renderProfile(root,navigateBack){
  const p=getProfile(),profession=p.profession||'';
  const items=[
    {title:'Личные данные',content:`<div class="form-grid">${photoField({name:'profilePhoto',value:p.photo||''})}${field({label:'Имя',name:'profileName',value:p.name,placeholder:'Ваше имя',required:true})}${field({label:'Фамилия',name:'profileSurname',value:p.surname,placeholder:'Ваша фамилия'})}${textareaField({label:'О себе',name:'profileAbout',value:p.about||'',placeholder:'Коротко о себе'})}</div>`},
    {title:'Контактные данные',content:repeatedField({label:'Телефон',name:'profilePhones',values:p.phones?.length?p.phones:[p.phone||''],type:'tel'})+repeatedField({label:'Telegram',name:'profileTelegrams',values:p.telegrams||[]})+repeatedField({label:'Email',name:'profileEmails',values:p.emails||[],type:'email'})},
    {title:'Профессиональные данные',content:`<div class="form-grid">${select({label:'Профессия',name:'profession',value:profession,options:professionOptions()})}${select({label:'Опыт работы',name:'experience',value:p.experience||'',options:[{value:'',label:'Не указан'},...EXPERIENCES.map(v=>({value:v,label:v}))]})}${textareaField({label:'О профессии',name:'professionAbout',value:p.professionAbout||'',placeholder:'Расскажите о своей профессии'})}</div>`}
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
  initWorkplaceListDeletion(root,()=>renderProfile(root,navigateBack));
  root.querySelector('[name="profession"]')?.addEventListener('change',e=>{if(e.target.value==='Другая')openCustomProfessionModal(root)});
  root.querySelector('[data-save-profile]')?.addEventListener('click',()=>saveProfile(root,navigateBack));
  root.querySelector('[data-profile-back]')?.addEventListener('click',navigateBack);
  root.querySelector('[data-add-workplace]')?.addEventListener('click',()=>openWorkplaceModal(root,null,()=>renderProfile(root,navigateBack)));
  root.querySelectorAll('[data-workplace]').forEach(el=>el.addEventListener('click',()=>renderWorkplace(root,el.dataset.workplace,()=>renderProfile(root,navigateBack))));
}

function saveProfile(root,navigateBack){
  const current=getProfile(),profession=root.querySelector('[name="profession"]')?.value||'';
  const name=root.querySelector('[name="profileName"]')?.value.trim()||'';
  const phones=collectRepeatedField(root,'profilePhones');
  const telegrams=collectRepeatedField(root,'profileTelegrams');
  const emails=collectRepeatedField(root,'profileEmails');
  if(!name||!phones.length||profession==='Другая')return;
  saveProfileData({...current,key:'profile',name,surname:root.querySelector('[name="profileSurname"]')?.value.trim()||'',phone:phones[0]||'',phones,telegrams,emails,about:root.querySelector('[name="profileAbout"]')?.value.trim()||'',photo:root.querySelector('[data-photo-value]')?.value||'',profession,experience:root.querySelector('[name="experience"]')?.value||'',professionAbout:root.querySelector('[name="professionAbout"]')?.value.trim()||''});
  renderProfile(root,navigateBack);
}
