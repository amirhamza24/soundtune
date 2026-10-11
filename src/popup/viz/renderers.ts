import type { VisualizerStyle, VisualizerTheme } from '../../shared/types';

type RGB = readonly [number, number, number];
export interface Theme {
  c0: RGB;
  c1: RGB;
  c2: RGB;
}

export const THEMES: Record<VisualizerTheme, Theme> = {
  violet: { c0: [76, 29, 149], c1: [139, 92, 246], c2: [221, 214, 254] },
  aurora: { c0: [6, 95, 70], c1: [52, 211, 153], c2: [204, 251, 241] },
  sunset: { c0: [157, 23, 77], c1: [249, 115, 22], c2: [254, 240, 138] },
  ocean: { c0: [30, 64, 175], c1: [56, 189, 248], c2: [224, 242, 254] },
  red: { c0: [127, 17, 34], c1: [239, 68, 68], c2: [254, 205, 205] },
  mono: { c0: [90, 90, 110], c1: [190, 190, 210], c2: [255, 255, 255] },
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rgba = (c: RGB, a = 1): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** t in 0..1 walks c0 -> c1 -> c2 */
export function mix(th: Theme, t: number): RGB {
  const k = Math.min(1, Math.max(0, t));
  const [a, b, f] = k < 0.5 ? [th.c0, th.c1, k * 2] : [th.c1, th.c2, (k - 0.5) * 2];
  return [Math.round(lerp(a[0], b[0], f)), Math.round(lerp(a[1], b[1], f)), Math.round(lerp(a[2], b[2], f))];
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number }
interface Ring { r: number; a: number; hue: number; x?: number; y?: number }

/**
 * Mutable animation state shared by all renderers. Every number in `level` comes from the real
 * analyser spectrum of the processed audio; nothing is synthesised when no audio flows.
 */
export class VizState {
  w = 0;
  h = 0;
  t = 0;
  dt = 1 / 60;
  readonly n: number;
  level: number[];
  peak: number[];
  bass = 0;
  mid = 0;
  high = 0;
  energy = 0;
  beat = 0;
  private avgBass = 0;
  private cooldown = 0;
  particles: Particle[] = [];
  rings: Ring[] = [];
  drops: Array<{ x: number; y: number; v: number; len: number; hue: number }> = [];
  tunT = 0;
  dotGrid: Float32Array | null = null;
  hist: number[][] = [];
  histT = 0;
  stars: Array<{ a: number; r: number; arm: number; size: number; band: number }> | null = null;

  constructor(n: number) {
    this.n = n;
    this.level = new Array<number>(n).fill(0);
    this.peak = new Array<number>(n).fill(0);
  }

  update(target: number[], dt: number, sensitivity: number, fresh: boolean, reduce: boolean): void {
    this.dt = dt;
    this.t += dt;
    for (let i = 0; i < this.n; i++) {
      const raw = fresh ? Math.min(1, Math.max(0, (((target[i] ?? 0) - 50) / 190) * sensitivity)) : 0;
      const cur = this.level[i] ?? 0;
      const k = raw > cur ? 0.55 : 0.12;
      const next = reduce ? raw : cur + (raw - cur) * (1 - Math.pow(1 - k, dt * 60));
      this.level[i] = next;
      this.peak[i] = Math.max(next, (this.peak[i] ?? 0) - dt * 0.45);
    }
    const avg = (a: number, b: number): number => this.level.slice(a, b).reduce((s, v) => s + v, 0) / Math.max(1, b - a);
    const n = this.n;
    this.bass = avg(0, Math.round(n * 0.14));
    this.mid = avg(Math.round(n * 0.14), Math.round(n * 0.6));
    this.high = avg(Math.round(n * 0.6), n);
    this.energy = (this.bass + this.mid + this.high) / 3;
    this.cooldown -= dt;
    if (this.bass > this.avgBass * 1.25 + 0.06 && this.cooldown <= 0 && this.bass > 0.15) {
      this.beat = 1;
      this.cooldown = 0.2;
    }
    this.avgBass = lerp(this.avgBass, this.bass, Math.min(1, dt * 3));
    this.beat *= Math.exp(-dt * 5);
    this.histT += dt;
    if (this.histT > 0.07) {
      this.histT = 0;
      this.hist.unshift([...this.level]);
      if (this.hist.length > 24) this.hist.pop();
    }
  }
}

export type Renderer = (g: CanvasRenderingContext2D, s: VizState, th: Theme) => void;

export const vGrad = (g: CanvasRenderingContext2D, h: number, th: Theme, a = 1): CanvasGradient => {
  const gr = g.createLinearGradient(0, h, 0, 0);
  gr.addColorStop(0, rgba(th.c0, a));
  gr.addColorStop(0.55, rgba(th.c1, a));
  gr.addColorStop(1, rgba(th.c2, a));
  return gr;
};

const bars: Renderer = (g, s, th) => {
  const { w, h, n } = s;
  const gap = Math.max(2, w / n * 0.25);
  const bw = (w - gap * (n - 1)) / n;
  g.save();
  g.shadowColor = rgba(th.c1, 0.55);
  g.shadowBlur = Math.min(18, h * 0.04);
  g.fillStyle = vGrad(g, h, th);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const bh = Math.max(3, (s.level[i] ?? 0) * (h - 6));
    g.roundRect(i * (bw + gap), h - bh, bw, bh, Math.min(bw / 2, 6));
  }
  g.fill();
  g.restore();
  g.fillStyle = rgba(th.c2, 0.9);
  for (let i = 0; i < n; i++) {
    const y = h - (s.peak[i] ?? 0) * (h - 6) - 5;
    g.fillRect(i * (bw + gap), Math.min(h - 3, y), bw, 2);
  }
};

