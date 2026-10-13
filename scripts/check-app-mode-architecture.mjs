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
const zStack = read('ui/v2/z-stack.js');
const indexHtml = read('index.html');

requireText(registry, "PROFESSIONAL: 'professional'", 'professional mode must stay registered for future explicit domain switching');
requireText(registry, "CONSUMER: 'consumer'", 'consumer mode must stay registered for future explicit domain switching');
requireText(registry, "MESSENGER: 'messenger'", 'messenger mode must stay registered');
requireText(registry, "SOCIAL: 'social'", 'future social mode must stay reserved');
requireText(registry, 'origin: APP_ORIGIN', 'professional mode must use APP_ORIGIN');
requireText(registry, 'origin: USER_ORIGIN', 'consumer mode must use USER_ORIGIN');
requireText(registry, "kind: 'embedded'", 'messenger must remain an embedded mode for now');
requireText(registry, "visible: false", 'future social mode must not become visible before implementation');

requireText(header, "const kind = slot.kind || 'text'", 'Header D must use the requested context kind instead of being forced to mode');
rejectText(header, "role === 'd' ? 'mode'", 'Header D must not be forced to mode at every Messenger depth');
requireText(header, "kind === 'mode'", 'Header must retain a distinct Messenger-root return icon');
requireText(header, "kind === 'attachment'", 'Header must retain the dialog attachment icon');
requireText(header, "kind === 'chat'", 'Header must retain the APP-to-Messenger entry icon');

requireText(switchUi, 'visibleAppModes()', 'future explicit mode picker must continue to come from the shared registry');
requireText(switchUi, "variant: 'x'", 'future explicit mode picker must remain canonical X');
rejectText(switchUi, 'accessToken', 'mode switching must not leak access tokens through UI navigation');
rejectText(switchUi, 'refreshToken', 'mode switching must not leak refresh tokens through UI navigation');
rejectText(switchUi, '?token=', 'mode switching must not put authentication tokens in URLs');

requireText(chatRuntime, "kind: 'mode'", 'Messenger Z1 D must be the return-to-APP mode control');
requireText(chatRuntime, 'data-chat-mode-switch', 'Messenger Z1 must own an explicit exit action');
requireText(chatRuntime, "kind: 'attachment'", 'Messenger Z2 dialog D must be attachment, not mode switching');
requireText(chatRuntime, 'data-chat-attachment', 'Messenger dialog must connect Header D to the file picker');
requireText(chatUi, "attachmentTrigger === 'external'", 'dialog attachments must be triggerable from Header D');
requireText(chatUi, "externalAttachmentTrigger ? ' sr-only'", 'dialog composer attachment button must be hidden when Header D owns attachment');

requireText(messengerMode, "ROOT_CLASS = 'messenger-mode-z'", 'Messenger must have one shared embedded root');
requireText(messengerMode, 'dismissible: false', 'Messenger Z1 must not be swipe-dismissible');
requireText(messengerMode, "THREAD_CLASS = 'messenger-thread-z'", 'Messenger dialogs must be Z2+ layers over the Messenger root');
requireText(messengerMode, 'getCommunicationThreads', 'professional runtime must use the shared Messenger owner');
requireText(messengerMode, 'getGlobalAccountRelationships', 'end-user runtime must use the same shared Messenger owner');
requireText(messengerMode, "{ value: 'ALL', label: 'Общий' }", 'professional Messenger must have Общий mode/filter');
requireText(messengerMode, "{ value: 'PUSH', label: 'Чат' }", 'the internal user-facing channel must be named Чат, not Push');
requireText(messengerMode, 'filteredMessages(messages, filter)', 'professional channel mode must actually filter the unified thread');
requireText(messengerMode, 'getAccountChat(tenantId)', 'end-user Messenger must render internal Chat messages');
rejectText(messengerMode, 'getAccountNotifications', 'end-user Messenger must not merge system notification feed into Chat');

requireText(zStack, 'dismissible = true', 'Shared Z owner must support dismissible and non-dismissible roots');
requireText(zStack, "node.dataset.v2ModeRoot = 'true'", 'non-dismissible Messenger root must own an independent Z stack');
requireText(zStack, "surface.dataset.v2Dismissible === 'false'", 'Messenger root dismiss affordance must be hidden');
requireText(indexHtml, 'core/chat/messenger-mode.js', 'Shared Messenger owner must load on both application domains');

if (!process.exitCode) console.log('APP MODE ARCHITECTURE: OK');
