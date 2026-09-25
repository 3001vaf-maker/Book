import { changeAccountPassword, changeGlobalAccountPassword } from '../core/account/index.js';
import { button, initPasswordFields, modal, mountModal, passwordField } from '../ui/ui.js';

export function openAccountPasswordSettings(state) {
  const content = `<form class="form-grid" data-account-password-form>
    ${passwordField({ label: 'Текущий пароль', name: 'currentPassword', required: true, autocomplete: 'current-password' })}
    ${passwordField({ label: 'Новый пароль', name: 'newPassword', required: true, autocomplete: 'new-password' })}
    ${passwordField({ label: 'Повторите новый пароль', name: 'repeatPassword', required: true, autocomplete: 'new-password' })}
    <div class="form-error" data-account-password-error role="alert"></div>
    ${button('Сохранить пароль', { type: 'submit' })}
  </form>`;
  const layer = mountModal(document.body, modal(content, { variant: 'large', title: 'Изменить пароль' }));
  if (!layer) return null;
  initPasswordFields(layer);
  const form = layer.querySelector('[data-account-password-form]');
  const errorNode = layer.querySelector('[data-account-password-error]');
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
      if (state.globalAccount) await changeGlobalAccountPassword(currentPassword, newPassword);
      else await changeAccountPassword(state.tenantId, currentPassword, newPassword);
      layer.remove();
      mountModal(document.body, modal('<p>Новый пароль сохранён.</p>', { variant: 'compact', title: 'Пароль изменён' }));
    } catch (error) {
      if (errorNode) errorNode.textContent = error instanceof Error ? error.message : 'Не удалось изменить пароль';
      if (submit) submit.disabled = false;
    }
  });
  return layer;
}
