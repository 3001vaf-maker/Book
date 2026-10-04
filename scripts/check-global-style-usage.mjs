import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stylesheet = path.join(root, 'css/style.css');
const css = fs.readFileSync(stylesheet, 'utf8');
const classNames = [...new Set([...css.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)].map((match) => match[1]))].sort();

const skip = new Set(['.git', 'node_modules', 'tests', 'scripts', 'server', 'reference', 'css']);
const extensions = new Set(['.js', '.mjs', '.html']);
const sources = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (extensions.has(path.extname(entry.name))) sources.push(fs.readFileSync(full, 'utf8'));
  }
}
walk(root);

const runtime = sources.join('\n');
const unused = classNames.filter((name) => !runtime.includes(name));

if (unused.length) {
  console.error('global style usage check: FAILED');
  unused.forEach((name) => console.error(`- css/style.css: .${name} is not referenced by runtime`));
  process.exit(1);
}
console.log(`global style usage check: OK (${classNames.length} class selectors)`);
