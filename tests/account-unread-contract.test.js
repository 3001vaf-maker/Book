import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const accountCore = readFileSync(new URL('../core/account/index.js', import.meta.url), 'utf8');
const header = readFileSync(new URL('../ui/v2/header.js', import.meta.url), 'utf8');
const profileCards = readFileSync(new URL('../core/profile/card-presentation.js', import.meta.url), 'utf8');
const chatRuntime = readFileSync(new URL('../core/chat/runtime.js', import.meta.url), 'utf8');
const unreadController = readFileSync(new URL('../server/src/account-unread/account-unread.controller.ts', import.meta.url), 'utf8');
const unreadService = readFileSync(new URL('../server/src/account-unread/account-unread.service.ts', import.meta.url), 'utf8');
const webPush = readFileSync(new URL('../server/src/notification/web-push.service.ts', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');

test('global unread state drives cover, home and per-contact surfaces', () => {
  assert.match(unreadController, /online-booking\/account/);
  assert.match(unreadController, /unread-summary/);
  assert.match(unreadService, /NotificationDelivery/);
  assert.match(unreadService, /AccountTenantLink/);
  assert.match(accountCore, /account\/unread-summary/);
  assert.match(accountCore, /__VA_TOOLS_ACCOUNT_UNREAD__/);
  assert.match(accountCore, /navigator\.setAppBadge/);
  assert.match(header, /defaultChatBadge/);
  assert.match(header, /kind === 'chat'/);
  assert.match(profileCards, /value:'unread'/);
  assert.match(profileCards, /Новых:/);
  assert.match(chatRuntime, /threadUnread/);
  assert.match(webPush, /badgeCount/);
  assert.match(serviceWorker, /setAppBadge/);
});
