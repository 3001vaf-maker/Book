import {
  getAccountChat,
  getGlobalAccountRelationships,
  sendAccountChatMessage,
} from '../account/index.js';
import {
  getCommunicationThread,
  getCommunicationThreads,
  sendCommunicationMessage,
} from '../communications/chat.js';

export const INTERNAL_CHAT_CHANNEL = 'CHAT';

function internalTransport(value = '') {
  const channel = String(value || '').trim().toUpperCase();
  return channel === 'IN_APP' || channel === 'PUSH' || channel === INTERNAL_CHAT_CHANNEL;
}

export async function getProfessionalChatThreads(limit = 200) {
  const threads = await getCommunicationThreads(limit);
  return (Array.isArray(threads) ? threads : []).filter((thread) => internalTransport(thread?.channel));
}

export async function getProfessionalChatThread(identity = {}) {
  const messages = await getCommunicationThread(identity);
  return (Array.isArray(messages) ? messages : []).filter((message) => internalTransport(message?.channel));
}

export async function sendProfessionalChatMessage({ phone = '', uei = '', body = '', attachments = [] } = {}) {
  return sendCommunicationMessage({
    channel: INTERNAL_CHAT_CHANNEL,
    phone,
    uei,
    externalThreadId: '',
    body,
    attachments,
  });
}

export async function getEndUserChatThreads() {
  return getGlobalAccountRelationships();
}

export async function getEndUserChatThread(tenantId) {
  return getAccountChat(tenantId);
}

export async function sendEndUserChatMessage(tenantId, body, attachments = []) {
  return sendAccountChatMessage(tenantId, body, attachments);
}
