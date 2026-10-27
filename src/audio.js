// WebAudio 程序化音效（无版权素材）：拔钉“啵”、入孔咔哒、盒满叮咚、颜色不对、木板撞击、石头哗啦循环、滴答、压塌、失败、胜利。所有输出接 master，可送往录制流。
export const SFX_NAMES = { pop: ['sfxPop', '拔钉'], slot: ['sfxSlot', '入孔'], chime: ['sfxChime', '填满'], wrong: ['sfxWrong', '颜色不对'], wood: ['sfxWood', '木板'], tick: ['sfxTick', '滴答'], crush: ['sfxCrush', '压塌'], fail: ['sfxFail', '失败'], win: ['sfxWin', '胜利'] };
export const SFX_DUR = { pop: 0.2, slot: 0.15, chime: 0.9, wrong: 0.25, wood: 0.2, tick: 0.08, crush: 1.2, fail: 1.3, win: 1.2 };
export class Sfx {
  constructor() { this.ctx = null; this.rollG = null; }
  ensure() {
    if (this.ctx) return this.ctx;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    try { this.ctx = new C(); } catch (e) { return null; }
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    try { this.recDest = this.ctx.createMediaStreamDestination(); this.master.connect(this.recDest); } catch (e) { }
    this.makeNoise(); return this.ctx;
  }
  makeNoise() { const len = Math.round(this.ctx.sampleRate * 2), b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0); let s = 7, last = 0; for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; const w = s / 1073741823.5 - 1; d[i] = w; } this.noise = b;
    const bb = this.ctx.createBuffer(1, len, this.ctx.sampleRate), e = bb.getChannelData(0); for (let i = 0; i < len; i++) { last = (last + 0.02 * d[i]) / 1.02; e[i] = last * 3.5; } this.brown = bb; }
  now() { return this._t != null ? this._t : this.ctx.currentTime; }
  resume() { const c = this.ensure(); if (c && c.state === 'suspended') c.resume(); }
  play(name, S, o = {}) {
    const [k] = SFX_NAMES[name] || []; if (!k || S.sfxMute || !S[k]) return;
    if (this.hook && this._t == null) try { this.hook(name, o); } catch (e) { }
    if (!this.ensure()) return;
    const v = S.sfxVolume * (S[k + 'Vol'] ?? 1); if (v <= 0) return;
    this['_' + name](this.now(), v, o);
  }
  // 滚动循环：每帧按球链速度设置音量
  roll(S, level) {
    if (!this.ctx || this._t != null) return;
    if (!this.rollG) { const src = this.ctx.createBufferSource(); src.buffer = this.brown; src.loop = true; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; const g = this.ctx.createGain(); g.gain.value = 0; const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(); lfo.frequency.value = 13; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(g.gain); src.connect(f); f.connect(g); g.connect(this.master); src.start(); lfo.start(); this.rollG = g; }
    const v = S.sfxMute || !S.sfxStone ? 0 : S.sfxVolume * S.sfxStoneVol * 0.35 * Math.min(1, level);
    this.rollG.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08);
  }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  osc(t, type, f0, f1, dur, vol, a = 0.004) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur); this.env(g, t, a, vol, dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + a + dur + 0.05); }
  nz(t, type, f0, f1, q, dur, vol, a = 0.004) { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q; const g = c.createGain(); this.env(g, t, a, vol, dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 1.2); s.stop(t + a + dur + 0.05); }
  _pop(t, v) { this.osc(t, 'sine', 420, 980, 0.07, v * 0.5, 0.002); this.osc(t + 0.05, 'triangle', 900, 1300, 0.08, v * 0.25); this.nz(t, 'bandpass', 3000, 1500, 3, 0.05, v * 0.25, 0.001); }
  _slot(t, v) { this.osc(t, 'triangle', 1400, 700, 0.05, v * 0.3); this.nz(t, 'bandpass', 2600, 1400, 4, 0.05, v * 0.35); this.osc(t, 'sine', 180, 90, 0.08, v * 0.3); }
  _chime(t, v) { [1047, 1319, 1568, 2093].forEach((f, i) => { this.osc(t + i * 0.06, 'sine', f, f, 0.5, v * 0.18, 0.004); this.osc(t + i * 0.06, 'triangle', f * 2, f * 2, 0.2, v * 0.04, 0.004); }); this.nz(t, 'highpass', 6000, 9000, 1, 0.4, v * 0.12, 0.01); }
  _wrong(t, v) { this.osc(t, 'square', 180, 150, 0.09, v * 0.12); this.osc(t + 0.1, 'square', 150, 120, 0.1, v * 0.12); }
  _wood(t, v, o) { const k = 0.6 + (o.v || 0.5) * 0.6; this.osc(t, 'triangle', 240 * k, 120, 0.09, v * 0.35 * k); this.nz(t, 'bandpass', 900, 500, 2.5, 0.07, v * 0.45 * k, 0.001); }
  _tick(t, v) { this.osc(t, 'square', 2200, 2200, 0.02, v * 0.12, 0.001); this.nz(t, 'highpass', 4000, 4000, 1, 0.02, v * 0.1, 0.001); }
  _crush(t, v) { this.nz(t, 'lowpass', 1200, 120, 1, 0.9, v * 0.8, 0.005); this.osc(t, 'sine', 110, 40, 0.6, v * 0.7); for (let i = 0; i < 8; i++) this.nz(t + i * 0.05, 'bandpass', 1500 + i * 200, 600, 2, 0.08, v * 0.25, 0.002); }
  _fail(t, v) { [392, 330, 262, 196].forEach((f, i) => { this.osc(t + i * 0.16, 'square', f, f * 0.98, 0.3, v * 0.12, 0.01); this.osc(t + i * 0.16, 'sawtooth', f / 2, f / 2, 0.32, v * 0.08, 0.01); }); this.osc(t + 0.64, 'sine', 120, 60, 0.6, v * 0.5); }
  _win(t, v) { [523, 659, 784, 1047].forEach((f, i) => { this.osc(t + i * 0.1, 'sine', f, f, 0.6, v * 0.22, 0.006); this.osc(t + i * 0.1, 'triangle', f * 2, f * 2, 0.25, v * 0.05, 0.006); }); }
}
export async function renderSfxOffline(events, dur, S) {
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!C) return null;
  const sr = 44100, oc = new C(1, Math.max(1, Math.ceil(sr * dur)), sr);
  const x = new Sfx(); x.ctx = oc; x.master = oc.createGain(); x.master.connect(oc.destination); x.makeNoise();
  const S2 = { ...S, sfxMute: false }; for (const k in SFX_NAMES) S2[SFX_NAMES[k][0]] = true;
  for (const e of events) { x._t = e.t; x.play(e.name, S2, e); }
  return await oc.startRendering();
}
export function encodeWav(buf) {
  const ch = buf.getChannelData(0), n = ch.length, dv = new DataView(new ArrayBuffer(44 + n * 2));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, ch[i])); dv.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Uint8Array(dv.buffer);
}
