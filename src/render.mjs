// Frame-exact offline renderer: headless Chromium draws each frame of reel.html,
// frames are piped straight into ffmpeg (H.264, 1080x1920, 60fps).
//
//   node src/render.mjs                       -> out/mungyeong_reel_silent.mp4
//   node src/render.mjs --stills 0.3,0.8,4.4  -> out/stills/t0.300.png ...
//   options: --page src/collage/collage.html  --samples N (motion-blur sub-frames, default 6)  --out path
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const samples = +(args.samples ?? 6);

const ffmpeg = process.env.FFMPEG || (() => {
  try { return execSync('python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"').toString().trim(); } catch { return 'ffmpeg'; }
})();
const chromePath = process.env.CHROME || ['/opt/pw-browsers/chromium', '/usr/bin/chromium'].find(existsSync);

const browser = await chromium.launch({ executablePath: chromePath, args: ['--disable-gpu-vsync', '--force-color-profile=srgb', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => { console.error('page error:', e); process.exit(1); });
await page.goto('file://' + resolve(ROOT, args.page ?? 'src/reel.html') + '?render');
await page.evaluate(() => window.REEL.ready);
const { frames, FPS } = await page.evaluate(() => ({ frames: window.REEL.frames, FPS: window.REEL.FPS }));

const grab = t => page.evaluate(([t, n]) => {
  window.REEL.renderFrame(t, n);
  return document.getElementById('c').toDataURL('image/png');
}, [t, samples]).then(u => Buffer.from(u.split(',')[1], 'base64'));

if (args.stills) {
  const dir = resolve(ROOT, args.out ?? 'out/stills');
  mkdirSync(dir, { recursive: true });
  for (const t of args.stills.split(',').map(Number)) {
    writeFileSync(resolve(dir, `t${t.toFixed(3)}.png`), await grab(t));
  }
  console.log('stills ->', dir);
} else {
  const out = resolve(ROOT, args.out ?? 'out/mungyeong_reel_silent.mp4');
  mkdirSync(dirname(out), { recursive: true });
  const ff = spawn(ffmpeg, [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const buf = await grab(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 30 === 0) process.stdout.write(`frame ${i}/${frames} (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', code => (code ? rej(new Error('ffmpeg ' + code)) : res())));
  console.log('video ->', out);
}
await browser.close();
