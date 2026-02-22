#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/home/klaas/.openclaw/workspace/data/master/belpex';
const CSV_PATH = path.join(ROOT, 'curated', 'belpex_prices_be.csv');
const META_DIR = path.join(ROOT, 'metadata');
const LOG_DIR = path.join(ROOT, 'logs');

function mean(arr) { return arr.reduce((a,b)=>a+b,0) / (arr.length || 1); }
function std(arr, m) { return Math.sqrt(arr.reduce((a,b)=>a + Math.pow(b - m, 2), 0) / (arr.length || 1)); }

async function main() {
  const csv = await fs.readFile(CSV_PATH, 'utf8');
  const lines = csv.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header?.includes('timestamp_utc')) throw new Error('Unexpected CSV header');

  let rows = 0;
  let missingPrice = 0;
  let invalidTs = 0;
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  const prices = [];
  const tsSet = new Set();
  let dupTs = 0;
  let prevTs = null;
  const gapSeconds = {};

  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(',');
    const tsIso = parts[0];
    const price = Number(parts[2]);

    rows++;
    const tsMs = Date.parse(tsIso);
    if (!Number.isFinite(tsMs)) invalidTs++;

    if (tsSet.has(tsIso)) dupTs++;
    tsSet.add(tsIso);

    if (!Number.isFinite(price)) missingPrice++;
    else {
      prices.push(price);
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;
    }

    if (prevTs !== null && Number.isFinite(tsMs)) {
      const sec = Math.round((tsMs - prevTs) / 1000);
      gapSeconds[sec] = (gapSeconds[sec] || 0) + 1;
    }
    if (Number.isFinite(tsMs)) prevTs = tsMs;
  }

  const m = mean(prices);
  const s = std(prices, m);
  const zThreshold = 4;
  const outliers = prices.filter((p) => Math.abs((p - m) / (s || 1)) >= zThreshold).length;

  const report = {
    dataset: 'belpex_prices_be',
    generated_at_utc: new Date().toISOString(),
    rows,
    checks: {
      missing_price_count: missingPrice,
      invalid_timestamp_count: invalidTs,
      duplicate_timestamp_count: dupTs,
      observed_intervals_seconds: gapSeconds,
      min_price_eur_mwh: Number.isFinite(minPrice) ? minPrice : null,
      max_price_eur_mwh: Number.isFinite(maxPrice) ? maxPrice : null,
      mean_price_eur_mwh: Number.isFinite(m) ? Number(m.toFixed(4)) : null,
      stddev_price_eur_mwh: Number.isFinite(s) ? Number(s.toFixed(4)) : null,
      outlier_count_z_gte_4: outliers
    },
    status: (missingPrice === 0 && invalidTs === 0 && dupTs === 0) ? 'ok' : 'warn'
  };

  await fs.mkdir(META_DIR, { recursive: true });
  await fs.mkdir(LOG_DIR, { recursive: true });

  const outPath = path.join(META_DIR, 'belpex_prices_be_quality_report.json');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));
  await fs.appendFile(path.join(LOG_DIR, 'quality-log.ndjson'), JSON.stringify(report) + '\n');

  console.log(JSON.stringify({ ok: true, status: report.status, report: outPath, rows }, null, 2));
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
