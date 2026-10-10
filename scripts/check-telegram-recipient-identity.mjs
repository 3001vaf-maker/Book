import fs from 'node:fs';

const accountRuntime = fs.readFileSync('online-booking/account-runtime.js', 'utf8');
const communicationService = fs.readFileSync('server/src/communication/communication.service.ts', 'utf8');
const telegramBot = fs.readFileSync('server/src/communication/telegram-bot.service.ts', 'utf8');
const communicationHistory = fs.readFileSync('server/src/communication/communication-history.service.ts', 'utf8');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(
  accountRuntime.includes('clearAccount,')
    && accountRuntime.includes('let telegramReadyForBind = false;')
    && accountRuntime.includes('clearAccount(tenant);')
    && accountRuntime.includes('!telegramReadyForBind || !getAccountToken(tenant)'),
  'Unknown Telegram entry must clear a stale browser Account and bind only after explicit authentication.',
);
expect(
  accountRuntime.includes('await resolveTelegramEntry();')
    && accountRuntime.includes('void resolveTelegramEntry();')
    && accountRuntime.includes('void bindTelegramWhenAuthenticated();'),
  'Telegram entry resolution must retry safely without falling back to an arbitrary existing browser session.',
);
expect(
  communicationService.includes('accountContact.findFirst({')
    && communicationService.includes('isPrimary: true,'),
  'Telegram auto-login must resolve only the canonical primary Telegram contact.',
);
expect(
  communicationService.includes('accountContact.deleteMany({')
    && communicationService.includes('value: { not: ticket.telegramUserId }')
    && communicationService.includes('data: { telegramId: ticket.telegramUserId }'),
  'Telegram rebinding must replace the Account destination instead of accumulating extra recipients.',
);
expect(
  communicationService.includes('DELETE FROM "CommunicationIdentity"')
    && communicationService.includes('"externalUserId" <> ${ticket.telegramUserId}'),
  'Telegram rebinding must remove stale tenant recipient identities for the same person.',
);
expect(
  communicationService.includes('ORDER BY EXISTS (')
    && communicationService.includes('"primaryTelegram"."isPrimary" = TRUE'),
  'Outbound Telegram routing must prefer the canonical primary Telegram destination over a newer stale identity.',
);
expect(
  telegramBot.includes("chat_id: telegramUserId")
    && telegramBot.includes('identity.externalUserId')
    && telegramBot.includes("direction: 'outbound'")
    && telegramBot.includes("channel: 'TELEGRAM'"),
  'A D-chat Telegram send must target the selected person Telegram id and persist as outbound Telegram history.',
);
expect(
  telegramBot.includes("direction: 'inbound'")
    && telegramBot.includes("channel: 'TELEGRAM'")
    && telegramBot.includes('externalUserId')
    && telegramBot.includes('processUpdate'),
  'A Telegram reply must be mapped back to the linked person and persisted as inbound Telegram history.',
);
expect(
  communicationHistory.includes('FROM "CommunicationMessage" m')
    && !communicationHistory.match(/FROM "CommunicationMessage" m[\s\S]{0,400}m\."channel"\s*=\s*'IN_APP'/),
  'D chat history must include Telegram messages, not only in-app messages.',
);

if (failures.length) {
  failures.forEach((message) => console.error(`telegram recipient identity: ${message}`));
  process.exit(1);
}
console.log('telegram recipient identity check: OK');
