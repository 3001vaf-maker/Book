import { accordion, button, entityCard, escapeHtml, iconButton, initAccordions, initPhotoField, pageHeader, phoneField, photoField, select, textareaField } from '../../ui/ui.js';
import { addCustomProfession, getCustomProfessions, getProfile, saveProfile as saveProfileData } from './data.js';
import { openWorkplaceModal, renderWorkplace, workplaceList } from './workplaces/workplaces.js';

const PROFESSIONS=['Парикмахер','Колорист','Барбер','Визажист','Стилист','Мастер маникюра','Мастер педикюра','Бровист','Лэшмейкер','Косметолог','Массажист','Мастер по наращиванию волос','Мастер перманентного макияжа','Другая'];
const EXPERIENCES=['Без опыта','До 1 года','1–3 года','3–5 лет','5–10 лет','10–15 лет','15–20 лет','Более 20 лет'];
const fullName=p=>[p.name,p.surname].filter(Boolean).join(' ')||'Ваш профиль';
const initial=p=>fullName(p).slice(0,1).toUpperCase()||'?';
const professionOptions=()=>[...new Set([...PROFESSIONS.filter(p=>p!=='Другая'),...getCustomProfessions(),'Другая'])].map(value=>({value,label:value}));

export function render(root){renderProfile(root)}

function profileCard(p){return entityCard({image:p.photo||'',initial:initial(p),className:'entity-card--hero entity-card--profile',top:`<div class="entity-card__profile-phone">${escapeHtml(p.phone||'Телефон не указан')}</div>`,bottom:`<strong class="entity-card__profile-name">${escapeHtml(fullName(p))}</strong>`,right:`<span class="entity-card__profile-profession">${escapeHtml(p.profession||'Профессия не указана')}</span>`})}

function renderProfile(root){
  const p=getProfile(),profession=p.profession||'',custom=profession&&!PROFESSIONS.includes(profession)?profession:'';
  const items=[
    {title:'Личные данные',content:`<div class="form-grid">${photoField({name:'profilePhoto',value:p.photo||''})}${fieldRequired('Имя','profileName',p.name,'Ваше имя')}${fieldOptional('Фамилия','profileSurname',p.surname,'Ваша фамилия')}${phoneField({label:'Телефон',name:'profilePhone',value:p.phone||'',required:true})}${textareaField({label:'О себе',name:'profileAbout',value:p.about||'',placeholder:'Коротко о себе'})}</div>`},
    {title:'Профессиональные данные',content:`<div class="form-grid">${select({label:'Профессия',name:'profession',value:custom?'Другая':profession,options:professionOptions()})}<div data-profession-custom style="display:${custom?'grid':'none'}">${fieldOptional('Своя профессия','customProfession',custom,'Введите профессию')}</div>${select({label:'Опыт работы',name:'experience',value:p.experience||'',options:[{value:'',label:'Не указан'},...EXPERIENCES.map(v=>({value:v,label:v}))]})}${textareaField({label:'О профессии',name:'professionAbout',value:p.professionAbout||'',placeholder:'Расскажите о своей профессии'})}</div>`}
  ];
  root.innerHTML=`${pageHeader('Профиль')}${profileCard(p)}${accordion(items)}<section class="workplaces-section"><div class="section-heading"><h2>Места работы</h2>${iconButton('+',{className:'icon-button--primary',data:'data-add-workplace',aria:'Добавить место работы'})}</div>${workplaceList()}</section><div class="profile-actions">${button('Сохранить',{data:'data-save-profile'})}</div>`;
  initPhotoField(root);initAccordions(root);
  root.querySelector('[name="profession"]')?.addEventListener('change',e=>{const box=root.querySelector('[data-profession-custom]');if(box)box.style.display=e.target.value==='Другая'?'grid':'none'});
  root.querySelector('[data-save-profile]')?.addEventListener('click',()=>saveProfile(root));
  root.querySelector('[data-add-workplace]')?.addEventListener('click',()=>openWorkplaceModal(root,null,()=>renderProfile(root)));
  root.querySelectorAll('[data-workplace]').forEach(el=>el.addEventListener('click',()=>renderWorkplace(root,el.dataset.workplace,()=>renderProfile(root))));
}

function saveProfile(root){
  const current=getProfile(),selected=root.querySelector('[name="profession"]')?.value||'',custom=root.querySelector('[name="customProfession"]')?.value.trim()||'',profession=selected==='Другая'?custom:selected;
  const name=root.querySelector('[name="profileName"]')?.value.trim()||'',phone=root.querySelector('[name="profilePhone"]')?.value.trim()||'';
  if(!name||!phone)return;
  if(custom)addCustomProfession(custom);
  saveProfileData({...current,key:'profile',name,surname:root.querySelector('[name="profileSurname"]')?.value.trim()||'',phone,about:root.querySelector('[name="profileAbout"]')?.value.trim()||'',photo:root.querySelector('[data-photo-value]')?.value||'',profession,experience:root.querySelector('[name="experience"]')?.value||'',professionAbout:root.querySelector('[name="professionAbout"]')?.value.trim()||''});
  renderProfile(root);
}

function fieldRequired(label,name,value,placeholder){return `<label class="field"><span>${escapeHtml(label)} *</span><input name="${escapeHtml(name)}" required value="${escapeHtml(value||'')}" placeholder="${escapeHtml(placeholder||'')}"></label>`}
function fieldOptional(label,name,value,placeholder){return `<label class="field"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" value="${escapeHtml(value||'')}" placeholder="${escapeHtml(placeholder||'')}"></label>`}
