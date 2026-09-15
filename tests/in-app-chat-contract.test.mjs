import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../server/prisma/migrations/20260915163000_in_app_message_model/migration.sql', import.meta.url), 'utf8');
const service = await readFile(new URL('../server/src/communication/communication.service.ts', import.meta.url), 'utf8');
const resolver = await readFile(new URL('../server/src/communication/communication-channel-resolver.service.ts', import.meta.url), 'utf8');
const dispatch = await readFile(new URL('../server/src/communication/communication-dispatch.service.ts', import.meta.url), 'utf8');
const ownerController = await readFile(new URL('../server/src/communication/communication.controller.ts', import.meta.url), 'utf8');
const clientController = await readFile(new URL('../server/src/online-booking/booking-chat.controller.ts', import.meta.url), 'utf8');
const richUi = await readFile(new URL('../ui/shell/rich-text.js', import.meta.url), 'utf8');
const shellUi = await readFile(new URL('../ui/shell/index.js', import.meta.url), 'utf8');

assert.match(migration, /CommunicationMessage[\s\S]*bookingAccountId/);
assert.match(migration, /ADD COLUMN "content" JSONB/);
assert.match(migration, /ADD COLUMN "editedAt"/);
assert.match(migration, /ADD COLUMN "deletedAt"/);
assert.match(migration, /FOREIGN KEY \("bookingAccountId"\) REFERENCES "BookingAccount"\("id"\)/);

assert.match(resolver, /async resolveInAppAccount/);
assert.match(dispatch, /resolveInAppAccount/);
assert.match(dispatch, /return 'IN_APP'/);
assert.match(dispatch, /bookingAccountId: account\.id/);
assert.match(dispatch, /type: 'chat\.message'/);

assert.match(service, /const RICH_BLOCK_TYPES = new Set\(\['paragraph', 'heading', 'subheading', 'quote', 'list-item'\]\)/);
assert.match(service, /const RICH_MARKS = new Set\(\['bold', 'italic', 'underline', 'strike', 'code'\]\)/);
assert.match(service, /async editMessage/);
assert.match(service, /"editedAt" = CURRENT_TIMESTAMP/);
assert.match(service, /async deleteMessage/);
assert.match(service, /"deletedAt" = CURRENT_TIMESTAMP/);
assert.match(service, /"attachments" = '\[\]'::jsonb/);

assert.match(ownerController, /@Patch\('chat\/messages\/:messageId'\)/);
assert.match(ownerController, /@Delete\('chat\/messages\/:messageId'\)/);
assert.match(clientController, /@Controller\('online-booking\/:tenantId\/account\/internal-chat'\)/);
assert.match(clientController, /bookingAccountId: accountId/);
assert.match(clientController, /side: 'client', accountId/);

assert.match(richUi, /data-rich-mark="bold"/);
assert.match(richUi, /data-rich-mark="italic"/);
assert.match(richUi, /data-rich-mark="underline"/);
assert.match(richUi, /data-rich-block="heading"/);
assert.match(richUi, /data-rich-block="subheading"/);
assert.match(richUi, /data-rich-emoji-toggle/);
assert.match(shellUi, /Сообщение удалено/);
assert.match(shellUi, /message\.editedAt/);
assert.match(shellUi, /data-message-actions/);

console.log('internal chat contract regression: ok');
