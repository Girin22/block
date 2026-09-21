async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const swipe = async (x1, y1, x2, y2) => {
    await page.mouse.move(x1, y1); await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 16 }); await page.mouse.up();
  };
  const receipt = async () => {
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: '일시정지', exact: true }).click();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.locator('#receipt-image svg').waitFor();
    return page.locator('#receipt-image use').evaluateAll(nodes => nodes.map(node => ({
      x: node.getAttribute('x'), shape: node.getAttribute('xlink:href'),
    })));
  };
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForTimeout(200);
  // Start far below the active tile. Sideways jitter exceeds half a cell.
  await swipe(100, 360, 135, 740);
  const vertical = await receipt();
  if (vertical.length !== 1) throw new Error('Empty-screen down swipe did not place exactly one tile');
  if (Math.abs(Number(vertical[0].x) - (40 + 4 * 264 / 9)) > .001) throw new Error('Vertical swipe drifted sideways');
  await page.reload(); await page.waitForTimeout(200);
  // Empty-screen tap rotates vertical, horizontal swipe moves to the right wall,
  // second empty-screen tap rotates horizontal with a wall kick.
  await page.mouse.click(90, 400);
  await swipe(100, 400, 290, 405);
  await page.mouse.click(90, 400);
  await swipe(100, 360, 135, 740);
  const right = await receipt();
  if (right.length !== 1 || right[0].shape !== '#tile-2-1') throw new Error('Wall rotation failed');
  if (Math.abs(Number(right[0].x) - (40 + 8 * 264 / 9)) > .001) throw new Error('Right wall kick did not settle at column seven');
  if (Number(right[0].x) <= Number(vertical[0].x)) throw new Error('Empty-screen horizontal swipe failed');
  await page.goto('http://127.0.0.1:5173/?stress=100&layout=tower');
  await page.waitForTimeout(300);
  await swipe(100, 360, 125, 740);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'output/playwright/screen-input-stack.png' });
  if (errors.length) throw new Error(errors.join('\n'));
  return { vertical, right, errors, passed: true };
}
