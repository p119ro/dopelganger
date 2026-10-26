// Small SVG charts for the Progress page. No dependencies.

(function (root) {
    'use strict';

    const NS = 'http://www.w3.org/2000/svg';
    const HEIGHT = 220;
    const MARGIN = { top: 14, right: 16, bottom: 28, left: 44 };

    function svgEl(tag, attrs, parent) {
        const node = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
        if (parent) parent.appendChild(node);
        return node;
    }

    function shortDate(key) {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function monthYear(key) {
        const [y, m] = key.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }

    function compact(n) {
        const abs = Math.abs(n);
        if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10000 || n % 1000 === 0 ? 0 : 1)}K`;
        return String(Math.round(n));
    }

    // Clean tick values covering [min, max].
    function ticks(min, max, count = 4) {
        if (max === min) max = min + 1;
        const raw = (max - min) / count;
        const mag = Math.pow(10, Math.floor(Math.log10(raw)));
        const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw);
        const lo = Math.floor(min / step) * step;
        const hi = Math.ceil(max / step) * step;
        const out = [];
        for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 100) / 100);
        return out;
    }

    // Evenly spaced x-axis label indices, always including both ends.
    function labelIndices(n, maxLabels) {
        if (n <= maxLabels) return [...Array(n).keys()];
        const out = [];
        for (let i = 0; i < maxLabels; i++) out.push(Math.round((i * (n - 1)) / (maxLabels - 1)));
        return [...new Set(out)];
    }

    function setup(container) {
        container.innerHTML = '';
        const width = Math.max(280, container.clientWidth || 600);
        const svg = svgEl('svg', {
            viewBox: `0 0 ${width} ${HEIGHT}`, width, height: HEIGHT, class: 'chart-svg', role: 'img'
        }, container);
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        container.appendChild(tooltip);
        const plot = {
            x0: MARGIN.left, x1: width - MARGIN.right,
            y0: HEIGHT - MARGIN.bottom, y1: MARGIN.top, width
        };
        return { svg, tooltip, plot };
    }

    function drawYAxis(svg, plot, tickValues, y, format) {
        for (const v of tickValues) {
            const yy = y(v);
            svgEl('line', { x1: plot.x0, x2: plot.x1, y1: yy, y2: yy, class: v === 0 ? 'chart-baseline' : 'chart-grid' }, svg);
            svgEl('text', { x: plot.x0 - 8, y: yy + 4, class: 'chart-axis', 'text-anchor': 'end' }, svg).textContent = format(v);
        }
    }

    function drawXAxis(svg, plot, labels, x, maxLabels, format = shortDate) {
        for (const i of labelIndices(labels.length, maxLabels)) {
            const anchor = labels.length === 1 ? 'middle' : i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle';
            svgEl('text', { x: x(i), y: HEIGHT - 8, class: 'chart-axis', 'text-anchor': anchor }, svg).textContent = format(labels[i]);
        }
    }

    function showTooltip(container, tooltip, html, px) {
        tooltip.innerHTML = html;
        tooltip.classList.add('visible');
        const w = tooltip.offsetWidth;
        const left = Math.max(0, Math.min(container.clientWidth - w, px - w / 2));
        tooltip.style.left = `${left}px`;
    }

    function hideTooltip(tooltip) {
        tooltip.classList.remove('visible');
    }

    function empty(container, message) {
        container.innerHTML = `<div class="chart-empty">${message}</div>`;
    }

    // Mouse clicks select straight away. On touch the first tap shows the tooltip
    // and a second tap on the same point selects it.
    function selectable(target, onSelect, indexFor) {
        if (!onSelect) return;
        target.classList.add('selectable');
        let lastTap = -1;
        target.addEventListener('click', evt => {
            const i = indexFor(evt);
            if (evt.pointerType === 'mouse' || !evt.pointerType || i === lastTap) onSelect(i);
            lastTap = i;
        });
    }

    const HINT = '<div class="tt-hint">Click to open this day</div>';

    // series: [{ name, color, values }], labels: date keys (same length as values)
    function line(container, { series, labels, emptyMessage, onSelect, title = shortDate, xLabel = shortDate }) {
        if (!labels.length) return empty(container, emptyMessage);
        if (!series.length) return empty(container, 'Both lines hidden. Click a legend item to show one.');
        const { svg, tooltip, plot } = setup(container);
        plot.x1 -= 56; // room for end labels

        const all = series.flatMap(s => s.values);
        const tickValues = ticks(Math.min(0, ...all), Math.max(10, ...all));
        const lo = tickValues[0];
        const hi = tickValues[tickValues.length - 1];
        const n = labels.length;
        const x = i => (n === 1 ? (plot.x0 + plot.x1) / 2 : plot.x0 + (i / (n - 1)) * (plot.x1 - plot.x0));
        const y = v => plot.y0 - ((v - lo) / (hi - lo)) * (plot.y0 - plot.y1);

        svg.setAttribute('aria-label', series.map(s => `${s.name}: ${Math.round(s.values[n - 1])} points`).join(', '));
        drawYAxis(svg, plot, tickValues, y, compact);
        drawXAxis(svg, plot, labels, x, Math.max(2, Math.floor((plot.x1 - plot.x0) / 70)), xLabel);

        for (const s of series) {
            const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
            const area = `${d}L${x(n - 1).toFixed(1)},${y(Math.max(lo, 0))}L${x(0).toFixed(1)},${y(Math.max(lo, 0))}Z`;
            svgEl('path', { d: area, fill: s.color, opacity: 0.1 }, svg);
            svgEl('path', { d, class: 'chart-line', stroke: s.color }, svg);
        }

        // End dots, plus direct labels when they don't collide.
        const ends = series.map(s => ({ s, yy: y(s.values[n - 1]) }));
        const collide = ends.length === 2 && Math.abs(ends[0].yy - ends[1].yy) < 16;
        for (const { s, yy } of ends) {
            svgEl('circle', { cx: x(n - 1), cy: yy, r: 4, fill: s.color, class: 'chart-dot' }, svg);
            if (!collide) {
                svgEl('text', { x: x(n - 1) + 9, y: yy + 4, class: 'chart-end-label' }, svg).textContent = compact(s.values[n - 1]);
            }
        }

        // Hover layer: crosshair + one dot per series + tooltip.
        const hover = svgEl('g', { class: 'chart-hover' }, svg);
        const cross = svgEl('line', { y1: plot.y1, y2: plot.y0, class: 'chart-crosshair' }, hover);
        const dots = series.map(s => svgEl('circle', { r: 4, fill: s.color, class: 'chart-dot' }, hover));
        const hit = svgEl('rect', {
            x: plot.x0 - 10, y: 0, width: plot.x1 - plot.x0 + 20, height: HEIGHT, fill: 'transparent', class: 'chart-hit'
        }, svg);

        const indexAt = evt => {
            const rect = svg.getBoundingClientRect();
            const px = ((evt.clientX - rect.left) / rect.width) * plot.width;
            return n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - plot.x0) / (plot.x1 - plot.x0)) * (n - 1))));
        };
        const move = evt => {
            const i = indexAt(evt);
            const rect = svg.getBoundingClientRect();
            hover.classList.add('visible');
            cross.setAttribute('x1', x(i));
            cross.setAttribute('x2', x(i));
            series.forEach((s, k) => {
                dots[k].setAttribute('cx', x(i));
                dots[k].setAttribute('cy', y(s.values[i]));
            });
            const rows = series.map(s =>
                `<div class="tt-row"><span class="tt-key" style="background:${s.color}"></span>${s.name}<b>${Math.round(s.values[i]).toLocaleString()}</b></div>`
            ).join('');
            showTooltip(container, tooltip, `<div class="tt-title">${title(labels[i])}</div>${rows}${onSelect ? HINT : ''}`, (x(i) / plot.width) * rect.width);
        };
        hit.addEventListener('pointermove', move);
        hit.addEventListener('pointerdown', move);
        // A lifted finger also fires pointerleave; touch tooltips stay until a tap elsewhere.
        hit.addEventListener('pointerleave', evt => {
            if (evt.pointerType === 'touch') return;
            hover.classList.remove('visible');
            hideTooltip(tooltip);
        });
        selectable(hit, onSelect && (i => onSelect(i)), indexAt);
    }

    // values: numbers 0..max, labels: date keys, describe(i) -> tooltip html,
    // colorFor(i) -> bar color, dimmed(i) -> bool
    function columns(container, { values, labels, max, colorFor, describe, dimmed, reference, emptyMessage, onSelect, ariaLabel, xLabel = shortDate }) {
        if (!labels.length) return empty(container, emptyMessage);
        const { svg, tooltip, plot } = setup(container);

        const n = labels.length;
        const slot = (plot.x1 - plot.x0) / n;
        const barW = Math.max(1, Math.min(24, slot * 0.7, slot - 1));
        const x = i => plot.x0 + slot * i + slot / 2;
        const y = v => plot.y0 - (v / max) * (plot.y0 - plot.y1);

        svg.setAttribute('aria-label', ariaLabel || `${n} bars`);
        const step = max % 3 === 0 ? max / 3 : Math.ceil(max / 4);
        const yTicks = [];
        for (let v = 0; v < max; v += step) yTicks.push(v);
        yTicks.push(max);
        drawYAxis(svg, plot, yTicks, y, v => String(v));
        drawXAxis(svg, plot, labels, x, Math.max(2, Math.floor((plot.x1 - plot.x0) / 70)), xLabel);

        if (reference) {
            const ry = y(reference.value);
            svgEl('line', { x1: plot.x0, x2: plot.x1, y1: ry, y2: ry, class: 'chart-reference' }, svg);
            svgEl('text', { x: plot.x1, y: ry - 5, class: 'chart-axis', 'text-anchor': 'end' }, svg).textContent = reference.label;
        }

        const bars = values.map((v, i) => {
            const h = plot.y0 - y(v);
            if (h <= 0) return null;
            const r = Math.min(4, barW / 2, h);
            const left = x(i) - barW / 2;
            const top = plot.y0 - h;
            const d = `M${left},${plot.y0}V${top + r}Q${left},${top} ${left + r},${top}` +
                `H${left + barW - r}Q${left + barW},${top} ${left + barW},${top + r}V${plot.y0}Z`;
            return svgEl('path', { d, fill: colorFor(i), class: dimmed && dimmed(i) ? 'chart-bar dimmed' : 'chart-bar' }, svg);
        });

        const hitLayer = svgEl('g', { class: 'chart-hit' }, svg);
        values.forEach((_, i) => {
            const hit = svgEl('rect', {
                x: plot.x0 + slot * i, y: plot.y1, width: slot, height: plot.y0 - plot.y1, fill: 'transparent', 'data-i': i
            }, hitLayer);
            const enter = () => {
                bars.forEach((b, k) => b && b.classList.toggle('faded', k !== i));
                const rect = svg.getBoundingClientRect();
                showTooltip(container, tooltip, describe(i) + (onSelect ? HINT : ''), (x(i) / plot.width) * rect.width);
            };
            hit.addEventListener('pointerenter', enter);
            hit.addEventListener('pointerdown', enter);
        });
        svg.addEventListener('pointerleave', evt => {
            if (evt.pointerType === 'touch') return;
            bars.forEach(b => b && b.classList.remove('faded'));
            hideTooltip(tooltip);
        });
        selectable(hitLayer, onSelect, evt => Number(evt.target.dataset.i));
    }

    // Tapping anywhere outside a chart clears touch tooltips.
    document.addEventListener('pointerdown', evt => {
        if (evt.target.closest && evt.target.closest('.chart')) return;
        document.querySelectorAll('.chart-tooltip.visible').forEach(hideTooltip);
        document.querySelectorAll('.chart-hover.visible').forEach(g => g.classList.remove('visible'));
        document.querySelectorAll('.chart-bar.faded').forEach(b => b.classList.remove('faded'));
    });

    root.Charts = { line, columns, shortDate, monthYear };
})(this);
