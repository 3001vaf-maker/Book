import './access-runtime.js';
import { prepareTelegramEntryAuth } from './telegram-entry-auth.js';

const telegramAuth = await prepareTelegramEntryAuth();
if (!telegramAuth?.halt) {
  await import('../core.js');
  await import('./incoming-notifications/runtime.js');
}
