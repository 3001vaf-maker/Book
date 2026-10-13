import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const accountCore = readFileSync(new URL('../core/account/index.js', import.meta.url), 'utf8');
const header = readFileSync(new URL('../ui/v2/header.js', import.meta.url), 'utf8');
const profileCards = readFileSync(new URL('../core/profile/card-presentation.js', import.meta.url), 'utf8');
const chatRuntime = readFileSync(new URL('../core/chat/runtime.js', import.meta.url), 'utf8');
const chatUi = readFileSync(new URL('../ui/chat/index.js', import.meta.url), 'utf8');
const unreadController = readFileSync(new URL('../server/src/account-unread/account-unread.controller.ts', import.meta.url), 'utf8');
const unreadService = readFileSync(new URL('../server/src/account-unread/account-unread.service.ts', import.meta.url), 'utf8');
const accountGuard = readFileSync(new URL('../server/src/online-booking/account.guard.ts', import.meta.url), 'utf8');
const professionalGuard = readFileSync(new URL('../server/src/auth/jwt-auth.guard.ts', import.meta.url), 'utf8');
const dispatch = readFileSync(new URL('../server/src/communication/communication-dispatch.service.ts', import.meta.url), 'utf8');
const onlineBooking = readFileSync(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const webPush = readFileSync(new URL('../server/src/notification/web-push.service.ts', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');

test('global unread state is driven by real direct messages, not system notifications', () => {
  assert.match(unreadController, /online-booking\/account/);
  assert.match(unreadController, /unread-summary/);
  assert.match(unreadService, /CommunicationMessage/);
  assert.match(unreadService, /"purpose" = 'DIRECT'/);
  assert.match(unreadService, /"readAt" IS NULL/);
  assert.doesNotMatch(unreadService, /NotificationDelivery/);
  assert.match(unreadService, /AccountTenantLink/);
  assert.match(accountCore, /account\/unread-summary/);
  assert.match(accountCore, /__VA_TOOLS_ACCOUNT_UNREAD__/);
  assert.match(accountCore, /navigator\.setAppBadge/);
  assert.doesNotMatch(accountCore, /function getAccountNotifications[\s\S]{0,600}setTenantUnread/);
  assert.doesNotMatch(accountCore, /function markAccountNotificationRead[\s\S]{0,700}setTenantUnread/);
  assert.match(accountCore, /function getAccountChat[\s\S]{0,600}getGlobalAccountUnreadSummary/);
  assert.match(header, /defaultChatBadge/);
  assert.match(header, /kind === 'chat'/);
  assert.match(profileCards, /value:'unread'/);
  assert.match(profileCards, /Новых:/);
  assert.match(chatRuntime, /threadUnread/);
  assert.match(webPush, /badgeCount/);
  assert.match(serviceWorker, /setAppBadge/);
});

test('direct message status progresses sent to delivered to read and is visible in chat', () => {
  assert.match(dispatch, /status: 'sent'/);
  assert.match(onlineBooking, /direction: 'inbound'[\s\S]*status: 'sent'/);
  assert.match(accountGuard, /"status" = 'delivered'/);
  assert.match(accountGuard, /"status" = 'read'/);
  assert.match(accountGuard, /"readAt" = COALESCE/);
  assert.match(professionalGuard, /"status" = 'delivered'/);
  assert.match(professionalGuard, /"status" = 'read'/);
  assert.match(chatUi, /message-bubble__status--sent/);
  assert.match(chatUi, /message-bubble__status--delivered/);
  assert.match(chatUi, /message-bubble__status--read/);
  assert.match(chatUi, /aria-label="Отправлено"/);
  assert.match(chatUi, /aria-label="Доставлено"/);
  assert.match(chatUi, /aria-label="Прочитано"/);
});
