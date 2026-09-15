import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const master = await readFile(new URL('../chat/chat.js', import.meta.url), 'utf8');
const client = await readFile(new URL('../online-booking/account-shell.js', import.meta.url), 'utf8');
const bookingApi = await readFile(new URL('../core/booking-account/index.js', import.meta.url), 'utf8');
const ownerApi = await readFile(new URL('../core/communications/chat.js', import.meta.url), 'utf8');

for (const source of [master, client]) {
  assert.match(source, /bindRichTextEditor/);
  assert.match(source, /messageThread\(messages, \{ viewer: '[^']+', actions: true \}\)/);
  assert.match(source, /data-message-delete/);
  assert.match(source, /data-message-edit/);
}

assert.match(master, /sendCommunicationMessage\(\{ profileKey, phone, uei, body: value\.body, content: value\.content, attachments \}\)/);
assert.match(master, /threadProfileKey/);
assert.match(client, /sendBookingChatMessage\(state\.tenantId, \{ body: value\.body, content: value\.content, attachments \}\)/);
assert.match(client, /filter\(\(item\) => String\(item\?\.type \|\| ''\) !== 'chat\.message'\)/);
assert.match(bookingApi, /account\/internal-chat\/messages/);
assert.match(ownerApi, /profileKey/);
assert.match(ownerApi, /method: 'PATCH'/);
assert.match(ownerApi, /method: 'DELETE'/);

console.log('internal chat UI contract regression: ok');
