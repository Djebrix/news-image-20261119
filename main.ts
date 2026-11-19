// THE WORLD IN ONE DAY — 19 November 2026
// A deterministic newspaper front page, drawn entirely in code.
// Node 22+, standard library only. No network, no clock, no randomness.
// Renders a 1024x1024 PNG to $MAKEFUN_OUTPUT_DIR/entry.png (default /output).

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const PAPER: RGB = [247, 242, 231];
const INK: RGB = [24, 24, 22];
const RED: RGB = [163, 22, 33];
const NAVY: RGB = [29, 53, 87];
const BLUE: RGB = [42, 111, 151];
const GOLD: RGB = [178, 138, 30];
const GREY: RGB = [107, 107, 96];
const RULE: RGB = [216, 210, 194];
const WHITE: RGB = [255, 255, 255];

// ---------------------------------------------------------------- canvas
class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 3); // Buffer: a Uint8Array with .copy
    this.fillRect(0, 0, w, h, bg);
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c);
    }
  }
  hline(x: number, y: number, w: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c);
  }
  vline(x: number, y: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, t, h, c);
  }
  strokeRect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.hline(x, y, w, c, t);
    this.hline(x, y + h - t, w, c, t);
    this.vline(x, y, h, c, t);
    this.vline(x + w - t, y, h, c, t);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    let ax = Math.round(x0);
    let ay = Math.round(y0);
    const bx = Math.round(x1);
    const by = Math.round(y1);
    const dx = Math.abs(bx - ax);
    const dy = Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      this.set(ax, ay, c);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        ax += sx;
      }
      if (e2 < dx) {
        err += dx;
        ay += sy;
      }
    }
  }
  // Thick line drawn as a stack of parallel thin lines.
  thickLine(x0: number, y0: number, x1: number, y1: number, c: RGB, t: number): void {
    const half = Math.floor(t / 2);
    for (let k = -half; k <= half; k++) {
      this.line(x0, y0 + k, x1, y1 + k, c);
    }
  }
  fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let dy = -ry; dy <= ry; dy++) {
      const f = 1 - (dy * dy) / (ry * ry);
      if (f < 0) continue;
      const dx = Math.floor(rx * Math.sqrt(f));
      this.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let a = 0; a < 360; a += 1) {
      const r = (a * Math.PI) / 180;
      this.set(Math.round(cx + rx * Math.cos(r)), Math.round(cy + ry * Math.sin(r)), c);
    }
  }
  fillCircle(cx: number, cy: number, r: number, c: RGB): void {
    this.fillEllipse(cx, cy, r, r, c);
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    this.ellipse(cx, cy, r, r, c);
  }
  fillPolygon(pts: Array<[number, number]>, c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        this.fillRect(Math.ceil(xs[k]), y, Math.floor(xs[k + 1]) - Math.ceil(xs[k]) + 1, 1, c);
      }
    }
  }
  star(cx: number, cy: number, rOuter: number, rInner: number, c: RGB): void {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    this.fillPolygon(pts, c);
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 cells, "#" = ink, "." = empty.
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  b: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
  c: [".....", ".....", ".####", "#....", "#....", "#....", ".####"],
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  f: ["..##.", ".#..#", ".#...", "####.", ".#...", ".#...", ".#..."],
  g: [".....", ".....", ".####", "#...#", "#...#", "#...#", ".####", "....#", "###.."],
  h: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#"],
  i: ["..#..", ".....", ".##..", "..#..", "..#..", "..#..", ".###."],
  j: ["...#.", ".....", "..##.", "...#.", "...#.", "...#.", "...#.", "...#.", ".##.."],
  k: ["#....", "#....", "#.#..", "#.#..", "##...", "#.#..", "#..#."],
  l: [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  p: [".....", ".....", "####.", "#...#", "#...#", "#...#", "####.", "#....", "#...."],
  q: [".....", ".....", ".####", "#...#", "#...#", "#...#", ".####", "....#", "....#"],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  t: [".#...", ".#...", "####.", ".#...", ".#...", ".#...", "..##."],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#...#", ".###."],
  v: [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  w: [".....", ".....", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  x: [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  y: [".....", ".....", "#...#", "#...#", "#...#", "#...#", ".####", "....#", ".##.."],
  z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
  ")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "&": [".###.", "#...#", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "%": ["##..#", "##.#.", "..#..", ".#...", "#..##", "#..##", "....."],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".....", ".....", ".....", ".....", "....."],
  "*": [".....", ".#.#.", "..#..", "#####", "..#..", ".#.#.", "....."],
  "[": [".###.", ".#...", ".#...", ".#...", ".#...", ".#...", ".###."],
  "]": [".###.", "...#.", "...#.", "...#.", "...#.", "...#.", ".###."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "~": [".....", ".....", ".##.#", "#.#..", ".....", ".....", "....."],
  "°": [".##..", "#..#.", ".##..", ".....", ".....", ".....", "....."],
  "•": [".....", ".###.", ".###.", ".###.", ".....", ".....", "....."],
};

function glyphRows(ch: string): string[] {
  if (ch === "—" || ch === "–") return FONT["-"];
  if (ch === "’") return FONT["'"];
  return FONT[ch] ?? FONT[" "];
}

function drawChar(cv: Canvas, x: number, y: number, ch: string, s: number, c: RGB): void {
  const rows = glyphRows(ch);
  // No vertical shift: descender glyphs simply have extra rows below the
  // baseline, so their bowls stay aligned with every other lowercase letter.
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === "#") {
        cv.fillRect(x + col * s, y + r * s, s, s, c);
      }
    }
  }
}

function textWidth(s: string, scale: number): number {
  if (s.length === 0) return 0;
  return s.length * 6 * scale - scale;
}

function drawText(cv: Canvas, x: number, y: number, s: string, scale: number, c: RGB): number {
  let cx = x;
  for (const ch of s) {
    drawChar(cv, cx, y, ch, scale, c);
    cx += 6 * scale;
  }
  return cx;
}

function drawCentered(cv: Canvas, cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cv, cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

function wrapText(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// Draws wrapped text; returns the y just below the last line.
function drawPara(cv: Canvas, x: number, y: number, s: string, scale: number, maxW: number, c: RGB, gap = 4): number {
  const lines = wrapText(s, maxW, scale);
  let yy = y;
  for (const line of lines) {
    drawText(cv, x, yy, line, scale, c);
    yy += 7 * scale + gap;
  }
  return yy;
}

// ---------------------------------------------------------------- PNG codec
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crcIn = Buffer.concat([Buffer.from(type, "ascii"), data]);
  out.writeUInt32BE(crc32(crcIn), 8 + data.length);
  return out;
}

function encodePNG(cv: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(cv.h * (1 + cv.w * 3));
  for (let y = 0; y < cv.h; y++) {
    raw[y * (1 + cv.w * 3)] = 0; // filter: none
    cv.px.copy(raw, y * (1 + cv.w * 3) + 1, y * cv.w * 3, (y + 1) * cv.w * 3);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- illustrations
function drawFlagUS(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const stripe = Math.floor(h / 7);
  for (let i = 0; i < 7; i++) {
    cv.fillRect(x, y + i * stripe, w, stripe, i % 2 === 0 ? RED : WHITE);
  }
  const cw = Math.floor(w * 0.42);
  const ch = stripe * 4;
  cv.fillRect(x, y, cw, ch, NAVY);
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 4; col++) {
      cv.fillRect(x + 4 + col * 10, y + 5 + r * 11, 3, 3, WHITE);
    }
  }
  cv.strokeRect(x, y, w, h, INK, 1);
}

function drawFlagCN(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, RED);
  cv.star(x + 26, y + 28, 15, 6, GOLD);
  cv.star(x + 52, y + 12, 5, 2, GOLD);
  cv.star(x + 62, y + 24, 5, 2, GOLD);
  cv.star(x + 62, y + 38, 5, 2, GOLD);
  cv.star(x + 52, y + 48, 5, 2, GOLD);
  cv.strokeRect(x, y, w, h, INK, 1);
}

function drawFlagRU(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const band = Math.floor(h / 3);
  cv.fillRect(x, y, w, band, WHITE);
  cv.fillRect(x, y + band, w, band, BLUE);
  cv.fillRect(x, y + 2 * band, w, h - 2 * band, RED);
  cv.strokeRect(x, y, w, h, INK, 1);
}

function drawScales(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const cx = x + Math.floor(w / 2);
  const top = y + 6;
  const beamY = y + 16;
  const baseY = y + h - 8;
  cv.fillRect(cx - 2, top, 4, baseY - top, NAVY);
  cv.fillRect(cx - 26, baseY, 52, 4, NAVY);
  cv.thickLine(x + 12, beamY, x + w - 12, beamY, NAVY, 2);
  cv.fillCircle(cx, top, 4, GOLD);
  for (const side of [-1, 1]) {
    const px = cx + side * (Math.floor(w / 2) - 14);
    cv.line(px - 12, beamY, px, beamY + 22, NAVY);
    cv.line(px + 12, beamY, px, beamY + 22, NAVY);
    cv.line(px, beamY, px, beamY + 22, NAVY);
    cv.fillEllipse(px, beamY + 26, 14, 5, GOLD);
    cv.ellipse(px, beamY + 26, 14, 5, NAVY);
  }
}

function drawBridge(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const waterY = y + h - 16;
  for (let i = 0; i < 3; i++) {
    cv.hline(x + 4, waterY + i * 5, w - 8, BLUE, 1);
  }
  // Towers
  cv.fillRect(x + 18, y + 18, 8, waterY - y - 18, NAVY);
  cv.fillRect(x + w - 26, y + 18, 8, waterY - y - 18, NAVY);
  // Deck: two segments with a gap in the middle, arched slightly.
  const deckY = y + 26;
  const gap = 26;
  const mid = x + Math.floor(w / 2);
  cv.thickLine(x + 4, deckY + 6, mid - gap / 2, deckY, INK, 3);
  cv.thickLine(mid + gap / 2, deckY, x + w - 4, deckY + 6, INK, 3);
  // Fallen span, tilted into the gap.
  cv.thickLine(mid - gap / 2 + 2, deckY + 2, mid + 4, deckY + 22, RED, 3);
  // Burst at the break.
  for (let a = 0; a < 8; a++) {
    const r = (a * Math.PI) / 4;
    cv.line(mid, deckY + 4, Math.round(mid + 12 * Math.cos(r)), Math.round(deckY + 4 + 12 * Math.sin(r)), GOLD);
  }
  // Cables from towers to deck.
  cv.line(x + 22, y + 18, x + 40, deckY + 4, GREY);
  cv.line(x + w - 22, y + 18, x + w - 40, deckY + 4, GREY);
}

function drawOilBars(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const baseY = y + h - 14;
  cv.hline(x, baseY, w, INK, 2);
  cv.vline(x, y + 6, h - 20, INK, 2);
  const heights = [18, 30, 44, 62];
  const bw = 22;
  const gap = 12;
  for (let i = 0; i < heights.length; i++) {
    const bx = x + 16 + i * (bw + gap);
    const col = i === heights.length - 1 ? RED : BLUE;
    cv.fillRect(bx, baseY - heights[i], bw, heights[i], col);
  }
  // Rising arrow over the bars.
  cv.line(x + 20, baseY - 22, x + w - 12, baseY - 66, GOLD);
  cv.line(x + w - 12, baseY - 66, x + w - 22, baseY - 64, GOLD);
  cv.line(x + w - 12, baseY - 66, x + w - 14, baseY - 56, GOLD);
  drawText(cv, x + 8, y, "OIL", 1, INK);
}

function drawIPOChart(cv: Canvas, x: number, y: number, w: number, h: number): void {
  const baseY = y + h - 14;
  cv.hline(x, baseY, w, INK, 2);
  cv.vline(x, y + 6, h - 20, INK, 2);
  const pts: Array<[number, number]> = [
    [x + 12, baseY - 10],
    [x + 38, baseY - 16],
    [x + 64, baseY - 14],
    [x + 90, baseY - 30],
    [x + 116, baseY - 48],
    [x + 140, baseY - 62],
  ];
  for (let i = 0; i + 1 < pts.length; i++) {
    cv.thickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], RED, 2);
  }
  for (const [px, py] of pts) cv.fillCircle(px, py, 3, NAVY);
  const [lx, ly] = pts[pts.length - 1];
  cv.line(lx, ly, lx - 10, ly + 2, RED);
  cv.line(lx, ly, lx - 4, ly + 10, RED);
  drawText(cv, x + 52, y, "$81.3BN", 1, RED);
}

