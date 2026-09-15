import { connectTelegramBot, disconnectTelegramBot, getTelegramBotConnection } from '../../core/integrations/telegram.js';
import { actionBlock, button, emptyState, field, folderList, pageHeader } from '../../ui/ui.js';

function renderTelegramForm(root, navigateBack, state = {}) {
  const connected = Boolean(state?.connected);
  const bot = String(state?.botUsername || '').trim();
  const configuration = state?.configuration || {};
  const statusText = connected
    ? `${bot || 'Telegram-бот'} подключён — webhook ${state?.webhookActive ? 'активен' : 'не подтверждён'}`
    : 'Telegram-бот не подключён.';
  const serverText = `Сервер: ключ ${configuration.credentialsKeyConfigured ? '✓' : '—'} · API ${configuration.publicApiUrlConfigured ? '✓' : '—'} · Book ${configuration.clientAppUrlConfigured ? '✓' : '—'}`;

  root.innerHTML = `${pageHeader('Telegram')}
    <form class="form-grid" data-telegram-integration-form>
      <div class="section-heading"><h2>${connected ? 'Подключённый бот' : 'Подключить бота'}</h2></div>
      <div class="muted">${statusText}</div>
      <div class="muted">${serverText}</div>
      ${field({ label: connected ? 'Новый токен бота' : 'Токен бота', name: 'telegramBotToken', type: 'password', placeholder: connected ? 'Вставьте токен только для замены' : 'Вставьте токен из BotFather' })}
      <div class="muted" data-telegram-integration-status aria-live="polite"></div>
      ${actionBlock(`${button(connected ? 'Заменить токен' : 'Подключить', { type: 'submit' })}${connected ? button('Отключить', { variant: 'secondary', data: 'data-telegram-disconnect' }) : ''}${button('Назад', { variant: 'secondary', data: 'data-telegram-back' })}`)}
    </form>`;

  root.querySelector('[data-telegram-back]')?.addEventListener('click', navigateBack);
  root.querySelector('[data-telegram-integration-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = root.querySelector('[data-telegram-integration-status]');
    const token = String(new FormData(form).get('telegramBotToken') || '').trim();
    if (!token) { if (status) status.textContent = 'Вставьте токен бота.'; return; }
    try { renderTelegramForm(root, navigateBack, await connectTelegramBot(token)); }
    catch (error) { if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось подключить бота'; }
  });
  root.querySelector('[data-telegram-disconnect]')?.addEventListener('click', async () => {
    const status = root.querySelector('[data-telegram-integration-status]');
    try { renderTelegramForm(root, navigateBack, await disconnectTelegramBot()); }
    catch (error) { if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось отключить бота'; }
  });
}

function openTelegram(root, navigateBack) {
  root.innerHTML = `${pageHeader('Telegram')}${emptyState('Загрузка', 'Проверяем подключение бота.')}`;
  void getTelegramBotConnection().then((state) => renderTelegramForm(root, navigateBack, state)).catch((error) => {
    root.innerHTML = `${pageHeader('Telegram')}${emptyState('Интеграция недоступна', error instanceof Error ? error.message : 'Не удалось загрузить Telegram')}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-telegram-back' }))}`;
    root.querySelector('[data-telegram-back]')?.addEventListener('click', navigateBack);
  });
}

function renderIntegrations(root, navigateBack) {
  root.innerHTML = `${pageHeader('Интеграции')}${folderList([{ title: 'Telegram', data: 'data-integration-open="telegram"' }])}${actionBlock(button('Назад', { variant: 'secondary', data: 'data-integrations-back' }))}`;
  root.querySelector('[data-integration-open="telegram"]')?.addEventListener('click', () => openTelegram(root, () => renderIntegrations(root, navigateBack)));
  root.querySelector('[data-integrations-back]')?.addEventListener('click', navigateBack);
}

export function render(root, navigateBack = () => {}) { renderIntegrations(root, navigateBack); }
