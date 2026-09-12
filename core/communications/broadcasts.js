import { apiRequest } from '../auth.js';

async function jsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

export async function getBroadcastTemplates() {
  return jsonResponse(await apiRequest('/communications/broadcasts/templates'), 'Не удалось загрузить шаблоны');
}
export async function saveBroadcastTemplate({ id = '', name = '', body = '' } = {}) {
  return jsonResponse(await apiRequest('/communications/broadcasts/templates', { method: 'POST', body: JSON.stringify({ id, name, body }) }), 'Не удалось сохранить шаблон');
}
export async function deleteBroadcastTemplate(id = '') {
  return jsonResponse(await apiRequest(`/communications/broadcasts/templates/${encodeURIComponent(String(id || ''))}`, { method: 'DELETE' }), 'Не удалось удалить шаблон');
}
export async function previewBroadcast({ channel = 'TELEGRAM', all = false, phones = [] } = {}) {
  return jsonResponse(await apiRequest('/communications/broadcasts/preview', { method: 'POST', body: JSON.stringify({ channel, all, phones }) }), 'Не удалось проверить аудиторию');
}
export async function sendBroadcast({ channel = 'TELEGRAM', all = false, phones = [], name = '', body = '' } = {}) {
  return jsonResponse(await apiRequest('/communications/broadcasts/send', { method: 'POST', body: JSON.stringify({ channel, all, phones, name, body }) }), 'Не удалось отправить рассылку');
}
