import { getEmailChannelStatus } from '../../core/integrations/email.js';
import {
  connectTelegramBot,
  disconnectTelegramBot,
  getTelegramBotConnection,
  repairTelegramBotConnection,
} from '../../core/integrations/telegram.js';
import {
  button,
  emptyState,
  escapeHtml,
  field,
  miniCard,
  miniCardRail,
  mountV2ZLayer,
  page,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../ui/ui.js';

function telegramSubtitle(state = {}) {
  if (state?.error) return 'Недоступен';
  if (!state?.connected) return 'Не подключён';
  if (state?.webhookActive && state?.configuration?.accountAppUrlConfigured) return 'Работает';
  return 'Требует внимания';
}

function telegramMiniCard(state = {}, { interactive = false } = {}) {
  const connected = Boolean(state?.connected);
  const bot = String(state?.botUsername || '').trim();
  return miniCard({
    title: 'Telegram',
    value: connected && bot ? bot : '',
    subtitle: telegramSubtitle(state),
    interactive,
    data: interactive ? 'data-integration-open="telegram"' : '',
    aria: interactive ? 'Открыть Telegram' : '',
  });
}

function emailSubtitle(state = {}) {
  if (state?.error) return 'Недоступен';
  if (state?.status === 'ready') return 'Работает';
  if (state?.status === 'not_configured') return 'Не настроен';
  return state?.status === 'error' ? 'Ошибка' : 'Проверяем';
}

function emailMiniCard(state = {}, { interactive = false } = {}) {
  return miniCard({
    title: 'Email',
    value: String(state?.fromEmail || '').trim(),
    subtitle: emailSubtitle(state),
    interactive,
    data: interactive ? 'data-integration-open="email"' : '',
    aria: interactive ? 'Открыть Email' : '',
  });
}

function setPrimaryVisible(source, visible) {
  if (!source) return;
  source.dataset.v2PrimaryVisible = visible ? 'true' : 'false';
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function telegramDiagnostics(state = {}) {
  const configuration = state?.configuration || {};
  const lines = [
    `Ключ шифрования: ${configuration.credentialsKeyConfigured ? 'настроен' : 'не настроен'}`,
    `API для webhook: ${configuration.publicApiUrlConfigured ? 'настроен' : 'не настроен'}`,
    `Ссылка в приложение: ${configuration.accountAppUrlConfigured ? 'настроена' : 'не настроена'}`,
  ];
  if (state?.connected) {
    lines.push(`Webhook: ${state?.webhookActive ? 'активен' : 'не работает'}`);
    lines.push(`Очередь Telegram: ${Math.max(0, Number(state?.webhookPendingUpdateCount || 0))}`);
  }
  if (state?.webhookError) lines.push(`Причина: ${String(state.webhookError)}`);
  return lines.map((line) => `<div class="muted">${escapeHtml(line)}</div>`).join('');
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
  const needsRepair = connected && !state?.webhookActive;

  layer.innerHTML = page([
    workspaceHeaderContext({ title: 'Telegram', c }),
    telegramMiniCard(state),
    `<form class="form-grid" data-telegram-integration-form>
      ${telegramDiagnostics(state)}
      ${needsRepair ? button('Восстановить webhook', { type: 'button', data: 'data-telegram-repair' }) : ''}
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

  layer.querySelector('[data-telegram-repair]')?.addEventListener('click', async (event) => {
    const source = event.currentTarget;
    source.disabled = true;
    if (status) status.textContent = 'Восстанавливаем webhook…';
    try {
      const next = await repairTelegramBotConnection();
      await renderIntegrations(baseRoot);
      renderTelegramZ2(layer, baseRoot, next);
    } catch (error) {
      source.disabled = false;
      if (status) status.textContent = error instanceof Error ? error.message : 'Не удалось восстановить Telegram webhook';
    }
  });

  primary?.addEventListener('click', async () => {
    primary.disabled = true;
    if (status) status.textContent = '';
    try {
      if (connected) {
        const next = await disconnectTelegramBot();
        await renderIntegrations(baseRoot);
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
      await renderIntegrations(baseRoot);
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
  if (state && !state.error) {
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

function renderEmailZ2(layer, state = {}) {
  if (state?.error) {
    layer.innerHTML = page([
      workspaceHeaderContext({ title: 'Email' }),
      emptyState('Интеграция недоступна', String(state.error)),
    ]);
    return;
  }
  const provider = state?.provider === 'yandex-postbox' ? 'Yandex Cloud Postbox' : String(state?.provider || 'Не определён');
  const reason = String(state?.reason || '').trim();
  layer.innerHTML = page([
    workspaceHeaderContext({ title: 'Email' }),
    emailMiniCard(state),
    `<div class="form-grid">
      <div class="muted">${escapeHtml(`Провайдер: ${provider}`)}</div>
      <div class="muted">${escapeHtml(`Отправитель: ${state?.fromEmail || 'не настроен'}`)}</div>
      <div class="muted">${escapeHtml(`SMTP: ${state?.transportReachable ? 'доступен' : 'недоступен'}`)}</div>
      ${reason ? `<div class="muted">${escapeHtml(`Причина: ${reason}`)}</div>` : ''}
    </div>`,
  ]);
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

function openEmail(root, state = null) {
  const layer = mountV2ZLayer(root, v2ZLayer('', { className: 'integration-email-layer' }), { stack: true });
  if (!layer) return null;
  if (state) {
    renderEmailZ2(layer, state);
    return layer;
  }
  layer.innerHTML = page([
    workspaceHeaderContext({ title: 'Email' }),
    emptyState('Загрузка', 'Проверяем Email.'),
  ]);
  void getEmailChannelStatus()
    .then((next) => renderEmailZ2(layer, next))
    .catch((error) => renderEmailZ2(layer, { error: error instanceof Error ? error.message : 'Не удалось проверить Email' }));
  return layer;
}

function renderIntegrationCards(root, telegramState = {}, emailState = {}) {
  const host = root.querySelector('[data-integrations-list]');
  if (!host) return;
  host.innerHTML = miniCardRail([
    telegramMiniCard(telegramState, { interactive: true }),
    emailMiniCard(emailState, { interactive: true }),
  ]);
  host.querySelector('[data-integration-open="telegram"]')?.addEventListener('click', () => openTelegram(root, telegramState));
  host.querySelector('[data-integration-open="email"]')?.addEventListener('click', () => openEmail(root, emailState));
}

async function renderIntegrations(root) {
  root.innerHTML = page([
    workspaceHeaderContext({ title: 'Интеграции' }),
    '<div data-integrations-list></div>',
  ]);
  const host = root.querySelector('[data-integrations-list]');
  if (host) host.innerHTML = emptyState('Загрузка', 'Проверяем интеграции.');
  const [telegramResult, emailResult] = await Promise.allSettled([
    getTelegramBotConnection(),
    getEmailChannelStatus(),
  ]);
  const telegramState = telegramResult.status === 'fulfilled'
    ? telegramResult.value
    : { error: telegramResult.reason instanceof Error ? telegramResult.reason.message : 'Не удалось загрузить Telegram' };
  const emailState = emailResult.status === 'fulfilled'
    ? emailResult.value
    : { error: emailResult.reason instanceof Error ? emailResult.reason.message : 'Не удалось проверить Email' };
  renderIntegrationCards(root, telegramState, emailState);
  window.dispatchEvent(new CustomEvent('book:v2-context-changed'));
}

export function render(root) {
  void renderIntegrations(root);
}

export { renderIntegrations };
