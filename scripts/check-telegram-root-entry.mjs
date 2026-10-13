import fs from 'node:fs';

const runtime = fs.readFileSync('online-booking/account-runtime.js', 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(
  runtime.includes("params.get('booking')") && runtime.includes("params.get('tg_entry')"),
  'Root Telegram entry must read tenant and one-time ticket from the bot URL.',
);
expect(
  runtime.includes("if (path !== '/') return null;"),
  'Automatic Telegram entry must be restricted to the global account root and not duplicate booking-route runtime.',
);
expect(
  runtime.includes('clearAccount(rootTelegramRoute.tenantId);'),
  'Root Telegram entry must not inherit an unrelated browser Account.',
);
expect(
  runtime.includes('continueTelegramEntryToBooking(rootTelegramRoute.tenantId)')
    && runtime.includes("url.searchParams.set('booking', tenant)")
    && runtime.includes("url.searchParams.set('entry', 'account-booking')")
    && runtime.includes('location.replace('),
  'Successful Telegram entry must continue directly into booking for the same tenant instead of dropping the booking context.',
);
expect(
  runtime.includes('await bindAccountTelegramEntry(tenant, entry);')
    && runtime.includes('completeTelegramEntry();'),
  'Explicit login must finish the same Telegram ticket after authentication.',
);

if (failures.length) {
  failures.forEach((message) => console.error(`telegram root entry: ${message}`));
  process.exit(1);
}
console.log('telegram root entry check: OK');
