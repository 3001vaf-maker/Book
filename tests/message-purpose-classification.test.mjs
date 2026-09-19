import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const purpose = read('server/src/communication/message-purpose.ts');
const migration = read('server/prisma/migrations/20260919010000_message_purpose/migration.sql');
const communication = read('server/src/communication/communication.service.ts');
const dispatch = read('server/src/communication/communication-dispatch.service.ts');
const controller = read('server/src/communication/communication.controller.ts');
const broadcast = read('server/src/communication/communication-broadcast.service.ts');
const telegram = read('server/src/communication/telegram-bot.service.ts');
const notification = read('server/src/notification/notification.service.ts');
const booking = read('server/src/online-booking/online-booking.controller.ts');

assert.match(purpose, /\['SYSTEM', 'SERVICE', 'DIRECT', 'MARKETING'\]/);
assert.match(purpose, /export type MessagePurpose/);

assert.match(migration, /ALTER TABLE "Notification"[\s\S]*ADD COLUMN IF NOT EXISTS "purpose" TEXT/);
assert.match(migration, /ALTER TABLE "CommunicationMessage"[\s\S]*ADD COLUMN IF NOT EXISTS "purpose" TEXT/);
assert.match(migration, /'SYSTEM', 'SERVICE', 'DIRECT', 'MARKETING'/);
assert.doesNotMatch(migration, /SET "purpose" = 'MARKETING'\s+WHERE "purpose" IS NULL;/);

assert.match(communication, /normalizeMessagePurpose\(input\?\.purpose\)/);
assert.match(communication, /Не указан purpose сообщения/);
assert.match(communication, /"kind", "purpose", "channel"/);

assert.match(dispatch, /purpose: MessagePurpose/);
assert.match(controller, /purpose: 'DIRECT'/);
assert.match(broadcast, /purpose: 'MARKETING'/);
assert.match(booking, /purpose: 'DIRECT'/);
assert.match(booking, /purpose: 'SERVICE'[\s\S]*type: 'booking\.created'/);

assert.match(telegram, /const purpose: MessagePurpose = 'SYSTEM'/);
assert.match(telegram, /purpose: 'DIRECT'/);
assert.match(telegram, /purpose, channel: 'TELEGRAM'/);

assert.match(notification, /purpose: MessagePurpose/);
assert.match(notification, /normalizeMessagePurpose\(input\.purpose\)/);
assert.match(notification, /"type", "purpose", "title"/);

// This step only classifies messages. Old consent routing stays in place until the next dedicated step.
assert.match(notification, /canSendMessages\(tenantId, channel, recipient\)/);
assert.match(telegram, /consentPolicy\.canSendMessages/);
assert.match(broadcast, /documents\.canSendMessages/);

console.log('Message purpose classification tests: OK');
