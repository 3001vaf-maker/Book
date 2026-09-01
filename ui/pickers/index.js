import { escapeHtml } from '../ui.js';

export function timePicker({label,name,value='',required=false,className='',data=''}={}){return `<label class="field time-picker ${className}"><span>${escapeHtml(label||'Время')}</span><input name="${escapeHtml(name)}" type="time" value="${escapeHtml(value)}" ${required?'required':''} ${data}></label>`}
export function datePicker({label,name,value='',required=false,className='',data=''}={}){return `<label class="field date-picker ${className}"><span>${escapeHtml(label||'Дата')}</span><input name="${escapeHtml(name)}" type="date" value="${escapeHtml(value)}" ${required?'required':''} ${data}></label>`}
