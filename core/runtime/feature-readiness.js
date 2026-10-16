import { ensureBusinessState } from './business-state.js';
import { ensureOperationalState } from './operational-state.js';
import { ensureAuxiliaryState } from './auxiliary-state.js';
import { ensureTenantDocumentArchive } from './tenant-document-archive.js';
import { activateServerBookingSyncScopes } from '../../online-booking/server-sync.js';

async function ensureFeature(loaders = [], scopes = []) {
  await Promise.all(loaders.map((load) => load()));
  activateServerBookingSyncScopes(scopes);
}

export function ensureProfessionalFeatureState(section = '', secondary = '') {
  const root = String(section || '').trim();
  const child = String(secondary || '').trim();

  if (root === 'people' || root === 'chat') {
    return ensureFeature([ensureBusinessState], ['business']);
  }
  if (root === 'journal') {
    return ensureFeature(
      [ensureBusinessState, ensureOperationalState, ensureAuxiliaryState],
      ['business', 'operational', 'auxiliary', 'finance'],
    );
  }
  if (root === 'timetable') {
    return ensureFeature([ensureBusinessState, ensureOperationalState], ['business', 'operational']);
  }
  if (root === 'service') {
    return ensureFeature(
      [ensureBusinessState, ensureOperationalState, ensureAuxiliaryState],
      ['business', 'operational', 'auxiliary', 'finance'],
    );
  }
  if (root === 'finance') {
    return ensureFeature([ensureBusinessState, ensureAuxiliaryState], ['business', 'auxiliary', 'finance']);
  }
  if (root === 'loyalty') {
    return ensureFeature([ensureBusinessState, ensureAuxiliaryState], ['business', 'auxiliary', 'finance']);
  }

  if (root === 'settings') {
    if (child === 'online-booking') {
      return ensureFeature([ensureOperationalState], ['operational']);
    }
    if (child === 'documents') {
      return ensureFeature([ensureTenantDocumentArchive], ['documents']);
    }
    if (child === 'tags') {
      return ensureFeature([ensureAuxiliaryState], ['auxiliary', 'finance']);
    }
  }

  return Promise.resolve();
}
