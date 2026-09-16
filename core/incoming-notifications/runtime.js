import { apiRequest } from '../auth.js';
import { getCommunicationThreads } from '../communications/chat.js';

const POLL_MS = 4000;
let running = false;
let latestThreads = [];

async function jsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

async function getUnreadSummary() {
  return jsonResponse(
    await apiRequest('/communications/incoming/unread'),
    'Не удалось загрузить входящие уведомления',
  );
}

async function markThreadRead(thread = {}) {
  const profileKey = String(thread.threadProfileKey || thread.profileKey || '').trim();
  const phone = String(thread.cardPhone || '').trim();
  const uei = String(thread.threadProfileUei || thread.uei || '').trim();
  if (!profileKey && !phone && !uei) return null;
  return jsonResponse(await apiRequest('/communications/incoming/thread/read', {
    method: 'POST',
    body: JSON.stringify({ profileKey, phone, uei }),
  }), 'Не удалось отметить диалог прочитанным');
}

function countLabel(value) {
  const count = Math.max(0, Number(value || 0));
  return count > 99 ? '99+' : String(count);
}

function renderNavigationBadge(unreadCount) {
  const nav = document.querySelector('[data-nav="chat"]');
  if (!nav) return;
  const count = Math.max(0, Number(unreadCount || 0));
  let badge = nav.querySelector('[data-incoming-nav-badge]');
  if (!count) {
    badge?.remove();
    nav.classList.remove('has-incoming-unread');
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'nav-unread-badge';
    badge.dataset.incomingNavBadge = '';
    nav.appendChild(badge);
  }
  badge.textContent = countLabel(count);
  badge.setAttribute('aria-label', `Непрочитанных: ${count}`);
  nav.classList.add('has-incoming-unread');
}

function renderThreadBadges(summary) {
  const unreadByProfile = new Map((Array.isArray(summary?.profiles) ? summary.profiles : []).map((item) => [
    String(item?.profileKey || '').trim(),
    Math.max(0, Number(item?.unreadCount || 0)),
  ]));

  document.querySelectorAll('[data-chat-thread]').forEach((button) => {
    const index = Number(button.dataset.chatThread);
    const thread = latestThreads[index] || {};
    const profileKey = String(thread.threadProfileKey || thread.profileKey || '').trim();
    const count = unreadByProfile.get(profileKey) || 0;
    let badge = button.querySelector('[data-incoming-thread-badge]');
    if (!count) {
      badge?.remove();
      button.classList.remove('has-incoming-unread');
      return;
    }
    const host = button.querySelector('.list-entry__right') || button.querySelector('.list-entry__content');
    if (!host) return;
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'thread-unread-badge';
      badge.dataset.incomingThreadBadge = '';
      host.appendChild(badge);
    }
    badge.textContent = countLabel(count);
    badge.setAttribute('aria-label', `Непрочитанных: ${count}`);
    button.classList.add('has-incoming-unread');
  });
}

async function refresh() {
  if (running || !document.querySelector('[data-nav="chat"]')) return;
  running = true;
  try {
    const summary = await getUnreadSummary();
    renderNavigationBadge(summary?.unreadCount || 0);
    if (document.querySelector('[data-chat-thread]')) {
      latestThreads = await getCommunicationThreads();
      renderThreadBadges(summary);
    }
  } catch {
    // Incoming notifications must never block the working Book UI.
  } finally {
    running = false;
  }
}

async function markOpenedThread(button) {
  const index = Number(button?.dataset?.chatThread);
  if (!Number.isInteger(index) || index < 0) return;
  try {
    if (!latestThreads[index]) latestThreads = await getCommunicationThreads();
    const thread = latestThreads[index];
    if (!thread) return;
    await markThreadRead(thread);
    await refresh();
  } catch {
    // Opening a chat must remain available even if read-state update fails.
  }
}

function scheduleRefresh() {
  window.setTimeout(() => void refresh(), 0);
  window.setTimeout(() => void refresh(), 350);
}

document.addEventListener('click', (event) => {
  const threadButton = event.target instanceof Element ? event.target.closest('[data-chat-thread]') : null;
  if (threadButton) void markOpenedThread(threadButton);
  const navButton = event.target instanceof Element ? event.target.closest('[data-nav="chat"]') : null;
  if (navButton) scheduleRefresh();
});

window.addEventListener('hashchange', scheduleRefresh);
window.addEventListener('focus', () => void refresh());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void refresh();
});

void refresh();
window.setInterval(() => void refresh(), POLL_MS);
