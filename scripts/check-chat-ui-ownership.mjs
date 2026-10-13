import fs from 'node:fs';

const profileChat = fs.readFileSync('chat/chat.js', 'utf8');
const accountChat = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const chatApi = fs.readFileSync('core/communications/chat.js', 'utf8');
const controller = fs.readFileSync('server/src/communication/communication.controller.ts', 'utf8');
const dispatch = fs.readFileSync('server/src/communication/communication-dispatch.service.ts', 'utf8');
const chatUi = fs.readFileSync('ui/chat/index.js', 'utf8');
const chatRuntime = fs.readFileSync('core/chat/runtime.js', 'utf8');
const messengerMode = fs.readFileSync('core/chat/messenger-mode.js', 'utf8');
const chatCss = fs.readFileSync('ui/chat/chat.css', 'utf8');
const v2Css = fs.readFileSync('ui/v2/v2.css', 'utf8');
const v2Ui = fs.readFileSync('ui/v2/index.js', 'utf8');
const v2Header = fs.readFileSync('ui/v2/header.js', 'utf8');
const v2Stack = fs.readFileSync('ui/v2/z-stack.js', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const settingsSource = fs.readFileSync('settings/settings.js', 'utf8');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(!profileChat.includes('appShell') && !profileChat.includes('appHeader'), 'Professional Chat must not use the legacy appShell/appHeader.');
expect(profileChat.includes('workspaceHeaderContext({') && profileChat.includes('renderChatSurface('), 'Professional Chat must render inside the canonical V2 workspace.');
expect(profileChat.includes("a: { kind: 'settings'") || profileChat.includes("data-chat-settings"), 'Professional Chat Header A must own Chat settings.');
expect(profileChat.includes("kind: 'contacts'") && profileChat.includes("kind: 'attachment'"), 'Professional Chat must use shared Header C contacts and D attachment roles.');
expect(profileChat.includes("from '../core/chat/runtime.js'") && profileChat.includes('mountChatThread(') && profileChat.includes('mountChatList('), 'Professional Chat must use the neutral Core Chat runtime.');
expect(profileChat.includes('body, attachments'), 'Professional direct thread must send attachments through the neutral Chat runtime.');
expect(!profileChat.includes('function bindMessageAttachments') && !profileChat.includes('function fileAttachment'), 'Professional Chat must not duplicate Shared Chat attachment logic.');
expect(!profileChat.includes('<style>') && !profileChat.includes("document.createElement('style')"), 'Professional Chat must not own local styles.');
expect(profileChat.includes("data-chat-new-message") && profileChat.includes("recipientOptions(root, state)"), 'Chat settings must expose the existing one/many/group/all message composer after Notifications E removal.');
expect(profileChat.includes("name: 'broadcastChannel'") && profileChat.includes("{ value: 'TELEGRAM', label: 'Telegram' }") && profileChat.includes("{ value: 'EMAIL', label: 'Email' }"), 'Bulk Chat composition must preserve Telegram/Email channel choice from the removed duplicate broadcast UI.');
expect(!settingsSource.includes("['communications', 'Уведомления'") && !fs.existsSync('settings/communications/communications.js'), 'Duplicate Notifications E and its retired settings UI must stay removed.');

expect(accountChat.includes('v2Header({') && accountChat.includes('v2Shell'), 'End-user Chat must use the shared V2 H + Z shell.');
expect(accountChat.includes("selected ? 'v2-app--chat' : 'v2-app--chat-list'"), 'End-user Chat must use the canonical V2 Chat shell classes.');
expect(accountChat.includes("from '../core/chat/runtime.js'") && accountChat.includes('mountChatThread(') && accountChat.includes('mountChatList('), 'End-user Chat must use the neutral Core Chat runtime.');
expect(accountChat.includes('const relationships = Array.isArray(state.relationships)') && accountChat.includes("state.accountTab = 'contacts'"), 'End-user Chat C contacts must use the global account relationship set and route to Contacts.');
expect(!accountChat.includes('bindMessageAttachments(form)') && !accountChat.includes('messageThread(') && !accountChat.includes('messageComposer('), 'End-user account shell must not own Chat thread/composer behavior.');
expect(!accountChat.includes('accountBottomNavigation') && !accountChat.includes('bindBottomNavigation'), 'End-user V2 Chat must not restore bottom navigation.');
expect(!accountChat.includes('<style>') && !accountChat.includes("document.createElement('style')"), 'End-user Chat must not own local styles.');

expect(chatRuntime.includes('export function mountChatList') && chatRuntime.includes('export function mountChatThread'), 'Core Chat runtime must own shared list/thread behavior.');
expect(chatRuntime.includes("kind: 'contacts'") && chatRuntime.includes("kind: 'attachment'"), 'Core Chat runtime must own Header C contacts and D attachment roles.');
expect(chatRuntime.includes("kind: 'mode'") && chatRuntime.includes('data-chat-mode-switch'), 'Messenger Z1 must expose D as the mode exit instead of a back action.');
expect(chatRuntime.includes('bindMessageAttachments(form)') && chatRuntime.includes('messageComposer(') && chatRuntime.includes('messageThread('), 'Core Chat runtime must own composer, attachments, and thread rendering.');
expect(accountChat.includes("b: 'Обзор'") && accountChat.includes("v2Section('Предстоящие визиты'") && !accountChat.includes("v2Section('Контакты'"), 'End-user Overview must contain upcoming activity only; Contacts must remain their own F root.');

expect(chatUi.includes('messageBubble') && chatUi.includes('messageThread') && chatUi.includes('messageComposer'), 'Shared ui/chat must own message bubbles, thread and composer.');
expect(chatUi.includes('bindMessageAttachments') && chatUi.includes('initMessageComposer'), 'Shared ui/chat must own attachments and growing composer behavior.');
expect(chatUi.includes('Math.min(input.scrollHeight, 116)') && chatCss.includes('overflow-y:hidden'), 'Shared Chat composer must grow with text before internal scrolling.');
expect(chatCss.includes('.message-attachment--file'), 'Shared ui/chat CSS must render file/PDF attachments.');
expect(chatCss.includes('.v2-app .message-composer') && chatCss.includes('.v2-app--chat .v2-z'), 'Shared ui/chat CSS must own V2 Chat composer geometry.');
expect(chatCss.includes('.message-composer__input:focus-visible') && chatCss.includes('outline:none'), 'Shared Chat must suppress native blue focus rings.');
expect(!fs.existsSync('ui/shell/index.js'), 'Legacy ui/shell owner must be physically removed.');
expect(!fs.existsSync('ui/shell/shell.css'), 'Legacy ui/shell CSS must be physically removed.');

expect(messengerMode.includes('getCommunicationThreads') && messengerMode.includes('getGlobalAccountRelationships'), 'One Shared Messenger mode owner must serve professional and end-user runtimes.');
expect(messengerMode.includes("ROOT_CLASS = 'messenger-mode-z'") && messengerMode.includes('dismissible: false'), 'Messenger Z1 must be a non-dismissible mode root.');
expect(messengerMode.includes("THREAD_CLASS = 'messenger-thread-z'") && messengerMode.includes('stack: true'), 'Messenger dialogs must be Z2+ layers over Messenger Z1.');
expect(messengerMode.includes(".v2-header__control--chat") && messengerMode.includes('stopImmediatePropagation()'), 'Shared Messenger owner must intercept D chat entry before legacy feature handlers.');
expect(messengerMode.includes("{ value: 'ALL', label: 'Общий' }") && messengerMode.includes("{ value: 'PUSH', label: 'Чат' }"), 'Professional Messenger must expose Общий and Чат, never Push, as user-facing modes.');
expect(messengerMode.includes('filteredMessages(messages, filter)'), 'Professional Messenger channel switch must filter the unified conversation.');
expect(messengerMode.includes('getAccountChat(tenantId)') && !messengerMode.includes('getAccountNotifications'), 'End-user Messenger must show internal Chat messages only, not external/system notification feeds.');
expect(indexHtml.includes('core/chat/messenger-mode.js'), 'Shared Messenger mode owner must be loaded for both production app domains.');

expect(v2Stack.includes('dismissible = true') && v2Stack.includes("node.dataset.v2ModeRoot = 'true'"), 'Shared Z owner must support a non-dismissible independent mode root.');
expect(v2Stack.includes("surface.dataset.v2Dismissible === 'false'") && v2Stack.includes('if (dismissible) {'), 'Non-dismissible Messenger Z1 must have no swipe/dismiss affordance.');
expect(v2Stack.includes('findLastIndex') && v2Stack.includes('modeRootIndex'), 'Messenger Z1/Z2 depth must be independent from the APP Z stack below it.');
expect(v2Header.includes("kind === 'mode'") && v2Header.includes('v2-header__icon--mode'), 'Header D must have a distinct visible app-mode return icon on Messenger Z1.');

expect(chatApi.includes('attachments = []') && chatApi.includes('body, attachments'), 'Professional communication API must carry attachments.');
expect(controller.includes('attachments?: unknown'), 'Professional chat controller must accept attachments.');
expect(dispatch.includes('Array.isArray(input?.attachments)') && dispatch.includes("channel: 'IN_APP'") && dispatch.includes('attachments,'), 'Professional media messages must persist into the shared thread.');
expect(profileChat.includes("application/pdf") === false, 'Professional Chat feature file must not duplicate attachment MIME rules owned by ui/chat.');
expect(accountChat.includes("application/pdf") === false, 'End-user Chat feature file must not duplicate attachment MIME rules owned by ui/chat.');
expect(chatUi.includes("application/pdf"), 'Shared ui/chat must own PDF attachment acceptance.');

expect(v2Ui.includes('v2Header') && v2Ui.includes('v2Shell'), 'V2 H + Z geometry must be owned by shared ui/v2.');
expect(v2Css.includes('.v2-header'), 'Shared V2 must continue to own header geometry.');

if (failures.length) {
  failures.forEach((message) => console.error(`chat ui ownership: ${message}`));
  process.exit(1);
}

console.log('chat ui ownership check: OK');
