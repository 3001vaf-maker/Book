import { accountErrorMessage, getAccountConsentState, revokeAccountConsent } from '../core/account/index.js';
import {
  button,
  emptyState,
  listEntries,
  listEntry,
  mountModal,
  modal,
  openNotice,
} from '../ui/ui.js';

function consentRows(consents = []) {
  return (Array.isArray(consents) ? consents : []).map((item, index) => listEntry({
    title: item?.title || item?.documentId || 'Согласие',
    subtitle: item?.accepted ? 'Дано' : item?.status === 'revoked' ? 'Отозвано' : 'Не дано',
    rightTop: item?.required ? 'Обязательное' : '',
    data: item?.accepted ? `data-account-consent-revoke="${index}"` : '',
    aria: item?.accepted ? `Отозвать согласие ${item?.title || item?.documentId || ''}` : '',
  }));
}

function confirmRevoke(consent, onConfirm) {
  const title = String(consent?.title || consent?.documentId || 'Согласие');
  const content = `<div class="form-grid">
    <div class="muted">После отзыва функции, которым необходимо это согласие, будут недоступны до повторного согласия.</div>
    ${button('Отозвать согласие', { variant: 'danger', data: 'data-confirm-consent-revoke' })}
    ${button('Отмена', { variant: 'secondary', data: 'data-cancel-consent-revoke' })}
  </div>`;
  const layer = mountModal(document.body, modal(content, { variant: 'compact', title }));
  layer?.querySelector('[data-cancel-consent-revoke]')?.addEventListener('click', () => layer.remove());
  layer?.querySelector('[data-confirm-consent-revoke]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await onConfirm?.();
      layer.remove();
    } catch (error) {
      event.currentTarget.disabled = false;
      openNotice({
        title: 'Согласие не отозвано',
        message: accountErrorMessage(error, 'Не удалось отозвать согласие'),
        action: 'Закрыть',
        variant: 'technical',
      });
    }
  });
}

export async function openAccountConsentSettings(state, { tenantId = state?.tenantId, onChanged } = {}) {
  const scopeTenantId = String(tenantId || '');
  if (!scopeTenantId) return openNotice({ title: 'Согласия недоступны', message: 'Не выбран контакт.', action: 'Закрыть', variant: 'technical' });
  let consentState;
  try {
    consentState = await getAccountConsentState(scopeTenantId);
  } catch (error) {
    return openNotice({
      title: 'Согласия недоступны',
      message: accountErrorMessage(error, 'Не удалось загрузить согласия'),
      action: 'Закрыть',
      variant: 'technical',
    });
  }

  const consents = Array.isArray(consentState?.consents) ? consentState.consents : [];
  const content = consents.length
    ? `<div class="form-grid">${listEntries(consentRows(consents))}<div class="muted">Нажмите на действующее согласие, чтобы отозвать его.</div></div>`
    : emptyState('Согласий пока нет', 'Здесь появятся согласия, которые вы давали.');
  const layer = mountModal(document.body, modal(content, { variant: 'large', title: 'Согласия' }));

  layer?.querySelectorAll('[data-account-consent-revoke]').forEach((node) => node.addEventListener('click', () => {
    const consent = consents[Number(node.dataset.accountConsentRevoke)];
    if (!consent?.accepted || !consent?.documentId) return;
    confirmRevoke(consent, async () => {
      await revokeAccountConsent(scopeTenantId, consent.documentId);
      layer.remove();
      await onChanged?.(consent.documentId);
      await openAccountConsentSettings(state, { tenantId: scopeTenantId, onChanged });
    });
  }));
  return layer;
}
