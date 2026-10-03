import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const documents = readFileSync(new URL('../settings/documents/documents.js', import.meta.url), 'utf8');
const documentUi = readFileSync(new URL('../ui/documents/index.js', import.meta.url), 'utf8');
const documentCss = readFileSync(new URL('../ui/documents/document.css', import.meta.url), 'utf8');

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
assert.match(documents, /data-document-content-open/);
assert.match(documents, /data-document-detail-settings/);
assert.doesNotMatch(documents, /pageHeader|folderList|\blist\s*\(/);
assert.doesNotMatch(documents, /entity-page-header|page-header-action/);

assert.match(documentUi, /export function documentTile/);
assert.match(documentUi, /export function documentTiles/);
assert.match(documentUi, /export function openDocumentViewer/);
assert.match(documentCss, /\.document-tile\{/);
assert.match(documentCss, /width:238px/);
assert.match(documentCss, /border-radius:0/);
assert.match(documentCss, /\.document-tiles--rail/);
assert.match(documentCss, /\.document-viewer-backdrop\{background:#111/);
assert.doesNotMatch(documentCss, /linear-gradient|radial-gradient/);

console.log('documents UI architecture tests: OK');
