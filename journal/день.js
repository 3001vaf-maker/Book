import { getDateState } from '../timetable/timetable.js';

function slots(start,end){const m=v=>{const [h,n]=v.split(':').map(Number);return h*60+n};const a=m(start),b=m(end),r=[];for(let x=a;x<=b;x+=30)r.push(`${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`);return r}

export function renderJournalDay(root,date=new Date().toISOString().slice(0,10)){const s=getDateState(date);if(s.status!=='working'){root.innerHTML='<div class="empty-state"><strong>Выходной</strong><span>Для этой даты в Графике не задан рабочий день.</span></div>';return}const list=slots(s.start,s.end);root.innerHTML=`<section class="day-time-grid"><div class="day-time-grid__header"><strong>${date}</strong><span>${s.start} — ${s.end} · ${list.length-1} интервалов по 30 минут</span></div><div class="day-time-grid__body">${list.map(t=>`<div class="day-time-slot"><span>${t}</span><div></div></div>`).join('')}</div></section>`}
