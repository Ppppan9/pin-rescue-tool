// AE 导出用的精灵素材：全部用页面同一套 2D 绘制函数（src/art.js）离屏绘制成透明 PNG。
// 返回 { key: { c: canvas, w, h, ax, ay } }，w/h/ax/ay 为设计像素（720×1280 坐标系）。
import * as A from '../art.js';
import { GEO, DW, DH, COLOR_KEYS, slotPos } from '../game.js';
const KS = 2;
export function buildSprites({ S, view, bg, stoneSpr, handImg, charPose, endDraw }) {
  const out = {};
  const sprite = (key, w, h, ax, ay, fn) => { const c = A.mk(w * KS, h * KS), g = c.getContext('2d'); g.scale(KS, KS); fn(g); out[key] = { c, w, h, ax, ay }; };
  const overlay = (key, fn) => sprite(key, view.w, view.h, 0, 0, g => { g.translate(-view.x0, -view.y0); fn(g); });
  overlay('background', g => g.drawImage(bg, 0, 0));
  overlay('hinge', g => { A.drawHinge(g); A.bolt(g, GEO.propPin.x, GEO.propPin.y, 14); });
  overlay('title', g => A.drawTitle(g, S));
  overlay('disclaimer', g => A.drawDisclaimer(g, S, view));
  // 小人三种姿势（惊恐 / 推杆 / 被压）
  const cw = 320, ch = 360, fx = S.charX, fy = GEO.roomFloor - 2, base = charPose();
  for (const [key, P] of [['char_scared', { ...base, push: 0, crouch: 0, crush: 0, shiverX: 0 }], ['char_push', { ...base, push: 1, crouch: 0, crush: 0, shiverX: 0 }], ['char_crush', { ...base, push: 0, crush: 1, shiverX: 0 }]])
    sprite(key, cw, ch, cw / 2, ch - 20, g => { g.translate(cw / 2 - fx, ch - 20 - fy); A.drawCharacter(g, S, P); });
  // 支撑杆（锚点 = 底部铁钉）/ 压板（锚点 = 右侧铰链）
  { const len = Math.ceil(Math.hypot(440 - GEO.propPin.x, 250 - GEO.propPin.y)) + 40, h = GEO.propW + 16; sprite('prop', len + 20, h, 14, h / 2, g => A.drawProp(g, 14, h / 2, 0, len)); }
  { const L = GEO.lidLeft + 20, R = GEO.lidRight + 20, h = GEO.lidThick + 24; sprite('lid', L + R, h, L, h / 2, g => { g.translate(L - GEO.pivot.x, h / 2 - GEO.pivot.y); A.drawLid(g, 0); }); }
  // 石头（单位：碰撞半径 32 时的尺寸，图层缩放 = 实际半径 / 32）
  stoneSpr.forEach((s, i) => { out['stone_' + i] = { c: s.c, w: s.R * 2, h: s.R * 2, ax: s.R, ay: s.R }; });
  // 木板
  for (const hor of [true, false]) { const len = hor ? S.gridDX : S.gridDY, th = (hor ? S.plankH : S.plankV) / 2, sp = A.plankSprite(S, len, th, 1, hor); out['plank_' + (hor ? 'h' : 'v')] = { c: sp.c, w: sp.w, h: sp.h, ax: sp.w / 2, ay: sp.h / 2 }; }
  // 钉子（静止 / 飞行时露出钉身）
  for (const c of COLOR_KEYS) {
    const col = A.colorOf(S, c), R = S.pinR, n = R * 2 + 12;
    sprite('pin_' + c, n, n, n / 2, n / 2, g => A.drawPin(g, n / 2, n / 2, R, col));
    sprite('pinfly_' + c, n, n + R * 2.2, n / 2, n / 2, g => A.drawPin(g, n / 2, n / 2, R, col, { shank: S.pinShank / 1.1 }));
    const bw = S.boxW + 20, bh = S.boxHt + 30; sprite('box_' + c, bw, bh, bw / 2, bh / 2 - 4, g => { g.translate(bw / 2 - S.boxX, bh / 2 - 4 - S.boxY); A.drawBox(g, S, col, 1, [], S.slotsPerBox); });
  }
  { const n = 380; sprite('boxfx', n, n, n / 2, n / 2, g => { g.translate(n / 2 - S.boxX, n / 2 - S.boxY); A.drawBoxFx(g, S, 0.3); }); }
  { const n = S.smokeSize * 2.6; sprite('smoke', n, n, n / 2, n / 2, g => A.drawSmoke(g, S, n / 2, n / 2, 1, 3)); }
  for (let k = 0; k <= Math.ceil(S.timerSec + S.timerShowOffset); k++) { const n = S.timerR * 2 + 12; sprite('timer_' + k, n, n, n / 2, n / 2, g => { g.translate(n / 2 - S.timerX, n / 2 - S.timerY); A.drawTimer(g, S, k, Math.max(0, Math.min(1, (k - S.timerShowOffset) / S.timerSec)), 1); }); }
  { const size = S.failSize * DW, c = A.failBadge(S, Math.round(size * KS)); out.fail_badge = { c, w: size, h: size, ax: size / 2, ay: size / 2 }; }
  sprite('win_text', 640, 160, 320, 80, g => { g.translate(320, 80); g.font = '900 84px "PingFang SC","Noto Sans CJK SC",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#1a1020'; g.strokeText(S.winText || '', 0, 0); g.fillStyle = '#ffd54a'; g.fillText(S.winText || '', 0, 0); });
  sprite('ripple', 130, 130, 65, 65, g => { const [a, b, c] = A.hexRGB(S.rippleColor); g.strokeStyle = `rgb(${a},${b},${c})`; g.lineWidth = 5; g.beginPath(); g.arc(65, 65, 58, 0, 7); g.stroke(); g.fillStyle = `rgba(${a},${b},${c},0.3)`; g.fill(); });
  if (handImg) { const s = S.handSize * DW / handImg.width, w = handImg.width * s, h = handImg.height * s, c = A.mk(handImg.width, handImg.height), g = c.getContext('2d'); if (S.handFlip) { g.translate(c.width, 0); g.scale(-1, 1); } g.drawImage(handImg, 0, 0); out.hand = { c, w, h, ax: (S.handFlip ? 1 - (handImg._glove ? S.gloveAnchorX : S.handAnchorX) : (handImg._glove ? S.gloveAnchorX : S.handAnchorX)) * w, ay: (handImg._glove ? S.gloveAnchorY : S.handAnchorY) * h }; }
  overlay('end_card', g => endDraw(g));
  return out;
}
