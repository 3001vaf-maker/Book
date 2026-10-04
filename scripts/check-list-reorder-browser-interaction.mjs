import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { chromium, webkit, devices } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.BROWSER_TEST_URL || 'http://127.0.0.1:4173';

for (const [name, engine, contextOptions] of [
  ['desktop-chromium', chromium, { viewport: { width: 1280, height: 900 } }],
  ['mobile-chromium', chromium, devices['iPhone 13 Pro Max']],
  ['mobile-webkit', webkit, devices['iPhone 13 Pro Max']],
]) {
  const browser = await engine.launch({ headless:true });
  try {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/tests/list-reorder-browser.html`);
    await page.locator('html[data-list-reorder-ready="true"]').waitFor();

    const first = page.locator('[data-procedure="one"]');
    if (contextOptions.hasTouch) await first.tap();
    else await first.click();
    assert.equal(await page.locator('[data-opened]').textContent(), 'one', `${name}: short tap/click did not open entry`);

    await page.locator('[data-opened]').evaluate((node) => { node.textContent = ''; });

    const box1 = await first.boundingBox();
    const box3 = await page.locator('[data-procedure="three"]').boundingBox();
    assert.ok(box1 && box3, `${name}: missing list geometry`);
    const x = box1.x + box1.width / 2;
    const y1 = box1.y + box1.height / 2;
    const y3 = box3.y + box3.height / 2;

    if (contextOptions.hasTouch) {
      await page.evaluate(async ({x,y1,y3}) => {
        const target = document.elementFromPoint(x, y1);
        if (!target) throw new Error('missing touch target');
        const pid = 41;
        target.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, pointerId:pid, pointerType:'touch', clientX:x, clientY:y1, isPrimary:true }));
        await new Promise((resolve) => setTimeout(resolve, 320));
        target.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, cancelable:true, pointerId:pid, pointerType:'touch', clientX:x, clientY:y3, isPrimary:true }));
        target.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, pointerId:pid, pointerType:'touch', clientX:x, clientY:y3, isPrimary:true }));
        target.click();
      }, {x,y1,y3});
    } else {
      await page.mouse.move(x,y1);
      await page.mouse.down();
      await page.waitForTimeout(320);
      await page.mouse.move(x,y3,{steps:8});
      await page.mouse.up();
    }

    await page.waitForTimeout(50);
    assert.notEqual(await page.locator('[data-order]').textContent(), '', `${name}: long press did not reorder`);
    assert.equal(await page.locator('[data-opened]').textContent(), '', `${name}: reorder gesture leaked a click`);
    assert.deepEqual(errors, [], `${name}: browser errors`);
    console.log(`${name}: PASS (tap opens, long-press reorders without click leak)`);
  } finally {
    await browser.close();
  }
}
