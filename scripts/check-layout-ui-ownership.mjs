import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const errors = [];
const read = (path) => readFileSync(join(root, path), 'utf8');
const fail = (path, message) => errors.push(`${path}: ${message}`);

function walk(dir) {
  const result = [];
  for (const name of readdirSync(join(root, dir))) {
    const path = join(root, dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...walk(relative(root, path)));
    else if (/\.(?:js|css)$/.test(name)) result.push(relative(root, path).replaceAll('\\', '/'));
  }
  return result;
}

const ownerJs = 'ui/layout/index.js';
const ownerCss = 'ui/layout/layout.css';
const facade = 'ui/ui.js';
const graph = 'timetable/timetable.js';
const html = 'index.html';
const standard = 'docs/UI_LAYOUT_STANDARD.md';

if (!/export function twoColumnLayout\b/.test(read(ownerJs))) {
  fail(ownerJs, 'twoColumnLayout() must be the canonical two-column layout owner');
}
if (!/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/.test(read(ownerCss))) {
  fail(ownerCss, 'twoColumnLayout must own two equal flexible columns');
}
if (!/from ['"]\.\/layout\/index\.js['"]/.test(read(facade)) || !/\btwoColumnLayout\b/.test(read(facade))) {
  fail(facade, 'shared UI facade must expose twoColumnLayout()');
}
if (!/ui\/layout\/layout\.css/.test(read(html))) {
  fail(html, 'canonical layout stylesheet must be loaded globally');
}
if (!/\btwoColumnLayout\s*\(/.test(read(graph))) {
  fail(graph, 'Graph conflict editor must use canonical twoColumnLayout()');
}
if (!/## twoColumnLayout\(\)/.test(read(standard)) || !/содержимое колонок компоненту неизвестно/.test(read(standard))) {
  fail(standard, 'canonical twoColumnLayout() contract must stay documented as content-neutral');
}

for (const file of [...walk('main'), ...walk('settings'), ...walk('timetable'), ...walk('journal'), ...walk('ui')]) {
  if (file === ownerJs || file === ownerCss) continue;
  const source = read(file);
  if (/two-column-layout(?:__column)?/.test(source)) {
    fail(file, 'two-column layout markup/styles belong only to ui/layout');
  }
}

if (errors.length) {
  console.error('layout UI ownership check: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('layout UI ownership check: OK');
