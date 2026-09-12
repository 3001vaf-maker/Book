from pathlib import Path

path = Path('scripts/check-uei-identity-architecture.mjs')
text = path.read_text(encoding='utf-8')
text = text.replace("const bridge = read('online-booking/owner-bridge.js');", "const business = read('server/src/business-state/business-state.service.ts');")
text = text.replace("if (!bridge.includes('findIdentityOwnerByAccountId') || !bridge.includes('getClientMetadata(current.key)')) {\n  failures.push('Owner bridge must synchronize one canonical master fact set to every Account in the UEI.');\n}", "if (!business.includes('bookingIdentityForAccount') || !business.includes('memberPeople') || !business.includes('accountIds')) {\n  failures.push('Server BusinessState must resolve Account identity through canonical UEI members.');\n}")
text = text.replace("if (!server.includes('accountId: { in: accountIds }') || !server.includes('where: { tenantId, uei }')) {\n  failures.push('Booking Account history must resolve all Accounts sharing the current UEI.');\n}", "if (!server.includes('const accountIds = identity?.accountIds') || !server.includes('accountId: { in: accountIds }')) {\n  failures.push('Booking Account history must resolve all Accounts from canonical UEI identity.');\n}")
path.write_text(text, encoding='utf-8')
