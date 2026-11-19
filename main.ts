// THE WORLD IN ONE DAY — 19 November 2026
// A newspaper front page drawn procedurally: 1024x1024 PNG, stdlib only,
// fully deterministic (no clock, no randomness, no network).
// Stories are the real world news of Thursday 19 November 2026, as reported
// that day by NPR, Reuters, AP, Human Rights Watch, CNBC and others.

import * as fs from "node:fs";
import * as zlib from "node:zlib";
import * as path from "node:path";

const W = 1024;
const H = 1024;

// ---------- palette ----------
const PAPER = [246, 241, 229];
const INK = [22, 19, 14];
const RED = [166, 30, 34];
const BLUE = [31, 58, 95];
const SEA = [46, 90, 136];
const SAND = [232, 220, 192];
const GOLD = [201, 162, 39];
const GREY = [120, 113, 100];
const WHITE = [245, 245, 245];
const LIGHTBLUE = [215, 229, 239];
const FLAGRED = [222, 41, 16];
const FLAGBLUE = [30, 79, 163];
const FLAGDARKRED = [178, 34, 52];
const NAVY = [60, 59, 110];

// ---------- pixel buffer ----------
const buf = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  buf[i * 3] = PAPER[0];
  buf[i * 3 + 1] = PAPER[1];
  buf[i * 3 + 2] = PAPER[2];
}

function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = c[0];
  buf[o + 1] = c[1];
  buf[o + 2] = c[2];
}

function rect(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) px(xx, yy, c);
  }
}

function rectOutline(x, y, w, h, t, c) {
  rect(x, y, w, t, c);
  rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c);
  rect(x + w - t, y, t, h, c);
}

function hline(x0, x1, y, t, c) {
  rect(x0, y, x1 - x0, t, c);
}

function vline(x, y0, y1, t, c) {
  rect(x, y0, t, y1 - y0, c);
}

// Bresenham line
function line(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    px(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function dashedLine(x0, y0, x1, y1, c, dash, gap) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.round(len));
  let on = true;
  let run = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    if (on) px(x, y, c);
    run++;
    if (on && run >= dash) {
      on = false;
      run = 0;
    } else if (!on && run >= gap) {
      on = true;
      run = 0;
    }
  }
}

// thick line: stamp filled circles along the segment
function thickLine(x0, y0, x1, y1, w, c) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(len));
  const r = Math.floor(w / 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    disc(x, y, r, c);
  }
}

function disc(cx, cy, r, c) {
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) px(cx + x, cy + y, c);
  }
}

// filled lower half-disc (a scale pan): flat top at cy, bowl below
function halfDisc(cx, cy, r, c) {
  hline(cx - r, cx + r, cy, 1, c);
  for (let y = 0; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) px(cx + x, cy + y, c);
  }
}

function ring(cx, cy, r, t, c) {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      px(Math.round(cx + (r + k) * Math.cos(rad)), Math.round(cy + (r + k) * Math.sin(rad)), c);
    }
  }
}

// even-odd scanline polygon fill
function fillPolygon(pts, c) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const x = a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
        xs.push(x);
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W - 1, Math.floor(xs[k + 1])); x++) {
        px(x, y, c);
      }
    }
  }
}

// 5-point star centred at (cx,cy), outer radius ro, inner radius ri
function star(cx, cy, ro, ri, c) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]);
  }
  fillPolygon(pts, c);
}

// radial burst: N spikes from centre
function burst(cx, cy, r, c, spikes) {
  for (let i = 0; i < spikes; i++) {
    const a = (i * 2 * Math.PI) / spikes;
    line(cx, cy, Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a)), c);
    const a2 = a + Math.PI / spikes;
    line(cx, cy, Math.round(cx + (r * 0.45) * Math.cos(a2)), Math.round(cy + (r * 0.45) * Math.sin(a2)), c);
  }
  disc(cx, cy, Math.max(2, Math.round(r * 0.22)), c);
}

// ---------- 5x7 bitmap font (7 rows of 5 bits each) ----------
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "•": ["00000", "00000", "01110", "01110", "01110", "00000", "00000"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
};

const BLANK = ["00000", "00000", "00000", "00000", "00000", "00000", "00000"];

function glyph(ch) {
  const up = ch.toUpperCase();
  return FONT[up] || FONT[ch] || BLANK;
}

function textWidth(s, scale) {
  return s.length * 6 * scale - scale;
}

function drawText(x, y, s, scale, c) {
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === "1") {
          rect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
  return cx - x - scale;
}

function drawTextCentered(cx, y, s, scale, c) {
  const w = textWidth(s, scale);
  drawText(cx - Math.floor(w / 2), y, s, scale, c);
}

