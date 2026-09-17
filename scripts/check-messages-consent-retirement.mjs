import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const scanRoots = ['server/src', 'main', 'settings', 'online-booking', 'core', 'chat'];
const legacyAllowed = new Set([
  'server/src/document-state/consent-policy.service.ts',
  'server/src/document-state/document-state.service.ts',
]);

function filesUnder(relative) {
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) return [];
  const result = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(child));
    else if (/\.(?:js|mjs|ts)$/.test(entry.name)) result.push(child.replaceAll('\\', '/'));
  }
  return result;
}

const activeFiles = scanRoots.flatMap(filesUnder);
const failures = [];

for (const file of activeFiles) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (source.includes('messages-consent') && !legacyAllowed.has(file)) {
    failures.push(`${file}: active code still references messages-consent`);
  }
  if (file !== 'server/src/document-state/consent-policy.service.ts' && source.includes('.canSendMessages(')) {
    failures.push(`${file}: active sender still calls legacy canSendMessages()`);
  }
  if (file !== 'server/src/document-state/consent-policy.service.ts'
      && (source.includes('acceptContactPointConsent(') || source.includes('revokeContactPointConsent('))) {
    failures.push(`${file}: active code still creates/revokes legacy contact-point consent`);
  }
}

const defaultDocuments = fs.readFileSync(path.join(ROOT, 'settings/documents/data.js'), 'utf8');
if (defaultDocuments.includes('messages-consent')) failures.push('settings/documents/data.js: retired consent is still a default document');

const documentState = fs.readFileSync(path.join(ROOT, 'server/src/document-state/document-state.service.ts'), 'utf8');
if (!documentState.includes("RETIRED_ACTIVE_DOCUMENT_IDS = new Set(['messages-consent'])")) {
  failures.push('DocumentStateService does not explicitly hide messages-consent from active document projections');
}

const broadcast = fs.readFileSync(path.join(ROOT, 'server/src/communication/communication-broadcast.service.ts'), 'utf8');
if (!broadcast.includes('MarketingConsentService')) failures.push('Broadcasts are not wired to MarketingConsentService');
if (!broadcast.includes("purpose: 'MARKETING'")) failures.push('Broadcast dispatch does not declare MARKETING purpose explicitly');

const telegram = fs.readFileSync(path.join(ROOT, 'server/src/communication/telegram-bot.service.ts'), 'utf8');
if (!telegram.includes("purpose: 'DIALOG'")) failures.push('Telegram dialog path does not declare DIALOG purpose');

const serviceNotifications = fs.readFileSync(path.join(ROOT, 'server/src/notification/legal-notification.service.ts'), 'utf8');
if (!serviceNotifications.includes("purpose: 'SERVICE'")) failures.push('Service notification delivery does not declare SERVICE purpose');

if (failures.length) {
  console.error('messages-consent retirement check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('messages-consent retirement check: OK');
