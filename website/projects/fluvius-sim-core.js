(function (root) {
  const MONTHS = ['JAN','FEB','MAA','APR','MEI','JUN','JUL','AUG','SEP','OKT','NOV','DEC'];

  const OFFER_CATALOG = [
    { id:'luminus-comfy', label:'Luminus Comfy (huidig) · afname 0.31 · injectie 0.085', afname:0.31, injectie:0.085, timingBonus:0.00, fixedYear:72 },
    { id:'engie-flow-fixed', label:'ENGIE Flow (vast) · afname 0.32 · injectie 0.03', afname:0.32, injectie:0.03, timingBonus:0.00, fixedYear:60 },
    { id:'engie-dynamic', label:'ENGIE Dynamic · afname 0.30 · injectie 0.10', afname:0.30, injectie:0.10, timingBonus:0.02, fixedYear:60 },
    { id:'luminus-comfyflex', label:'Luminus ComfyFlex · afname 0.31 · injectie 0.085', afname:0.31, injectie:0.085, timingBonus:0.015, fixedYear:72 },
    { id:'octa-dynamic', label:'OCTA+ Dynamic · afname 0.30 · injectie 0.09', afname:0.30, injectie:0.09, timingBonus:0.018, fixedYear:55 }
  ];

  const BATTERY_SCENARIOS = [
    { label: '0 kWh', capacityKwh: 0, powerKw: 0 },
    { label: '5 kWh', capacityKwh: 5, powerKw: 3 },
    { label: '10 kWh', capacityKwh: 10, powerKw: 5 },
    { label: '20 kWh', capacityKwh: 20, powerKw: 7 },
    { label: '30 kWh', capacityKwh: 30, powerKw: 10 }
  ];

  const ASSUMPTIONS = {
    capaciteitEurPerKwJaar: 53.53,
    roundTripEff: 0.92,
    pvBaseKwp: 6.0
  };

  const YEAR_VALIDATION = {
    warningMissingIntervals: 8,
    maxMissingIntervals: 24
  };

  function getOfferById(id) {
    return OFFER_CATALOG.find((o) => o.id === id) || OFFER_CATALOG[0];
  }

  function eur(v) { return `€ ${v.toFixed(0)}`; }

  function computeRowsFromStats(stats, params) {
    const currentOffer = getOfferById(params.currentOfferId);
    const newOffer = getOfferById(params.newOfferId);
    const baselinePeak = stats.baselinePeakKw;
    const baselineInjectie = stats.baselineInjectieKwh;

    const rows = BATTERY_SCENARIOS.map((scenario) => {
      const label = scenario.label;
      const usedFromBattery = (stats.scenarioDeliveryKwh[label] || 0);
      const peak = (stats.scenarioPeakKw[label] ?? baselinePeak);

      const selfVerbruik = usedFromBattery * currentOffer.afname;
      const peakGain = Math.max(0, baselinePeak - peak) * ASSUMPTIONS.capaciteitEurPerKwJaar;
      const timingGain = usedFromBattery * Math.max(0, (newOffer.timingBonus - currentOffer.timingBonus));
      const missedDynInjectie = -1 * usedFromBattery * newOffer.injectie;
      const effLoss = -1 * usedFromBattery * ((1 / ASSUMPTIONS.roundTripEff) - 1) * currentOffer.afname;
      const remainingInjectie = Math.max(0, baselineInjectie - usedFromBattery);
      const switchGainOnRemaining = remainingInjectie * (newOffer.injectie - currentOffer.injectie);
      const net = selfVerbruik + peakGain + timingGain + switchGainOnRemaining + missedDynInjectie + effLoss;

      return { label, selfVerbruik, peakGain, timingGain, switchGainOnRemaining, missedDynInjectie, effLoss, net };
    });

    const best = rows.reduce((a, b) => (b.net > a.net ? b : a), rows[0]);
    return { rows, best, summary: `Switch: ${currentOffer.label} → ${newOffer.label} · Netto jaarimpact incl. opportunity cost: best scenario ${best.label} met ${eur(best.net)}.` };
  }

  function buildPreviewStats(monthlyData, scenarioData, pvKwp) {
    const factor = pvKwp / ASSUMPTIONS.pvBaseKwp;
    const baselineInjectieKwh = monthlyData.injectie.reduce((a, b) => a + b, 0) * factor;
    const baselineAfnameKwh = monthlyData.afname.reduce((a, b) => a + b, 0);
    const baselinePeakKw = Math.max(...monthlyData.piek);
    const avgMonthlyPeakKw = monthlyData.piek.reduce((a, b) => a + b, 0) / monthlyData.piek.length;
    return {
      baselineInjectieKwh,
      baselineAfnameKwh,
      baselinePeakKw,
      avgMonthlyPeakKw,
      scenarioDeliveryKwh: {
        '0 kWh': 0,
        '5 kWh': 1150 * factor,
        '10 kWh': scenarioData['10'].total[1] * factor,
        '20 kWh': scenarioData['20'].total[1] * factor,
        '30 kWh': scenarioData['30'].total[1] * factor
      },
      scenarioPeakKw: {
        '0 kWh': baselinePeakKw,
        '5 kWh': 7.30,
        '10 kWh': scenarioData['10'].total[2],
        '20 kWh': scenarioData['20'].total[2],
        '30 kWh': scenarioData['30'].total[2]
      }
    };
  }

  function parseNum(v) {
    if (!v) return 0;
    return Number(String(v).replace(',', '.')) || 0;
  }

  function parseDateTime(dateStr, timeStr) {
    const d = String(dateStr || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const t = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!d || !t) return null;
    const day = Number(d[1]);
    const month = Number(d[2]) - 1;
    const year = Number(d[3]);
    const hour = Number(t[1]);
    const minute = Number(t[2]);
    return new Date(year, month, day, hour, minute, 0, 0);
  }

  function parseFluviusCsv(text) {
    const lines = String(text || '').split(/\r?\n/).filter(Boolean);
    const byTs = new Map();

    for (let i = 1; i < lines.length; i += 1) {
      const cols = lines[i].split(';');
      if (cols.length < 9) continue;
      const date = cols[0];
      const time = cols[1];
      const register = cols[7] || '';
      const volume = parseNum(cols[8]);
      const dt = parseDateTime(date, time);
      if (!dt) continue;
      const ts = dt.getTime();
      let row = byTs.get(ts);
      if (!row) {
        row = { ts, year: dt.getFullYear(), month: dt.getMonth(), afname: 0, injectie: 0 };
        byTs.set(ts, row);
      }
      if (register.includes('Afname')) row.afname += volume;
      if (register.includes('Injectie')) row.injectie += volume;
    }

    const intervals = Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
    const years = Array.from(new Set(intervals.map((r) => r.year))).sort((a, b) => a - b);
    return { intervals, years };
  }

  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  function expectedIntervalsInYear(year) {
    return (isLeapYear(year) ? 366 : 365) * 96;
  }

  function monthShortfall(intervals, year) {
    const perMonth = new Array(12).fill(0);
    intervals.forEach((row) => {
      if (row.year === year) perMonth[row.month] += 1;
    });
    const missing = [];
    for (let m = 0; m < 12; m += 1) {
      const expected = new Date(year, m + 1, 0).getDate() * 96;
      const miss = Math.max(0, expected - perMonth[m]);
      if (miss > 0) missing.push({ month: MONTHS[m], missing: miss, expected, present: perMonth[m] });
    }
    return missing;
  }

  function validateRecentFullYear(intervals, options) {
    const cfg = Object.assign({}, YEAR_VALIDATION, options || {});
    const years = Array.from(new Set((intervals || []).map((r) => r.year))).sort((a, b) => a - b);
    if (!years.length) {
      return { valid: false, reason: 'Geen bruikbare kwartierregels gevonden in CSV.' };
    }

    for (let i = years.length - 1; i >= 0; i -= 1) {
      const year = years[i];
      const inYear = intervals.filter((r) => r.year === year);
      const expected = expectedIntervalsInYear(year);
      const present = inYear.length;
      const missing = Math.max(0, expected - present);
      const missingByMonth = monthShortfall(intervals, year);
      if (missing > cfg.maxMissingIntervals) {
        continue;
      }

      const warning = missing > cfg.warningMissingIntervals
        ? `Waarschuwing: ${missing} kwartierinterval(len) ontbreken in ${year} (tolerantie max ${cfg.maxMissingIntervals}).`
        : '';

      return {
        valid: true,
        year,
        expected,
        present,
        missing,
        warning,
        missingByMonth
      };
    }

    const lastYear = years[years.length - 1];
    const inLastYear = intervals.filter((r) => r.year === lastYear);
    const expectedLast = expectedIntervalsInYear(lastYear);
    const missingLast = Math.max(0, expectedLast - inLastYear.length);
    return {
      valid: false,
      reason: `Geen volledig recent kalenderjaar gevonden. Nieuwste jaar ${lastYear} mist ${missingLast} kwartierinterval(len).`,
      year: lastYear,
      missingByMonth: monthShortfall(intervals, lastYear)
    };
  }

  function extractYearIntervals(intervals, year) {
    return (intervals || []).filter((r) => r.year === year);
  }

  function simulateScenario(intervals, pvKwp, scenario) {
    const factor = pvKwp / ASSUMPTIONS.pvBaseKwp;
    const capacity = scenario.capacityKwh;
    const pLimit = scenario.powerKw * 0.25;
    const etaCharge = Math.sqrt(ASSUMPTIONS.roundTripEff);
    const etaDischarge = Math.sqrt(ASSUMPTIONS.roundTripEff);

    let soc = 0;
    let delivered = 0;
    let baselineInjectie = 0;
    let baselineAfname = 0;
    let maxNetImport = 0;
    let maxNetImportWithBattery = 0;

    for (const step of intervals) {
      const importKwh = step.afname;
      const exportKwh = step.injectie * factor;
      baselineInjectie += exportKwh;
      baselineAfname += importKwh;

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
      baselineAfname,
      baselinePeakKw: maxNetImport,
      scenarioPeakKw: maxNetImportWithBattery
    };
  }

  function computeAvgMonthlyPeakFromIntervals(intervals) {
    const byMonth = new Map();
    for (const step of intervals || []) {
      const d = new Date(step.ts);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const kw = Math.max(0, step.afname) * 4;
      const prev = byMonth.get(key) || 0;
      if (kw > prev) byMonth.set(key, kw);
    }
    const vals = Array.from(byMonth.values());
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function computeStatsFromIntervals(intervals, pvKwp) {
    const scenarioDeliveryKwh = {};
    const scenarioPeakKw = {};
    let baselineInjectieKwh = 0;
    let baselineAfnameKwh = 0;
    let baselinePeakKw = 0;

    for (const scenario of BATTERY_SCENARIOS) {
      const result = simulateScenario(intervals, pvKwp, scenario);
      scenarioDeliveryKwh[scenario.label] = result.delivered;
      scenarioPeakKw[scenario.label] = result.scenarioPeakKw;
      baselineInjectieKwh = result.baselineInjectie;
      baselineAfnameKwh = result.baselineAfname;
      baselinePeakKw = result.baselinePeakKw;
    }

    const avgMonthlyPeakKw = computeAvgMonthlyPeakFromIntervals(intervals);
    return { baselineInjectieKwh, baselineAfnameKwh, baselinePeakKw, avgMonthlyPeakKw, scenarioDeliveryKwh, scenarioPeakKw };
  }

  function computeFinancialSnapshot(stats, params) {
    const offer = getOfferById(params.currentOfferId);
    const afname = Number(stats.baselineAfnameKwh || 0);
    const injectie = Number(stats.baselineInjectieKwh || 0);
    const avgPeak = Number(stats.avgMonthlyPeakKw || stats.baselinePeakKw || 0);

    const netTariff = 0.0548;
    const levies = 0.0290;
    const capacity = 53.53;
    const vatRate = 0.06;
    const fixedYear = Number(offer.fixedYear || 0);

    const energyCost = afname * offer.afname;
    const netCost = afname * netTariff;
    const leviesCost = afname * levies;
    const capacityCost = avgPeak * capacity;
    const injectieRevenue = injectie * offer.injectie;

    const exVat = energyCost + netCost + leviesCost + capacityCost + fixedYear - injectieRevenue;
    const vat = Math.max(0, exVat) * vatRate;
    const total = exVat + vat;
    const netKwh = Math.max(1, afname - injectie);

    return {
      annualTotal: total,
      monthlyAvg: total / 12,
      costPerNetKwh: total / netKwh,
      breakdown: {
        energyCost,
        netCost,
        leviesCost,
        capacityCost,
        fixedYear,
        injectieRevenue,
        vat
      }
    };
  }

  root.FluviusSimCore = {
    MONTHS,
    OFFER_CATALOG,
    BATTERY_SCENARIOS,
    ASSUMPTIONS,
    YEAR_VALIDATION,
    getOfferById,
    computeRowsFromStats,
    buildPreviewStats,
    parseFluviusCsv,
    validateRecentFullYear,
    extractYearIntervals,
    computeStatsFromIntervals,
    computeFinancialSnapshot
  };
})(typeof self !== 'undefined' ? self : window);
