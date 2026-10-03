import { connectTelegramBot, disconnectTelegramBot, getTelegramBotConnection } from '../../core/integrations/telegram.js';
import {
  emptyState,
  field,
  miniCard,
  miniCardRail,
  mountV2ZLayer,
  page,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../ui/ui.js';

function telegramMiniCard(state = {}, { interactive = false } = {}) {
  const connected = Boolean(state?.connected);
  const bot = String(state?.botUsername || '').trim();
  return miniCard({
    title: 'Telegram',
    value: connected && bot ? bot : '',
    subtitle: connected ? 'Подключён' : 'Не подключён',
    interactive,
    data: interactive ? 'data-integration-open="telegram"' : '',
    aria: interactive ? 'Открыть Telegram' : '',
  });
}

function setPrimaryVisible(source, visible) {
  if (!source) return;
  source.dataset.v2PrimaryVisible = visible ? 'true' : 'false';
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function renderTelegramZ2(layer, baseRoot, state = {}) {
  const connected = Boolean(state?.connected);
  const c = connected
    ? {
        label: 'Отключить',
        data: 'data-telegram-primary data-v2-primary-variant="danger"',
        aria: 'Отключить Telegram',
      }
    : {
        label: 'Подключить',
        data: 'data-telegram-primary data-v2-primary-visible="false"',
        aria: 'Подключить Telegram',
      };

  layer.innerHTML = page([
    workspaceHeaderContext({ title: 'Telegram', c }),
    telegramMiniCard(state),
    `<form class="form-grid" data-telegram-integration-form>
      ${field({
        label: 'Токен бота',
        name: 'telegramBotToken',
        type: 'password',
        placeholder: connected ? 'Telegram подключён' : 'Вставьте токен из BotFather',
        disabled: connected,
        autocomplete: 'off',
      })}
      <div class="muted" data-telegram-integration-status aria-live="polite"></div>
    </form>`,
  ]);

  const form = layer.querySelector('[data-telegram-integration-form]');
  const input = form?.querySelector('[name="telegramBotToken"]');
  const primary = layer.querySelector('[data-telegram-primary]');
  const status = layer.querySelector('[data-telegram-integration-status]');

  if (!connected) {
    const sync = () => setPrimaryVisible(primary, Boolean(String(input?.value || '').trim()));
    input?.addEventListener('input', sync);
    input?.addEventListener('change', sync);
    sync();
  }

  primary?.addEventListener('click', async () => {
    primary.disabled = true;
    if (status) status.textContent = '';
    try {
      if (connected) {
        const next = await disconnectTelegramBot();
        renderIntegrations(baseRoot);
        renderTelegramZ2(layer, baseRoot, next);
        return;
      }
      const token = String(input?.value || '').trim();
      if (!token) {
        primary.disabled = false;
        setPrimaryVisible(primary, false);
        return;
      }
      const next = await connectTelegramBot(token);
      renderIntegrations(baseRoot);
      renderTelegramZ2(layer, baseRoot, next);
    } catch (error) {
      primary.disabled = false;
      if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось изменить подключение Telegram';
    }
  });

  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function openTelegram(root, state = null) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'integration-telegram-layer' }), { stack: true });
  if (!layer) return null;
  if (state) {
    renderTelegramZ2(layer, root, state);
    return layer;
  }
  layer.innerHTML = page([
    workspaceHeaderContext({ title: 'Telegram' }),
    emptyState('Загрузка', 'Проверяем подключение Telegram.'),
  ]);
  void getTelegramBotConnection()
    .then((next) => renderTelegramZ2(layer, root, next))
    .catch((error) => {
      layer.innerHTML = page([
        workspaceHeaderContext({ title: 'Telegram' }),
        emptyState('Интеграция недоступна', error instanceof Error ? error.message : 'Не удалось загрузить Telegram'),
      ]);
      window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
    });
  return layer;
}

function renderIntegrationCard(root, state = {}) {
  const host = root.querySelector('[data-integrations-list]');
  if (!host) return;
  host.innerHTML = miniCardRail([telegramMiniCard(state, { interactive: true })]);
  host.querySelector('[data-integration-open="telegram"]')?.addEventListener('click', () => openTelegram(root, state));
}

function renderIntegrations(root) {
  root.innerHTML = page([
    workspaceHeaderContext({ title: 'Интеграции' }),
    '<div data-integrations-list></div>',
  ]);
  const host = root.querySelector('[data-integrations-list]');
  if (host) host.innerHTML = emptyState('Загрузка', 'Проверяем интеграции.');
  void getTelegramBotConnection()
    .then((state) => renderIntegrationCard(root, state))
    .catch((error) => {
      if (host) host.innerHTML = emptyState('Интеграция недоступна', error instanceof Error ? error.message : 'Не удалось загрузить Telegram');
    });
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

export function render(root) {
  renderIntegrations(root);
}

export { renderIntegrations };
