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
    if (p.includes('/projects/masterdata.html')) return 301;
    if (p.endsWith('/Digi-Atelier/') || p.endsWith('/index.html') || p === '/' ) return 1;
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
