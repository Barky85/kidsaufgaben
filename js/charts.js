// Leichte SVG-Diagramme ohne Bibliothek
import { fmtNum } from "./util.js";

const NS = "http://www.w3.org/2000/svg";
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  for (const k of kids) if (k) el.append(typeof k === "string" ? document.createTextNode(k) : k);
  return el;
}

function niceScale(min, max, ticks = 4, integer = false) {
  if (max === min) max = min + 1;
  const rough = (max - min) / ticks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const f = rough / pow;
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  if (integer) step = Math.max(1, Math.ceil(step));
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
}

function tickValues(sc) {
  const out = [];
  for (let v = sc.min; v <= sc.max + sc.step / 1000; v += sc.step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

function xLabelEvery(n, width) {
  const perLabel = 34;
  return Math.max(1, Math.ceil((n * perLabel) / Math.max(width, 1)));
}

/** Zeichnet `draw(width)` in den Container und zeichnet bei Größenänderung neu. */
export function mountChart(container, draw) {
  let lastW = 0;
  const paint = () => {
    const w = Math.floor(container.clientWidth);
    if (!w || w === lastW) return;
    lastW = w;
    container.replaceChildren(draw(w));
  };
  requestAnimationFrame(paint);
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => paint());
    ro.observe(container);
  }
}

/**
 * Gestapeltes Balkendiagramm (Werte ≥ 0).
 * series: [{ name, color, values }]
 */
export function barsChart({ width, height = 230, labels, series, ariaLabel }) {
  const m = { l: 34, r: 8, t: 12, b: 26 };
  const W = width, H = height;
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((sum, se) => sum + (se.values[i] || 0), 0));
  const sc = niceScale(0, Math.max(1, ...totals), 4, true);
  const y = (v) => m.t + ph - ((v - sc.min) / (sc.max - sc.min)) * ph;
  const slot = pw / n;
  const bw = Math.min(40, slot * 0.64);

  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": ariaLabel || "Balkendiagramm", class: "chart" });
  for (const v of tickValues(sc)) {
    svg.append(s("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: v === 0 ? "ax-zero" : "grid" }));
    svg.append(s("text", { x: m.l - 6, y: y(v) + 4, class: "ax-text", "text-anchor": "end" }, fmtNum(v)));
  }
  const every = xLabelEvery(n, pw);
  labels.forEach((lab, i) => {
    const cx = m.l + slot * i + slot / 2;
    let acc = 0;
    series.forEach((se) => {
      const v = se.values[i] || 0;
      if (v <= 0) return;
      const y0 = y(acc), y1 = y(acc + v);
      acc += v;
      svg.append(s("rect", { x: cx - bw / 2, y: y1, width: bw, height: Math.max(0, y0 - y1), rx: Math.min(6, bw / 2), fill: se.color },
        s("title", {}, `${lab}: ${se.name} ${v}`)));
    });
    if (i % every === 0) svg.append(s("text", { x: cx, y: H - 8, class: "ax-text", "text-anchor": "middle" }, lab));
  });
  return svg;
}

/**
 * Liniendiagramm mit zwei Y-Achsen (links Punkte, rechts Euro).
 * lines: [{ name, color, values, dashed }]; ppe = Punkte pro Euro
 */
export function linesChart({ width, height = 230, labels, lines, ppe, ariaLabel }) {
  const m = { l: 38, r: 54, t: 12, b: 26 };
  const W = width, H = height;
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const n = labels.length;
  const all = lines.flatMap((l) => l.values);
  const sc = niceScale(Math.min(0, ...all), Math.max(1, ...all), 4, true);
  const y = (v) => m.t + ph - ((v - sc.min) / (sc.max - sc.min)) * ph;
  const x = (i) => m.l + (n === 1 ? pw / 2 : (pw * i) / (n - 1));

  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": ariaLabel || "Liniendiagramm", class: "chart" });
  for (const v of tickValues(sc)) {
    svg.append(s("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: v === 0 ? "ax-zero" : "grid" }));
    svg.append(s("text", { x: m.l - 6, y: y(v) + 4, class: "ax-text", "text-anchor": "end" }, fmtNum(v)));
    svg.append(s("text", { x: W - m.r + 6, y: y(v) + 4, class: "ax-text", "text-anchor": "start" }, `${fmtNum(Math.round((v / ppe) * 100) / 100)} €`));
  }
  const every = xLabelEvery(n, pw);
  labels.forEach((lab, i) => {
    if (i % every === 0) svg.append(s("text", { x: x(i), y: H - 8, class: "ax-text", "text-anchor": "middle" }, lab));
  });
  for (const line of lines) {
    const pts = line.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    svg.append(s("polyline", { points: pts, fill: "none", stroke: line.color, "stroke-width": 3, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": line.dashed ? "6 5" : null }));
    if (n <= 31) line.values.forEach((v, i) => {
      svg.append(s("circle", { cx: x(i), cy: y(v), r: 3.2, fill: line.color },
        s("title", {}, `${labels[i]}: ${line.name} ${fmtNum(v)} P (${fmtNum(Math.round((v / ppe) * 100) / 100)} €)`)));
    });
  }
  return svg;
}
