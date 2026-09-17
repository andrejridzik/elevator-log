/* Minimal dependency-free SVG bar charts, styled per the house dataviz spec:
 * thin marks (<=24px), 4px rounded data-end / square baseline, 2px gaps between
 * bars, hairline recessive gridlines, hover/tap tooltip on every mark.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function makeTooltipLayer(container) {
  container.classList.add('tooltip-layer');
  const tip = document.createElement('div');
  tip.className = 'chart-tooltip';
  container.appendChild(tip);
  function show(x, y, html) {
    tip.innerHTML = html;
    tip.style.left = `${x}px`;
    tip.style.top = `${y - 8}px`;
    tip.classList.add('show');
  }
  function hide() { tip.classList.remove('show'); }
  return { show, hide };
}

function roundedTopRect(x, y, w, h, r) {
  // Bar growing rightward from a left baseline: rounded on the right (tip) end,
  // square at the baseline (left) end. Falls back to a plain rect if too small.
  r = Math.min(r, h / 2, w / 2);
  if (w <= 0 || h <= 0) return el('rect', { x, y, width: Math.max(w, 0), height: h });
  if (r <= 0) return el('rect', { x, y, width: w, height: h });
  const d = `M ${x} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x} Z`;
  return el('path', { d });
}

function verticalRoundedRect(x, y, w, h, r) {
  // Column growing upward from a bottom baseline: rounded top cap, square base.
  r = Math.min(r, h / 2, w / 2);
  if (w <= 0 || h <= 0) return el('rect', { x, y, width: w, height: Math.max(h, 0) });
  if (r <= 0) return el('rect', { x, y, width: w, height: h });
  const d = `M ${x} ${y + h} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h} Z`;
  return el('path', { d });
}

/**
 * Horizontal grouped bar chart. One row per category, one or more series per row.
 * Designed for the floor-frequency chart: categories are floors, ordered as given
 * (caller passes them top-to-bottom, e.g. 16 down to -2, to mirror the building).
 */