const mirror: Renderer = (g, s, th) => {
  const { w, h, n } = s;
  const gap = Math.max(2, w / n * 0.25);
  const bw = (w - gap * (n - 1)) / n;
  const mid = h / 2;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, rgba(th.c2, 0.95));
  grad.addColorStop(0.5, rgba(th.c1, 0.95));
  grad.addColorStop(1, rgba(th.c2, 0.95));
  g.save();
  g.shadowColor = rgba(th.c1, 0.6);
  g.shadowBlur = 16;
  g.fillStyle = grad;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    // low frequencies in the middle, highs spread to both edges
    const idx = Math.abs(i - (n - 1) / 2) * 2;
    const v = s.level[Math.min(n - 1, Math.round(idx))] ?? 0;
    const bh = Math.max(2, v * (h / 2 - 6));
    g.roundRect(i * (bw + gap), mid - bh, bw, bh * 2, Math.min(bw / 2, 6));
  }
  g.fill();
  g.restore();
};

export const curvePath = (g: CanvasRenderingContext2D, pts: Array<[number, number]>): void => {
  g.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  const l = pts[pts.length - 1]!;
  g.lineTo(l[0], l[1]);
};

const curve: Renderer = (g, s, th) => {
  const { w, h, n } = s;
  const base = h * 0.72;
  const pts: Array<[number, number]> = s.level.map((v, i) => [(i / (n - 1)) * w, base - v * (base - 10)]);
  g.beginPath();
  g.moveTo(0, base);
  curvePath(g, pts);
  g.lineTo(w, base);
  g.closePath();
  const fill = g.createLinearGradient(0, 0, 0, base);
  fill.addColorStop(0, rgba(th.c1, 0.55));
  fill.addColorStop(1, rgba(th.c0, 0.02));
  g.fillStyle = fill;
  g.fill();
  g.save();
  g.shadowColor = rgba(th.c1, 0.9);
  g.shadowBlur = 20;
  g.beginPath();
  curvePath(g, pts);
  g.strokeStyle = rgba(th.c2, 0.95);
  g.lineWidth = 2.5;
  g.stroke();
  g.restore();
  // soft reflection
  g.save();
  g.globalAlpha = 0.22;
  g.beginPath();
  g.moveTo(0, base);
  curvePath(g, pts.map(([x, y]) => [x, base + (base - y) * 0.35] as [number, number]));
  g.lineTo(w, base);
  g.closePath();
  g.fillStyle = rgba(th.c1, 0.5);
  g.fill();
  g.restore();
};

