import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const out = join(root, '_site');
const excluded = new Set([
  '.git',
  '.github',
  'node_modules',
  '_site',
  'server',
  'tests',
  'scripts',
  'docs',
]);
const excludedRootFiles = new Set([
  '.dockerignore',
  'Dockerfile',
  'README.md',
  'amvera.yml',
  'docker-compose.staging.yml',
  'package.json',
  'package-lock.json',
]);
const rawToken = String(process.env.GITHUB_SHA || Date.now());
const buildToken = rawToken.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'build';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

function copyTree(source, target) {
  for (const name of readdirSync(source)) {
    if (excluded.has(name)) continue;
    if (source === root && excludedRootFiles.has(name)) continue;
    const from = join(source, name);
    const to = join(target, name);
    const stat = statSync(from);
    if (stat.isDirectory()) {
      mkdirSync(to, { recursive: true });
      copyTree(from, to);
    } else {
      cpSync(from, to);
    }
  }
}

copyTree(root, out);

function versionModuleSpecifier(specifier) {
  if (!/^\.{1,2}\/.+\.(?:js|mjs)$/.test(specifier)) return specifier;
  return `${specifier}?build=${buildToken}`;
}

function versionJavaScript(source) {
  return source
    .replace(/(\bfrom\s*)(['"])(\.{1,2}\/[^'"]+\.(?:js|mjs))\2/g, (_, lead, quote, specifier) => `${lead}${quote}${versionModuleSpecifier(specifier)}${quote}`)
    .replace(/(\bimport\s*)(['"])(\.{1,2}\/[^'"]+\.(?:js|mjs))\2/g, (_, lead, quote, specifier) => `${lead}${quote}${versionModuleSpecifier(specifier)}${quote}`)
    .replace(/(\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+\.(?:js|mjs))\2(\s*\))/g, (_, lead, quote, specifier, tail) => `${lead}${quote}${versionModuleSpecifier(specifier)}${quote}${tail}`);
}

function rewriteJavaScript(dir) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) {
      rewriteJavaScript(file);
      continue;
    }
    if (!/\.(?:js|mjs)$/.test(name)) continue;
    const source = readFileSync(file, 'utf8');
    writeFileSync(file, versionJavaScript(source));
  }
}

rewriteJavaScript(out);

function versionHtml(source) {
  return source.replace(
    /\b(src|href)=(['"])(?!https?:|data:|\/\/)([^'"]+\.(?:js|css))\2/g,
    (_, attr, quote, specifier) => `${attr}=${quote}${specifier}?build=${buildToken}${quote}`,
  );
}

function rewriteHtml(dir) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) {
      rewriteHtml(file);
      continue;
    }
    if (!/\.html$/i.test(name)) continue;
    const source = readFileSync(file, 'utf8');
    writeFileSync(file, versionHtml(source));
  }
}

rewriteHtml(out);

console.log(`Pages artifact ready: ${relative(root, out)} (${buildToken})`);
