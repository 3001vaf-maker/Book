import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const documents = readFileSync(new URL('../settings/documents/documents.js', import.meta.url), 'utf8');
const documentUi = readFileSync(new URL('../ui/documents/index.js', import.meta.url), 'utf8');
const documentCss = readFileSync(new URL('../ui/documents/document.css', import.meta.url), 'utf8');
const people = readFileSync(new URL('../core/people/people.js', import.meta.url), 'utf8');

assert.match(documents, /workspaceHeaderContext/);
assert.match(documents, /segmentControl\(VIEWS/);
assert.match(documents, /documentTile\(/);
assert.match(documents, /documentTiles\(/);
assert.match(documents, /readOnlyReceipt\(/);
assert.match(documents, /variant: 'bottom'/);
assert.match(documents, /data-open-document-templates/);
assert.match(documents, /data-add-profile-document/);
assert.match(documents, /data-v2-primary-visible="false"/);
assert.match(documents, /openDocumentViewer/);
assert.match(documents, /document-group--core/);
assert.match(documents, /document-group--other/);
assert.match(documents, /document-group--other[\s\S]*?layout: 'rail'/);
assert.match(documents, /data-document-content-open/);
assert.match(documents, /data-document-detail-settings/);
assert.match(documents, /data-signing-info/);
assert.match(documents, /variant: 'top'/);
const signingDetail = documents.slice(documents.indexOf('function openSigningDetail'), documents.indexOf('function renderTemplatesLayer'));
assert.doesNotMatch(signingDetail, /readOnlyReceipt|mountV2ZLayer|data-signing-document-open/);
assert.doesNotMatch(documents, /pageHeader|folderList|\blist\s*\(/);
assert.doesNotMatch(documents, /entity-page-header|page-header-action/);

assert.match(documentUi, /export function documentTile/);
assert.match(documentUi, /export function documentTiles/);
assert.match(documentUi, /export function openDocumentViewer/);
assert.match(documentUi, /toggleData = ''/);
assert.match(documentUi, /document-tile--controlled/);
assert.match(documentUi, /document-tile__toggle/);
assert.match(documentUi, /aria-pressed/);
assert.doesNotMatch(documentUi, /document-tile__status[^\n]*<small>/);
assert.match(documentCss, /\.document-tile\{/);
assert.match(documentCss, /width:238px/);
assert.match(documentCss, /border-radius:10px/);
assert.match(documentCss, /\.document-tiles--rail/);
assert.match(documentCss, /\.document-tile--controlled/);
assert.match(documentCss, /\.document-tile__toggle/);
assert.match(documentCss, /\.documents-content\{margin-top:16px\}/);
assert.match(documentCss, /\.document-tile__status\.is-signed[\s\S]*?background:#fff/);
assert.match(documentCss, /\.document-viewer-backdrop\{background:#111/);
assert.doesNotMatch(documentCss, /linear-gradient|radial-gradient/);

console.log('documents UI architecture tests: OK');

const peopleConsentTile = people.slice(
  people.indexOf('function personConsentTile'),
  people.indexOf('function openPersonConsent'),
);
const peopleConsentBlock = people.slice(
  people.indexOf('function settingsCards'),
  people.indexOf('function refreshPersonIdentityPresentation'),
);
assert.match(peopleConsentTile, /documentTile\(/);
assert.match(peopleConsentBlock, /documentTiles\(/);
assert.doesNotMatch(peopleConsentBlock, /miniCard\(\{[\s\S]*?data-person-consent/);