function renderHorizontalGroupedBars(container, { categories, series, valueFormatter = (v) => String(v) }) {
  container.innerHTML = '';
  const width = Math.max(container.clientWidth || 320, 240);
  const rowH = 22;
  const barH = 8;
  const gap = 2;
  const labelW = 34;
  const rightPad = 40;
  const plotW = width - labelW - rightPad;
  const height = categories.length * rowH + 8;
  const maxVal = Math.max(1, ...categories.flatMap((c) => series.map((s) => s.values.get(c) || 0)));

  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height, role: 'img' });

  // gridline at 0 baseline
  svg.appendChild(el('line', {
    x1: labelW, x2: labelW, y1: 0, y2: height - 8,
    stroke: 'var(--baseline)', 'stroke-width': 1,
  }));

  const { show, hide } = makeTooltipLayer(container);
  container.appendChild(svg);

  categories.forEach((cat, i) => {
    const rowY = i * rowH + 4;
    const label = el('text', {
      x: labelW - 8, y: rowY + (series.length * barH + (series.length - 1) * gap) / 2 + 4,
      'text-anchor': 'end', 'font-size': 11, fill: 'var(--text-muted)',
    });
    label.textContent = String(cat);
    svg.appendChild(label);

    series.forEach((s, si) => {
      const val = s.values.get(cat) || 0;
      const barW = maxVal > 0 ? (val / maxVal) * plotW : 0;
      const y = rowY + si * (barH + gap);
      const bar = roundedTopRect(labelW, y, barW, barH, 4);
      bar.setAttribute('fill', s.color);
      bar.setAttribute('tabindex', '0');
      bar.style.cursor = val > 0 ? 'pointer' : 'default';
      svg.appendChild(bar);

      if (val > 0) {
        const showTip = (evt) => {
          const rect = container.getBoundingClientRect();
          const px = (evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
          const py = (evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top;
          show(px, py, `<span>${s.name} · floor ${cat}</span><br><span class="tt-value">${valueFormatter(val)}</span>`);
        };
        bar.addEventListener('mouseenter', showTip);
        bar.addEventListener('mousemove', showTip);
        bar.addEventListener('mouseleave', hide);
        bar.addEventListener('click', (evt) => { evt.stopPropagation(); showTip(evt); });
        bar.addEventListener('focus', () => {
          show(labelW + barW, y, `<span>${s.name} · floor ${cat}</span><br><span class="tt-value">${valueFormatter(val)}</span>`);
        });
        bar.addEventListener('blur', hide);
      }
    });
  });

  container.addEventListener('click', (evt) => {
    if (evt.target === svg || evt.target === container) hide();
  });

  return svg;
}

/**
 * Vertical column chart. Used for the hour-of-day distance chart (single series).
 */
function renderColumnChart(container, { categories, values, color, valueFormatter = (v) => String(v), counts = null }) {
  container.innerHTML = '';
  const width = Math.max(container.clientWidth || 320, 240);
  const height = 160;
  const topPad = 8;
  const bottomPad = 20;
  const leftPad = 28;
  const rightPad = 8;
  const plotW = width - leftPad - rightPad;
  const plotH = height - topPad - bottomPad;
  const n = categories.length;
  const slot = plotW / n;
  const barW = Math.min(20, Math.max(3, slot - 3));
  const maxVal = Math.max(1, ...values.filter((v) => v != null));

  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height, role: 'img' });

  // baseline
  svg.appendChild(el('line', {
    x1: leftPad, x2: width - rightPad, y1: height - bottomPad, y2: height - bottomPad,
    stroke: 'var(--baseline)', 'stroke-width': 1,
  }));
  // a couple of horizontal gridlines
  for (const frac of [0.5, 1]) {
    const y = height - bottomPad - plotH * frac;
    svg.appendChild(el('line', {
      x1: leftPad, x2: width - rightPad, y1: y, y2: y,
      stroke: 'var(--gridline)', 'stroke-width': 1,
    }));
    const t = el('text', { x: leftPad - 6, y: y + 3, 'text-anchor': 'end', 'font-size': 9, fill: 'var(--text-muted)' });
    t.textContent = (maxVal * frac).toFixed(1);
    svg.appendChild(t);
  }

  const { show, hide } = makeTooltipLayer(container);
  container.appendChild(svg);

  categories.forEach((cat, i) => {
    const val = values[i];
    const cx = leftPad + i * slot + slot / 2;
    if (i % Math.ceil(n / 12) === 0) {
      const lbl = el('text', { x: cx, y: height - 6, 'text-anchor': 'middle', 'font-size': 9, fill: 'var(--text-muted)' });
      lbl.textContent = String(cat);
      svg.appendChild(lbl);
    }
    if (val == null) return;
    const barH = maxVal > 0 ? (val / maxVal) * plotH : 0;
    const bar = verticalRoundedRect(cx - barW / 2, height - bottomPad - barH, barW, barH, 3);
    bar.setAttribute('fill', color);
    bar.setAttribute('tabindex', '0');
    bar.style.cursor = 'pointer';
    svg.appendChild(bar);

    const showTip = (evt) => {
      const rect = container.getBoundingClientRect();
      const px = (evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
      const py = (evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top;
      const n2 = counts ? ` (${counts[i]} log${counts[i] === 1 ? '' : 's'})` : '';
      show(px, py, `<span>${cat}:00</span><br><span class="tt-value">${valueFormatter(val)}</span>${n2}`);
    };
    bar.addEventListener('mouseenter', showTip);
    bar.addEventListener('mousemove', showTip);
    bar.addEventListener('mouseleave', hide);
    bar.addEventListener('click', (evt) => { evt.stopPropagation(); showTip(evt); });
    bar.addEventListener('focus', () => {
      const n2 = counts ? ` (${counts[i]} log${counts[i] === 1 ? '' : 's'})` : '';
      show(cx, height - bottomPad - barH, `<span>${cat}:00</span><br><span class="tt-value">${valueFormatter(val)}</span>${n2}`);
    });
    bar.addEventListener('blur', hide);
  });

  container.addEventListener('click', (evt) => {
    if (evt.target === svg || evt.target === container) hide();
  });

  return svg;
}
