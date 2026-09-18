import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const core = readFileSync('core.js', 'utf8');
const legalService = readFileSync('server/src/legal-runtime/legal-runtime.service.ts', 'utf8');
const documentService = readFileSync('server/src/document-state/document-state.service.ts', 'utf8');

const authenticated = core.slice(
  core.indexOf('async function renderAuthenticated'),
  core.indexOf('function renderLogin', core.indexOf('async function renderAuthenticated')),
);

assert.doesNotMatch(authenticated, /tenantLegalRequest\('\/readiness'\)/);
assert.doesNotMatch(authenticated, /reportStartupFailure\('legal'/);
assert.match(authenticated, /tenantRuntime = \{ state: \{ operationMode: 'LIVE' \} \}/);
assert.match(authenticated, /initializeProfileWorkplaces/);

const assertionBlock = legalService.slice(
  legalService.indexOf('async assertPlatformLegalReady'),
  legalService.indexOf('async publishDocument'),
);
assert.doesNotMatch(assertionBlock, /POLICY_DENY/);
assert.doesNotMatch(assertionBlock, /Нет действующего согласия/);
assert.doesNotMatch(assertionBlock, /LEGAL_READY[^\n]*throw/);
assert.doesNotMatch(assertionBlock, /operationMode !== 'LIVE'/);
assert.doesNotMatch(assertionBlock, /online_booking\.access/);

assert.match(documentService, /async publicDocuments/);
assert.match(documentService, /BusinessDocumentState|businessDocumentState/);

console.log('runtime unblocked tests: OK');
