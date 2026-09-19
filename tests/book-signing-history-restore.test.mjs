import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getConsents,
  hydrateConsentsFromServer,
} from '../settings/documents/consents.js';
import {
  getDocumentHistory,
  hydrateDocumentHistoryFromServer,
} from '../settings/documents/history.js';

hydrateConsentsFromServer([
  {
    id: 'legacy-event',
    legacySubjectKey: 'legacy-1',
    documentId: 'pdn-consent',
    documentVersion: 1,
    status: 'accepted',
    acceptedAt: '2026-09-18T10:00:00.000Z',
  },
  {
    id: 'canonical-event',
    subjectType: 'ACCOUNT',
    subjectKey: 'account-1',
    documentId: 'pdn-consent',
    documentVersion: 2,
    status: 'accepted',
    acceptedAt: '2026-09-18T12:00:00.000Z',
    eventAt: '2026-09-18T12:00:00.000Z',
  },
]);

const consents = getConsents();
assert.equal(consents.length, 1, 'Frontend must consume canonical consent events only');
assert.equal(consents[0].subjectType, 'ACCOUNT');
assert.equal(consents[0].subjectKey, 'account-1');
assert.equal(consents[0].documentVersion, 2);

hydrateDocumentHistoryFromServer([
  {
    id: 'history-v2',
    documentId: 'pdn-consent',
    documentTitle: 'Согласие на обработку персональных данных',
    documentVersion: 2,
    action: 'version-created',
    createdAt: '2026-09-18T11:00:00.000Z',
    snapshot: {
      id: 'pdn-consent',
      title: 'Согласие на обработку персональных данных',
      version: 2,
      text: 'Именно этот полный текст был показан и подписан.',
    },
  },
]);

const history = getDocumentHistory();
assert.equal(history[0].snapshot.text, 'Именно этот полный текст был показан и подписан.');

const server = readFileSync(new URL('../server/src/tenant-document-archive/tenant-document-archive.service.ts', import.meta.url), 'utf8');
assert.match(server, /FROM "TenantConsentEvent"/);
assert.match(server, /const consents = state\?\.migrationVerifiedAt \? await this\.canonicalConsentEvents\(tenantId\) : \[\]/);
assert.match(server, /data: \{ \.\.\.stored, consents \}/);
assert.doesNotMatch(server, /source\.consents/);
assert.doesNotMatch(server, /migratedFromEventId/);

const policy = readFileSync(new URL('../server/src/tenant-document-archive/consent-policy.service.ts', import.meta.url), 'utf8');
assert.doesNotMatch(policy, /ensureCanonicalConsentEvents/);
assert.doesNotMatch(policy, /migratedFromEventId/);

const ui = readFileSync(new URL('../settings/documents/documents.js', import.meta.url), 'utf8');
assert.match(ui, /signedDocumentSnapshot/);
assert.match(ui, /data-signed-document-event/);
assert.match(ui, /openSignedDocument/);

const migration = readFileSync(new URL('../server/prisma/migrations/20260915130000_canonical_consent_subjects/migration.sql', import.meta.url), 'utf8');
assert.match(migration, /CREATE TABLE "ConsentEvent"/);

console.log('Book signing history restore tests: OK');
