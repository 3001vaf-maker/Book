const KEY = 'book.wallets';
const SYSTEM_WALLETS = [
  { id: 'cash', name: 'Наличные', photo: '', system: true },
  { id: 'cashless', name: 'Безналичные', photo: '', system: true },
];

function read(fallback) {
  try { return JSON.parse(localStorage.getItem(KEY) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function write(value) {
  localStorage.setItem(KEY, JSON.stringify(value));
}

export function getWallets() {
  const stored = read(null);
  if (!Array.isArray(stored)) {
    write(SYSTEM_WALLETS);
    return SYSTEM_WALLETS.map((wallet) => ({ ...wallet }));
  }
  return stored.filter((wallet) => !wallet.deletedAt);
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