function wrapText(s, maxChars) {
  const words = s.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

function drawBlock(x, y, s, scale, c, maxChars, lineGap) {
  const lines = wrapText(s, maxChars);
  const lh = 7 * scale + lineGap;
  for (let i = 0; i < lines.length; i++) {
    drawText(x, y + i * lh, lines[i], scale, c);
  }
  return lines.length;
}

// ---------- CRC32 + PNG encoder ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- layout ----------

// outer double border
rectOutline(10, 10, 1004, 1004, 3, INK);
rectOutline(18, 18, 988, 988, 1, INK);

// masthead
drawTextCentered(512, 32, "THE WORLD IN ONE DAY", 7, INK);
rect(30, 96, 964, 4, RED);
drawTextCentered(512, 108, "THURSDAY 19 NOVEMBER 2026", 3, INK);
rect(30, 136, 964, 2, INK);

// ---- LEAD: Trump, Xi and Putin meet in Shenzhen ----
// kicker
rect(30, 154, 10, 14, RED);
drawText(46, 152, "DIPLOMACY", 2, RED);
// headline
drawText(30, 178, "TRUMP, XI AND PUTIN", 5, INK);
drawText(30, 218, "MEET IN SHENZHEN", 5, INK);
// subhead
drawBlock(
  30,
  262,
  "THE LEADERS OF THE US, CHINA AND RUSSIA MET FOR THE FIRST TIME ALL THREE TOGETHER, ON THE SIDELINES OF THE APEC SUMMIT. NUCLEAR ARMS TOPPED THE AGENDA. NO AGREEMENT WAS EXPECTED.",
  2,
  INK,
  55,
  6
);
// more from the summit
drawText(30, 356, "ALSO IN SHENZHEN:", 2, RED);
drawText(30, 378, "• TRUMP MET PUTIN FOR 42 MINUTES, XI FOR AN HOUR.", 2, INK);
drawBlock(30, 398, "• NEW START EXPIRED IN FEBRUARY. NO NUCLEAR CAPS NOW BIND THE US AND RUSSIA.", 2, INK, 55, 6);

// flags panel (right of lead): USA, China, Russia
const PX0 = 710;
const PY0 = 150;
const PX1 = 994;
const PY1 = 425;
rect(PX0, PY0, PX1 - PX0, PY1 - PY0, LIGHTBLUE);
rectOutline(PX0, PY0, PX1 - PX0, PY1 - PY0, 2, INK);
// USA flag, y 160-232
for (let s = 0; s < 7; s++) {
  rect(PX0, 160 + s * 10, 284, s === 6 ? 12 : 10, s % 2 === 0 ? FLAGDARKRED : WHITE);
}
rect(PX0, 160, 114, 30, NAVY);
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 4; c++) {
    disc(722 + c * 26, 168 + r * 9, 1, WHITE);
  }
}
rectOutline(PX0, 160, 284, 72, 1, INK);
// China flag, y 240-312
rect(PX0, 240, 284, 72, FLAGRED);
star(745, 276, 13, 5, GOLD);
star(792, 256, 4, 2, GOLD);
star(802, 268, 4, 2, GOLD);
star(802, 284, 4, 2, GOLD);
star(792, 296, 4, 2, GOLD);
rectOutline(PX0, 240, 284, 72, 1, INK);
// Russia flag, y 320-392
rect(PX0, 320, 284, 24, WHITE);
rect(PX0, 344, 284, 24, FLAGBLUE);
rect(PX0, 368, 284, 24, FLAGRED);
rectOutline(PX0, 320, 284, 72, 1, INK);
// caption
drawTextCentered(852, 400, "SHENZHEN", 2, INK);

rect(30, 440, 964, 3, INK);

// ---- MIDDLE ROW ----
// left: ICJ finds Myanmar guilty of genocide
rect(30, 460, 10, 14, RED);
drawText(46, 458, "JUSTICE", 2, RED);
drawText(30, 480, "MYANMAR GUILTY OF", 4, INK);
drawText(30, 514, "ROHINGYA GENOCIDE", 4, INK);
// scales of justice + the 9-6 vote
hline(183, 343, 560, 3, INK);
disc(263, 552, 4, INK);
vline(262, 556, 612, 3, INK);
hline(233, 293, 612, 3, INK);
line(193, 563, 178, 595, INK);
line(193, 563, 208, 595, INK);
halfDisc(193, 595, 17, INK);
line(333, 563, 318, 595, INK);
line(333, 563, 348, 595, INK);
halfDisc(333, 595, 17, INK);
drawText(395, 565, "9-6", 5, RED);
drawText(377, 605, "15 JUDGES", 2, INK);
drawBlock(30, 622, "THE COURT RULED 9-6 THAT MYANMAR COMMITTED GENOCIDE AGAINST THE ROHINGYA IN 2017.", 2, INK, 38, 4);

