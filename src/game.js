// 拔钉救人 —— 游戏逻辑 + planck.js 2D 物理（石头 / 木板 / 钉子 / 压板 / 支撑杆）
// 坐标：设计像素 720×1280，y 向下；物理世界 1 米 = PX 像素。
import * as planck from 'planck';
export const DW = 720, DH = 1280, PX = 30;
const V = (x, y) => planck.Vec2(x / PX, y / PX);
export const COLOR_KEYS = ['M', 'R', 'L', 'G', 'P', 'B', 'Y', 'O', 'W'];
export const COLOR_NAMES = { M: '品红', R: '红', L: '黄绿', G: '绿', P: '紫', B: '蓝', Y: '黄', O: '橙', W: '白' };
// 场景固定几何（按参考 1.5 秒帧量取，720×1280）
export const GEO = {
  wallL: 28, wallR: 692,
  pivot: { x: 665, y: 208 }, lidLeft: 452, lidRight: 26, lidThick: 46, lidLower: { x0: 120, h: 38 },
  propPin: { x: 378, y: 563 }, propW: 26, propAt: 236,
  roomFloor: 580, housingX: 320,
};
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function parseLayout(S) {
  const rows = String(S.pinLayout || '').split(/\r?\n/).map(r => r.trim().toUpperCase()).filter(r => r.length);
  return rows.map(r => [...r].map(ch => COLOR_KEYS.includes(ch) ? ch : null));
}
export function parseSeq(S) { return String(S.boxSeq || '').toUpperCase().split(/[,，\s]+/).filter(c => COLOR_KEYS.includes(c)); }
export function parseTimes(str) { return String(str || '').split(/[,，\s]+/).map(Number).filter(x => isFinite(x) && x > 0); }
const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
const easeIO = t => { t = clamp01(t); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = t => Math.pow(clamp01(t), 2);
export function slotPos(S, i) { const n = S.slotsPerBox, sp = Math.min(52, (S.boxW - 2 * S.slotR - 16) / Math.max(1, n - 1)); return { x: S.boxX + (i - (n - 1) / 2) * sp, y: S.boxY }; }

export class Game {
  constructor(S) {
    this.S = S; this.t = 0; this.events = []; this.state = 'play'; this.rng = mulberry(12345);
    this.world = new planck.World({ gravity: planck.Vec2(0, S.gravity / PX) });
    this.layout = parseLayout(S); this.seq = parseSeq(S); if (!this.seq.length) this.seq = ['R'];
    this.boxIdx = 0; this.box = { color: this.seq[0], filled: [], reserved: 0, phase: 'idle', t0: -9, scale: 1 };
    this.flying = []; this.stones = []; this.pins = []; this.planks = []; this.nextId = 1; this.failT = null; this.winT = null; this.shakes = [];
    this.sagTimes = parseTimes(S.lidSagTimes); this.lidAng = S.lidStartDeg * Math.PI / 180; this.woodCool = 0; this.lastTick = -1;
    this.buildStatic(); this.buildGrid(); this.buildLid(); this.fillStones();
    this.world.on('pre-solve', c => {
      const a = c.getFixtureA().getBody().getUserData(), b = c.getFixtureB().getBody().getUserData();
      if (a && b && a.kind === 'plank' && b.kind === 'plank') { const m = this.S.plankCollide; if (m === 'none' || a.nodes.some(n => b.nodes.includes(n)) || (m === 'hanging' && (a.free || b.free))) c.setEnabled(false); }
      if (a && b && this.S.freeFall && ((a.kind === 'plank' && a.free && b.kind === 'pin') || (b.kind === 'plank' && b.free && a.kind === 'pin'))) c.setEnabled(false);
      if (a && b && ((a.kind === 'plank' && b.kind === 'pin') || (a.kind === 'pin' && b.kind === 'plank'))) { const pk = a.kind === 'plank' ? a : b, pn = a.kind === 'pin' ? a : b; if (pk.nodes.includes(pn.id)) c.setEnabled(false); }
    });
    this.world.on('post-solve', (c, imp) => {
      const a = c.getFixtureA().getBody().getUserData(), b = c.getFixtureB().getBody().getUserData();
      if (this.woodCool > 0 || !imp) return; const ni = imp.normalImpulses ? imp.normalImpulses[0] : 0;
      if (((a && a.kind === 'plank') || (b && b.kind === 'plank')) && ni > this.S.woodImpulse && !(a && a.kind === 'stone' && b && b.kind === 'stone')) { this.events.push({ type: 'wood', v: Math.min(1, ni / 8) }); this.woodCool = 0.22; }
    });
    // 预先沉降（石堆自然堆积；不推进时间轴）
    const steps = Math.round(S.prewarm * 60); for (let i = 0; i < steps; i++) this.physStep(1 / 60, true);
    this.events.length = 0;
  }
  // ---------- 搭建 ----------
  buildStatic() {
    const S = this.S, w = this.world, g = this.ground = w.createBody(); g.setUserData({ kind: 'wall' });
    const fx = (shape) => g.createFixture(shape, { friction: 0.4 });
    fx(planck.Edge(V(GEO.wallL, -2000), V(GEO.wallL, DH + 400)));
    fx(planck.Edge(V(GEO.wallR, -2000), V(GEO.wallR, DH + 400)));
    // 盒子底座（房间地面以下、木板格子以上，石头进不去）
    const hx = GEO.housingX, top = GEO.roomFloor, bot = Math.min(S.gridY0 - S.plankH / 2 + 2, 712);
    fx(planck.Polygon([V(hx, bot), V(hx, top + 18), V(hx + 25, top), V(GEO.wallR, top), V(GEO.wallR, bot)]));
    // 支撑杆底部的灰色铁钉
    fx(planck.Circle(V(GEO.propPin.x, GEO.propPin.y), 17 / PX));
    // 压板右侧铰链三角支架
    fx(planck.Polygon([V(GEO.wallR, GEO.pivot.y - 48), V(GEO.wallR, GEO.pivot.y + 40), V(GEO.pivot.x - 22, GEO.pivot.y)]));
  }
  buildGrid() {
    const S = this.S, L = this.layout, nodeAt = {};
    L.forEach((row, r) => row.forEach((c, k) => {
      if (!c) return; const x = S.gridX0 + k * S.gridDX, y = S.gridY0 + r * S.gridDY;
      const b = this.world.createBody({ type: 'static', position: V(x, y) }); b.setUserData({ kind: 'pin', id: this.nextId });
      b.createFixture(planck.Circle(S.pinR / PX), { friction: 0.3 });
      const p = { id: this.nextId++, r, k, c, x, y, body: b, planks: [], alive: true }; this.pins.push(p); nodeAt[r + ',' + k] = p;
    }));
    const mk = (r0, k0, r1, k1, hor) => {
      const a = nodeAt[r0 + ',' + k0], b = nodeAt[r1 + ',' + k1]; if (!a || !b) return;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x), th = (hor ? S.plankH : S.plankV) / 2;
      // 两端都有钉子时木板是静态的（被两颗钉子钉死，不会动；避免几百颗石头压在关节上时数值漂移）；
      // 只剩一颗钉子 → 动态刚体 + 绕该钉子的转动关节（摆动）；一颗都没有 → 自由落体
      const body = this.world.createBody({ type: 'static', position: V(cx, cy), angle: ang, angularDamping: S.plankDamp, linearDamping: 0.05 });
      const opt = { density: S.plankDensity, friction: S.plankFriction, restitution: 0.05 };
      body.createFixture(planck.Box(len / 2 / PX, th / PX), opt);
      body.createFixture(planck.Circle(V(-len / 2, 0), th / PX), opt); body.createFixture(planck.Circle(V(len / 2, 0), th / PX), opt);
      const pk = { id: this.nextId++, hor, len, th, body, nodes: [a.id, b.id], pins: [a, b], joint: null, kind: 'plank', seed: (r0 * 13 + k0 * 7 + (hor ? 1 : 0)) }; body.setUserData(pk); this.planks.push(pk);
      a.planks.push(pk); b.planks.push(pk);
    };
    // 先竖后横：横木板画在竖木板上面（参考）
    if (S.plankVOn) for (let r = 0; r < L.length - 1; r++) for (let k = 0; k < 20; k++) mk(r, k, r + 1, k, false);
    if (S.plankHOn) for (let r = 0; r < L.length; r++) for (let k = 0; k < 19; k++) mk(r, k, r, k + 1, true);
  }
  buildLid() {
    const P = GEO.pivot;
    this.lid = this.world.createBody({ type: 'kinematic', position: V(P.x, P.y), angle: -this.lidAng }); this.lid.setUserData({ kind: 'lid' });
    const hl = (GEO.lidLeft + GEO.lidRight) / 2, cx = (GEO.lidRight - GEO.lidLeft) / 2;
    this.lid.createFixture(planck.Box(hl / PX, GEO.lidThick / 2 / PX, V(cx, 0), 0), { friction: 0.5 });
    const lb = GEO.lidLower, lw = GEO.lidLeft + GEO.lidRight - lb.x0 - 30; this.lid.createFixture(planck.Box(lw / 2 / PX, lb.h / 2 / PX, V(-GEO.lidLeft + lb.x0 + lw / 2, GEO.lidThick / 2 + lb.h / 2), 0), { friction: 0.5 });
    const c = this.propTop(this.lidAng), B = GEO.propPin; this.propLen = Math.hypot(c.x - B.x, c.y - B.y);
    this.prop = this.world.createBody({ type: 'kinematic', position: V(B.x, B.y), angle: Math.atan2(c.y - B.y, c.x - B.x) }); this.prop.setUserData({ kind: 'prop' });
    this.prop.createFixture(planck.Box(this.propLen / 2 / PX, GEO.propW / 2 / PX, V(this.propLen / 2, 0), 0), { friction: 0.5, density: 1 });
  }
  propTop(th) { const P = GEO.pivot, d = GEO.propAt, h = GEO.lidThick / 2 + GEO.lidLower.h + 8; return { x: P.x - d * Math.cos(th) + h * Math.sin(th), y: P.y + d * Math.sin(th) + h * Math.cos(th) }; }
  lidTopY(x, th) { const P = GEO.pivot; return P.y + (P.x - x) * Math.tan(th) - GEO.lidThick / 2 / Math.cos(th); }
  inRoom(x, y, m) { // 房间（压板下方、支撑杆右侧）+ 压板本体：开局不放石头
    const th = this.lidAng, P = GEO.pivot, B = GEO.propPin, c = this.propTop(th);
    const dx = P.x - x, along = dx * Math.cos(th) - (y - P.y) * Math.sin(th) * -1; // 近似
    const ly = P.y + dx * Math.tan(th); // 压板中线
    if (x > P.x - GEO.lidLeft - m && x < GEO.wallR + 5 && Math.abs(y - ly) < GEO.lidThick / 2 + m) return true;
    const px = B.x + (c.x - B.x) * (y - B.y) / (c.y - B.y);
    if (y > ly && y < GEO.roomFloor + 30 && x > px - m - GEO.propW / 2) return true;
    if (x > GEO.housingX - m && y > GEO.roomFloor - m) return true;
    return false;
  }
  addStone(x, y) {
    const S = this.S, rr = S.stoneR * (1 + (this.rng() * 2 - 1) * S.stoneSizeVar);
    const b = this.world.createBody({ type: 'dynamic', position: V(x, y), angle: this.rng() * 6.28, linearDamping: 0.05, angularDamping: 0.3 });
    b.createFixture(planck.Circle(rr / PX), { density: 1, friction: S.stoneFriction, restitution: S.stoneBounce });
    const st = { id: this.nextId++, kind: 'stone', body: b, r: rr, v: Math.floor(this.rng() * 1e6) }; b.setUserData(st); this.stones.push(st); return st;
  }
  fillStones() {
    const S = this.S, r = S.stoneR, d = 2 * r / Math.sqrt(S.stoneFill), h = d * 0.866; let row = 0;
    for (let y = GEO.roomFloor + 125; y > -r * 4; y -= h, row++) for (let x = GEO.wallL + r + (row % 2) * d / 2; x < GEO.wallR - r; x += d) {
      if (y > S.gridY0 - S.plankH / 2 - r) continue;
      if (this.inRoom(x, y, r)) continue;
      if (this.stones.length >= S.stoneMax) return;
      this.addStone(x + (this.rng() - 0.5) * 2, y);
    }
    this.targetUpper = this.stones.length;
  }
  // ---------- 推进 ----------
  lidTarget(t) {
    const S = this.S, d2r = Math.PI / 180, rest = S.lidRestDeg * d2r;
    if (this.failT != null) { const u = easeIn((t - this.failT) / S.lidFallDur); return this.failAng0 + (S.lidFallDeg * d2r - this.failAng0) * u; }
    let a = S.lidStartDeg * d2r + (rest - S.lidStartDeg * d2r) * easeOut(t / S.lidPushDur);
    a += S.lidCreep * d2r * clamp01(t / S.timerSec);
    for (const ts of this.sagTimes) { const u = (t - ts) / S.lidSagDur; if (u > 0 && u < 1) a += S.lidSagDeg * d2r * Math.sin(Math.PI * u) * (u < 0.5 ? 1 : 1); }
    a += Math.sin(t * 9) * 0.0035; // 用力时的细微抖动
    return a;
  }
  physStep(h, pre) {
    const S = this.S, t = this.t;
    if (!pre) {
      const target = this.lidTarget(t + h), cur = this.lidAng; this.lidAng = target;
      this.lid.setAngularVelocity(-(target - cur) / h);
      if (this.prop.getType() === 'kinematic') {
        const c = this.propTop(target), B = GEO.propPin, a1 = Math.atan2(c.y - B.y, c.x - B.x), a0 = this.prop.getAngle();
        this.prop.setAngularVelocity((a1 - a0) / h);
      }
    } else { this.lid.setAngularVelocity(0); this.prop.setAngularVelocity(0); }
    this.world.step(h, S.physIters, Math.max(2, S.physIters >> 1));
    if (pre) { this.lid.setTransform(this.lid.getPosition(), -this.lidAng); }
    // 出界的石头 / 木板删除
    for (let i = this.stones.length - 1; i >= 0; i--) { const st = this.stones[i], p = st.body.getPosition(); if (p.y * PX > DH + 80 || p.x * PX < -80 || p.x * PX > DW + 80) { this.world.destroyBody(st.body); this.stones.splice(i, 1); } }
    for (let i = this.planks.length - 1; i >= 0; i--) { const pk = this.planks[i], p = pk.body.getPosition(); if (p.y * PX > DH + 200) { this.world.destroyBody(pk.body); this.planks.splice(i, 1); } }
    // 顶部持续补充
    if (S.stonePour && !pre) {
      let upper = 0; for (const st of this.stones) if (st.body.getPosition().y * PX < GEO.roomFloor) upper++;
      this.pourAcc = (this.pourAcc || 0) + S.stonePourRate * h;
      while (this.pourAcc >= 1 && upper < this.targetUpper && this.stones.length < S.stoneMax) { this.pourAcc -= 1; upper++; this.addStone(GEO.wallL + S.stoneR + this.rng() * (GEO.wallR - GEO.wallL - 2 * S.stoneR), -S.stoneR * 3 - this.rng() * 60); }
      if (this.pourAcc > 3) this.pourAcc = 3;
    }
  }
  update(dt) {
    const S = this.S; this.woodCool -= dt;
    this.physStep(dt, false); this.t += dt; const t = this.t;
    // 倒计时
    if (this.state === 'play') {
      const rem = S.timerSec - t;
      if (rem <= 5 && rem > 0 && Math.ceil(rem) !== this.lastTick) { this.lastTick = Math.ceil(rem); this.events.push({ type: 'tick' }); }
      if (rem <= 0) this.fail();
    }
    // 飞行中的钉子
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i], u = (t - f.t0) / S.flyDur;
      if (u >= 1) { this.flying.splice(i, 1); if (f.discard) continue; this.box.filled.push({ c: f.c, slot: f.slot, rot: f.rot, t: t }); this.events.push({ type: 'slot', pin: f }); if (this.box.filled.length >= S.slotsPerBox) { this.box.phase = 'full'; this.box.t0 = t; this.events.push({ type: 'boxfull', color: this.box.color }); } }
    }
    // 盒子：填满 → 停顿 → 闪光 → 缩小消失 → 新盒弹出
    const bx = this.box, pt = t - bx.t0;
    if (bx.phase === 'full' && pt >= S.boxFxDelay) { bx.phase = 'fx'; bx.t0 = t; this.events.push({ type: 'chime' }); }
    else if (bx.phase === 'fx' && pt >= S.boxFxDur) { bx.phase = 'out'; bx.t0 = t; }
    else if (bx.phase === 'out' && pt >= S.boxOutDur) {
      this.boxIdx++;
      if (this.boxIdx >= this.seq.length) { bx.phase = 'gone'; if (S.winRule === 'boxes' && this.state === 'play') this.win(); }
      else { bx.color = this.seq[this.boxIdx]; bx.filled = []; bx.reserved = 0; bx.phase = 'in'; bx.t0 = t; }
    } else if (bx.phase === 'in' && pt >= S.boxInDur) { bx.phase = 'idle'; }
    for (let i = this.shakes.length - 1; i >= 0; i--) if (t - this.shakes[i].t0 > 0.4) this.shakes.splice(i, 1);
  }
  boxScale() {
    const S = this.S, bx = this.box, pt = this.t - bx.t0;
    if (bx.phase === 'out') return 1 - easeIn(pt / S.boxOutDur) * 0.92;
    if (bx.phase === 'gone') return 0;
    if (bx.phase === 'in') { const u = clamp01(pt / S.boxInDur), c1 = 2.2, c3 = c1 + 1; return 0.08 + 0.92 * (1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2)); }
    return 1;
  }
  pinAt(x, y) { let best = null, bd = 1e9; for (const p of this.pins) if (p.alive) { const d = Math.hypot(p.x - x, p.y - y); if (d < this.S.pinHitR && d < bd) { bd = d; best = p; } } return best; }
  canTake(c) { const bx = this.box; return this.state === 'play' && (bx.phase === 'idle' || bx.phase === 'in') && bx.color === c && bx.reserved < this.S.slotsPerBox; }
  tap(x, y) {
    if (this.state !== 'play') return null; const p = this.pinAt(x, y); if (!p) return null;
    if (this.canTake(p.c)) { this.pull(p, false); return { ok: true, pin: p }; }
    if (this.S.wrongTap === 'discard') { this.pull(p, true); return { ok: true, pin: p, discard: true }; }
    if (this.S.wrongTap === 'shake') { this.shakes.push({ pin: p, t0: this.t }); this.events.push({ type: 'wrong' }); }
    return { ok: false, pin: p };
  }
  pull(p, discard) {
    p.alive = false; this.world.destroyBody(p.body);
    for (const pk of p.planks) this.updatePlank(pk);
    const slot = discard ? -1 : this.box.reserved++;
    const to = discard ? { x: p.x < DW / 2 ? -60 : DW + 60, y: p.y - 300 } : slotPos(this.S, slot);
    this.flying.push({ id: p.id, c: p.c, x0: p.x, y0: p.y, to, slot, t0: this.t, discard, rot: (this.rng() - 0.5) * 1.2 });
    this.events.push({ type: 'pop', pin: p });
  }
  updatePlank(pk) {
    const live = pk.pins.filter(q => q.alive);
    if (pk.joint) { try { this.world.destroyJoint(pk.joint); } catch (e) { } pk.joint = null; }
    pk.free = live.length === 0;
    if (live.length >= 2) { pk.body.setType('static'); return; }
    pk.body.setType('dynamic'); pk.body.setAwake(true);
    if (live.length === 1) { const q = live[0]; pk.joint = this.world.createJoint(planck.RevoluteJoint({}, q.body, pk.body, V(q.x, q.y))); }
  }
  flyPos(f) { // 先原地弹起（露出钉身、略放大），再抛物线飞向孔位
    const S = this.S, u = clamp01((this.t - f.t0) / S.flyDur), up = S.flyPop, lift = S.pinR * 1.4;
    if (u < up) { const v = easeOut(u / up); return { x: f.x0, y: f.y0 - lift * v, s: 1 + (S.flyScale - 1) * v, shank: v, rot: f.rot * v * 0.4 }; }
    const v = easeIO((u - up) / (1 - up)), x0 = f.x0, y0 = f.y0 - lift, x1 = f.to.x, y1 = f.to.y - S.pinR * 0.9 * (1 - v) * 0;
    const cy = Math.min(y0, y1) - S.flyArc;
    const x = (1 - v) * (1 - v) * x0 + 2 * (1 - v) * v * (x0 + x1) / 2 + v * v * x1, y = (1 - v) * (1 - v) * y0 + 2 * (1 - v) * v * cy + v * v * y1;
    return { x, y, s: S.flyScale + (1 - S.flyScale) * easeIn(v), shank: 1 - easeIn(v), rot: f.rot * (0.4 + 0.6 * v) };
  }
  fail() {
    if (this.state !== 'play') return; this.state = 'fail'; this.failT = this.t; this.failAng0 = this.lidAng;
    this.prop.setType('dynamic'); this.prop.setAngularVelocity(1.5); this.prop.setLinearVelocity(planck.Vec2(2, 0)); this.prop.setAwake(true);
    for (const st of this.stones) st.body.setAwake(true);
    this.events.push({ type: 'crush' });
  }
  win() { this.state = 'win'; this.winT = this.t; this.events.push({ type: 'win' }); }
  remaining() { return Math.max(0, this.S.timerSec - (this.failT ?? this.winT ?? this.t)); }
  shownSec() { const r = this.remaining(); return r <= 0 ? 0 : Math.ceil(r + this.S.timerShowOffset - 1e-6); }
  stoneMotion() { let s = 0, n = 0; for (let i = 0; i < this.stones.length; i += 4) { const v = this.stones[i].body.getLinearVelocity(); s += Math.hypot(v.x, v.y); n++; } return n ? s / n * PX : 0; }
  // 自动通关：当前盒颜色可拔的钉子
  candidates() { return this.pins.filter(p => p.alive && this.canTake(p.c)); }
}
