from pathlib import Path

# Business ownership: online booking now writes canonical Person/Record directly on the server.
path = Path('scripts/check-business-server-ownership.mjs')
text = path.read_text(encoding='utf-8')
text = text.replace("const bridge = read('online-booking/owner-bridge.js');", "const online = read('server/src/online-booking/online-booking.service.ts');")
text = text.replace("if (!bridge.includes('await flushBusinessPersistence();')) failures.push('Online booking import must flush Person/Record facts before marking a request imported.');", "if (!online.includes('upsertBookingPersonFromAccount') || !online.includes('createOnlineBookingRecord')) failures.push('Online booking must write canonical Person/Record facts directly on the server.');")
path.write_text(text, encoding='utf-8')

# Operational ownership: public booking consumes verified operational state directly; no browser publication exists.
path = Path('scripts/check-operational-server-ownership.mjs')
text = path.read_text(encoding='utf-8')
text = text.replace("const bridge = read('online-booking/owner-bridge.js');", "const online = read('server/src/online-booking/online-booking.service.ts');")
text = text.replace("if (!bridge.includes('async function publish(force = false) {\\n  await flushBusinessPersistence();')) failures.push('Online publication must flush operational facts before publishing context.');", "if (!online.includes('this.businessState.publicOperational(tenantId)')) failures.push('Public online booking must consume canonical server operational facts directly.');")
path.write_text(text, encoding='utf-8')
