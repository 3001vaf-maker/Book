import { ensureBusinessState } from './business-state.js';
import { ensureOperationalState } from './operational-state.js';
import { ensureAuxiliaryState } from './auxiliary-state.js';
import { ensureTenantDocumentArchive } from './tenant-document-archive.js';

function ensureAll(loaders = []) {
  return Promise.all(loaders.map((load) => load())).then(() => undefined);
}

export function ensureProfessionalFeatureState(section = '', secondary = '') {
  const root = String(section || '').trim();
  const child = String(secondary || '').trim();

  if (root === 'people' || root === 'chat') return ensureBusinessState();
  if (root === 'journal') return ensureAll([ensureBusinessState, ensureOperationalState, ensureAuxiliaryState]);
  if (root === 'timetable') return ensureAll([ensureBusinessState, ensureOperationalState]);
  if (root === 'service') return ensureAll([ensureBusinessState, ensureOperationalState, ensureAuxiliaryState]);
  if (root === 'finance') return ensureAll([ensureBusinessState, ensureAuxiliaryState]);
  if (root === 'loyalty') return ensureAll([ensureBusinessState, ensureAuxiliaryState]);

  if (root === 'settings') {
    if (child === 'online-booking') return ensureOperationalState();
    if (child === 'documents') return ensureTenantDocumentArchive();
    if (child === 'tags') return ensureAuxiliaryState();
  }

  return Promise.resolve();
}
