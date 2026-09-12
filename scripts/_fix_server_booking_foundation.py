from pathlib import Path

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
