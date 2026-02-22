importScripts('./fluvius-sim-core.js');

let parsed = null;
let parseError = null;

async function ensureParsed(csvUrl) {
  if (parsed || parseError) return;
  try {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const text = await res.text();
    parsed = FluviusSimCore.parseFluviusCsv(text).intervals;
  } catch (e) {
    parseError = e.message || String(e);
  }
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  if (msg.type !== 'compute') return;

  let intervals = null;
  if (Array.isArray(msg.intervals) && msg.intervals.length) {
    intervals = msg.intervals;
  } else {
    await ensureParsed(msg.csvUrl);
    intervals = parsed;
  }

  if (parseError || !intervals) {
    self.postMessage({ type: 'error', error: parseError || 'CSV parsing failed' });
    return;
  }

  const stats = FluviusSimCore.computeStatsFromIntervals(intervals, msg.params.pvKwp);
  self.postMessage({ type: 'result', stats });
};
