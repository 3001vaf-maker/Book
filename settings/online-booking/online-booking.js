import { buildBookingLink } from '../../core/booking-link/index.js';
import { getCurrentUser } from '../../core/auth.js';
import { actionBlock, button, copyIconButton, copyTextToClipboard, emptyState, escapeHtml, pageHeader, select } from '../../ui/ui.js';
import { getWorkplaces } from '../profile/workplaces/data.js';

function bookingLink(tenantId, workplaceKey = '') {
  return buildBookingLink({
    origin: window.location.origin,
    pathname: window.location.pathname,
    tenantId,
    workplaceKey,
  });
}

function copyLinkField(label, value, kind) {
  return `<div class="field"><span>${escapeHtml(label)}</span><div class="array-row"><input type="text" value="${escapeHtml(value)}" readonly aria-label="${escapeHtml(label)}">${copyIconButton({ data: `data-copy-booking-link="${escapeHtml(kind)}"`, aria: `Скопировать: ${label}` })}</div></div>`;
}

function bindCopyButtons(root) {
  root.querySelectorAll('[data-copy-booking-link]').forEach((copyButton) => {
    copyButton.addEventListener('click', async () => {
      const value = copyButton.closest('.array-row')?.querySelector('input')?.value || '';
      if (!value) return;
      try {
        await copyTextToClipboard(value);
      } catch {
        // Clipboard access can be blocked by the browser; keep the link visible for manual copy.
      }
    });
  });
}

function renderReady(root, navigateBack, tenantId, selectedWorkplaceKey = '') {
  const workplaces = getWorkplaces();
  const selected = workplaces.find((item) => item.key === selectedWorkplaceKey) || null;
  const options = [
    { value: '', label: 'Выбрать рабочее пространство' },
    ...workplaces.map((item) => ({ value: item.key, label: item.name || 'Без названия' })),
  ];
  const generalLink = bookingLink(tenantId);
  const workplaceLink = selected ? bookingLink(tenantId, selected.key) : '';
  const selectedLinkMarkup = selected && workplaceLink
    ? copyLinkField(selected.name || 'Рабочее пространство', workplaceLink, 'workplace')
    : '';

  root.innerHTML = `${pageHeader('Онлайн-запись')}${copyLinkField('Общая ссылка', generalLink, 'general')}${select({
    label: 'Ссылка рабочего пространства',
    name: 'bookingWorkplace',
    value: selected?.key || '',
    options,
    aria: 'Выбрать рабочее пространство для онлайн-записи',
  })}${selectedLinkMarkup}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-online-booking-back' }))}`;

  bindCopyButtons(root);
  root.querySelector('input[name="bookingWorkplace"]')?.addEventListener('change', (event) => {
    renderReady(root, navigateBack, tenantId, event.target.value);
  });
  root.querySelector('[data-online-booking-back]')?.addEventListener('click', navigateBack);
}

export function render(root, navigateBack = () => {}) {
  root.innerHTML = `${pageHeader('Онлайн-запись')}${emptyState('Загрузка', 'Формируем ссылки онлайн-записи.')}`;
  void getCurrentUser()
    .then((account) => {
      const tenantId = String(account?.tenant?.id || '');
      if (!tenantId) {
        root.innerHTML = `${pageHeader('Онлайн-запись')}${emptyState('Ссылка недоступна', 'Не удалось определить рабочее пространство аккаунта.')}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-online-booking-back' }))}`;
        root.querySelector('[data-online-booking-back]')?.addEventListener('click', navigateBack);
        return;
      }
      renderReady(root, navigateBack, tenantId);
    })
    .catch(() => {
      root.innerHTML = `${pageHeader('Онлайн-запись')}${emptyState('Ссылка недоступна', 'Не удалось получить данные аккаунта.')}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-online-booking-back' }))}`;
      root.querySelector('[data-online-booking-back]')?.addEventListener('click', navigateBack);
    });
}
