// 拔钉救人 —— 全部画面元素程序绘制（canvas 2D，无外部图片）：砖墙背景 / 管道边框 / 房间（石拱门 + 木门）/ 石头 / 木板 / 钉子 /
// 目标盒 / 倒计时 / 标题 / 免责声明 / 压板 / 支撑杆 / 小人 / 烟雾 / FAIL 徽章 / 白手套手指 / 盒子闪光
import { DW, DH, GEO, mulberry, slotPos } from './game.js';
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
export const OUT = '#16121c';
export function hexRGB(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
export function mix(a, b, t) { const A = hexRGB(a), B = hexRGB(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join(''); }
export const colorOf = (S, c) => S['col_' + c] || '#888';
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif';

// ---------- 背景 ----------
function bricks(g, x0, y0, x1, y1, base, mortar, seed, bw = 62, bh = 30) {
  const q = mulberry(seed); g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  g.fillStyle = mortar; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let r = 0, y = y0 - 6; y < y1; r++, y += bh) for (let x = x0 - (r % 2) * bw / 2 - 10; x < x1; x += bw) {
    const v = (q() - 0.5) * 0.12; g.fillStyle = mix(base, v > 0 ? '#ffffff' : '#000000', Math.abs(v)); rr(g, x + 2.5, y + 2.5, bw - 5, bh - 5, 3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 4, y + 3, bw - 8, 3);
    if (q() < 0.18) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.beginPath(); const cx = x + 10 + q() * (bw - 20), cy = y + 6; g.moveTo(cx, cy); g.lineTo(cx + (q() - 0.5) * 12, cy + 8); g.lineTo(cx + (q() - 0.5) * 16, cy + bh - 10); g.stroke(); }
  }
  g.restore();
}
function pipe(g, pts, w, close) { // 浅蓝灰金属管道边框（参考 #687AA8 + 深色描边）
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  const path = () => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); if (close) g.closePath(); };
  path(); g.strokeStyle = OUT; g.lineWidth = w + 6; g.stroke();
  path(); g.strokeStyle = '#6a7eae'; g.lineWidth = w; g.stroke();
  g.translate(-w * 0.18, -w * 0.18); path(); g.strokeStyle = '#93a6d2'; g.lineWidth = w * 0.3; g.stroke();
  g.restore();
}
export function paintBackground(S) {
  const c = mk(DW, DH), g = c.getContext('2d');
  bricks(g, 0, 0, DW, DH, '#4a3f55', '#1a121b', 11, 64, 32);              // 外墙（略亮）
  bricks(g, GEO.wallL, 0, GEO.wallR, DH, '#3a2f42', '#150d16', 23, 66, 33); // 内部（格子后面的暗砖）
  // 房间：拱门 + 木门
  const fl = GEO.roomFloor + 4, ax = 528, aw = 84, atop = 300;
  g.save(); g.beginPath(); g.rect(GEO.housingX + 30, 150, GEO.wallR - GEO.housingX - 30, fl - 150); g.clip();
  bricks(g, 340, 150, GEO.wallR, fl, '#40354b', '#160e18', 37, 60, 30);
  // 石拱（灰色石块）
  const q = mulberry(5); const archR = aw + 26;
  for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI, x = ax + Math.cos(a) * archR, y = atop + aw * 0.55 + Math.sin(a) * archR * 0.78; g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.fillStyle = mix('#6f7286', '#000', q() * 0.15); g.strokeStyle = OUT; g.lineWidth = 3; rr(g, -24, -20, 48, 40, 8); g.fill(); g.stroke(); g.restore(); }
  for (const sx of [-1, 1]) for (let y = atop + aw * 0.55; y < fl; y += 44) { g.fillStyle = mix('#6f7286', '#000', q() * 0.15); g.strokeStyle = OUT; g.lineWidth = 3; rr(g, ax + sx * archR - 24, y, 48, 42, 8); g.fill(); g.stroke(); }
  // 木门
  g.beginPath(); g.moveTo(ax - aw + 8, fl); g.lineTo(ax - aw + 8, atop + aw * 0.55); g.ellipse(ax, atop + aw * 0.55, aw - 8, (aw - 8) * 0.72, 0, Math.PI, 0); g.lineTo(ax + aw - 8, fl); g.closePath();
  g.fillStyle = '#5b3537'; g.fill(); g.save(); g.clip();
  for (let x = ax - aw; x < ax + aw; x += 38) { g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 200); g.lineTo(x, fl); g.stroke(); g.strokeStyle = 'rgba(255,200,180,0.06)'; g.lineWidth = 6; g.beginPath(); g.moveTo(x + 6, 200); g.lineTo(x + 6, fl); g.stroke(); }
  for (const by of [395, 512]) { g.fillStyle = '#1f2433'; g.fillRect(ax - aw, by, aw * 2, 16); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(ax - aw, by, aw * 2, 3); }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(ax - aw, fl - 30, aw * 2, 30);
  g.restore(); g.strokeStyle = OUT; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#2a1c22'; g.beginPath(); g.arc(ax - aw + 36, 452, 11, 0, 7); g.fill();
  g.restore();
  // 盒子底座（砖 + 一根连续管道：房间地面 → 左侧下行 → 底边 → 绕盒子凹槽成倒 U → 右侧到墙；参考 1.5 秒帧）
  const hx = GEO.housingX, by = S.gridY0 - S.plankH / 2, pf = GEO.roomFloor + 7, pb = by - 10;
  bricks(g, hx + 6, pf, GEO.wallR, by, '#3d3247', '#150d16', 41, 60, 30);
  const px0 = S.boxX - S.boxW / 2 - 22, px1 = S.boxX + S.boxW / 2 + 18, pt = S.boxY - S.boxHt / 2 - 20;
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(px0, pt, px1 - px0, by - pt);
  pipe(g, [[GEO.wallR + 4, pf], [hx + 14, pf], [hx, pf + 14], [hx, pb - 14], [hx + 14, pb], [px0 - 14, pb], [px0, pb - 14], [px0, pt + 14], [px0 + 14, pt], [px1 - 14, pt], [px1, pt + 14], [px1, pb - 14], [px1 + 14, pb], [GEO.wallR + 4, pb]], 13);
  // 左右竖管
  pipe(g, [[GEO.wallL - 7, -20], [GEO.wallL - 7, DH + 20]], 12);
  pipe(g, [[GEO.wallR + 7, -20], [GEO.wallR + 7, DH + 20]], 12);
  return c;
}
// 压板右端的三角铰链支架（画在压板上面）
export function drawHinge(g) {
  const P = GEO.pivot; g.save(); g.lineJoin = 'round';
  g.beginPath(); g.moveTo(GEO.wallR + 2, P.y - 50); g.lineTo(GEO.wallR + 2, P.y + 42); g.lineTo(P.x - 26, P.y + 4); g.closePath(); g.fillStyle = '#7d8fbd'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 4; g.stroke();
  bolt(g, P.x, P.y, 15); g.restore();
}
export function bolt(g, x, y, r) { g.fillStyle = '#2b3044'; g.beginPath(); g.arc(x, y, r + 2, 0, 7); g.fill(); g.fillStyle = '#9fb0d6'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = '#3d4560'; g.beginPath(); g.arc(x, y, r * 0.55, 0, 7); g.fill(); g.fillStyle = '#c7d4ef'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.22, 0, 7); g.fill(); }

