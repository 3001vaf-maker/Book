import { modal, mountModal } from '../modals/index.js';

const esc=(v='')=>String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
const normalize=v=>{const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return {h:0,min:0};return {h:Math.min(23,Number(m[1])),min:Number(m[2])<60?Number(m[2]):0}};
const text=v=>{const {h,min}=normalize(v);return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`};
const CYCLES=5;
const MIDDLE_CYCLE=Math.floor(CYCLES/2);

export function wheel({values,selected,type,formatter=(v)=>String(v).padStart(2,'0')}={}){
  const base=Array.isArray(values)?values:[];
  return Array.from({length:CYCLES},(_,cycle)=>base.map((value,index)=>`<button type="button" class="time-wheel__item${cycle===MIDDLE_CYCLE&&String(value)===String(selected)?' is-selected':''}" data-time-wheel-item data-time-wheel-type="${esc(type)}" data-value="${esc(value)}" data-cycle="${cycle}" data-index="${index}">${esc(formatter(value))}</button>`).join('')).join('');
}

export function timePicker({name,label,value='',minuteStep=15,min='00:00',max='23:59'}={}){
  return `<div class="time-picker" data-time-picker="${esc(name)}" data-time-minute-step="${Number(minuteStep)||15}" data-time-min="${esc(min)}" data-time-max="${esc(max)}"><span class="time-picker__label">${esc(label)}</span><button type="button" class="time-picker__button" data-time-open>${text(value)}</button><input type="hidden" name="${esc(name)}" value="${text(value)}" data-time-value></div>`;
}

export function initTimePickers(root){root.querySelectorAll('[data-time-picker]').forEach(host=>host.querySelector('[data-time-open]')?.addEventListener('click',()=>open(host)))}

function open(host){
  const hidden=host.querySelector('[data-time-value]');
  const current=normalize(hidden?.value);
  const step=Math.max(1,Math.min(59,Number(host.dataset.timeMinuteStep)||15));
  const min=normalize(host.dataset.timeMin||'00:00');
  const max=normalize(host.dataset.timeMax||'23:59');
  const hours=Array.from({length:24},(_,i)=>i).filter(h=>h>=min.h&&h<=max.h);
  const minutes=Array.from({length:Math.floor(59/step)+1},(_,i)=>i*step).filter(m=>m<=59);
  const initialHour=hours.includes(current.h)?current.h:hours[0];
  const initialMinute=minutes.includes(current.min)?current.min:minutes[0];
  const content=`<div class="modal-title"><h2>${esc(host.querySelector('.time-picker__label')?.textContent||'Время')}</h2></div><div class="time-wheel" data-time-wheel><div class="time-wheel__column" data-time-wheel-column="hours"><span class="time-wheel__label">Часы</span><div class="time-wheel__viewport">${wheel({values:hours,selected:initialHour,type:'hours'})}</div></div><div class="time-wheel__column" data-time-wheel-column="minutes"><span class="time-wheel__label">Минуты</span><div class="time-wheel__viewport">${wheel({values:minutes,selected:initialMinute,type:'minutes'})}</div></div></div><button type="button" class="ui-button" data-time-save>Сохранить</button>`;
  const modalRoot=mountModal(document.body,modal(content,{title:host.querySelector('.time-picker__label')?.textContent||'Время',variant:'compact'}));
  if(!modalRoot)return;

  const nearestItem=(viewport)=>{
    const items=[...viewport.querySelectorAll('[data-time-wheel-item]')];
    if(!items.length)return null;
    const centerY=viewport.getBoundingClientRect().top+viewport.clientHeight/2;
    let nearest=items[0],distance=Infinity;
    items.forEach(item=>{const rect=item.getBoundingClientRect();const d=Math.abs(rect.top+rect.height/2-centerY);if(d<distance){distance=d;nearest=item;}});
    return nearest;
  };

  const selectOnly=(viewport,item)=>viewport.querySelectorAll('[data-time-wheel-item]').forEach(other=>other.classList.toggle('is-selected',other===item));

  const center=(type,value)=>{
    const item=modalRoot.querySelector(`[data-time-wheel-type="${type}"][data-value="${CSS.escape(String(value))}"][data-cycle="${MIDDLE_CYCLE}"]`);
    const viewport=item?.closest('.time-wheel__viewport');
    if(!item||!viewport)return;
    viewport.scrollTop=item.offsetTop-(viewport.clientHeight-item.offsetHeight)/2;
    selectOnly(viewport,item);
  };

  const syncColumn=(viewport,{recenter=true}={})=>{
    const nearest=nearestItem(viewport);
    if(!nearest)return;
    selectOnly(viewport,nearest);
    if(!recenter)return;
    const cycle=Number(nearest.dataset.cycle);
    if(cycle===MIDDLE_CYCLE)return;
    const type=nearest.dataset.timeWheelType;
    const value=nearest.dataset.value;
    const twin=modalRoot.querySelector(`[data-time-wheel-type="${type}"][data-value="${CSS.escape(value)}"][data-cycle="${MIDDLE_CYCLE}"]`);
    if(!twin)return;
    viewport.scrollTop+=twin.offsetTop-nearest.offsetTop;
    selectOnly(viewport,twin);
  };

  modalRoot.querySelectorAll('.time-wheel__viewport').forEach(viewport=>{
    let frame=0;
    let settle=0;
    viewport.addEventListener('scroll',()=>{
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      frame=requestAnimationFrame(()=>syncColumn(viewport,{recenter:false}));
      settle=setTimeout(()=>syncColumn(viewport,{recenter:true}),90);
    },{passive:true});
  });

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    center('hours',initialHour);
    center('minutes',initialMinute);
  }));

  modalRoot.querySelectorAll('[data-time-wheel-item]').forEach(item=>item.addEventListener('click',()=>{
    const viewport=item.closest('.time-wheel__viewport');
    if(!viewport)return;
    selectOnly(viewport,item);
    viewport.scrollTo({top:item.offsetTop-(viewport.clientHeight-item.offsetHeight)/2,behavior:'smooth'});
  }));

  modalRoot.querySelector('[data-time-save]')?.addEventListener('click',()=>{
    modalRoot.querySelectorAll('.time-wheel__viewport').forEach(viewport=>syncColumn(viewport,{recenter:false}));
    const hour=modalRoot.querySelector('[data-time-wheel-type="hours"].is-selected')?.dataset.value;
    const minute=modalRoot.querySelector('[data-time-wheel-type="minutes"].is-selected')?.dataset.value;
    if(hour==null||minute==null)return;
    const value=`${String(Number(hour)).padStart(2,'0')}:${String(Number(minute)).padStart(2,'0')}`;
    hidden.value=value;host.querySelector('[data-time-open]').textContent=value;modalRoot.remove();
  });
}
