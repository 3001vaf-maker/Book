import assert from 'node:assert/strict';
import fs from 'node:fs';

const listEntry = fs.readFileSync('ui/lists/list-entry.js', 'utf8');
const listCss = fs.readFileSync('ui/lists/list-entry.css', 'utf8');
const recordRuntime = fs.readFileSync('ui/record/runtime.js', 'utf8');
const recordCss = fs.readFileSync('ui/record/record.css', 'utf8');

assert.match(listEntry, /selectable = false/);
assert.match(listEntry, /class=\"list-entry__selector\"/);
assert.match(listCss, /\.list-entry\{[\s\S]*?min-height:78px[\s\S]*?box-shadow:-9px 8px 14px -11px/);
assert.match(listCss, /\.list-entry__selector\{width:24px;height:24px/);
assert.match(recordRuntime, /export function recordProcedureList[\s\S]*?v2ListEntry\(\{/);
assert.match(recordRuntime, /export function recordProcedureList[\s\S]*?v2ListEntries\(rows\)/);
assert.doesNotMatch(recordRuntime, /v2-service-sticker/);
assert.doesNotMatch(recordCss, /v2-service-sticker|v2-sticker-list--services/);
