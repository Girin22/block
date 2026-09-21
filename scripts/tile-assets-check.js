async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('#playfield').waitFor();
  // Freeze game time to inspect every rotation and a deterministic mixed board.
  const result = await page.evaluate(async () => {
    const { Pavement } = await import('/packages/play-core/index.ts');
    const { PlayScene } = await import('/apps/play/src/scene.ts');
    const { Receipt, receiptPhoto } = await import('/apps/play/src/export.ts');
    document.querySelector('#pause').click();
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:390px;height:844px;z-index:9999';
    document.body.append(canvas);
    // Close only the dialog DOM so the original game remains paused underneath.
    document.querySelector('#pause-menu').removeAttribute('open');
    const board = new Pavement();
    board.drop(1, 0); board.drop(0, 1); board.drop(2, 1); board.drop(0, 0);
    board.drop(4, 2); board.drop(5, 3);
    const scene = new PlayScene(canvas, board, () => {});
    scene.add(board.tiles); scene.spawn();
    await new Promise(resolve => setTimeout(resolve, 500));
    scene.pause(true);
    window.assetScene = scene;
    const receipt = new Receipt(board, new Date(2026, 8, 21));
    const png = await receiptPhoto(receipt);
    const svg = receipt.svg();
    const images = Array.from(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelectorAll('image'));
    if (images.length !== 3 || images.some(image => !image.getAttribute('xlink:href').startsWith('data:image/png;base64,'))) throw new Error('Export must embed all three images');
    return { tiles: board.tiles.length, white: board.tiles.filter(tile => tile.white).length, pngBytes: png.size, pngWidth: receipt.width * 2 };
  });
  for (let rotation = 0; rotation < 4; rotation++) {
    await page.evaluate(rotation => {
      window.assetScene.aim(2, rotation);
      window.assetScene.active.rotation.z = rotation * Math.PI / 2;
      window.assetScene.active.position.x = 2 + (rotation % 2 ? .5 : 1);
    }, rotation);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `output/playwright/tile-assets-${rotation}.png` });
  }
  await page.evaluate(() => { window.assetScene.dispose(); });
  if (errors.length) throw new Error(errors.join('\n'));
  return { ...result, rotations: 4, runtimeErrors: errors };
}
