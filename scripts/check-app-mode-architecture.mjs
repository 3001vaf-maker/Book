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

requireText(registry, "PROFESSIONAL: 'professional'", 'professional mode must stay registered');
requireText(registry, "CONSUMER: 'consumer'", 'consumer mode must stay registered');
requireText(registry, "MESSENGER: 'messenger'", 'messenger mode must stay registered');
requireText(registry, "SOCIAL: 'social'", 'future social mode must stay reserved');
requireText(registry, 'origin: APP_ORIGIN', 'professional mode must use APP_ORIGIN');
requireText(registry, 'origin: USER_ORIGIN', 'consumer mode must use USER_ORIGIN');
requireText(registry, "kind: 'embedded'", 'messenger must remain an embedded mode for now');
requireText(registry, "label: 'Соцсеть'", 'future social mode label must stay reserved');
requireText(registry, "visible: false", 'future social mode must not become dead visible UI before implementation');
requireText(registry, 'force = false', 'domain mode switching must support an explicit same-domain return from messenger');

requireText(header, "role === 'd' ? 'mode'", 'D must be forced to the canonical mode control');
requireText(header, 'data-app-mode-switch', 'D must expose the mode-switch hook');
requireText(header, 'data-app-mode-source-kind', 'D must retain its legacy source only for controlled compatibility');
requireText(header, 'Переключить режим', 'D must identify itself as the application mode switch');

requireText(switchUi, 'visibleAppModes()', 'mode picker must come from the shared registry');
requireText(switchUi, "variant: 'x'", 'mode picker must use the canonical X modal');
requireText(switchUi, 'switchDomainAppMode(mode, { force: returningFromMessenger })', 'domain transitions must go through the shared mode registry');
requireText(switchUi, 'returningFromMessenger', 'selecting the host domain from messenger must leave messenger instead of becoming a no-op');
requireText(switchUi, "APP_MODE_IDS.MESSENGER", 'mode picker must own the messenger transition');
rejectText(switchUi, 'accessToken', 'mode switching must not leak access tokens through UI navigation');
rejectText(switchUi, 'refreshToken', 'mode switching must not leak refresh tokens through UI navigation');
rejectText(switchUi, '?token=', 'mode switching must not put authentication tokens in URLs');

requireText(chatUi, 'const externalAttachmentTrigger = false;', 'attachments must remain inside the message composer instead of occupying D');
requireText(chatRuntime, "const d = { kind: 'mode'", 'chat list/thread D must remain a mode switch');
rejectText(chatRuntime, 'data-chat-attachment', 'shared chat runtime must not take D back for attachments');

if (!process.exitCode) console.log('APP MODE ARCHITECTURE: OK');
