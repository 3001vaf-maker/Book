import './access-runtime.js';
import { prepareTelegramEntryAuth } from './telegram-entry-auth.js';

await prepareTelegramEntryAuth();
await import('../core.js');
