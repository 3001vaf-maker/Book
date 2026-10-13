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
requireText(chatUi, "attachmentTrigger === 'external'", 'dialog attachments must be triggerable from Header D');
requireText(chatUi, "externalAttachmentTrigger ? ' sr-only'", 'dialog composer attachment button must be hidden when Header D owns attachment');

requireText(messengerMode, "ROOT_CLASS = 'messenger-mode-z'", 'Messenger must have one shared embedded root');
requireText(messengerMode, 'dismissible: false', 'Messenger Z1 must not be swipe-dismissible');
requireText(messengerMode, "THREAD_CLASS = 'messenger-thread-z'", 'Messenger dialogs must be Z2+ layers over the Messenger root');
requireText(messengerMode, "from './internal-chat.js'", 'Messenger core must depend on the internal Chat adapter only');
rejectText(messengerMode, 'getCommunicationChannels', 'Messenger core must not know external communication channels');
rejectText(messengerMode, 'TELEGRAM', 'Messenger core must not contain Telegram integration');
rejectText(messengerMode, 'EMAIL', 'Messenger core must not contain Email integration');
requireText(messengerMode, 'getProfessionalChatThreads', 'professional runtime must use internal Chat through the shared Messenger owner');
requireText(messengerMode, 'getEndUserChatThreads', 'end-user runtime must use the same shared Messenger owner');

requireText(internalChat, "INTERNAL_CHAT_CHANNEL = 'CHAT'", 'the Messenger internal channel must be CHAT');
requireText(internalChat, "PROFESSIONAL_INTERNAL_TRANSPORT = 'PUSH'", 'legacy transport mapping must stay isolated behind the internal Chat adapter');
requireText(internalChat, "channel === 'IN_APP' || channel === 'PUSH' || channel === INTERNAL_CHAT_CHANNEL", 'internal adapter must recognize legacy internal transport without exposing it to Messenger UI');
rejectText(internalChat, 'TELEGRAM', 'internal Chat adapter must not consume Telegram');
rejectText(internalChat, 'EMAIL', 'internal Chat adapter must not consume Email');

requireText(zStack, 'dismissible = true', 'Shared Z owner must support dismissible and non-dismissible roots');
requireText(zStack, "node.dataset.v2ModeRoot = 'true'", 'non-dismissible Messenger root must own an independent Z stack');
requireText(zStack, "surface.dataset.v2Dismissible === 'false'", 'Messenger root dismiss affordance must be hidden');
requireText(indexHtml, 'core/chat/messenger-mode.js', 'Shared Messenger owner must load on both application domains');

if (!process.exitCode) console.log('APP MODE ARCHITECTURE: OK');
