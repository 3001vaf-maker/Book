let consentState = [];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function contactPointType(value) {
  const type = String(value || '').trim().toUpperCase();
  if (type === 'SMS' || type === 'WHATSAPP') return 'PHONE';
  return ['PHONE', 'EMAIL', 'TELEGRAM'].includes(type) ? type : '';
}

function contactPointValue(typeValue, value) {
  const type = contactPointType(typeValue);
  const raw = String(value || '').trim();
  if (type === 'PHONE') {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return `7${digits}`;
    if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
    return digits;
  }
  if (type === 'EMAIL') return raw.toLowerCase();
  return raw;
}

function normalize(item = {}) {
  const subjectType = String(item.subjectType || '').trim().toUpperCase();
  const contactType = contactPointType(item.contactType);
  const contactValue = contactPointValue(contactType, item.contactValue);
  return {
    id: String(item.id || ''),
    subjectType,
    subjectKey: String(item.subjectKey || '').trim(),
    contactType,
    contactValue,
    documentId: String(item.documentId || '').trim(),
    documentVersion: Math.max(1, Number(item.documentVersion || 1)),
    status: item.status === 'revoked' ? 'revoked' : item.status === 'declined' ? 'declined' : 'accepted',
    acceptedAt: String(item.acceptedAt || ''),
    revokedAt: String(item.revokedAt || ''),
    source: String(item.source || ''),
    eventAt: String(item.eventAt || item.revokedAt || item.acceptedAt || item.createdAt || ''),
    createdAt: String(item.createdAt || item.eventAt || ''),
    migratedFromEventId: String(item.migratedFromEventId || ''),
  };
}

function validSubject(item) {
  return item.documentId
    && ((item.subjectType === 'BOOKING_ACCOUNT' && item.subjectKey)
      || (item.subjectType === 'CONTACT_POINT' && item.subjectKey && item.contactType && item.contactValue));
}

function newest(items) {
  return [...items].sort((a, b) => {
    const at = Date.parse(a.eventAt || a.createdAt || 0) || 0;
    const bt = Date.parse(b.eventAt || b.createdAt || 0) || 0;
    return bt - at;
  })[0] || null;
}

export function hydrateConsentsFromServer(items = []) {
  consentState = (Array.isArray(items) ? items : []).map(normalize).filter(validSubject);
  return getConsents();
}

export function getConsents() {
  return clone(consentState);
}

export function getLatestAccountConsent(accountId, documentId) {
  const subjectKey = String(accountId || '').trim();
  const targetDocument = String(documentId || '').trim();
  if (!subjectKey || !targetDocument) return null;
  return newest(consentState.filter((item) => item.subjectType === 'BOOKING_ACCOUNT'
    && item.subjectKey === subjectKey
    && item.documentId === targetDocument));
}

export function getLatestContactConsent(typeValue, value, documentId = 'messages-consent') {
  const type = contactPointType(typeValue);
  const normalizedValue = contactPointValue(type, value);
  const targetDocument = String(documentId || '').trim();
  if (!type || !normalizedValue || !targetDocument) return null;
  return newest(consentState.filter((item) => item.subjectType === 'CONTACT_POINT'
    && item.contactType === type
    && item.contactValue === normalizedValue
    && item.documentId === targetDocument));
}
