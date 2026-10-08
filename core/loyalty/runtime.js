import { hydrateLoyaltyFromServer } from './data.js';
import { loadLoyaltyServerState } from './persistence.js';

export async function refreshLoyaltyState() {
  const state = await loadLoyaltyServerState();
  return hydrateLoyaltyFromServer(state);
}
