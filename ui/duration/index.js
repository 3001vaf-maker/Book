import { modal, mountModal } from '../modals/index.js';
import { wheel } from '../time/index.js';

const esc=(v='')=>String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
const text=m=>{m=Math.max(0,Number(m)||0);const h=Math.floor(m/60),min=m%60;return h?`${h} ч${min?` ${min} мин`:''}`:`${min} мин`};

export function durationPicker({name='duration',label='Длительность',value=0}={}){return `<div class="duration-picker" data-duration-picker="${esc(name)}"><span class="duration-picker__label">${esc(label)}</span><button type="button" class="duration-picker__button" data-duration-open>${text(value)}</button><input type="hidden" name="${esc(name)}" value="${Number(value)||0}" data-duration-value></div>`}
export function initDurationPickers(root){root.querySelectorAll('[data-duration-picker]').forEach(host=>host.querySelector('[data-duration-open]')?.addEventListener('click',()=>open(host)))}

function open(host){
  const hidden=host.querySelector('[data-duration-value]');
  const current=Math.max(0,Number(hidden?.value)||0);
  const currentHours=Math.min(12,Math.floor(current/60));
  const currentMinutes=current%60;
  const hours=Array.from({length:12},(_,i)=>i+1);
  const minutes=Array.from({length:59},(_,i)=>i+1);
  const initialHour=currentHours>=1?currentHours:1;
  const initialMinute=currentMinutes>=1?currentMinutes:1;
  const content=`<div class="modal-title"><h2>${esc(host.querySelector('.duration-picker__label')?.textContent||'Длительность')}</h2></div><div class="time-wheel" data-duration-wheel><div class="time-wheel__column"><span class="time-wheel__label">Часы</span><div class="time-wheel__viewport">${wheel({values:hours,selected:initialHour,type:'duration-hours',formatter:v=>`${v} ч`})}</div></div><div class="time-wheel__column"><span class="time-wheel__label">Минуты</span><div class="time-wheel__viewport">${wheel({values:minutes,selected:initialMinute,type:'duration-minutes',formatter:v=>`${v} мин`})}</div></div></div><button type="button" class="ui-button" data-duration-save>Сохранить</button>`;
  const modalRoot=mountModal(document.body,modal(content,{title:host.querySelector('.duration-picker__label')?.textContent||'Длительность'}));
  if(!modalRoot)return;
  const center=(type,value)=>{const item=modalRoot.querySelector(`[data-time-wheel-type="${type}"][data-value="${value}"]`);if(item)item.scrollIntoView({block:'center'});};
  const syncColumn=(viewport)=>{
    const items=[...viewport.querySelectorAll('[data-time-wheel-item]')];
    if(!items.length)return;
    const centerY=viewport.getBoundingClientRect().top+viewport.clientHeight/2;
    let nearest=items[0],distance=Infinity;
    items.forEach(item=>{const rect=item.getBoundingClientRect();const d=Math.abs(rect.top+rect.height/2-centerY);if(d<distance){distance=d;nearest=item;}});
    items.forEach(item=>item.classList.toggle('is-selected',item===nearest));
  };
  center('duration-hours',initialHour);center('duration-minutes',initialMinute);
  modalRoot.querySelectorAll('.time-wheel__viewport').forEach(viewport=>{
    let frame=0;
    viewport.addEventListener('scroll',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>syncColumn(viewport));},{passive:true});
    syncColumn(viewport);
  });
  modalRoot.querySelectorAll('[data-time-wheel-item]').forEach(item=>item.addEventListener('click',()=>{
    const viewport=item.closest('.time-wheel__viewport');
    viewport?.querySelectorAll('[data-time-wheel-item]').forEach(other=>other.classList.remove('is-selected'));
    item.classList.add('is-selected');
    item.scrollIntoView({block:'center',behavior:'smooth'});
  }));
  modalRoot.querySelector('[data-duration-save]')?.addEventListener('click',()=>{
    const hours=Number(modalRoot.querySelector('[data-time-wheel-type="duration-hours"].is-selected')?.dataset.value)||0;
    const minutes=Number(modalRoot.querySelector('[data-time-wheel-type="duration-minutes"].is-selected')?.dataset.value)||0;
    const total=hours*60+minutes;
    hidden.value=String(total);host.querySelector('[data-duration-open]').textContent=text(total);modalRoot.remove();
  });
}
