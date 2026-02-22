(() => {
  const INTERACTIVE = 'a, button, input, select, textarea, [role="button"], [role="slider"], input[type="range"]';
  const VISUALS = 'table, canvas, svg';
  const CONTAINERS = '.story, .card, .catalog-card, .matrix article, .section-head, .homegrid a';

  const isVisible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 20 && r.height > 16;
  };

  const shortText = (txt = '') => txt.replace(/\s+/g, ' ').trim().slice(0, 42);

  const getLabel = (el) => {
    return shortText(
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      el.id ||
      el.name ||
      el.textContent ||
      el.tagName.toLowerCase()
    ) || el.tagName.toLowerCase();
  };

  const candidates = Array.from(document.querySelectorAll(`${INTERACTIVE}, ${VISUALS}, ${CONTAINERS}`));
  const unique = [];
  const seen = new Set();
  candidates.forEach((el) => {
    if (seen.has(el) || !isVisible(el)) return;
    seen.add(el);

    const interactiveOrVisual = el.matches(INTERACTIVE) || el.matches(VISUALS);
    if (!interactiveOrVisual) {
      const parentTagged = el.parentElement?.closest('[data-part-id]');
      if (parentTagged) return;
    }
    unique.push(el);
  });

  let i = 1;
  unique.forEach((el) => {
    el.classList.add('part-numbered');
    el.setAttribute('data-part-id', String(i));
    el.setAttribute('data-part-label', getLabel(el));
    i += 1;
  });

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
})();
