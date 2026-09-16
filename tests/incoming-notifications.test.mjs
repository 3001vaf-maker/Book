import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ownerService = await readFile(new URL('../server/src/communication/owner-incoming-notification.service.ts', import.meta.url), 'utf8');
const ownerController = await readFile(new URL('../server/src/communication/owner-incoming-notification.controller.ts', import.meta.url), 'utf8');
const communicationModule = await readFile(new URL('../server/src/communication/communication.module.ts', import.meta.url), 'utf8');
const bookingController = await readFile(new URL('../server/src/online-booking/online-booking.controller.ts', import.meta.url), 'utf8');
const clientChatController = await readFile(new URL('../server/src/online-booking/booking-chat.controller.ts', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../core/incoming-notifications/runtime.js', import.meta.url), 'utf8');
const bootstrap = await readFile(new URL('../core/bootstrap.js', import.meta.url), 'utf8');
const navigationCss = await readFile(new URL('../ui/navigation/navigation.css', import.meta.url), 'utf8');

assert.match(ownerService, /"direction" IN \('inbound', 'system'\)/);
assert.match(ownerService, /"readAt" IS NULL/);
assert.match(ownerService, /canonicalizeProfileKeys/);
assert.match(ownerService, /async markThreadRead/);
assert.match(ownerService, /SET "readAt" = CURRENT_TIMESTAMP/);
assert.match(ownerController, /@Get\('unread'\)/);
assert.match(ownerController, /@Post\('thread\/read'\)/);
assert.match(communicationModule, /OwnerIncomingNotificationController/);
assert.match(communicationModule, /OwnerIncomingNotificationService/);

assert.match(bookingController, /owner\.booking\.created/);
assert.match(bookingController, /direction: 'system'/);
assert.match(bookingController, /kind: 'system'/);
assert.match(bookingController, /channel: 'OWNER_IN_APP'/);
assert.match(bookingController, /bookingAccountId: accountId/);
assert.match(bookingController, /booking-request:/);
assert.match(bookingController, /\.catch\(\(\) => null\)/);
assert.match(clientChatController, /OWNER_IN_APP/);
assert.match(clientChatController, /\.filter\(/);

assert.match(runtime, /communications\/incoming\/unread/);
assert.match(runtime, /communications\/incoming\/thread\/read/);
assert.match(runtime, /data-chat-thread/);
assert.match(runtime, /dataset\.incomingProfileKey/);
assert.match(runtime, /nav-unread-badge/);
assert.match(runtime, /thread-unread-badge/);
assert.match(runtime, /if \(threadButton\) void markOpenedThread\(threadButton\)/);
assert.match(bootstrap, /incoming-notifications\/runtime\.js/);
assert.match(navigationCss, /\.nav-unread-badge/);
assert.match(navigationCss, /\.thread-unread-badge/);

console.log('minimal incoming notifications regression: ok');
