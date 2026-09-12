from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

# Startup/migration is an external Record consumer: expose only the two
# bootstrap helpers through the canonical public Record contract.
replace_once(
    'core/record/index.js',
    "export {\n  getActiveRecordCountForDay,\n",
    "export {\n  hydrateRecordStateFromServer,\n  readLegacyRecordSnapshot,\n} from './data.js';\nexport {\n  getActiveRecordCountForDay,\n",
)

replace_once(
    'core/business-migration.js',
    "import { hydrateRecordStateFromServer, readLegacyRecordSnapshot } from './record/data.js';",
    "import { hydrateRecordStateFromServer, readLegacyRecordSnapshot } from './record/index.js';",
)

# Regression test also stays on the public Record contract. Persistence mutation
# ownership itself is protected by the architecture guard.
p = Path('tests/business-server-owner.test.mjs')
text = p.read_text(encoding='utf-8')
text = text.replace(
    "const recordData = await import('../core/record/data.js');",
    "const record = await import('../core/record/index.js');",
)
text = text.replace('recordData.hydrateRecordStateFromServer({', 'record.hydrateRecordStateFromServer({')
text = text.replace(
    "  recordEvents: [],\n});",
    "  recordEvents: [{ id: 'server-created', recordId: 'server-record', type: 'created', at: '2026-09-12T09:00:00.000Z', payload: {} }],\n});",
    1,
)
text = text.replace(
    "assert.deepEqual(recordData.getRecordRows().map((record) => record.id), ['server-record']);",
    "assert.deepEqual(record.getRecords().map((item) => item.id), ['server-record']);",
)
text = text.replace("recordData.patchRecordRow('server-record', { from: '10:30' });\n", '')
text = text.replace("recordData.insertRecordEventRow({ id: 'event-1', recordId: 'server-record', type: 'created', at: '2026-09-12T10:00:00.000Z', payload: {} });\n", '')
text = text.replace("assert.ok(calls.some((call) => call.url.includes('/business-state/records/server-record') && call.method === 'PUT'));\n", '')
text = text.replace("assert.ok(calls.some((call) => call.url.includes('/business-state/record-events/event-1') && call.method === 'PUT'));\n", '')
p.write_text(text, encoding='utf-8')
