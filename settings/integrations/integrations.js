import { getEmailChannelStatus } from '../../core/integrations/email.js';
import {
  connectTelegramBot,
  disconnectTelegramBot,
  getTelegramBotConnection,
} from '../../core/integrations/telegram.js';
import {
  button,
  emptyState,
  escapeHtml,
  field,
  infoUI,
  miniCard,
  miniCardRail,
  modal,
  mountModal,
  mountV2ZLayer,
  openDocumentViewer,
  page,
  v2ZLayer,
  workspaceHeaderContext,
} from '../../ui/ui.js';

const TELEGRAM_SETUP_GUIDE = `1. Откройте Telegram.

В поиске найдите официального бота @BotFather и откройте его.

2. Создайте нового бота.

Отправьте BotFather команду /newbot.

3. Укажите название.

BotFather попросит написать название бота. Введите любое понятное вам название. Это название будут видеть пользователи в Telegram.

4. Создайте username.

BotFather попросит придумать уникальное имя пользователя. Username обязательно должен заканчиваться на bot. Если выбранное имя занято, Telegram попросит выбрать другое.

5. Получите токен.

После создания BotFather пришлёт токен бота — длинную строку из цифр и символов.

6. Скопируйте токен.

Скопируйте его целиком. Не изменяйте токен и не передавайте его другим людям: он даёт доступ к управлению ботом.

7. Вернитесь в приложение.

Откройте Интеграции → Telegram, вставьте токен в поле «Токен Telegram-бота» и нажмите «Подключить».

8. Готово.

После подключения приложение самостоятельно выполнит необходимые технические настройки Telegram. Дополнительно настраивать технические параметры не требуется.`;

function telegramSubtitle(state = {}) {
  if (state?.error) return 'Связь недоступна';
  if (!state?.connected) return 'Не подключён';
  if (state?.webhookActive && state?.configuration?.accountAppUrlConfigured) return 'Подключён';
  return 'Связь недоступна';
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

function telegramInfoDocument(state = {}) {
  if (state?.error) {
    return {
      title: 'Связь недоступна',
      content: 'Сейчас приложение не может проверить состояние подключения. Повторно вводить токен не нужно.\n\nПопробуйте открыть интеграцию позже.',
    };
  }

  if (!state?.connected) {
    return {
      title: 'Как подключить Telegram',
      content: TELEGRAM_SETUP_GUIDE,
    };
  }

  const bot = String(state?.botUsername || '').trim();
  const works = Boolean(state?.webhookActive && state?.configuration?.accountAppUrlConfigured);
  if (works) {
    return {
      title: 'Подключено',
      content: `${bot ? `Бот ${bot} подключён.` : 'Бот подключён.'}\n\nПриложение выполняет необходимые технические настройки автоматически. Дополнительных действий не требуется.\n\nЧтобы подключить другого бота, сначала отключите текущего.`,
    };
  }

  return {
    title: 'Связь недоступна',
    content: `${bot ? `Бот ${bot} подключён, но сейчас не удаётся подтвердить связь.` : 'Бот подключён, но сейчас не удаётся подтвердить связь.'}\n\nПовторно вводить токен не нужно.\n\nЕсли связь долго не восстановится, отключите бота и подключите его заново.`,
  };
}

function telegramActionError(error, connected) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/токен/i.test(message) && !/шифрован/i.test(message)) return message;
  return connected
    ? 'Не удалось отключить Telegram. Повторите действие.'
    : 'Не удалось подключить Telegram. Проверьте токен и повторите действие.';
}

function telegramXContent(state = {}) {
  const connected = Boolean(state?.connected);
  const bot = String(state?.botUsername || '').trim();
  const unavailable = Boolean(state?.error);
  const help = infoUI('', {
    actionOnly: true,
    aria: connected ? 'Информация о подключении Telegram' : 'Как подключить Telegram',
    data: 'data-telegram-help',
  });

  if (unavailable) {
    return `<div class="modal-title modal-title--action"><h2>Telegram</h2>${help}</div>
      ${emptyState('Связь недоступна', 'Не удалось проверить состояние подключения.')}`;
  }

  return `<div class="modal-title modal-title--action"><h2>Telegram</h2>${help}</div>
    <form class="form-grid" data-telegram-integration-form>
      ${connected
        ? field({
            label: 'Telegram-бот',
            name: 'telegramBot',
            value: bot || 'Бот подключён',
            disabled: true,
          })
        : field({
            label: 'Токен Telegram-бота',
            name: 'telegramBotToken',
            type: 'password',
            placeholder: 'Вставьте токен из BotFather',
            autocomplete: 'off',
          })}
      ${button(connected ? 'Отключить' : 'Подключить', {
        type: 'submit',
        data: 'data-telegram-action',
        variant: connected ? 'danger' : '',
        disabled: !connected,
      })}
      <div class="muted" data-telegram-integration-status aria-live="polite"></div>
    </form>`;
}

function bindTelegramX(layer, baseRoot, state = {}) {
  const connected = Boolean(state?.connected);
  const help = layer.querySelector('[data-telegram-help] [data-info-trigger]');
  help?.addEventListener('click', () => {
    const info = telegramInfoDocument(state);
    openDocumentViewer({ title: info.title, content: info.content });
  });

  if (state?.error) return;

  const form = layer.querySelector('[data-telegram-integration-form]');
  const input = form?.querySelector('[name="telegramBotToken"]');
  const action = form?.querySelector('[data-telegram-action]');
  const status = form?.querySelector('[data-telegram-integration-status]');

  if (!connected && input && action) {
    const sync = () => { action.disabled = !String(input.value || '').trim(); };
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    sync();
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!action) return;
    action.disabled = true;
    if (status) status.textContent = '';
    try {
      const next = connected
        ? await disconnectTelegramBot()
        : await connectTelegramBot(String(input?.value || '').trim());
      await renderIntegrations(baseRoot);
      layer.v2Close?.();
      openTelegram(baseRoot, next);
    } catch (error) {
      action.disabled = false;
      if (status) status.textContent = telegramActionError(error, connected);
    }
  });
}

function openTelegram(root, state = null) {
  const resolved = state || { error: 'Загрузка' };
  const layer = mountModal(document.body, modal(telegramXContent(resolved), {
    variant: 'x',
    title: 'Telegram',
    className: 'modal--form-sheet',
    xRole: 'editor',
  }));
  if (!layer) return null;
  bindTelegramX(layer, root, resolved);

  if (state) return layer;

  void getTelegramBotConnection()
    .then((next) => {
      layer.v2Close?.();
      openTelegram(root, next);
    })
    .catch(() => {});
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
