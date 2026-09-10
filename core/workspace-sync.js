import { apiRequest } from './auth.js';

const CLEAN_START_KEY = 'book.production.clean.v2';
const SYNC_INTERVAL_MS = 4000;
let lastSerialized = '';
let syncing = false;
let timer = null;

function isWorkspaceKey(key) {
  return (key.startsWith('book.') || key.startsWith('book:')) && key !== CLEAN_START_KEY;
}

function snapshot() {
  const data = {};
  Object.keys(localStorage)
    .filter(isWorkspaceKey)
    .sort()
    .forEach((key) => { data[key] = localStorage.getItem(key); });
  return data;
}

function serialized(data) {
  return JSON.stringify(data || {});
}

function storedValueWeight(raw) {
  if (typeof raw !== 'string' || !raw) return 0;
  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Math.max(1, Object.keys(value).length);
    return value ? 1 : 0;
  } catch {
    return raw.trim() ? 1 : 0;
  }
}

function workspaceStrength(data) {
  return Object.values(data || {}).reduce((sum, raw) => sum + storedValueWeight(raw), 0);
}

function hasWorkspaceData(data) {
  return workspaceStrength(data) > 0;
}

function applySnapshot(data) {
  Object.keys(localStorage)
    .filter(isWorkspaceKey)
    .forEach((key) => localStorage.removeItem(key));
  Object.entries(data || {}).forEach(([key, value]) => {
    if (!isWorkspaceKey(key) || typeof value !== 'string') return;
    localStorage.setItem(key, value);
  });
  lastSerialized = serialized(snapshot());
  window.dispatchEvent(new CustomEvent('book:workspace-synced'));
}

async function fetchRemote() {
  const response = await apiRequest('/workspace/state');
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Не удалось загрузить рабочие данные');
  return response.json();
}

async function push(data) {
  const response = await apiRequest('/workspace/state', {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });
  if (!response.ok) throw new Error('Не удалось сохранить рабочие данные');
  const payload = await response.json();
  lastSerialized = serialized(data);
  return payload;
}

export async function syncWorkspaceBeforeRender() {
  const local = snapshot();
  const remote = await fetchRemote();
  const remoteData = remote?.data && typeof remote.data === 'object' && !Array.isArray(remote.data) ? remote.data : null;

  if (remoteData) {
    const firstServerRevision = Number(remote.revision || 0) <= 1;
    if (firstServerRevision && workspaceStrength(local) > workspaceStrength(remoteData)) {
      const saved = await push(local);
      return { source: 'local-bootstrap-replaced-empty-server', revision: saved?.revision || 2 };
    }
    applySnapshot(remoteData);
    return { source: 'server', revision: remote.revision || 0 };
  }

  if (hasWorkspaceData(local)) {
    const saved = await push(local);
    return { source: 'local-bootstrap', revision: saved?.revision || 1 };
  }

  lastSerialized = serialized(local);
  return { source: 'empty', revision: 0 };
}

async function syncChangedLocalState() {
  if (syncing) return;
  const current = snapshot();
  const currentSerialized = serialized(current);
  if (currentSerialized === lastSerialized) return;

  syncing = true;
  try {
    await push(current);
  } finally {
    syncing = false;
  }
}

export function startWorkspaceSync() {
  if (timer) return () => stopWorkspaceSync();
  lastSerialized = serialized(snapshot());
  timer = window.setInterval(() => {
    syncChangedLocalState().catch(() => {});
  }, SYNC_INTERVAL_MS);
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') syncChangedLocalState().catch(() => {});
  };
  const onPageHide = () => syncChangedLocalState().catch(() => {});
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    stopWorkspaceSync();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
  };
}

function stopWorkspaceSync() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
