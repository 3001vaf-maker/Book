import fs from 'node:fs';

const accountRuntime = fs.readFileSync('online-booking/account-runtime.js', 'utf8');
const communicationService = fs.readFileSync('server/src/communication/communication.service.ts', 'utf8');
const communicationDispatch = fs.readFileSync('server/src/communication/communication-dispatch.service.ts', 'utf8');
const communicationController = fs.readFileSync('server/src/communication/communication.controller.ts', 'utf8');
const telegramBot = fs.readFileSync('server/src/communication/telegram-bot.service.ts', 'utf8');
const communicationHistory = fs.readFileSync('server/src/communication/communication-history.service.ts', 'utf8');
const communicationModule = fs.readFileSync('server/src/communication/communication.module.ts', 'utf8');
const platformNotice = fs.readFileSync('server/src/platform-notice/platform-notice.service.ts', 'utf8');
const chatApi = fs.readFileSync('core/communications/chat.js', 'utf8');
const chatUi = fs.readFileSync('chat/chat.js', 'utf8');

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
  communicationDispatch.includes('function telegramRecipient(')
    && communicationDispatch.includes("? { phone, uei: '' }")
    && communicationDispatch.includes('telegramIdentity(tenantId, telegramRecipient(input || {}))')
    && communicationDispatch.includes('const recipient = telegramRecipient(input || {});')
    && communicationDispatch.includes('this.telegram.sendChatMessage(tenantId, { ...recipient, body, purpose: input.purpose })'),
  'Professional D Telegram routing must use the selected person phone as the recipient boundary and never fall through to another Person via UEI.',
);
expect(
  telegramBot.includes("chat_id: telegramUserId")
    && telegramBot.includes('identity.externalUserId')
    && telegramBot.includes("direction: 'outbound'")
    && telegramBot.includes("channel: 'TELEGRAM'"),
  'A linked D-chat Telegram send must target the selected person Telegram id and persist as outbound Telegram history.',
);
expect(
  telegramBot.includes("direction: 'inbound'")
    && telegramBot.includes("channel: 'TELEGRAM'")
    && telegramBot.includes('externalUserId')
    && telegramBot.includes('processUpdate'),
  'A linked Telegram reply must be mapped back to the linked person and persisted as inbound Telegram history.',
);
expect(
  communicationService.includes('async ensureTelegramInboundIdentity(')
    && communicationService.includes("'', '', 'TELEGRAM', ${externalUserId}")
    && communicationService.includes('verifiedAt')
    && communicationService.includes('NULL, CURRENT_TIMESTAMP'),
  'An unlinked private Telegram sender must get a provisional external identity without inventing a phone or UEI.',
);
expect(
  telegramBot.includes('ensureTelegramInboundIdentity(connection.tenantId')
    && telegramBot.includes('const linkedIdentity = Boolean(identity')
    && telegramBot.includes('messageBody && !isStart')
    && telegramBot.includes('inbound-recorded linked=${linkedIdentity}'),
  'Ordinary text from an unlinked Telegram sender must be persisted as a DIRECT inbound message instead of being discarded behind the app-entry prompt.',
);
expect(
  communicationService.includes('const telegramExternalThread = channel === \'TELEGRAM\'')
    && communicationService.includes('!personPhone && !uei && !telegramExternalThread')
    && communicationService.includes('externalThreadId,'),
  'Provisional Telegram messages may exist without fake Person identity only when they have a real Telegram external thread id.',
);
expect(
  communicationService.includes('const provisionalTelegram = Boolean(')
    && communicationService.includes('SET "personPhone" = EXCLUDED."personPhone"')
    && communicationService.includes('UPDATE "CommunicationMessage"')
    && communicationService.includes('"externalThreadId" = ${ticket.telegramUserId}'),
  'When the Telegram sender later links an Account, the provisional identity and prior conversation must merge into the real Person thread.',
);
expect(
  communicationHistory.includes('externalThreadId?: unknown')
    && communicationHistory.includes("'telegram:' || \"externalThreadId\"")
    && communicationHistory.includes('AS "display"'),
  'Professional D history must expose Telegram-only provisional conversations as real threads without creating a Person.',
);
expect(
  telegramBot.includes('async isExternalThreadAvailable(')
    && telegramBot.includes('async sendExternalThreadMessage(')
    && communicationDispatch.includes('sendExternalThreadMessage(tenantId')
    && communicationDispatch.includes("return await this.telegram.isExternalThreadAvailable(tenantId, externalThreadId) ? ['TELEGRAM'] : []"),
  'A professional must be able to reply from D to the same provisional Telegram conversation, and that thread must expose Telegram only.',
);
expect(
  communicationController.includes("@Query('externalThreadId') externalThreadId = ''")
    && chatApi.includes("externalThreadId: String(externalThreadId || '')")
    && chatApi.includes('externalThreadId, body, attachments'),
  'The professional chat API must carry the provisional Telegram external thread id through load, channel resolution and reply.',
);
expect(
  chatUi.includes('function threadTitle(thread = {})')
    && chatUi.includes('const externalThreadId = String(thread?.externalThreadId || \'\').trim();')
    && chatUi.includes('getCommunicationThread({ phone, uei, externalThreadId })')
    && chatUi.includes('sendCommunicationMessage({ channel: selectedChannel, phone, uei, externalThreadId, body, attachments })')
    && chatUi.includes('threadTitle: (thread) => threadTitle(thread)'),
  'Professional D UI must render and open provisional Telegram conversations and reply through their external thread id.',
);
expect(
  chatUi.includes('function directChannelOptions(channels = [], { defaultPush = true } = {})')
    && chatUi.includes('directChannelOptions(channelState?.channels, { defaultPush: !externalThreadId })'),
  'A provisional Telegram-only D thread must not silently expose Push as a fallback channel.',
);
expect(
  communicationHistory.includes('FROM "CommunicationMessage" m')
    && !communicationHistory.match(/FROM "CommunicationMessage" m[\s\S]{0,400}m\."channel"\s*=\s*'IN_APP'/),
  'Professional D chat history must include Telegram messages, not only in-app messages.',
);

const accountThreadStart = communicationService.indexOf('async listThread(');
const accountThreadEnd = communicationService.indexOf('async listThreads(', accountThreadStart);
const accountThread = communicationService.slice(accountThreadStart, accountThreadEnd);
expect(
  accountThread.includes('FROM "CommunicationMessage"')
    && !accountThread.includes('"channel" = \'IN_APP\''),
  'End-user D chat must show one conversation across in-app and external delivery channels.',
);
expect(
  communicationService.includes('PlatformNoticeService')
    && communicationService.includes("direction === 'inbound'")
    && communicationService.includes("purpose === 'DIRECT'")
    && communicationService.includes('pushToTenantOwner(tenantId'),
  'Every newly persisted inbound direct message must notify the professional owner.',
);
expect(
  platformNotice.includes('async pushToTenantOwner(')
    && platformNotice.includes('const explicitUrl = text(metadata.url);')
    && platformNotice.includes('explicitUrl ||'),
  'Professional direct-message push must use the existing platform push owner and support an application URL.',
);
expect(
  communicationModule.includes('PlatformNoticeModule')
    && communicationModule.includes('NotificationModule, PlatformNoticeModule'),
  'Communication must consume PlatformNoticeModule instead of owning a parallel push implementation.',
);

if (failures.length) {
  failures.forEach((message) => console.error(`telegram recipient identity: ${message}`));
  process.exit(1);
}
console.log('telegram recipient identity check: OK');
