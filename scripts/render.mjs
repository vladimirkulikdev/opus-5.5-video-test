// Frame-exact offline render: drives SV.renderAt(t) in headless Chrome and pipes PNG frames into ffmpeg.
// Usage: npm install && npm run render            (needs ffmpeg on PATH)
//        node scripts/render.mjs out.mp4 60
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || 'singularity.mp4';
const fps = Number(process.argv[3] || 60);

const browser = await puppeteer.launch({ headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(pathToFileURL(path.join(here, '..', 'index.html')).href + '?headless=1', { waitUntil: 'networkidle0' });
await page.waitForFunction('window.SV && window.SV.ready === true');
const total = await page.evaluate(() => window.SV.TOTAL);
const frames = Math.round(total * fps);

const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', out], { stdio: ['pipe', 'inherit', 'inherit'] });

for (let i = 0; i < frames; i++) {
  const b64 = await page.evaluate((t) => {
    window.SV.renderAt(t);
    return window.SV.canvas.toDataURL('image/png').split(',')[1];
  }, i / fps);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % fps === 0) console.log(`frame ${i} / ${frames}`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log(`wrote ${out}`);