const radial: Renderer = (g, s, th) => {
  const { w, h, n } = s;
  const cx = w / 2;
  const cy = h / 2;
  const m = Math.min(w, h);
  const r0 = m * 0.17 * (1 + s.beat * 0.1 + s.bass * 0.08);
  const count = n * 2;
  const rot = s.t * 0.15;
  const glow = g.createRadialGradient(cx, cy, r0 * 0.2, cx, cy, r0 * 1.6);
  glow.addColorStop(0, rgba(th.c1, 0.28 + s.bass * 0.35));
  glow.addColorStop(1, rgba(th.c1, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.arc(cx, cy, r0 * 1.6, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.lineCap = 'round';
  g.lineWidth = Math.max(2, (Math.PI * 2 * r0) / count * 0.55);
  g.shadowColor = rgba(th.c1, 0.7);
  g.shadowBlur = 12;
  for (let i = 0; i < count; i++) {
    const idx = i < n ? i : count - 1 - i;
    const v = s.level[idx] ?? 0;
    const a = (i / count) * Math.PI * 2 + rot;
    const len = 4 + v * m * 0.3;
    g.strokeStyle = rgba(mix(th, 0.25 + v * 0.75), 0.95);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
    g.stroke();
  }
  g.restore();
  g.strokeStyle = rgba(th.c2, 0.35 + s.beat * 0.4);
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(cx, cy, r0 * 0.92, 0, Math.PI * 2);
  g.stroke();
};

const rings: Renderer = (g, s, th) => {
  const { w, h } = s;
  const cx = w / 2;
  const cy = h / 2;
  const m = Math.min(w, h);
  if (s.beat > 0.95 && s.rings.length < 14) s.rings.push({ r: m * 0.08, a: 1, hue: Math.random() });
  // faint ambient ring so quiet passages still move
  if (s.energy > 0.08 && Math.floor(s.t * 2.2) !== Math.floor((s.t - s.dt) * 2.2) && s.rings.length < 14) {
    s.rings.push({ r: m * 0.08, a: 0.5, hue: Math.random() });
  }
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const r of s.rings) {
    r.r += s.dt * (m * 0.18 + s.bass * m * 0.5);
    r.a -= s.dt * 0.55;
    if (r.a <= 0) continue;
    g.strokeStyle = rgba(mix(th, 0.35 + r.hue * 0.65), r.a * 0.8);
    g.lineWidth = 1 + r.a * 4;
    g.shadowColor = rgba(th.c1, 0.8);
    g.shadowBlur = 14;
    g.beginPath();
    g.arc(cx, cy, r.r, 0, Math.PI * 2);
    g.stroke();
  }
  s.rings = s.rings.filter((r) => r.a > 0);
  g.restore();
  // orb
  const rad = m * (0.07 + s.bass * 0.07 + s.beat * 0.02);
  const orb = g.createRadialGradient(cx, cy, 0, cx, cy, rad * 2.2);
  orb.addColorStop(0, rgba(th.c2, 0.95));
  orb.addColorStop(0.35, rgba(th.c1, 0.75));
  orb.addColorStop(1, rgba(th.c0, 0));
  g.fillStyle = orb;
  g.beginPath();
  g.arc(cx, cy, rad * 2.2, 0, Math.PI * 2);
  g.fill();
  // dotted spectrum halo
  const n = s.n;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const v = s.level[i] ?? 0;
    const rr = rad * 2.6 + v * m * 0.06;
    g.fillStyle = rgba(mix(th, 0.3 + v * 0.7), 0.4 + v * 0.6);
    g.beginPath();
    g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.5 + v * 3, 0, Math.PI * 2);
    g.fill();
  }
};

