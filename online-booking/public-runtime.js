function initializeTelegramMiniApp() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;
  try {
    webApp.ready();
    webApp.expand();
    document.documentElement.classList.add('telegram-mini-app');
  } catch {
    // Booking remains the same normal web app when Telegram shell APIs are unavailable.
  }
}

export function startBookingPublicRuntime({ tenantId = '' } = {}) {
  if (!String(tenantId || '').trim()) return () => {};
  initializeTelegramMiniApp();
  return () => {};
}
