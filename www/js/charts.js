/* =====================================================================
 * charts.js — 轻量 SVG 图表组件（折线图 / 柱状图 / 迷你趋势图）
 * 依赖：无。基于 viewBox 自适应，支持参考线、正常区间带、异常点标记
 * ===================================================================== */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function autoRange(values, lo, hi) {
    let min = Math.min.apply(null, values);
    let max = Math.max.apply(null, values);
    if (lo != null) min = Math.min(min, lo);
    if (hi != null) max = Math.max(max, hi);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const pad = span * 0.15;
    return [min - pad, max + pad];
  }

  /* 折线图 + 参考线 + 区间带 */
  function line(container, opts) {
    opts = opts || {};
    const W = 320, H = opts.height || 170;
    const pl = 8, pr = 8, pt = 14, pb = 24;
    const iw = W - pl - pr, ih = H - pt - pb;

    const points = opts.points || [];
    const vals = points.map((p) => p.v).filter((v) => v != null);
    if (!vals.length) { empty(container, opts.emptyText); return; }

    const [min, max] = autoRange(vals, opts.ylo, opts.yhi);
    const x = (i) => pl + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const y = (v) => pt + ih - ((v - min) / (max - min)) * ih;

    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', preserveAspectRatio: 'xMidYMid meet' });

    // 正常区间带
    if (opts.band) {
      const yh = y(opts.band.hi), yl = y(opts.band.lo);
      svg.appendChild(el('rect', {
        x: pl, y: Math.min(yh, yl), width: iw, height: Math.abs(yl - yh),
        fill: opts.band.color || 'var(--ok-bg)', rx: 4
      }));
    }

    // 网格 + 参考线
    (opts.refs || []).forEach((r) => {
      const yy = y(r.v);
      svg.appendChild(el('line', { x1: pl, y1: yy, x2: W - pr, y2: yy, stroke: r.color || 'var(--border)', 'stroke-dasharray': '3,3' }));
      svg.appendChild(el('text', { x: W - pr - 2, y: yy - 3, 'text-anchor': 'end', class: 'chart-ref-label', fill: r.color || 'var(--muted)' }))
        .textContent = r.label != null ? r.label : r.v;
    });

    // 折线
    const d = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: opts.color || 'var(--primary)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    // 面积渐变填充
    if (opts.fill !== false) {
      const gid = 'grad' + Math.random().toString(36).slice(2, 8);
      const defs = el('defs');
      const lg = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
      lg.appendChild(el('stop', { offset: '0%', 'stop-color': opts.color || 'var(--primary)', 'stop-opacity': 0.25 }));
      lg.appendChild(el('stop', { offset: '100%', 'stop-color': opts.color || 'var(--primary)', 'stop-opacity': 0 }));
      defs.appendChild(lg);
      svg.appendChild(defs);
      svg.appendChild(el('path', {
        d: d + ' L' + x(points.length - 1).toFixed(1) + ' ' + (pt + ih) + ' L' + x(0).toFixed(1) + ' ' + (pt + ih) + ' Z',
        fill: 'url(#' + gid + ')'
      }));
    }

    // 数据点（异常标记）
    points.forEach((p, i) => {
      const c = p.status === 'high' ? 'var(--danger)' : p.status === 'low' ? 'var(--warning)' : (opts.color || 'var(--primary)');
      svg.appendChild(el('circle', { cx: x(i), cy: y(p.v), r: p.status ? 4 : 2.5, fill: '#fff', stroke: c, 'stroke-width': 2 }));
    });

    // x 轴标签（首尾 + 中间）
    const showIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];
    points.forEach((p, i) => {
      if (points.length > 3 && showIdx.indexOf(i) < 0) return;
      svg.appendChild(el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', class: 'chart-axis-label' }))
        .textContent = p.label || '';
    });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* 柱状图 */
  function bar(container, opts) {
    opts = opts || {};
    const W = 320, H = opts.height || 170;
    const pl = 8, pr = 8, pt = 16, pb = 24;
    const iw = W - pl - pr, ih = H - pt - pb;

    const bars = opts.bars || [];
    const vals = bars.map((b) => b.v).filter((v) => v != null);
    if (!vals.length) { empty(container, opts.emptyText); return; }

    let min = Math.min.apply(null, vals.concat(opts.ylo != null ? [opts.ylo] : []));
    let max = Math.max.apply(null, vals.concat(opts.yhi != null ? [opts.yhi] : []));
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    min -= span * 0.12; max += span * 0.12;

    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'chart', preserveAspectRatio: 'xMidYMid meet' });
    const bw = iw / bars.length;
    const baseY = pt + ih; // 柱底基线
    const y = (v) => pt + ih - ((v - min) / (max - min)) * ih;
    // 数值格式化：消除浮点尾数（如 64.35000000000001）
    const fmt = (v) => String(Math.round(v * 10) / 10);
    // 数值标签：显式指定时优先，否则柱子太多（>10根）时自动隐藏避免重叠
    const showValue = opts.showValue != null ? !!opts.showValue : bars.length <= 10;

    if (opts.refs) opts.refs.forEach((r) => {
      const yy = y(r.v);
      svg.appendChild(el('line', { x1: pl, y1: yy, x2: W - pr, y2: yy, stroke: r.color || 'var(--border)', 'stroke-dasharray': '3,3' }));
    });

    bars.forEach((b, i) => {
      // 柱高 = 基线 - 柱顶（正值）；至少1px保证极小值也可见
      const topY = y(b.v);
      const h = Math.max(1, baseY - topY);
      const color = b.status === 'high' ? 'var(--danger)' : b.status === 'low' ? 'var(--warning)' : (b.color || opts.color || 'var(--primary)');
      const x0 = pl + i * bw + bw * 0.2;
      svg.appendChild(el('rect', { x: x0, y: baseY - h, width: bw * 0.6, height: h, rx: Math.min(3, bw * 0.3), fill: color }));
      if (showValue) {
        // 标签位置钳制在 viewBox 内，防止越界裁剪
        const tx = Math.max(pl + 10, Math.min(W - pr - 10, x0 + bw * 0.3));
        const ty = Math.max(9, baseY - h - 3);
        svg.appendChild(el('text', { x: tx, y: ty, 'text-anchor': 'middle', class: 'chart-value-label', fill: 'var(--muted)' }))
          .textContent = fmt(b.v);
      }
      if (bars.length <= 8 || i % Math.ceil(bars.length / 6) === 0) {
        svg.appendChild(el('text', { x: Math.max(pl + 10, Math.min(W - pr - 10, x0 + bw * 0.3)), y: H - 6, 'text-anchor': 'middle', class: 'chart-axis-label' }))
          .textContent = b.label || '';
      }
    });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* 迷你趋势图（sparkline） */
  function spark(container, opts) {
    opts = opts || {};
    const W = 120, H = 40;
    const vals = opts.values || [];
    if (vals.length < 2) {
      container.innerHTML = ''; // 无数据时不渲染文本，避免与数值/单位重叠
      return;
    }
    let min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const x = (i) => (i / (vals.length - 1)) * (W - 4) + 2;
    const y = (v) => H - 4 - ((v - min) / span) * (H - 8);
    const d = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'spark', preserveAspectRatio: 'none' });
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: opts.color || 'var(--primary)', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    svg.appendChild(el('circle', { cx: x(vals.length - 1), cy: y(vals[vals.length - 1]), r: 2.5, fill: opts.color || 'var(--primary)' }));
    container.innerHTML = '';
    container.appendChild(svg);
  }

  function empty(container, text) {
    container.innerHTML = '<div class="chart-empty">' + (text || '暂无数据') + '</div>';
  }

  global.Charts = { line, bar, spark };
})(window);
