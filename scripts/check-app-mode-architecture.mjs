import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => {
  console.error(`APP MODE ARCHITECTURE: ${message}`);
  process.exitCode = 1;
};
const requireText = (source, value, message) => {
  if (!source.includes(value)) fail(message);
};
const rejectText = (source, value, message) => {
  if (source.includes(value)) fail(message);
};

const registry = read('core/app-mode/index.js');
const switchUi = read('ui/header/mode-switch.js');
const header = read('ui/v2/header.js');
const chatUi = read('ui/chat/index.js');
const chatRuntime = read('core/chat/runtime.js');
const messengerMode = read('core/chat/messenger-mode.js');
const internalChat = read('core/chat/internal-chat.js');
const messengerApi = read('core/chat/messenger-api.js');
const messengerCore = read('server/src/communication/messenger-core.service.ts');
const dispatch = read('server/src/communication/communication-dispatch.service.ts');
const accountGuard = read('server/src/online-booking/account.guard.ts');
const jwtGuard = read('server/src/auth/jwt-auth.guard.ts');
const zStack = read('ui/v2/z-stack.js');
const indexHtml = read('index.html');

requireText(registry, "PROFESSIONAL: 'professional'", 'professional mode must stay registered for future domain switching');
requireText(registry, "CONSUMER: 'consumer'", 'consumer mode must stay registered for future domain switching');
requireText(registry, "MESSENGER: 'messenger'", 'messenger mode must stay registered');
requireText(registry, "SOCIAL: 'social'", 'future social mode must stay reserved');
requireText(registry, "visible: false", 'future social mode must not become visible before implementation');

requireText(header, "const kind = slot.kind || 'text'", 'Header D must use the requested context kind instead of being forced to mode');
rejectText(header, "role === 'd' ? 'mode'", 'Header D must not be forced to mode at every Messenger depth');
requireText(header, "kind === 'mode'", 'Header must retain a distinct Messenger-root return icon');
requireText(header, "kind === 'attachment'", 'Header must retain the dialog attachment icon');
requireText(header, "kind === 'chat'", 'Header must retain the APP-to-Messenger entry icon');

requireText(switchUi, 'visibleAppModes()', 'future explicit domain mode picker must continue to use the shared registry');
rejectText(switchUi, 'accessToken', 'mode switching must not leak access tokens through UI navigation');
rejectText(switchUi, 'refreshToken', 'mode switching must not leak refresh tokens through UI navigation');
rejectText(switchUi, '?token=', 'mode switching must not put authentication tokens in URLs');

requireText(chatRuntime, "kind: 'mode'", 'Messenger Z1 D must return to the saved APP state');
requireText(chatRuntime, 'data-chat-mode-switch', 'Messenger Z1 must own an explicit exit action');
requireText(chatRuntime, "kind: 'attachment'", 'Messenger Z2 dialog D must be attachment');
requireText(chatRuntime, 'data-chat-attachment', 'Messenger dialog must connect Header D to the file picker');
requireText(chatRuntime, "channel = 'CHAT'", 'internal Messenger runtime must default to CHAT');
rejectText(chatRuntime, "channel = 'PUSH'", 'Push must not be a Messenger UI channel');
requireText(chatRuntime, 'pointerdown', 'Messenger messages must support long-press actions');
requireText(chatRuntime, 'replyToId', 'Messenger composer must support replies');
requireText(chatUi, "attachmentTrigger === 'external'", 'dialog attachments must be triggerable from Header D');
requireText(chatUi, 'message-bubble__reactions', 'Messenger messages must render reactions');
requireText(chatUi, 'message-poll__option', 'Messenger messages must render polls');

requireText(messengerMode, "ROOT_CLASS = 'messenger-mode-z'", 'Messenger must have one shared embedded root');
requireText(messengerMode, 'dismissible: false', 'Messenger Z1 must not be swipe-dismissible');
requireText(messengerMode, "THREAD_CLASS = 'messenger-thread-z'", 'Messenger dialogs must be Z2+ layers over the Messenger root');
requireText(messengerMode, "from './internal-chat.js'", 'Messenger mode must depend on the internal Chat owner only');
requireText(messengerMode, "from './message-actions.js'", 'Messenger message actions must use one shared owner');
rejectText(messengerMode, 'getCommunicationChannels', 'Messenger core must not know external communication channels');
rejectText(messengerMode, 'TELEGRAM', 'Messenger core must not contain Telegram integration');
rejectText(messengerMode, 'EMAIL', 'Messenger core must not contain Email integration');
requireText(messengerMode, 'conversationId', 'Messenger Z2 must open a canonical conversation');

requireText(internalChat, "INTERNAL_CHAT_CHANNEL = 'CHAT'", 'the Messenger internal channel must be CHAT');
requireText(internalChat, "from './messenger-api.js'", 'internal Chat must use the Messenger API');
rejectText(internalChat, "../communications/chat.js", 'internal Chat must not depend on the legacy communication hub');
rejectText(internalChat, "'PUSH'", 'Push must not remain in the internal Messenger owner');
rejectText(internalChat, 'TELEGRAM', 'internal Chat adapter must not consume Telegram');
rejectText(internalChat, 'EMAIL', 'internal Chat adapter must not consume Email');

requireText(messengerApi, '/communications/messenger/conversations', 'professional Chat must use Messenger endpoints');
requireText(messengerApi, '/account/messenger', 'end-user Chat must use Messenger endpoints');
rejectText(messengerApi, '/communications/chat/thread', 'new Messenger API must not depend on legacy chat thread endpoints');

requireText(messengerCore, 'MessengerConversation', 'Messenger core must own canonical conversations');
requireText(messengerCore, 'MessengerParticipant', 'Messenger core must own canonical participants');
requireText(messengerCore, 'replyToId', 'Messenger core must persist replies');
requireText(messengerCore, 'forwardedFromId', 'Messenger core must persist forwarding');
requireText(messengerCore, 'toggleReaction', 'Messenger core must support reactions');
requireText(messengerCore, 'createGroup', 'Messenger core must support groups');
requireText(messengerCore, 'createPoll', 'Messenger core must support polls');
requireText(messengerCore, 'search(', 'Messenger core must support search');

requireText(dispatch, "if (requested === 'PUSH' || requested === 'IN_APP') return 'CHAT'", 'legacy internal channel names must normalize to CHAT only at the external dispatch boundary');
requireText(dispatch, "const channels: string[] = ['CHAT']", 'CHAT must be the canonical internal channel exposed by dispatch');
requireText(dispatch, "if (channel === 'CHAT')", 'dispatch must route CHAT to the internal Messenger core');
requireText(dispatch, 'this.messenger.recordDirectMessage', 'direct CHAT must enter the Messenger core');

requireText(accountGuard, '/account\\/messenger\\/conversations', 'end-user read receipts must follow Messenger routes');
requireText(jwtGuard, '/communications\\/messenger\\/conversations', 'professional read receipts must follow Messenger routes');

requireText(zStack, 'dismissible = true', 'Shared Z owner must support dismissible and non-dismissible roots');
requireText(zStack, "node.dataset.v2ModeRoot = 'true'", 'non-dismissible Messenger root must own an independent Z stack');
requireText(zStack, "surface.dataset.v2Dismissible === 'false'", 'Messenger root dismiss affordance must be hidden');
requireText(indexHtml, 'core/chat/messenger-mode.js', 'Shared Messenger owner must load on both application domains');

if (!process.exitCode) console.log('APP MODE ARCHITECTURE: OK');
