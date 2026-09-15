import { apiRequest } from '../auth.js';

async function jsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

export async function getCommunicationThreads(limit = 200) {
  const query = new URLSearchParams({ limit: String(limit) });
  return jsonResponse(await apiRequest(`/communications/chat/threads?${query}`), 'Не удалось загрузить чаты');
}

export async function getCommunicationThread({ profileKey = '', phone = '', uei = '', limit = 300 } = {}) {
  const query = new URLSearchParams({ profileKey: String(profileKey || ''), phone: String(phone || ''), uei: String(uei || ''), limit: String(limit) });
  return jsonResponse(await apiRequest(`/communications/chat/thread?${query}`), 'Не удалось загрузить переписку');
}

export async function getCommunicationPreferences({ phone = '', uei = '' } = {}) {
  const query = new URLSearchParams({ phone: String(phone || ''), uei: String(uei || '') });
  return jsonResponse(await apiRequest(`/communications/chat/preferences?${query}`), 'Не удалось загрузить настройки каналов');
}

export async function saveCommunicationPreferences({ phone = '', uei = '', preferredChannels = [] } = {}) {
  return jsonResponse(await apiRequest('/communications/chat/preferences', {
    method: 'PUT', body: JSON.stringify({ phone, uei, preferredChannels }),
  }), 'Не удалось сохранить настройки каналов');
}

export async function sendCommunicationMessage({ profileKey = '', channel = '', phone = '', uei = '', body = '', content = null, attachments = [] } = {}) {
  return jsonResponse(await apiRequest('/communications/chat/messages', {
    method: 'POST', body: JSON.stringify({ profileKey, channel, phone, uei, body, content, attachments }),
  }), 'Не удалось отправить сообщение');
}

export async function editCommunicationMessage(messageId, { body = '', content = null } = {}) {
  return jsonResponse(await apiRequest(`/communications/chat/messages/${encodeURIComponent(String(messageId || ''))}`, {
    method: 'PATCH', body: JSON.stringify({ body, content }),
  }), 'Не удалось изменить сообщение');
}

export async function deleteCommunicationMessage(messageId) {
  return jsonResponse(await apiRequest(`/communications/chat/messages/${encodeURIComponent(String(messageId || ''))}`, {
    method: 'DELETE',
  }), 'Не удалось удалить сообщение');
}
