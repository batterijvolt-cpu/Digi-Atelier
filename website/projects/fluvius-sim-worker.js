importScripts('./fluvius-sim-core.js');

let parsed = null;
let parseError = null;

function parseNum(v) {
  if (!v) return 0;
  return Number(String(v).replace(',', '.')) || 0;
}

function parseCsvToIntervals(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const byKey = new Map();

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(';');
    if (cols.length < 9) continue;
    const date = cols[0];
    const time = cols[1];
    const register = cols[7] || '';
    const volume = parseNum(cols[8]);
    const key = `${date} ${time}`;
    let row = byKey.get(key);
    if (!row) {
      row = { month: Number(date.slice(3, 5)) - 1, afname: 0, injectie: 0 };
      byKey.set(key, row);
    }
    if (register.includes('Afname')) row.afname += volume;
    if (register.includes('Injectie')) row.injectie += volume;
  }

  const intervals = Array.from(byKey.values());
  return intervals;
}

async function ensureParsed(csvUrl) {
  if (parsed || parseError) return;
  try {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const text = await res.text();
    parsed = parseCsvToIntervals(text);
  } catch (e) {
    parseError = e.message || String(e);
  }
}

function simulateScenario(intervals, pvKwp, scenario) {
  const factor = pvKwp / FluviusSimCore.ASSUMPTIONS.pvBaseKwp;
  const capacity = scenario.capacityKwh;
  const pLimit = scenario.powerKw * 0.25;
  const etaCharge = Math.sqrt(FluviusSimCore.ASSUMPTIONS.roundTripEff);
  const etaDischarge = Math.sqrt(FluviusSimCore.ASSUMPTIONS.roundTripEff);

  let soc = 0;
  let delivered = 0;
  let baselineInjectie = 0;
  let maxNetImport = 0;
  let maxNetImportWithBattery = 0;

  for (const step of intervals) {
    const importKwh = step.afname;
    const exportKwh = step.injectie * factor;
    baselineInjectie += exportKwh;

    const loadNeed = Math.max(0, importKwh);
    const pvSurplus = Math.max(0, exportKwh);

    let charge = 0;
    let discharge = 0;

    if (capacity > 0 && pvSurplus > 0 && soc < capacity) {
      charge = Math.min(pvSurplus, pLimit, (capacity - soc) / etaCharge);
      soc += charge * etaCharge;
    }

    if (capacity > 0 && loadNeed > 0 && soc > 0) {
      discharge = Math.min(loadNeed, pLimit, soc * etaDischarge);
      soc -= discharge / etaDischarge;
      delivered += discharge;
    }

    const netImport = Math.max(0, loadNeed) * 4;
    const netImportBattery = Math.max(0, loadNeed - discharge) * 4;
    if (netImport > maxNetImport) maxNetImport = netImport;
    if (netImportBattery > maxNetImportWithBattery) maxNetImportWithBattery = netImportBattery;
  }

  return {
    delivered,
    baselineInjectie,
    baselinePeakKw: maxNetImport,
    scenarioPeakKw: maxNetImportWithBattery
  };
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  if (msg.type !== 'compute') return;

  await ensureParsed(msg.csvUrl);
  if (parseError || !parsed) {
    self.postMessage({ type: 'error', error: parseError || 'CSV parsing failed' });
    return;
  }

  const scenarioDeliveryKwh = {};
  const scenarioPeakKw = {};
  let baselineInjectieKwh = 0;
  let baselinePeakKw = 0;

  for (const scenario of FluviusSimCore.BATTERY_SCENARIOS) {
    const result = simulateScenario(parsed, msg.params.pvKwp, scenario);
    scenarioDeliveryKwh[scenario.label] = result.delivered;
    scenarioPeakKw[scenario.label] = result.scenarioPeakKw;
    baselineInjectieKwh = result.baselineInjectie;
    baselinePeakKw = result.baselinePeakKw;
  }

  self.postMessage({
    type: 'result',
    stats: { baselineInjectieKwh, baselinePeakKw, scenarioDeliveryKwh, scenarioPeakKw }
  });
};
