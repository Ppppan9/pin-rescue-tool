// 导出 After Effects 工程：逐帧采样 frameItems()（素材 + 中心位置/缩放/旋转/不透明度/层级），
// 每个元素（id + 素材）的每段连续出现 = 一个独立图层；失败时的背景模糊 = 调整图层 + 高斯模糊关键帧。
import { makeZip } from './zip.js';
import JSX_TEXT from './build_ae_project.jsx';
import README_TEXT from './README_AE.md';
import { renderSfxOffline, encodeWav, SFX_NAMES, SFX_DUR } from '../audio.js';
const r3 = v => Math.round(v * 1000) / 1000, r4 = x => Math.round(x * 10000) / 10000;
const LABEL = { background: 15, char: 2, prop: 3, lid: 3, hinge: 15, stone: 6, plank: 3, pin: 1, box: 9, boxpin: 1, boxfx: 11, fly: 1, smoke: 11, title: 15, timer: 9, disclaimer: 15, result: 1, end: 5, ripple: 12, hand: 12, audio: 16 };
const CN = { M: '品红', R: '红', L: '黄绿', G: '绿', P: '紫', B: '蓝', Y: '黄', O: '橙', W: '白' }, EN = { M: 'magenta', R: 'red', L: 'lime', G: 'green', P: 'purple', B: 'blue', Y: 'yellow', O: 'orange', W: 'white' };
export function layerName(id, asset, zh) {
  const k = id.split('_')[0], rest = id.slice(k.length + 1), col = asset && /_([A-Z])$/.test(asset) ? asset.slice(-1) : null, cn = col ? (zh ? CN[col] : EN[col]) : '';
  const T = { background: ['背景', 'Background'], char: ['小人', 'Character'], prop: ['支撑杆', 'Prop'], lid: ['压板', 'Lid'], hinge: ['铰链与铁钉', 'Hinge'], stone: ['石头', 'Stone'], plank: ['木板', 'Plank'], pin: ['钉子', 'Pin'], box: ['目标盒', 'Box'], boxpin: ['盒中钉', 'BoxPin'], boxfx: ['填满闪光', 'BoxFX'], fly: ['飞行钉', 'FlyingPin'], smoke: ['烟雾', 'Smoke'], title: ['标题', 'Title'], timer: ['倒计时', 'Timer'], disclaimer: ['免责声明', 'Disclaimer'], result: ['结果', 'Result'], end: ['结束页', 'EndCard'], ripple: ['点击波纹', 'Ripple'], hand: ['手指', 'Hand'] };
  const base = (T[k] || [k, k])[zh ? 0 : 1];
  if (k === 'char') return base + '_' + ({ char_scared: ['惊恐', 'scared'], char_push: ['推杆', 'push'], char_crush: ['被压', 'crushed'] }[asset] || ['', ''])[zh ? 0 : 1];
  if (k === 'timer') return base + '_' + asset.split('_')[1];
  if (k === 'plank') return `${base}_${asset.endsWith('h') ? (zh ? '横' : 'H') : (zh ? '竖' : 'V')}_${rest}`;
  if (cn) return `${base}_${cn}_${rest}`;
  if (k === 'result') return base + '_' + (rest === 'fail' ? 'FAIL' : (zh ? '胜利' : 'win'));
  return rest ? `${base}_${rest}` : base;
}
const folderOf = a => a.startsWith('stone') ? 'stones' : /^(plank|pin|box)/.test(a) ? 'board' : a.startsWith('char') || a === 'prop' || a === 'lid' ? 'char' : 'ui';
export function createAERecorder(api) {
  let R = null;
  function start() { const E = api.env(); R = { t0: api.now(), lastT: 0, frames: 0, tracks: new Map(), blur: [], sfx: [], S: { ...E.S } }; api.sfx.hook = (name, o) => { if (R) R.sfx.push({ t: Math.max(0, (api.now() - R.t0) / 1000), name, dur: o && o.dur, v: o && o.v }); }; }
  function stop() { const r = R; R = null; return r; }
  function sample(now) {
    if (!R) return; const E = api.env(), f = R.frames, t = Math.max(R.lastT + 1e-4 * (f > 0), (now - R.t0) / 1000);
    for (const it of E.items) {
      if (it.id === 'blur') { R.blur.push([t, r3(it.blur)]); continue; }
      const key = it.id + '|' + it.asset; let tr = R.tracks.get(key);
      if (!tr) { tr = { id: it.id, asset: it.asset, z: it.z, add: !!it.add, s: [], order: R.tracks.size }; R.tracks.set(key, tr); }
      tr.s.push([t, r3(it.x), r3(it.y), r3(it.sc ?? 1), r3(it.rot || 0), r3(it.op ?? 1), f]);
    }
    R.lastT = t; R.frames++;
  }
  async function exportZip(rec = R, So = null) {
    if (!rec || rec.frames < 2) throw new Error('没有可导出的记录：请先自动通关或手动游玩');
    const E = api.env(), S = So ? { ...rec.S, ...So } : rec.S, AS = (api.sprites || E.sprites)();
    const fps = +S.aeFps || 30, bake = S.aeSampling === 'bake', CW = 720, CH = 1280, zh = S.aeNames !== 'en', V = E.view;
    const D = Math.max(1 / fps, Math.ceil((rec.lastT + 1 / fps) * fps - 1e-6) / fps);
    const assets = [], assetFiles = [], pending = [], used = new Map();
    const folders = [{ id: 'root', name: '拔钉救人_AE工程' }, { id: 'img', name: '素材', parent: 'root' }, { id: 'stones', name: '石头', parent: 'img' }, { id: 'board', name: '木板钉子盒子', parent: 'img' }, { id: 'char', name: '小人与压板', parent: 'img' }, { id: 'ui', name: '界面', parent: 'img' }, { id: 'aud', name: '音频', parent: 'root' }, { id: 'pre', name: '预合成', parent: 'root' }];
    const toPng = c => new Promise(res => c.toBlob(b => b.arrayBuffer().then(a => res(new Uint8Array(a))), 'image/png'));
    function assetFor(key) {
      if (used.has(key)) return used.get(key); const a = AS[key]; if (!a) return null;
      const file = 'assets/' + key + '.png', o = { id: key, file, folder: folderOf(key), w: a.c.width, h: a.c.height, name: key + '.png', kx: a.c.width / a.w, ky: a.c.height / a.h, ax: a.ax, ay: a.ay };
      assets.push(o); pending.push(toPng(a.c).then(data => assetFiles.push({ name: file, data }))); used.set(key, o); return o;
    }
    const rnd = v => Array.isArray(v) ? v.map(x => Math.round(x * 100) / 100) : Math.round(v * 100) / 100;
    function resample(s) { const f0 = Math.round(s[0][0] * fps), f1 = Math.max(f0, Math.round(s[s.length - 1][0] * fps)), out = []; let j = 0;
      for (let f = f0; f <= f1; f++) { const tau = f / fps; while (j < s.length - 2 && s[j + 1][0] <= tau + 1e-9) j++; const a = s[j], b = s[j + 1] || a, u = b[0] > a[0] ? Math.min(1, Math.max(0, (tau - a[0]) / (b[0] - a[0]))) : 0; out.push({ t: tau, v: a.map((x, i) => i === 0 ? tau : x + (b[i] - x) * u) }); }
      return { f0, f1, list: out }; }
    function prop(fr, get, tol) {
      const t = fr.list.map(o => o.t), vv = fr.list.map(o => get(o.v)), same = (a, b, e) => Array.isArray(a) ? a.every((x, i) => Math.abs(x - b[i]) <= e) : Math.abs(a - b) <= e;
      if (vv.every(x => same(x, vv[0], 1e-6))) return rnd(vv[0]);
      let keep; if (bake) keep = vv.map((_, i) => i);
      else { keep = [0]; let a = 0; for (let b = 2; b < vv.length; b++) { let ok = true; for (let m = a + 1; m < b && ok; m++) { const u = (t[m] - t[a]) / (t[b] - t[a]); const lin = Array.isArray(vv[a]) ? vv[a].map((x, i) => x + (vv[b][i] - x) * u) : vv[a] + (vv[b] - vv[a]) * u; ok = same(lin, vv[m], tol); } if (!ok) { keep.push(b - 1); a = b - 1; } } if (vv.length > 1) keep.push(vv.length - 1); }
      return { t: keep.map(i => r4(t[i])), v: keep.map(i => rnd(vv[i])) };
    }
    const segs = [], layers = [], comps = [], markers = [];
    for (const tr of rec.tracks.values()) { let a = 0; for (let i = 1; i <= tr.s.length; i++) if (i === tr.s.length || tr.s[i][6] !== tr.s[i - 1][6] + 1) { segs.push({ tr, s: tr.s.slice(a, i) }); a = i; } }
    segs.sort((p, q) => p.tr.z - q.tr.z || p.tr.order - q.tr.order || p.s[0][0] - q.s[0][0]);
    const nSeg = new Map(), segK = new Map(); segs.forEach(g => { const k = g.tr.id + '|' + g.tr.asset; nSeg.set(k, (nSeg.get(k) || 0) + 1); });
    let blurDone = false;
    const pushBlur = () => { if (blurDone || !rec.blur.length) return; blurDone = true; const s = rec.blur, fr = resample(s.map(e => [e[0], e[1]])); layers.push({ name: zh ? '失败模糊（调整图层）' : 'FailBlur (adjustment)', src: { solid: [1, 1, 1], adjust: true, w: Math.round(V.w), h: Math.round(V.h) }, in: r4(fr.f0 / fps), out: D, label: 15, tr: { anchor: [V.w / 2, V.h / 2], position: [V.w / 2, V.h / 2] }, fx: { blur: prop(fr, e => e[1], 0.2) } }); };
    for (const g of segs) {
      if (g.tr.z >= 5) pushBlur();
      const a = assetFor(g.tr.asset); if (!a) continue;
      const fr = resample(g.s), tin = fr.f0 / fps, last = g.s[g.s.length - 1], nextT = rec.frames - 1 > last[6] ? last[0] + 1 / fps : D;
      const tout = Math.min(D, Math.max(tin + 1 / fps, Math.round(nextT * fps) / fps)), k = g.tr.id + '|' + g.tr.asset, n = (segK.get(k) || 0) + 1; segK.set(k, n);
      const L = { name: layerName(g.tr.id, g.tr.asset, zh) + (nSeg.get(k) > 1 ? ` #${n}` : ''), src: { asset: a.id }, in: r4(tin), out: r4(tout), label: LABEL[g.tr.id.split('_')[0]] ?? 15, tr: {
        anchor: [rnd(a.ax * a.kx), rnd(a.ay * a.ky)], position: prop(fr, e => [e[1] - V.x0, e[2] - V.y0], 0.25), scale: prop(fr, e => [e[3] * 100 / a.kx, e[3] * 100 / a.ky], 0.25),
        rotation: prop(fr, e => e[4] * 180 / Math.PI, 0.2), opacity: prop(fr, e => Math.max(0, Math.min(100, e[5] * 100)), 0.5) } };
      if (g.tr.add) L.blend = 'add'; layers.push(L);
    }
    pushBlur();
    const audioFiles = [], ZH = n => (SFX_NAMES[n] || [0, n])[1];
    if (S.aeAudio !== 'none' && rec.sfx.length) try {
      if (S.aeAudio === 'both' || S.aeAudio === 'mixed') { const buf = await renderSfxOffline(rec.sfx, D, S); if (buf) { audioFiles.push({ name: 'audio/mix.wav', data: encodeWav(buf) }); assets.push({ id: 'mix', file: 'audio/mix.wav', folder: 'aud', name: 'mix.wav' }); layers.push({ name: zh ? '混合音轨' : 'Mixed audio', src: { asset: 'mix' }, label: LABEL.audio }); } }
      if (S.aeAudio === 'both' || S.aeAudio === 'events') {
        const kinds = new Set(rec.sfx.map(e => e.name));
        for (const k of kinds) { const buf = await renderSfxOffline([{ t: 0, name: k }], (SFX_DUR[k] || 0.4) + 0.2, S); if (!buf) continue; audioFiles.push({ name: `audio/sfx_${k}.wav`, data: encodeWav(buf) }); assets.push({ id: 'sfx_' + k, file: `audio/sfx_${k}.wav`, folder: 'aud', name: `sfx_${k}.wav` }); }
        const al = rec.sfx.map((e, i) => { const st = r4(e.t); return { name: `${zh ? '音效' : 'SFX'} ${i + 1} ${zh ? ZH(e.name) : e.name}`, src: { asset: 'sfx_' + e.name }, start: st, in: st, label: LABEL.audio }; });
        comps.push({ id: 'sfx', name: zh ? '音效_逐事件' : 'SFX_events', w: CW, h: CH, duration: D, fps, folder: 'pre', layers: al }); layers.push({ name: zh ? '音效_逐事件' : 'SFX_events', src: { comp: 'sfx' }, label: LABEL.audio });
      }
    } catch (e) { console.warn('audio export', e); }
    for (const e of rec.sfx) markers.push([r4(e.t), zh ? ZH(e.name) : e.name]);
    const d = new Date(), p2 = x => String(x).padStart(2, '0'), stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    comps.push({ id: 'main', name: zh ? '主合成_拔钉救人' : 'Main_PinRescue', w: Math.round(V.w), h: Math.round(V.h), duration: D, fps, folder: 'root', bg: [0, 0, 0], layers, markers });
    if (!zh) for (const f of folders) f.name = { 拔钉救人_AE工程: 'PinRescue_AE', 素材: 'Assets', 石头: 'Stones', 木板钉子盒子: 'Board', 小人与压板: 'Character', 界面: 'UI', 音频: 'Audio', 预合成: 'Precomps' }[f.name] || f.name;
    const keyCount = p => p && p.t ? p.t.length : 0, stats = { comps: comps.length, layers: 0, keys: 0, stones: new Set(segs.filter(g => g.tr.id.startsWith('stone_')).map(g => g.tr.id)).size, planks: new Set(segs.filter(g => g.tr.id.startsWith('plank_')).map(g => g.tr.id)).size, pins: new Set(segs.filter(g => /^(pin|fly|boxpin)_/.test(g.tr.id)).map(g => g.tr.id)).size, sfx: rec.sfx.length, blur: rec.blur.length > 0 };
    for (const c of comps) { stats.layers += c.layers.length; for (const l of c.layers) { if (l.tr) for (const k of ['position', 'scale', 'rotation', 'opacity']) { const kc = keyCount(l.tr[k]); if (kc > 1) stats.keys += kc; } if (l.fx && keyCount(l.fx.blur) > 1) stats.keys += keyCount(l.fx.blur); } }
    const timeline = { meta: { tool: 'pin-rescue-tool', version: api.version || '1.0.0', format: 1, created: d.toISOString(), fps, width: Math.round(V.w), height: Math.round(V.h), duration: D, design: [CW, CH], view: V, sampling: bake ? 'bake' : 'reduce', names: zh ? 'zh' : 'en', saveAep: S.aeSaveAep !== false, aepName: `pin-rescue-tool_${stamp}.aep`, newProject: true, stats, note: '图层从下到上排列；时间单位秒；位置/锚点单位像素（合成坐标 = 设计坐标减去可视区域左上角）；缩放为百分比' },
      folders, assets: assets.map(({ id, file, folder, w, h, name }) => ({ id, file, folder, w, h, name })), comps, mainComp: 'main' };
    await Promise.all(pending);
    const enc = new TextEncoder(), files = [{ name: 'build_ae_project.jsx', data: enc.encode(JSX_TEXT) }, { name: 'timeline.json', data: enc.encode(JSON.stringify(timeline)) }, { name: 'README_AE.md', data: enc.encode(README_TEXT) }, ...assetFiles.sort((a, b) => a.name < b.name ? -1 : 1), ...audioFiles];
    return { blob: makeZip(files), name: `pin-rescue-tool_ae_export_${stamp}.zip`, timeline, stats, files: files.length, fileList: files, segs: segs.map(g => ({ id: g.tr.id, asset: g.tr.asset, z: g.tr.z, s: g.s })), blur: rec.blur };
  }
  return { start, stop, sample, exportZip, get rec() { return R; }, set rec(v) { R = v; } };
}
