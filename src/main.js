// 拔钉救人核玩工具 —— 主程序：游戏循环 / 渲染合成 / 输入 / 自动通关 / 录制 / AE·H5 导出 / 设置面板
import { GROUPS, DEFS, loadSettings, saveSettings, migrate, exportJSON, APP_ID, APP_VERSION } from './settings.js';
import { Game, DW, DH, GEO, PX, slotPos } from './game.js';
import * as A from './art.js';
import { Sfx } from './audio.js';
import { createAERecorder } from './ae/recorder.js';
import { buildSprites } from './ae/sprites.js';
import { exportH5PlayableFromPage, applyPlayableMode, isPlayableNoHand, applyH5DevicePresetToSettings, markH5DeviceCustomIfSizeEdited, bindEditorDevicePreview } from './h5/index.js';

const H5_NO_HAND = isPlayableNoHand();
let S = loadSettings();
const cv = document.getElementById('stage'); const ctx = cv.getContext('2d');
const sfx = new Sfx();
const now = () => window.__vclock != null ? window.__vclock : performance.now();
const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
const easeIO = t => { t = clamp01(t); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
const easeBack = t => { t = clamp01(t); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const status = t => { const el = document.getElementById('status'); if (el) el.textContent = t; };
let G, view, K = 1, bg = null, stoneSpr = null, glove = null, t0Game = 0, lastT = 0, acc = 0, sceneCv = null;
let autoRunning = false, autoToken = 0;
const hand = { x: 560, y: 1100, press: 0, pressT0: null, img: null, visible: false, follow: null };
const ripples = [];
window.__finished = false; window.__failed = false;

// ---------- 画面 / 视口 ----------
function computeView() { const cw = S.canvasW, ch = S.canvasH; K = Math.min(cw / DW, ch / DH); const w = cw / K, h = ch / K; view = { x0: DW / 2 - w / 2, y0: DH / 2 - h / 2, w, h }; }
function rebuild() {
  if (cv.width !== S.canvasW || cv.height !== S.canvasH) { cv.width = S.canvasW; cv.height = S.canvasH; }
  if (!document.documentElement.classList.contains('h5-playable')) cv.style.aspectRatio = `${S.canvasW}/${S.canvasH}`;
  computeView(); bg = A.paintBackground(S); stoneSpr = A.stoneSprites(S); sceneCv = A.mk(cv.width, cv.height); draw.badge = null; aeSpritesCache = null;
}
function newGame() {
  autoToken++; autoRunning = false; hand.visible = false; updAutoBtn(); rebuild();
  G = new Game(S); t0Game = lastT = now(); acc = 0; ripples.length = 0;
  window.__finished = false; window.__failed = false; status(`v${APP_VERSION} · 钉子 ${G.pins.length} 颗 · 木板 ${G.planks.length} 块 · 石头 ${G.stones.length} 颗`);
}
const ended = () => !!(G && (G.failT != null || G.winT != null));
const failShowT = () => G.failT != null ? G.failT + S.failBadgeAfter : null;

// ---------- 游戏推进（固定 60Hz 物理步长） ----------
function step(t) {
  let dt = Math.min(0.25, (t - lastT) / 1000); lastT = t; if (dt <= 0) return;
  acc += dt; const h = 1 / 60;
  while (acc >= h) { G.update(h); acc -= h; handleEvents(); }
  if (sfx.ctx) sfx.roll(S, Math.min(1, G.stoneMotion() / 260));
}
function handleEvents() {
  for (const e of G.events) {
    if (e.type === 'pop') sfx.play('pop', S);
    else if (e.type === 'slot') sfx.play('slot', S);
    else if (e.type === 'chime') sfx.play('chime', S);
    else if (e.type === 'wrong') sfx.play('wrong', S);
    else if (e.type === 'wood') sfx.play('wood', S, { v: e.v });
    else if (e.type === 'tick') sfx.play('tick', S);
    else if (e.type === 'crush') { sfx.play('crush', S); window.__failed = true; status('失败：时间到，石头压下来了'); onFinish(); }
    else if (e.type === 'win') { sfx.play('win', S); window.__finished = true; status('通关！'); onFinish(); }
  }
  if (G.failT != null && !G.failSfx && G.t >= G.failT + S.failBadgeAfter) { G.failSfx = true; sfx.play('fail', S); }
  G.events.length = 0;
}

// ---------- 场景状态（渲染与 AE 共用） ----------
function lidPose() {
  const th = G.lidAng, B = GEO.propPin, pb = G.prop.getPosition(), pa = G.prop.getAngle();
  return { th, prop: { x: pb.x * PX, y: pb.y * PX, ang: pa, len: G.propLen } };
}
function charPose() {
  const t = G.t, d2r = Math.PI / 180; let push = 0;
  const intro = S.lidPushDur + 0.35; if (t < intro) push = 1 - clamp01((t - intro + 0.3) / 0.3);
  for (const ts of G.sagTimes) { const u = (t - ts + 0.15) / (S.lidSagDur + 0.3); if (u > 0 && u < 1) push = Math.max(push, Math.min(1, Math.sin(Math.PI * u) * 2.2)); }
  if (G.failT != null) push = Math.max(0, 1 - (t - G.failT) / 0.15) * push;
  const lp = lidPose(), f = 0.6, ht = { x: lp.prop.x + Math.cos(lp.prop.ang) * lp.prop.len * f, y: lp.prop.y + Math.sin(lp.prop.ang) * lp.prop.len * f };
  const crouch = clamp01((G.lidAng - S.lidRestDeg * d2r) / (12 * d2r));
  const crush = G.failT != null ? clamp01((t - G.failT - 0.1) / 0.25) : 0;
  return { push, crouch, crush, shiverX: crush ? 0 : Math.sin(t * 47) * S.shiver, t, handTarget: ht };
}
function timerScale() { const u = (G.t - S.timerShowAt) / 0.25; return u <= 0 ? 0 : easeBack(u); }
function smokeState() { if (!S.failSmoke || G.failT == null) return null; const u = (G.t - G.failT - S.smokeAt) / 0.6; if (u <= 0) return null; const v = Math.min(1, u); return { x: 545 - 5 * v, y: 420 + 90 * clamp01((G.t - G.failT - S.smokeAt) / 1.2), u: v, sc: 0.35 + 0.65 * (1 - Math.pow(1 - Math.min(1, u * 2.2), 3)) + 0.25 * clamp01((G.t - G.failT - S.smokeAt - 0.6) / 1.2) }; }
function blurAmt() { const f = failShowT(); if (f == null) return 0; return S.failBlur * easeOut((G.t - f + 0.05) / 0.35); }
function pinVisual(p) { let dx = 0; for (const s of G.shakes) if (s.pin === p) { const u = (G.t - s.t0) / 0.4; dx = Math.sin(u * Math.PI * 6) * 6 * (1 - u); } return { x: p.x + dx, y: p.y }; }

// ---------- 渲染 ----------
function drawScene(g) {
  g.drawImage(bg, 0, 0);
  const lp = lidPose();
  if (S.charShow) A.drawCharacter(g, S, charPose());
  A.drawProp(g, lp.prop.x, lp.prop.y, lp.prop.ang, lp.prop.len);
  A.drawLid(g, lp.th); A.drawHinge(g); A.bolt(g, GEO.propPin.x, GEO.propPin.y, 14);
  for (const st of G.stones) { const p = st.body.getPosition(); A.drawStone(g, stoneSpr[st.v % stoneSpr.length], p.x * PX, p.y * PX, st.body.getAngle(), st.r * S.stoneDraw); }
  for (const pk of G.planks) { const p = pk.body.getPosition(); A.drawPlank(g, S, pk, p.x * PX, p.y * PX, pk.body.getAngle()); }
  for (const p of G.pins) if (p.alive) { const v = pinVisual(p); A.drawPin(g, v.x, v.y, S.pinR, A.colorOf(S, p.c)); }
  const bx = G.box; A.drawBox(g, S, A.colorOf(S, bx.color), G.boxScale(), bx.filled, S.slotsPerBox);
  if (bx.phase === 'fx') A.drawBoxFx(g, S, (G.t - bx.t0) / S.boxFxDur);
  for (const f of G.flying) { const q = G.flyPos(f); A.drawPin(g, q.x, q.y, S.pinR, A.colorOf(S, f.c), { s: q.s, shank: q.shank * S.pinShank / 1.1, rot: q.rot }); }
  const sm = smokeState(); if (sm) A.drawSmoke(g, S, sm.x, sm.y, sm.u, 3), 0;
  A.drawTitle(g, S);
  A.drawTimer(g, S, G.remaining(), G.remaining() / S.timerSec, timerScale());
}
function draw(t) {
  const g = ctx, cw = cv.width, ch = cv.height, blur = blurAmt();
  const sg = sceneCv.getContext('2d'); sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, cw, ch); sg.setTransform(K, 0, 0, K, -view.x0 * K, -view.y0 * K); drawScene(sg);
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
  if (blur > 0.2) { const b = blur * K; g.filter = `blur(${b.toFixed(1)}px)`; g.drawImage(sceneCv, -b * 2, -b * 2, cw + b * 4, ch + b * 4); g.filter = 'none'; const [r, gg, bb] = A.hexRGB(S.failDimColor); g.fillStyle = `rgba(${r},${gg},${bb},${S.failDim * blur / Math.max(0.01, S.failBlur)})`; g.fillRect(0, 0, cw, ch); }
  else g.drawImage(sceneCv, 0, 0);
  g.setTransform(K, 0, 0, K, -view.x0 * K, -view.y0 * K);
  const fs = failShowT();
  if (fs != null && G.t >= fs) { const u = (G.t - fs) / S.failScaleDur, size = S.failSize * DW; if (!draw.badge || draw.badgeKey !== S.failColor + S.failText + size + S.failBorder + S.failTilt) { draw.badge = A.failBadge(S, Math.round(size * 1.5)); draw.badgeKey = S.failColor + S.failText + size + S.failBorder + S.failTilt; }
    g.save(); g.translate(S.failX * DW, view.y0 + S.failY * view.h); g.rotate((1 - easeOut(u)) * -0.3); const s = Math.max(0.001, easeBack(u)); g.scale(s, s); g.globalAlpha = clamp01(u * 4); g.drawImage(draw.badge, -size / 2, -size / 2, size, size); g.restore(); }
  if (G.winT != null && S.winText) { const u = (G.t - G.winT) / 0.5; g.save(); g.globalAlpha = clamp01(u * 3); g.translate(DW / 2, DH * 0.45); const s = easeBack(u); g.scale(s, s); g.font = '900 84px "PingFang SC","Noto Sans CJK SC",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#1a1020'; g.strokeText(S.winText, 0, 0); g.fillStyle = '#ffd54a'; g.fillText(S.winText, 0, 0); g.restore(); }
  A.drawDisclaimer(g, S, view);
  const ea = endAlpha(t); if (ea > 0) drawEnd(g, ea);
  for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i], u = (t - r.t0) / 420; if (u > 1) { ripples.splice(i, 1); continue; } const [a, b2, c] = A.hexRGB(S.rippleColor); g.strokeStyle = `rgba(${a},${b2},${c},${1 - u})`; g.lineWidth = 6 * (1 - u) + 2; g.beginPath(); g.arc(r.x, r.y, 12 + easeOut(u) * 46, 0, 7); g.stroke(); g.fillStyle = `rgba(${a},${b2},${c},${0.35 * (1 - u)})`; g.fill(); }
  const hs = handState(); if (hs) drawHand(g, hs);
  draw.blur = blur;
}
function endAlpha(t) { if (!G) return 0; const e = G.winT ?? failShowT(); if (e == null || !S.endCard) return 0; const d = (G.t - e) * 1000 - S.endDelay; return d > 0 ? Math.min(1, d / 400) : 0; }
function endButton() { return { x: DW / 2 - 200, y: DH * 0.62, w: 400, h: 110 }; }
function drawEnd(g, a) { g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(view.x0, view.y0, view.w, view.h); g.fillStyle = '#fff'; g.font = '900 54px "PingFang SC","Noto Sans CJK SC",sans-serif'; g.textAlign = 'center'; g.fillText(S.endTitle, DW / 2, DH * 0.42); const b = endButton(); g.fillStyle = '#3ecf5a'; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 55); g.fill(); g.fillStyle = '#fff'; g.font = '900 46px "PingFang SC","Noto Sans CJK SC",sans-serif'; g.textBaseline = 'middle'; g.fillText(S.h5CtaText || '立即下载', DW / 2, b.y + b.h / 2); g.restore(); }

