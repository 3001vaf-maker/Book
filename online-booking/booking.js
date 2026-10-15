import { renderGlobalClient, renderOnlineBooking as renderLegacyOnlineBooking } from './booking-legacy.js';
import { renderOnlineBookingX } from './booking-x.js';

export { renderGlobalClient };

export async function renderOnlineBooking(root, options = {}) {
  const entry = String(options?.entry || '');
  if (entry === 'account' || entry === 'chat') {
    return renderLegacyOnlineBooking(root, options);
  }
  return renderOnlineBookingX(root, options);
}
