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
  runtime.includes('onTelegramEntryCompleted')
    && runtime.includes("removeTelegramEntryFromUrl({ removeBooking: true })")
    && runtime.includes('location.reload();'),
  'Successful root Telegram resolve/bind must clean the entry URL and reload the global account UI with the resolved Account.',
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
