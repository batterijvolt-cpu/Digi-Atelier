(function (root) {
  const MONTHS = ['JAN','FEB','MAA','APR','MEI','JUN','JUL','AUG','SEP','OKT','NOV','DEC'];

  const OFFER_CATALOG = [
    { id:'engie-flow-fixed', label:'ENGIE Flow (huidig vast) · afname 0.32 · injectie 0.03', afname:0.32, injectie:0.03, timingBonus:0.00 },
    { id:'engie-dynamic', label:'ENGIE Dynamic · afname 0.30 · injectie 0.10', afname:0.30, injectie:0.10, timingBonus:0.02 },
    { id:'luminus-comfyflex', label:'Luminus ComfyFlex · afname 0.31 · injectie 0.08', afname:0.31, injectie:0.08, timingBonus:0.015 },
    { id:'octa-dynamic', label:'OCTA+ Dynamic · afname 0.30 · injectie 0.09', afname:0.30, injectie:0.09, timingBonus:0.018 }
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
      const net = selfVerbruik + peakGain + timingGain + missedDynInjectie + effLoss + switchGainOnRemaining;

      return { label, selfVerbruik, peakGain, timingGain, switchGainOnRemaining, missedDynInjectie, effLoss, net };
    });

    const best = rows.reduce((a, b) => (b.net > a.net ? b : a), rows[0]);
    return { rows, best, summary: `Switch: ${currentOffer.label} → ${newOffer.label} · Netto jaarimpact incl. opportunity cost: best scenario ${best.label} met ${eur(best.net)}.` };
  }

  function buildPreviewStats(monthlyData, scenarioData, pvKwp) {
    const factor = pvKwp / ASSUMPTIONS.pvBaseKwp;
    const baselineInjectieKwh = monthlyData.injectie.reduce((a, b) => a + b, 0) * factor;
    const baselinePeakKw = Math.max(...monthlyData.piek);
    return {
      baselineInjectieKwh,
      baselinePeakKw,
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

  root.FluviusSimCore = {
    MONTHS,
    OFFER_CATALOG,
    BATTERY_SCENARIOS,
    ASSUMPTIONS,
    getOfferById,
    computeRowsFromStats,
    buildPreviewStats
  };
})(typeof self !== 'undefined' ? self : window);
