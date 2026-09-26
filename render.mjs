// Frame-exact MP4 export: headless Chrome renders every frame, ffmpeg encodes.
// Usage: npm install && npm run render            -> singularity.mp4
//        node render.mjs out.mp4
import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || 'singularity.mp4';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href + '?render=1');
await page.waitForFunction('window.VIDEO && window.renderFrame');
await page.evaluate(() => document.fonts && document.fonts.ready);

const { FPS, DURATION } = await page.evaluate(() => window.VIDEO);
const frames = Math.round(FPS * DURATION);

const ff = spawn('ffmpeg', [
  '-y', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart', out
], { stdio: ['pipe', 'inherit', 'inherit'] });

for (let i = 0; i < frames; i++) {
  const b64 = await page.evaluate(i => {
    window.renderFrame(i / window.VIDEO.FPS);
    return document.getElementById('c').toDataURL('image/png').split(',')[1];
  }, i);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 30 === 0) process.stdout.write(`\rframe ${i + 1}/${frames}`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`\nwrote ${out}`);
