import { apiRequest } from './core/auth.js';
import { hydrateFinanceFromServer } from './core/finance/index.js';
import { hydrateProductsFromServer } from './settings/service/products/data.js';
import { hydrateTagsFromServer } from './settings/tags/data.js';
import { hydrateWalletsFromServer } from './settings/wallets/data.js';

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

async function responseJson(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

function hydrateAuxiliary(value) {
  const bundle = normalize(value);
  hydrateWalletsFromServer(bundle.wallets);
  hydrateTagsFromServer(bundle.tags);
  hydrateProductsFromServer({ products: bundle.products, productHistory: bundle.productHistory });
}

async function hydrateCanonicalFinance() {
  const response = await apiRequest('/finance');
  const finance = await responseJson(response, 'Не удалось загрузить Финансы');
  hydrateFinanceFromServer(finance);
}

export async function initializeAuxiliaryState(account = {}) {
  const response = await apiRequest('/auxiliary-state');
  const remote = await responseJson(response, 'Не удалось загрузить Финансы и связанные данные');

  if (remote?.verified) {
    hydrateAuxiliary(remote);
    await hydrateCanonicalFinance();
    return { source: 'server', verified: true };
  }

  if (remote?.migrated || account?.user?.workspaceUnlocked) {
    return { source: 'server-awaiting-verification', verified: false };
  }

  const bootstrapResponse = await apiRequest('/auxiliary-state/bootstrap', { method: 'POST' });
  const bootstrapped = await responseJson(bootstrapResponse, 'Не удалось создать серверное хранилище Финансов');
  if (!bootstrapped?.verified) throw new Error('Серверное хранилище Финансов не подтверждено');
  hydrateAuxiliary(bootstrapped);
  await hydrateCanonicalFinance();
  return { source: 'server-bootstrap', verified: true };
}
