import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../server/prisma/migrations/20260915163000_in_app_message_model/migration.sql', import.meta.url), 'utf8');
const service = await readFile(new URL('../server/src/communication/communication.service.ts', import.meta.url), 'utf8');
const profiles = await readFile(new URL('../server/src/communication/client-profile-thread.service.ts', import.meta.url), 'utf8');
const dispatch = await readFile(new URL('../server/src/communication/communication-dispatch.service.ts', import.meta.url), 'utf8');
const profilePush = await readFile(new URL('../server/src/communication/in-app-profile-push.service.ts', import.meta.url), 'utf8');
const ownerController = await readFile(new URL('../server/src/communication/communication.controller.ts', import.meta.url), 'utf8');
const clientController = await readFile(new URL('../server/src/online-booking/booking-chat.controller.ts', import.meta.url), 'utf8');
const cardLink = await readFile(new URL('../server/src/online-booking/client-card-link.service.ts', import.meta.url), 'utf8');
const masterClient = await readFile(new URL('../core/communications/chat.js', import.meta.url), 'utf8');
const richUi = await readFile(new URL('../ui/shell/rich-text.js', import.meta.url), 'utf8');
const shellUi = await readFile(new URL('../ui/shell/index.js', import.meta.url), 'utf8');
const contract = await readFile(new URL('../docs/INTERNAL_CHAT_MESSAGE_MODEL.md', import.meta.url), 'utf8');

assert.match(migration, /ADD COLUMN "profileKey" TEXT/);
assert.match(migration, /ADD COLUMN "actorAccountId" TEXT/);
assert.match(migration, /ADD COLUMN "actorPersonKey" TEXT/);
assert.match(migration, /ADD COLUMN "actorName" TEXT/);
assert.match(migration, /ADD COLUMN "actorUei" TEXT/);
assert.match(migration, /FOREIGN KEY \("actorAccountId"\) REFERENCES "BookingAccount"\("id"\)/);
assert.doesNotMatch(migration, /CommunicationMessage_bookingAccountId_fkey/);
assert.match(migration, /ADD COLUMN "content" JSONB/);
assert.match(migration, /ADD COLUMN "editedAt"/);
assert.match(migration, /ADD COLUMN "deletedAt"/);

assert.match(profiles, /profileKey/);
assert.match(profiles, /memberKeys/);
assert.match(profiles, /accountIds/);
assert.match(profiles, /entity\.members/);
assert.match(profiles, /owner\.type === 'person'/);
assert.match(profiles, /async byAccount/);
assert.match(profiles, /async byProfileKey/);
assert.match(profiles, /async canonicalizeProfileKeys/);

assert.match(dispatch, /profileKey\?: unknown/);
assert.match(dispatch, /inAppDeliveryProfile/);
assert.match(dispatch, /resolveInAppProfile/);
assert.match(dispatch, /delivery\.accountIds/);
assert.match(dispatch, /if \(await this\.inAppDeliveryProfile\(tenantId, input \|\| \{\}\)\) return 'IN_APP'/);
assert.match(dispatch, /profileKey: profile\.profileKey/);
assert.match(dispatch, /profilePush\.notify/);
assert.doesNotMatch(dispatch, /createForAccount/);

assert.match(profilePush, /contactRoutes\.resolve/);
assert.match(profilePush, /accountsForProfile/);
assert.match(profilePush, /listAccountEndpoints/);
assert.match(profilePush, /'PUSH'/);
assert.doesNotMatch(profilePush, /'TELEGRAM'/);
assert.doesNotMatch(profilePush, /'EMAIL'/);

assert.match(cardLink, /cardState\(tenantId, account\.phone\)/);
const cardIdentityChoice = cardLink.slice(cardLink.indexOf('async findOrAttachExistingCard('), cardLink.indexOf('const owner:'));
assert.doesNotMatch(cardIdentityChoice, /account\.telegramId/);

assert.match(service, /const RICH_BLOCK_TYPES = new Set\(\['paragraph', 'heading', 'subheading', 'quote', 'list-item'\]\)/);
assert.match(service, /const RICH_MARKS = new Set\(\['bold', 'italic', 'underline', 'strike', 'code'\]\)/);
assert.match(service, /storedProfileKey/);
assert.match(service, /profile\.memberKeys/);
assert.match(service, /threadProfileKey/);
assert.match(service, /message\.actorAccountId !== actor\.accountId/);
assert.match(service, /async editMessage/);
assert.match(service, /"editedAt" = CURRENT_TIMESTAMP/);
assert.match(service, /async deleteMessage/);
assert.match(service, /"deletedAt" = CURRENT_TIMESTAMP/);
assert.match(service, /"attachments" = '\[\]'::jsonb/);

assert.match(ownerController, /@Query\('profileKey'\) profileKey/);
assert.match(ownerController, /profileKey\?: unknown/);
assert.match(ownerController, /@Patch\('chat\/messages\/:messageId'\)/);
assert.match(ownerController, /@Delete\('chat\/messages\/:messageId'\)/);
assert.match(clientController, /@Controller\('online-booking\/:tenantId\/account\/internal-chat'\)/);
assert.match(clientController, /actorAccountId: accountId/);
assert.match(clientController, /side: 'client', accountId/);
assert.match(masterClient, /profileKey/);

assert.match(richUi, /data-rich-mark="bold"/);
assert.match(richUi, /data-rich-mark="italic"/);
assert.match(richUi, /data-rich-mark="underline"/);
assert.match(richUi, /data-rich-mark="strike"/);
assert.match(richUi, /data-rich-block="heading"/);
assert.match(richUi, /data-rich-block="subheading"/);
assert.match(richUi, /data-rich-emoji-toggle/);
assert.match(shellUi, /Сообщение удалено/);
assert.match(shellUi, /message\.editedAt/);
assert.match(shellUi, /data-message-actions/);
assert.match(shellUi, /message\.actorName/);
assert.match(shellUi, /message\.actorUei/);

assert.match(contract, /First client access is reconciled by normalized phone only/);
assert.match(contract, /Email and Telegram are never identity\/deduplication keys/);
assert.match(contract, /profile-only dependent with no linked account is not a direct message destination/);
assert.match(contract, /Push is not Telegram, email or a Contact Point/);

console.log('internal profile chat contract regression: ok');
