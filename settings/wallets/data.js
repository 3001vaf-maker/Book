import { getWalletDDSMovements } from '../../core/finance/index.js';
import { queueAuxiliaryDataset } from '../../core/business-persistence.js';

const KEY = 'book.wallets';
const SYSTEM_WALLETS = [
  { id: 'cash', name: 'Наличные', photo: '', system: true },
  { id: 'cashless', name: 'Безналичные', photo: '', system: true },
];
let walletsState = null;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readLegacy(fallback) {
  try { return JSON.parse(localStorage.getItem(KEY) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function readRaw() {
  const value = walletsState === null ? readLegacy(null) : walletsState;
  return Array.isArray(value) ? clone(value) : null;
}

function write(value) {
  const normalized = Array.isArray(value) ? clone(value) : [];
  if (walletsState === null) localStorage.setItem(KEY, JSON.stringify(normalized));
  else {
    walletsState = normalized;
    void queueAuxiliaryDataset('wallets', walletsState);
  }
}

export function readLegacyWalletSnapshot() {
  const present = localStorage.getItem(KEY) != null;
  const value = readLegacy([]);
  return { present, wallets: Array.isArray(value) ? clone(value) : [] };
}

export function hydrateWalletsFromServer(value = []) {
  walletsState = Array.isArray(value) ? clone(value) : [];
  return clone(walletsState);
}

export function getWallets() {
  const stored = readRaw();
  if (!Array.isArray(stored) || !stored.length) {
    write(SYSTEM_WALLETS);
    return SYSTEM_WALLETS.map((wallet) => ({ ...wallet }));
  }
  const ids = new Set(stored.map((wallet) => String(wallet?.id || '')));
  const withSystem = [
    ...SYSTEM_WALLETS.filter((wallet) => !ids.has(wallet.id)),
    ...stored,
  ];
  if (withSystem.length !== stored.length) write(withSystem);
  return withSystem.filter((wallet) => !wallet.deletedAt).map((wallet) => ({ ...wallet }));
}

export function getWalletHistory(id) {
  return getWalletDDSMovements(id);
}

export function getWalletBalance(id) {
  return getWalletHistory(id).reduce((sum, movement) => {
    const value = Number(movement?.total);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export function getWalletTotalBalance() {
  return getWallets().reduce((sum, wallet) => sum + getWalletBalance(wallet.id), 0);
}

export function saveWallet(wallet) {
  const values = getWallets();
  const exists = values.some((item) => item.id === wallet.id);
  write(exists ? values.map((item) => item.id === wallet.id ? wallet : item) : [...values, wallet]);
  return wallet;
}

export function updateWallet(id, patch) {
  const values = getWallets();
  const current = values.find((item) => item.id === id);
  if (!current) return null;
  const updated = { ...current, ...patch, id: current.id, system: Boolean(current.system), updatedAt: new Date().toISOString() };
  write(values.map((item) => item.id === id ? updated : item));
  return updated;
}

export function deleteWallet(id) {
  const values = getWallets();
  const current = values.find((item) => item.id === id);
  if (!current || current.system) return false;
  const deletedAt = new Date().toISOString();
  write(values.map((item) => item.id === id ? { ...item, deletedAt, updatedAt: deletedAt } : item));
  return true;
}
