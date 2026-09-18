import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const core = readFileSync('core.js', 'utf8');
const appModule = readFileSync('server/src/app.module.ts', 'utf8');
const bookingController = readFileSync('server/src/online-booking/online-booking.controller.ts', 'utf8');
const documentService = readFileSync('server/src/document-state/document-state.service.ts', 'utf8');

const authenticated = core.slice(
  core.indexOf('async function renderAuthenticated'),
  core.indexOf('function renderLogin', core.indexOf('async function renderAuthenticated')),
);

assert.doesNotMatch(authenticated, /tenantLegalRequest\('\/readiness'\)/);
assert.doesNotMatch(authenticated, /reportStartupFailure\('legal'/);
assert.match(authenticated, /initializeProfileWorkplaces/);

assert.equal(existsSync('server/src/legal-runtime/legal-runtime.service.ts'), false);
assert.equal(existsSync('server/src/legal-runtime/legal-runtime.module.ts'), false);
assert.equal(existsSync('server/src/online-booking/booking-publication.guard.ts'), false);
assert.equal(existsSync('server/src/online-booking/booking-required-consent.guard.ts'), false);
assert.doesNotMatch(appModule, /LegalRuntimeModule/);
assert.doesNotMatch(bookingController, /BookingPublicationGuard|BookingRequiredConsentGuard|owner\/publication/);

assert.match(documentService, /async publicDocuments/);
assert.match(documentService, /BusinessDocumentState|businessDocumentState/);

console.log('runtime unblocked tests: OK');
