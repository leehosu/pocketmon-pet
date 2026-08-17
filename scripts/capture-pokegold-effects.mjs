// AI-GENERATED: captures deterministic transparent frames from the shared Gold renderer.
import { app, BrowserWindow } from 'electron';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { POKEGOLD_MOVES, POKEGOLD_OAM_SETS } from '../src/renderer/pokegold-anim-data.js';
import { PokegoldAnimationVM } from '../src/renderer/pokegold-anim-vm.js';

const repoRoot = resolve(import.meta.dirname, '..');
const outputDir = resolve(process.argv[2] || '/tmp/pocketmon-pokegold-captures');
const viewportWidth = Math.max(320, Number(process.argv[3]) || 640);
const viewportHeight = Math.max(240, Number(process.argv[4]) || 480);
const spritePath = join(homedir(), '.pocketmon/sprites/electric_2.png');
const sprite = `data:image/png;base64,${readFileSync(spritePath).toString('base64')}`;

function selectFrames(effect) {
  const vm = new PokegoldAnimationVM(effect);
  const scored = [];
  while (!vm.done) {
    const state = vm.step();
    const score = state.objects.reduce((sum, object) => (
      sum + (object.renderStep?.oam ? (POKEGOLD_OAM_SETS[object.renderStep.oam]?.length || 0) : 0)
    ), 0);
    if (score > 0) scored.push({ frame: state.frame, score });
  }
  if (!scored.length) throw new Error(`${effect} has no renderable Gold object frame`);
  const peak = scored.reduce((best, entry) => (entry.score > best.score ? entry : best), scored[0]);
  return {
    duration: vm.frame + 1,
    frames: [...new Set([
      scored[0].frame,
      peak.frame,
      scored[Math.floor(scored.length * 0.75)].frame,
    ])],
    hero: peak.frame,
  };
}

function cornerAlphas(image) {
  const { width, height } = image.getSize();
  const bitmap = image.toBitmap();
  const alphaAt = (x, y) => bitmap[(y * width + x) * 4 + 3];
  return [alphaAt(0, 0), alphaAt(width - 1, 0), alphaAt(0, height - 1), alphaAt(width - 1, height - 1)];
}

async function waitForFrame(window, frame) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const ready = await window.webContents.executeJavaScript(`({
      ready: document.documentElement.dataset.pokegoldReady,
      frame: document.documentElement.dataset.pokegoldFrame
    })`);
    if (ready.ready === 'true' && Number(ready.frame) === frame) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  throw new Error(`Timed out waiting for Gold frame ${frame}`);
}

app.setPath('userData', '/tmp/pocketmon-pokegold-capture-user-data');

app.whenReady().then(async () => {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  const window = new BrowserWindow({
    width: viewportWidth,
    height: viewportHeight,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    webPreferences: { backgroundThrottling: false },
  });
  const page = join(repoRoot, 'src/renderer/effect-overlay.html');
  const manifest = { viewport: { width: viewportWidth, height: viewportHeight }, effects: {} };

  for (const effect of Object.keys(POKEGOLD_MOVES)) {
    const selection = selectFrames(effect);
    const captures = [];
    for (const frame of selection.frames) {
      await window.loadFile(page, { query: { effect, sprite, frame: String(frame) } });
      await waitForFrame(window, frame);
      const image = await window.webContents.capturePage();
      const alphas = cornerAlphas(image);
      if (alphas.some(Boolean)) throw new Error(`${effect}@${frame} has opaque corner alpha: ${alphas.join(',')}`);
      const file = `${effect.replace(/^gsc_/, '')}-${String(frame).padStart(3, '0')}.png`;
      writeFileSync(join(outputDir, file), image.toPNG());
      captures.push({ frame, file, cornerAlphas: alphas });
      if (frame === selection.hero) writeFileSync(join(outputDir, `${effect.replace(/^gsc_/, '')}-hero.png`), image.toPNG());
    }
    manifest.effects[effect] = { duration: selection.duration, hero: selection.hero, captures };
    process.stdout.write(`${effect} ${selection.duration}f hero=${selection.hero}\n`);
  }
  writeFileSync(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  window.destroy();
  app.quit();
}).catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  app.exit(1);
});

// Keep this an Electron entrypoint when invoked through node by mistake.
if (!process.versions.electron) {
  throw new Error(`Run with Electron: ${pathToFileURL(process.execPath).href}`);
}
