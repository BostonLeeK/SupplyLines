// Draws the app icon (globe split blue/amber with a route arc) into PNGs without any image library.
import fs from 'fs'; import zlib from 'zlib';
function png(w, h, rgba) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function icon(S, maskable) {
  const b = Buffer.alloc(S * S * 4), c = S / 2, R = S * (maskable ? 0.34 : 0.42), mix = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const j = (y * S + x) * 4, dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
    let col = [5, 8, 13, 255];
    if (d < R) {
      const sh = 0.55 + 0.45 * (1 - d / R);                         // simple sphere shading
      const left = dx + dy * 0.35 < 0;                              // two factions split the globe
      const base = left ? [74, 163, 255] : [255, 173, 51];
      col = [base[0] * sh * 0.75, base[1] * sh * 0.75, base[2] * sh * 0.75, 255];
      const ring = Math.abs(Math.hypot(dx + R * 0.15, (dy - R * 0.55) * 1.6) - R * 0.95);   // a white route arc
      if (ring < S * 0.018) { const t = 1 - ring / (S * 0.018); col = [mix(col[0], 255, t), mix(col[1], 255, t), mix(col[2], 255, t), 255]; }
    } else if (d < R + S * 0.03) { const t = 1 - (d - R) / (S * 0.03); col = [mix(5, 90, t), mix(8, 150, t), mix(13, 255, t), 255]; }
    b[j] = col[0]; b[j + 1] = col[1]; b[j + 2] = col[2]; b[j + 3] = col[3];
  }
  return png(S, S, b);
}
fs.mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
for (const [n, s, m] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 1], ['badge-96.png', 96, 0]]) fs.writeFileSync(new URL('../icons/' + n, import.meta.url), icon(s, m));
console.log('icons written');