// vertical divider
vline(511, 455, 665, 2, INK);

// right: Kerch Bridge hit a third time
rect(527, 460, 10, 14, RED);
drawText(543, 458, "UKRAINE", 2, RED);
drawText(527, 480, "KERCH BRIDGE HIT", 4, INK);
drawText(527, 514, "THIRD TIME IN DAYS", 4, INK);
// bridge illustration: deck with a gap, pillars, fallen span in the water
drawText(691, 550, "3RD STRIKE", 2, RED);
rect(527, 592, 467, 23, SEA);
thickLine(527, 578, 700, 578, 4, INK);
thickLine(800, 578, 994, 578, 4, INK);
vline(560, 578, 592, 3, INK);
vline(660, 578, 592, 3, INK);
vline(840, 578, 592, 3, INK);
vline(940, 578, 592, 3, INK);
thickLine(700, 578, 755, 600, 4, INK);
burst(745, 578, 10, RED, 8);
drawBlock(527, 622, "AN OVERNIGHT STRIKE HALTED RAIL TRAFFIC, THE THIRD ATTACK IN FOUR DAYS. A ROAD SPAN FELL ON 17 NOVEMBER.", 2, INK, 38, 4);

rect(30, 678, 964, 3, INK);

// ---- BOTTOM ROW ----
// left: Anthropic IPO
rect(30, 696, 10, 14, RED);
drawText(46, 694, "MARKETS", 2, RED);
drawText(30, 714, "ANTHROPIC IPO SETS", 4, INK);
drawText(30, 748, "RECORD AT $81.3BN", 4, INK);
// IPO proceeds, $bn: SpaceX vs Anthropic
drawText(30, 792, "SPACEX", 2, INK);
rect(120, 790, 225, 18, GREY);
drawText(353, 792, "$75BN", 2, INK);
drawText(30, 822, "ANTHROPIC", 2, INK);
rect(145, 820, 244, 18, BLUE);
drawText(397, 822, "$81.3BN", 2, INK);
drawBlock(30, 848, "THE CLAUDE MAKER PRICED AT $83, THE BIGGEST LISTING EVER. SHARES TRADE ON THE NASDAQ TODAY AS ANT.", 2, INK, 38, 4);

// vertical divider
vline(511, 690, 900, 2, INK);

// right: COP31 in Antalya
rect(527, 696, 10, 14, RED);
drawText(543, 694, "CLIMATE", 2, RED);
drawText(527, 714, "CLIMATE TALKS STALL", 4, INK);
drawText(527, 748, "IN ANTALYA", 4, INK);
// sun + thermometer, 1.47C warming in 2026
disc(592, 807, 18, GOLD);
for (let i = 0; i < 8; i++) {
  const a = (i * 2 * Math.PI) / 8;
  line(
    Math.round(592 + 23 * Math.cos(a)),
    Math.round(807 + 23 * Math.sin(a)),
    Math.round(592 + 31 * Math.cos(a)),
    Math.round(807 + 31 * Math.sin(a)),
    GOLD
  );
}
rect(702, 786, 12, 38, WHITE);
rect(703, 802, 10, 21, RED);
disc(708, 830, 11, RED);
rectOutline(700, 784, 16, 42, 2, INK);
drawText(742, 795, "1.47C", 3, INK);
drawText(742, 820, "WARMING IN 2026", 2, INK);
drawBlock(527, 848, "MINISTERS RACED A FRIDAY DEADLINE WITH 21 POINTS UNSETTLED AS THE IEA WARNED OF A HISTORIC ENERGY THREAT.", 2, INK, 38, 4);

rect(30, 900, 964, 2, INK);

// ---- ALSO TODAY strip ----
drawText(30, 912, "ALSO TODAY", 2, RED);
drawText(30, 934, "BANGLADESH VIOLENCE SPREADS: YUNUS HOME TORCHED, 28 DISTRICTS HIT", 2, INK);
drawText(30, 956, "IAEA: N KOREA EXPANDED URANIUM ENRICHMENT • VAN GOGH $190.4M RECORD", 2, INK);
drawTextCentered(512, 984, "WORLD NEWS • THURSDAY 19 NOVEMBER 2026 • ONE DAY, ONE PAGE", 2, GREY);

// ---------- write ----------
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
fs.mkdirSync(outDir, { recursive: true });
const png = encodePNG();
fs.writeFileSync(path.join(outDir, "entry.png"), png);
console.log("wrote", path.join(outDir, "entry.png"), png.length, "bytes");
