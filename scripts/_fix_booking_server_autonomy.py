from pathlib import Path

path = Path('scripts/check-booking-client-architecture.mjs')
text = path.read_text(encoding='utf-8')
text = text.replace("const ownerBridge = fs.readFileSync('online-booking/owner-bridge.js', 'utf8');", "const serverSync = fs.readFileSync('online-booking/server-sync.js', 'utf8');")
text = text.replace("expect(ownerBridge.includes('settings: getBookingSettings()'), 'Owner publication must publish canonical booking settings.');", "expect(serverSync.includes(\"apiRequest('/business-state')\"), 'Open Book must refresh from canonical server business state.');")
path.write_text(text, encoding='utf-8')
