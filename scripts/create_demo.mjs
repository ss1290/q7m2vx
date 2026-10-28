/** Record the real app plus technical slides with natural neural narration.
 * Prerequisites: app at localhost:8000, Chromium installed, edge-tts and
 * imageio-ffmpeg in .venv.
 * Run: node scripts/create_demo.mjs
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const output = resolve('artifacts/demo');
mkdirSync(output, { recursive: true });
const python = resolve('.venv/Scripts/python.exe');
const neuralVoice = 'en-GB-RyanNeural';
const segments = [
  {
    title: 'Part 1 | Customer pilot overview',
    view: 'overview',
    narration: `Welcome to Windward, a pilot for day-ahead power procurement. Wind generation changes with the weather, while tomorrow's electricity must be secured today. Windward shows the forecast available at the purchasing decision time and places it alongside measured forecast error. This pilot focuses on national wind generation using the two Elexon datasets in scope, for decisions made in January 2026.`,
  },
  {
    title: 'The forecast you could actually have seen',
    view: 'overview',
    action: 'chart',
    narration: `The decision window runs from January first through January thirty-first. The cutoff is configurable and defaults to nine AM London time. Each decision date maps to the following delivery day. Here, January fifteenth shows the outlook for January sixteenth. The green line is the latest forecast available by the cutoff, and the dashed line is actual wind generation. The publication timestamp makes the selection auditable, while changing the cutoff immediately recalculates the view.`,
  },
  {
    title: 'Quantify the uncertainty',
    view: 'accuracy',
    narration: `The default analysis matches all seven hundred and forty-four delivery hours. Mean absolute error is about two thousand and thirty-nine megawatts, while root mean square error is about two thousand five hundred and five. Positive bias of roughly seventeen hundred and forty-eight megawatts shows that wind was overforecast on average. The P ninety absolute error is about four thousand and ninety-nine megawatts. Together, these measures show the typical miss, the impact of larger misses, and the direction of exposure. The daily view highlights the dates that deserve closer review.`,
  },
  {
    title: 'Take the evidence with you',
    view: 'data',
    narration: `The data explorer provides the evidence behind every hour: decision date, delivery start, publication time, forecast, actual generation, signed error, and forecast lead time. The same filtered records can be exported to CSV for further analysis. Missing observations remain visible in the coverage measure instead of being silently filled. The methodology view documents the source, alignment rules, and snapshot checksums, giving the team a clear audit trail from publication to metric.`,
  },
  {
    title: 'Part 2 | Architecture and request flow',
    slide: 'architecture',
    narration: `Now for the technical handover. React and TypeScript provide the dashboard. FastAPI validates the filters, calls a pure Python analysis layer, and returns summary, daily, and hourly results. An offline downloader captures the Elexon streams in a versioned JSON snapshot, so the analysis remains reproducible and the user request path does not depend on Elexon availability. Docker serves the compiled frontend and API on one origin, while the Vercel configuration supports static assets with the same Python application.`,
  },
  {
    title: 'Selection, alignment, and units',
    slide: 'analysis',
    narration: `The key analytical rule prevents look-ahead leakage. For each delivery hour, the code selects the latest forecast published at or before the decision cutoff. WINDFOR provides hourly targets, while FUELHH actuals are half-hourly, so the two actual values within each hour are averaged. Both observations must exist for a valid comparison. Error is forecast minus actual, making positive error an overforecast of wind. These rules preserve the information that was genuinely available when the purchasing decision was made.`,
  },
  {
    title: 'Codebase, tests, and development practices',
    slide: 'tests',
    narration: `The codebase separates analysis, data loading, API routes, and presentation concerns. React cancels stale requests when filters change. The downloader uses bounded retries, exact-version deduplication, and atomic file writes. Sixteen backend checks cover publication cutoffs, missing intervals, revisions, date boundaries, metrics, validation, and CSV output. Two browser checks cover desktop and mobile workflows. TypeScript compilation and the production build also pass. The README explains the architecture, assumptions, commands, and data provenance for a straightforward technical handover.`,
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
  };
  return cards[kind];
}

const browser = await chromium.launch();
const clips = [];
// Resume from a zero-based segment after an interrupted recording.
const startAt = Number(process.argv.find((arg) => arg.startsWith('--from='))?.split('=')[1] ?? 0);
let script =
  '# Windward demo narration\n\nTwo-part customer presentation and technical handover. AI assistance and narration are disclosed in the README.\n\n';
for (let index = 0; index < segments.length; index++) {
  const segment = segments[index];
  if (index < startAt) {
    const existing = resolve(output, `segment-${index}.mp4`);
    if (!existsSync(existing)) throw new Error(`Missing earlier segment: ${existing}`);
    clips.push(existing);
    script += `## ${segment.title}\n\n${segment.narration}\n\n`;
    continue;
  }
  const voiceFile = resolve(output, `voice-${index}.mp3`);
  const textPath = resolve(output, `voice-${index}.txt`);
  writeFileSync(textPath, segment.narration);
  command(python, [
    '-m',
    'edge_tts',
    '--voice',
    neuralVoice,
    '--rate=-4%',
    '--file',
    textPath,
    '--write-media',
    voiceFile,
  ]);
  const probe = spawnSync(encoder, ['-hide_banner', '-i', voiceFile], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const durationMatch = probe.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!durationMatch) throw new Error(`Could not read narration duration: ${probe.stderr}`);
  const duration =
    Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
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
  } else {
    await page.setContent(
      `<html><head><style>body{margin:0;background:#f7f8f1;color:#294332;font:23px Arial;padding:70px 90px}small{font-size:14px;letter-spacing:3px;color:#7d916a}h1{font-size:40px;margin:17px 0 35px;letter-spacing:-1px}.flow{background:#e6eed9;padding:25px;border-radius:10px;font-size:28px;margin-bottom:28px}.flow b{padding:0 13px;color:#809c66}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}section{background:white;border:1px solid #dfe6d5;border-radius:10px;padding:23px}h3{margin:0 0 13px;font-size:23px}p{font-size:19px;line-height:1.65;margin:0;color:#7b8b71}pre{font:16px/1.7 Consolas;background:#173d2b;color:#d9e7c8;padding:22px;border-radius:10px;overflow:hidden;max-height:290px;white-space:pre-wrap}footer{position:fixed;bottom:25px;left:90px;font-size:13px;color:#91a17d}</style></head><body><small>WINDWARD / TECHNICAL HANDOVER</small><h1>${segment.title}</h1>${slideContent(segment.slide)}<footer>January 2026 pilot | ${index + 1} / ${segments.length}</footer></body></html>`,
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
    voiceFile,
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
