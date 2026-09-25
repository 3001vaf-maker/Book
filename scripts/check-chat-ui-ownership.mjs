import fs from 'node:fs';

const profileChat = fs.readFileSync('chat/chat.js', 'utf8');
const accountChat = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const chatApi = fs.readFileSync('core/communications/chat.js', 'utf8');
const controller = fs.readFileSync('server/src/communication/communication.controller.ts', 'utf8');
const dispatch = fs.readFileSync('server/src/communication/communication-dispatch.service.ts', 'utf8');
const shellUi = fs.readFileSync('ui/shell/index.js', 'utf8');
const shellCss = fs.readFileSync('ui/shell/shell.css', 'utf8');
const chatUi = fs.readFileSync('ui/chat/index.js', 'utf8');
const chatCss = fs.readFileSync('ui/chat/chat.css', 'utf8');
const v2Css = fs.readFileSync('ui/v2/v2.css', 'utf8');
const v2Ui = fs.readFileSync('ui/v2/index.js', 'utf8');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(profileChat.includes('appShell,'), 'Profile chat must import the shared Book appShell.');
expect(profileChat.includes("className = ''") && profileChat.includes("root.innerHTML = appShell({ header, body, media: '', className });"), 'Profile chat must render through the shared Book shell.');
expect(profileChat.includes("'app-view-shell--chat'"), 'Profile thread/composer view must use the canonical Book chat shell class.');
expect(profileChat.includes('messageThread(') && profileChat.includes('messageComposer('), 'Profile chat must use the shared message thread and composer.');
expect(profileChat.includes("messageComposer({ placeholder: 'Написать сообщение...', attachments: true })"), 'Profile direct thread must expose the shared Book Chat paperclip.');
expect(profileChat.includes('bindMessageAttachments(form)') && profileChat.includes('body, attachments'), 'Profile direct thread must send selected media attachments.');
expect(!profileChat.includes('root.innerHTML = `${header}<div class="form-grid">'), 'Profile chat must not keep the legacy local chat screen wrapper.');
expect(!profileChat.includes('<style>') && !profileChat.includes("document.createElement('style')"), 'Profile chat must not own local styles.');

expect(accountChat.includes('v2Header({') && accountChat.includes('v2Shell'), 'End-user Chat must use the shared V2 H + Z shell.');
expect(accountChat.includes("className: 'v2-app--chat'"), 'End-user Chat must use the canonical V2 Chat shell class.');
expect(accountChat.includes("messageComposer({ attachments: true, attachmentTrigger: 'external' })"), 'End-user Chat must keep attachments in Header D instead of a permanent composer paperclip.');
expect(accountChat.includes("kind: 'contacts'") && accountChat.includes("kind: 'attachment'"), 'End-user Chat Header must expose C contacts and D attachment roles.');
expect(!accountChat.includes('accountBottomNavigation') && !accountChat.includes('bindBottomNavigation'), 'End-user V2 Chat must not restore bottom navigation.');
expect(!accountChat.includes('<style>') && !accountChat.includes("document.createElement('style')"), 'Account chat must not own local styles.');
expect(v2Ui.includes('v2Header') && v2Ui.includes('v2Shell'), 'V2 H + Z geometry must be owned by shared ui/v2.');
expect(v2Css.includes('.v2-app--chat .v2-z') && v2Css.includes('.v2-header'), 'V2 CSS must own the end-user Chat geometry.');

expect(chatApi.includes('attachments = []') && chatApi.includes('body, attachments'), 'Profile communication API must carry attachments.');
expect(profileChat.includes("application/pdf") && accountChat.includes("application/pdf"), 'Both Chat contours must accept PDF attachments through the shared attachment control.');
expect(chatUi.includes('messageBubble') && chatUi.includes('messageThread') && chatUi.includes('messageComposer'), 'Shared ui/chat must own message bubbles, thread and composer.');
expect(chatUi.includes("message-composer--plain") && chatUi.includes("message-composer--with-attachments"), 'Shared ui/chat must own both composer layouts.');
expect(chatCss.includes('.message-attachment--file'), 'Shared ui/chat CSS must render file/PDF attachments.');
expect(!shellUi.includes('messageBubble') && !shellUi.includes('messageThread') && !shellUi.includes('messageComposer'), 'Legacy ui/shell must not own Chat components.');
expect(!shellCss.includes('.message-thread{') && !shellCss.includes('.message-composer{'), 'Legacy ui/shell CSS must not own Chat component styles.');
expect(controller.includes('attachments?: unknown'), 'Profile chat controller must accept attachments.');
expect(dispatch.includes('Array.isArray(input?.attachments)') && dispatch.includes("channel: 'IN_APP'") && dispatch.includes('attachments,'), 'Profile media messages must be persisted into the shared Book chat thread.');

expect(shellCss.includes('.app-content.app-content--shell{padding:0}'), 'Shared shell CSS must neutralize outer profile page padding for Book shell views.');
expect(shellCss.includes('.app-view-shell--chat'), 'Legacy profile shell may keep only its shell-level Chat screen geometry.');
expect(chatCss.includes('.message-composer{position:fixed'), 'Shared ui/chat CSS must own canonical composer geometry.');

if (failures.length) {
  failures.forEach((message) => console.error(`chat ui ownership: ${message}`));
  process.exit(1);
}

console.log('chat ui ownership check: OK');
