import { modal, mountModal } from '../modals/index.js';

const esc=(v='')=>String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
const normalize=v=>{const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return {h:0,min:0};return {h:Math.min(24,Number(m[1])),min:Number(m[2])<60?Number(m[2]):0}};
const text=v=>{const {h,min}=normalize(v);return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`};
const wheelItems=(values,selected,type)=>values.map(value=>`<button type="button" class="time-wheel__item${value===selected?' is-selected':''}" data-time-wheel-item data-time-wheel-type="${type}" data-value="${value}">${String(value).padStart(2,'0')}</button>`).join('');

export function timePicker({name,label,value='09:00',step=60,min='00:00',max='24:00'}={}){return `<div class="time-picker" data-time-picker="${esc(name)}" data-time-step="${Number(step)||60}" data-time-min="${esc(min)}" data-time-max="${esc(max)}"><span class="time-picker__label">${esc(label)}</span><button type="button" class="time-picker__button" data-time-open>${text(value)}</button><input type="hidden" name="${esc(name)}" value="${text(value)}" data-time-value></div>`}

export function initTimePickers(root){root.querySelectorAll('[data-time-picker]').forEach(host=>host.querySelector('[data-time-open]')?.addEventListener('click',()=>open(host)))}

function open(host){
  const hidden=host.querySelector('[data-time-value]');
  const current=normalize(hidden?.value);
  const step=Math.max(1,Number(host.dataset.timeStep)||60);
  const min=normalize(host.dataset.timeMin||'00:00');
  const max=normalize(host.dataset.timeMax||'24:00');
  const maxHour=Math.min(24,max.h);
  const hours=Array.from({length:maxHour-min.h+1},(_,i)=>i+min.h).filter(h=>h<=maxHour);
  const minutes=Array.from({length:Math.floor(59/step)+1},(_,i)=>i*step).filter(m=>m<60);
  const initialHour=hours.includes(current.h)?current.h:hours[0];
  const initialMinute=minutes.includes(current.min)?current.min:minutes[0];
  const content=`<div class="modal-title"><h2>${esc(host.querySelector('.time-picker__label')?.textContent||'Время')}</h2></div><div class="time-wheel" data-time-wheel><div class="time-wheel__column" data-time-wheel-column="hours"><span class="time-wheel__label">Часы</span><div class="time-wheel__viewport">${wheelItems(hours,initialHour,'hours')}</div></div><div class="time-wheel__column" data-time-wheel-column="minutes"><span class="time-wheel__label">Минуты</span><div class="time-wheel__viewport">${wheelItems(minutes,initialMinute,'minutes')}</div></div></div><button type="button" class="ui-button" data-time-save>Сохранить</button>`;
  const modalRoot=mountModal(document.body,modal(content,{title:host.querySelector('.time-picker__label')?.textContent||'Время'}));
  if(!modalRoot)return;
  const center=(type,value)=>{const item=modalRoot.querySelector(`[data-time-wheel-type="${type}"][data-value="${value}"]`);if(item)item.scrollIntoView({block:'center'});};
  center('hours',initialHour);center('minutes',initialMinute);
  modalRoot.querySelectorAll('[data-time-wheel-item]').forEach(item=>item.addEventListener('click',()=>{const type=item.dataset.timeWheelType;modalRoot.querySelectorAll(`[data-time-wheel-type="${type}"]`).forEach(node=>node.classList.remove('is-selected'));item.classList.add('is-selected');item.scrollIntoView({block:'center',behavior:'smooth'})}));
  modalRoot.querySelector('[data-time-save]')?.addEventListener('click',()=>{const hour=modalRoot.querySelector('[data-time-wheel-type="hours"].is-selected')?.dataset.value;const minute=modalRoot.querySelector('[data-time-wheel-type="minutes"].is-selected')?.dataset.value;if(hour==null||minute==null)return;const value=`${String(Number(hour)).padStart(2,'0')}:${String(Number(minute)).padStart(2,'0')}`;hidden.value=value;host.querySelector('[data-time-open]').textContent=value;modalRoot.remove()});
}