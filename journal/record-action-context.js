import { getProfile } from '../core/profile/data.js';

export function journalRecordActionContext() {
  const profile = getProfile();
  return {
    source: 'journal',
    actor: {
      type: 'profile',
      profileId: String(profile?.id || ''),
      accountId: String(profile?.platformAccountId || ''),
    },
  };
}
