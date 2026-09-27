import { normalizeEntityCardAppearance } from '../../ui/ui.js';

function phoneOf(value = {}) {
  return String(value?.phones?.[0] || value?.phone || '');
}

function defaultLines(entries = []) {
  const lines=Array.from({length:9},()=>({field:'',zone:'full',align:'left',size:'m',color:'white',bold:false,italic:false,underline:false,uppercase:false}));
  entries.forEach(({row,field,zone='full',align='left',size='m',color='white',bold=false,italic=false,underline=false,uppercase=false})=>{
    const index=Math.max(0,Math.min(8,Number(row)-1));
    lines[index]={field,zone,align,size,color,bold,italic,underline,uppercase};
  });
  return lines;
}

function hasConfiguredLines(value = {}) {
  return Array.isArray(value?.lines) && value.lines.some((line)=>String(line?.field||'').trim());
}

export function profileCardFields(profile = {}, workplaces = []) {
  const first=(Array.isArray(workplaces)?workplaces:[])[0]||{};
  return [
    {value:'workTime',label:'График',text:first.from||first.to?`${first.from||'—'} - ${first.to||'—'}`:''},
    {value:'workplaceName',label:'Рабочее пространство',text:first.name||''},
    {value:'name',label:'Имя и фамилия',text:[profile.name,profile.surname].filter(Boolean).join(' ')},
    {value:'profession',label:'Профессия',text:profile.profession||''},
    {value:'phone',label:'Телефон',text:phoneOf(profile)},
    {value:'experience',label:'Опыт',text:profile.experience||''},
    {value:'about',label:'О себе',text:profile.about||''},
    {value:'workplaceCount',label:'Количество пространств',text:String((Array.isArray(workplaces)?workplaces:[]).length||'')},
  ];
}

export function workplaceCardFields(workplace = {}, profile = {}) {
  return [
    {value:'workTime',label:'График',text:workplace.from||workplace.to?`${workplace.from||'—'} - ${workplace.to||'—'}`:''},
    {value:'workplaceName',label:'Рабочее пространство',text:workplace.name||''},
    {value:'city',label:'Город',text:workplace.city||''},
    {value:'address',label:'Адрес',text:workplace.address||''},
    {value:'workplacePhone',label:'Телефон пространства',text:workplace.phone||''},
    {value:'currency',label:'Валюта',text:workplace.currency||''},
    {value:'profileName',label:'Имя и фамилия',text:[profile.name,profile.surname].filter(Boolean).join(' ')},
    {value:'profession',label:'Профессия',text:profile.profession||''},
    {value:'profilePhone',label:'Телефон профиля',text:phoneOf(profile)},
  ];
}

export function profileCardAppearance(profile = {}) {
  if(hasConfiguredLines(profile.cardAppearance)) return normalizeEntityCardAppearance(profile.cardAppearance);
  return normalizeEntityCardAppearance({
    lines:defaultLines([
      {row:1,field:'workTime',zone:'right',align:'right',size:'m'},
      {row:2,field:'workplaceName',zone:'right',align:'right',size:'m'},
      {row:7,field:'name',zone:'full',align:'left',size:'l',bold:true},
      {row:8,field:'profession',zone:'full',align:'left',size:'m'},
      {row:9,field:'phone',zone:'full',align:'left',size:'m'},
    ]),
  });
}

export function workplaceCardAppearance(workplace = {}) {
  if(hasConfiguredLines(workplace.cardAppearance)) return normalizeEntityCardAppearance(workplace.cardAppearance);
  return normalizeEntityCardAppearance({
    lines:defaultLines([
      {row:1,field:'workTime',zone:'right',align:'right',size:'m'},
      {row:2,field:'workplaceName',zone:'right',align:'right',size:'m'},
      {row:7,field:'profileName',zone:'full',align:'left',size:'l',bold:true},
      {row:8,field:'profession',zone:'full',align:'left',size:'m'},
      {row:9,field:'profilePhone',zone:'full',align:'left',size:'m'},
    ]),
  });
}