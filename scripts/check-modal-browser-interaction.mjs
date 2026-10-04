import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// CI installs the pinned browser runner outside the application's dependencies.
const { chromium, webkit, devices } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.BROWSER_TEST_URL || 'http://127.0.0.1:4173';
const results = [];

for (const [name, engine, contextOptions] of [
  ['desktop-chromium', chromium, { viewport: { width: 1280, height: 900 } }],
  ['mobile-chromium', chromium, devices['iPhone 13 Pro Max']],
  ['mobile-webkit', webkit, devices['iPhone 13 Pro Max']],
]) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const open = async (suffix = '') => {
      await page.goto(`${base}/tests/modal-hit-targets-browser.html${suffix}`);
      await page.locator('html[data-modal-test-ready="true"]').waitFor();
      await page.locator('[data-v2-app]').waitFor();
      await page.waitForTimeout(300); // Shared entrance animation must settle before geometry assertions.
    };
    const targetPoints = async (selector) => page.locator(selector).evaluate((node) => {
      const r = node.getBoundingClientRect();
      return [3, r.height / 2, r.height - 3].map((dy) => {
        const x = r.left + r.width / 2;
        const y = r.top + dy;
        const hit = document.elementFromPoint(x, y);
        return { x, y, hit: Boolean(hit && (hit === node || node.contains(hit))) };
      });
    });
    const activate = async (point) => {
      if (contextOptions.hasTouch) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
    };
    const closeSheet = async () => {
      // Dismiss through the real pointer handler, including pointer capture.
      const zone = await page.locator('[data-v2-layer-gesture-zone]').boundingBox();
      assert.ok(zone, `${name}: missing swipe strip`);
      const x = zone.x + zone.width / 2;
      const y = zone.y + zone.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + 100, { steps: 10 });
      await page.mouse.up();
      await page.locator('[data-modal]').waitFor({ state: 'detached' });
    };

    await open();
    if (contextOptions.hasTouch) await page.locator('[data-test-settings]').tap();
    else await page.locator('[data-test-settings]').click();
    await page.waitForTimeout(300);
    const menuSelector = '[data-shared-profile-action="workplaces"]';

    // Negative control: the old 20px inset really places the first button under the 30px strip.
    await page.locator('.modal-sheet').evaluate((node) => { node.style.paddingTop = '20px'; });
    assert.equal((await targetPoints(menuSelector))[0].hit, false, `${name}: negative control did not reproduce overlap`);
    await page.locator('.modal-sheet').evaluate((node) => { node.style.removeProperty('padding-top'); });
    const points = await targetPoints(menuSelector);
    assert.ok(points.every((point) => point.hit), `${name}: settings action obscured`);
    await activate(points[0]);
    await page.locator('[data-service-workplace="test-space"]').waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-modal]').count(), 1, `${name}: old menu remained open`);
    const checkbox = '[data-service-workplace="test-space"]';
    const checkboxPoints = await targetPoints(checkbox);
    assert.ok(checkboxPoints.every((point) => point.hit), `${name}: workplace checkbox obscured`);
    await activate(checkboxPoints[1]);
    assert.equal(await page.locator('[data-test-selection]').textContent(), '1', `${name}: selection did not update`);
    await closeSheet();
    assert.equal(await page.locator('.v2-app__stage').evaluate((node) => node.inert), false, `${name}: stage remained locked`);
    if (contextOptions.hasTouch) await page.locator('[data-test-settings]').tap();
    else await page.locator('[data-test-settings]').click();
    await page.waitForTimeout(300);
    await activate((await targetPoints(menuSelector))[1]);
    await page.waitForTimeout(300);
    assert.equal(await page.locator(checkbox).isChecked(), true, `${name}: selection was lost on reopening`);
    await closeSheet();

    for (const variant of ['', 'profile-settings', 'photo', 'password', 'consent', 'color', 'time-range', 'form', 'time-picker', 's']) {
      await open(`?variant=${variant}`);
      const hits = await targetPoints('[data-test-target]');
      assert.ok(hits.every((point) => point.hit), `${name}/${variant || 'x'}: content covered by gesture strip`);
      const reserved = await page.locator('.v2-layer').evaluate((sheet) => {
        const css = getComputedStyle(sheet);
        const zone = sheet.querySelector('[data-v2-layer-gesture-zone]').getBoundingClientRect();
        const top = sheet.classList.contains('v2-layer--top');
        return parseFloat(top ? css.paddingBottom : css.paddingTop) >= zone.height;
      });
      assert.ok(reserved, `${name}/${variant || 'x'}: swipe strip has no reserved space`);
    }
    assert.deepEqual(errors, [], `${name}: browser errors`);
    results.push({ name, result: 'PASS' });
    console.log(`${name}: PASS (trusted input, menu → workplaces, selection, reopen, dismissal, 10 sheet variants)`);
  } finally {
    await browser.close();
  }
}
console.log(JSON.stringify(results));
