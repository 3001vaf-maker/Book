import { apiRequest } from '../../core/auth.js';
import { disablePlatformPush, enablePlatformPush, getPlatformPushState } from '../../core/platform-notices.js';
import { emptyState, escapeHtml, modal, mountModal, v2Document, v2LegalCards, v2Section } from '../../ui/ui.js';
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
  if (!consents.length) return emptyState('Согласий пока нет', 'Здесь появятся актуальные согласия вашей учётной записи.');
  return v2LegalCards(consents.map((item) => ({
    title:item.title,
    status:actionText(item.action),
    checked:Boolean(item.active),
    openData:`data-account-consent-open="${escapeHtml(item.key)}"`,
    openAria:`Открыть документ ${item.title}`,
    toggleData:`data-consent-toggle="${escapeHtml(item.key)}" data-active="${item.active ? 'true' : 'false'}"`,
    toggleAria:`${item.active ? 'Отозвать' : 'Дать'} согласие: ${item.title}`,
  })));
}

function serviceMarkup(state, pushState) {
  const emailEnabled = state.serviceNotifications?.email !== false;
  const telegramAvailable = state.serviceNotifications?.telegramAvailable === true;
  const telegramEnabled = telegramAvailable && state.serviceNotifications?.telegram !== false;
  const pushSupported = Boolean(pushState?.supported && pushState?.enabled);
  const pushEnabled = Boolean(pushState?.subscribed);

  return `<div class="account-controls-service-list" aria-label="Куда получать сервисные уведомления">
    <label class="account-controls-service-row">
      <input type="checkbox" data-service-telegram ${telegramEnabled ? 'checked' : ''} ${telegramAvailable ? '' : 'disabled'}>
      <span><strong>Telegram</strong><small>${telegramAvailable ? 'Канал подключён.' : 'Канал платформенного аккаунта не подключён.'}</small></span>
    </label>
    <label class="account-controls-service-row">
      <input type="checkbox" data-service-email ${emailEnabled ? 'checked' : ''}>
      <span><strong>Email</strong><small>Сервисные сообщения на email учётной записи.</small></span>
    </label>
    <label class="account-controls-service-row">
      <input type="checkbox" data-service-push ${pushEnabled ? 'checked' : ''} ${pushSupported ? '' : 'disabled'}>
      <span><strong>Push</strong><small>${pushSupported ? 'Push-уведомления на этом устройстве.' : 'Push на этом устройстве сейчас недоступен.'}</small></span>
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
  mountModal(document.body,modal(v2Document({
    title:item.title || 'Документ',
    version:document?.version || item.currentVersion || item.eventVersion || '',
    content,
  }),{variant:'large',title:item.title || 'Документ'}));
}

async function renderPanelState(root,state,pushState=null){
  const consents=Array.isArray(state.consents)?state.consents:[];
  const push=pushState || await getPlatformPushState().catch(()=>({supported:false,enabled:false,subscribed:false}));
  root.innerHTML=`
    ${v2Section('Согласия',consentCards(consents))}
    ${v2Section('Сервисные уведомления',serviceMarkup(state,push))}
  `;

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
        await renderPanelState(root,next,push);
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

  root.querySelector('[data-service-push]')?.addEventListener('change',async(event)=>{
    const input=event.currentTarget;
    const status=root.querySelector('[data-controls-status]');
    input.disabled=true;
    if(status)status.textContent='Сохраняем…';
    try{
      const next=input.checked?await enablePlatformPush():await disablePlatformPush();
      input.checked=Boolean(next?.subscribed);
      input.disabled=!(next?.supported&&next?.enabled);
      if(status)status.textContent=input.checked?'Push включён.':'Push выключен.';
    }catch(error){
      input.checked=!input.checked;
      if(status)status.textContent=error instanceof Error?error.message:'Не удалось изменить Push';
    }finally{
      if(push?.supported&&push?.enabled)input.disabled=false;
    }
  });
}

export async function renderAccountControlsPanel(root){
  root.innerHTML=emptyState('Загрузка','Получаем актуальные состояния.');
  try{
    const [state,push]=await Promise.all([
      request('/profile/account-controls'),
      getPlatformPushState().catch(()=>({supported:false,enabled:false,subscribed:false})),
    ]);
    await renderPanelState(root,state,push);
  }catch(error){
    root.innerHTML=emptyState('Раздел недоступен',error instanceof Error?error.message:'Не удалось загрузить данные');
  }
}
