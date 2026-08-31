import { accordion, initAccordions } from './accordion/accordion.js';
import { bottomNavigation } from './navigation/navigation.js';

const escapeMap={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
export const escapeHtml=(v='')=>String(v).replace(/[&<>"']/g,c=>escapeMap[c]);
export { accordion, initAccordions, bottomNavigation };
export function pageHeader(title,subtitle=''){return `<header class="page-header"><h1>${escapeHtml(title)}</h1>${subtitle?`<p>${escapeHtml(subtitle)}</p>`:''}</header>`}
export function button(label,{className='',data='',type='button',aria=''}={}){return `<button type="${type}" class="ui-button ${className}" ${data}${aria?` aria-label="${escapeHtml(aria)}"`:''}>${label}</button>`}
export function iconButton(label,{className='',data='',aria=label}={}){return `<button type="button" class="icon-button ${className}" ${data} aria-label="${escapeHtml(aria)}">${label}</button>`}
export function field({label,name,value='',type='text',placeholder='',required=false,readonly=false,inputmode=''}){return `<label class="field"><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required?'required':''} ${readonly?'readonly':''} ${inputmode?`inputmode="${inputmode}"`:''}></label>`}
export function emptyState(title,text=''){return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${text?`<span>${escapeHtml(text)}</span>`:''}</div>`}
export function modal(content,{title=''}={}){return `<div class="modal-backdrop" data-modal><div class="modal-sheet" role="dialog" aria-modal="true" ${title?`aria-label="${escapeHtml(title)}"`:''}><button type="button" class="modal-close" data-modal-close aria-label="Закрыть">×</button>${content}</div></div>`}
export function mountModal(root,html){const mount=document.querySelector('#overlay-mount')||root;mount.insertAdjacentHTML('beforeend',html);const m=mount.querySelector('[data-modal]:last-of-type');m?.addEventListener('click',e=>{if(e.target.matches('[data-modal],[data-modal-close]'))m.remove()});requestAnimationFrame(()=>m?.querySelector('input,select,textarea,button:not([data-modal-close])')?.focus());return m}