// ---------- 石头 ----------
export function stoneSprites(S, n = 16) { // 参考：多边形碎石，上半亮面 / 下半暗面两种块面，细深色描边
  const out = [], R = 32, pad = 6;
  for (let i = 0; i < n; i++) {
    const q = mulberry(101 + i * 31), c = mk((R + pad) * 2, (R + pad) * 2), g = c.getContext('2d'); g.translate(R + pad, R + pad);
    const k = 6 + Math.floor(q() * 2), pts = [], a0 = q() * 6.283; for (let j = 0; j < k; j++) { const a = a0 + j / k * Math.PI * 2 + (q() - 0.5) * 0.45, r = R * (0.86 + q() * 0.14); pts.push([Math.cos(a) * r, Math.sin(a) * r * (0.92 + q() * 0.08)]); }
    const poly = () => { g.beginPath(); pts.forEach(([x, y], j) => j ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
    g.lineJoin = 'round';
    poly(); g.fillStyle = S.stoneColor; g.fill();
    g.save(); poly(); g.clip();
    // 下方暗面（斜切）
    const ca = Math.PI * 0.25 + (q() - 0.5) * 0.9, off = R * (0.05 + q() * 0.25), nx = Math.cos(ca), ny = Math.sin(ca);
    g.beginPath(); g.moveTo(-ny * 80 + nx * off, nx * 80 + ny * off); g.lineTo(ny * 80 + nx * off, -nx * 80 + ny * off); g.lineTo(ny * 80 + nx * 90, -nx * 80 + ny * 90); g.lineTo(-ny * 80 + nx * 90, nx * 80 + ny * 90); g.closePath(); g.fillStyle = S.stoneDark; g.fill();
    // 上方亮面
    const off2 = -R * (0.2 + q() * 0.25); g.beginPath(); g.moveTo(-ny * 80 + nx * off2, nx * 80 + ny * off2); g.lineTo(ny * 80 + nx * off2, -nx * 80 + ny * off2); g.lineTo(ny * 80 - nx * 90, -nx * 80 - ny * 90); g.lineTo(-ny * 80 - nx * 90, nx * 80 - ny * 90); g.closePath(); g.fillStyle = S.stoneLight; g.fill();
    g.restore();
    poly(); g.strokeStyle = S.stoneOutline; g.lineWidth = 4; g.stroke();
    out.push({ c, R: R + pad, r: R });
  }
  return out;
}
export function drawStone(g, spr, x, y, ang, r) { const s = r / spr.r; g.save(); g.translate(x, y); g.rotate(ang); g.drawImage(spr.c, -spr.R * s, -spr.R * s, spr.R * 2 * s, spr.R * 2 * s); g.restore(); }

// ---------- 木板 ----------
const plankCache = new Map();
export function plankSprite(S, len, th, seed, hor) {
  const key = [len | 0, th | 0, seed, hor, S.plankColor, S.plankDark].join('|'); if (plankCache.has(key)) return plankCache.get(key);
  const w = len + th * 2, h = th * 2, K = 2, c = mk((w + 8) * K, (h + 8) * K), g = c.getContext('2d'); g.scale(K, K); g.translate(4, 4); const q = mulberry(seed * 977 + 3);
  rr(g, 0, 0, w, h, th * 0.55); g.fillStyle = S.plankColor; g.fill();
  g.save(); g.clip();
  g.fillStyle = mix(S.plankColor, '#ffffff', 0.18); g.fillRect(0, 0, w, h * 0.22); // 上沿亮边
  g.fillStyle = mix(S.plankColor, '#000000', 0.18); g.fillRect(0, h * 0.82, w, h * 0.18); // 下沿暗边
  g.strokeStyle = mix(S.plankColor, S.plankDark, 0.45); g.lineWidth = 1.4; g.globalAlpha = 0.6;
  for (let i = 0; i < 4; i++) { const yy = h * (0.25 + i * 0.17) + (q() - 0.5) * 3; g.beginPath(); g.moveTo(-5, yy); for (let x = 0; x <= w + 10; x += 20) g.lineTo(x, yy + Math.sin(x * 0.05 + q() * 6) * 1.6); g.stroke(); }
  g.globalAlpha = 1; g.restore();
  rr(g, 0, 0, w, h, th * 0.55); g.strokeStyle = OUT; g.lineWidth = 3.5; g.stroke();
  const o = { c, w: w + 8, h: h + 8, K }; plankCache.set(key, o); return o;
}
export function drawPlank(g, S, pk, x, y, ang) { const sp = plankSprite(S, pk.len, pk.th, pk.seed, pk.hor); g.save(); g.translate(x, y); g.rotate(ang); g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h); g.restore(); }

// ---------- 钉子（彩色圆头 + 深色十字 + 立体暗边；拔出时露出灰色钉身）----------
export function drawPin(g, x, y, r, col, o = {}) {
  const s = o.s || 1, R = r * s; g.save(); g.translate(x, y);
  if (o.shank > 0.01) { const L = R * 1.25 * o.shank; g.save(); g.rotate(o.rot || 0); g.fillStyle = mix(col, '#000', 0.35); g.strokeStyle = OUT; g.lineWidth = 2.5; rr(g, -R * 0.28, 0, R * 0.56, R * 0.5 + L, R * 0.2); g.fill(); g.stroke(); g.restore(); }
  g.rotate((o.rot || 0) + (o.spin || 0));
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(R * 0.06, R * 0.14, R * 1.04, 0, 7); g.fill();
  g.fillStyle = mix(col, '#000', 0.3); g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(0, -R * 0.07, R * 0.9, 0, 7); g.fill();
  g.fillStyle = mix(col, '#fff', 0.35); g.beginPath(); g.arc(0, -R * 0.07, R * 0.9, Math.PI * 1.1, Math.PI * 1.65); g.arc(0, -R * 0.07, R * 0.74, Math.PI * 1.65, Math.PI * 1.1, true); g.fill();
  const cw = R * 0.26, cl = R * 0.62; g.fillStyle = mix(col, '#000', 0.55);
  g.beginPath(); g.roundRect(-cl, -cw / 2, cl * 2, cw, cw * 0.3); g.roundRect(-cw / 2, -cl, cw, cl * 2, cw * 0.3); g.fill();
  g.strokeStyle = OUT; g.lineWidth = Math.max(2, R * 0.12); g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke();
  g.restore();
}

// ---------- 目标盒 ----------
export function drawBox(g, S, color, sc, filled, slotsN) {
  if (sc <= 0.001) return; const w = S.boxW, h = S.boxHt, col = color;
  g.save(); g.translate(S.boxX, S.boxY); g.scale(sc, sc);
  g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, -w / 2 + 3, -h / 2 + 7, w, h, 16); g.fill();
  const oc = mix(col, '#fff', 0.1); g.fillStyle = mix(col, '#000', 0.3); rr(g, -w / 2, -h / 2 + 5, w, h, 16); g.fill();
  g.fillStyle = oc; rr(g, -w / 2, -h / 2, w, h - 6, 16); g.fill();
  g.fillStyle = mix(col, '#fff', S.boxInner); rr(g, -w / 2 + 12, -h / 2 + 10, w - 24, h - 28, 10); g.fill();
  g.strokeStyle = mix(col, '#000', 0.2); g.lineWidth = 2; g.stroke();
  rr(g, -w / 2, -h / 2, w, h + 5, 16); g.strokeStyle = OUT; g.lineWidth = 3.5; g.stroke();
  for (let i = 0; i < slotsN; i++) { const p = slotPos(S, i), x = p.x - S.boxX, y = p.y - S.boxY - 3; g.fillStyle = mix(col, '#000', 0.25); g.beginPath(); g.arc(x, y, S.slotR + 3, 0, 7); g.fill(); g.fillStyle = '#2a1f26'; g.beginPath(); g.arc(x, y, S.slotR, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x, y + S.slotR * 0.35, S.slotR * 0.55, 0, Math.PI); g.fill(); }
  for (const f of filled) { const p = slotPos(S, f.slot); drawPin(g, p.x - S.boxX, p.y - S.boxY - 3, S.pinR * 0.95, colorOf(S, f.c), { rot: f.rot }); }
  g.restore();
}
export function drawBoxFx(g, S, u) { // 填满闪光：亮环扩散 + 放射线 + 火花（参考为黄绿色）
  if (u <= 0 || u >= 1) return; const col = S.boxFxColor, [r, gg, b] = hexRGB(col); g.save(); g.translate(S.boxX, S.boxY); g.globalCompositeOperation = 'lighter';
  const R = 30 + u * 120, a = Math.sin(Math.PI * Math.min(1, u * 1.2));
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, `rgba(${r},${gg},${b},${0.55 * a})`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
  g.strokeStyle = `rgba(${r},${gg},${b},${a})`; g.lineWidth = 5 * (1 - u) + 1.5; g.beginPath(); g.arc(0, 0, R * 0.9, 0, 7); g.stroke();
  for (let i = 0; i < 3; i++) { const an = i / 3 * Math.PI * 2 + u * 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(an) * R * 0.9, Math.sin(an) * R * 0.9); g.stroke(); }
  const q = mulberry(9); for (let i = 0; i < 24; i++) { const an = q() * 6.283, d = (20 + q() * 140) * (0.3 + u), s = 2 + q() * 3; g.fillStyle = `rgba(255,255,220,${a})`; g.fillRect(Math.cos(an) * d * 1.2 - s / 2, Math.sin(an) * d * 0.7 - s / 2, s, s); }
  g.restore();
}

