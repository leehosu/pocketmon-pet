import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const IN = process.argv[2] || path.join(dir, 'banner.html');
const OUT = process.argv[3] || path.join(dir, 'banner.png');
const W = 1200, H = 600;

app.commandLine.appendSwitch('force-device-scale-factor', '2'); // 2x for crisp README image

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: W, height: H, useContentSize: true, show: false, frame: false,
    webPreferences: { offscreen: false },
  });
  await win.loadFile(IN);
  // wait until the page finishes chroma-keying + rendering (window.__ready)
  for (let i = 0; i < 60; i++) {
    const ready = await win.webContents.executeJavaScript('!!window.__ready').catch(() => false);
    if (ready) break;
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 250));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(OUT, img.toPNG());
  const { width, height } = img.getSize();
  console.log(`WROTE ${OUT} ${width}x${height}`);
  app.quit();
});
