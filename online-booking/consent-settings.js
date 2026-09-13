import { getBookingConsentState, revokeBookingConsent } from '../core/booking-account/index.js';
import {
  button,
  emptyState,
  escapeHtml,
  listEntries,
  listEntry,
  modal,
  mountModal,
} from '../ui/ui.js';

function consentRows(consents = []) {
  return (Array.isArray(consents) ? consents : []).map((item, index) => listEntry({
    title: item?.title || item?.documentId || 'Согласие',
    subtitle: item?.accepted ? 'Дано' : item?.status === 'revoked' ? 'Отозвано' : 'Не дано',
    rightTop: item?.required ? 'Обязательное' : '',
    data: item?.accepted ? `data-client-consent-revoke="${index}"` : '',
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
  const layer = mountModal(document.body, modal(content, { variant: 'compact', surface: 'app', title: escapeHtml(title) }));
  layer?.querySelector('[data-cancel-consent-revoke]')?.addEventListener('click', () => layer.remove());
  layer?.querySelector('[data-confirm-consent-revoke]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      await onConfirm?.();
      layer.remove();
    } catch (error) {
      event.currentTarget.disabled = false;
      event.currentTarget.insertAdjacentHTML('beforebegin', `<div class="form-error" role="alert">${escapeHtml(error instanceof Error ? error.message : 'Не удалось отозвать согласие')}</div>`);
    }
  });
}

export async function openClientConsentSettings(state, { onChanged } = {}) {
  let consentState;
  try {
    consentState = await getBookingConsentState(state.tenantId);
  } catch (error) {
    return mountModal(document.body, modal(emptyState('Согласия недоступны', error instanceof Error ? error.message : 'Не удалось загрузить согласия'), { variant: 'medium', surface: 'app', title: 'Согласия' }));
  }

  const consents = Array.isArray(consentState?.consents) ? consentState.consents : [];
  const content = consents.length
    ? `<div class="form-grid">${listEntries(consentRows(consents))}<div class="muted">Нажмите на действующее согласие, чтобы отозвать его.</div></div>`
    : emptyState('Согласий пока нет', 'Здесь появятся согласия, которые вы давали в Book.');
  const layer = mountModal(document.body, modal(content, { variant: 'large', surface: 'app', title: 'Согласия' }));

  layer?.querySelectorAll('[data-client-consent-revoke]').forEach((node) => node.addEventListener('click', () => {
    const consent = consents[Number(node.dataset.clientConsentRevoke)];
    if (!consent?.accepted || !consent?.documentId) return;
    confirmRevoke(consent, async () => {
      await revokeBookingConsent(state.tenantId, consent.documentId);
      layer.remove();
      await onChanged?.(consent.documentId);
      await openClientConsentSettings(state, { onChanged });
    });
  }));
  return layer;
}
