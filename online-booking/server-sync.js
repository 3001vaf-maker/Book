import { apiRequest } from '../core/auth.js';
import { flushBusinessPersistence } from '../core/business-persistence.js';
import { hydrateRecordStateFromServer } from '../core/record/index.js';
import { hydrateUEIFromServer } from '../core/uei.js';
import { hydrateClientsFromServer } from '../main/clients/data.js';
import { hydrateConsentsFromServer } from '../settings/documents/consents.js';
import { hydrateDocumentsFromServer } from '../settings/documents/data.js';
import { hydrateDocumentHistoryFromServer } from '../settings/documents/history.js';

const POLL_MS = 4000;
let timer = null;
let running = false;
let lastBusiness = '';
let lastDocuments = '';

async function responseJson(response, fallback) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallback);
  return payload;
}

async function pull() {
  if (running) return;
  running = true;
  try {
    await flushBusinessPersistence();
    const [businessResponse, documentResponse] = await Promise.all([
      apiRequest('/business-state'),
      apiRequest('/document-state'),
    ]);
    const business = await responseJson(businessResponse, 'Не удалось обновить рабочие данные');
    const documents = await responseJson(documentResponse, 'Не удалось обновить документы');

    const businessSnapshot = JSON.stringify({
      people: business.people || [],
      uei: business.uei || {},
      records: business.records || [],
      recordEvents: business.recordEvents || [],
    });
    if (business.verified && businessSnapshot !== lastBusiness) {
      lastBusiness = businessSnapshot;
      hydrateClientsFromServer(business.people || []);
      hydrateUEIFromServer(business.uei || {});
      hydrateRecordStateFromServer({ records: business.records || [], recordEvents: business.recordEvents || [] });
      window.dispatchEvent(new CustomEvent('book:records-changed', { detail: { action: 'server-refresh' } }));
      window.dispatchEvent(new CustomEvent('book:time-usage-changed', { detail: { action: 'server-refresh' } }));
      window.dispatchEvent(new CustomEvent('book:clients-changed', { detail: { action: 'server-refresh' } }));
    }

    const documentData = documents?.data || {};
    const documentSnapshot = JSON.stringify(documentData);
    if (documents.verified && documentSnapshot !== lastDocuments) {
      lastDocuments = documentSnapshot;
      hydrateDocumentsFromServer(documentData.documents || []);
      hydrateConsentsFromServer(documentData.consents || []);
      hydrateDocumentHistoryFromServer(documentData.history || []);
      window.dispatchEvent(new CustomEvent('book:documents-changed', { detail: { action: 'server-refresh' } }));
    }
  } catch {
    // Server remains the owner. A temporary network failure must not break the open Book UI.
  } finally {
    running = false;
  }
}

export function startServerBookingSync() {
  if (timer) return () => stopServerBookingSync();
  void pull();
  timer = window.setInterval(() => void pull(), POLL_MS);
  const refresh = () => void pull();
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  return () => stopServerBookingSync();
}

export function stopServerBookingSync() {
  if (timer) window.clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', pull);
  window.removeEventListener('focus', pull);
}
