const pending = new Map();

export const PROFESSIONAL_RUNTIME_PRELOADS = Object.freeze({
  profile: 'profile',
  business: 'business-state',
  operational: 'operational-state',
  auxiliary: 'auxiliary-state',
  finance: 'finance',
  access: 'book-access',
  documentBases: 'document-bases',
});

export function startRuntimePreload(key, loader) {
  const id = String(key || '').trim();
  if (!id || typeof loader !== 'function') return null;
  if (pending.has(id)) return pending.get(id);

  const promise = Promise.resolve().then(loader);
  pending.set(id, promise);
  promise.catch(() => {
    if (pending.get(id) === promise) pending.delete(id);
  });
  return promise;
}

export function takeRuntimePreload(key) {
  const id = String(key || '').trim();
  const promise = pending.get(id) || null;
  if (promise) pending.delete(id);
  return promise;
}

export function clearRuntimePreloads() {
  pending.clear();
}
