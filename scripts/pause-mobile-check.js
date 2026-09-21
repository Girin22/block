async (page) => {
  const errors = [], failedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ABORTED')) failedRequests.push(request.url()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#pause.icon-ready').waitFor({ timeout: 15000 });
  const button = page.locator('#pause'), icon = page.locator('#pause-animation');
  const initial = await icon.screenshot();
  await button.click(); await page.waitForTimeout(90);
  if ((await icon.screenshot()).equals(initial)) throw new Error('Forward Lottie did not animate');
  if (await page.locator('dialog[open]').count()) throw new Error('Pause opened a popup');
  await page.waitForTimeout(950);
  const cone = await icon.screenshot();
  if (cone.equals(initial)) throw new Error('Cone frame matches pause frame');
  if (await button.textContent()) throw new Error('Resume has visible text');
  await button.click(); await page.waitForTimeout(90);
  const reversing = await icon.screenshot();
  if (reversing.equals(initial) || reversing.equals(cone)) throw new Error('Reverse Lottie skipped animation');
  await page.waitForTimeout(950);
  if (!(await icon.screenshot()).equals(initial)) throw new Error('Reverse did not restore pause frame');
  for (let i = 0; i < 6; i++) { await button.click(); await page.waitForTimeout(70); }
  await page.waitForTimeout(1100);
  if (await button.getAttribute('aria-pressed') !== 'false' || !(await icon.screenshot()).equals(initial)) throw new Error('Fast toggles desynchronized icon');

  const sizes = [];
  for (const [width, height] of [[320,568], [360,800], [390,844], [402,874], [430,932], [844,390], [768,1024]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(120);
    const bounds = await page.locator('.play').boundingBox();
    if (bounds.x < -.1 || bounds.x + bounds.width > width + .1 || Math.abs(bounds.height - height) > 1) throw new Error('Game extends beyond viewport');
    if (width <= 430 && Math.abs(bounds.width - width) > 1) throw new Error('Phone game does not use full width');
    // The staggered pause entrance settles at 0.8 seconds.
    await button.click(); await page.waitForTimeout(1000);
    const exportBounds = await page.locator('#export').boundingBox();
    if (exportBounds.y < 0 || exportBounds.y + exportBounds.height > height) throw new Error('Pause actions clipped');
    await page.screenshot({ path: `output/playwright/pause-${width}x${height}.png` });
    sizes.push({ width, height, gameWidth: bounds.width });
    await button.click();
  }
  await page.setViewportSize({ width: 402, height: 874 });
  await page.reload(); await page.locator('#pause.icon-ready').waitFor();
  const canvas = page.locator('#playfield');
  const spawn = await page.evaluate(async () => (await import('/packages/play-core/index.ts')).SPAWN_X);
  const drop = async (x, vertical) => {
    await canvas.focus(); if (vertical) await page.keyboard.press('ArrowUp');
    for (let i = 0; i < Math.abs(x - spawn); i++) await page.keyboard.press(x < spawn ? 'ArrowLeft' : 'ArrowRight');
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(440);
  };
  for (let row = 0; row < 3; row++) for (const x of [0, 3, 6]) {
    await drop(x + 1, false); await drop(x, true); await drop(x + 2, true); await drop(x, false);
  }
  await button.click(); await page.waitForTimeout(1100);
  const counts = await page.locator('#pause-actions').innerText();
  if (!(counts.includes('36') && counts.includes('9'))) throw new Error(`Incorrect counts: ${counts}`);
  await page.screenshot({ path: 'output/playwright/pause-pattern-mobile.png' });
  const boardShot = () => canvas.screenshot({ style: '#pause, #pause-actions { visibility: hidden !important; }' });
  const frozen = await boardShot();
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500);
  if (!(await boardShot()).equals(frozen)) throw new Error('Paused board continued moving');
  await page.locator('#export').click();
  await page.waitForFunction(() => !document.querySelector('#receipt-save').disabled);
  if (await page.locator('dialog[open]').count() !== 1) throw new Error('Export did not open popup');
  if (!(await page.locator('#receipt-image text').textContent()).includes('45 piece')) throw new Error('Export lost paused tiles');
  await page.screenshot({ path: 'output/playwright/pause-export-mobile.png' });
  await page.locator('#receipt-back').click();
  if (await button.getAttribute('aria-pressed') !== 'true') throw new Error('Closing export resumed game');
  await page.locator('#export').click(); await page.keyboard.press('Escape');
  if (await page.locator('dialog[open]').count() || await button.getAttribute('aria-pressed') !== 'true') throw new Error('Escape broke pause');
  await page.locator('#export').click();
  await page.waitForFunction(() => !document.querySelector('#receipt-save').disabled);
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
  await page.locator('#receipt-save').click(); await page.locator('#receipt-image img').evaluate(image => image.decode());
  await page.locator('#receipt-save').click(); await page.waitForTimeout(1100);
  if (await button.getAttribute('aria-pressed') !== 'false' || await page.locator('dialog[open]').count()) throw new Error('Save did not reset and resume');
  await button.click();
  if ((await page.locator('#green-count').textContent()) !== '0' || (await page.locator('#white-count').textContent()) !== '0') throw new Error('Counts not reset');
  await button.click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await button.click(); await page.waitForTimeout(80);
  await button.click(); await page.waitForTimeout(80);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('http://127.0.0.1:5173/?stress=172800');
  if (!(await button.isDisabled())) throw new Error('Limit allows resume');
  await page.locator('#export').click(); await page.locator('#receipt-back').click();
  await page.goto('http://127.0.0.1:5173/');
  if (errors.length || failedRequests.length) throw new Error(JSON.stringify({ errors, failedRequests }));
  return { sizes, lottieForwardReverse: true, fastToggles: true, counts: { green: 36, white: 9 }, exportPopup: true, closeStaysPaused: true, saveResets: true, cap: true, errors };
}
