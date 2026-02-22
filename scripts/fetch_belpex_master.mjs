#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'https://api.energy-charts.info/price';
const BZN = 'BE';
const ROOT = '/home/klaas/.openclaw/workspace/data/master/belpex';

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function toBrusselsIso(tsSeconds) {
  const d = new Date(tsSeconds * 1000);
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Brussels',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(d).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  const end = process.argv[2] || fmtDate(new Date());
  const start = process.argv[3] || fmtDate(new Date(Date.now() - 365 * 24 * 3600 * 1000));

  const url = `${BASE_URL}?bzn=${BZN}&start=${start}&end=${end}`;
  const payload = await fetchJson(url);

  if (!Array.isArray(payload.unix_seconds) || !Array.isArray(payload.price)) {
    throw new Error('Unexpected schema from source API');
  }
  if (payload.unix_seconds.length !== payload.price.length) {
    throw new Error('Mismatched array lengths (unix_seconds vs price)');
  }

  const rawDir = path.join(ROOT, 'raw');
  const curatedDir = path.join(ROOT, 'curated');
  const metaDir = path.join(ROOT, 'metadata');
  const logDir = path.join(ROOT, 'logs');
  await Promise.all([rawDir, curatedDir, metaDir, logDir].map((p) => fs.mkdir(p, { recursive: true })));

  const stamp = nowStamp();
  const rawPath = path.join(rawDir, `${stamp}_energy-charts_price_BE_${start}_to_${end}.json`);
  await fs.writeFile(rawPath, JSON.stringify(payload, null, 2));

  const header = ['timestamp_utc', 'timestamp_brussels', 'price_eur_mwh', 'bzn', 'source'];
  const rows = [header.join(',')];
  for (let i = 0; i < payload.unix_seconds.length; i++) {
    const ts = payload.unix_seconds[i];
    const price = payload.price[i];
    const utc = new Date(ts * 1000).toISOString();
    const local = toBrusselsIso(ts);
    rows.push([
      csvEscape(utc),
      csvEscape(local),
      csvEscape(price),
      csvEscape(BZN),
      csvEscape('energy-charts')
    ].join(','));
  }

  const curatedCsv = path.join(curatedDir, 'belpex_prices_be.csv');
  await fs.writeFile(curatedCsv, rows.join('\n') + '\n');

  const dictionary = {
    dataset: 'belpex_prices_be',
    description: 'Belgian day-ahead wholesale electricity price time series (Belpex / EPEX equivalent market reference for BE bidding zone).',
    grain: 'Market time interval from source (typically 15m or 60m depending period).',
    timezone_storage: 'UTC (primary), Europe/Brussels (derived column)',
    columns: [
      { name: 'timestamp_utc', type: 'datetime (ISO-8601)', nullable: false, description: 'Interval timestamp in UTC from source unix epoch.' },
      { name: 'timestamp_brussels', type: 'datetime', nullable: false, description: 'Converted local timestamp (Europe/Brussels) for business reporting.' },
      { name: 'price_eur_mwh', type: 'number', nullable: false, description: 'Price in EUR/MWh.' },
      { name: 'bzn', type: 'string', nullable: false, description: 'Bidding zone code (BE).' },
      { name: 'source', type: 'string', nullable: false, description: 'Source identifier: energy-charts.' }
    ],
    source: {
      provider: 'Energy-Charts API',
      endpoint: BASE_URL,
      params: { bzn: BZN, start, end },
      license_info: payload.license_info || null,
      unit: payload.unit || 'EUR/MWh'
    },
    quality_checks: {
      row_count: payload.price.length,
      equal_length_arrays: payload.unix_seconds.length === payload.price.length,
      missing_price_count: payload.price.filter((x) => x == null || Number.isNaN(Number(x))).length,
      duplicate_timestamp_count: (() => {
        const seen = new Set();
        let dup = 0;
        for (const t of payload.unix_seconds) {
          if (seen.has(t)) dup++;
          else seen.add(t);
        }
        return dup;
      })()
    },
    generated_at_utc: new Date().toISOString()
  };

  await fs.writeFile(path.join(metaDir, 'belpex_prices_be_data_dictionary.json'), JSON.stringify(dictionary, null, 2));

  const runLog = {
    run_at_utc: new Date().toISOString(),
    dataset: 'belpex_prices_be',
    start,
    end,
    rows: payload.price.length,
    raw_path: rawPath,
    curated_path: curatedCsv,
    status: 'ok'
  };
  await fs.appendFile(path.join(logDir, 'ingestion-log.ndjson'), JSON.stringify(runLog) + '\n');

  console.log(JSON.stringify({ ok: true, rows: payload.price.length, rawPath, curatedCsv }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
