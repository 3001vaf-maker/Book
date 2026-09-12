from pathlib import Path

# Booking settings: once server-hydrated, null means canonical defaults from server,
# not a signal to fall back to browser storage.
p = Path('core/booking-settings/index.js')
text = p.read_text(encoding='utf-8')
text = text.replace("let bookingSettingsState = null;\n", "let bookingSettingsState = null;\nlet bookingSettingsHydrated = false;\n", 1)
text = text.replace(
"export function hydrateBookingSettingsFromServer(value = null) {\n  bookingSettingsState = value == null ? null : normalizeBookingSettings(value);\n  return getBookingSettings();\n}\n\nexport function getBookingSettings() {\n  if (bookingSettingsState !== null) return normalizeBookingSettings(bookingSettingsState);\n",
"export function hydrateBookingSettingsFromServer(value = null) {\n  bookingSettingsHydrated = true;\n  bookingSettingsState = normalizeBookingSettings(value || {});\n  return getBookingSettings();\n}\n\nexport function getBookingSettings() {\n  if (bookingSettingsHydrated) return normalizeBookingSettings(bookingSettingsState || {});\n",
1,
)
text = text.replace(
"  if (bookingSettingsState === null) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));\n  else {\n    bookingSettingsState = settings;\n",
"  if (!bookingSettingsHydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));\n  else {\n    bookingSettingsState = settings;\n",
1,
)
p.write_text(text, encoding='utf-8')

# Break data is intentionally a persistence-only owner and the architecture guard
# forbids imports there. Inject the server sink from the root migration coordinator.
p = Path('journal/break-data.js')
text = p.read_text(encoding='utf-8')
text = text.replace("import { queueOperationalDataset } from '../core/business-persistence.js';\n\n", "", 1)
text = text.replace("let breakRowsState = null;\n", "let breakRowsState = null;\nlet persistBreakRows = null;\n", 1)
text = text.replace(
"    breakRowsState = normalized.map((row) => clone(row));\n    void queueOperationalDataset('breaks', breakRowsState);\n",
"    breakRowsState = normalized.map((row) => clone(row));\n    if (typeof persistBreakRows === 'function') void persistBreakRows(breakRowsState.map((row) => clone(row)));\n",
1,
)
text = text.replace(
"export function readLegacyBreakSnapshot() {\n",
"export function configureBreakPersistence(handler = null) {\n  persistBreakRows = typeof handler === 'function' ? handler : null;\n}\n\nexport function readLegacyBreakSnapshot() {\n",
1,
)
p.write_text(text, encoding='utf-8')

p = Path('operational-migration.js')
text = p.read_text(encoding='utf-8')
text = text.replace(
"import { apiRequest } from './core/auth.js';\n",
"import { apiRequest } from './core/auth.js';\nimport { queueOperationalDataset } from './core/business-persistence.js';\n",
1,
)
text = text.replace(
"import { hydrateBreaksFromServer, readLegacyBreakSnapshot } from './journal/break-data.js';\n",
"import { configureBreakPersistence, hydrateBreaksFromServer, readLegacyBreakSnapshot } from './journal/break-data.js';\n",
1,
)
text = text.replace(
"function clone(value) {\n",
"configureBreakPersistence((rows) => queueOperationalDataset('breaks', rows));\n\nfunction clone(value) {\n",
1,
)
p.write_text(text, encoding='utf-8')

# The operational guard must validate the injected Break persistence contract,
# not require Break data to import server infrastructure directly.
p = Path('scripts/check-operational-server-ownership.mjs')
text = p.read_text(encoding='utf-8')
text = text.replace("const bridge = read('online-booking/owner-bridge.js');\n", "const bridge = read('online-booking/owner-bridge.js');\nconst migration = read('operational-migration.js');\n", 1)
text = text.replace(
"if (!breaks.includes('hydrateBreaksFromServer') || !breaks.includes(\"queueOperationalDataset('breaks'\")) failures.push('Break must become server-owned after migration.');",
"if (!breaks.includes('hydrateBreaksFromServer') || !breaks.includes('configureBreakPersistence') || !migration.includes(\"queueOperationalDataset('breaks'\")) failures.push('Break must become server-owned after migration.');",
1,
)
p.write_text(text, encoding='utf-8')
