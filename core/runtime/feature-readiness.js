import { ensureBusinessState } from './business-state.js';
import { ensureOperationalState } from './operational-state.js';
import { ensureAuxiliaryState } from './auxiliary-state.js';
import { ensureRknGuide, ensureTenantDocumentArchive, refreshTenantDocumentArchive } from './tenant-document-archive.js';
import { activateServerBookingSyncScopes } from '../../online-booking/server-sync.js';

async function ensureFeature(loaders = [], scopes = []) {
  await Promise.all(loaders.map((load) => load()));
  activateServerBookingSyncScopes(scopes);
}

async function ensureSettingsDocuments() {
  await ensureTenantDocumentArchive();
  try {
    const result = await ensureRknGuide();
    if (result?.ready) await refreshTenantDocumentArchive();
  } catch (error) {
    console.error('RKN guide sync failed', error);
  }
}

export function ensureProfessionalFeatureState(section = '', secondary = '') {
  const root = String(section || '').trim();
  const child = String(secondary || '').trim();

  if (root === 'people') {
    return ensureFeature(
      [ensureBusinessState, ensureTenantDocumentArchive],
      ['business', 'documents'],
    );
  }
  if (root === 'chat') {
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
      return ensureFeature([ensureSettingsDocuments], ['documents']);
    }
    if (child === 'tags') {
      return ensureFeature([ensureAuxiliaryState], ['auxiliary', 'finance']);
    }
  }

  return Promise.resolve();
}