// ---------- 倒计时（黑底 + 灰轨道 + 彩色进度环 + 七段数码） ----------
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function segDigit(g, d, x, y, w, h, th) {
  const S2 = SEG[d] || '', hw = w / 2, hh = h / 2;
  const segs = { a: [-hw, -hh, hw, -hh], b: [hw, -hh, hw, 0], c: [hw, 0, hw, hh], d: [-hw, hh, hw, hh], e: [-hw, 0, -hw, hh], f: [-hw, -hh, -hw, 0], g: [-hw, 0, hw, 0] };
  for (const pass of [0, 1]) { g.lineCap = 'round'; g.lineWidth = pass ? th : th + 5; g.strokeStyle = pass ? '#fff' : '#000'; for (const s of S2) { const [x0, y0, x1, y1] = segs[s], gx = (x1 - x0) ? 0.18 * th : 0, gy = (y1 - y0) ? 0.18 * th : 0; g.beginPath(); g.moveTo(x + x0 + gx, y + y0 + gy); g.lineTo(x + x1 - gx, y + y1 - gy); g.stroke(); } }
}
export function drawTimer(g, S, rem, frac, sc) {
  if (sc <= 0.001) return; const R = S.timerR; g.save(); g.translate(S.timerX, S.timerY); g.scale(sc, sc);
  g.fillStyle = '#2a2d36'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#05070a'; g.beginPath(); g.arc(0, 0, R * 0.72, 0, 7); g.fill();
  const col = frac > 0.5 ? mix(S.timerColMid, S.timerColHi, (frac - 0.5) * 2) : frac > 0.2 ? mix(S.timerColLo, S.timerColMid, (frac - 0.2) / 0.3) : S.timerColLo;
  if (frac > 0) { g.strokeStyle = col; g.lineWidth = R * 0.2; g.lineCap = 'butt'; g.beginPath(); g.arc(0, 0, R * 0.86, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); g.stroke(); }
  const n = String(Math.max(0, Math.ceil(rem - 1e-6)));
  if (S.timerDigits === 'seg') { const w = R * 0.34, h = R * 0.7, gap = R * 0.18, tw = n.length * w + (n.length - 1) * gap; [...n].forEach((d, i) => segDigit(g, +d, -tw / 2 + w / 2 + i * (w + gap), 0, w, h, R * 0.11)); }
  else { g.font = `900 ${R * 0.9}px Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = '#000'; g.strokeText(n, 0, 2); g.fillStyle = '#fff'; g.fillText(n, 0, 2); }
  g.restore();
}
// ---------- 文字 ----------
export function drawTitle(g, S) {
  if (!S.titleText) return; g.save(); g.font = `900 ${S.titleSize}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowOffsetY = 3; g.shadowBlur = 4; g.lineWidth = S.titleStroke; g.strokeStyle = '#0b0d14'; g.strokeText(S.titleText, S.titleX, S.titleY);
  g.shadowColor = 'transparent'; g.fillStyle = '#fff'; g.fillText(S.titleText, S.titleX, S.titleY); g.restore();
}
export function drawDisclaimer(g, S, view) {
  if (!S.discShow) return; const bottom = view.y0 + view.h; g.save(); g.lineJoin = 'round';
  if (S.disc2Text && S.disc2Size > 0) { const L = S.disc2Text.split('\n'); g.font = `${S.disc2Size}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; L.forEach((t, i) => { const y = bottom - S.discY - (L.length - 1 - i) * S.disc2Size * 1.75 - 2; g.lineWidth = 2.5; g.strokeStyle = '#000'; g.strokeText(t, view.x0 + 18, y); g.fillStyle = '#e8e8f0'; g.fillText(t, view.x0 + 18, y); }); }
  if (S.discText) { const L = S.discText.split('\n'); g.font = `${S.discSize}px ${FONT}`; g.textAlign = 'center'; L.forEach((t, i) => { const y = bottom - S.discY - (L.length - 1 - i) * S.discSize * 1.08; g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText(t, DW / 2 + 10, y); g.fillStyle = '#fff'; g.fillText(t, DW / 2 + 10, y); }); }
  g.restore();
}

// ---------- 压板 + 支撑杆 ----------
export function drawLid(g, th) { // 参考：上层宽木板（厚≈46）+ 下层窄木板（厚≈28，右段）+ 支撑杆顶住处的深色木块 + 左端铁片两颗铆钉
  const P = GEO.pivot, L = GEO.lidLeft, R = GEO.lidRight, T = GEO.lidThick, LB = GEO.lidLower;
  g.save(); g.translate(P.x, P.y); g.rotate(-th); g.lineJoin = 'round';
  g.fillStyle = '#7a5750'; rr(g, -L + LB.x0, T / 2 - 4, L + R - LB.x0 - 30, LB.h + 4, 4); g.fill(); g.strokeStyle = OUT; g.lineWidth = 3.5; g.stroke();
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-L + LB.x0 + 3, T / 2 + LB.h - 8, L + R - LB.x0 - 36, 6);
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-L * 0.25, T / 2); g.lineTo(-L * 0.25, T / 2 + LB.h - 2); g.stroke();
  g.fillStyle = '#8e6b60'; rr(g, -L, -T / 2, L + R, T, 6); g.fill(); g.strokeStyle = OUT; g.lineWidth = 3.5; g.stroke();
  g.fillStyle = 'rgba(255,230,210,0.13)'; g.fillRect(-L + 4, -T / 2 + 3, L + R - 8, 7);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-L + 4, T / 2 - 9, L + R - 8, 6);
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; for (const x of [-L * 0.62, -L * 0.3]) { g.beginPath(); g.moveTo(x, -T / 2 + 3); g.lineTo(x, T / 2 - 3); g.stroke(); }
  g.fillStyle = '#4a2c2b'; rr(g, -GEO.propAt - 24, T / 2 + LB.h - 6, 44, 16, 3); g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#4a4f63'; rr(g, -L + 10, -T / 2 - 4, 32, T + 8, 3); g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
  for (const y of [-T * 0.22, T * 0.22]) { g.fillStyle = '#c9d2e6'; g.beginPath(); g.arc(-L + 26, y, 4.5, 0, 7); g.fill(); g.stroke(); }
  g.restore();
}
export function drawProp(g, x, y, ang, len) {
  g.save(); g.translate(x, y); g.rotate(ang); g.lineJoin = 'round';
  g.fillStyle = '#8b4d45'; rr(g, -4, -GEO.propW / 2, len + 4, GEO.propW, 4); g.fill(); g.strokeStyle = OUT; g.lineWidth = 3.5; g.stroke();
  g.fillStyle = 'rgba(255,200,180,0.15)'; g.fillRect(0, -GEO.propW / 2 + 3, len, 5);
  g.restore();
}

// ---------- 小人（白帽反戴 + 青色帽檐、橙黄头发、惊恐大眼咬牙、粉短裤、光脚） ----------
// pose: { push 0..1（双手推杆）, crouch 0..1, crush 0..1, shiverX, t, handTarget {x,y} }
export function drawCharacter(g, S, P) {
  // 比例按参考量取（charScale=1 ≈ 参考尺寸）：脚底 y=0，髋 -75，肩 -140，头中心 -215（半径≈45），帽顶 -262
  const k = S.charScale, fx = S.charX, fy = GEO.roomFloor - 3; const skin = S.skin, sk2 = mix(skin, '#c0505a', 0.3);
  g.save(); g.translate(fx + P.shiverX, fy); g.scale(k, k);
  const cr = P.crush || 0; if (cr > 0) g.scale(1 + cr * 0.3, 1 - cr * 0.6);
  const cy = P.crouch * 14, lean = P.push * 0.16 + P.crouch * 0.06;
  const line = (w = 3) => { g.strokeStyle = OUT; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; };
  const limb = (pts, w, col) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = w + 5; g.stroke(); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
  const hipY = -75 + cy;
  // 腿：内八、膝盖相碰，左脚在前（朝左）
  limb([[-6, hipY + 4], [-16, -36 + cy * 0.5], [-30, -8], [-34, -4]], 13, skin);
  limb([[14, hipY + 4], [-4, -34 + cy * 0.5], [20, -8], [26, -4]], 13, skin);
  g.fillStyle = skin; line(2.5); g.beginPath(); g.ellipse(-40, -4, 13, 5.5, 0.08, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.ellipse(30, -4, 12, 5.5, -0.05, 0, 7); g.fill(); g.stroke();
  g.save(); g.translate(0, hipY); g.rotate(-lean);
  // 躯干（瘦）
  g.fillStyle = skin; line(3); g.beginPath(); g.moveTo(-17, -2); g.quadraticCurveTo(-20, -36, -12, -66); g.lineTo(18, -68); g.quadraticCurveTo(24, -36, 19, -2); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = sk2; g.lineWidth = 1.8; g.beginPath(); g.arc(1, -14, 2.2, 0, 7); g.moveTo(-6, -42); g.quadraticCurveTo(2, -38, 8, -42); g.stroke();
  // 短裤（珊瑚粉）
  g.fillStyle = S.shorts; line(3); g.beginPath(); g.moveTo(-22, -8); g.lineTo(23, -8); g.lineTo(31, 26); g.lineTo(6, 30); g.lineTo(2, 14); g.lineTo(-3, 30); g.lineTo(-28, 26); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = mix(S.shorts, '#000', 0.25); g.lineWidth = 2; g.beginPath(); g.moveTo(-20, -2); g.lineTo(21, -2); g.stroke();
  // 手臂 + 拳头
  const sh1 = [-10, -60], sh2 = [14, -60];
  const toLocal = (p) => { const dx = (p.x - fx - P.shiverX) / k, dy = (p.y - fy) / k - hipY, c = Math.cos(lean), s2 = Math.sin(lean); return [dx * c - dy * s2, dx * s2 + dy * c]; };
  let h1 = [-34, -112], h2 = [-40, -76];
  if (P.push > 0.01 && P.handTarget) { const a = toLocal(P.handTarget), b = toLocal({ x: P.handTarget.x + 6, y: P.handTarget.y + 40 }); h1 = [h1[0] + (a[0] + 8 - h1[0]) * P.push, h1[1] + (a[1] - h1[1]) * P.push]; h2 = [h2[0] + (b[0] + 8 - h2[0]) * P.push, h2[1] + (b[1] - h2[1]) * P.push]; }
  const sh = Math.sin(P.t * 40) * 1.2;
  limb([sh2, [(sh2[0] + h2[0]) / 2 + 8, (sh2[1] + h2[1]) / 2 + 12], [h2[0], h2[1] + sh]], 10, skin);
  // 头
  g.save(); g.translate(-4, -140); g.rotate(-0.06 + P.push * 0.05);
  g.fillStyle = skin; line(3); g.beginPath(); g.ellipse(0, 0, 41, 45, 0, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(37, 8, 8, 11, 0, 0, 7); g.fill(); g.stroke();
  g.strokeStyle = sk2; g.lineWidth = 2; g.beginPath(); g.arc(37, 8, 4, -1, 1.5); g.stroke();
  // 头发（橙黄，额前碎发 + 鬓角）
  g.fillStyle = S.hair; g.beginPath(); g.moveTo(-40, -6); g.quadraticCurveTo(-34, -30, -8, -26); g.quadraticCurveTo(14, -34, 34, -20); g.quadraticCurveTo(44, -4, 40, 14); g.lineTo(32, -2); g.lineTo(26, -10); g.lineTo(18, -2); g.lineTo(10, -14); g.lineTo(0, -6); g.lineTo(-10, -14); g.lineTo(-20, -4); g.lineTo(-28, -10); g.closePath(); g.fill(); g.strokeStyle = mix(S.hair, '#000', 0.4); g.lineWidth = 2; g.stroke();
  // 反戴帽：白色帽冠 + 右后方青色帽檐
  g.fillStyle = S.brimColor; line(3); g.beginPath(); g.moveTo(32, -18); g.quadraticCurveTo(62, -8, 56, 26); g.quadraticCurveTo(44, 18, 32, 8); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = S.capColor; g.beginPath(); g.moveTo(-42, -16); g.bezierCurveTo(-44, -66, 40, -74, 46, -14); g.quadraticCurveTo(4, -28, -42, -16); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(2, -64); g.quadraticCurveTo(8, -42, 6, -26); g.stroke();
  // 眼睛：大白眼 + 小黑瞳（看左上，惊恐）
  const ko = P.crush > 0.3;
  for (const [ex, ey, rx, ry] of [[-22, 2, 12, 15], [6, 3, 13, 16]]) { g.fillStyle = '#fff'; line(2.5); g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, 0, 7); g.fill(); g.stroke(); if (ko) { g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ex - 6, ey - 6); g.lineTo(ex + 6, ey + 6); g.moveTo(ex + 6, ey - 6); g.lineTo(ex - 6, ey + 6); g.stroke(); } else { g.fillStyle = '#111'; g.beginPath(); g.arc(ex - 5 + Math.sin(P.t * 3) * 1.2, ey - 4, 3.4, 0, 7); g.fill(); } }
  g.strokeStyle = mix(S.hair, '#000', 0.35); g.lineWidth = 2.5; g.beginPath(); g.moveTo(-34, -14); g.lineTo(-16, -20); g.moveTo(-2, -20); g.lineTo(18, -16); g.stroke();
  // 咬牙咧嘴（小，偏左）
  g.fillStyle = '#fff'; line(2.5); g.beginPath(); g.moveTo(-24, 26); g.quadraticCurveTo(-10, 18, 2, 24); g.quadraticCurveTo(0, 35, -12, 36); g.quadraticCurveTo(-24, 34, -24, 26); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 1.5; g.beginPath(); g.moveTo(-23, 30); g.lineTo(1, 30); for (const x of [-17, -11, -5]) { g.moveTo(x, 22); g.lineTo(x, 35); } g.stroke();
  // 汗滴
  if (S.sweat && !P.crush) { const ph = (P.t * 1.3) % 1; for (const [sx, sy, o] of [[-50, -16, 0], [44, -34, 0.5]]) { const u = (ph + o) % 1; g.globalAlpha = 1 - u; g.fillStyle = '#9fd8ff'; line(2); g.beginPath(); const yy = sy + u * 26; g.moveTo(sx, yy - 9); g.quadraticCurveTo(sx + 6, yy, sx, yy + 4); g.quadraticCurveTo(sx - 6, yy, sx, yy - 9); g.fill(); g.stroke(); g.globalAlpha = 1; } }
  g.restore();
  // 前臂 + 拳头（画在脸前面，参考：双拳举在脸左侧）
  limb([sh1, [(sh1[0] + h1[0]) / 2 + 4, (sh1[1] + h1[1]) / 2 + 14], [h1[0], h1[1] + sh]], 10, skin);
  for (const h of [h2, h1]) { g.fillStyle = skin; line(2.5); g.beginPath(); g.ellipse(h[0], h[1] + sh, 10, 11, 0, 0, 7); g.fill(); g.stroke(); g.strokeStyle = sk2; g.lineWidth = 1.5; g.beginPath(); g.moveTo(h[0] - 5, h[1] + sh - 3); g.lineTo(h[0] + 4, h[1] + sh - 3); g.moveTo(h[0] - 5, h[1] + sh + 2); g.lineTo(h[0] + 4, h[1] + sh + 2); g.stroke(); }
  g.restore(); g.restore();
}
// ---------- 烟雾团 ----------
export function drawSmoke(g, S, x, y, u, seed = 3) {
  if (u <= 0) return; const q = mulberry(seed), n = 11, R = S.smokeSize * (0.35 + 0.65 * (1 - Math.pow(1 - Math.min(1, u * 2.2), 3)));
  const puffs = []; for (let i = 0; i < n; i++) { const a = q() * 6.283, d = q() * 0.75; puffs.push([Math.cos(a) * d * R, Math.sin(a) * d * R * 0.75, R * (0.35 + q() * 0.25)]); }
  g.save(); g.translate(x, y);
  g.fillStyle = S.smokeShade; for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(px + pr * 0.06, py + pr * 0.1, pr * 1.04, 0, 7); g.fill(); }
  g.fillStyle = S.smokeColor; for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(px - pr * 0.05, py - pr * 0.08, pr * 0.92, 0, 7); g.fill(); }
  g.fillStyle = mix(S.smokeShade, S.smokeColor, 0.4); for (const [px, py, pr] of puffs) { g.beginPath(); g.arc(px + pr * 0.25, py + pr * 0.3, pr * 0.3, 0, 7); g.fill(); }
  g.restore();
}
// ---------- FAIL 徽章 ----------
export function failBadge(S, size) {
  const c = mk(size, size), g = c.getContext('2d'), R = size / 2 * 0.96, b = S.failBorder * size;
  g.translate(size / 2, size / 2);
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
  g.fillStyle = S.failColor; g.beginPath(); g.arc(0, 0, R - b, 0, 7); g.fill();
  g.rotate(S.failTilt * Math.PI / 180); g.font = `900 ${size * 0.25}px "Arial Black","Arial Rounded MT Bold","Noto Sans CJK SC",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.transform(1, 0, -0.08, 1, 0, 0); g.fillStyle = mix(S.failColor, '#000', 0.35); g.fillText(S.failText, size * 0.012, size * 0.03); g.fillStyle = '#fff'; g.fillText(S.failText, 0, 0); g.restore();
  return c;
}
// ---------- 内置白手套（参考同款：食指指向左上、圆鼓指节、卷边袖口） ----------
export function gloveCanvas() {
  const W = 300, c = mk(W, W), g = c.getContext('2d'); const O = '#121628', ln = 7;
  g.translate(150, 160); g.rotate(-0.72); g.lineJoin = 'round'; g.lineCap = 'round';
  const st = () => { g.strokeStyle = O; g.lineWidth = ln; g.stroke(); };
  // 拇指
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-62, 18, 22, 36, -0.5, 0, 7); g.fill(); st();
  // 掌 + 三个弯曲手指
  g.beginPath(); g.moveTo(-50, -30); g.lineTo(-48, 50); g.quadraticCurveTo(-10, 80, 52, 52); g.lineTo(58, -26);
  g.quadraticCurveTo(60, -50, 40, -48); g.quadraticCurveTo(34, -66, 14, -60); g.quadraticCurveTo(4, -70, -12, -58); g.closePath(); g.fillStyle = '#fff'; g.fill(); st();
  g.strokeStyle = O; g.lineWidth = 4; g.beginPath(); g.moveTo(38, -46); g.quadraticCurveTo(34, -30, 38, -18); g.moveTo(14, -58); g.quadraticCurveTo(12, -42, 16, -30); g.stroke();
  // 食指
  g.beginPath(); g.moveTo(-50, -20); g.lineTo(-48, -128); g.quadraticCurveTo(-34, -150, -18, -128); g.lineTo(-14, -40); g.fillStyle = '#fff'; g.fill(); st();
  // 阴影（左侧浅蓝）
  g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(160,200,235,0.55)'; g.fillRect(-60, -140, 16, 200); g.restore();
  g.fillStyle = 'rgba(160,200,235,0.55)'; g.beginPath(); g.ellipse(-42, -80, 4, 40, 0, 0, 7); g.fill();
  // 袖口（卷边 + 深色开口）
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(-60, 50, 124, 52, 22); g.fill(); st();
  g.fillStyle = '#e3eef8'; g.beginPath(); g.roundRect(-52, 80, 108, 16, 8); g.fill();
  g.fillStyle = '#1b2a44'; g.beginPath(); g.ellipse(2, 104, 50, 20, 0, 0, 7); g.fill(); st();
  // 指尖位置（用于默认锚点）
  const m = g.getTransform(), tip = m.transformPoint(new DOMPoint(-33, -140));
  return { c, ax: tip.x / W, ay: tip.y / W };
}
