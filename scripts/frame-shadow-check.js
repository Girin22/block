async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173/');
  const canvas = page.locator('#playfield');
  await canvas.waitFor(); await page.waitForTimeout(500);
  await page.screenshot({ path: 'output/playwright/frame-shadow-horizontal.png' });
  await page.mouse.click(195, 300); await page.waitForTimeout(250);
  await page.screenshot({ path: 'output/playwright/frame-shadow-vertical.png' });
  await page.reload(); await canvas.waitFor();
  const spawn = await page.evaluate(async () => (await import('/packages/play-core/index.ts')).SPAWN_X);
  const drop = async (x, vertical) => {
    await canvas.focus();
    if (vertical) await page.keyboard.press('ArrowUp');
    for (let i = 0; i < Math.abs(x - spawn); i++) await page.keyboard.press(x < spawn ? 'ArrowLeft' : 'ArrowRight');
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(470);
  };
  // Build three motifs across, three courses high, through actual game input.
  for (let row = 0; row < 3; row++) for (const x of [0, 3, 6]) {
    await drop(x + 1, false); await drop(x, true); await drop(x + 2, true); await drop(x, false);
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'output/playwright/three-column-pattern.png' });
  await page.locator('#pause').click(); await page.locator('#export').click();
  await page.waitForFunction(() => !document.querySelector('#receipt-save').disabled);
  const pattern = await page.locator('#receipt-image').evaluate(root => {
    const uses = Array.from(root.querySelectorAll('use'));
    return { total: uses.length, centers: uses.filter(node => node.getAttribute('xlink:href') === '#tile-1-1').map(node => Number(node.getAttribute('x'))) };
  });
  if (pattern.total !== 45 || pattern.centers.length !== 9 || new Set(pattern.centers).size !== 3) throw new Error(`Wrong three-column pattern: ${JSON.stringify(pattern)}`);
  await page.screenshot({ path: 'output/playwright/three-column-export.png' });
  const shadows = await page.evaluate(async () => {
    const { Pavement } = await import('/packages/play-core/index.ts');
    const { PlayScene } = await import('/apps/play/src/scene.ts');
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:390px;height:844px;';
    document.body.append(canvas);
    const board = new Pavement(), scene = new PlayScene(canvas, board, () => {});
    scene.spawn(); scene.beginDrag();
    await new Promise(resolve => setTimeout(resolve, 300));
    const far = scene.fallingShadow.mesh.material.opacity;
    scene.lower(scene.activeY - .3);
    await new Promise(resolve => setTimeout(resolve, 80));
    const near = scene.fallingShadow.mesh.material.opacity;
    scene.lower(1);
    await new Promise(resolve => setTimeout(resolve, 80));
    const contact = scene.fallingShadow.mesh.material.opacity;
    const frameMeshes = scene.frameTiles.size;
    scene.dispose(); canvas.remove();
    if (far !== .4 || near <= 0 || near >= far || contact !== 0 || frameMeshes > 40) throw new Error(`Invalid shadow/frame: ${far}/${near}/${contact}/${frameMeshes}`);
    return { far, near, contact, frameMeshes };
  });
  await page.goto('http://127.0.0.1:5173/?stress=100&layout=tower');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'output/playwright/frame-scroll.png' });
  await page.goto('http://127.0.0.1:5173/');
  if (errors.length) throw new Error(errors.join('\n'));
  return { pattern, shadows, runtimeErrors: errors };
}
