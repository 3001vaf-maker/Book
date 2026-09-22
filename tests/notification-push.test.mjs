import assert from 'node:assert/strict';
import fs from 'node:fs';

const core = fs.readFileSync('core.js', 'utf8');
const booking = fs.readFileSync('online-booking/booking.js', 'utf8');
const accountShell = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const notifications = fs.readFileSync('online-booking/notifications.js', 'utf8');
const accountRuntime = fs.readFileSync('online-booking/account-runtime.js', 'utf8');
const browserPush = fs.readFileSync('core/notifications/web-push.js', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');
const notificationService = fs.readFileSync('server/src/notification/notification.service.ts', 'utf8');
const pushService = fs.readFileSync('server/src/notification/web-push.service.ts', 'utf8');
const migration = fs.readFileSync('server/prisma/migrations/20260913070000_web_push_subscription/migration.sql', 'utf8');
const platformNoticeService = fs.readFileSync('server/src/platform-notice/platform-notice.service.ts', 'utf8');
const platformNoticeController = fs.readFileSync('server/src/platform-notice/platform-notice.controller.ts', 'utf8');
const platformPushMigration = fs.readFileSync('server/prisma/migrations/20260922173000_platform_push_subscription/migration.sql', 'utf8');
const adminUi = fs.readFileSync('admin/admin.js', 'utf8');

assert.match(core, /params\.get\('tg_entry'\)/);
assert.doesNotMatch(core, /params\.get\('tg'\)|params\.get\('telegram'\)/);
assert.doesNotMatch(booking, /telegramId/);
assert.match(accountRuntime, /bindAccountTelegramEntry/);
assert.doesNotMatch(accountRuntime, /mountBookingNotifications/);

assert.match(accountShell, /getAccountNotifications/);
assert.match(accountShell, /markAccountNotificationRead/);
assert.match(accountShell, /notificationMessages/);
assert.match(accountShell, /label: 'Push'/);
assert.match(accountShell, /enableWebPush/);
assert.match(accountShell, /disableWebPush/);
assert.doesNotMatch(notifications, /<style>|createElement\('style'\)|booking-notifications-button/);

assert.match(browserPush, /serviceWorker\.register\('\/service-worker\.js'/);
assert.match(browserPush, /PushManager/);
assert.match(browserPush, /enableWebPush/);
assert.match(browserPush, /disableWebPush/);
assert.match(serviceWorker, /addEventListener\('push'/);
assert.match(serviceWorker, /addEventListener\('notificationclick'/);

assert.match(notificationService, /channelsWithPush/);
assert.match(notificationService, /listAccountEndpoints/);
assert.match(notificationService, /dispatchNotification/);
assert.match(pushService, /webpush\.sendNotification/);
assert.match(pushService, /WEB_PUSH_VAPID_PUBLIC_KEY/);
assert.match(migration, /CREATE TABLE "WebPushSubscription"/);
assert.match(migration, /UNIQUE INDEX "WebPushSubscription_endpoint_key"/);

assert.match(platformPushMigration, /PlatformPushSubscription/);
assert.match(platformPushMigration, /PlatformAccount/);
assert.match(platformNoticeService, /createForPlatformAdmins/);
assert.match(platformNoticeService, /webpush\.sendNotification/);
assert.match(platformNoticeController, /push\/configuration/);
assert.match(platformNoticeController, /push\/subscription/);
assert.match(adminUi, /navigator\.serviceWorker\.register\('\/service-worker\.js'/);
assert.match(adminUi, /Notification\.requestPermission/);
assert.match(adminUi, /data-live-request-count/);

console.log('account and platform notification Web Push tests passed');
