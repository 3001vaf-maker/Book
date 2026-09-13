import {
  getBookingAccountToken,
  getBookingNotifications,
  markBookingNotificationRead,
} from '../core/booking-account/index.js';
import { getWebPushState, syncWebPush } from '../core/notifications/web-push.js';
import { escapeHtml, modal, mountModal } from '../ui/ui.js';

const STYLE_ID = 'book-client-notifications-style';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .booking-notifications-button{position:fixed;z-index:40;top:max(16px,env(safe-area-inset-top));right:16px;width:44px;height:44px;border:1px solid currentColor;border-radius:999px;background:var(--surface,#fff);color:var(--text,#111);display:none;align-items:center;justify-content:center;padding:0;box-shadow:0 8px 24px rgba(0,0,0,.08);cursor:pointer}
    .booking-notifications-button.is-visible{display:flex}
    .booking-notifications-button svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .booking-notifications-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#d93025;color:#fff;font:600 11px/18px system-ui;text-align:center;border:2px solid var(--surface,#fff)}
    .booking-notifications-feed{display:grid;gap:8px}
    .booking-notifications-item{width:100%;border:1px solid rgba(127,127,127,.28);border-radius:14px;background:transparent;color:inherit;padding:12px 14px;text-align:left;display:grid;gap:4px;cursor:pointer}
    .booking-notifications-item.is-unread{border-color:currentColor}
    .booking-notifications-item__top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .booking-notifications-item__title{font-weight:650}
    .booking-notifications-item__date{font-size:12px;opacity:.58;white-space:nowrap}
    .booking-notifications-item__body{font-size:14px;opacity:.72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .booking-notifications-empty{padding:20px 4px;text-align:center;opacity:.62}
    .booking-notifications-push{border:1px solid rgba(127,127,127,.28);border-radius:14px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}
    .booking-notifications-push p{margin:0;font-size:13px;opacity:.72}
    .booking-notifications-push button{border:1px solid currentColor;border-radius:999px;background:transparent;color:inherit;padding:8px 12px;font:inherit;cursor:pointer;white-space:nowrap}
    .booking-notification-detail{display:grid;gap:14px}
    .booking-notification-detail h2{margin:0;font-size:20px}
    .booking-notification-detail p{margin:0;line-height:1.45;white-space:pre-wrap}
    .booking-notification-detail time{font-size:13px;opacity:.6}
  `;
  document.head.appendChild(style);
}

function dateText(value) {
  const date = new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function iconMarkup() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4.5 3v-3H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"/></svg>';
}

function notificationDetail(item) {
  const content = `<div class="booking-notification-detail"><h2>${escapeHtml(item?.title || 'Уведомление')}</h2>${item?.body ? `<p>${escapeHtml(item.body)}</p>` : ''}<time>${escapeHtml(dateText(item?.createdAt))}</time></div>`;
  mountModal(document.body, modal(content, { variant: 'medium', surface: 'app' }));
}

function pushBlock(state) {
  if (!state?.supported || !state?.enabled) return '';
  if (state.permission === 'granted' && state.subscribed) {
    return '<div class="booking-notifications-push"><p>Системные Push-уведомления включены.</p></div>';
  }
  if (state.permission === 'denied') {
    return '<div class="booking-notifications-push"><p>Push запрещены в настройках браузера.</p></div>';
  }
  return '<div class="booking-notifications-push"><p>Получать уведомления, даже когда Book закрыт.</p><button type="button" data-enable-booking-push>Включить Push</button></div>';
}

export function mountBookingNotifications(tenantId) {
  ensureStyles();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'booking-notifications-button';
  button.setAttribute('aria-label', 'Уведомления');
  button.innerHTML = `${iconMarkup()}<span class="booking-notifications-badge" data-notification-badge hidden></span>`;
  document.body.appendChild(button);

  const badge = button.querySelector('[data-notification-badge]');
  let feed = { unreadCount: 0, items: [] };
  let disposed = false;
  let loading = false;

  function paintBadge() {
    const count = Math.max(0, Number(feed?.unreadCount || 0));
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? '99+' : String(count || '');
  }

  async function refresh() {
    if (disposed || loading) return;
    const authenticated = Boolean(getBookingAccountToken(tenantId));
    button.classList.toggle('is-visible', authenticated);
    if (!authenticated) return;
    loading = true;
    try {
      feed = await getBookingNotifications(tenantId);
      paintBadge();
      await syncWebPush(tenantId).catch(() => null);
    } catch {
      // The account screen owns authentication errors; the notification control stays passive.
    } finally {
      loading = false;
    }
  }

  async function openFeed() {
    await refresh();
    let pushState = await getWebPushState(tenantId).catch(() => null);
    const items = Array.isArray(feed?.items) ? feed.items : [];
    const rows = items.map((item) => `
      <button type="button" class="booking-notifications-item${item.read ? '' : ' is-unread'}" data-notification-id="${escapeHtml(item.id)}">
        <span class="booking-notifications-item__top"><span class="booking-notifications-item__title">${escapeHtml(item.title || 'Уведомление')}</span><span class="booking-notifications-item__date">${escapeHtml(dateText(item.createdAt))}</span></span>
        ${item.body ? `<span class="booking-notifications-item__body">${escapeHtml(item.body)}</span>` : ''}
      </button>`).join('');
    const content = `<div>${pushBlock(pushState)}<div class="booking-notifications-feed">${rows || '<div class="booking-notifications-empty">Уведомлений пока нет</div>'}</div></div>`;
    const layer = mountModal(document.body, modal(content, { title: 'Уведомления', variant: 'medium', surface: 'app' }));
    if (!layer) return;

    layer.querySelector('[data-enable-booking-push]')?.addEventListener('click', async (event) => {
      const control = event.currentTarget;
      control.disabled = true;
      try {
        pushState = await syncWebPush(tenantId, { requestPermission: true });
        const block = control.closest('.booking-notifications-push');
        if (block) block.outerHTML = pushBlock(pushState);
      } catch {
        control.disabled = false;
      }
    });

    layer.querySelectorAll('[data-notification-id]').forEach((node) => node.addEventListener('click', async () => {
      const id = String(node.dataset.notificationId || '');
      const current = items.find((item) => String(item.id) === id);
      if (!current) return;
      if (!current.read) {
        try {
          const updated = await markBookingNotificationRead(tenantId, id);
          Object.assign(current, updated, { read: true });
          feed.unreadCount = Math.max(0, Number(feed.unreadCount || 0) - 1);
          paintBadge();
        } catch {
          return;
        }
      }
      layer.remove();
      notificationDetail(current);
    }));
  }

  button.addEventListener('click', () => void openFeed());
  const interval = window.setInterval(() => void refresh(), 5000);
  void refresh();

  return () => {
    disposed = true;
    window.clearInterval(interval);
    button.remove();
  };
}
