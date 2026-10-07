import { apiRequest } from '../auth.js';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

async function responseJson(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

export async function loadLoyaltyServerState() {
  return responseJson(await apiRequest('/loyalty-state'), 'Не удалось загрузить Лояльность');
}

let writeChain = Promise.resolve();

export function queueLoyaltyState(value = {}) {
  const snapshot = clone(value) || {};
  writeChain = writeChain
    .catch(() => null)
    .then(async () => {
      const result = await responseJson(await apiRequest('/loyalty-state', {
        method: 'PUT',
        body: JSON.stringify({ value: snapshot }),
      }), 'Не удалось сохранить Лояльность');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('book:server-mutation-completed', {
          detail: { scopes: ['loyalty'] },
        }));
      }
      return result;
    })
    .catch((error) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('book:business-persistence-error', {
          detail: { message: error instanceof Error ? error.message : 'Не удалось сохранить Лояльность' },
        }));
      }
      throw error;
    });
  return writeChain;
}

export async function flushLoyaltyPersistence() {
  await writeChain;
}