// ---------- 手指 ----------
function handScaleOf() { return hand.img ? S.handSize * DW / hand.img.width : 1; }
const handHiddenByEnd = () => !S.endCardHand && endAlpha(now()) > 0;
function handState() { if (H5_NO_HAND || !S.handShow || !hand.img || !hand.visible || handHiddenByEnd()) return null; if (!autoRunning && !S.manualHand) return null; return { x: hand.x, y: hand.y, s: handScaleOf() * (1 - S.pressDepth * hand.press) }; }
function drawHand(g, h) { const im = hand.img, w = im.width * h.s, hh = im.height * h.s; g.save(); g.translate(h.x, h.y); g.rotate(S.handRotation * Math.PI / 180); if (S.handFlip) g.scale(-1, 1); g.drawImage(im, -S.handAnchorX * w, -S.handAnchorY * hh, w, hh); g.restore(); }
function handCursorHidden() { return !H5_NO_HAND && !!(S.hideCursor && S.handShow && hand.img && !handHiddenByEnd() && (autoRunning ? hand.visible : S.manualHand && hand.visible)); }
function updateCursor() { const c = handCursorHidden() ? 'none' : 'pointer'; if (cv.style.cursor !== c) cv.style.cursor = c; }
function updPress(t) { if (!S.pressEnabled || hand.pressT0 == null) { hand.press = 0; return; } const p = (t - hand.pressT0) / 200; hand.press = p < 0 || p > 1 ? (hand.follow ? 1 : 0) : (hand.follow && p > 0.5 ? 1 : Math.sin(Math.PI * p)); }

