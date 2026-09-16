import './access-runtime.js';
import { prepareTelegramEntryAuth } from './telegram-entry-auth.js';

const telegramAuth = await prepareTelegramEntryAuth();
if (!telegramAuth?.halt) {
  await import('../core.js');
  const { startRecordCompletionRuntime } = await import('./record/index.js');
  startRecordCompletionRuntime();
  await import('./incoming-notifications/runtime.js');
}
