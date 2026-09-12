from pathlib import Path

p = Path('tests/document-server-owner.test.mjs')
text = p.read_text(encoding='utf-8')
needle = "globalThis.localStorage = {\n  getItem: (key) => storage.has(key) ? storage.get(key) : null,\n  setItem: (key, value) => storage.set(key, String(value)),\n  removeItem: (key) => storage.delete(key),\n};\n"
replacement = needle + "globalThis.sessionStorage = {\n  getItem: () => '',\n  setItem() {},\n  removeItem() {},\n};\n"
if needle not in text:
    raise SystemExit('document regression storage mock anchor missing')
p.write_text(text.replace(needle, replacement, 1), encoding='utf-8')