// ---------- 输入 ----------
function evtPos(e) { const r = cv.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * cv.width, py = (e.clientY - r.top) / r.height * cv.height; return { x: px / K + view.x0, y: py / K + view.y0 }; }
function tapAt(x, y) {
  sfx.resume(); if (S.tapRipple && !H5_NO_HAND) ripples.push({ x, y, t0: now() });
  if (endAlpha(now()) > 0) { const b = endButton(); if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h && window.__h5Install) window.__h5Install(); return null; }
  return G.tap(x, y);
}
let pointerDown = false;
cv.addEventListener('pointerdown', e => { if (autoRunning) return; sfx.resume(); const p = evtPos(e); hand.x = p.x; hand.y = p.y; hand.visible = true; pointerDown = true; hand.follow = 1; if (S.pressEnabled) hand.pressT0 = now(); try { cv.setPointerCapture(e.pointerId); } catch (_) { } tapAt(p.x, p.y); });
cv.addEventListener('pointermove', e => { if (autoRunning) return; const p = evtPos(e); hand.x = p.x; hand.y = p.y; hand.visible = true; });
cv.addEventListener('pointerup', () => { if (autoRunning) return; pointerDown = false; hand.follow = null; hand.pressT0 = null; });
cv.addEventListener('pointercancel', () => { pointerDown = false; hand.follow = null; });
cv.addEventListener('pointerleave', () => { if (!autoRunning && !pointerDown) hand.visible = false; });

