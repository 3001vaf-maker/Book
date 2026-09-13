import { changeBookingPassword } from '../core/booking-account/index.js';
import { button, field, modal, mountModal, openNotice } from '../ui/ui.js';

export function openClientPasswordSettings(state) {
  const content = `<form class="form-grid" data-client-password-form>
    ${field({ label: 'Текущий пароль', name: 'currentPassword', type: 'password', required: true, autocomplete: 'current-password' })}
    ${field({ label: 'Новый пароль', name: 'newPassword', type: 'password', required: true, autocomplete: 'new-password' })}
    ${field({ label: 'Повторите новый пароль', name: 'repeatPassword', type: 'password', required: true, autocomplete: 'new-password' })}
    <div class="form-error" data-client-password-error role="alert"></div>
    ${button('Сохранить пароль', { type: 'submit' })}
  </form>`;
  const layer = mountModal(document.body, modal(content, { variant: 'medium', surface: 'app', title: 'Изменить пароль' }));
  if (!layer) return null;
  const form = layer.querySelector('[data-client-password-form]');
  const errorNode = layer.querySelector('[data-client-password-error]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const currentPassword = String(data.get('currentPassword') || '');
    const newPassword = String(data.get('newPassword') || '');
    const repeatPassword = String(data.get('repeatPassword') || '');
    if (newPassword.length < 8) {
      if (errorNode) errorNode.textContent = 'Новый пароль должен содержать минимум 8 символов.';
      return;
    }
    if (newPassword !== repeatPassword) {
      if (errorNode) errorNode.textContent = 'Новые пароли не совпадают.';
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    if (errorNode) errorNode.textContent = '';
    try {
      await changeBookingPassword(state.tenantId, currentPassword, newPassword);
      layer.remove();
      openNotice({ title: 'Пароль изменён', message: 'Новый пароль сохранён.' });
    } catch (error) {
      if (errorNode) errorNode.textContent = error instanceof Error ? error.message : 'Не удалось изменить пароль';
      if (submit) submit.disabled = false;
    }
  });
  return layer;
}
