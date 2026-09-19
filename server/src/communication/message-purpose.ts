export const MESSAGE_PURPOSES = ['SYSTEM', 'SERVICE', 'DIRECT', 'MARKETING'] as const;

export type MessagePurpose = (typeof MESSAGE_PURPOSES)[number];

export function normalizeMessagePurpose(value: unknown): MessagePurpose | '' {
  const normalized = String(value ?? '').trim().toUpperCase();
  return MESSAGE_PURPOSES.includes(normalized as MessagePurpose) ? normalized as MessagePurpose : '';
}
