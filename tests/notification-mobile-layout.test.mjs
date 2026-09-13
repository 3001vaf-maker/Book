import assert from 'node:assert/strict';
import fs from 'node:fs';

const notifications = fs.readFileSync('online-booking/notifications.js', 'utf8');

assert.match(notifications, /import \{[^}]*button[^}]*\} from '\.\.\/ui\/ui\.js'/s);
assert.match(notifications, /booking-notifications-push\{[^}]*display:grid/s);
assert.match(notifications, /booking-notifications-push\{[^}]*min-width:0/s);
assert.doesNotMatch(notifications, /booking-notifications-push button\{[^}]*white-space:nowrap/s);
assert.match(notifications, /button\('Включить Push',[\s\S]*data-enable-booking-push/);

console.log('mobile notification layout regression test passed');