const particles: Renderer = (g, s, th) => {
  const { w, h, n } = s;
  const list = s.particles;
  // rising sparks from each band, bursts from the centre on beats
  for (let i = 0; i < n; i += 2) {
    const v = s.level[i] ?? 0;
    if (v > 0.12 && Math.random() < v * 0.55 && list.length < 700) {
      list.push({ x: ((i + 0.5) / n) * w, y: h, vx: (Math.random() - 0.5) * 30, vy: -(60 + v * h * 0.9) * (0.6 + Math.random() * 0.6), life: 0, max: 1.2 + Math.random() * 1.4, size: 1 + v * 3.5, hue: i / n });
    }
  }
  if (s.beat > 0.95) {
    for (let k = 0; k < 36 && list.length < 700; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * Math.min(w, h) * 0.5;
      list.push({ x: w / 2, y: h / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.8 + Math.random() * 0.9, size: 1.5 + Math.random() * 3, hue: Math.random() });
    }
  }
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const p of list) {
    p.life += s.dt;
    p.x += p.vx * s.dt;
    p.y += p.vy * s.dt;
    p.vy += 30 * s.dt;
    p.vx *= 1 - s.dt * 0.4;
    const k = 1 - p.life / p.max;
    if (k <= 0) continue;
    const c = mix(th, 0.3 + p.hue * 0.7);
    const rad = p.size * (0.5 + k);
    const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 3);
    grad.addColorStop(0, rgba(c, k));
    grad.addColorStop(1, rgba(c, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(p.x, p.y, rad * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  s.particles = list.filter((p) => p.life < p.max);
};

const dots: Renderer = (g, s, th) => {
  const cols = 32;
  const rows = Math.max(8, Math.round(s.h / 22));
  const cw = s.w / cols;
  const ch = s.h / rows;
  const r = Math.max(2, Math.min(cw, ch) * 0.32);
  for (let c = 0; c < cols; c++) {
    const i = Math.min(s.n - 1, Math.floor((c / cols) * s.n));
    const v = Math.max(s.level[i] ?? 0, s.level[Math.min(s.n - 1, i + 1)] ?? 0);
    const lit = Math.round(v * rows);
    const pk = Math.round((s.peak[i] ?? 0) * rows);
    for (let rI = 0; rI < rows; rI++) {
      const x = c * cw + cw / 2;
      const y = s.h - rI * ch - ch / 2;
      const on = rI < lit;
      const isPeak = rI === pk - 1 && pk > lit;
      if (on || isPeak) {
        const col = mix(th, rI / rows);
        g.fillStyle = rgba(col, isPeak ? 0.95 : 0.95);
        g.shadowColor = rgba(col, 0.8);
        g.shadowBlur = 8;
      } else {
        g.fillStyle = rgba(th.c1, 0.1);
        g.shadowBlur = 0;
      }
      g.beginPath();
      g.arc(x, y, on || isPeak ? r : r * 0.55, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.shadowBlur = 0;
};

const aurora: Renderer = (g, s, th) => {
  const { w, h } = s;
  const bands = [s.bass, s.mid, s.high, (s.bass + s.mid) / 2];
  g.save();
  g.filter = 'blur(14px)';
  g.globalCompositeOperation = 'lighter';
  bands.forEach((lv, k) => {
    const yBase = h * (0.35 + k * 0.12);
    const amp = h * (0.05 + lv * 0.28);
    const thick = h * (0.1 + lv * 0.28);
    const sp = 0.35 + k * 0.17;
    g.beginPath();
    for (let x = 0; x <= w; x += 12) {
      const y = yBase + Math.sin(x * 0.006 * (1 + k * 0.3) + s.t * sp) * amp + Math.sin(x * 0.013 - s.t * sp * 1.4) * amp * 0.4;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    for (let x = w; x >= 0; x -= 12) {
      const y = yBase + thick + Math.sin(x * 0.005 * (1 + k * 0.3) + s.t * sp + 1.3) * amp + Math.sin(x * 0.011 - s.t * sp) * amp * 0.5;
      g.lineTo(x, y);
    }
    g.closePath();
    const gr = g.createLinearGradient(0, yBase - amp, 0, yBase + thick + amp);
    const col = mix(th, 0.25 + k * 0.25);
    gr.addColorStop(0, rgba(col, 0));
    gr.addColorStop(0.5, rgba(col, 0.2 + lv * 0.3));
    gr.addColorStop(1, rgba(mix(th, 0.9), 0));
    g.fillStyle = gr;
    g.fill();
  });
  g.restore();
};

const ridge: Renderer = (g, s, th) => {
  const { w, h, n } = s;
  const rows = s.hist.length;
  const top = h * 0.22;
  const span = h * 0.7;
  g.lineJoin = 'round';
  // draw back (old) to front (new) so nearer lines hide the ones behind
  for (let r = rows - 1; r >= 0; r--) {
    const row = s.hist[r]!;
    const depth = rows <= 1 ? 1 : 1 - r / (rows - 1);
    const base = top + span * depth;
    const amp = h * (0.07 + depth * 0.2);
    g.beginPath();
    g.moveTo(0, base);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      // taper at the edges for the classic ridge silhouette
      const edge = Math.sin((i / (n - 1)) * Math.PI);
      g.lineTo(x, base - (row[i] ?? 0) * amp * (0.35 + edge));
    }
    g.lineTo(w, base);
    g.closePath();
    g.fillStyle = 'rgba(8,6,16,0.92)';
    g.fill();
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const edge = Math.sin((i / (n - 1)) * Math.PI);
      const y = base - (row[i] ?? 0) * amp * (0.35 + edge);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokeStyle = rgba(mix(th, 0.25 + depth * 0.75), 0.25 + depth * 0.75);
    g.lineWidth = 1 + depth * 1.4;
    if (r === 0) {
      g.shadowColor = rgba(th.c1, 0.9);
      g.shadowBlur = 14;
    }
    g.stroke();
    g.shadowBlur = 0;
  }
};

const classic: Renderer = (g, s, th) => {
  const cols = 28;
  const rows = Math.max(10, Math.round(s.h / 16));
  const cw = s.w / cols;
  const ch = (s.h * 0.82) / rows;
  const gapX = cw * 0.18;
  const gapY = Math.max(1.5, ch * 0.2);
  for (let c = 0; c < cols; c++) {
    const i = Math.min(s.n - 1, Math.floor((c / cols) * s.n));
    const v = Math.max(s.level[i] ?? 0, s.level[Math.min(s.n - 1, i + 1)] ?? 0);
    const lit = Math.round(v * rows);
    const pk = Math.round((s.peak[i] ?? 0) * rows);
    for (let r = 0; r < rows; r++) {
      const y = s.h * 0.84 - (r + 1) * ch;
      const on = r < lit;
      const cap = r === pk - 1 && pk > lit;
      const col = mix(th, r / rows);
      g.fillStyle = on || cap ? rgba(col, cap ? 1 : 0.95) : rgba(th.c1, 0.07);
      g.fillRect(c * cw + gapX / 2, y + gapY / 2, cw - gapX, ch - gapY);
      if (on && r < rows * 0.5) {
        // soft reflection under the floor line
        g.fillStyle = rgba(col, 0.08);
        g.fillRect(c * cw + gapX / 2, s.h * 0.84 + r * ch * 0.5, cw - gapX, ch * 0.4);
      }
    }
  }
};

const lollipop: Renderer = (g, s, th) => {
  const { w, h } = s;
  const count = 36;
  const base = h * 0.88;
  const pts: Array<[number, number]> = [];
  g.save();
  g.lineCap = 'round';
  for (let c = 0; c < count; c++) {
    const i = Math.min(s.n - 1, Math.floor((c / count) * s.n));
    const v = Math.max(s.level[i] ?? 0, s.level[Math.min(s.n - 1, i + 1)] ?? 0);
    const x = ((c + 0.5) / count) * w;
    const y = base - 8 - v * (base - 30);
    pts.push([x, y]);
    const col = mix(th, 0.3 + v * 0.7);
    g.strokeStyle = rgba(col, 0.55);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, base);
    g.lineTo(x, y);
    g.stroke();
    g.shadowColor = rgba(col, 0.9);
    g.shadowBlur = 16;
    g.fillStyle = rgba(mix(th, 0.55 + v * 0.45), 1);
    g.beginPath();
    g.arc(x, y, 4 + v * 9, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  }
  g.beginPath();
  curvePath(g, pts);
  g.strokeStyle = rgba(th.c2, 0.35);
  g.lineWidth = 1.5;
  g.stroke();
  g.restore();
};

const galaxy: Renderer = (g, s, th) => {
  const { w, h } = s;
  const cx = w / 2;
  const cy = h / 2;
  const m = Math.min(w, h) * 0.5;
  if (!s.stars) {
    s.stars = [];
    for (let k = 0; k < 900; k++) {
      const rr = Math.pow(Math.random(), 0.7);
      s.stars.push({ a: Math.random() * Math.PI * 2, r: rr, arm: k % 3, size: 0.6 + Math.random() * 1.8, band: Math.floor(rr * (s.n - 1)) });
    }
  }
  const spin = s.t * (0.12 + s.energy * 0.5);
  const core = g.createRadialGradient(cx, cy, 0, cx, cy, m * 0.55);
  core.addColorStop(0, rgba(th.c2, 0.55 + s.bass * 0.4));
  core.addColorStop(0.3, rgba(th.c1, 0.3 + s.bass * 0.3));
  core.addColorStop(1, rgba(th.c0, 0));
  g.fillStyle = core;
  g.beginPath();
  g.arc(cx, cy, m * 0.55, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const st of s.stars) {
    const v = s.level[st.band] ?? 0;
    // logarithmic spiral: radius winds the angle, three arms offset by 120 degrees
    const ang = st.a * 0.16 + st.r * 5.2 + st.arm * ((Math.PI * 2) / 3) + spin * (1.3 - st.r);
    const rad = m * st.r * (0.85 + s.bass * 0.25 + v * 0.35) * (1 + s.beat * 0.06);
    const scatter = (st.a % 1) * m * 0.07 * st.r;
    const x = cx + Math.cos(ang) * (rad + scatter);
    const y = cy + Math.sin(ang) * (rad + scatter) * 0.62;
    const bright = 0.25 + v * 0.9;
    g.fillStyle = rgba(mix(th, 0.25 + st.r * 0.75), Math.min(1, bright));
    g.beginPath();
    g.arc(x, y, st.size * (0.8 + v * 1.6), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
};

export const BASE_RENDERERS: Partial<Record<VisualizerStyle, Renderer>> = { bars, mirror, curve, radial, rings, particles, dots, aurora, ridge, classic, lollipop, galaxy };

export const BASE_LABELS: Partial<Record<VisualizerStyle, string>> = {
  bars: 'Neon Bars',
  mirror: 'Mirror',
  curve: 'Wave',
  radial: 'Radial',
  rings: 'Pulse Rings',
  particles: 'Particles',
  dots: 'LED Matrix',
  aurora: 'Aurora',
  ridge: 'Ridge Lines',
  classic: 'Classic Meter',
  lollipop: 'Lollipop',
  galaxy: 'Galaxy',
};
