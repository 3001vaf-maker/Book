import { getCardAppearanceTemplate } from '../../card-appearance-templates.js';

const SCOPE='loyalty-deposit';

function defaultAppearance(){
  const lines=Array.from({length:9},()=>({}));
  lines[0]={field:'status',zone:'right',align:'right',size:'m',color:'white'};
  lines[5]={field:'title',zone:'full',align:'left',size:'xl',color:'white',bold:true};
  lines[6]={field:'subtitle',zone:'full',align:'left',size:'m',color:'white'};
  lines[7]={field:'metaLeft',zone:'left',align:'left',size:'m',color:'white'};
  lines[8]={field:'metaRight',zone:'right',align:'right',size:'m',color:'white'};
  return {lines};
}

export function depositCardAppearance(){return getCardAppearanceTemplate(SCOPE)?.appearance||defaultAppearance();}
export function depositCardPhoto(){return getCardAppearanceTemplate(SCOPE)?.photo||'';}
export function depositCardPhotoPosition(){return getCardAppearanceTemplate(SCOPE)?.photoPosition||'50% 50%';}
export function depositCardScope(){return SCOPE;}
export function depositCardFields({title='',subtitle='Депозит',status='',metaLeft='',metaRight=''}={}){
  return [
    {value:'title',label:'Название',text:String(title||'Депозит')},
    {value:'subtitle',label:'Подпись',text:String(subtitle||'Депозит')},
    {value:'status',label:'Статус',text:String(status||'')},
    {value:'metaLeft',label:'Данные слева',text:String(metaLeft||'')},
    {value:'metaRight',label:'Данные справа',text:String(metaRight||'')},
  ];
}
