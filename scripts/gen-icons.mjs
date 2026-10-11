// Generates PNG icons (no dependencies): violet rounded square with audio-wave bars.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

function render(size) {
  const SS = 4, N = size * SS;
  const px = new Float32Array(size * size * 4);
  const bars = [0.30, 0.55, 0.85, 0.55, 0.38];
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    // rounded square mask
    const r = 0.24, cx = Math.min(Math.max(u, r), 1 - r), cy = Math.min(Math.max(v, r), 1 - r);
    if (Math.hypot(u - cx, v - cy) > r) continue;
    const t = (u + v) / 2;
    let R = lerp(0x5b, 0x8b, 1 - t) , G = lerp(0x21, 0x5c, 1 - t), B = lerp(0xb6, 0xf6, 1 - t);
    // bars
    const bw = 0.095, gap = 0.035, total = bars.length * bw + (bars.length - 1) * gap, x0 = (1 - total) / 2;
    const i = Math.floor((u - x0) / (bw + gap));
    if (i >= 0 && i < bars.length) {
      const bx = x0 + i * (bw + gap);
      const h = bars[i] * 0.56, top = 0.5 - h / 2, bot = 0.5 + h / 2, rr = bw / 2;
      const px2 = Math.min(Math.max(u, bx + rr * 0), bx + bw);
      const yy = Math.min(Math.max(v, top + rr), bot - rr);
      const xx = bx + rr;
      if (u >= bx && u <= bx + bw && Math.hypot(u - xx, v - yy) <= rr && px2 >= 0) { R = 0xf5; G = 0xf3; B = 0xff; }
    }
    const o = (Math.floor(y / SS) * size + Math.floor(x / SS)) * 4;
    px[o] += R; px[o + 1] += G; px[o + 2] += B; px[o + 3] += 255;
  }
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4, a = px[o + 3] / (SS * SS);
      const d = y * (size * 4 + 1) + 1 + x * 4;
      const cov = a / 255;
      raw[d] = cov ? Math.round(px[o] / (SS * SS) / cov) : 0;
      raw[d + 1] = cov ? Math.round(px[o + 1] / (SS * SS) / cov) : 0;
      raw[d + 2] = cov ? Math.round(px[o + 2] / (SS * SS) / cov) : 0;
      raw[d + 3] = Math.round(a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(`public/icons/icon${s}.png`, render(s));
console.log('icons written');