// ---------- 自动通关（模拟手指逐个点当前盒子颜色的钉子） ----------
const wait = (ms, tok) => new Promise((res, rej) => { const t0 = now(), f = () => { if (tok !== autoToken) return rej('stop'); if (now() - t0 >= ms / S.autoSpeed) return res(); requestAnimationFrame(f); }; f(); });
const rnd = (a, b) => a + Math.random() * Math.max(0, b - a);
const frame = () => new Promise(r => requestAnimationFrame(r));
async function moveHand(tx, ty, tok, durMs) {
  const x0 = hand.x, y0 = hand.y, dur = (durMs ?? rnd(S.moveMin, S.moveMax)) / S.autoSpeed, t0 = now();
  const cx = (x0 + tx) / 2 + (Math.random() - 0.5) * 60, cy = (y0 + ty) / 2 + 20 + Math.random() * 30;
  while (true) { if (tok !== autoToken) throw 'stop'; const p = Math.min(1, (now() - t0) / dur), e = easeIO(p); hand.x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * tx; hand.y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * ty; if (p >= 1) return; await frame(); }
}
function planTap() {
  const c = G.candidates().filter(p => p.y < view.y0 + view.h - 10); if (!c.length) return null;
  if (S.autoPick === 'random') return c[Math.floor(Math.random() * c.length)];
  if (S.autoPick === 'near') return c.sort((a, b) => Math.hypot(a.x - hand.x, a.y - hand.y) - Math.hypot(b.x - hand.x, b.y - hand.y))[0];
  return c.sort((a, b) => a.y - b.y || Math.abs(a.x - hand.x) - Math.abs(b.x - hand.x))[0];
}
async function autoSolve() {
  if (autoRunning) { autoToken++; autoRunning = false; hand.visible = false; hand.follow = null; updAutoBtn(); return; }
  if (ended() || G.t > 0.5) newGame();
  const tok = ++autoToken; autoRunning = true; updAutoBtn(); sfx.resume();
  hand.x = DW * 0.78; hand.y = DH * 0.88; hand.visible = true;
  if (S.autoRec && !rec) startRec();
  try {
    await wait(S.autoStartDelay, tok);
    while (!ended()) {
      const p = planTap(); if (!p) { await frame(); if (tok !== autoToken) throw 'stop'; continue; }
      await moveHand(p.x + (Math.random() - 0.5) * S.jitter, p.y + (Math.random() - 0.5) * S.jitter, tok);
      if (ended()) break;
      if (S.pressEnabled) hand.pressT0 = now();
      await wait(60, tok);
      const r = tapAt(hand.x, hand.y); if (!r || !r.ok) { const q = planTap(); if (q) { G.tap(q.x, q.y); } }
      await wait(rnd(S.delayMin, S.delayMax) + (Math.random() < S.thinkChance ? Math.random() * S.thinkMax : 0), tok);
    }
    while (S.endCard && endAlpha(now()) <= 0) { if (tok !== autoToken) throw 'stop'; await frame(); }
  } catch (e) { if (e !== 'stop') console.error(e); }
  if (tok === autoToken) { autoRunning = false; updAutoBtn(); }
}
function onFinish() { if (rec && S.autoStop && autoRunning) setTimeout(stopRec, S.tailSec * 1000 + S.failBadgeAfter * 1000 + (S.endCard ? S.endDelay : 0) + 600); }
function updAutoBtn() { const b = document.getElementById('btnAuto'); if (b) { b.textContent = autoRunning ? '■ 停止' : '▶ 自动通关'; b.classList.toggle('on', autoRunning); } }

