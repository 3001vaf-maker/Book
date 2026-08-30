import { accordion, button, emptyState, escapeHtml, field, iconButton, initAccordions, mountModal, modal, pageHeader } from '../../ui/ui.js';

const PEOPLE_KEY = 'book.people';
const USED_IDS_KEY = 'book.usedIds';
const SORT_KEY = 'book.people.sort';
const sorts = { nameAsc: 'Имя ↑', nameDesc: 'Имя ↓', lastAsc: 'Последнее посещение ↑', lastDesc: 'Последнее посещение ↓' };
const read = (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
const people = () => read(PEOPLE_KEY, []);
const savePeople = (items) => localStorage.setItem(PEOPLE_KEY, JSON.stringify(items));
const usedIds = () => new Set(read(USED_IDS_KEY, []));
const saveUsedIds = (ids) => localStorage.setItem(USED_IDS_KEY, JSON.stringify([...ids]));
const nameOf = (p) => [p.name, p.surname].filter(Boolean).join(' ');
const money = (n) => new Intl.NumberFormat('ru-RU').format(Number(n || 0)) + ' ₽';
const visit = (v) => v ? new Date(v).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '—';

function normalizeId(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (!/^[A-Z0-9]{1,4}$/.test(raw)) throw new Error('ID должен содержать от 1 до 4 букв или цифр.');
  return raw.padStart(4, '0');
}
function makePerson(name, surname, phone, id = '') {
  return { key: crypto.randomUUID(), id, name, surname, phones: [phone], telegrams: [], emails: [], links: [], tags: [], loyalty: { discount: 0, programs: [] }, agreements: { personalData: false, mailings: false }, visits: 0, totalSpent: 0, lastVisit: '', createdAt: new Date().toISOString() };
}
function sorted(items, mode) {
  return [...items].sort((a, b) => {
    if (mode.startsWith('name')) { const n = nameOf(a).localeCompare(nameOf(b), 'ru'); return mode === 'nameDesc' ? -n : n; }
    const av = a.lastVisit ? new Date(a.lastVisit).getTime() : 0, bv = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
    return mode === 'lastDesc' ? bv - av : av - bv;
  });
}

export function renderClients(root) { renderList(root); }
function renderList(root) {
  const items = people(); const mode = localStorage.getItem(SORT_KEY) || 'nameAsc';
  root.innerHTML = `${pageHeader('Клиенты', `${items.length} профилей`)}<section class="clients-toolbar">${iconButton('+',{className:'icon-button--primary',data:'data-add-person',aria:'Добавить'})}${button('Excel',{className:'ui-button--secondary',data:'data-excel'})}<label class="select-control"><span class="sr-only">Сортировка</span><select data-sort aria-label="Сортировка">${Object.entries(sorts).map(([k,v])=>`<option value="${k}" ${k===mode?'selected':''}>${v}</option>`).join('')}</select></label></section><section class="clients-list-wrap">${listMarkup(sorted(items,mode))}</section>`;
  root.querySelector('[data-add-person]').onclick = () => addMenu(root);
  root.querySelector('[data-excel]').onclick = () => excelMenu(root);
  root.querySelector('[data-sort]').onchange = (e) => { localStorage.setItem(SORT_KEY,e.target.value); renderList(root); };
  root.querySelectorAll('[data-person-key]').forEach((el) => el.onclick = () => renderProfile(root, el.dataset.personKey));
}
function listMarkup(items) {
  if (!items.length) return emptyState('Клиентов пока нет','Добавьте человека кнопкой «+».');
  return `<div class="people-list">${items.map((p)=>`<button type="button" class="person-row" data-person-key="${escapeHtml(p.key)}"><span class="person-row__main"><strong>${p.id?`<span class="person-id">${escapeHtml(p.id)}</span> — `:''}${escapeHtml(nameOf(p))}</strong><span>${escapeHtml(p.phones?.[0] || '')}</span></span><span class="row-chevron">›</span></button>`).join('')}</div>`;
}
function addMenu(root) {
  mountModal(root,modal(`<div class="modal-title"><h2>Добавить</h2><p>Выберите способ.</p></div><div class="modal-actions">${button('Создать',{data:'data-create'})}${button('Добавить из контактов',{className:'ui-button--secondary',data:'data-contacts'})}</div>`));
  const m=root.querySelector('[data-modal]:last-of-type'); m.querySelector('[data-create]').onclick=()=>{m.remove();createForm(root)}; m.querySelector('[data-contacts]').onclick=()=>fromContacts(root,m);
}
function createForm(root, preset={}) {
  mountModal(root,modal(`<form class="compact-form" data-create-form><div class="modal-title"><h2>Создать</h2></div>${field({label:'Имя',name:'name',value:preset.name||'',required:true})}${field({label:'Фамилия',name:'surname',value:preset.surname||''})}${field({label:'Телефон',name:'phone',value:preset.phone||'',type:'tel',required:true,inputmode:'tel'})}${field({label:'ID',name:'id',placeholder:'____',inputmode:'text'})}<div class="form-error" data-error></div>${button('Сохранить',{type:'submit'})}</form>`));
  root.querySelector('[data-create-form]').onsubmit=(e)=>{e.preventDefault(); const fd=new FormData(e.currentTarget), list=people(); try{const id=normalizeId(fd.get('id')); if(id&&list.some(p=>p.id===id))throw new Error('Этот ID уже принадлежит другому профилю.'); const p=makePerson(String(fd.get('name')).trim(),String(fd.get('surname')).trim(),String(fd.get('phone')).trim(),id); if(!p.name||!p.phones[0])throw new Error('Имя и телефон обязательны.'); list.push(p);savePeople(list);if(id){const ids=usedIds();ids.add(id);saveUsedIds(ids)}root.querySelector('[data-modal]')?.remove();renderList(root)}catch(err){e.currentTarget.querySelector('[data-error]').textContent=err.message}};
}
async function fromContacts(root,m) {
  if(!navigator.contacts?.select){m.querySelector('.modal-title').insertAdjacentHTML('beforeend','<p class="form-error">Доступ к системным контактам не поддерживается этим браузером.</p>');return}
  try{const c=(await navigator.contacts.select(['name','tel'],{multiple:false}))[0];if(c){m.remove();createForm(root,{name:c.name?.[0]||'',phone:c.tel?.[0]||''})}}catch{}
}
function excelMenu(root){
  mountModal(root,modal(`<div class="modal-title"><h2>Excel</h2><p>CSV с UTF-8 и разделителем «;» совместим с Excel.</p></div><div class="modal-actions">${button('Выгрузить',{data:'data-export'})}${button('Загрузить',{className:'ui-button--secondary',data:'data-import'})}${button('Шаблон',{className:'ui-button--secondary',data:'data-template'})}<input class="file-input" type="file" accept=".csv,text/csv" data-file></div>`));
  const m=root.querySelector('[data-modal]:last-of-type');m.querySelector('[data-export]').onclick=()=>{downloadCsv(people());m.remove()};m.querySelector('[data-template]').onclick=()=>{downloadCsv([],true);m.remove()};m.querySelector('[data-import]').onclick=()=>m.querySelector('[data-file]').click();m.querySelector('[data-file]').onchange=(e)=>importCsv(e.target.files?.[0],root,m);
}
const csvCell=(v)=>`"${String(v??'').replaceAll('"','""')}"`;
function downloadCsv(items,template=false){const head=['ID','Имя','Фамилия','Телефон','Email'],rows=template?[]:items.map(p=>[p.id,p.name,p.surname,p.phones?.[0],p.emails?.[0]]),text='\uFEFF'+[head,...rows].map(r=>r.map(csvCell).join(';')).join('\r\n'),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=template?'Book-шаблон.csv':'Book-клиенты.csv';a.click();URL.revokeObjectURL(url)}
function importCsv(file,root,m){if(!file)return;const r=new FileReader();r.onload=()=>{const rows=String(r.result).replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean).map(x=>x.split(';').map(c=>c.replace(/^"|"$/g,'').replaceAll('""','"'))),list=people(),ids=usedIds();rows.slice(1).forEach(([raw,name,surname,phone,email])=>{if(!name||!phone)return;let id='';try{id=normalizeId(raw)}catch{}if(id&&ids.has(id))id='';const p=makePerson(name,surname,phone,id);if(email)p.emails=[email];list.push(p);if(id)ids.add(id)});savePeople(list);saveUsedIds(ids);m.remove();renderList(root)};r.readAsText(file,'utf-8')}

