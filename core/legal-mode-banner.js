import { apiRequest, getCurrentUser } from './auth.js';

function ensureBanner() {
  let banner = document.querySelector('[data-book-mode-banner]');
  if (banner) return banner;
  banner = document.createElement('div');
  banner.dataset.bookModeBanner = 'true';
  banner.className = 'book-mode-banner';
  const app = document.querySelector('#app');
  if (app?.parentNode) app.parentNode.insertBefore(banner, app);
  return banner;
}

export async function renderLegalModeBanner() {
  try {
    const account = await getCurrentUser();
    if (!account?.tenant) return;
    const response = await apiRequest('/legal/readiness');
    if (!response.ok) return;
    const readiness = await response.json().catch(() => ({}));
    const mode = readiness?.state?.operationMode || 'DEMO';
    const isTest = String(account.tenant.name || '').startsWith('[TEST]');
    const banner = ensureBanner();
    if (!banner) return;

    if (isTest) {
      banner.className = 'book-mode-banner test';
      banner.textContent = `TEST · ${mode} — синтетический Book. Реальные персональные данные и LIVE запрещены.`;
      return;
    }
    if (mode === 'LIVE') {
      banner.className = 'book-mode-banner live';
      banner.textContent = 'REAL · LIVE — рабочий режим. Разрешена работа с реальными клиентами в рамках настроенной юридической готовности.';
      return;
    }
    banner.className = 'book-mode-banner demo';
    banner.textContent = 'REAL · DEMO — настройка мастера. Реальные клиенты и внешние сообщения ещё заблокированы.';
  } catch {
    // Login/public screens intentionally have no runtime-mode banner.
  }
}

renderLegalModeBanner();