// ---------- 录制（仅“⏺ 开始录制”按钮或 autoRec）----------
let rec = null, recChunks = [], recT0 = 0;
function pickMime() {
  const mp4 = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'], webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const list = S.recFormat === 'webm' ? webm : S.recFormat === 'mp4' ? mp4 : mp4.concat(webm);
  return list.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}
function startRec() {
  if (!window.MediaRecorder) { status('浏览器不支持录制'); return; }
  sfx.ensure();
  const vs = cv.captureStream(S.recFps), tracks = [...vs.getVideoTracks()];
  if (sfx.recDest) tracks.push(...sfx.recDest.stream.getAudioTracks());
  const mime = pickMime();
  rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime || undefined, videoBitsPerSecond: S.recBitrate * 1e6 });
  recChunks = []; rec.ondataavailable = e => e.data.size && recChunks.push(e.data);
  rec.onstop = () => {
    const type = rec.mimeType || mime || 'video/webm', ext = type.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(recChunks, { type }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `pin-rescue_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`; a.textContent = `⬇ ${a.download} (${(blob.size / 1e6).toFixed(1)}MB)`;
    document.getElementById('recList').prepend(a); window.__lastRec = { size: blob.size, type }; rec = null; updRecBtn();
    if (aeByRec && aeActive()) aeStopAndExport().catch(e => console.error(e));
    aeByRec = false;
  };
  rec.start(250); recT0 = now(); updRecBtn(); aeByRec = false; if (S.aeWithRec && !aeActive()) { recStart(); aeByRec = true; }
}
function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); }
function updRecBtn() { const b = document.getElementById('btnRec'); if (!b) return; b.textContent = rec ? '■ 停止录制' : '⏺ 开始录制'; b.classList.toggle('on', !!rec); }

