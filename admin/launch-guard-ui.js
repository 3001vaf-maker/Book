import { apiRequest } from '../core/auth.js';

let checking = false;

async function applyLaunchState() {
  const form = document.querySelector('[data-invite-form]');
  if (!form || form.dataset.launchGuard === 'ready' || checking) return;
  checking = true;
  try {
    const response = await apiRequest('/platform/legal/readiness');
    const readiness = await response.json().catch(() => ({}));
    if (!response.ok) return;
    const status = readiness?.state?.status || 'PRE_LAUNCH';
    const panel = form.closest('.admin-invite-panel');
    if (!panel) return;
    panel.querySelector('[data-real-master-note]')?.remove();
    const note = document.createElement('p');
    note.dataset.realMasterNote = 'true';
    note.className = status === 'LEGAL_READY' ? 'admin-inline-message' : 'admin-inline-message error';
    if (status === 'LEGAL_READY') {
      note.textContent = 'REAL: регистрация настоящего мастера разрешена. Новый мастер начнёт в DEMO.';
    } else {
      note.textContent = 'REAL-регистрация заблокирована до LEGAL_READY. Для проверки используй раздел «Тестирование» — там создаётся синтетический мастер без реальных ПД.';
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
    }
    panel.insertBefore(note, form);
    form.dataset.launchGuard = 'ready';
  } finally {
    checking = false;
  }
}

const observer = new MutationObserver(() => applyLaunchState());
observer.observe(document.documentElement, { childList: true, subtree: true });
applyLaunchState();
