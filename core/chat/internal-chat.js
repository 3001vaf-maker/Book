import { getGlobalAccountRelationships } from '../account/index.js';
import {
  createProfessionalMessengerGroup,
  createProfessionalMessengerPoll,
  deleteEndUserMessengerMessage,
  deleteProfessionalMessengerMessage,
  editEndUserMessengerMessage,
  editProfessionalMessengerMessage,
  ensureProfessionalDirectConversation,
  forwardEndUserMessengerMessage,
  forwardProfessionalMessengerMessage,
  getEndUserMessengerConversations,
  getEndUserMessengerMessages,
  getProfessionalMessengerConversations,
  getProfessionalMessengerMessages,
  pinEndUserMessengerMessage,
  pinProfessionalMessengerMessage,
  reactEndUserMessengerMessage,
  reactProfessionalMessengerMessage,
  searchEndUserMessenger,
  searchProfessionalMessenger,
  sendEndUserMessengerMessage,
  sendProfessionalMessengerMessage,
  setEndUserMessengerConversationState,
  setProfessionalMessengerConversationState,
  voteEndUserMessengerPoll,
  voteProfessionalMessengerPoll,
} from './messenger-api.js';

export const INTERNAL_CHAT_CHANNEL = 'CHAT';

function directConversation(conversations = []) {
  return (Array.isArray(conversations) ? conversations : []).find((item) => String(item?.type || '').toUpperCase() === 'DIRECT') || null;
}

export async function getProfessionalChatThreads() {
  return getProfessionalMessengerConversations();
}

export async function ensureProfessionalChatThread(identity = {}) {
  if (identity?.conversationId) return identity;
  return ensureProfessionalDirectConversation(identity);
}

export async function getProfessionalChatThread(identity = {}) {
  const conversation = await ensureProfessionalChatThread(identity);
  return getProfessionalMessengerMessages(conversation.id);
}

export async function sendProfessionalChatMessage({ conversationId = '', phone = '', uei = '', body = '', attachments = [], replyToId = '' } = {}) {
  const conversation = conversationId
    ? { id: conversationId }
    : await ensureProfessionalDirectConversation({ phone, uei });
  return sendProfessionalMessengerMessage(conversation.id, { body, attachments, replyToId });
}

export async function getEndUserChatThreads() {
  return getGlobalAccountRelationships();
}

export async function getEndUserChatConversation(tenantId) {
  const conversations = await getEndUserMessengerConversations(tenantId);
  const direct = directConversation(conversations);
  if (!direct) throw new Error('Диалог не найден');
  return direct;
}

export async function getEndUserChatThread(tenantId, conversationId = '') {
  const conversation = conversationId ? { id: conversationId } : await getEndUserChatConversation(tenantId);
  return getEndUserMessengerMessages(tenantId, conversation.id);
}

export async function sendEndUserChatMessage(tenantId, body, attachments = [], { conversationId = '', replyToId = '' } = {}) {
  const conversation = conversationId ? { id: conversationId } : await getEndUserChatConversation(tenantId);
  return sendEndUserMessengerMessage(tenantId, conversation.id, { body, attachments, replyToId });
}

export const professionalChatActions = {
  edit: editProfessionalMessengerMessage,
  remove: deleteProfessionalMessengerMessage,
  react: reactProfessionalMessengerMessage,
  pin: pinProfessionalMessengerMessage,
  forward: forwardProfessionalMessengerMessage,
  search: searchProfessionalMessenger,
  createGroup: createProfessionalMessengerGroup,
  createPoll: createProfessionalMessengerPoll,
  vote: voteProfessionalMessengerPoll,
  setConversationState: setProfessionalMessengerConversationState,
};

export function endUserChatActions(tenantId) {
  return {
    edit: (messageId, body) => editEndUserMessengerMessage(tenantId, messageId, body),
    remove: (messageId) => deleteEndUserMessengerMessage(tenantId, messageId),
    react: (messageId, emoji) => reactEndUserMessengerMessage(tenantId, messageId, emoji),
    pin: (messageId) => pinEndUserMessengerMessage(tenantId, messageId),
    forward: (messageId, conversationId) => forwardEndUserMessengerMessage(tenantId, messageId, conversationId),
    search: (input) => searchEndUserMessenger(tenantId, input),
    vote: (messageId, optionId) => voteEndUserMessengerPoll(tenantId, messageId, optionId),
    setConversationState: (conversationId, state) => setEndUserMessengerConversationState(tenantId, conversationId, state),
  };
}
