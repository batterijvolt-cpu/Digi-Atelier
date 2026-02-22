(() => {
  const MAJORS = [
    'main > section',
    'main > .homegrid > a',
    'main > .project-hero',
    'main > .headline-carousel',
    'main > .carousel-nav',
    'main > .panel > .card',
    'main > .analysis',
    'main > .story'
  ].join(', ');

  const pageBase = (() => {
    const p = location.pathname;
    if (p.includes('/projects/evolt.html')) return 101;
    if (p.includes('/projects/fluvius.html')) return 201;
    if (p.includes('/projects/fluvius-upload.html')) return 251;
    if (p.includes('/projects/masterdata.html')) return 301;
    if (p.endsWith('/Digi-Atelier/') || p.endsWith('/index.html') || p === '/') return 1;
    return 901;
  })();

  const deprecatedPartIds = (() => {
    const p = location.pathname;
    // legacy 203-blok verwijderd op beide Fluvius-varianten; nummer niet hergebruiken
    if (p.includes('/projects/fluvius.html')) return new Set([203]);
    if (p.includes('/projects/fluvius-upload.html')) return new Set([253]);
    return new Set();
  })();

  const tableBase = (() => {
    const p = location.pathname;
    if (p.includes('/projects/evolt.html')) return 21;
    if (p.includes('/projects/fluvius.html')) return 41;
    if (p.includes('/projects/fluvius-upload.html')) return 61;
    if (p.includes('/projects/masterdata.html')) return 81;
    if (p.endsWith('/Digi-Atelier/') || p.endsWith('/index.html') || p === '/') return 1;
    return 901;
  })();

  const normalizePath = (pathname) => {
    const p = pathname || '/';
    const i = p.indexOf('/Digi-Atelier/');
    return i >= 0 ? p.slice(i + '/Digi-Atelier'.length) : p;
  };

  const scriptEl = document.currentScript || document.querySelector('script[src*="part-map.js"]');
  const registryUrl = scriptEl?.src
    ? new URL('table-id-registry.json', scriptEl.src).toString()
    : 'table-id-registry.json';

  let registry = null;
  fetch(registryUrl)
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => { registry = json; schedule(); })
    .catch(() => { registry = null; });

  const isVisible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 20 && r.height > 16;
  };

  const clearTags = () => {
    document.querySelectorAll('[data-part-id]').forEach((el) => {
      el.classList.remove('part-numbered');
      el.removeAttribute('data-part-id');
      el.removeAttribute('data-part-label');
    });
    document.querySelectorAll('[data-table-id]').forEach((el) => {
      el.classList.remove('table-numbered');
      el.removeAttribute('data-table-id');
    });
  };

  const mark = (el, id) => {
    el.classList.add('part-numbered');
    el.setAttribute('data-part-id', id);
  };

  const getRegistryIdsForPage = () => {
    if (!registry?.pages) return null;
    const p = normalizePath(location.pathname);
    return registry.pages[p] || null;
  };

  const build = () => {
    clearTags();

    const majorEls = Array.from(document.querySelectorAll(MAJORS)).filter(isVisible);
    let nextId = pageBase;
    majorEls.forEach((box) => {
      while (deprecatedPartIds.has(nextId)) nextId += 1;
      mark(box, String(nextId));
      nextId += 1;
    });

    const tables = Array.from(document.querySelectorAll('table')).filter(isVisible);
    const registryIds = getRegistryIdsForPage();
    let t = tableBase;
    tables.forEach((table, idx) => {
      const host = table.closest('.table-scroll') || table;
      host.classList.add('table-numbered');
      const id = registryIds?.[idx] || `T${t}`;
      host.setAttribute('data-table-id', id);
      t += 1;
    });
  };

  let t;
  const schedule = () => {
    clearTimeout(t);
    t = setTimeout(build, 80);
  };

  if (!document.querySelector('.part-map-toggle')) {
    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'part-map-toggle';
    hint.textContent = 'Nummermodus: AAN';
    let on = true;
    const apply = () => document.documentElement.classList.toggle('part-map-off', !on);
    hint.addEventListener('click', () => {
      on = !on;
      hint.textContent = `Nummermodus: ${on ? 'AAN' : 'UIT'}`;
      apply();
    });
    document.body.appendChild(hint);

    const versionBadge = document.createElement('button');
    versionBadge.type = 'button';
    versionBadge.className = 'part-version-badge';
    versionBadge.textContent = 'Update: laden…';
    versionBadge.title = 'Laatste update van deze pagina';
    versionBadge.addEventListener('click', () => {
      const txt = versionBadge.textContent || '';
      navigator.clipboard?.writeText(txt).catch(() => {});
    });
    document.body.appendChild(versionBadge);

    const versionUrl = scriptEl?.src
      ? new URL('version.json', scriptEl.src).toString()
      : 'version.json';
    fetch(versionUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (!v) throw new Error('no version');
        const raw = v.updated_at || '';
        const dt = raw ? new Date(raw) : null;
        const hhmm = dt && Number.isFinite(dt.getTime())
          ? dt.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
          : '??:??';
        const ddmm = dt && Number.isFinite(dt.getTime())
          ? dt.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit' })
          : '--/--';
        versionBadge.textContent = `Update ${ddmm} ${hhmm}`;
        versionBadge.title = `${v.version || 'v?'} · ${v.label || 'live'}`;
      })
      .catch(() => {
        versionBadge.textContent = 'Update onbekend';
      });

    apply();
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });

  build();
  window.addEventListener('resize', schedule);
})();
