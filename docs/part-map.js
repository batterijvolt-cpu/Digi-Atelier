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
    if (p.endsWith('/Digi-Atelier/') || p.endsWith('/index.html') || p === '/' ) return 1;
    return 901;
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

  const build = () => {
    clearTags();

    const majorEls = Array.from(document.querySelectorAll(MAJORS)).filter(isVisible);

    let nextId = pageBase;
    majorEls.forEach((box) => {
      mark(box, String(nextId));
      nextId += 1;
    });

    // Extra logica voor datatabellen: T1, T2, ... op chronologische DOM-volgorde
    const tables = Array.from(document.querySelectorAll('table')).filter(isVisible);
    let t = tableBase;
    tables.forEach((table) => {
      const host = table.closest('.table-scroll') || table;
      host.classList.add('table-numbered');
      host.setAttribute('data-table-id', `T${t}`);
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
    apply();
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });

  build();
  window.addEventListener('resize', schedule);
})();