function renderProfile(root,key){const p=people().find(x=>x.key===key);if(!p)return renderList(root);const items=[
 {title:'ID',content:p.id?`<div class="locked-value"><strong>${escapeHtml(p.id)}</strong><span>Закреплён</span></div>`:`<div class="form-grid">${field({label:'ID',name:'id',placeholder:'____',inputmode:'text'})}</div>`},
 {title:'Личные данные',content:`<div class="form-grid">${field({label:'Имя',name:'name',value:p.name,required:true})}${field({label:'Фамилия',name:'surname',value:p.surname})}<label class="field"><span>Пол</span><select name="gender"><option value="">Не указан</option><option value="female" ${p.gender==='female'?'selected':''}>Женский</option><option value="male" ${p.gender==='male'?'selected':''}>Мужской</option></select></label>${field({label:'Дата рождения',name:'birthDate',value:p.birthDate||'',type:'date'})}</div>`},
 {title:'Контактные данные',content:contactsMarkup(p)},
 {title:'Программа лояльности',value:p.loyalty?.discount?`${p.loyalty.discount}%`:'',content:loyaltyMarkup(p)},
 {title:'Ссылки',content:linksMarkup(p)},
 {title:'Ярлыки',content:`<div class="tag-list">${(p.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')||'<span class="muted">Назначаются из общей системы Настроек.</span>'}</div>`}
];
 root.innerHTML=`${banner(p)}${accordion(items)}<section class="agreements-summary"><div><span>Согласие ПДН</span><strong>${p.agreements?.personalData?'Дано':'Не дано'}</strong></div><div><span>Согласие на рассылки</span><strong>${p.agreements?.mailings?'Дано':'Не дано'}</strong></div></section><div class="profile-actions">${button('Сохранить',{data:'data-save'})}${button('Назад',{className:'ui-button--secondary',data:'data-back'})}</div>`;
 initAccordions(root);root.querySelector('[data-save]').onclick=()=>saveProfile(root,p.key);root.querySelector('[data-back]').onclick=()=>renderList(root);root.querySelectorAll('.remove-button').forEach(b=>b.onclick=()=>b.closest('.array-row')?.remove());root.querySelectorAll('[data-add-array]').forEach(b=>b.onclick=()=>addArray(root,b.dataset.addArray));root.querySelector('[data-add-link]')?.addEventListener('click',()=>root.querySelector('[data-links]').insertAdjacentHTML('beforeend',linkRow()));
}
function banner(p){const n=escapeHtml(nameOf(p).slice(0,1).toUpperCase()||'?');return `<section class="profile-banner"><div class="profile-banner__photo" aria-hidden="true">${n}</div><div class="profile-banner__body">${p.id?`<span class="profile-id">${escapeHtml(p.id)}</span>`:''}<h1>${escapeHtml(nameOf(p))}</h1><p>${escapeHtml(p.phones?.[0]||'')}</p><div class="metrics"><span><strong>${p.visits||0}</strong><small>записей</small></span><span><strong>${money(p.totalSpent)}</strong><small>сумма</small></span><span><strong>${visit(p.lastVisit)}</strong><small>посещение</small></span></div></div></section>`}
function arrayGroup(label,name,values,type='text'){return `<div class="array-group"><span class="array-label">${label}</span><div data-array-group="${name}">${(values?.length?values:['']).map(v=>`<div class="array-row"><input type="${type}" name="${name}" value="${escapeHtml(v)}" placeholder="Добавить значение"><button type="button" class="remove-button">×</button></div>`).join('')}</div>${button('+',{className:'ui-button--small',data:`data-add-array="${name}"`})}</div>`}
function contactsMarkup(p){return arrayGroup('Телефон','phones',p.phones,'tel')+arrayGroup('Telegram','telegrams',p.telegrams)+arrayGroup('Email','emails',p.emails,'email')}
function loyaltyMarkup(p){const d=Number(p.loyalty?.discount||0);return `<div class="loyalty-content"><label class="field"><span>Скидка</span><select name="discount"><option value="0">Без скидки</option>${Array.from({length:100},(_,i)=>i+1).map(i=>`<option value="${i}" ${i===d?'selected':''}>${i}%</option>`).join('')}</select></label><div class="array-group"><span class="array-label">Назначенные программы</span><div data-programs>${(p.loyalty?.programs||[]).map(v=>`<div class="array-row"><input name="programs" value="${escapeHtml(v)}"><button type="button" class="remove-button">×</button></div>`).join('')}</div>${button('+ Программа',{className:'ui-button--small',data:'data-add-array="programs"'})}</div></div>`}
function linkRow(l={}){return `<div class="array-row link-row"><select name="linkType"><option ${l.type==='Instagram'?'selected':''}>Instagram</option><option ${l.type==='ВКонтакте'?'selected':''}>ВКонтакте</option><option ${l.type==='YouTube'?'selected':''}>YouTube</option><option ${l.type==='Facebook'?'selected':''}>Facebook</option><option ${l.type==='Сайт'?'selected':''}>Сайт</option><option ${l.type==='Другое'?'selected':''}>Другое</option></select><input name="linkUrl" value="${escapeHtml(l.url||'')}" placeholder="URL"><button type="button" class="remove-button">×</button></div>`}
function linksMarkup(p){return `<div data-links>${(p.links||[]).map(linkRow).join('')}</div>${button('+ Добавить ссылку',{className:'ui-button--small',data:'data-add-link'})}`}
function addArray(root,name){const group=root.querySelector(`[data-array-group="${name}"]`)||root.querySelector('[data-programs]');if(!group)return;const type=name==='phones'?'tel':name==='emails'?'email':'text';group.insertAdjacentHTML('beforeend',`<div class="array-row"><input type="${type}" name="${name}" placeholder="Добавить значение"><button type="button" class="remove-button">×</button></div>`);group.lastElementChild.querySelector('.remove-button').onclick=()=>group.lastElementChild.remove()}
function saveProfile(root,key){const list=people(),p=list.find(x=>x.key===key);if(!p)return;const vals=(n)=>[...root.querySelectorAll(`[name="${n}"]`)].map(x=>x.value.trim()).filter(Boolean);const idInput=root.querySelector('[name="id"]');if(idInput){try{const id=normalizeId(idInput.value);if(id&&list.some(x=>x.id===id&&x.key!==key))throw new Error('Этот ID уже принадлежит другому профилю.');p.id=id;if(id){const ids=usedIds();ids.add(id);saveUsedIds(ids)}}catch(e){alert(e.message);return}}p.name=root.querySelector('[name="name"]')?.value.trim()||p.name;p.surname=root.querySelector('[name="surname"]')?.value.trim()||'';p.gender=root.querySelector('[name="gender"]')?.value||'';p.birthDate=root.querySelector('[name="birthDate"]')?.value||'';p.phones=vals('phones');p.telegrams=vals('telegrams');p.emails=vals('emails');p.loyalty={discount:Number(root.querySelector('[name="discount"]')?.value||0),programs:vals('programs')};p.links=[...root.querySelectorAll('[data-links] .link-row')].map(r=>({type:r.querySelector('[name="linkType"]')?.value||'',url:r.querySelector('[name="linkUrl"]')?.value.trim()||''})).filter(x=>x.url);savePeople(list);renderProfile(root,key)}
