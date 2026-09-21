async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173/');
  const canvas = page.locator('#playfield');
  await canvas.waitFor(); await page.waitForTimeout(600);
  const idle = await canvas.screenshot();
  await page.waitForTimeout(1200);
  if (!idle.equals(await canvas.screenshot())) throw new Error('Game moved before first interaction');
  const keys = async values => {
    await canvas.focus();
    for (const key of values) await page.keyboard.press(key);
    await page.waitForTimeout(550);
  };
  await keys(['ArrowLeft', 'ArrowLeft', 'ArrowDown']);
  await keys(['ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowDown']);
  await keys(['ArrowUp', 'ArrowLeft', 'ArrowDown']);
  await keys(['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowDown']);
  await page.screenshot({ path: 'output/playwright/local-play-ring.png' });
  await page.locator('#pause').click(); await page.locator('#export').click();
  await page.waitForFunction(() => !document.querySelector('#receipt-save').disabled);
  const pieces = await page.locator('#receipt-image use').evaluateAll(nodes => nodes.map(node => node.getAttribute('xlink:href')));
  if (pieces.length !== 5 || pieces.filter(shape => shape === '#tile-1-1').length !== 1) throw new Error('Actual input did not create four blocks and a white center');
  if (pieces.filter(shape => shape === '#tile-1-2').length !== 2) throw new Error('Vertical placement lost orientation');
  await page.screenshot({ path: 'output/playwright/local-play-export.png' });
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
  await page.locator('#receipt-save').click();
  const png = await page.locator('#receipt-image img').evaluate(async image => {
    await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight };
  });
  if (png.width !== 688) throw new Error('Wrong saved PNG width');
  // Closing the save preview preserves the session; confirming completion clears it.
  await page.locator('#receipt-back').click(); await page.locator('#export').click();
  if (!(await page.locator('#receipt-image text').textContent()).includes('05 piece')) throw new Error('Closing export erased session');
  await page.waitForFunction(() => !document.querySelector('#receipt-save').disabled);
  await page.locator('#receipt-save').click(); await page.locator('#receipt-save').click();
  await page.locator('#pause').click(); await page.locator('#export').click();
  if (!(await page.locator('#receipt-image text').textContent()).includes('· piece')) throw new Error('Save completion did not reset');
  await page.goto('http://127.0.0.1:5173/'); await page.waitForTimeout(300);
  await page.mouse.move(195, 350); await page.mouse.down();
  await page.mouse.move(195, 380, { steps: 5 }); await page.waitForTimeout(500);
  const held = await canvas.screenshot(); await page.waitForTimeout(1100);
  if (!held.equals(await canvas.screenshot())) throw new Error('Held block continued falling');
  await page.mouse.up();
  // No fast-drop swipe: regular automatic fall must still land by itself.
  await page.waitForTimeout(21000);
  await page.locator('#pause').click(); await page.locator('#export').click();
  if (!(await page.locator('#receipt-image text').textContent()).includes('01 piece')) throw new Error('Automatic fall failed after release');
  await page.locator('#receipt-back').click();
  await page.waitForTimeout(1000); await page.locator('#export').click();
  if (!(await page.locator('#receipt-image text').textContent()).includes('01 piece')) throw new Error('Pause changed board');
  await page.locator('#receipt-back').click(); await page.locator('#pause').click();
  await page.reload();
  if (errors.length) throw new Error(errors.join('\n'));
  return { idleUntilTouch: true, actualInputRing: pieces, png, closePreserves: true, saveResets: true, heldStopsFall: true, autoFall: true, pause: true, errors };
}
