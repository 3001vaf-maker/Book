import { apiRequest } from './core/auth.js';
import { hydrateFinanceFromServer, readLegacyFinanceSnapshot } from './core/finance/data.js';
import { hydrateProductsFromServer, readLegacyProductSnapshot } from './settings/service/products/data.js';
import { hydrateTagsFromServer, readLegacyTagSnapshot } from './settings/tags/data.js';
import { hydrateWalletsFromServer, readLegacyWalletSnapshot } from './settings/wallets/data.js';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalize(value = {}) {
  return {
    finance: value.finance && typeof value.finance === 'object' && !Array.isArray(value.finance) ? clone(value.finance) : null,
    wallets: Array.isArray(value.wallets) ? clone(value.wallets) : [],
    tags: Array.isArray(value.tags) ? clone(value.tags) : [],
    products: Array.isArray(value.products) ? clone(value.products) : [],
    productHistory: Array.isArray(value.productHistory) ? clone(value.productHistory) : [],
  };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function canonical(value) {
  return JSON.stringify(stable(normalize(value)));
}

function same(left, right) {
  return canonical(left) === canonical(right);
}

function legacyBundle() {
  const finance = readLegacyFinanceSnapshot();
  const wallets = readLegacyWalletSnapshot();
  const tags = readLegacyTagSnapshot();
  const products = readLegacyProductSnapshot();
  return {
    value: normalize({
      finance: finance.finance,
      wallets: wallets.wallets,
      tags: tags.tags,
      products: products.products,
      productHistory: products.productHistory,
    }),
    present: Boolean(finance.present || wallets.present || tags.present || products.present),
  };
}

async function responseJson(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

function hydrate(value) {
  const bundle = normalize(value);
  hydrateFinanceFromServer(bundle.finance);
  hydrateWalletsFromServer(bundle.wallets);
  hydrateTagsFromServer(bundle.tags);
  hydrateProductsFromServer({ products: bundle.products, productHistory: bundle.productHistory });
}

async function verify(local, remote) {
  if (!same(local, remote)) throw new Error('Финансы, кошельки, ярлыки и товары на сервере не совпадают с данными браузера');
  const response = await apiRequest('/auxiliary-state/migrate/verify', {
    method: 'POST',
    body: JSON.stringify(local),
  });
  const verified = await responseJson(response, 'Не удалось подтвердить перенос Финансов и связанных данных');
  if (!verified?.verified || !same(local, verified)) throw new Error('Сервер не подтвердил точность переноса Финансов и связанных данных');
  return verified;
}

export async function initializeAuxiliaryState(account = {}) {
  const legacy = legacyBundle();
  const local = legacy.value;
  const response = await apiRequest('/auxiliary-state');
  const remote = await responseJson(response, 'Не удалось загрузить Финансы и связанные данные');

  if (remote?.verified) {
    hydrate(remote);
    return { source: 'server', verified: true };
  }

  if (remote?.migrated) {
    if (!legacy.present) return { source: 'server-awaiting-verification', verified: false };
    const verified = await verify(local, remote);
    hydrate(verified);
    return { source: 'legacy-verified', verified: true };
  }

  if (legacy.present) {
    const migrateResponse = await apiRequest('/auxiliary-state/migrate', {
      method: 'POST',
      body: JSON.stringify(local),
    });
    const migrated = await responseJson(migrateResponse, 'Не удалось перенести Финансы и связанные данные');
    if (!same(local, migrated)) throw new Error('Перенос Финансов остановлен: серверная копия не прошла сверку');
    const verified = await verify(local, migrated);
    hydrate(verified);
    return { source: 'legacy-migrated', verified: true };
  }

  if (account?.user?.workspaceUnlocked) return { source: 'awaiting-populated-browser', verified: false };

  const bootstrapResponse = await apiRequest('/auxiliary-state/bootstrap', { method: 'POST' });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище Финансов');
  if (!bootstrapped?.verified) throw new Error('Серверное хранилище Финансов не подтверждено');
  hydrate(bootstrapped);
  return { source: 'server-bootstrap', verified: true };
}
