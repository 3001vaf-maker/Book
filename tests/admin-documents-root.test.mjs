import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalogModule = await import('../admin/documents/catalog.js');
const bookDocs = catalogModule.getBookUserDocuments();
const userBases = catalogModule.getUserDocumentBases();

assert.equal(bookDocs.length, 6, 'Admin/Documents must contain exactly 6 Book ↔ user documents');
assert.equal(userBases.length, 3, 'Admin/Documents must contain exactly 3 user document bases');
assert.equal(new Set([...bookDocs, ...userBases].map((item) => item.key)).size, 9, 'Document keys must be unique');

for (const item of [...bookDocs, ...userBases]) {
  assert.ok(item.title?.trim(), `Missing title for ${item.key}`);
  assert.ok(item.content?.trim().length > 500, `Document content is unexpectedly short for ${item.key}`);
}

const admin = readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');
const view = readFileSync(new URL('../admin/documents/view.js', import.meta.url), 'utf8');
const history = readFileSync(new URL('../admin/documents/history.js', import.meta.url), 'utf8');
const appModule = readFileSync(new URL('../server/src/app.module.ts', import.meta.url), 'utf8');

assert.match(admin, /import \{ renderAdminDocuments \} from '\.\/documents\/view\.js'/);
assert.match(admin, /data-section="documents">Документы</);
assert.match(view, /Book ↔ пользователь/);
assert.match(view, /Основы документов пользователя/);
assert.match(view, /История Book/);
assert.match(history, /Company-side history belongs to Admin\/Documents only/);

assert.doesNotMatch(view, /settings\/documents/);
assert.doesNotMatch(history, /settings\/documents/);
assert.doesNotMatch(appModule, /PlatformDocumentsModule|LegalRuntimeModule/);

console.log('Admin/Documents root tests: OK');
