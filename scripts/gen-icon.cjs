// Dependency-free app icon generator.
//   build/icon.png : 1024x1024 RGBA (electron-builder mac/linux source, BrowserWindow icon)
//   build/icon.ico : ICO container embedding a 256x256 PNG (electron-builder win)
// PNG is encoded by hand (zlib.deflateSync + CRC32), no npm packages involved.
//
// Design: rounded dark-navy square, purple -> blue diagonal gradient, and two lighter left-pointing
// chevrons ("back" / rewind — retro-planning goes from the deadline backwards).
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// ---- PNG encoding ---------------------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // no interlace
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (None) for every scanline
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Geometry helpers -----------------------------------------------------------------------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}
// Signed distance from a point to a rounded box centred at origin (half extents bx, by, radius r).
function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}
// Distance from a point to a segment.
function sdSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const t = clamp01((wx * vx + wy * vy) / (vx * vx + vy * vy));
  return Math.hypot(wx - vx * t, wy - vy * t);
}
// Left-pointing chevron: polyline (tip) <- (upper arm) and (lower arm), stroked with a round cap.
function sdChevron(px, py, tipX, cy, armX, armH, halfWidth) {
  const d = Math.min(sdSegment(px, py, tipX, cy, armX, cy - armH), sdSegment(px, py, tipX, cy, armX, cy + armH));
  return d - halfWidth;
}
// Anti-aliased coverage from a signed distance (in pixels).
const coverage = (sd) => clamp01(0.5 - sd);

// ---- Render ---------------------------------------------------------------------------------
const NAVY = [17, 22, 48];
const PURPLE = [104, 64, 214];
const BLUE = [38, 112, 236];
const CHEVRON = [232, 238, 255];
const GRADIENT_STEPS = 28; // banded on purpose: keeps the PNG small under filter 0

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const half = size / 2;
  const boxHalf = size * 0.5;
  const radius = size * 0.225;
  const cy = half;
  const chevronW = size * 0.055;
  const arm = size * 0.19;
  // Two chevrons: front one bright, rear one dimmer.
  const chevrons = [
    { tipX: size * 0.36, armX: size * 0.36 + size * 0.2, alpha: 1.0 },
    { tipX: size * 0.55, armX: size * 0.55 + size * 0.2, alpha: 0.55 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      const boxSd = sdRoundedBox(px - half, py - half, boxHalf, boxHalf, radius);
      const boxA = coverage(boxSd);
      const i = (y * size + x) * 4;
      if (boxA <= 0) {
        rgba[i + 3] = 0;
        continue;
      }
      // Diagonal gradient (top-left purple -> bottom-right blue) laid over navy.
      let t = (x + y) / (2 * size);
      t = Math.round(t * GRADIENT_STEPS) / GRADIENT_STEPS;
      const grad = mix(PURPLE, BLUE, t);
      // Navy base with a darker rim so the gradient reads as a plate.
      const rim = clamp01(-boxSd / (size * 0.06));
      let col = mix(NAVY, grad, 0.72 * rim + 0.18);

      for (const c of chevrons) {
        const a = coverage(sdChevron(px, py, c.tipX, cy, c.armX, arm, chevronW / 2)) * c.alpha;
        if (a > 0) col = mix(col, CHEVRON, a);
      }

      rgba[i] = Math.round(col[0]);
      rgba[i + 1] = Math.round(col[1]);
      rgba[i + 2] = Math.round(col[2]);
      rgba[i + 3] = Math.round(boxA * 255);
    }
  }
  return encodePng(size, size, rgba);
}

// ---- ICO container (single 256x256 PNG entry) -----------------------------------------------
function encodeIco(png256) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 256 -> 0
  entry[1] = 0; // height 256 -> 0
  entry[2] = 0; // colour palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png256.length, 8); // image size
  entry.writeUInt32LE(6 + 16, 12); // offset
  return Buffer.concat([header, entry, png256]);
}

const buildDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(buildDir, { recursive: true });
const png1024 = render(1024);
fs.writeFileSync(path.join(buildDir, 'icon.png'), png1024);
const png256 = render(256);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), encodeIco(png256));
console.log(`[gen-icon] build/icon.png (${(png1024.length / 1024).toFixed(1)} KB), build/icon.ico (${(png256.length / 1024).toFixed(1)} KB)`);
