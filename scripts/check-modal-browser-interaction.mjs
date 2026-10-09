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
    const activateSelector = async (selector) => {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box, `${name}: missing ${selector}`);
      await activate({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    };
    const closeTopSheet = async () => {
      const before = await page.locator('[data-modal]').count();
      assert.ok(before > 0, `${name}: no modal to close`);
      const top = page.locator('[data-modal]').last();
      const zone = await top.locator('[data-v2-layer-gesture-zone]').boundingBox();
      assert.ok(zone, `${name}: missing swipe strip`);
      const x = zone.x + zone.width / 2;
      const y = zone.y + zone.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + 100, { steps: 10 });
      await page.mouse.up();
      await page.waitForFunction((expected) => document.querySelectorAll('[data-modal]').length === expected, before - 1);
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
    // Profile settings intentionally hands off to the next X by explicitly closing itself.
    assert.equal(await page.locator('[data-modal]').count(), 1, `${name}: settings handoff left an extra modal`);
    const checkbox = '[data-service-workplace="test-space"]';
    const checkboxPoints = await targetPoints(checkbox);
    assert.ok(checkboxPoints.every((point) => point.hit), `${name}: workplace checkbox obscured`);
    await activate(checkboxPoints[1]);
    assert.equal(await page.locator('[data-test-selection]').textContent(), '1', `${name}: selection did not update`);
    await closeTopSheet();
    assert.equal(await page.locator('.v2-app__stage').evaluate((node) => node.inert), false, `${name}: stage remained locked`);

    if (contextOptions.hasTouch) await page.locator('[data-test-settings]').tap();
    else await page.locator('[data-test-settings]').click();
    await page.waitForTimeout(300);
    await activate((await targetPoints(menuSelector))[1]);
    await page.waitForTimeout(300);
    assert.equal(await page.locator(checkbox).isChecked(), true, `${name}: selection was lost on reopening`);
    await closeTopSheet();

    // Actual time correction path: parent X must survive the nested TimePicker X,
    // and the chosen time must be committed back into that still-live parent.
    if (contextOptions.hasTouch) await page.locator('[data-test-time-range]').tap();
    else await page.locator('[data-test-time-range]').click();
    await page.locator('[data-shared-time-range-form]').waitFor();
    assert.equal(await page.locator('[data-modal]').count(), 1, `${name}: time-range parent X missing`);
    const fromTrigger = page.locator('[data-time-picker="from"] [data-time-open]');
    if (contextOptions.hasTouch) await fromTrigger.tap();
    else await fromTrigger.click();
    await page.locator('.modal--time-picker-sheet').waitFor();
    assert.equal(await page.locator('[data-modal]').count(), 2, `${name}: TimePicker replaced parent X instead of stacking`);
    assert.equal(await page.locator('[data-shared-time-range-form]').count(), 1, `${name}: time-range parent X was destroyed`);

    const hour10 = page.locator('[data-time-wheel-type="hours"][data-value="10"][data-cycle="2"]');
    const minute15 = page.locator('[data-time-wheel-type="minutes"][data-value="15"][data-cycle="2"]');
    if (contextOptions.hasTouch) {
      await hour10.tap();
      await minute15.tap();
    } else {
      await hour10.click();
      await minute15.click();
    }
    await page.waitForTimeout(250);

    const timeSave = page.locator('[data-time-save]');
    if (contextOptions.hasTouch) await timeSave.tap();
    else await timeSave.click();
    await page.waitForFunction(() => document.querySelectorAll('[data-modal]').length === 1);
    assert.equal(await page.locator('[data-shared-time-range-form]').count(), 1, `${name}: parent X did not survive TimePicker save`);
    assert.equal(await page.locator('[data-time-picker="from"] [data-time-value]').inputValue(), '10:15', `${name}: corrected time was not returned to parent X`);

    const rangeSubmit = page.locator('[data-shared-time-range-form] button[type="submit"]');
    if (contextOptions.hasTouch) await rangeSubmit.tap();
    else await rangeSubmit.click();
    await page.waitForFunction(() => document.querySelectorAll('[data-modal]').length === 0);
    assert.equal(await page.locator('[data-test-time-result]').textContent(), '10:15-18:00', `${name}: corrected time range did not save`);

    // X veil: tapping Header A while X is active must only dismiss the X.
    // The underlying A action must never fire from the same input.
    if (contextOptions.hasTouch) await page.locator('[data-test-settings]').tap();
    else await page.locator('[data-test-settings]').click();
    await page.locator('[data-modal]').waitFor();
    await activateSelector('[data-test-header-a]');
    await page.locator('[data-modal]').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-test-header-a-count]').textContent(), '0', `${name}: Header A fired through X veil`);

    // Q owns only Header C outside its sheet. C must remain live and must not dismiss Q;
    // tapping A is veil input: Q closes and A still must not fire.
    if (contextOptions.hasTouch) await page.locator('[data-test-open-q]').tap();
    else await page.locator('[data-test-open-q]').click();
    await page.locator('[data-test-q-content]').waitFor();
    assert.equal(await page.locator('[data-modal]').count(), 1, `${name}: Q missing or duplicated`);
    await activateSelector('[data-test-header-c]');
    assert.equal(await page.locator('[data-test-header-c-count]').textContent(), '1', `${name}: Q-owned Header C did not fire`);
    assert.equal(await page.locator('[data-modal]').count(), 1, `${name}: Q-owned Header C dismissed Q`);
    await activateSelector('[data-test-header-a]');
    await page.locator('[data-modal]').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-test-header-a-count]').textContent(), '0', `${name}: Header A fired through Q veil`);

    // Journal selector stacks while choosing, then its committed change explicitly closes the owning X.
    for (let cycle = 0; cycle < 3; cycle += 1) {
      const journalTrigger = page.locator('[data-test-journal-workplace]');
      if (contextOptions.hasTouch) await journalTrigger.tap();
      else await journalTrigger.click();

      const journalSelect = page.locator('[data-journal-workplace-select]').locator('..').locator('[data-ui-select-trigger]');
      await journalSelect.waitFor();
      assert.equal(await page.locator('[data-modal]').count(), 1, `${name}: Journal parent X missing or duplicated`);

      if (contextOptions.hasTouch) await journalSelect.tap();
      else await journalSelect.click();
      await page.locator('[data-ui-selector]').waitFor();
      assert.equal(await page.locator('[data-modal]').count(), 2, `${name}: Journal selector did not stack while parent input remained active`);

      const targetValue = cycle % 2 === 0 ? 'beauty' : '__all__';
      const option = page.locator(`[data-ui-select-option][data-value="${targetValue}"]`);
      if (contextOptions.hasTouch) await option.tap();
      else await option.click();

      await page.waitForFunction(() => document.querySelectorAll('[data-modal]').length === 0);
      assert.equal(await page.locator('.v2-app__stage').evaluate((node) => node.inert), false, `${name}: Journal stage stayed inert after workplace switch`);
      assert.equal(await page.locator('[data-test-journal-workplace]').isEnabled(), true, `${name}: Journal stopped responding after workplace switch`);
    }

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
    console.log(`${name}: PASS (nested TimePicker X, actual time correction, selector stack/handoff, veil dismissal, Q C ownership, trusted input, 10 sheet variants)`);
  } finally {
    await browser.close();
  }
}
console.log(JSON.stringify(results));