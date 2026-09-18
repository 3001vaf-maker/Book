import { apiRequest, getAuthToken } from '../core/auth.js';

const BUTTON_ID = 'manual-invite-button';
const MODAL_ID = 'manual-invite-modal';

function installStyles() {
  if (document.querySelector('#manual-invite-styles')) return;
  const style = document.createElement('style');
  style.id = 'manual-invite-styles';
  style.textContent = `
    #${BUTTON_ID}{position:fixed;right:24px;bottom:24px;z-index:80;border:0;border-radius:14px;padding:13px 18px;background:#292522;color:#fff;font:700 14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer;box-shadow:0 10px 30px rgba(41,37,34,.22)}
    #${BUTTON_ID}[hidden]{display:none!important}
    #${MODAL_ID}{position:fixed;inset:0;z-index:90;background:rgba(41,37,34,.35);display:grid;place-items:center;padding:20px}
    #${MODAL_ID} .manual-card{width:min(100%,560px);background:#fff;border-radius:20px;padding:24px;box-shadow:0 24px 70px rgba(41,37,34,.25);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#292522}
    #${MODAL_ID} h3{margin:0 0 8px;font-size:22px} #${MODAL_ID} p{margin:0 0 16px;color:#817a74;line-height:1.45}
    #${MODAL_ID} input{width:100%;padding:12px 14px;border:1px solid #d8cec7;border-radius:12px;font:inherit}
    #${MODAL_ID} .manual-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}
    #${MODAL_ID} button{border:0;border-radius:12px;padding:11px 14px;font:700 14px inherit;cursor:pointer;background:#292522;color:#fff}
    #${MODAL_ID} button.secondary{background:#eee8e3;color:#292522}
    @media(max-width:640px){#${BUTTON_ID}{right:14px;bottom:14px}}
  `;
  document.head.append(style);
}

function closeModal() {
  document.querySelector(`#${MODAL_ID}`)?.remove();
}

function showModal(url) {
  closeModal();
  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.innerHTML = `
    <section class="manual-card">
      <h3>Ссылка пользователю</h3>
      <p>Ссылка одноразовая и действует 7 дней. Отправьте её пользователю.</p>
      <input data-link readonly>
      <div class="manual-actions">
        <button class="secondary" data-close>Закрыть</button>
        <button data-copy>Скопировать ссылку</button>
      </div>
    </section>`;
  document.body.append(modal);
  const input = modal.querySelector('[data-link]');
  input.value = url;
  modal.querySelector('[data-close]').addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  modal.querySelector('[data-copy]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(url);
      button.textContent = 'Скопировано';
    } catch {
      input.focus();
      input.select();
      document.execCommand('copy');
      button.textContent = 'Скопировано';
    }
  });
}

async function createManualInvitation(button) {
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Создаём…';
  try {
    const response = await apiRequest('/saas-admin/manual-invitations', { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || 'Не удалось создать ссылку');
    showModal(payload.url);
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Не удалось создать ссылку');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function ensureButton() {
  if (!getAuthToken()) {
    document.querySelector(`#${BUTTON_ID}`)?.remove();
    return;
  }

  let button = document.querySelector(`#${BUTTON_ID}`);
  if (!button) {
    installStyles();
    button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Бесплатный доступ';
    button.addEventListener('click', () => createManualInvitation(button));
    document.body.append(button);
  }

  button.hidden = Boolean(document.querySelector('.admin-drawer-backdrop, #manual-invite-modal'));
}

const observer = new MutationObserver(ensureButton);
observer.observe(document.documentElement, { childList: true, subtree: true });
ensureButton();
