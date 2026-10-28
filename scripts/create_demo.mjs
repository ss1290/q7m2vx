/** Record the real app plus technical slides with disclosed Windows TTS narration.
 * Prerequisites: app at localhost:8000, Chromium installed, imageio-ffmpeg in .venv.
 * Run: node scripts/create_demo.mjs
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const output = resolve('artifacts/demo');
mkdirSync(output, { recursive: true });
const python = resolve('.venv/Scripts/python.exe');
const segments = [
  {
    title: 'Part 1 | Customer pilot overview',
    view: 'overview',
    narration: `Welcome to Windward, a pilot for day-ahead power procurement. This presentation uses computer-generated narration. The commercial problem is simple: wind changes with the weather, but tomorrow's power must be bought today. Windward helps your team see the wind forecast available at a chosen decision time, then understand how much it has historically missed. This pilot uses only the two Elexon datasets requested in the brief. It covers buying decisions made in January 2026. It does not invent demand, prices or purchase volumes.`,
  },
  {
    title: 'The forecast you could actually have seen',
    view: 'overview',
    action: 'chart',
    narration: `The decision window is January first through January thirty-first. The default cutoff is nine AM London time. This is an editable pilot assumption, not a claimed exchange deadline. Every decision date maps to delivery on the following day. Here I select January fifteenth to inspect January sixteenth delivery. The green line is the latest forecast published before the cutoff. The dashed line is actual wind generation. The publication timestamp below the chart makes the comparison auditable. Changing the cutoff recalculates the selection rather than using today's latest forecast.`,
  },
  {
    title: 'Quantify the uncertainty',
    view: 'accuracy',
    narration: `Across all seven hundred and forty-four delivery hours, the default analysis has complete matched coverage. Mean absolute error is about two thousand and thirty-nine megawatts. Root mean square error is about two thousand five hundred and five. Bias is positive, about seventeen hundred and forty-eight megawatts, meaning wind was overforecast on average. Historical P ninety absolute error is about four thousand and ninety-nine megawatts. These statistics are retrospective evaluation, not a guaranteed future interval. The daily chart reveals which decisions had larger misses. The benefit is better visibility into wind exposure, without pretending wind alone determines what to buy.`,
  },
  {
    title: 'Take the evidence with you',
    view: 'data',
    narration: `The data explorer exposes the evidence behind each hour: decision date, delivery start, publication time, forecast, actual, signed error and forecast lead time. Export CSV downloads the same filtered rows for review in a trading workbook. Missing data remain missing and would reduce coverage, rather than being filled with invented values. The methodology page also records the exact sources and snapshot checksums. For a next pilot, I would agree the team's real cutoff, evaluate a longer history, and calibrate a risk policy before making operational buying recommendations.`,
  },
  {
    title: 'Part 2 | Architecture and request flow',
    slide: 'architecture',
    narration: `Now the technical handover. React and TypeScript provide the dashboard. FastAPI in Python validates filters, calls the pure analysis functions, and returns summary, daily and hourly results. An offline downloader fetches the two Elexon streams into a versioned JSON snapshot. The request path never calls Elexon. For this small fixed historical window, a database would add deployment complexity without improving the product. Docker serves the compiled React app and API on one origin. The Vercel configuration instead serves static React assets alongside the same Python ASGI application.`,
  },
  {
    title: 'Selection, alignment, and units',
    slide: 'analysis',
    narration: `The most important design choice is preventing look-ahead leakage. For each delivery target, the code selects the maximum publication timestamp less than or equal to the decision cutoff. Although the broad brief mentions half-hour targets, the actual WINDFOR responses contain hourly targets. FUELHH actuals are half-hourly. Therefore each forecast hour is compared against the mean of the two WIND actual values in that hour. Both observations must exist. We average power in megawatts, and multiply by one hour only when calculating energy. Actual revisions use the latest available version. Error is forecast minus actual, so positive error means overforecast wind.`,
  },
  {
    title: 'Codebase, tests, and development practices',
    slide: 'tests',
    narration: `The backend separates the pure analysis core, snapshot loading, and HTTP routes. React owns presentation state and cancels stale requests when filters change. The fetcher has bounded retries, four workers, exact-version deduplication and per-file atomic writes. Sixteen backend checks passed, covering cutoff equality, future publication exclusion, missing half hours, real zeros, revisions, January boundaries, metric formulas, validation and CSV output. Two browser checks passed for desktop workflows and mobile navigation. TypeScript compilation and the production build succeeded. Formatting is applied with Prettier and Ruff, and comments explain the important domain choices.`,
  },
  {
    title: 'Reproducibility and delivery status',
    slide: 'delivery',
    narration: `To run locally, install the dependencies, build React, and start Uvicorn. Docker Compose provides a single-service alternative when the Docker engine is available. The README documents every directory, commands, formulas, data sources and AI assistance. The public GitHub repository uses the anonymous name shown on this slide. The historical snapshot contains real data and provenance checksums. At recording time, public Vercel deployment and unlisted YouTube upload still require account access. Docker configuration is included, but the local engine could not start. Those remaining external checks are explicitly disclosed. The submission form has not been sent without the required hosted app and video links.`,
  },
];

function command(program, args) {
  const result = spawnSync(program, args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${program} failed`);
  return result.stdout.trim();
}
const encoder = command(python, [
  '-c',
  'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())',
]);
const escapeHtml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function slideContent(kind) {
  const cards = {
    architecture: `<div class="flow">Elexon streams <b>&rarr;</b> Offline snapshot <b>&rarr;</b> FastAPI <b>&rarr;</b> React</div><div class="grid"><section><h3>React + TypeScript</h3><p>Filters, charts, audit table, CSV and methodology.</p></section><section><h3>Python + FastAPI</h3><p>Validated API, pure analysis core and bounded caching.</p></section><section><h3>Reproducible data</h3><p>19,272 forecast versions. 1,488 WIND actuals. Source URLs and SHA-256 hashes.</p></section><section><h3>Two delivery paths</h3><p>Docker: one Python service. Vercel: static assets plus Python ASGI function.</p></section></div>`,
    analysis: `<div class="grid"><section><h3>Decision-time integrity</h3><p>latest publishTime &le; decision cutoff<br>Decision D &rarr; delivery D+1</p></section><section><h3>Hourly alignment</h3><p>Hourly actual MW = mean of two half-hours.<br>Require both. Never fill missing values.</p></section></div><pre>${escapeHtml(readFileSync('backend/analysis.py', 'utf8').split('eligible =')[1]?.slice(0, 1100) ?? '')}</pre>`,
    tests: `<div class="grid"><section><h3>16 backend checks passed</h3><p>Publication boundaries &middot; No look-ahead &middot; Revisions<br>Missing values &middot; Units &middot; January boundaries<br>Metric formulas &middot; API validation &middot; CSV</p></section><section><h3>2 browser checks passed</h3><p>Desktop filters and navigation<br>CSV download and audit table expansion<br>Mobile navigation and overflow</p></section><section><h3>Production build passed</h3><p>TypeScript compilation<br>React static build with split chart bundle</p></section><section><h3>Readable code</h3><p>Prettier + Ruff formatting<br>Comments for domain logic<br>README and architecture handover</p></section></div>`,
    delivery: `<div class="flow">github.com/ss1290/q7m2vx</div><div class="grid"><section><h3>Ready locally</h3><p>React + Python application<br>Real historical snapshot<br>Tests, Docker configuration and Vercel configuration<br>Documentation and narrated demo draft</p></section><section><h3>External steps still pending</h3><p>Authenticated Vercel deployment<br>Unlisted YouTube upload<br>Public access verification and final form<br>Docker engine build verification</p></section></div><pre>docker compose up --build

# Or build React and serve with Python
npm run build
python -m uvicorn backend.main:app --port 8000</pre>`,
  };
  return cards[kind];
}

const browser = await chromium.launch();
const clips = [];
// Resume from a zero-based segment after an interrupted recording.
const startAt = Number(process.argv.find((arg) => arg.startsWith('--from='))?.split('=')[1] ?? 0);
let script =
  '# Windward demo narration\n\nComputer-generated narration, disclosed in the recording. Two parts, under ten minutes total.\n\n';
for (let index = 0; index < segments.length; index++) {
  const segment = segments[index];
  if (index < startAt) {
    const existing = resolve(output, `segment-${index}.mp4`);
    if (!existsSync(existing)) throw new Error(`Missing earlier segment: ${existing}`);
    clips.push(existing);
    script += `## ${segment.title}\n\n${segment.narration}\n\n`;
    continue;
  }
  const wav = resolve(output, `voice-${index}.wav`);
  const textPath = resolve(output, `voice-${index}.txt`);
  writeFileSync(textPath, segment.narration);
  const speech = `Add-Type -AssemblyName System.Speech; $voice = [System.Speech.Synthesis.SpeechSynthesizer]::new(); $voice.Rate = 0; $voice.SetOutputToWaveFile('${wav.replaceAll("'", "''")}'); $voice.Speak([IO.File]::ReadAllText('${textPath.replaceAll("'", "''")}')); $voice.Dispose()`;
  command('powershell.exe', [
    '-NoProfile',
    '-EncodedCommand',
    Buffer.from(speech, 'utf16le').toString('base64'),
  ]);
  const duration = Number(
    command(python, [
      '-c',
      'import wave,sys; w=wave.open(sys.argv[1]); print(w.getnframes()/w.getframerate())',
      wav,
    ]),
  );
  console.log(
    `Recording ${index + 1}/${segments.length}: ${segment.title} (${duration.toFixed(1)}s)`,
    { flush: true },
  );
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    recordVideo: { dir: output, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const started = performance.now();
  if (segment.view) {
    await page.goto('http://127.0.0.1:8000');
    await page.getByText('744 of 744 delivery hours matched').waitFor();
    if (segment.view === 'accuracy')
      await page.getByRole('button', { name: 'Forecast accuracy', exact: true }).click();
    if (segment.view === 'data')
      await page.getByRole('button', { name: 'Data explorer', exact: true }).click();
    if (segment.action === 'chart') {
      await page.getByLabel('Chart decision day').selectOption('2026-01-15');
      await page.locator('.charts-grid').scrollIntoViewIfNeeded();
    }
    await page.addStyleTag({
      content:
        '.demo-label{position:fixed;bottom:12px;right:20px;background:#12372bee;color:#e5efd9;padding:10px 15px;border-radius:7px;z-index:1000;font:12px sans-serif;box-shadow:0 2px 15px #0002}',
    });
    await page.evaluate((title) => {
      const label = document.createElement('div');
      label.className = 'demo-label';
      label.textContent = title + ' | Synthetic narration';
      document.body.append(label);
    }, segment.title);
  } else {
    await page.setContent(
      `<html><head><style>body{margin:0;background:#f7f8f1;color:#294332;font:23px Arial;padding:70px 90px}small{font-size:14px;letter-spacing:3px;color:#7d916a}h1{font-size:40px;margin:17px 0 35px;letter-spacing:-1px}.flow{background:#e6eed9;padding:25px;border-radius:10px;font-size:28px;margin-bottom:28px}.flow b{padding:0 13px;color:#809c66}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}section{background:white;border:1px solid #dfe6d5;border-radius:10px;padding:23px}h3{margin:0 0 13px;font-size:23px}p{font-size:19px;line-height:1.65;margin:0;color:#7b8b71}pre{font:16px/1.7 Consolas;background:#173d2b;color:#d9e7c8;padding:22px;border-radius:10px;overflow:hidden;max-height:290px;white-space:pre-wrap}footer{position:fixed;bottom:25px;left:90px;font-size:13px;color:#91a17d}</style></head><body><small>WINDWARD / TECHNICAL HANDOVER</small><h1>${segment.title}</h1>${slideContent(segment.slide)}<footer>January 2026 pilot | Synthetic narration | ${index + 1} / ${segments.length}</footer></body></html>`,
    );
  }
  const delay = (performance.now() - started) / 1000;
  await page.waitForTimeout((duration + 1) * 1000);
  const video = page.video();
  await context.close();
  const webm = await video.path();
  const clip = resolve(output, `segment-${index}.mp4`);
  command(encoder, [
    '-y',
    '-i',
    webm,
    '-i',
    wav,
    '-filter_complex',
    `[1:a]adelay=${Math.round(delay * 1000)}:all=1[a]`,
    '-map',
    '0:v',
    '-map',
    '[a]',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '24',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-t',
    String(delay + duration + 0.7),
    '-movflags',
    '+faststart',
    clip,
  ]);
  clips.push(clip);
  script += `## ${segment.title}\n\n${segment.narration}\n\n`;
}
await browser.close();
const list = resolve(output, 'clips.txt');
writeFileSync(list, clips.map((path) => `file '${path.replaceAll('\\', '/')}'`).join('\n'));
command(encoder, [
  '-y',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  list,
  '-c',
  'copy',
  '-movflags',
  '+faststart',
  resolve('artifacts/windward-demo.mp4'),
]);
writeFileSync('docs/DEMO_SCRIPT.md', script);
console.log('Created artifacts/windward-demo.mp4 and docs/DEMO_SCRIPT.md');
