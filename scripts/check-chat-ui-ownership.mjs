import fs from 'node:fs';

const masterChat = fs.readFileSync('chat/chat.js', 'utf8');
const clientChat = fs.readFileSync('online-booking/account-shell.js', 'utf8');
const chatApi = fs.readFileSync('core/communications/chat.js', 'utf8');
const controller = fs.readFileSync('server/src/communication/communication.controller.ts', 'utf8');
const dispatch = fs.readFileSync('server/src/communication/communication-dispatch.service.ts', 'utf8');
const shellCss = fs.readFileSync('ui/shell/shell.css', 'utf8');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(masterChat.includes('appShell,'), 'Master chat must import the shared Book appShell.');
expect(masterChat.includes("className = ''") && masterChat.includes("root.innerHTML = appShell({ header, body, media: '', className });"), 'Master chat must render through the shared Book shell.');
expect(masterChat.includes("'app-view-shell--chat'"), 'Master thread/composer view must use the canonical Book chat shell class.');
expect(masterChat.includes('messageThread(') && masterChat.includes('messageComposer('), 'Master chat must use the shared message thread and composer.');
expect(masterChat.includes("messageComposer({ placeholder: 'Написать сообщение...', attachments: true })"), 'Master direct thread must expose the shared Book Chat paperclip.');
expect(masterChat.includes('bindMessageAttachments(form)') && masterChat.includes('body, attachments'), 'Master direct thread must send selected media attachments.');
expect(!masterChat.includes('root.innerHTML = `${header}<div class="form-grid">'), 'Master chat must not keep the legacy local chat screen wrapper.');
expect(!masterChat.includes('<style>') && !masterChat.includes("document.createElement('style')"), 'Master chat must not own local styles.');

expect(clientChat.includes("className: 'app-view-shell--chat'"), 'Client chat must use the canonical Book chat shell class.');
expect(clientChat.includes('messageThread(messages') && clientChat.includes('messageComposer({ attachments: true })'), 'Client chat must use the shared message thread and composer with attachments.');
expect(!clientChat.includes('<style>') && !clientChat.includes("document.createElement('style')"), 'Client chat must not own local styles.');

expect(chatApi.includes('attachments = []') && chatApi.includes('body, attachments'), 'Master communication API must carry attachments.');
expect(controller.includes('attachments?: unknown'), 'Master chat controller must accept attachments.');
expect(dispatch.includes('Array.isArray(input?.attachments)') && dispatch.includes("channel: 'IN_APP'") && dispatch.includes('attachments,'), 'Master media messages must be persisted into the shared Book chat thread.');

expect(shellCss.includes('.app-content.app-content--shell{padding:0}'), 'Shared shell CSS must neutralize outer master page padding for Book shell views.');
expect(shellCss.includes('.app-view-shell--chat') && shellCss.includes('.message-composer{position:fixed'), 'Shared shell CSS must remain the single geometry owner for Book Chat.');

if (failures.length) {
  failures.forEach((message) => console.error(`chat ui ownership: ${message}`));
  process.exit(1);
}

console.log('chat ui ownership check: OK');
