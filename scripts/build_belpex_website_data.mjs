#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const CSV_PATH = '/home/klaas/.openclaw/workspace/data/master/belpex/curated/belpex_prices_be.csv';
const OUT_DIR = '/home/klaas/.openclaw/workspace/website/projects/masterdata';
const OUT_PATH = path.join(OUT_DIR, 'belpex-latest-24h.json');

async function main() {
  const csv = await fs.readFile(CSV_PATH, 'utf8');
  const lines = csv.trim().split(/\r?\n/);
  lines.shift(); // header

  const rows = lines.map((line) => {
    const [timestamp_utc, timestamp_brussels, price_eur_mwh, bzn, source] = line.split(',');
    return {
      timestamp_utc,
      timestamp_brussels,
      price_eur_mwh: Number(price_eur_mwh),
      bzn,
      source
    };
  }).filter(r => Number.isFinite(r.price_eur_mwh));

  const latest24h = rows.slice(-96); // 96 quarter-hours

  const prices = latest24h.map(r => r.price_eur_mwh);
  const payload = {
    dataset: 'belpex_prices_be_latest_24h',
    timezone: 'Europe/Brussels',
    granularity: '15m',
    updated_at_utc: new Date().toISOString(),
    source: 'energy-charts',
    points: latest24h,
    stats: {
      count: latest24h.length,
      min_price_eur_mwh: prices.length ? Math.min(...prices) : null,
      max_price_eur_mwh: prices.length ? Math.max(...prices) : null,
      avg_price_eur_mwh: prices.length ? Number((prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(2)) : null
    }
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2));

  console.log(JSON.stringify({ ok: true, out: OUT_PATH, points: latest24h.length }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
