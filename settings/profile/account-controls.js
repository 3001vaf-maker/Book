import { apiRequest } from '../../core/auth.js';
import { button, emptyState, escapeHtml, list, mountV2Layer, page, pageHeader, v2Document, v2Layer, v2LegalCards, v2Section } from '../../ui/ui.js';
import { getDocuments } from '../documents/data.js';

async function request(path, options = {}) {
  const response = await apiRequest(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Не удалось загрузить настройки');
  return payload;
}

function moment(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function actionText(action) {
  if (action === 'CONSENTED') return 'Дано';
  if (action === 'REVOKED') return 'Отозвано';
  if (action === 'DECLINED') return 'Не дано';
  return action || 'Не дано';
}

function consentCards(consents) {
  if (!consents.length) return emptyState('Согласий пока нет', 'Здесь появятся согласия, которые относятся к вашей учётной записи.');
  return v2LegalCards(consents.map((item) => ({
    title:item.title,
    required:Boolean(item.requiredForRegistration),
    checked:Boolean(item.active),
    openData:`data-account-consent-open="${escapeHtml(item.key)}"`,
    openAria:`Открыть документ ${item.title}`,
    toggleData:`data-consent-toggle="${escapeHtml(item.key)}" data-active="${item.active ? 'true' : 'false'}"`,
    toggleAria:`${item.active ? 'Отозвать' : 'Дать'} согласие: ${item.title}`,
  })));
}

function historyMarkup(history) {
  if (!history.length) return emptyState('История пока пуста', 'Изменения согласий будут сохраняться здесь.');
  return list({
    items: history.map((item) => ({
      title: item.title,
      secondary: `${actionText(item.action)} · версия ${item.version} · ${moment(item.occurredAt)}`,
    })),
  });
}

function serviceMarkup(state) {
  const emailEnabled = state.serviceNotifications?.email !== false;
  return `<div class="account-controls-service-list">
    <label class="account-controls-service-row">
      <input type="checkbox" data-service-email ${emailEnabled ? 'checked' : ''}>
      <span><strong>Email</strong><small>Сервисные сообщения по вашей учётной записи.</small></span>
    </label>
    <div class="muted" data-controls-status></div>
  </div>`;
}

function findDocument(item) {
  const title = String(item?.title || '').trim();
  return getDocuments().find((document) => document.title === title) || null;
}

function openConsentDocument(item) {
  const document = findDocument(item);
  const content = document?.text || `Статус: ${actionText(item.action)}\nВерсия: ${item.eventVersion || item.currentVersion || '—'}\nДата: ${moment(item.occurredAt)}`;
  mountV2Layer(v2Layer(v2Document({
    title:item.title || 'Документ',
    version:document?.version || item.currentVersion || item.eventVersion || '',
    content,
  }),{kind:'standard',title:item.title || 'Документ'}));
}

function openConsentHistory(state) {
  mountV2Layer(v2Layer(historyMarkup(Array.isArray(state.history)?state.history:[]),{
    kind:'standard',
    title:'История согласий',
  }));
}

function renderPanelState(root,state){
  const consents=Array.isArray(state.consents)?state.consents:[];
  root.innerHTML=`
    ${v2Section('Согласия',consentCards(consents))}
    <div class="account-controls-history-link">${button('История согласий',{variant:'secondary',data:'data-consent-history'})}</div>
    ${v2Section('Сервисные уведомления',serviceMarkup(state))}
  `;

  root.querySelector('[data-consent-history]')?.addEventListener('click',()=>openConsentHistory(state));
  root.querySelectorAll('[data-account-consent-open]').forEach((control)=>{
    control.addEventListener('click',()=>{
      const item=consents.find((entry)=>entry.key===control.dataset.accountConsentOpen);
      if(item)openConsentDocument(item);
    });
  });

  root.querySelectorAll('[data-consent-toggle]').forEach((control)=>{
    control.addEventListener('click',async()=>{
      const key=control.dataset.consentToggle;
      const active=control.dataset.active==='true';
      control.disabled=true;
      try{
        const next=await request(`/profile/account-controls/consents/${encodeURIComponent(key)}`,{
          method:'PUT',
          body:JSON.stringify({active:!active}),
        });
        renderPanelState(root,next);
      }catch(error){
        control.disabled=false;
        const status=root.querySelector('[data-controls-status]');
        if(status)status.textContent=error instanceof Error?error.message:'Не удалось изменить согласие';
      }
    });
  });

  root.querySelector('[data-service-email]')?.addEventListener('change',async(event)=>{
    const input=event.currentTarget;
    const status=root.querySelector('[data-controls-status]');
    input.disabled=true;
    if(status)status.textContent='Сохраняем…';
    try{
      const next=await request('/profile/account-controls/service-notifications',{
        method:'PUT',
        body:JSON.stringify({email:input.checked}),
      });
      input.checked=next.serviceNotifications?.email!==false;
      if(status)status.textContent='Сохранено.';
    }catch(error){
      input.checked=!input.checked;
      if(status)status.textContent=error instanceof Error?error.message:'Не удалось сохранить';
    }finally{
      input.disabled=false;
    }
  });
}

export async function renderAccountControlsPanel(root){
  root.innerHTML=emptyState('Загрузка','Получаем актуальные состояния.');
  try{
    const state=await request('/profile/account-controls');
    renderPanelState(root,state);
  }catch(error){
    root.innerHTML=emptyState('Раздел недоступен',error instanceof Error?error.message:'Не удалось загрузить данные');
  }
}

export async function renderAccountControls(root,navigateBack=()=>{}){
  root.innerHTML=page([
    pageHeader('Согласия и уведомления'),
    '<div data-profile-account-controls-panel></div>',
    button('Назад',{variant:'secondary',data:'data-controls-back'}),
  ]);
  root.querySelector('[data-controls-back]')?.addEventListener('click',navigateBack);
  const panel=root.querySelector('[data-profile-account-controls-panel]');
  if(panel)await renderAccountControlsPanel(panel);
}

export { renderAccountControls as render };
