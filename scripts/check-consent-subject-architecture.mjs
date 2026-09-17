import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];

const policy = read('server/src/document-state/consent-policy.service.ts');
const documentService = read('server/src/document-state/document-state.service.ts');
const documentController = read('server/src/document-state/document-state.controller.ts');
const bookingController = read('server/src/online-booking/booking-consent.controller.ts');
const bookingGuard = read('server/src/online-booking/booking-required-consent.guard.ts');
const bookingService = read('server/src/online-booking/online-booking.service.ts');
const clientProjection = read('main/clients/data.js');
const browserConsents = read('settings/documents/consents.js');
const migration = read('server/prisma/migrations/20260915130000_canonical_consent_subjects/migration.sql');
const architecture = read('docs/DOCUMENTS_ARCHITECTURE.md');

const migrationStart = policy.indexOf('/**\n   * One-time conversion');
const activeStart = policy.indexOf('  async acceptAccountConsents');
if (migrationStart < 0 || activeStart < 0 || activeStart <= migrationStart) {
  failures.push('ConsentPolicy must isolate historical clientId handling inside the one-time migration block.');
} else {
  const activePolicy = `${policy.slice(0, migrationStart)}\n${policy.slice(activeStart)}`;
  if (/\bclientId\b/.test(activePolicy)) failures.push('Active ConsentPolicy must never use clientId as a consent subject.');
}

for (const [name, source] of [
  ['DocumentStateController', documentController],
  ['BookingConsentController', bookingController],
  ['BookingRequiredConsentGuard', bookingGuard],
  ['OnlineBookingService', bookingService],
  ['browser consent projection', browserConsents],
]) {
  if (/\bclientId\b/.test(source)) failures.push(`${name} must not use clientId for consent.`);
}

if (/recordAcceptedConsents|clientConsentProjection|revokeConsent\s*\(/.test(policy + documentService + bookingService)) {
  failures.push('Legacy client-card consent APIs must not exist in active server code.');
}
if (/recordConsent|migrateLegacyConsents|configureConsentPersistence/.test(browserConsents)) {
  failures.push('Browser consent module must be read-only and canonical.');
}
if (!clientProjection.includes('getLatestAccountConsent')) {
  failures.push('Client PD agreement display must be a projection from canonical booking-account consent subjects.');
}
if (clientProjection.includes('getLatestContactConsent')) {
  failures.push('Legacy contact-point consent must not be projected as an active mailing permission.');
}
if (!migration.includes('CREATE TABLE "ConsentEvent"') || !migration.includes('"consentMigratedAt"')) {
  failures.push('Canonical append-only ConsentEvent storage and one-time migration marker are required.');
}
if (!architecture.includes('`clientId` / `Person.key` is **not a consent subject**')) {
  failures.push('Documents architecture must permanently forbid clientId as a consent subject.');
}

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('consent subject architecture check: OK');
