import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DOCUMENT_CLASS,
  canDeleteDocument,
  canSignDocument,
  inferDocumentClass,
  tracksDocumentVersions,
} from '../settings/documents/policy.js';

const core = { id: 'pdn-consent', personConsent: true };
assert.equal(inferDocumentClass(core), DOCUMENT_CLASS.CORE_LEGAL);
assert.equal(canDeleteDocument(core), false);
assert.equal(tracksDocumentVersions(core), true);
assert.equal(canSignDocument(core), true);

const helper = { id: 'rkn-guide-1', attachment: { type: 'RKN_GUIDE_PDF' } };
assert.equal(inferDocumentClass(helper), DOCUMENT_CLASS.FILE);
assert.equal(canDeleteDocument(helper), true);
assert.equal(tracksDocumentVersions(helper), false);
assert.equal(canSignDocument(helper), false);

const uploaded = { id: 'file-1', attachment: { type: 'USER_PDF' }, signable: false };
assert.equal(inferDocumentClass(uploaded), DOCUMENT_CLASS.FILE);
assert.equal(canDeleteDocument(uploaded), true);
assert.equal(tracksDocumentVersions(uploaded), false);

const contract = { id: 'contract-1', documentClass: DOCUMENT_CLASS.USER_DOCUMENT, signable: true };
assert.equal(canDeleteDocument(contract), true);
assert.equal(tracksDocumentVersions(contract), true);
assert.equal(canSignDocument(contract), true);

const server = readFileSync(new URL('../server/src/tenant-document-archive/tenant-document-archive.service.ts', import.meta.url), 'utf8');
const rknSave = server.slice(server.indexOf('async saveRknGuide'), server.indexOf('async rknGuideDocument'));
assert.match(rknSave, /documentClass: 'FILE'/);
assert.match(rknSave, /signable: false/);
assert.doesNotMatch(rknSave, /current\.history\.push/);
assert.match(server, /helpers: clone\(objectValue\(source\.helpers\)\)/);
assert.match(server, /async rememberRknGuideState/);

const rkn = readFileSync(new URL('../server/src/tenant-document-archive/rkn-guide.service.ts', import.meta.url), 'utf8');
assert.doesNotMatch(rkn, /personalVersion/);
assert.match(rkn, /guideMode/);
assert.match(rkn, /rememberedSnapshot/);
assert.match(rkn, /rememberRknGuideState/);
assert.match(rkn, /return \{ ready: true, document: latestGuide \|\| null \}/);

const consent = readFileSync(new URL('../server/src/tenant-document-archive/consent-policy.service.ts', import.meta.url), 'utf8');
assert.match(consent, /canSignTenantDocument/);
assert.match(consent, /documentClass.*FILE/);

const ui = readFileSync(new URL('../settings/documents/documents.js', import.meta.url), 'utf8');
assert.match(ui, /document-group--core/);
assert.match(ui, /document-group--other/);
assert.match(ui, /data-document-content-open/);
assert.match(ui, /openDocumentDetail/);
const historySource = ui.slice(ui.indexOf('function historyItems'), ui.indexOf('function historyCard'));
assert.doesNotMatch(historySource, /getDocumentHistory/);

console.log('Document lifecycle architecture tests: OK');
