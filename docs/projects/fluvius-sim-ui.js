(function () {
  const core = window.FluviusSimCore;
  const ctx = window.fluviusUiContext;
  if (!core || !ctx) return;

  let pvKwp = 6.0;
  let switchChart = null;
  let worker = null;
  let workerReady = true;
  let computeToken = 0;
  let activeDataset = { type: 'default', label: 'Standaard (2025-profiel)', intervals: null, year: null };

  const pvBtn = document.getElementById('pvCapBtn');
  const pvMinus = document.getElementById('pvMinus');
  const pvPlus = document.getElementById('pvPlus');
  const currentOfferSel = document.getElementById('currentOffer');
  const newOfferSel = document.getElementById('newOffer');
  const switchSummary = document.getElementById('switchSummary');
  const recalcStatus = document.getElementById('recalcStatus');
  const recalcWarning = document.getElementById('recalcWarning');
  const healthStatus = document.getElementById('healthStatus');
  const uploadInput = document.getElementById('fluviusCsvUpload');
  const uploadStatus = document.getElementById('uploadStatus');
  const datasetLabel = document.getElementById('activeDatasetLabel');
  const finAnnual = document.getElementById('finAnnual');
  const finMonthly = document.getElementById('finMonthly');
  const finCompact = document.getElementById('finComponentsCompact');
  const uploadEnabled = !!uploadInput;

  const costInputs = { netTariff: null, levies: null, capacity: null, vatRate: null };
  const health = { core: true, masterdata: false, recompute: false, worker: true };

  function refreshHealth() {
    if (!healthStatus) return;
    const ok = health.core && health.masterdata && health.recompute && health.worker;
    healthStatus.textContent = ok
      ? 'Health: OK (core/masterdata/recalc/worker)'
      : `Health: waarschuwing (${[
          !health.masterdata ? 'masterdata' : null,
          !health.recompute ? 'recalc' : null,
          !health.worker ? 'worker' : null
        ].filter(Boolean).join(', ')})`;
  }

  function setStatus(text) {
    if (recalcStatus) recalcStatus.textContent = text;
  }

  function showWarning(text) {
    if (recalcWarning) recalcWarning.textContent = text || '';
  }

  function setUploadStatus(text, state) {
    if (!uploadStatus) return;
    uploadStatus.textContent = text;
    uploadStatus.style.color = state === 'error' ? '#ef4444' : state === 'warn' ? '#f59e0b' : '#94a3b8';
  }

  function updateDatasetLabel() {
    if (!datasetLabel) return;
    if (!uploadEnabled) {
      datasetLabel.textContent = 'Actieve dataset: Referentie Fluvius 2025 (vast)';
      return;
    }
    datasetLabel.textContent = activeDataset.type === 'upload'
      ? `Actieve dataset: Upload (${activeDataset.year})`
      : 'Actieve dataset: Standaard (2025-profiel)';
  }

  function renderRows(rows, summary) {
    if (pvBtn) pvBtn.textContent = `PV ${pvKwp.toFixed(1)} kWp`;
    if (switchSummary) switchSummary.textContent = summary;

    const chartData = {
      labels: rows.map(r => r.label),
      datasets: [
        { label: 'Zelfverbruik (afname vermeden)', data: rows.map(r => r.selfVerbruik), backgroundColor: '#22c55e', stack: 's' },
        { label: 'Piekafvlakking', data: rows.map(r => r.peakGain), backgroundColor: '#0ea5e9', stack: 's' },
        { label: 'Belpex timingbonus', data: rows.map(r => r.timingGain), backgroundColor: '#a78bfa', stack: 's' },
        { label: 'Switch 3→10 c€ op resterende injectie', data: rows.map(r => r.switchGainOnRemaining), backgroundColor: '#14b8a6', stack: 's' },
        { label: 'Gemiste dynamische injectie (opportunity cost)', data: rows.map(r => r.missedDynInjectie), backgroundColor: '#f59e0b', stack: 's' },
        { label: 'Rendementsverlies batterij', data: rows.map(r => r.effLoss), backgroundColor: '#ef4444', stack: 's' }
      ]
    };

    if (!switchChart) {
      switchChart = new Chart(document.getElementById('switchChart'), {
        type: 'bar',
        data: chartData,
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: '€/jaar' } } },
          plugins: { legend: { position: 'bottom' } }
        }
      });
    } else {
      switchChart.data = chartData;
      switchChart.update();
    }
  }

  function buildActiveStats() {
    if (activeDataset.type === 'upload' && Array.isArray(activeDataset.intervals) && activeDataset.intervals.length) {
      return core.computeStatsFromIntervals(activeDataset.intervals, pvKwp);
    }
    return core.buildPreviewStats(ctx.monthlyData, ctx.scenarioData, pvKwp);
  }

  function renderFinancialSnapshot(stats) {
    if (!finAnnual || !finMonthly) return;

    const missing = [];
    if (costInputs.netTariff == null) missing.push('nettarief');
    if (costInputs.levies == null) missing.push('heffingen');
    if (costInputs.capacity == null) missing.push('capaciteitstarief');
    if (costInputs.vatRate == null) missing.push('btw');

    if (missing.length) {
      finAnnual.textContent = '?';
      finMonthly.textContent = '?';
      if (finCompact) finCompact.textContent = `Waarschuwing: ontbrekende masterdata (${missing.join(', ')}). Financiële snapshot niet berekend.`;
      showWarning(`Masterdata onvolledig: ${missing.join(', ')}.`);
      return;
    }

    const fin = core.computeFinancialSnapshot(stats, { currentOfferId: currentOfferSel.value }, costInputs);
    const eur = (v) => `€ ${Number(v).toFixed(0)}`;
    finAnnual.textContent = eur(fin.annualTotal);
    finMonthly.textContent = eur(fin.monthlyAvg);

    if (finCompact) {
      const b = fin.breakdown;
      const afn = Number(stats.baselineAfnameKwh || 0);
      const inj = Number(stats.baselineInjectieKwh || 0);
      const avgPeak = Number(stats.avgMonthlyPeakKw || 0);
      const offer = core.getOfferById(currentOfferSel.value);
      finCompact.textContent =
        `Energie: ${afn.toFixed(0)} kWh × €${offer.afname.toFixed(3)} = ${eur(b.energyCost)} · ` +
        `Net: ${afn.toFixed(0)} kWh × €${costInputs.netTariff.toFixed(4)} = ${eur(b.netCost)} · ` +
        `Heff: ${afn.toFixed(0)} kWh × €${costInputs.levies.toFixed(4)} = ${eur(b.leviesCost)} · ` +
        `Cap: ${avgPeak.toFixed(2)} kW × €${costInputs.capacity.toFixed(2)} = ${eur(b.capacityCost)} · ` +
        `Vast: ${eur(b.fixedYear)} · ` +
        `Injectie: ${inj.toFixed(0)} kWh × €${offer.injectie.toFixed(3)} = -${eur(b.injectieRevenue)} · ` +
        `BTW (${(costInputs.vatRate*100).toFixed(0)}%): ${eur(b.vat)}.`;
    }
  }

  function renderPreview() {
    const stats = buildActiveStats();
    const result = core.computeRowsFromStats(stats, {
      pvKwp,
      currentOfferId: currentOfferSel.value,
      newOfferId: newOfferSel.value
    });
    renderRows(result.rows, result.summary);
    renderFinancialSnapshot(stats);
    health.recompute = true;
    refreshHealth();
    setStatus('Preview klaar');
  }

  function resolveCsvUrl() {
    const file = 'data/Fluvius/Verbruikshistoriek_elektriciteit_20250101_20260102_kwartiertotalen.csv';
    const path = window.location.pathname || '';
    if (path.includes('/Digi-Atelier/')) return `/Digi-Atelier/${file}`;
    return `../../${file}`;
  }

  function runAccurate() {
    if (!workerReady || !worker) return;
    const token = ++computeToken;
    setStatus('Exacte herberekening bezig…');

    const payload = {
      type: 'compute',
      params: {
        pvKwp,
        currentOfferId: currentOfferSel.value,
        newOfferId: newOfferSel.value
      }
    };

    if (activeDataset.type === 'upload' && activeDataset.intervals) {
      payload.intervals = activeDataset.intervals;
    } else {
      payload.csvUrl = resolveCsvUrl();
    }

    worker.postMessage(payload);

    worker.onmessage = (ev) => {
      if (token !== computeToken) return;
      if (ev.data?.type === 'result') {
        const result = core.computeRowsFromStats(ev.data.stats, {
          pvKwp,
          currentOfferId: currentOfferSel.value,
          newOfferId: newOfferSel.value
        });
        renderRows(result.rows, result.summary);
        health.worker = true;
        refreshHealth();
        showWarning('');
        setStatus('Exacte herberekening klaar');
      }
      if (ev.data?.type === 'error') {
        workerReady = false;
        health.worker = false;
        refreshHealth();
        showWarning(`Waarschuwing: exacte herberekening niet beschikbaar (${ev.data.error}). Preview actief.`);
        setStatus('Preview klaar');
      }
    };

    worker.onerror = (err) => {
      workerReady = false;
      health.worker = false;
      refreshHealth();
      showWarning(`Waarschuwing: workerfout (${err.message || 'onbekend'}). Preview actief.`);
      setStatus('Preview klaar');
    };
  }

  function recompute() {
    updateDatasetLabel();
    renderPreview();
    runAccurate();
  }

  function setupOffers() {
    core.OFFER_CATALOG.forEach(o => {
      const a = document.createElement('option');
      a.value = o.id; a.textContent = o.label; currentOfferSel?.appendChild(a);
      const b = document.createElement('option');
      b.value = o.id; b.textContent = o.label; newOfferSel?.appendChild(b);
    });
    currentOfferSel.value = 'luminus-comfy';
    newOfferSel.value = 'engie-dynamic';
  }

  function loadCostInputsFromMasterdata() {
    fetch('./masterdata/fixed-cost-benchmarks-vlaanderen.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.rows) return;
        const byName = Object.fromEntries(data.rows.map((r) => [String(r.component || '').toLowerCase(), r]));
        const pickNum = (v) => {
          const m = String(v ?? '').match(/\d+(?:[\.,]\d+)?/);
          return m ? Number(m[0].replace(',', '.')) : null;
        };
        const net = pickNum(byName['nettarieven (distributie + transmissie)']?.value);
        const lev = pickNum(byName['heffingen en toeslagen']?.value);
        const cap = pickNum(byName['capaciteitstariefcomponent']?.value);
        const vat = pickNum(byName['btw residentieel']?.value);
        if (net != null) costInputs.netTariff = net / 100;
        if (lev != null) costInputs.levies = lev / 100;
        if (cap != null) costInputs.capacity = cap;
        if (vat != null) costInputs.vatRate = vat / 100;
        health.masterdata = [costInputs.netTariff, costInputs.levies, costInputs.capacity, costInputs.vatRate].every(v => v != null);
        refreshHealth();
        recompute();
      })
      .catch(() => {
        health.masterdata = false;
        refreshHealth();
        recompute();
      });
  }

  function initWorker() {
    try {
      worker = new Worker('./fluvius-sim-worker.js');
      health.worker = true;
      refreshHealth();
    } catch (e) {
      workerReady = false;
      health.worker = false;
      refreshHealth();
      showWarning(`Waarschuwing: worker niet gestart (${e.message}). Preview actief.`);
    }
  }

  function onCsvUpload(file) {
    if (!file) return;
    file.text().then((text) => {
      const parsed = core.parseFluviusCsv(text);
      const check = core.validateRecentFullYear(parsed.intervals);
      if (!check.valid) {
        activeDataset = { type: 'default', label: 'Standaard (2025-profiel)', intervals: null, year: null };
        const missingInfo = (check.missingByMonth || []).slice(0, 6).map((m) => `${m.month}:${m.missing}`).join(', ');
        setUploadStatus(`Upload geweigerd: ${check.reason}${missingInfo ? ` Ontbrekend per maand (kwartieren): ${missingInfo}${(check.missingByMonth || []).length > 6 ? ', …' : ''}.` : ''}`, 'error');
        recompute();
        return;
      }

      const yearIntervals = core.extractYearIntervals(parsed.intervals, check.year);
      activeDataset = {
        type: 'upload',
        label: `Upload (${check.year})`,
        intervals: yearIntervals,
        year: check.year
      };

      if (check.warning) {
        setUploadStatus(`Upload OK met waarschuwing: ${check.warning}`, 'warn');
      } else {
        setUploadStatus(`Upload OK: volledig recent kalenderjaar ${check.year} gedetecteerd (${check.present}/${check.expected} kwartierintervallen).`, 'ok');
      }
      recompute();
    }).catch((err) => {
      setUploadStatus(`Upload mislukt: ${err.message || err}`, 'error');
    });
  }

  setupOffers();
  initWorker();
  loadCostInputsFromMasterdata();
  updateDatasetLabel();
  refreshHealth();
  setUploadStatus(
    uploadEnabled
      ? 'Geen upload actief. Standaarddataset wordt gebruikt.'
      : 'Upload staat uit in referentieversie. Gebruik de upload-versie voor bezoekers.',
    'ok'
  );

  uploadInput?.addEventListener('change', (e) => onCsvUpload(e.target.files?.[0]));
  currentOfferSel?.addEventListener('change', recompute);
  newOfferSel?.addEventListener('change', recompute);
  pvMinus?.addEventListener('click', () => { pvKwp = Math.max(2, pvKwp - 0.5); recompute(); });
  pvPlus?.addEventListener('click', () => { pvKwp = Math.min(20, pvKwp + 0.5); recompute(); });
  recompute();
})();
