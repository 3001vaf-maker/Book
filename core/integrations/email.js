import { apiRequest } from '../auth.js';

async function jsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || fallbackMessage);
  return payload;
}

export async function getEmailChannelStatus() {
  return jsonResponse(await apiRequest('/communications/integrations/email'), 'Не удалось проверить Email-интеграцию');
}
