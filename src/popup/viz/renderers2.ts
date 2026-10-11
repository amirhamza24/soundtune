import { mix, rgba } from './renderers';
import type { Renderer } from './renderers';

/** Warp tunnel: rings rush toward you faster as the music gets louder, wobbling with the spectrum. */
export const tunnel: Renderer = (g, s, th) => {
  const { w, h, n } = s;
  const rings = 16;
  const maxR = Math.hypot(w, h) * 0.55;
  s.tunT = (s.tunT + s.dt * (0.1 + s.energy * 0.9 + s.beat * 0.5)) % 1;
  const cx = w / 2 + Math.sin(s.t * 0.6) * w * 0.03 * (0.4 + s.energy);
  const cy = h / 2 + Math.cos(s.t * 0.45) * h * 0.03 * (0.4 + s.energy);
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.5);
  glow.addColorStop(0, rgba(th.c1, 0.2 + s.beat * 0.35));
  glow.addColorStop(1, rgba(th.c0, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineJoin = 'round';
  const pts = 72;
  for (let i = 0; i < rings; i++) {
    const z = (i / rings + s.tunT) % 1;
    const r = Math.pow(z, 2.3) * maxR + 4;
    const spin = s.t * 0.25 * (1 - z);
    g.beginPath();
    for (let j = 0; j <= pts; j++) {
      const idx = Math.min(n - 1, Math.floor(((j % pts) / pts) * n * 0.5));
      const wob = 1 + (s.level[idx] ?? 0) * 0.32 * z;
      const a = (j / pts) * Math.PI * 2 + spin;
      const x = cx + Math.cos(a) * r * wob;
      const y = cy + Math.sin(a) * r * wob * 0.8;
      if (j === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokeStyle = rgba(mix(th, 0.2 + z * 0.8), Math.min(1, z * 1.3) * 0.9);
    g.lineWidth = 0.8 + z * 3.2 + s.beat * 1.5;
    g.shadowColor = rgba(th.c1, 0.8);
    g.shadowBlur = 10 * z;
    g.stroke();
  }
  g.restore();
};

/** Neon rain: each frequency column drops streaks, faster and longer with its level. */
export const rain: Renderer = (g, s, th) => {
  const { w, h, n } = s;
  const cols = 48;
  for (let c = 0; c < cols; c++) {
    const i = Math.min(n - 1, Math.floor((c / cols) * n));
    const v = s.level[i] ?? 0;
    if (v > 0.1 && Math.random() < v * s.dt * 22 && s.drops.length < 600) {
      s.drops.push({ x: ((c + 0.5) / cols) * w, y: -10, v: h * (0.35 + v * 1.1), len: 24 + v * h * 0.22, hue: c / cols });
    }
  }
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (const d of s.drops) {
    d.y += d.v * s.dt;
    const col = mix(th, 0.3 + d.hue * 0.7);
    const grad = g.createLinearGradient(d.x, d.y - d.len, d.x, d.y);
    grad.addColorStop(0, rgba(col, 0));
    grad.addColorStop(1, rgba(col, 0.95));
    g.strokeStyle = grad;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(d.x, d.y - d.len);
    g.lineTo(d.x, d.y);
    g.stroke();
    g.fillStyle = rgba(th.c2, 0.95);
    g.beginPath();
    g.arc(d.x, d.y, 2.2, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  s.drops = s.drops.filter((d) => d.y - d.len < h);
  // floor glow reacts to bass
  const floor = g.createLinearGradient(0, h, 0, h * 0.8);
  floor.addColorStop(0, rgba(th.c1, 0.18 + s.bass * 0.4));
  floor.addColorStop(1, rgba(th.c1, 0));
  g.fillStyle = floor;
  g.fillRect(0, h * 0.8, w, h * 0.2);
};

/** Water ripples: beats and strong bands drop rings that spread out as flattened ellipses. */
export const ripple: Renderer = (g, s, th) => {
  const { w, h, n } = s;
  const m = Math.min(w, h);
  const drop = (x: number, y: number, power: number): void => {
    if (s.rings.length < 30) s.rings.push({ r: 4, a: 0.6 + power * 0.4, hue: Math.random(), x, y });
  };
  const tick = Math.floor(s.t * 1.6) !== Math.floor((s.t - s.dt) * 1.6); // steady ambient drops when no clear beat
  if (s.beat > 0.95 || (tick && s.energy > 0.1)) drop(w * (0.3 + Math.random() * 0.4), h * (0.35 + Math.random() * 0.3), s.bass);
  for (let i = 0; i < n; i += 8) {
    if ((s.level[i] ?? 0) > 0.7 && Math.random() < s.dt * 3) drop(w * (0.1 + 0.8 * (i / n)), h * (0.3 + Math.random() * 0.4), 0.3);
  }
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const r of s.rings) {
    r.r += s.dt * (m * 0.22 + s.energy * m * 0.2);
    r.a -= s.dt * 0.4;
    if (r.a <= 0) continue;
    const x = r.x ?? w / 2;
    const y = r.y ?? h / 2;
    for (let k = 0; k < 3; k++) {
      const rr = r.r - k * 14;
      if (rr <= 0) continue;
      g.strokeStyle = rgba(mix(th, 0.3 + r.hue * 0.7), r.a * (1 - k * 0.3));
      g.lineWidth = 2.2 - k * 0.5;
      g.shadowColor = rgba(th.c1, 0.8);
      g.shadowBlur = 10;
      g.beginPath();
      g.ellipse(x, y, rr, rr * 0.5, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.restore();
  s.rings = s.rings.filter((r) => r.a > 0);
};

/**
 * Full-page dot wall: one column of round dots per slice of the spectrum (bass on the left,
 * treble on the right). Dots fill upward with the music and fade softly, peaks hold briefly.
 */
export const dotwall: Renderer = (g, s, th) => {
  const { w, h, n } = s;
  const cell = Math.max(14, Math.min(26, w / 54));
  const cols = Math.max(12, Math.floor(w / cell));
  const labelH = h > 500 ? 96 : 24; // header strip (labels) above the dots, clear of the title bar
  const rows = Math.max(6, Math.floor((h - labelH) / cell));
  const cw = w / cols;
  const ch = (h - labelH) / rows;
  const size = cols * rows;
  if (!s.dotGrid || s.dotGrid.length !== size) s.dotGrid = new Float32Array(size);
  const grid = s.dotGrid;
  const baseR = Math.min(cw, ch) * 0.36;

  g.save();
  for (let c = 0; c < cols; c++) {
    const pos = (c / (cols - 1)) * (n - 1);
    const i0 = Math.floor(pos);
    const f = pos - i0;
    const v = (s.level[i0] ?? 0) * (1 - f) + (s.level[Math.min(n - 1, i0 + 1)] ?? 0) * f;
    const pk = (s.peak[i0] ?? 0) * (1 - f) + (s.peak[Math.min(n - 1, i0 + 1)] ?? 0) * f;
    const lit = v * rows;
    const peakRow = Math.round(pk * rows) - 1;
    const x = c * cw + cw / 2;
    const section = c / (cols - 1); // 0 bass .. 1 treble
    for (let r = 0; r < rows; r++) {
      const idx = r * cols + c;
      // partial fill on the top dot gives smooth, continuous motion
      const target = r + 1 <= lit ? 1 : Math.max(0, lit - r);
      const cur = grid[idx] ?? 0;
      const b = cur + (target - cur) * (target > cur ? 0.6 : 0.14);
      grid[idx] = b;
      const y = h - r * ch - ch / 2;
      const col = mix(th, Math.min(1, 0.12 + section * 0.55 + (r / rows) * 0.38));
      const isPeak = r === peakRow && peakRow > lit;
      if (b > 0.03 || isPeak) {
        g.fillStyle = rgba(isPeak ? th.c2 : col, isPeak ? 0.95 : 0.12 + b * 0.88);
        g.shadowColor = rgba(col, 0.9);
        g.shadowBlur = b > 0.5 ? 9 : 0;
        g.beginPath();
        g.arc(x, y, baseR * (0.4 + 0.6 * b + s.beat * 0.08), 0, Math.PI * 2);
        g.fill();
      } else {
        g.shadowBlur = 0;
        g.fillStyle = rgba(th.c1, 0.09);
        g.beginPath();
        g.arc(x, y, baseR * 0.4, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.shadowBlur = 0;
  // section labels
  g.font = '600 11px Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const labels: Array<[string, number, number]> = [['BASS', 0.1, s.bass], ['MID', 0.45, s.mid], ['TREBLE', 0.85, s.high]];
  for (const [text, at, lv] of labels) {
    g.fillStyle = rgba(th.c2, 0.35 + lv * 0.6);
    g.fillText(text, w * at, labelH - 12);
  }
  g.strokeStyle = rgba(th.c1, 0.18);
  g.lineWidth = 1;
  g.beginPath();
  for (const at of [0.27, 0.66]) {
    g.moveTo(w * at, labelH - 22);
    g.lineTo(w * at, labelH - 2);
  }
  g.stroke();
  g.restore();
};
