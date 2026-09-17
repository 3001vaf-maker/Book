import './access-runtime.js';
import { prepareTelegramEntryAuth } from './telegram-entry-auth.js';

const telegramAuth = await prepareTelegramEntryAuth();
if (!telegramAuth?.halt) await import('../core.js');
if (!telegramAuth?.halt) await import('./incoming-notifications/runtime.js');
if (!telegramAuth?.halt) await import('./legal-mode-banner.js');