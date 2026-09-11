export function buildBookingLink({ origin = '', pathname = '/', tenantId = '', workplaceKey = '' } = {}) {
  const tenant = String(tenantId || '').trim();
  const host = String(origin || '').trim();
  if (!tenant || !host) return '';

  const path = String(pathname || '/').split(/[?#]/)[0] || '/';
  const url = new URL(path, host);
  url.searchParams.set('booking', tenant);

  const workplace = String(workplaceKey || '').trim();
  if (workplace) url.searchParams.set('workplace', workplace);

  return url.toString();
}
