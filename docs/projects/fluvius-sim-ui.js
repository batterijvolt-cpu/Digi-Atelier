(function () {
  const core = window.FluviusSimCore;
  const ctx = window.fluviusUiContext;
  if (!core || !ctx) return;

  let pvKwp = 6.0;
  let switchChart = null;
  let worker = null;
  let workerReady = true;
  let computeToken = 0;

  const pvBtn = document.getElementById('pvCapBtn');
  const pvMinus = document.getElementById('pvMinus');
  const pvPlus = document.getElementById('pvPlus');
  const currentOfferSel = document.getElementById('currentOffer');
  const newOfferSel = document.getElementById('newOffer');
  const switchSummary = document.getElementById('switchSummary');
  const recalcStatus = document.getElementById('recalcStatus');
  const recalcWarning = document.getElementById('recalcWarning');

  function setStatus(text) {
    if (recalcStatus) recalcStatus.textContent = text;
  }

  function showWarning(text) {
    if (recalcWarning) recalcWarning.textContent = text || '';
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

  function renderPreview() {
    const stats = core.buildPreviewStats(ctx.monthlyData, ctx.scenarioData, pvKwp);
    const result = core.computeRowsFromStats(stats, {
      pvKwp,
      currentOfferId: currentOfferSel.value,
      newOfferId: newOfferSel.value
    });
    renderRows(result.rows, result.summary);
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

    worker.postMessage({
      type: 'compute',
      csvUrl: resolveCsvUrl(),
      params: {
        pvKwp,
        currentOfferId: currentOfferSel.value,
        newOfferId: newOfferSel.value
      }
    });

    worker.onmessage = (ev) => {
      if (token !== computeToken) return;
      if (ev.data?.type === 'result') {
        const result = core.computeRowsFromStats(ev.data.stats, {
          pvKwp,
          currentOfferId: currentOfferSel.value,
          newOfferId: newOfferSel.value
        });
        renderRows(result.rows, result.summary);
        showWarning('');
        setStatus('Exacte herberekening klaar');
      }
      if (ev.data?.type === 'error') {
        workerReady = false;
        showWarning(`Waarschuwing: exacte herberekening niet beschikbaar (${ev.data.error}). Preview actief.`);
        setStatus('Preview klaar');
      }
    };

    worker.onerror = (err) => {
      workerReady = false;
      showWarning(`Waarschuwing: workerfout (${err.message || 'onbekend'}). Preview actief.`);
      setStatus('Preview klaar');
    };
  }

  function recompute() {
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
    currentOfferSel.value = 'engie-flow-fixed';
    newOfferSel.value = 'engie-dynamic';
  }

  function initWorker() {
    try {
      worker = new Worker('./fluvius-sim-worker.js');
    } catch (e) {
      workerReady = false;
      showWarning(`Waarschuwing: worker niet gestart (${e.message}). Preview actief.`);
    }
  }

  setupOffers();
  initWorker();
  currentOfferSel?.addEventListener('change', recompute);
  newOfferSel?.addEventListener('change', recompute);
  pvMinus?.addEventListener('click', () => { pvKwp = Math.max(2, pvKwp - 0.5); recompute(); });
  pvPlus?.addEventListener('click', () => { pvKwp = Math.min(20, pvKwp + 0.5); recompute(); });
  recompute();
})();
