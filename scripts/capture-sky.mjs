/**
 * Renders the hero sequence in `src/components/MountainSkyline.tsx` to video.
 *
 * The sequence is frame-rate dependent (stars advance per draw call, not per
 * elapsed second), so this drives it one call per output frame at FPS rather
 * than recording in real time. That makes the result deterministic and free of
 * whatever jank the recording machine had.
 *
 * Two orientations are rendered because the sky is a full-bleed background:
 * a single fixed-aspect file would crop the range badly on tall phones.
 *
 * Rendering is the slow part, so each orientation is first written to a
 * lossless master under MEZZ. Re-encoding (tuning quality) reads that back and
 * skips the browser entirely — pass --reuse once a master exists.
 *
 *   node scripts/capture-sky.mjs           # render, then encode
 *   node scripts/capture-sky.mjs --reuse   # re-encode from the masters
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import ffmpeg from 'ffmpeg-static';

/** Matches T_END in MountainSkyline.tsx, plus a short tail on the settled sky. */
const DURATION = 16.8;
const FPS = 60;
const FRAMES = Math.round(DURATION * FPS);

const OUT = path.resolve('public/sky');
/** Lossless masters. Big and disposable — deliberately outside the repo. */
const MEZZ = process.env.SKY_MEZZ ?? '/tmp/sky-mezzanine';
const REUSE = process.argv.includes('--reuse');

/**
 * The timeline is two different encoding problems in one file. Up to ~7s it
 * is the hyperspace warp: violent motion that hides artefacts. After that the
 * sun flares, sets behind the range and the sky settles — near-static, smooth
 * emerald gradients where blocking and banding are the only thing you see.
 *
 * A single CRF has to serve both, and at a size worth shipping it serves the
 * second badly: the sky banded into visible patches and the faint stars were
 * quantised away. x264 zones split the budget instead, so the cheap half pays
 * for the half that matters.
 */
const SPLIT_AT = 7.0;

/**
 * Checked frame by frame against lossless renders of the same timestamps.
 * Above 33 the warp grows mosquito noise in the black between streaks; at 20
 * the flare and the set hold their gradients with no visible banding, and the
 * faint stars survive instead of being quantised away.
 */
const WARP_CRF = 33;
const CALM_CRF = 20;

/**
 * Rendered at 720p, not 1080p. This is an out-of-focus backdrop behind hero
 * copy, and the hyperspace leg is ~900 radial streaks on black — about the
 * most expensive thing you can hand an inter-frame codec. Full HD pushed the
 * landscape encode to 13MB; 720p upscaled is indistinguishable here and lands
 * an order of magnitude smaller. The sequence is resolution-independent (sun
 * radius and ridge geometry both derive from the viewport), so this is a real
 * 720p render rather than a downscale.
 */
const VARIANTS = [
  { name: 'landscape', width: 1280, height: 720 },
  { name: 'portrait', width: 720, height: 1280 },
];

/** Encode a raw PNG stream on stdin to one file. */
function encoder(args, label) {
  const proc = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-r', String(FPS), '-i', 'pipe:0', ...args], {
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  let err = '';
  proc.stderr.on('data', (d) => (err += d));
  proc.on('exit', (code) => {
    if (code !== 0) console.error(`\n[${label}] ffmpeg exited ${code}\n${err.slice(-1500)}`);
  });
  return proc;
}

/** Render one orientation to a lossless master by stepping the timeline. */
async function render(browser, base, v) {
  const page = await browser.newPage({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: 1,
  });
  await page.goto(`${base}/capture.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__sky && window.__sky.renderAt');

  const master = encoder(
    ['-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0',
     path.join(MEZZ, `${v.name}.mkv`)],
    `${v.name} master`,
  );

  for (let i = 0; i < FRAMES; i++) {
    await page.evaluate((t) => window.__sky.renderAt(t), i / FPS);
    const png = await page.screenshot({ type: 'png' });
    if (!master.stdin.write(png)) {
      await new Promise((r) => master.stdin.once('drain', r));
    }
    if (i % 60 === 0) process.stdout.write(`\r  ${v.name}: frame ${i}/${FRAMES}`);
  }
  process.stdout.write(`\r  ${v.name}: frame ${FRAMES}/${FRAMES}\n`);

  master.stdin.end();
  await new Promise((r) => master.on('exit', r));
  await page.close();
}

/** Encode the shippable MP4 and the still from a master. */
async function encode(v) {
  const src = path.join(MEZZ, `${v.name}.mkv`);
  const split = Math.round(SPLIT_AT * FPS);

  await run([
    '-y', '-i', src,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(WARP_CRF), '-g', '150',
    // aq-mode=3 biases bits toward dark, flat regions, which is precisely
    // where this footage falls apart.
    '-x264-params',
    `aq-mode=3:aq-strength=1.1:zones=0,${split - 1},crf=${WARP_CRF}/${split},${FRAMES - 1},crf=${CALM_CRF}`,
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    path.join(OUT, `${v.name}.mp4`),
  ]);

  // The final frame is the settled sky: the still for repeat visits and for
  // anyone whose video never plays. Taken from the master, not the MP4, so it
  // carries none of the delivery encode's artefacts.
  await run([
    '-y', '-sseof', '-0.1', '-i', src, '-frames:v', '1', '-q:v', '2',
    path.join(OUT, `${v.name}-settled.jpg`),
  ]);
}

/** Run ffmpeg to completion, failing loudly. */
function run(args) {
  return new Promise((res, rej) => {
    const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (d) => (err += d));
    proc.on('exit', (c) =>
      c === 0 ? res() : rej(new Error(`ffmpeg ${c}\n${err.slice(-1500)}`)),
    );
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(MEZZ, { recursive: true });

  if (!REUSE) {
    const server = await createServer({ server: { port: 5199, strictPort: true } });
    await server.listen();
    const browser = await chromium.launch();
    for (const v of VARIANTS) await render(browser, `http://localhost:5199`, v);
    await browser.close();
    await server.close();
  }

  for (const v of VARIANTS) {
    console.log(`  encoding ${v.name}...`);
    await encode(v);
  }

  console.log(`\nWrote ${OUT}`);
}


main().catch((e) => {
  console.error(e);
  process.exit(1);
});
