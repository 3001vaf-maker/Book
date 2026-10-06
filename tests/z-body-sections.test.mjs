import test from 'node:test';
import assert from 'node:assert/strict';
import { v2ZBodySections } from '../ui/v2/z-layout.js';


test('shared Z Body sections own the mandatory gap', () => {
  const html = v2ZBodySections([
    { kind: 'content', content: '<div>A</div>' },
    { kind: 'full', content: '<div>B</div>' },
    { kind: 'list', content: '<div>C</div>' },
  ]);

  assert.match(html, /data-v2-z-body-sections/);
  assert.match(html, /gap:var\(--v2-z-body-section-gap,20px\)/);
  assert.equal((html.match(/data-v2-z-body-section=/g) || []).length, 3);
});


test('list is terminal inside shared Z Body sections', () => {
  assert.throws(() => v2ZBodySections([
    { kind: 'list', content: '<div>List</div>' },
    { kind: 'content', content: '<div>After list</div>' },
  ]), /must be terminal/);
});