// ---------------------------------------------------------------- page
function buildPage(): Canvas {
  const cv = new Canvas(W, H, PAPER);
  const M = 36; // margin
  const R = W - M; // right edge of content

  // Double outer border.
  cv.strokeRect(10, 10, W - 20, H - 20, INK, 2);
  cv.strokeRect(16, 16, W - 32, H - 32, INK, 1);

  // ---- masthead
  drawCentered(cv, W / 2, 34, "THE WORLD IN ONE DAY", 7, INK);
  cv.hline(M, 96, R - M, INK, 2);
  cv.hline(M, 100, R - M, INK, 1);

  // ---- dateline
  drawText(cv, M, 110, "WORLD EDITION", 1, GREY);
  drawCentered(cv, W / 2, 108, "THURSDAY 19 NOVEMBER 2026", 2, INK);
  const rightTag = "SHENZHEN - THE HAGUE - ANTALYA";
  drawText(cv, R - textWidth(rightTag, 1), 110, rightTag, 1, GREY);
  cv.hline(M, 132, R - M, INK, 2);

  // ---- lead story
  let y = 146;
  drawText(cv, M, y, "SHENZHEN, CHINA", 2, RED);
  y += 30;
  drawText(cv, M, y, "TRUMP, XI AND PUTIN", 5, INK);
  y += 42;
  drawText(cv, M, y, "MEET IN SHENZHEN", 5, INK);
  y += 48;
  y = drawPara(
    cv,
    M,
    y,
    "The leaders of the United States, China and Russia hold their first three-way summit, with Ukraine, nuclear arms and trade at the top of the agenda.",
    2,
    R - M,
    INK,
    5,
  );
  y += 6;
  cv.hline(M, y, R - M, RULE, 1);
  y += 12;

  // Lead body (left) + flags illustration (right).
  const bodyX = M;
  const bodyW = 560;
  const illoX = 624;
  const illoW = R - illoX;
  const leadTop = y;
  const leadBody =
    "Donald Trump met separately with Vladimir Putin for about forty minutes, and with Xi Jinping, before the three sat down together in Shenzhen on the sidelines of the APEC forum - the first time the three have held talks together. Ukraine dominated the Russian talks. The leaders agreed that a nuclear war must never be fought.";
  drawPara(cv, bodyX, leadTop, leadBody, 2, bodyW, INK, 6);
  // Three flags in a row.
  const fw = 112;
  const fh = 70;
  const fgap = (illoW - 3 * fw) / 2;
  drawFlagUS(cv, illoX, leadTop, fw, fh);
  drawFlagCN(cv, illoX + fw + fgap, leadTop, fw, fh);
  drawFlagRU(cv, illoX + 2 * (fw + fgap), leadTop, fw, fh);
  // Summit table beneath the flags.
  const tableY = leadTop + fh + 42;
  const tableCX = illoX + Math.floor(illoW / 2);
  cv.fillCircle(tableCX - 60, tableY - 26, 8, NAVY);
  cv.fillCircle(tableCX, tableY - 30, 8, RED);
  cv.fillCircle(tableCX + 60, tableY - 26, 8, GOLD);
  cv.ellipse(tableCX, tableY, 150, 14, INK);
  cv.fillRect(tableCX - 150, tableY, 300, 3, INK);
  drawCentered(cv, tableCX, tableY + 24, "THE FIRST TRILATERAL SUMMIT", 1, GREY);

  y = 506;
  cv.hline(M, y, R - M, INK, 2);
  cv.hline(M, y + 4, R - M, INK, 1);

  // ---- middle stories: 2 columns x 2 rows
  type Story = {
    kicker: string;
    headline: string;
    body: string;
    draw: (cv: Canvas, x: number, y: number, w: number, h: number) => void;
  };
  const stories: Story[] = [
    {
      kicker: "THE HAGUE",
      headline: "MYANMAR COMMITTED GENOCIDE, COURT RULES",
      body: "The International Court of Justice ruled on Thursday that Myanmar committed acts of genocide against the Rohingya minority, deciding the case brought by The Gambia. It is the UN court's ruling on the merits of the genocide accusation, after the 2017 crackdown that drove hundreds of thousands across the border into Bangladesh.",
      draw: drawScales,
    },
    {
      kicker: "KERCH STRAIT",
      headline: "CRIMEAN BRIDGE HIT FOR THIRD TIME IN A WEEK",
      body: "Ukraine struck the Crimean Bridge for the third time in a week, collapsing a road span arch in a missile and drone operation. Car traffic across the Kerch Strait remains suspended, while rail traffic continues to run on schedule.",
      draw: drawBridge,
    },
    {
      kicker: "PERSIAN GULF",
      headline: "IRAN HITS GULF STATES AS HORMUZ CRISIS DEEPENS",
      body: "Iran launched retaliatory air attacks on Bahrain and Kuwait after US fighter jets struck Qeshm Island. The International Energy Agency called the Hormuz crisis the greatest threat ever observed to energy security.",
      draw: drawOilBars,
    },
    {
      kicker: "WALL STREET",
      headline: "ANTHROPIC SETS RECORD WITH $81.3BN IPO",
      body: "Anthropic raised $81.3 billion in its initial public offering at a $1.5 trillion valuation - the largest IPO in history, surpassing SpaceX. The debut signals continued investor confidence in artificial intelligence.",
      draw: drawIPOChart,
    },
  ];

  const colW = 460;
  const colX = [M, 528];
  const rowY = [524, 706];
  const illoH = 78;
  for (let i = 0; i < stories.length; i++) {
    const st = stories[i];
    const cx = colX[i % 2];
    const cy = rowY[Math.floor(i / 2)];
    drawText(cv, cx, cy, st.kicker, 1, RED);
    const headLines = wrapText(st.headline, colW, 3);
    let hy = cy + 12;
    for (const line of headLines) {
      drawText(cv, cx, hy, line, 3, INK);
      hy += 25;
    }
    const illoY = hy + 6;
    st.draw(cv, cx, illoY, 150, illoH);
    drawPara(cv, cx + 164, illoY, st.body, 1, colW - 164, INK, 3);
  }
  // Vertical rule between the two columns.
  cv.vline(512, 524, 360, RULE, 1);
  // Horizontal rule between the two rows.
  cv.hline(M, 692, R - M, RULE, 1);

  // ---- also today
  y = 900;
  cv.hline(M, y, R - M, INK, 2);
  y += 10;
  drawText(cv, M, y, "ALSO TODAY", 2, RED);
  const items = [
    "COP31: MINISTERS RACE TO UNBLOCK TALKS",
    "GTA VI LAUNCHES TO RECORD TRAFFIC",
    "VOYAGER 1: ONE LIGHT-DAY FROM EARTH",
    "VAN GOGH SELLS FOR $190.4M, A RECORD",
  ];
  let iy = y + 26;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const ix = colX[c];
      const item = items[r * 2 + c];
      drawText(cv, ix, iy, item, 2, INK);
    }
    iy += 26;
  }

  // ---- footer
  cv.hline(M, 972, R - M, RULE, 1);
  drawCentered(cv, W / 2, 984, "SOURCES: CBS NEWS, BBC, IRISH TIMES, AL JAZEERA, NPR", 1, GREY);

  return cv;
}

// ---------------------------------------------------------------- main
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG(buildPage());
  const outPath = join(outDir, "entry.png");
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes, 1024x1024)`);
}

main();