// ---------- AE 导出：每个元素一个独立图层（位置 / 缩放 / 旋转 / 不透明度关键帧） ----------
function frameItems(t) {
  const out = []; out.push({ id: 'background', asset: 'background', x: view.x0, y: view.y0, z: 0 });
  const lp = lidPose(), cp = charPose();
  if (S.charShow) { const a = cp.crush > 0.5 ? 'char_crush' : cp.push > 0.5 ? 'char_push' : 'char_scared'; out.push({ id: 'char', asset: a, x: S.charX + cp.shiverX, y: GEO.roomFloor - 2 + (cp.push > 0.5 ? 0 : cp.crouch * 8), z: 1 }); }
  out.push({ id: 'prop', asset: 'prop', x: lp.prop.x, y: lp.prop.y, rot: lp.prop.ang, z: 1.1 });
  out.push({ id: 'lid', asset: 'lid', x: GEO.pivot.x, y: GEO.pivot.y, rot: -lp.th, z: 1.2 });
  out.push({ id: 'hinge', asset: 'hinge', x: view.x0, y: view.y0, z: 1.3 });
  if (S.aeStones !== 'none') for (const st of G.stones) { const p = st.body.getPosition(); out.push({ id: 'stone_' + st.id, asset: 'stone_' + (st.v % stoneSpr.length), x: p.x * PX, y: p.y * PX, rot: st.body.getAngle(), sc: st.r * S.stoneDraw / 32, z: 2 }); }
  for (const pk of G.planks) { const p = pk.body.getPosition(); out.push({ id: 'plank_' + pk.id, asset: 'plank_' + (pk.hor ? 'h' : 'v'), x: p.x * PX, y: p.y * PX, rot: pk.body.getAngle(), z: pk.hor ? 2.2 : 2.1 }); }
  for (const p of G.pins) if (p.alive) { const v = pinVisual(p); out.push({ id: 'pin_' + p.id, asset: 'pin_' + p.c, x: v.x, y: v.y, z: 2.3 }); }
  const bs = G.boxScale(); if (bs > 0.001) out.push({ id: 'box_' + G.boxIdx, asset: 'box_' + G.box.color, x: S.boxX, y: S.boxY, sc: bs, z: 3 });
  for (const f of G.box.filled) { const p = slotPos(S, f.slot); out.push({ id: 'boxpin_' + G.boxIdx + '_' + f.slot, asset: 'pin_' + f.c, x: S.boxX + (p.x - S.boxX) * bs, y: S.boxY + (p.y - 3 - S.boxY) * bs, sc: bs * 0.95, rot: f.rot, z: 3.1 }); }
  if (G.box.phase === 'fx') { const u = (G.t - G.box.t0) / S.boxFxDur; out.push({ id: 'boxfx_' + G.boxIdx, asset: 'boxfx', x: S.boxX, y: S.boxY, sc: 0.3 + u * 1.2, op: Math.sin(Math.PI * Math.min(1, u * 1.2)), z: 3.2, add: true }); }
  for (const f of G.flying) { const q = G.flyPos(f); out.push({ id: 'fly_' + f.id, asset: q.shank > 0.5 ? 'pinfly_' + f.c : 'pin_' + f.c, x: q.x, y: q.y, sc: q.s, rot: q.rot, z: 3.3 }); }
  const sm = smokeState(); if (sm) out.push({ id: 'smoke', asset: 'smoke', x: sm.x, y: sm.y, sc: sm.sc, z: 3.5 });
  out.push({ id: 'title', asset: 'title', x: view.x0, y: view.y0, z: 4 });
  const ts = timerScale(); if (ts > 0.001) { const n = Math.max(0, Math.ceil(G.remaining() - 1e-6)); out.push({ id: 'timer', asset: 'timer_' + n, x: S.timerX, y: S.timerY, sc: ts, z: 4.1 }); }
  if (draw.blur > 0.05) out.push({ id: 'blur', blur: draw.blur, z: 5 });
  const fs = failShowT(); if (fs != null && G.t >= fs) { const u = (G.t - fs) / S.failScaleDur; out.push({ id: 'result_fail', asset: 'fail_badge', x: S.failX * DW, y: view.y0 + S.failY * view.h, sc: Math.max(0.001, easeBack(u)), rot: (1 - easeOut(u)) * -0.3, op: clamp01(u * 4), z: 6 }); }
  if (G.winT != null && S.winText) { const u = (G.t - G.winT) / 0.5; out.push({ id: 'result_win', asset: 'win_text', x: DW / 2, y: DH * 0.45, sc: Math.max(0.001, easeBack(u)), op: clamp01(u * 3), z: 6 }); }
  if (S.discShow) out.push({ id: 'disclaimer', asset: 'disclaimer', x: view.x0, y: view.y0, z: 7 });
  const ea = endAlpha(t); if (ea > 0) out.push({ id: 'end_card', asset: 'end_card', x: view.x0, y: view.y0, op: ea, z: 8 });
  for (const r of ripples) { const u = (t - r.t0) / 420; if (u >= 0 && u <= 1) out.push({ id: 'ripple_' + (r.id || (r.id = ++frameItems.n)), asset: 'ripple', x: r.x, y: r.y, sc: (12 + easeOut(u) * 46) / 58, op: 1 - u, z: 8.5 }); }
  const hs = handState(); if (hs) out.push({ id: 'hand', asset: 'hand', x: hs.x, y: hs.y, sc: hs.s / handScaleOf(), rot: S.handRotation * Math.PI / 180, z: 9 });
  return out;
}
frameItems.n = 0;
let aeSpritesCache = null;
const aeRec = createAERecorder({ sfx, now, version: APP_VERSION, env: () => ({ S, view, K, canvas: cv, items: frameItems(now()), sprites: () => aeSprites() }) });
function aeSprites() { if (!aeSpritesCache) aeSpritesCache = buildSprites({ S, view, bg, stoneSpr, handImg: hand.img, charPose, endDraw: g => drawEnd(g, 1) }); return aeSpritesCache; }
let recClosed = false, aeLastRec = null, aeByRec = false;
function recStart() { aeRec.start(); recClosed = false; updateAEButtons(); toast('开始记录 AE 时间轴'); }
function aeActive() { return !!aeRec.rec && !recClosed; }
function aeStop() { const r = aeRec.rec; recClosed = true; updateAEButtons(); if (r && r.frames > 1) aeLastRec = r; return r && r.frames > 1 ? r : null; }
async function aeStopAndExport() { const r = aeStop(); if (!r) { toast('没有记录到内容'); return null; } return doExportAE(true, r); }
const curRec = () => aeActive() ? aeRec.rec : aeLastRec;
function updateAEButtons() { const b = document.getElementById('btn_aeToggle'); if (!b) return; b.textContent = aeActive() ? `■ 停止并导出（${((now() - (aeRec.rec.t0 || now())) / 1000).toFixed(1)}s）` : '● 开始记录'; b.classList.toggle('on', aeActive()); }
async function doExportH5() { try { return await exportH5PlayableFromPage({ toolId: APP_ID, S, stripDataUrls: [], status, toast }); } catch (e) { status('H5 导出失败：' + e.message); console.error(e); return null; } }
const PANEL_ACTIONS = { aeToggle: () => aeActive() ? aeStopAndExport() : recStart(), aeExport: () => doExportAE(), exportH5: () => doExportH5() };
function recTailDone(t) { if (!G) return false; const e = G.winT ?? failShowT(); return e != null && (G.t - e) * 1000 > (S.endCard ? S.endDelay + 400 : 0) + Math.max(800, S.tailSec * 1000); }
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.textContent = `⬇ ${name} (${(blob.size / 1e6).toFixed(1)}MB)`; document.getElementById('recList').prepend(a); a.click(); }
async function doExportAE(save = true, r0 = curRec()) {
  if (!r0) { toast('请先用“● 开始记录”记录一段（自动通关或手动游玩）'); return null; }
  status('正在生成 AE 工程…'); const r = await aeRec.exportZip(r0); window.__aeLast = r;
  if (save) download(r.blob, r.name); status(`AE 工程：${r.stats.layers} 图层，${r.stats.keys} 关键帧`); return r;
}

// ---------- 主循环 ----------
function loop() {
  updateCursor();
  if (window.__vclock != null) { requestAnimationFrame(loop); return; }
  const t = now(); step(t); updPress(t); draw(t);
  if (aeActive()) { if (recTailDone(t)) aeStop(); else aeRec.sample(t); if (t - (loop.aeBtnT || 0) > 250) { loop.aeBtnT = t; updateAEButtons(); } }
  const ri = document.getElementById('recInfo'); if (ri) ri.textContent = rec ? `录制中 ${((t - recT0) / 1000).toFixed(1)}s` : '';
  requestAnimationFrame(loop);
}

// ---------- 设置面板 ----------
const NEWGAME_KEYS = /^(canvas|timerSec|pinLayout|boxSeq|slotsPerBox|grid|plank|pinR$|col_|box[XYW]|boxHt|boxInner|slotR|stone|gravity|physIters|prewarm|lid|charX)/;
function applyChange(k) {
  if (k === 'h5DeviceW' || k === 'h5DeviceH') markH5DeviceCustomIfSizeEdited(S);
  if (k === 'h5Device' || k === 'h5DeviceW' || k === 'h5DeviceH') { try { if (window.__h5EditorDeviceFit) window.__h5EditorDeviceFit(); } catch (e) { } }
  saveSettings(S);
  if (/^hand/.test(k)) loadHand();
  if (NEWGAME_KEYS.test(k)) newGame(); else { draw.badge = null; aeSpritesCache = null; if (/^(smoke|skin|hair|cap|brim|shorts)/.test(k)) { } }
}
function loadHand() {
  aeSpritesCache = null;
  if (!S.handImage) { if (S.handGlove) { if (!glove) glove = A.gloveCanvas(); hand.img = glove.c; } else hand.img = null; return; }
  const im = new Image(); im.onload = () => { hand.img = im; aeSpritesCache = null; }; im.onerror = () => { hand.img = null; }; im.src = S.handImage;
}
function buildPanel() {
  const body = document.getElementById('panelBody'); if (!body) return;
  const openTitles = new Set([...body.querySelectorAll('details[open] summary')].map(s => s.textContent));
  body.innerHTML = '';
  GROUPS.forEach(([title, items], gi) => {
    const det = document.createElement('details'); if (gi < 1 || openTitles.has(title)) det.open = true; det.innerHTML = `<summary>${title}</summary>`;
    items.forEach(([k, label, type, def, a, b, step2]) => {
      const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<label title="${k}">${label}</label>`;
      if (type === 'range') {
        const r = document.createElement('input'); r.type = 'range'; r.min = a; r.max = b; r.step = step2; r.value = S[k]; r.id = 'rng_' + k;
        const n = document.createElement('input'); n.type = 'number'; n.className = 'val'; n.step = step2; n.value = S[k];
        r.oninput = () => { S[k] = +r.value; n.value = r.value; applyChange(k); }; n.onchange = () => { S[k] = +n.value; r.value = n.value; applyChange(k); };
        row.append(r, n);
      } else if (type === 'color') { const c = document.createElement('input'); c.type = 'color'; c.value = S[k]; c.oninput = () => { S[k] = c.value; applyChange(k); }; row.append(c); }
      else if (type === 'bool') { row.classList.add('t-switch'); const l = document.createElement('label'); l.className = 'switch'; l.innerHTML = `<input type="checkbox" class="switch-input" id="chk_${k}" ${S[k] ? 'checked' : ''}><span class="slider"></span>`; l.querySelector('input').onchange = e => { S[k] = e.target.checked; applyChange(k); }; row.append(l); }
      else if (type === 'select') { const s = document.createElement('select'); s.id = 'sel_' + k; a.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.append(o); }); s.value = S[k]; s.onchange = () => { S[k] = s.value; if (k === 'h5Device') { applyH5DevicePresetToSettings(S); buildPanel(); } applyChange(k); }; row.append(s); }
      else if (type === 'text') { const t = document.createElement('input'); t.type = 'text'; t.value = S[k]; t.id = 'txt_' + k; t.onchange = () => { S[k] = t.value; applyChange(k); }; row.append(t); }
      else if (type === 'textarea') { const t = document.createElement('textarea'); t.rows = Math.max(2, String(S[k]).split('\n').length); t.value = S[k]; t.id = 'txt_' + k; t.style.fontFamily = k === 'pinLayout' ? 'monospace' : ''; t.onchange = () => { S[k] = t.value; applyChange(k); }; row.append(t); }
      else if (type === 'button') { const bt = document.createElement('button'); bt.id = 'btn' + k; bt.textContent = a; bt.onclick = () => Promise.resolve(PANEL_ACTIONS[def] && PANEL_ACTIONS[def]()).catch(e => { status('导出失败：' + e.message); console.error(e); }); row.append(bt); }
      else if (type === 'file') {
        const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/png,image/webp,image/jpeg,image/*'; f.id = 'file_' + k;
        f.onchange = () => { const file = f.files[0]; if (!file) return; const fr = new FileReader(); fr.onload = () => { S[k] = fr.result; applyChange(k); }; fr.readAsDataURL(file); };
        const x = document.createElement('button'); x.textContent = k === 'handImage' ? '清除已上传手指（用内置手套）' : '清除'; if (k === 'handImage') x.id = 'btnClearHand'; x.onclick = () => { S[k] = ''; f.value = ''; applyChange(k); };
        row.append(f, x);
      }
      det.append(row);
    });
    if (title.startsWith('手指')) det.insertAdjacentHTML('beforeend', '<div class="tip">默认手指 = 程序绘制的白手套（参考视频同款造型）。上传透明背景 PNG 可替换，用锚点 X/Y 标定指尖位置。自动通关会按当前目标盒颜色逐个点钉子；录制不会随自动通关自动开始（除非打开“自动录制”）。</div>');
    if (title.startsWith('导出 H5')) det.insertAdjacentHTML('beforeend', '<div class="tip">试玩由玩家自己玩：导出包不含手指、默认不自动演示。预览与导出均按所选机型/自定义尺寸；选「自适应」才是全机型 contain/letterbox。</div>');
    if (title.startsWith('画布')) det.insertAdjacentHTML('beforeend', '<div class="tip">点和当前目标盒同色的钉子 → 钉子飞进盒子；装满换下一个盒子。木板失去钉子后按物理摆动 / 掉落，石头随之流下。倒计时到 0：压板塌下、小人被压、FAIL。</div>');
    body.append(det);
  });
}
let toastT = 0;
function toast(t, dur = 1600) { const el = document.getElementById('toast'); if (!el) return; el.textContent = t; el.classList.add('show'); clearTimeout(toastT); if (dur > 0) toastT = setTimeout(() => el.classList.remove('show'), dur); }
const $ = id => document.getElementById(id) || {};
$('btnAuto').onclick = autoSolve;
$('btnNew').onclick = newGame;
$('btnRec').onclick = () => rec ? stopRec() : startRec();
$('btnShot').onclick = () => { const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'pin-rescue_shot.png'; a.click(); };
$('btnExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJSON(S)], { type: 'application/json' })); a.download = 'pin-rescue-tool-settings.json'; a.click(); };
$('btnImport').onclick = () => document.getElementById('importFile').click();
$('importFile').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { const j = JSON.parse(t); S = migrate(j); saveSettings(S); buildPanel(); loadHand(); newGame(); toast('已导入设置'); }).catch(() => toast('导入失败')); };
$('btnReset').onclick = () => { if (!confirm('恢复全部默认设置？')) return; S = { ...DEFS }; saveSettings(S); buildPanel(); loadHand(); newGame(); };
{ const v = document.getElementById('ver'); if (v) v.textContent = 'v' + APP_VERSION; }
const __h5 = applyPlayableMode({
  applySettings: ps => { Object.assign(S, migrate({ version: 1, settings: { ...S, ...ps } })); },
  autoPlay: () => { try { autoSolve(); } catch (e) { } },
  state: () => { try { return G.pins.filter(p => p.alive).length + '|' + G.flying.length + '|' + G.shakes.length + '|' + G.box.reserved; } catch (e) { return ''; } },
  isEnded: () => { try { return ended(); } catch (e) { return false; } },
  onResize: () => { },
});
if (__h5) { try { const panel = document.getElementById('panel'); if (panel) panel.style.display = 'none'; } catch (e) { } }
if (!__h5) bindEditorDevicePreview(() => S);
window.__game = {
  renderAt: t => { window.__vclock = t; step(t); updPress(t); if (!window.__nodraw) draw(t); else draw.blur = blurAmt(); if (aeActive()) aeRec.sample(t); },
  get G() { return G; }, get S() { return S; }, get view() { return view; }, get hand() { return hand; },
  autoSolve, newGame, tapAt, planTap, frameItems: () => frameItems(now()), get autoRunning() { return autoRunning; }, charPose,
  set(k, v) { S[k] = v; applyChange(k); buildPanel(); }, setMany(o) { Object.assign(S, o); saveSettings(S); buildPanel(); loadHand(); newGame(); },
  doExportAE, doExportH5, aeStart: () => recStart(), aeStop: () => aeStop(), aeActive: () => aeActive(), startRec, stopRec, get mediaRec() { return rec; }, migrate, APP_ID, APP_VERSION, glove: () => glove,
};
buildPanel(); loadHand(); newGame(); window.__ready = true; requestAnimationFrame(loop);
