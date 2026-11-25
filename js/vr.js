/* Apaga el fuego · versión WebXR (Three.js)
   Reutiliza las reglas del juego 2D (js/game.js) en un escenario 3D.
   Unidades: metros. El "mundo" (world) se coloca frente al jugador al iniciar cada nivel;
   toda la lógica trabaja en coordenadas locales de ese grupo (el fuego está en z = -distancia). */
import * as THREE from 'three';

/* ============ utilidades ============ */
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') };
const fmtN = (v, d = 1) => v.toFixed(d).replace('.', ',');
const F = 'system-ui,"Segoe UI",Roboto,Arial,sans-serif';
const U = .009;   // metros por unidad del juego 2D (horizontal)
const V = .012;   // metros por unidad del juego 2D (vertical, un poco más tolerante en VR)
const EXTRA_T = 15; // segundos extra en VR (caminar toma más tiempo)

/* ============ progreso (compartido con la versión 2D) ============ */
let SAVE = { unlocked: 1, stars: [0, 0, 0, 0, 0] };
try { const s = JSON.parse(localStorage.getItem('apaga-el-fuego') || 'null'); if (s && s.unlocked) SAVE = s } catch (e) { }
const persist = () => { try { localStorage.setItem('apaga-el-fuego', JSON.stringify(SAVE)) } catch (e) { } };

/* ============ datos (mismos que la versión 2D) ============ */
const AG = {
  abc: { n: 'Polvo ABC', lab: '#2f6fd6', tx: 'ABC', l2: 'POLVO SECO', hint: 'Polvo químico seco', freq: 3000 },
  agua: { n: 'Agua', lab: '#3aa0ff', tx: 'H₂O', l2: 'AGUA', hint: 'Agua a presión', freq: 1500 },
  co2: { n: 'CO₂', lab: '#2b2b2b', tx: 'CO₂', l2: 'GAS', hint: 'Dióxido de carbono', freq: 4600, horn: true },
  k: { n: 'Clase K', lab: '#f2c500', tx: 'K', l2: 'COCINAS', hint: 'Para grasas de cocina', freq: 2300 }
};
const AGP = { // partículas del chorro
  abc: { col: [.95, .9, .86], sp: 7, dr: 1.1, gr: -.6, s0: .03, s1: .4, a: .6, rate: 170, cloud: true },
  agua: { col: [.62, .82, 1], sp: 9, dr: .15, gr: -6, s0: .035, s1: .03, a: .85, rate: 140 },
  co2: { col: [.94, .97, 1], sp: 6.5, dr: 1.4, gr: .1, s0: .05, s1: .55, a: .5, rate: 200, cloud: true },
  k: { col: [1, .95, .72], sp: 5.5, dr: .9, gr: -1.5, s0: .025, s1: .16, a: .7, rate: 160 }
};
const EFF = {
  A: { abc: { e: 1, rk: 1 } },
  C: { co2: { e: 1, rk: .7 }, abc: { e: .85, rk: 1, note: 'abc_c' }, agua: { fail: 'elec' } },
  K: { k: { e: 1.1, rk: .35 }, abc: { e: .5, rk: 2.4, note: 'abc_k' }, agua: { fail: 'flare' } },
  B: { abc: { e: 1, rk: 1 }, co2: { e: .65, rk: 1.7, note: 'co2_b' }, agua: { fail: 'spread' } }
};
const KIND = {
  A: { h: 120, w: 1, c: [0xd6300a, 0xff8e16, 0xffe682] },
  C: { h: 95, w: .85, c: [0xe24214, 0xffaa28, 0xbee2ff] },
  K: { h: 150, w: 1.15, c: [0xd23a0a, 0xffac1e, 0xfff296] },
  B: { h: 105, w: 1.22, c: [0x961a0a, 0xee6012, 0xffc85a] }
};
const row = (n, x0, dx, by, lit) => Array.from({ length: n }, (_, i) => [x0 + i * dx, by, lit[i] || 0]);
const LV = [
  { id: 1, name: 'Oficina', sub: 'Papelero en llamas', cls: 'A', scene: 'office', time: 45, charge: 12, g: .055, gre: .09, spread: .18, rek: .10, lose: .62, dist: 4.2, cx: -20, opts: ['abc'],
    cells: [[-150, 56, .5], [-118, 56, .55], [-86, 56, .45], [-8, 14, 0], [26, 14, 0], [60, 14, 0], [94, 14, 0]],
    intro: 'Se incendió el papelero de la oficina.' },
  { id: 2, name: 'Sala de servidores', sub: 'Humo en un rack', cls: 'C', scene: 'dc', time: 40, charge: 10, g: .07, gre: .08, spread: .2, rek: .12, lose: .6, dist: 4.4, cx: -60, opts: ['agua', 'abc', 'co2'],
    cells: row(6, -130, 30, 30, [0, 0, .5, .55, 0, 0]),
    intro: 'Sale fuego de un rack que sigue energizado. ¿Qué extintor tomas?' },
  { id: 3, name: 'Casino · cocina', sub: 'Sartén con aceite', cls: 'K', scene: 'kitchen', time: 40, charge: 10, g: .08, gre: .10, spread: .2, rek: .14, lose: .6, dist: 4.2, cx: -30, opts: ['agua', 'abc', 'k'],
    cells: [[-95, 8, .55], [-65, 8, .6], [-35, 8, .5], [12, 26, 0], [46, 26, 0]],
    intro: 'Una sartén con aceite caliente se incendió en la cocina. ¿Qué extintor tomas?' },
  { id: 4, name: 'Taller', sub: 'Líquido inflamable', cls: 'B', scene: 'shop', time: 45, charge: 12, g: .085, gre: .16, spread: .26, rek: .28, lose: .6, dist: 4.5, cx: -118, opts: ['agua', 'abc', 'co2'],
    cells: row(8, -230, 32, 104, [0, 0, 0, .5, .55, 0, 0, 0]),
    intro: 'Se derramó un líquido inflamable en el piso y prendió. ¿Qué extintor tomas?' },
  { id: 5, name: 'Bodega con humo', sub: '¿Apagar o evacuar?', cls: 'A', scene: 'wh', time: 40, charge: 8, g: .11, gre: .12, spread: .5, rek: .2, lose: .97, dist: 4.4, cx: 40, opts: ['abc'], smoke: true,
    cells: row(8, -170, 34, 78, [0, 0, .4, .55, .5, 0, 0, 0]),
    intro: 'Hay fuego en cajas y mucho humo. La salida de emergencia está a tu derecha: decide si apagar o evacuar.' }
];

/* ============ motor 3D ============ */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
let AR = false;  // realidad mixta (passthrough): sin paredes ni fondo
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const BG = new THREE.Color(0x14181d);
scene.background = BG;
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, .03, 60);
camera.rotation.order = 'YXZ';
const player = new THREE.Group(); player.add(camera); scene.add(player);
camera.position.set(0, 1.6, 0);
const world = new THREE.Group(); scene.add(world);
const levelG = new THREE.Group(); world.add(levelG);
const hemi = new THREE.HemisphereLight(0xffffff, 0x445055, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(2, 4, 3); scene.add(sun);
const fireLight = new THREE.PointLight(0xff7a2a, 0, 0, 2); world.add(fireLight);
const alarmLight = new THREE.PointLight(0xff2020, 0, 0, 2); world.add(alarmLight);
const clock = new THREE.Clock();
const V3 = () => new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const v0 = V3(), v1 = V3(), v2 = V3(), q0 = new THREE.Quaternion(), m0 = new THREE.Matrix4();

function resize() {
  if (renderer.xr.isPresenting) return;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

/* ============ ayudas de geometría y texturas ============ */
const M = (c, o) => new THREE.MeshLambertMaterial({ color: c, ...o });
const MB = (c, o) => new THREE.MeshBasicMaterial({ color: c, ...o });
function box(p, w, h, d, m, x, y, z, ry = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.rotation.y = ry; p.add(o); return o }
function cyl(p, rt, rb, h, m, x, y, z, seg = 20) { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y + h / 2, z); p.add(o); return o }
function plane(p, w, h, m, x, y, z, ry = 0, rx = 0) { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); p.add(o); return o }
function ctex(w, h, fn, rx = 1, ry = 1) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; fn(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  if (rx !== 1 || ry !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry) }
  return t;
}
const keep = t => { t.userData.keep = true; return t };
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
function wrap(c, txt, x, y, mw, lh) {
  let line = '';
  for (const w of txt.split(' ')) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > mw && line) { c.fillText(line, x, y); y += lh; line = w } else line = t }
  if (line) { c.fillText(line, x, y); y += lh }
  return y;
}
function star(c, cx, cy, R, col) {
  c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? R * .45 : R, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) }
  c.closePath(); c.fillStyle = col; c.fill();
}
function mark(c, ok, x, y, s) {
  c.lineWidth = s * .16; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = ok ? '#4cc582' : '#ff5a4d'; c.beginPath();
  if (ok) { c.moveTo(x, y + s * .5); c.lineTo(x + s * .38, y + s * .85); c.lineTo(x + s, y + s * .1) }
  else { c.moveTo(x + s * .1, y + s * .1); c.lineTo(x + s * .9, y + s * .9); c.moveTo(x + s * .9, y + s * .1); c.lineTo(x + s * .1, y + s * .9) }
  c.stroke();
}

const FLAME = keep(ctex(64, 128, c => {
  c.filter = 'blur(3px)'; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(32, 6);
  c.bezierCurveTo(40, 40, 60, 70, 56, 100); c.bezierCurveTo(52, 124, 12, 124, 8, 100); c.bezierCurveTo(4, 70, 24, 40, 32, 6); c.fill();
  c.filter = 'none'; c.globalCompositeOperation = 'destination-in';
  const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.45, 'rgba(255,255,255,.9)'); g.addColorStop(1, '#fff');
  c.fillStyle = g; c.fillRect(0, 0, 64, 128);
}));
const SOFT = keep(ctex(64, 64, c => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64) }));
const BASE_LBL = keep(ctex(256, 96, c => { c.fillStyle = '#f2c500'; c.font = `900 64px ${F}`; c.textAlign = 'center'; c.fillText('BASE', 128, 70) }));
const EXIT_TEX = keep(ctex(256, 96, c => { c.fillStyle = '#16a35b'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#fff'; c.font = `800 46px ${F}`; c.textAlign = 'center'; c.fillText('SALIDA →', 128, 64) }));
const ARROW_TEX = keep(ctex(64, 64, c => { c.fillStyle = '#3dff9a'; c.beginPath(); c.moveTo(8, 22); c.lineTo(34, 22); c.lineTo(34, 8); c.lineTo(58, 32); c.lineTo(34, 56); c.lineTo(34, 42); c.lineTo(8, 42); c.closePath(); c.fill() }));

/* ============ partículas (un solo draw call por sistema) ============ */
const PSCALE = { value: 600 };
const PVS = `attribute float size;attribute float alpha;attribute vec3 pcol;uniform float uScale;varying float vA;varying vec3 vC;
void main(){vA=alpha;vC=pcol;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=size*uScale*projectionMatrix[1][1]/max(.05,-mv.z);}`;
const PFS = `uniform sampler2D map;varying float vA;varying vec3 vC;
void main(){vec4 t=texture2D(map,gl_PointCoord);float a=t.a*vA;if(a<.01)discard;gl_FragColor=vec4(vC*t.rgb,a);}`;
class PS {
  constructor(max, additive) {
    this.max = max; this.p = [];
    const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.sz = new Float32Array(max); this.al = new Float32Array(max); this.col = new Float32Array(max * 3);
    const at = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', at(this.pos, 3)); g.setAttribute('size', at(this.sz, 1)); g.setAttribute('alpha', at(this.al, 1)); g.setAttribute('pcol', at(this.col, 3));
    g.setDrawRange(0, 0);
    this.pts = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { map: { value: SOFT }, uScale: PSCALE }, vertexShader: PVS, fragmentShader: PFS,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    }));
    this.pts.frustumCulled = false;
  }
  add(o) { if (this.p.length >= this.max) this.p.shift(); o.a = 0; this.p.push(o) }
  clear() { this.p.length = 0; this.geo.setDrawRange(0, 0) }
  update(dt) {
    const P = this.p;
    for (let i = P.length - 1; i >= 0; i--) { P[i].a += dt; if (P[i].a >= P[i].l) P.splice(i, 1) }
    let n = 0;
    for (const p of P) {
      const k = Math.max(0, 1 - (p.dr || 0) * dt); p.vx *= k; p.vy *= k; p.vz *= k; p.vy += (p.gr || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor && p.y < .01) { p.y = .01; p.vy *= -.15; p.vx *= .5; p.vz *= .5 }
      const u = p.a / p.l;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.sz[n] = lerp(p.s0, p.s1, u);
      this.al[n] = p.a0 * (1 - u) * (p.fi ? Math.min(1, u * 5) : 1);
      this.col[n * 3] = p.c[0]; this.col[n * 3 + 1] = p.c[1]; this.col[n * 3 + 2] = p.c[2];
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const k of ['position', 'size', 'alpha', 'pcol']) this.geo.attributes[k].needsUpdate = true;
  }
}
const smokePS = new PS(260, false), sparkPS = new PS(160, true), streamPS = new PS(420, false), cloudPS = new PS(120, false);
[cloudPS, smokePS, streamPS, sparkPS].forEach(s => world.add(s.pts));

/* ============ escenarios ============ */
const SCN = {
  office: {
    wall: ['#a8b8b4', '#8da09e'], base: '#5a6968', floor: '#3c4650', grid: 'rgba(255,255,255,.07)', tile: .6, ceil: 0xdfe3e0, back: 1.6, hemi: 1.1, cz: 0,
    yb: c => c[1] > 40 ? .44 : .78,
    props(P, FZ, zb) {
      cyl(P, .32, .25, .42, M(0x6e7680), -.88, 0, FZ); cyl(P, .29, .29, .01, M(0x1d1f22), -.88, .41, FZ);
      const wood = M(0x93724c), leg = M(0x5d422a);
      box(P, 1.5, .04, .75, wood, .55, .72, FZ - .3);
      for (const dx of [-.68, .68]) for (const dz of [-.32, .32]) box(P, .05, .72, .05, leg, .55 + dx, 0, FZ - .3 + dz);
      box(P, .32, .01, .22, M(0xf2f2ee), .3, .76, FZ - .12); box(P, .25, .01, .2, M(0xe6e4d8), .65, .76, FZ - .1, .3);
      box(P, .55, .34, .03, M(0x15191d), 1.0, .86, FZ - .58); plane(P, .5, .29, MB(0x2b6a9b), 1.0, 1.03, FZ - .56);
      box(P, .06, .12, .06, M(0x2a2f35), 1.0, .74, FZ - .58);
      box(P, .46, .06, .46, M(0x353d45), .55, .46, FZ + .55); box(P, .46, .5, .06, M(0x353d45), .55, .52, FZ + .78);
      plane(P, 1.7, 1.1, MB(0xffffff, { map: ctex(128, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8fbce3'); g.addColorStop(1, '#dff0fb'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.6)'; for (let y = 0; y < h; y += 12) c.fillRect(0, y, w, 3); c.strokeStyle = '#d7dcdf'; c.lineWidth = 8; c.strokeRect(0, 0, w, h) }) }), 2.3, 1.55, zb + .01);
      box(P, 1.6, 1.0, .03, M(0xeceeee), -2.3, 1.0, zb + .02);
    }
  },
  dc: {
    wall: ['#1b222b', '#10151b'], base: '#0b0e12', floor: '#27303a', grid: 'rgba(120,170,220,.3)', tile: .6, ceil: 0x1a1f26, back: 2.2, hemi: .5, cz: .06, alarm: true,
    yb: () => 1.05,
    props(P, FZ) {
      const face = ctex(128, 320, (c, w, h) => {
        c.fillStyle = '#121619'; c.fillRect(0, 0, w, h);
        for (let u = 0; u < 15; u++) {
          const y = 8 + u * 20; c.fillStyle = u % 3 === 0 ? '#222a32' : '#1a2027'; c.fillRect(6, y, w - 12, 16);
          c.fillStyle = Math.random() > .25 ? '#42e07a' : '#1c5c36'; c.fillRect(12, y + 6, 5, 5);
          c.fillStyle = Math.random() > .7 ? '#ffb32a' : '#5a4310'; c.fillRect(22, y + 6, 5, 5);
          c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(40, y + 7, w - 52, 2);
        }
      });
      const side = M(0x1c2229), fm = M(0xffffff, { map: face });
      for (let r = 0; r < 4; r++) {
        const o = new THREE.Mesh(new THREE.BoxGeometry(.58, 2.0, 1.0), [side, side, side, side, fm, side]);
        o.position.set(-.9 + r * .6, 1.0, FZ - .51); P.add(o);
      }
      box(P, 4, .06, .4, M(0x2c343e), 0, 2.35, FZ - .5);
      cyl(P, .06, .06, .1, MB(0xff3020), 0, 2.68, FZ + 1.2);
    }
  },
  kitchen: {
    wall: ['#dde4e5', '#c3ccce'], base: '#7d878b', floor: '#6d3f33', grid: 'rgba(0,0,0,.25)', tile: .3, ceil: 0xe5e8e8, back: .75, hemi: 1.1, cz: -.05,
    yb: c => c[1] < 15 ? .98 : .94,
    wallFx(c, w, h) { c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2; c.beginPath(); for (let y = h * .35; y < h; y += 24) { c.moveTo(0, y); c.lineTo(w, y) } for (let x = 0; x < w; x += 48) { c.moveTo(x, h * .35); c.lineTo(x, h) } c.stroke() },
    props(P, FZ) {
      const steel = M(0xb0b8bc);
      box(P, 1.05, .9, .7, steel, -.375, 0, FZ - .25);
      for (const [x, z] of [[-.7, -.05], [-.05, -.05], [-.7, -.4], [-.05, -.4]]) cyl(P, .1, .1, .01, M(0x262b2f), x, .9, FZ + z);
      cyl(P, .3, .26, .07, M(0x1c1e21), -.315, .9, FZ - .05, 28); cyl(P, .27, .27, .005, M(0x3a2a14), -.315, .962, FZ - .05, 28);
      box(P, .04, .025, .3, M(0x1c1e21), -.315, .94, FZ + .38);
      box(P, 1.25, .9, .65, M(0x8d979d), .78, 0, FZ - .22); box(P, 1.27, .04, .67, M(0xa77d4f), .78, .9, FZ - .22);
      box(P, .3, .02, .22, M(0xe8e4dc), 1.05, .94, FZ - .2); cyl(P, .07, .07, .14, M(0xc8453a), 1.3, .94, FZ - .3);
      box(P, 1.1, .32, .6, M(0x9aa3a8), -.375, 1.62, FZ - .4);
      box(P, 1.4, .03, .3, M(0x8a949a), .9, 1.5, FZ - .58);
      cyl(P, .1, .1, .18, M(0xb0b8bc), .6, 1.53, FZ - .58); cyl(P, .12, .12, .14, M(0x9aa3a8), .95, 1.53, FZ - .58);
    }
  },
  shop: {
    wall: ['#9a9d97', '#80847f'], base: '#4c504d', floor: '#575c5e', grid: 'rgba(0,0,0,.25)', tile: 1, ceil: 0x8a8d88, back: 2.2, hemi: .95, cz: 0,
    yb: () => .03,
    props(P, FZ) {
      const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 36), M(0x2a2440)); pud.scale.set(1.25, .55, 1); pud.rotation.x = -Math.PI / 2; pud.position.set(0, .004, FZ); P.add(pud);
      for (const x of [-1.85, -2.5]) { cyl(P, .29, .29, .88, M(0x2f63a8), x, 0, FZ - .2); cyl(P, .3, .3, .03, M(0x27292b), x, .62, FZ - .2) }
      const can = box(P, .3, .25, .16, M(0xc0392b), 1.45, 0, FZ + .15); can.rotation.set(0, .4, Math.PI / 2 - .1); can.position.y = .1;
      box(P, 1.4, .06, .7, M(0x6b7378), 2.4, .86, FZ - .3); box(P, 1.3, .86, .6, M(0x3d4348), 2.4, 0, FZ - .3);
      box(P, .4, .3, .3, M(0x7e868b), 2.2, .92, FZ - .35);
      box(P, 9, .005, .1, MB(0xd9b400), 0, 0, FZ + 1.6);
    }
  },
  wh: {
    wall: ['#3c4248', '#2b3035'], base: '#1f2327', floor: '#454b50', grid: 'rgba(255,255,255,.08)', tile: 1, ceil: 0x30353a, back: 1.6, hemi: .75, cz: -.05, x1: 3.2, door: -.4,
    yb: () => .54,
    wallFx(c, w, h) { c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 6; c.beginPath(); for (let x = 0; x < w; x += 28) { c.moveTo(x, 0); c.lineTo(x, h) } c.stroke() },
    props(P, FZ, zb, x1, doorZ) {
      box(P, 2.7, .12, 1.0, M(0x7a5a36), -.85, 0, FZ - .3);
      const cb = [M(0xa98056), M(0xb88c5e)];
      for (let i = 0; i < 7; i++) {
        const x = -2.0 + i * .4;
        box(P, .38, .4, .38, cb[i % 2], x, .12, FZ - .05);
        box(P, .38, .4, .38, cb[(i + 1) % 2], x, .12, FZ - .5);
        if (i % 2 === 0) box(P, .38, .4, .38, cb[i % 2], x, .52, FZ - .5);
      }
      for (const x of [-3.2, -1.4, .4]) { box(P, .08, 2.4, .08, M(0xd9661e), x, 0, zb + .5); }
      for (const y of [.8, 1.6, 2.3]) box(P, 3.7, .08, .9, M(0xd9661e), -1.4, y, zb + .5);
      cyl(P, .29, .29, .88, M(0x2f5aa0), 1.2, 0, FZ - .2); cyl(P, .29, .29, .88, M(0xb8452e), 1.8, 0, FZ - .2);
      // salida de emergencia
      plane(P, 1.0, 2.1, M(0x1d7a4a), x1 - .01, 1.05, doorZ, -Math.PI / 2);
      box(P, .06, 2.2, .08, M(0x10482c), x1 - .03, 0, doorZ - .53); box(P, .06, 2.2, .08, M(0x10482c), x1 - .03, 0, doorZ + .53);
      plane(P, .8, .3, MB(0xffffff, { map: EXIT_TEX, fog: false }), x1 - .03, 2.38, doorZ, -Math.PI / 2);
      for (let i = 0; i < 5; i++) { const t = i / 4; plane(P, .3, .3, MB(0xffffff, { map: ARROW_TEX, transparent: true, fog: false }), lerp(.6, x1 - .6, t), .006, lerp(0, doorZ, t), 0, -Math.PI / 2) }
    }
  }
};

function buildRoom(P, s, FZ) {
  const x0 = s.x0 ?? -4.5, x1 = s.x1 ?? 4.5, zb = FZ - s.back, zf = 2.6, H = 2.8, w = x1 - x0, d = zf - zb, cx = (x0 + x1) / 2, cz = (zb + zf) / 2;
  const ft = ctex(256, 256, (c, W, Hh) => { c.fillStyle = s.floor; c.fillRect(0, 0, W, Hh); c.strokeStyle = s.grid; c.lineWidth = 4; c.strokeRect(0, 0, W, Hh) }, w / s.tile, d / s.tile);
  plane(P, w, d, M(0xffffff, { map: ft }), cx, 0, cz, 0, -Math.PI / 2);
  plane(P, w, d, M(s.ceil), cx, H, cz, 0, Math.PI / 2);
  const wt = len => ctex(256, 512, (c, W, Hh) => {
    const g = c.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, s.wall[0]); g.addColorStop(1, s.wall[1]); c.fillStyle = g; c.fillRect(0, 0, W, Hh);
    if (s.wallFx) s.wallFx(c, W, Hh); c.fillStyle = s.base; c.fillRect(0, Hh - 18, W, 18);
  }, len / 2, 1);
  plane(P, w, H, M(0xffffff, { map: wt(w) }), cx, H / 2, zb, 0);
  plane(P, w, H, M(0xffffff, { map: wt(w) }), cx, H / 2, zf, Math.PI);
  plane(P, d, H, M(0xffffff, { map: wt(d) }), x0, H / 2, cz, Math.PI / 2);
  plane(P, d, H, M(0xffffff, { map: wt(d) }), x1, H / 2, cz, -Math.PI / 2);
  for (const x of [-2, 0, 2]) for (const z of [FZ + 1, 1]) if (x > x0 && x < x1) plane(P, 1.2, .25, MB(0xfff6e0), x, H - .01, z, 0, Math.PI / 2);
  return { x0, x1, zb, zf };
}

/* ============ extintor y boquilla ============ */
function makeExt() {
  const g = new THREE.Group(), red = M(0xc52a1f), dark = M(0x2a2d31), blk = M(0x17191c), r = .075, H = .46;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 24), red); body.position.y = -.1 - H / 2; g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), red); dome.position.y = -.1; g.add(dome);
  const valve = new THREE.Mesh(new THREE.BoxGeometry(.05, .06, .06), dark); valve.position.y = -.04; g.add(valve);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(.13, .012, .03), blk); handle.position.set(.045, -.012, 0); g.add(handle);
  const lever = new THREE.Group(); lever.position.set(-.02, .012, 0); g.add(lever);
  const lv = new THREE.Mesh(new THREE.BoxGeometry(.14, .012, .03), blk); lv.position.x = .07; lever.add(lv);
  const pin = new THREE.Group(); pin.position.set(.005, -.0, .045); g.add(pin);
  const pinMat = MB(0xf2c500);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.017, .004, 8, 20), pinMat); ring.position.z = .02; pin.add(ring);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, .06, 6), pinMat); rod.rotation.x = Math.PI / 2; rod.position.z = -.01; pin.add(rod);
  const gcv = document.createElement('canvas'); gcv.width = gcv.height = 128; const gtex = new THREE.CanvasTexture(gcv); gtex.colorSpace = THREE.SRGBColorSpace;
  const gauge = new THREE.Mesh(new THREE.CircleGeometry(.024, 24), MB(0xffffff, { map: gtex })); gauge.position.set(0, -.045, .031); g.add(gauge);
  const labelMat = MB(0xffffff);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(.11, .13), labelMat); label.position.set(0, -.3, r + .002); g.add(label);
  const outlet = new THREE.Object3D(); outlet.position.set(-.03, -.04, 0); g.add(outlet);
  return { g, lever, pin, pinMat, gcv, gtex, labelMat, outlet, gk: -1 };
}
function drawGauge(E, frac) {
  const k = Math.round(frac * 30); if (k === E.gk) return; E.gk = k;
  const c = E.gcv.getContext('2d'); c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, 128, 128);
  c.lineWidth = 14; c.strokeStyle = '#d33'; c.beginPath(); c.arc(64, 70, 46, Math.PI * .8, Math.PI * 1.15); c.stroke();
  c.strokeStyle = '#3bb273'; c.beginPath(); c.arc(64, 70, 46, Math.PI * 1.15, Math.PI * 2.2); c.stroke();
  const a = Math.PI * (.8 + 1.4 * frac); c.strokeStyle = '#111'; c.lineWidth = 6; c.beginPath(); c.moveTo(64, 70); c.lineTo(64 + Math.cos(a) * 44, 70 + Math.sin(a) * 44); c.stroke();
  E.gtex.needsUpdate = true;
}
function labelTex(k) {
  const a = AG[k];
  return ctex(256, 300, (c, W, H) => {
    c.fillStyle = '#f2ede0'; c.fillRect(0, 0, W, H); c.fillStyle = a.lab; c.fillRect(0, 0, W, 44);
    c.fillStyle = '#222'; c.textAlign = 'center'; c.font = `900 110px ${F}`; c.fillText(a.tx, W / 2, 175); c.font = `700 34px ${F}`; c.fillText(a.l2, W / 2, 245);
  });
}
function makeNozzle() {
  const g = new THREE.Group(), dark = M(0x2a2d31), blk = M(0x17191c);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .14, 12), dark); h.rotation.x = Math.PI / 2; h.position.z = .05; g.add(h);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(.008, .011, .05, 10), blk); tip.rotation.x = Math.PI / 2; tip.position.z = -.045; g.add(tip);
  const horn = new THREE.Mesh(new THREE.ConeGeometry(.055, .2, 20, 1, true), M(0x17191c, { side: THREE.DoubleSide })); horn.rotation.x = Math.PI / 2; horn.position.z = -.12; g.add(horn);
  const glove = new THREE.Mesh(new THREE.BoxGeometry(.07, .08, .11), M(0xd99a1c)); glove.position.set(0, -.035, .06); g.add(glove);
  const hoseIn = new THREE.Object3D(); hoseIn.position.z = .13; g.add(hoseIn);
  return { g, horn, hoseIn };
}
const EXT = makeExt(), NOZ = makeNozzle();
scene.add(EXT.g); scene.add(NOZ.g);
const hoseMat = M(0x14161a);
let hose = null;
function updHose() {
  const a = EXT.outlet.getWorldPosition(v1).clone(), b = NOZ.hoseIn.getWorldPosition(v2).clone();
  const sag = Math.min(.35, a.distanceTo(b) * .4);
  const curve = new THREE.CatmullRomCurve3([a, a.clone().add(new THREE.Vector3(0, -sag, 0)), b.clone().add(new THREE.Vector3(0, -sag, 0)), b]);
  const geo = new THREE.TubeGeometry(curve, 20, .012, 6);
  if (hose) { hose.geometry.dispose(); hose.geometry = geo } else { hose = new THREE.Mesh(geo, hoseMat); hose.frustumCulled = false; scene.add(hose) }
}
let pinFly = null;

/* ============ marcadores y paneles ============ */
const marker = new THREE.Group(); world.add(marker);
marker.add(new THREE.Mesh(new THREE.RingGeometry(.12, .15, 40), MB(0xf2c500, { depthTest: false, fog: false, transparent: true })));
const mLbl = new THREE.Sprite(new THREE.SpriteMaterial({ map: BASE_LBL, depthTest: false, fog: false })); mLbl.scale.set(.32, .12, 1); mLbl.position.set(0, -.25, 0); marker.add(mLbl);
marker.children.forEach(o => o.renderOrder = 30);
const reticle = new THREE.Mesh(new THREE.RingGeometry(.05, .072, 32), MB(0xffffff, { depthTest: false, fog: false, transparent: true }));
reticle.renderOrder = 31; world.add(reticle);
const overlay = new THREE.Mesh(new THREE.SphereGeometry(.25, 16, 12), MB(0xff5000, { transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false }));
overlay.renderOrder = 999; camera.add(overlay);

class Panel {
  constructor(cw, ch, mw) {
    this.cw = cw; this.ch = ch; this.cv = document.createElement('canvas'); this.cv.width = cw; this.cv.height = ch; this.c = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(mw, mw * ch / cw), MB(0xffffff, { map: this.tex, transparent: true, fog: false, toneMapped: false }));
    this.mesh.renderOrder = 40; this.btns = []; this.hover = null; this.draw = null; this.key = '';
  }
  redraw() { const c = this.c; c.clearRect(0, 0, this.cw, this.ch); this.btns = []; if (this.draw) this.draw(c, this); this.tex.needsUpdate = true }
  at(uv) { const x = uv.x * this.cw, y = (1 - uv.y) * this.ch; return this.btns.find(b => b.on && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null }
}
const UI = new Panel(1024, 820, 1.5); scene.add(UI.mesh);
const HUD = new Panel(1024, 310, 1.45); world.add(HUD.mesh); HUD.mesh.rotation.x = .2; HUD.mesh.visible = false;

function card(c, P) { rr(c, 6, 6, P.cw - 12, P.ch - 12, 36); c.fillStyle = 'rgba(32,37,44,.97)'; c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.16)'; c.stroke() }
function button(c, P, b) {
  b.on = b.on !== false; P.btns.push(b); const hv = P.hover === b.id && b.on;
  rr(c, b.x, b.y, b.w, b.h, 18);
  c.fillStyle = !b.on ? '#262c33' : b.kind === 'pri' ? (hv ? '#ffd83a' : '#f2c500') : b.sel ? (hv ? '#4a4a2c' : '#3a3a24') : (hv ? '#46525f' : '#323a44');
  c.fill(); if (b.sel) { c.lineWidth = 4; c.strokeStyle = '#f2c500'; c.stroke() } else if (hv) { c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.5)'; c.stroke() }
  if (b.custom) { c.globalAlpha = b.on ? 1 : .4; b.custom(c, b, hv); c.globalAlpha = 1; return }
  c.fillStyle = b.kind === 'pri' ? '#1b1a10' : '#f4efe4'; c.font = `800 ${b.fs || 36}px ${F}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2); c.textBaseline = 'alphabetic';
}
const STEPTX = [['pin', 'Saca el pasador'], ['target', 'Apunta a la base del fuego'], ['lever', 'Aprieta la palanca'], ['sweep', 'Barre de lado a lado, a 2–3 m']];
const isXR = () => renderer.xr.isPresenting;
const AR_DIST = 2.6;  // en realidad mixta el fuego aparece más cerca (cabe en una pieza)

function drawMenu(c, P) {
  card(c, P);
  c.textAlign = 'left'; c.fillStyle = '#f2c500'; c.font = `900 70px ${F}`; c.fillText('Apaga el fuego', 56, 104);
  c.fillStyle = '#a9b0b8'; c.font = `500 30px ${F}`; c.fillText('Entrenamiento con extintor · realidad virtual', 58, 148);
  STEPTX.forEach((s, i) => {
    const x = 56 + (i % 2) * 462, y = 176 + Math.floor(i / 2) * 82;
    rr(c, x, y, 450, 70, 14); c.fillStyle = 'rgba(255,255,255,.06)'; c.fill();
    c.beginPath(); c.arc(x + 38, y + 35, 20, 0, 7); c.fillStyle = '#f2c500'; c.fill();
    c.fillStyle = '#1b1a10'; c.font = `800 24px ${F}`; c.textAlign = 'center'; c.fillText(i + 1, x + 38, y + 44);
    c.fillStyle = '#f4efe4'; c.font = `600 27px ${F}`; c.textAlign = 'left'; c.fillText(i === 3 ? 'Barre de lado a lado' : s[1], x + 72, y + 45);
  });
  c.fillStyle = '#a9b0b8'; c.font = `500 25px ${F}`;
  const tx = isXR()
    ? 'Mano izquierda: extintor · mano derecha: boquilla. Gatillo: apretar la palanca. Pasador: acerca la mano derecha al anillo amarillo y aprieta el grip (o botón A/X). Stick izquierdo: caminar · stick derecho: girar · B/Y: menú.'
    : 'Mouse: apuntar · clic o Espacio: descargar · P: pasador · W A S D: caminar · clic derecho + arrastrar: mirar · E: evacuar · Esc: menú. Con un visor, pulsa «Entrar en VR».';
  wrap(c, tx, 58, 378, 910, 34);
  LV.forEach((l, i) => {
    const lock = l.id > SAVE.unlocked, st = SAVE.stars[i] || 0;
    button(c, P, {
      id: 'lv' + l.id, x: 56 + i * 184, y: 520, w: 172, h: 140, on: !lock, sel: l.id === selLevel,
      fn: () => { selLevel = l.id; previewLevel(l.id); UI.redraw() },
      custom(c, b) {
        c.textAlign = 'center'; c.fillStyle = '#f4efe4'; c.font = `800 40px ${F}`; c.fillText(l.id, b.x + b.w / 2, b.y + 48);
        c.font = `600 21px ${F}`; wrap(c, l.name, b.x + b.w / 2, b.y + 80, b.w - 16, 24);
        if (lock) { c.fillStyle = '#a9b0b8'; c.font = `700 20px ${F}`; c.fillText('BLOQUEADO', b.x + b.w / 2, b.y + 128) }
        else for (let k = 0; k < 3; k++) star(c, b.x + b.w / 2 + (k - 1) * 30, b.y + 120, 12, k < st ? '#f2c500' : '#4a5059');
      }
    });
  });
  const xr = isXR(), ws = xr ? 640 : 912;
  button(c, P, { id: 'start', x: 56, y: 690, w: ws, h: 92, kind: 'pri', label: `Comenzar · nivel ${selLevel}`, fs: 40, fn: () => goLevel(selLevel) });
  if (xr) button(c, P, { id: 'exitxr', x: 56 + ws + 12, y: 690, w: 912 - ws - 12, h: 92, label: AR ? 'Salir' : 'Salir de VR', fs: 34, fn: exitXR });
}
function drawPick(c, P) {
  const L = LV[selLevel - 1]; card(c, P);
  c.textAlign = 'left'; c.fillStyle = '#f4efe4'; c.font = `800 48px ${F}`; c.fillText(`Nivel ${L.id} · ${L.name}`, 56, 100);
  c.fillStyle = '#a9b0b8'; c.font = `500 30px ${F}`; wrap(c, L.intro, 58, 150, 910, 38);
  const opts = P.order, w = (912 - 2 * 18) / 3;
  opts.forEach((k, i) => {
    const a = AG[k];
    button(c, P, {
      id: 'op' + k, x: 56 + i * (w + 18), y: 250, w, h: 400, fn: () => startLevel(L.id, k),
      custom(c, b) {
        const cx = b.x + b.w / 2;
        rr(c, cx - 38, b.y + 70, 76, 150, 24); c.fillStyle = '#d6352a'; c.fill();
        c.fillStyle = '#f2ede0'; c.fillRect(cx - 30, b.y + 112, 60, 54); c.fillStyle = a.lab; c.fillRect(cx - 30, b.y + 112, 60, 10);
        c.fillStyle = '#222'; c.font = `900 22px ${F}`; c.textAlign = 'center'; c.fillText(a.tx, cx, b.y + 156);
        rr(c, cx - 22, b.y + 40, 44, 30, 8); c.fillStyle = '#2f3338'; c.fill();
        c.strokeStyle = '#17191c'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - 20, b.y + 52); c.lineTo(cx - 60, b.y + 80); c.stroke();
        c.fillStyle = '#f4efe4'; c.font = `800 36px ${F}`; c.fillText(a.n, cx, b.y + 280);
        c.fillStyle = '#a9b0b8'; c.font = `500 24px ${F}`; wrap(c, a.hint, cx, b.y + 322, b.w - 24, 30);
      }
    });
  });
  button(c, P, { id: 'back', x: 56, y: 690, w: 912, h: 92, label: 'Volver', fn: openMenu });
}
function drawEnd(c, P) {
  const d = G.endData; card(c, P);
  c.textAlign = 'left'; c.fillStyle = '#f4efe4'; c.font = `800 50px ${F}`; c.fillText(d.title, 56, 96);
  for (let k = 0; k < 3; k++) star(c, 86 + k * 66, 150, 28, k < d.stars ? '#f2c500' : '#4a5059');
  c.fillStyle = '#a9b0b8'; c.font = `500 28px ${F}`; c.fillText(d.meta, 56, 222);
  let y = 270;
  c.font = `500 28px ${F}`;
  for (const f of d.fb) { mark(c, f.ok, 58, y - 24, 28); c.fillStyle = '#f4efe4'; y = wrap(c, f.t, 104, y, 860, 34) + 8 }
  rr(c, 56, 586, 912, 92, 16); c.fillStyle = 'rgba(255,162,31,.12)'; c.fill(); c.strokeStyle = 'rgba(255,162,31,.6)'; c.lineWidth = 2; c.stroke();
  c.fillStyle = '#f4efe4'; c.font = `500 23px ${F}`;
  wrap(c, 'En un incendio real, primero da la alarma y evacúa. Combate solo un fuego pequeño, si sabes cómo hacerlo y tienes la salida despejada a tu espalda.', 80, 622, 864, 30);
  const next = d.win && G.L.id < 5, w = next ? 296 : 450;
  button(c, P, { id: 'menu', x: 56, y: 698, w, h: 90, label: 'Menú', fn: openMenu });
  button(c, P, { id: 'retry', x: 56 + w + 12, y: 698, w, h: 90, label: 'Repetir', fn: () => goLevel(G.L.id) });
  if (next) button(c, P, { id: 'next', x: 56 + 2 * (w + 12), y: 698, w, h: 90, kind: 'pri', label: 'Siguiente', fn: () => goLevel(G.L.id + 1) });
}
function drawHUD(c, P) {
  const g = G, L = g.L, W = P.cw;
  rr(c, 4, 4, W - 8, P.ch - 8, 28); c.fillStyle = 'rgba(20,24,29,.86)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 3; c.stroke();
  let x = 22;
  const chip = (lab, val, col, wd, bar) => {
    rr(c, x, 20, wd, 88, 16); c.fillStyle = 'rgba(255,255,255,.07)'; c.fill();
    c.textAlign = 'left'; c.fillStyle = '#a9b0b8'; c.font = `600 21px ${F}`; c.fillText(lab, x + 16, 50);
    c.fillStyle = col; c.font = `800 38px ${F}`; c.fillText(val, x + 16, 94);
    if (bar !== undefined) { rr(c, x + wd - 74, 72, 58, 12, 6); c.fillStyle = 'rgba(255,255,255,.16)'; c.fill(); if (bar > 0) { rr(c, x + wd - 74, 72, 58 * bar, 12, 6); c.fillStyle = bar < .25 ? '#ff5a4d' : '#f2c500'; c.fill() } }
    x += wd + 10;
  };
  const fp = g.sum <= .001 ? 0 : Math.max(1, Math.round(100 * g.sum / g.sum0));
  chip('TIEMPO', fmtT(g.timeLeft), g.timeLeft < 10 ? '#ff5a4d' : '#f4efe4', 170);
  chip('FUEGO', (fp > 999 ? '999+' : fp) + '%', '#ffb070', 170);
  if (L.smoke) chip('HUMO', Math.round(g.smoke * 100) + '%', '#c9ced4', 150);
  chip('CARGA', fmtN(g.charge) + ' s', g.charge / L.charge < .25 ? '#ff5a4d' : '#f4efe4', 220, g.charge / L.charge);
  chip('DISTANCIA', fmtN(dist) + ' m', dist >= 2 && dist <= 3.2 ? '#4cc582' : '#f4efe4', W - 22 - x);
  const m = g.msg || { kind: 'info', text: '' };
  const pal = { info: ['rgba(242,197,0,.14)', '#f2c500'], warn: ['rgba(255,162,31,.2)', '#ffa21f'], bad: ['rgba(255,90,77,.22)', '#ff5a4d'], good: ['rgba(76,197,130,.2)', '#4cc582'] }[m.kind] || ['rgba(242,197,0,.14)', '#f2c500'];
  rr(c, 22, 122, W - 44, 92, 18); c.fillStyle = pal[0]; c.fill(); c.strokeStyle = pal[1]; c.lineWidth = 3; c.stroke();
  for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(56 + i * 24, 168, 8, 0, 7); c.fillStyle = i < g.dots ? '#f2c500' : 'rgba(255,255,255,.25)'; c.fill() }
  c.fillStyle = '#f4efe4'; c.font = `800 40px ${F}`; c.textAlign = 'left'; c.fillText(m.text, 160, 182);
  c.fillStyle = '#a9b0b8'; c.font = `500 25px ${F}`; wrap(c, g.hint || '', 26, 256, W - 52, 30);
}

/* ============ audio (igual que la versión 2D) ============ */
const A = { ctx: null, muted: false, t: 0 };
function audioInit() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const c = A.ctx = new AC();
  A.master = c.createGain(); A.master.gain.value = A.muted ? 0 : 1;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -28; comp.knee.value = 20; comp.ratio.value = 10; comp.attack.value = .004; comp.release.value = .2;
  const mk = c.createGain(); mk.gain.value = 2.4;
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .1;
  A.master.connect(comp); comp.connect(mk); mk.connect(lim); lim.connect(c.destination);
  const len = c.sampleRate * 2, wb = c.createBuffer(1, len, c.sampleRate), bb = c.createBuffer(1, len, c.sampleRate);
  const d = wb.getChannelData(0), d2 = bb.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; d[i] = w; last = (last + .02 * w) / 1.02; d2[i] = last * 3.5 }
  A.wb = wb;
  const loop = b => { const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.start(); return s };
  const chain = (src, type, f, q) => { const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const gn = c.createGain(); gn.gain.value = 0; src.connect(fl); fl.connect(gn); gn.connect(A.master); return { fl, gn } };
  A.fire = chain(loop(bb), 'lowpass', 700, .7);
  A.crk = chain(loop(wb), 'bandpass', 2600, .7);
  A.ext = chain(loop(wb), 'bandpass', 3000, .6);
  const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 900;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  A.alG = c.createGain(); A.alG.gain.value = 0; o.connect(lp); lp.connect(A.alG); A.alG.connect(A.master); o.start(); A.alO = o;
}
function tone(f, d, type = 'sine', v = .25, delay = 0, slide = 0) {
  if (!A.ctx) return; const c = A.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g); g.connect(A.master); o.start(t); o.stop(t + d + .05);
}
function burst(d, f, v, type = 'bandpass') {
  if (!A.ctx) return; const c = A.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = A.wb;
  const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = c.createGain();
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(fl); fl.connect(g); g.connect(A.master); s.start(t); s.stop(t + d + .05);
}
const SFX = {
  pin() { tone(1900, .08, 'square', .12); tone(1300, .1, 'square', .1, .06); burst(.08, 5000, .2) },
  lever() { tone(300, .06, 'square', .15); burst(.05, 2000, .15) },
  click() { tone(900, .05, 'triangle', .15) },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .28, 'triangle', .28, i * .11)) },
  lose() { tone(330, .5, 'sawtooth', .2, 0, -160); tone(220, .7, 'sawtooth', .2, .25, -100) },
  zap() { burst(.5, 3500, .6, 'highpass'); tone(120, .5, 'sawtooth', .3, 0, -60); tone(60, .6, 'square', .25) },
  flare() { burst(1.1, 500, .8, 'lowpass'); tone(90, .9, 'sawtooth', .25, 0, -40) },
  warn() { tone(700, .09, 'triangle', .18) },
  door() { tone(520, .12, 'triangle', .2); tone(780, .2, 'triangle', .2, .1) }
};
function audioTick(dt) {
  if (!A.ctx) return; const c = A.ctx, t = c.currentTime, g = G; A.t += dt;
  const play = mode === 'play' && g;
  const frac = g ? clamp(g.sum / g.N, 0, 1) : 0, prox = clamp(2.5 / Math.max(dist, .6), .35, 1.5);
  A.fire.gn.gain.setTargetAtTime(play ? (.04 + frac * .5) * prox : .05, t, .1);
  A.crk.gn.gain.setTargetAtTime(0, t, .02);
  if (play && Math.random() < frac * dt * 30) { A.crk.gn.gain.setValueAtTime(rnd(.08, .3) * (.4 + frac) * prox, t); A.crk.gn.gain.exponentialRampToValueAtTime(.001, t + .05) }
  const on = play && g.disch;
  if (on) A.ext.fl.frequency.setTargetAtTime(AG[g.agent].freq, t, .03);
  A.ext.gn.gain.setTargetAtTime(on ? .55 : 0, t, .03);
  A.alO.frequency.setTargetAtTime(Math.floor(A.t * 2) % 2 ? 760 : 980, t, .005);
  A.alG.gain.setTargetAtTime(play && !g.over ? (g.L.smoke ? .1 : .06) : 0, t, .05);
}
function setMuted(m) { A.muted = m; if (A.master) A.master.gain.value = m ? 0 : 1; if (m && 'speechSynthesis' in window) try { speechSynthesis.cancel() } catch (e) { } }

/* ============ voz ============ */
let VOICE = null, lastSay = 0;
function pickVoice() {
  if (!('speechSynthesis' in window)) return; const vs = speechSynthesis.getVoices();
  VOICE = vs.find(v => v.lang.replace('_', '-') === 'es-CL') || vs.find(v => /^es-(419|US|MX|AR)/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice }
function say(txt, force) {
  if (A.muted || !('speechSynthesis' in window)) return;
  const n = performance.now(); if (!force && n - lastSay < 1700) return; lastSay = n;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = VOICE ? VOICE.lang : 'es-CL'; if (VOICE) u.voice = VOICE; u.rate = 1.08; speechSynthesis.speak(u) } catch (e) { }
}

/* ============ estado ============ */
let mode = 'menu', G = null, selLevel = Math.min(SAVE.unlocked, 1) || 1, dist = 4.2, flash = null, room = null, needPlace = 0;
const lever = { mouse: false, key: false }, keys = {};

function headLocal(out) { camera.getWorldPosition(out); return world.worldToLocal(out) }
function headYaw() { camera.getWorldDirection(v0); return Math.atan2(-v0.x, -v0.z) }
function placeWorld() {
  camera.updateMatrixWorld(true);
  const hp = camera.getWorldPosition(V3()), yaw = headYaw();
  world.position.set(hp.x, 0, hp.z); world.rotation.set(0, yaw, 0); world.updateMatrixWorld(true);
}
function placeUI() {
  camera.updateMatrixWorld(true);
  const hp = camera.getWorldPosition(V3()), yaw = headYaw();
  UI.mesh.position.set(hp.x - Math.sin(yaw) * 1.25, Math.max(1.0, hp.y - .12), hp.z - Math.cos(yaw) * 1.25);
  UI.mesh.rotation.set(0, yaw, 0);
}

function newGame(n, agent) {
  const L = LV[n - 1], s = SCN[L.scene], FZ = -(AR ? Math.min(L.dist, AR_DIST) : L.dist);
  const cells = L.cells.map(c => ({ x: (c[0] - L.cx) * U, y: s.yb(c), z: FZ + s.cz, lit: c[2] > 0, ever: c[2] > 0, life: c[2], heat: 0, cover: 0, seed: Math.random() * 20 }));
  const sum = cells.reduce((a, c) => a + c.life, 0);
  return {
    n, L, agent, cells, N: cells.length, sum, sum0: sum, charge: L.charge, T0: L.time + EXTRA_T, timeLeft: L.time + EXTRA_T, t: 0, over: false, pend: null, FZ,
    pinOut: false, pinAt: null, aimed: false, usedLever: false, disch: false, vS: 0, hx: null, ai: {}, baseT: 0, hit: null,
    smoke: 0, wt: { off: 0, far: 0, still: 0 }, nag: {}, warn: null, winT: 0, failT: 0, fail: null, note: null,
    st: { dis: 0, base: 0, high: 0, off: 0, far: 0, near: 0, good: 0, still: 0, sweep: 0, rek: 0, nagPin: 0, empty: false }, sweepDone: false, evac: null
  };
}
function disposeLevel() {
  levelG.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && !m.map.userData.keep) m.map.dispose(); m.dispose() });
  });
  levelG.clear();
}
function buildLevel(g) {
  disposeLevel();
  const L = g.L, s = SCN[L.scene], FZ = g.FZ;
  const shell = new THREE.Group(); shell.visible = !AR; levelG.add(shell);
  room = buildRoom(shell, s, FZ);
  s.props(levelG, FZ, room.zb, room.x1, s.door);
  hemi.intensity = s.hemi; sun.intensity = s.hemi;
  const K = KIND[L.cls];
  for (const c of g.cells) {
    const grp = new THREE.Group(); grp.position.set(c.x, c.y, c.z);
    c.sp = K.c.map(col => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: FLAME, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.center.set(.5, .04); grp.add(sp); return sp });
    c.gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: K.c[1], blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .4 }));
    grp.add(c.gl); c.g = grp; levelG.add(grp);
  }
  if (L.smoke) {
    scene.fog = new THREE.FogExp2(0x34363a, AR ? .05 : .02); scene.background = AR ? null : new THREE.Color(0x34363a);
    g.smokeP = plane(levelG, room.x1 - room.x0, room.zf - room.zb, MB(0x2a2b2e, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), (room.x0 + room.x1) / 2, 2.75, (room.zb + room.zf) / 2, 0, Math.PI / 2);
  } else { scene.fog = null; scene.background = AR ? null : BG }
  HUD.mesh.position.set(0, 2.36, FZ + .05);
  smokePS.clear(); sparkPS.clear(); streamPS.clear(); cloudPS.clear();
  alarmLight.position.set(0, 2.5, FZ + 1.2); alarmLight.intensity = 0;
}
function previewLevel(n) {
  selLevel = n; placeWorld();
  G = newGame(n, LV[n - 1].opts[0]); G.over = true; dist = G.L.dist; buildLevel(G);
}
function resetExt(agent) {
  if (EXT.labelMat.map) EXT.labelMat.map.dispose();
  EXT.labelMat.map = labelTex(agent); EXT.labelMat.needsUpdate = true;
  EXT.g.add(EXT.pin); EXT.pin.position.set(.005, 0, .045); EXT.pin.rotation.set(0, 0, 0); EXT.pin.visible = true; pinFly = null;
  NOZ.horn.visible = !!AG[agent].horn; EXT.gk = -1;
}
function startLevel(n, agent) {
  audioInit(); SFX.click();
  placeWorld();
  G = newGame(n, agent); dist = G.L.dist; flash = null; buildLevel(G); resetExt(agent);
  mode = 'play'; UI.mesh.visible = false; HUD.mesh.visible = true; lastStep = 0;
  setStep(true); say('¡Fuego! Saca el pasador.', true);
}
function goLevel(n) {
  audioInit(); SFX.click();
  selLevel = n; const L = LV[n - 1];
  if (L.opts.length < 2) { startLevel(n, L.opts[0]); return }
  previewLevel(n); mode = 'pick';
  UI.order = [...L.opts].sort(() => Math.random() - .5); UI.draw = drawPick; UI.hover = null; UI.redraw();
  placeUI(); UI.mesh.visible = true; HUD.mesh.visible = false;
}
function openMenu() {
  try { speechSynthesis.cancel() } catch (e) { }
  mode = 'menu'; selLevel = Math.min(selLevel, SAVE.unlocked); previewLevel(selLevel);
  UI.draw = drawMenu; UI.hover = null; UI.redraw(); placeUI(); UI.mesh.visible = true; HUD.mesh.visible = false;
  lever.mouse = lever.key = false; ctrls.forEach(s => s.lev = false);
}

/* ============ avisos y pasos ============ */
let lastStep = 0;
const HINT_XR = ['Acerca la mano derecha al anillo amarillo del extintor y aprieta el grip (o pulsa A / X).', 'Apunta la boquilla al círculo amarillo: la base del fuego.', 'Mantén apretado el gatillo para descargar.', 'Mueve la boquilla de lado a lado. Con el stick izquierdo acércate a 2–3 m.'];
const HINT_PC = ['Pulsa P para sacar el pasador.', 'Lleva el mouse al círculo amarillo: la base del fuego.', 'Mantén el clic izquierdo o la barra espaciadora.', 'Mueve el mouse de lado a lado. Con W / S acércate a 2–3 m.'];
function note(kind, text, ms, voice) { G.warn = { kind, text, until: performance.now() + ms }; if (voice) say(voice); SFX.warn() }
function nag(key, text, voice, cool = 3.5) { const g = G; if (g.nag[key] !== undefined && g.t - g.nag[key] < cool) return; g.nag[key] = g.t; note('warn', text, 1700, voice || text) }
const curStep = g => !g.pinOut ? 1 : !g.aimed ? 2 : !g.usedLever ? 3 : 4;
function setStep(force) {
  const g = G; if (!g) return; const s = curStep(g);
  g.dots = (g.pinOut ? 1 : 0) + (g.aimed ? 1 : 0) + (g.usedLever ? 1 : 0) + (g.sweepDone ? 1 : 0);
  if (g.warn && performance.now() < g.warn.until) g.msg = { kind: g.warn.kind, text: g.warn.text };
  else if (g.L.smoke && g.smoke > .55 && !g.over) g.msg = { kind: 'warn', text: 'Mucho humo: evacúa por la puerta verde' };
  else g.msg = { kind: 'info', text: `${s} · ${STEPTX[s - 1][1]}` };
  g.hint = (isXR() ? HINT_XR : HINT_PC)[s - 1] + (g.L.smoke ? (isXR() ? ' Para evacuar, camina a la puerta verde de la derecha.' : ' Para evacuar: tecla E o camina a la puerta verde.') : '');
  if (s !== lastStep || force) { lastStep = s; if (!force) say(STEPTX[s - 1][1]) }
}

/* ============ reglas del juego (portadas de la versión 2D) ============ */
const rAim = d => 52 + d * 9;
function qHeight(dy) { if (dy < -14) return lerp(1, .07, clamp((-14 - dy) / 60, 0, 1)); if (dy > 30) return lerp(1, .15, clamp((dy - 30) / 80, 0, 1)); return 1 }
function qDist(d) {
  const T = [[1, .35], [1.5, .6], [2, 1], [3, 1], [3.6, .75], [4.5, .35], [6, .1]];
  for (let i = 1; i < T.length; i++) if (d <= T[i][0]) return lerp(T[i - 1][1], T[i][1], clamp((d - T[i - 1][0]) / (T[i][0] - T[i - 1][0]), 0, 1)); return .1;
}
function qSweep(v) { let a = clamp((v - 12) / 55, 0, 1); a = a * a * (3 - 2 * a); let q = .1 + .9 * a; if (v > 380) q *= lerp(1, .5, clamp((v - 380) / 300, 0, 1)); return q }
const DMG = .28;
const leverHeld = () => lever.mouse || lever.key || ctrls.some(s => s.lev);

function pullPin() {
  const g = G; if (mode !== 'play' || !g || g.over || g.pinOut) return;
  g.pinOut = true; g.pinAt = g.t; SFX.pin();
  scene.attach(EXT.pin); pinFly = { v: new THREE.Vector3(rnd(-.4, .4), 1.4, rnd(-.4, .4)), t: 0 };
  setStep();
}
function evacuate() {
  const g = G; if (mode !== 'play' || !g || g.over || !g.L.smoke) return;
  g.over = true; g.evac = 0; SFX.door(); say('Evacuando por la salida de emergencia.', true);
  g.pend = { win: true, reason: 'evac', delay: 1.4 };
}
function aimRayLocal() {
  const o = V3(), d = V3();
  if (isXR()) { NOZ.g.getWorldPosition(o); d.set(0, 0, -1).applyQuaternion(NOZ.g.getWorldQuaternion(q0)) }
  else { ray.setFromCamera(mouse, camera); o.copy(ray.ray.origin); d.copy(ray.ray.direction) }
  world.worldToLocal(o); d.applyQuaternion(world.getWorldQuaternion(q0).invert());
  return { o, d };
}

function update(dt) {
  const g = G, L = g.L; g.t += dt;
  const hd = headLocal(V3());
  const lit = g.cells.filter(c => c.lit), ref = lit.length ? lit : g.cells;
  let mnx = 1e9, mxx = -1e9; for (const c of ref) { mnx = Math.min(mnx, c.x); mxx = Math.max(mxx, c.x) }
  const fz = ref[0].z;
  const dd = Math.hypot(hd.x - clamp(hd.x, mnx, mxx), hd.z - fz); if (Number.isFinite(dd)) dist = Math.max(.3, dd);
  // apuntado: el rayo de la boquilla (o del mouse) contra el plano vertical del fuego
  const r = aimRayLocal(); let hit = null;
  if (r.d.z < -.05) { const t = (fz - r.o.z) / r.d.z; if (t > 0 && t < 20) hit = r.o.clone().addScaledVector(r.d, t); if (hit && !Number.isFinite(hit.x + hit.y)) hit = null }
  g.hit = hit;
  if (hit) {
    if (g.hx === null) g.hx = hit.x;
    const px = g.hx; g.hx += (hit.x - g.hx) * Math.min(1, dt * 14);
    const v = Math.max(0, Math.abs(g.hx - px) / Math.max(dt, 1e-3) - .05) / U;  // se descuenta el temblor de la mano
    g.vS += (v - g.vS) * Math.min(1, dt * 7);
  } else { g.hx = null; g.vS *= Math.max(0, 1 - dt * 5) }
  const R_ = rAim(dist), qd = qDist(dist), qs = qSweep(g.vS);
  let near = null, nd = 1e9;
  if (hit) for (const c of g.cells) if (c.lit && c.life > .03) { const d = Math.abs(hit.x - c.x) / U; if (d < nd) { nd = d; near = c } }
  const ai = g.ai = { off: true, high: false, base: false };
  if (near) { const dy = (near.y - hit.y) / V; ai.off = nd > R_; ai.base = !ai.off && qHeight(dy) > .7; ai.high = !ai.off && dy < -30 }
  if (ai.base && !g.aimed) { g.baseT += dt; if (g.baseT > .4 && g.pinOut) g.aimed = true }
  // descarga
  g.disch = false;
  if (!g.over && leverHeld()) {
    if (!g.pinOut) { if (g.nag.pin === undefined || g.t - g.nag.pin > 2.5) { g.nag.pin = g.t; g.st.nagPin++; note('warn', 'Saca el pasador primero', 1800, 'Saca el pasador primero') } }
    else if (g.charge > 0) {
      g.disch = true; g.usedLever = true; g.charge = Math.max(0, g.charge - dt);
      if (g.charge === 0) { g.disch = false; g.st.empty = true; g.emptyAt = g.t; note('bad', 'Sin carga', 2600, 'Sin carga') }
    }
  }
  const EF = EFF[L.cls][g.agent] || { e: .2, rk: 1 };
  const hitNow = new Set();
  if (g.disch) {
    const s = g.st;
    if (lit.length) {
      s.dis += dt;
      if (ai.off) s.off += dt; else { if (ai.high) s.high += dt; if (ai.base) s.base += dt }
      if (dist > 3.6) s.far += dt; if (dist < 1.7) s.near += dt; if (dist >= 2 && dist <= 3.2) s.good += dt;
      if (g.vS < 12) s.still += dt; if (qs > .75) { s.sweep += dt; g.sweepT = (g.sweepT || 0) + dt; if (g.sweepT > 1.5) g.sweepDone = true }
    }
    g.wt.off = ai.off ? g.wt.off + dt : 0; g.wt.far = dist > 3.8 ? g.wt.far + dt : 0; g.wt.still = g.vS < 10 ? g.wt.still + dt : 0;
    g.wt.high = ai.high ? (g.wt.high || 0) + dt : 0; g.wt.near = dist < 1.6 ? (g.wt.near || 0) + dt : 0;
    if (g.wt.off > .7) nag('off', 'Apunta al fuego');
    else if (g.wt.near > .5) nag('near', 'Aléjate un poco');
    else if (g.wt.far > .7) nag('far', 'Acércate un poco');
    else if (g.wt.high > .6) nag('high', 'Apunta a la base');
    else if (g.wt.still > 1) nag('still', 'Barre de lado a lado');
    if (EF.note && !g.note && ai.base) g.note = EF.note;
    let failHit = false;
    if (hit) for (const c of g.cells) {
      const dx = (hit.x - c.x) / U; if (Math.abs(dx) > R_) continue;
      const qx = 1 - (dx / R_) * (dx / R_), qh = qHeight((c.y - hit.y) / V);
      if (EF.fail) { if (c.lit && qh > .3 && qx > .2) failHit = true; continue }
      const qq = qh * qd * qs * qx * EF.e; hitNow.add(c);
      c.cover = Math.min(1, c.cover + 1.3 * qh * qd * qx * EF.e * (.5 + .5 * qs) * dt);
      if (c.lit) c.life -= DMG * qq * dt;
    }
    if (EF.fail) { g.failT = failHit ? g.failT + dt : Math.max(0, g.failT - dt); if (g.failT > .45 && !g.over) triggerFail(EF.fail) }
  }
  // dinámica del fuego
  let sum = 0; const cs = g.cells;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (!hitNow.has(c)) c.cover = Math.max(0, c.cover - .06 * dt);
    if (c.lit) {
      if (c.life < .02) { c.lit = false; c.life = 0; c.cover = Math.max(c.cover, .4); c.heat = 0; continue }
      const rate = L.g + L.gre * (EF.rk ?? 1) * (1 - c.cover) * (c.life < .5 ? 1 : .35);
      c.life = Math.min(1, c.life + rate * (1 - c.life) * dt); sum += c.life;
    } else {
      let src = 0; if (i > 0 && cs[i - 1].lit) src = Math.max(src, cs[i - 1].life); if (i < cs.length - 1 && cs[i + 1].lit) src = Math.max(src, cs[i + 1].life);
      if (src > .3) {
        const rt = c.ever ? L.rek * (EF.rk ?? 1) * src * (1 - c.cover) : L.spread * src * (1 - c.cover * .5);
        c.heat += rt * dt;
        if (c.heat >= 1) { c.lit = true; c.life = .15; c.heat = 0; if (c.ever) g.st.rek++; c.ever = true; for (let j = 0; j < 6; j++) sparkPS.add(spark(c)) }
      } else c.heat = Math.max(0, c.heat - .2 * dt);
    }
  }
  g.sum = sum;
  if (L.smoke) g.smoke = clamp(g.smoke + dt * ((.012 + .07 * sum / g.N) - (sum < .05 ? .03 : 0)), 0, 1);
  // evacuación: caminar hasta la puerta
  const sc = SCN[L.scene];
  if (L.smoke && !g.over && hd.x > room.x1 - .9 && Math.abs(hd.z - sc.door) < 1.0) evacuate();
  if (!g.over) {
    g.timeLeft -= dt;
    if (!cs.some(c => c.lit)) { g.winT += dt; if (g.winT > .5) { g.over = true; g.pend = { win: true, reason: 'done', delay: .5 } } }
    else g.winT = 0;
    if (!g.over) {
      if (sum >= L.lose * g.N) { g.over = true; g.pend = { win: false, reason: 'out', delay: .8 } }
      else if (g.timeLeft <= 0) { g.timeLeft = 0; g.over = true; g.pend = { win: false, reason: 'time', delay: .6 }; say('Se acabó el tiempo.', true) }
      else if (g.charge <= 0 && g.emptyAt !== undefined && g.t - g.emptyAt > 1.4) { g.over = true; g.pend = { win: false, reason: 'empty', delay: .4 } }
      else if (L.smoke && g.smoke >= 1) { g.over = true; g.pend = { win: false, reason: 'smoke', delay: .6 }; say('Demasiado humo.', true) }
      else if (L.smoke && g.smoke > .55 && !g.nag.evac) { g.nag.evac = g.t; SFX.warn(); say('Mucho humo. Evacúa ahora.', true) }
    }
  }
  if (g.evac !== null) g.evac += dt;
  setStep();
  if (g.pend) { g.pend.delay -= dt; if (g.pend.delay <= 0) { const p = g.pend; g.pend = null; finish(p.win, p.reason) } }
}
function triggerFail(kind) {
  const g = G; g.over = true; g.disch = false;
  if (kind === 'elec') { SFX.zap(); flash = { t: 0, d: .9, col: 0xc8e6ff }; say('¡Descarga eléctrica! No uses agua.', true) }
  else {
    SFX.flare(); flash = { t: 0, d: 1.1, col: 0xffaa3c }; for (const c of g.cells) { c.lit = true; c.life = Math.max(c.life, .95); c.ever = true }
    say(kind === 'flare' ? '¡Llamarada! No uses agua en aceite.' : '¡El agua esparció el fuego!', true);
  }
  g.pend = { win: false, reason: kind, delay: 1.5 };
}
function finish(win, reason) {
  const g = G, L = g.L; mode = 'end';
  try { speechSynthesis.cancel() } catch (e) { }
  const tUsed = g.T0 - g.timeLeft; let stars = 0;
  if (win) {
    if (reason === 'evac') stars = g.smoke <= .3 ? 3 : g.smoke <= .55 ? 2 : 1;
    else { stars = 1; if (tUsed <= g.T0 * .6) stars++; if (g.charge >= L.charge * .3) stars++; if (g.note) stars = Math.min(stars, 2); if (L.smoke) stars = g.smoke < .35 ? 2 : 1 }
    SAVE.stars[L.id - 1] = Math.max(SAVE.stars[L.id - 1] || 0, stars); SAVE.unlocked = Math.max(SAVE.unlocked, Math.min(5, L.id + 1)); persist(); SFX.win(); say('¡Bien! Fuego controlado.', true);
  } else SFX.lose();
  const titles = { time: 'Se acabó el tiempo', empty: 'Sin carga', out: 'El fuego se salió de control', elec: 'Error grave: descarga eléctrica', flare: 'Error grave: llamarada', spread: 'Error grave: el fuego se propagó', smoke: 'El humo te alcanzó' };
  g.endData = {
    win, stars,
    title: win ? (reason === 'evac' ? (g.smoke <= .55 ? 'Evacuaste a tiempo' : 'Evacuaste, pero tarde') : '¡Fuego apagado!') : titles[reason] || 'Intento fallido',
    meta: win ? (reason === 'evac' ? `Salida en ${fmtT(tUsed)} · humo ${Math.round(g.smoke * 100)}%` : `Tiempo usado ${fmtT(tUsed)} · carga restante ${fmtN(g.charge)} s`) : `${L.name} · intento ${fmtT(tUsed)}`,
    fb: buildFeedback(win, reason)
  };
  lever.mouse = lever.key = false; ctrls.forEach(s => s.lev = false);
  UI.draw = drawEnd; UI.hover = null; UI.redraw(); placeUI(); UI.mesh.visible = true; HUD.mesh.visible = false;
}
function buildFeedback(win, reason) {
  const g = G, L = g.L, s = g.st, neg = [], pos = []; const d = Math.max(s.dis, .001);
  if (reason === 'elec') neg.push('El agua conduce electricidad: en equipos energizados usa CO₂ o polvo ABC.');
  if (reason === 'flare') neg.push('El agua sobre aceite caliente provoca una llamarada: usa un extintor Clase K.');
  if (reason === 'spread') neg.push('El agua esparce el líquido inflamable y propaga el fuego: usa polvo ABC o CO₂.');
  if (g.note === 'abc_c') neg.push('El polvo ABC apaga, pero daña los equipos: en eléctrico es mejor CO₂.');
  if (g.note === 'abc_k') neg.push('El polvo ABC no enfría la grasa caliente y el fuego rebrota: usa Clase K.');
  if (g.note === 'co2_b') neg.push('El CO₂ rinde poco en derrames de líquido: el polvo ABC es mejor.');
  if (reason === 'smoke') neg.push('Con tanto humo había que evacuar antes: la vida vale más que el fuego.');
  if (reason === 'evac' && g.smoke > .55) neg.push('Evacuaste, pero tarde: decide antes de que el humo sea denso.');
  if (L.smoke && win && reason !== 'evac' && g.smoke > .35) neg.push('Lo lograste, pero con mucho humo. Evacuar era lo más seguro.');
  if (reason === 'evac') { } else if (g.pinAt === null) neg.push('No sacaste el pasador: sin pasador el extintor no descarga.');
  else if (g.pinAt > 7) neg.push('Demoraste en sacar el pasador.');
  if (g.pinAt !== null && s.dis < .5 && !L.smoke) neg.push('Casi no descargaste el extintor.');
  if (s.dis > .5) {
    if (s.high / d > .22) neg.push('Apuntaste muy alto: hay que apuntar a la base.');
    if (s.still / d > .3) neg.push('No barriste: te quedaste en un solo punto.');
    if (s.far / d > .3) neg.push('Estabas muy lejos del fuego.');
    if (s.near / d > .25) neg.push('Te acercaste demasiado.');
    if (s.off / d > .25) neg.push('Descargaste fuera del fuego.');
    if (s.rek > 0 && !win) neg.push('El fuego rebrotó: barre toda la base, incluso los bordes.');
  }
  if (reason === 'empty') neg.push('Se acabó la carga: descarga en ráfagas cortas y solo sobre el fuego.');
  if (reason === 'time') neg.push('Se acabó el tiempo: actúa más rápido.');
  if (reason === 'out' && !neg.length) neg.push('El fuego se propagó: no te demores en descargar.');
  if (s.dis > .5) {
    if (s.base / d > .6) pos.push('Apuntaste a la base del fuego.');
    if (s.sweep / d > .5) pos.push('Barriste bien de lado a lado.');
    if (s.good / d > .6) pos.push('Mantuviste una buena distancia (2 a 3 m).');
  }
  if (win && g.charge >= L.charge * .3 && !L.smoke) pos.push('Cuidaste la carga del extintor.');
  if (win && !g.note && L.opts.length > 1) pos.push('Elegiste el extintor correcto.');
  if (win && reason === 'evac' && g.smoke <= .55) pos.push('Priorizaste tu seguridad: evacuaste a tiempo.');
  if (win && L.smoke && reason === 'done' && g.smoke <= .35) pos.push('Actuaste rápido, con poco humo todavía.');
  const out = neg.slice(0, 3).map(t => ({ ok: false, t }));
  pos.slice(0, Math.max(1, 4 - out.length)).forEach(t => out.push({ ok: true, t }));
  return out.slice(0, 4);
}

/* ============ efectos ============ */
const spark = c => ({ x: c.x + rnd(-.08, .08), y: c.y + .1, z: c.z + rnd(-.05, .05), vx: rnd(-.3, .3), vy: rnd(.7, 1.5), vz: rnd(-.3, .3), gr: -1.2, l: rnd(.4, .9), s0: .035, s1: .01, a0: 1, c: [1, .75, .35] });
function updateFx(dt, t) {
  const g = G; if (!g) return;
  for (const c of g.cells) if (c.lit) {
    if (Math.random() < dt * 6 * c.life) smokePS.add({ x: c.x + rnd(-.08, .08), y: c.y + .3 + c.life * .7, z: c.z + rnd(-.05, .05), vx: rnd(-.06, .06), vy: rnd(.35, .6), vz: rnd(-.06, .06), l: rnd(1.6, 2.6), s0: .25, s1: .95, a0: g.L.cls === 'B' ? .7 : .5, fi: true, c: [.25, .25, .27] });
    if (g.L.cls === 'C' && Math.random() < dt * 5 * c.life) sparkPS.add({ x: c.x + rnd(-.12, .12), y: c.y + rnd(0, .3), z: c.z + .05, vx: rnd(-.8, .8), vy: rnd(-.2, 1), vz: rnd(0, .5), l: rnd(.15, .35), s0: .05, s1: .02, a0: 1, c: [.75, .88, 1] });
    else if (Math.random() < dt * 4 * c.life) sparkPS.add(spark(c));
  }
  if (mode === 'play' && g.disch) {
    const ap = AGP[g.agent];
    const tip = V3().set(0, 0, AG[g.agent].horn ? -.22 : -.07); NOZ.g.localToWorld(tip); world.worldToLocal(tip);
    const dl = V3().set(0, 0, -1).applyQuaternion(NOZ.g.getWorldQuaternion(q0)).applyQuaternion(world.getWorldQuaternion(new THREE.Quaternion()).invert());
    let n = ap.rate * dt;
    while (n > 0 && (n >= 1 || Math.random() < n)) {
      n--; const sp = ap.sp * rnd(.85, 1.1), j = .09 * sp;
      streamPS.add({ x: tip.x, y: tip.y, z: tip.z, vx: dl.x * sp + rnd(-j, j), vy: dl.y * sp + rnd(-j, j), vz: dl.z * sp + rnd(-j, j), gr: ap.gr, dr: ap.dr, floor: true, l: rnd(.5, .75), s0: ap.s0, s1: ap.s1, a0: ap.a, c: ap.col });
    }
    if (ap.cloud && g.hit && Math.random() < dt * 40) {
      const h = g.hit; cloudPS.add({ x: h.x + rnd(-.15, .15), y: Math.max(.05, h.y + rnd(-.05, .1)), z: h.z + rnd(0, .2), vx: rnd(-.1, .1), vy: rnd(.1, .4), vz: rnd(0, .15), l: rnd(.7, 1.1), s0: .25, s1: .8, a0: .35, c: ap.col });
    }
  }
  smokePS.update(dt); sparkPS.update(dt); streamPS.update(dt); cloudPS.update(dt);
  if (pinFly) {
    pinFly.t += dt; pinFly.v.y -= 9.8 * dt; EXT.pin.position.addScaledVector(pinFly.v, dt); EXT.pin.rotation.x += dt * 9;
    if (pinFly.t > 1.4) { EXT.pin.visible = false; pinFly = null }
  }
}
function updateVisuals(dt, t) {
  const g = G; if (!g) return;
  const K = KIND[g.L.cls]; let lx = 0, ly = 0, lz = 0, ln = 0;
  for (const c of g.cells) {
    const on = c.lit && c.life > .01; c.g.visible = on; if (!on) continue;
    const fl = .9 + .1 * Math.sin(t * 9 + c.seed), tilt = Math.sin(t * 2.6 + c.seed * 1.7) * .05 * c.life;
    const H = (12 + c.life * K.h) * U * fl, W = (10 + c.life * 16) * K.w * U * 2.6, hs = [1, .78, .52], ws = [1, .72, .42];
    c.sp.forEach((s, i) => { s.scale.set(W * ws[i], H * hs[i] * (1 + .08 * Math.sin(t * 14 + c.seed * 2 + i * 5)), 1); s.position.x = tilt * i * .5 });
    c.gl.scale.setScalar(.5 + c.life * .9); c.gl.position.y = .15; c.gl.material.opacity = .35 * Math.min(1, c.life * 1.6);
    lx += c.x; ly += c.y; lz += c.z; ln++;
  }
  if (ln) { fireLight.position.set(lx / ln, ly / ln + .5, lz / ln + .4); fireLight.intensity = (3 + 30 * g.sum / g.N) * (.85 + .15 * Math.sin(t * 17) * Math.sin(t * 5.3)) }
  else fireLight.intensity = 0;
  alarmLight.intensity = SCN[g.L.scene].alarm ? 4 + 4 * Math.sin(t * 5) : 0;
  // humo (nivel 5)
  if (g.L.smoke && scene.fog) { scene.fog.density = .02 + g.smoke * .45; if (g.smokeP) { g.smokeP.position.y = Math.max(1.85, 2.75 - g.smoke * 1.2); g.smokeP.material.opacity = .25 + .6 * g.smoke } }
  // guía de la base y retícula
  const play = mode === 'play' && !g.over;
  marker.visible = play && !g.aimed && ln > 0;
  if (marker.visible) { marker.position.set(lx / ln, ly / ln + .02, lz / ln + .1); marker.scale.setScalar(1 + .12 * Math.sin(t * 5)) }
  reticle.visible = play && !!g.hit;
  if (reticle.visible) {
    reticle.position.copy(g.hit); reticle.position.z += .05;
    reticle.material.color.set(g.ai.off ? 0xffffff : g.ai.base ? 0x4cc582 : 0xffa21f);
    reticle.scale.setScalar(clamp(dist / 2.5, .7, 1.6) * (g.disch ? 1 + .12 * Math.sin(t * 30) : 1));
  }
  // extintor
  const showExt = mode === 'play';
  EXT.g.visible = NOZ.g.visible = showExt; if (hose) hose.visible = showExt;
  if (showExt) {
    EXT.lever.rotation.z = g.disch || (leverHeld() && g.pinOut) ? -.25 : 0;
    drawGauge(EXT, g.charge / g.L.charge);
    if (!g.pinOut) EXT.pinMat.color.setHSL(.14, 1, .45 + .2 * Math.sin(t * 6));
    updHose();
  }
  // superposición (destello, evacuación, calor)
  let a = 0, col = 0;
  if (flash) { flash.t += dt; a = .85 * (1 - flash.t / flash.d); col = flash.col; if (flash.t > flash.d) flash = null }
  else if (mode === 'play' && g.evac !== null) { a = clamp(g.evac / 1.1, 0, 1); col = 0x0a2818 }
  else if (mode === 'play' && dist < 1.6 && g.sum > 0) { a = clamp((1.6 - dist) / .8, 0, 1) * .35 * clamp(g.sum / g.N * 2, 0, 1); col = 0xff3c00 }
  overlay.visible = a > .003; if (overlay.visible) { overlay.material.opacity = a; overlay.material.color.set(col) }
  // HUD
  if (HUD.mesh.visible) {
    const k = [Math.ceil(g.timeLeft), Math.round(100 * g.sum / g.sum0), Math.round(g.smoke * 100), Math.round(g.charge * 10), Math.round(dist * 10), g.msg && g.msg.kind + g.msg.text, g.dots, g.hint].join('|');
    if (k !== HUD.key) { HUD.key = k; HUD.draw = drawHUD; HUD.redraw() }
  }
}

/* ============ poses: extintor en la mano izquierda, boquilla en la derecha ============ */
function updatePoses() {
  if (mode !== 'play') return;
  if (isXR()) {
    const R = rightC(), Lc = leftC(), yaw = headYaw();
    if (R) { R.c.getWorldPosition(NOZ.g.position); R.c.getWorldQuaternion(NOZ.g.quaternion) }
    if (Lc) Lc.gr.getWorldPosition(EXT.g.position);
    else { const hp = camera.getWorldPosition(v1); EXT.g.position.set(hp.x - Math.sin(yaw) * .2 - Math.cos(yaw) * .22, hp.y - .62, hp.z - Math.cos(yaw) * .2 + Math.sin(yaw) * .22) }
    EXT.g.rotation.set(0, yaw, 0);
  } else {
    camera.updateMatrixWorld(true);
    const yaw = headYaw();
    EXT.g.position.copy(camera.localToWorld(v1.set(.3, -.36, -.55))); EXT.g.rotation.set(0, yaw, 0);
    const np = camera.localToWorld(v2.set(.12, -.2, -.42));
    NOZ.g.position.copy(np);
    let target;
    if (G && G.hit) target = world.localToWorld(G.hit.clone());
    else { ray.setFromCamera(mouse, camera); target = ray.ray.origin.clone().addScaledVector(ray.ray.direction, 5) }
    m0.lookAt(np, target, UP); NOZ.g.quaternion.setFromRotationMatrix(m0);
  }
  EXT.g.updateMatrixWorld(true); NOZ.g.updateMatrixWorld(true);
}

/* ============ entrada: controles VR ============ */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
const ctrls = [0, 1].map(i => {
  const c = renderer.xr.getController(i), gr = renderer.xr.getControllerGrip(i);
  player.add(c); player.add(gr);
  const st = { c, gr, src: null, hand: null, lev: false, p4: false, p5: false, turned: false };
  st.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf2c500 })); st.line.visible = false; c.add(st.line);
  c.addEventListener('connected', e => { st.src = e.data; st.hand = e.data.handedness });
  c.addEventListener('disconnected', () => { st.src = null; st.hand = null; st.lev = false });
  c.addEventListener('selectstart', () => onSelect(st, true));
  c.addEventListener('selectend', () => onSelect(st, false));
  c.addEventListener('squeezestart', () => { if (mode === 'play' && G && !G.pinOut && nearPin(st)) pullPin() });
  return st;
});
const rightC = () => ctrls.find(s => s.src && s.hand === 'right') || ctrls.find(s => s.src) || null;
const leftC = () => { const r = rightC(); return ctrls.find(s => s.src && s !== r && s.hand === 'left') || null };
function nearPin(st) { return st !== leftC() && EXT.pin.parent === EXT.g && st.c.getWorldPosition(v1).distanceTo(EXT.pin.getWorldPosition(v2)) < .16 }
function onSelect(st, down) {
  audioInit();
  if (mode !== 'play') { if (down) { const o = st.c.getWorldPosition(V3()), d = V3().set(0, 0, -1).applyQuaternion(st.c.getWorldQuaternion(q0)); ray.set(o, d); uiClick() } return }
  if (down) {
    if (G && !G.pinOut && nearPin(st)) { pullPin(); return }
    st.lev = true; SFX.lever();
  } else st.lev = false;
}
function uiClick() {
  const h = UI.mesh.visible && ray.intersectObject(UI.mesh)[0];
  if (!h) return; const b = UI.at(h.uv); if (b) { SFX.click(); b.fn() }
}
function uiHover() {
  if (!UI.mesh.visible) { ctrls.forEach(s => s.line.visible = false); return }
  let hv = null;
  if (isXR()) {
    for (const st of ctrls) {
      st.line.visible = !!st.src; if (!st.src) continue;
      const o = st.c.getWorldPosition(V3()), d = V3().set(0, 0, -1).applyQuaternion(st.c.getWorldQuaternion(q0)); ray.set(o, d);
      const h = ray.intersectObject(UI.mesh)[0]; st.line.scale.z = h ? h.distance : 2;
      if (h) { const b = UI.at(h.uv); if (b) hv = b.id }
    }
  } else {
    ray.setFromCamera(mouse, camera); const h = ray.intersectObject(UI.mesh)[0];
    if (h) { const b = UI.at(h.uv); if (b) hv = b.id }
    renderer.domElement.style.cursor = hv ? 'pointer' : 'default';
  }
  if (hv !== UI.hover) { UI.hover = hv; UI.redraw() }
}
function pollXR(dt) {
  if (!isXR()) return;
  for (const st of ctrls) {
    const gp = st.src && st.src.gamepad; if (!gp) continue;
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const a4 = b(4), b5 = b(5);
    if (a4 && !st.p4) { audioInit(); if (mode === 'play') pullPin() } st.p4 = a4;
    if (b5 && !st.p5 && mode !== 'menu') openMenu(); st.p5 = b5;
    const ax = gp.axes[2] || 0, ay = gp.axes[3] || 0;
    if (st.hand === 'left') { if (mode === 'play' && Math.hypot(ax, ay) > .15) walk(ax, -ay, dt) }
    else if (Math.abs(ax) > .7) { if (!st.turned) { st.turned = true; snapTurn(ax > 0 ? -Math.PI / 6 : Math.PI / 6) } }
    else if (Math.abs(ax) < .3) st.turned = false;
  }
}
function walk(sx, fw, dt) {
  const yaw = headYaw(), sp = 1.5 * dt;
  player.position.x += (-Math.sin(yaw) * fw + Math.cos(yaw) * sx) * sp;
  player.position.z += (-Math.cos(yaw) * fw - Math.sin(yaw) * sx) * sp;
}
function snapTurn(a) {
  const hp = camera.getWorldPosition(V3());
  player.position.sub(hp).applyAxisAngle(UP, a).add(hp); player.rotation.y += a;
}
function clampPlayer() {
  if (mode !== 'play' || !room || !G) return;
  const hd = headLocal(V3());
  const cx = clamp(hd.x, room.x0 + .3, room.x1 - .3), cz = clamp(hd.z, G.FZ + .45, room.zf - .3);
  if (cx !== hd.x || cz !== hd.z) {
    const d = V3().set(cx - hd.x, 0, cz - hd.z).applyQuaternion(world.getWorldQuaternion(q0));
    player.position.add(d);
  }
}

/* ============ entrada: mouse y teclado ============ */
let yaw = 0, pitch = 0, look = null;
const cvs = renderer.domElement;
cvs.addEventListener('pointermove', e => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (look) { yaw -= (e.clientX - look.x) * .004; pitch = clamp(pitch - (e.clientY - look.y) * .004, -1.2, 1.2); look = { x: e.clientX, y: e.clientY }; camera.rotation.set(pitch, yaw, 0) }
});
cvs.addEventListener('pointerdown', e => {
  audioInit();
  if (e.button === 2) { look = { x: e.clientX, y: e.clientY }; return }
  if (e.button !== 0) return;
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (mode !== 'play') { ray.setFromCamera(mouse, camera); uiClick() }
  else { lever.mouse = true; SFX.lever() }
});
addEventListener('pointerup', e => { if (e.button === 2) look = null; else lever.mouse = false });
cvs.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  audioInit(); keys[e.code] = true;
  if (e.code === 'Escape' && mode !== 'menu') openMenu();
  if (e.code === 'KeyM') setMuted(!A.muted);
  if (mode !== 'play') return;
  if (e.code === 'Space') { e.preventDefault(); if (!lever.key) { lever.key = true; SFX.lever() } }
  else if (e.code === 'KeyP' || e.code === 'Enter') pullPin();
  else if (e.code === 'KeyE') evacuate();
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') lever.key = false });
addEventListener('blur', () => { lever.mouse = lever.key = false; for (const k in keys) keys[k] = false; look = null });
function moveDesktop(dt) {
  if (isXR() || mode !== 'play') return;
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (f || s) walk(s, f, dt);
}

/* ============ sesión VR ============ */
const bVR = $('#bVR');
if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then(ok => { bVR.hidden = !ok; $('#noVR').hidden = ok }).catch(() => { $('#noVR').hidden = false });
} else $('#noVR').hidden = false;
const bAR = $('#bAR');
if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-ar').then(ok => { bAR.hidden = !ok; if (ok) $('#noVR').hidden = true }).catch(() => { });
async function enterXR(ar) {
  audioInit();
  try {
    AR = ar;
    const s = await navigator.xr.requestSession(ar ? 'immersive-ar' : 'immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    await renderer.xr.setSession(s);
  } catch (e) { AR = false; alert('No se pudo iniciar la sesión ' + (ar ? 'de realidad mixta' : 'VR') + ': ' + e.message) }
}
bVR.addEventListener('click', () => enterXR(false));
bAR.addEventListener('click', () => enterXR(true));
function exitXR() { SFX.click(); const s = renderer.xr.getSession(); if (s) s.end().catch(() => { }) }
renderer.xr.addEventListener('sessionstart', () => {
  document.body.classList.add('xr'); renderer.xr.setFoveation(1);
  player.position.set(0, 0, 0); player.rotation.set(0, 0, 0); camera.rotation.set(0, 0, 0);
  openMenu(); needPlace = 4;
});
renderer.xr.addEventListener('sessionend', () => {
  document.body.classList.remove('xr'); AR = false;
  player.position.set(0, 0, 0); player.rotation.set(0, 0, 0);
  camera.position.set(0, 1.6, 0); yaw = pitch = 0; camera.rotation.set(0, 0, 0);
  resize(); openMenu();
});

/* ============ bucle ============ */
let T = 0;
renderer.setAnimationLoop(() => frame(Math.min(.05, clock.getDelta())));
function frame(dt) {
  T += dt;
  if (needPlace > 0 && --needPlace === 0) { previewLevel(selLevel); placeUI() }
  pollXR(dt); moveDesktop(dt); clampPlayer();
  updatePoses();
  if (mode === 'play' && G) update(dt);
  updateFx(dt, T); updateVisuals(dt, T); uiHover(); audioTick(dt);
  if (isXR()) { const xc = renderer.xr.getCamera(), vp = xc.cameras[0] && xc.cameras[0].viewport; PSCALE.value = vp && vp.w ? vp.w / 2 : 800 }
  else PSCALE.value = renderer.domElement.height / 2;
  renderer.render(scene, camera);
}

openMenu();
window.__vr = { get G() { return G }, get mode() { return mode }, get dist() { return dist }, startLevel, goLevel, openMenu, pullPin, evacuate, frame, lever, keys, mouse, UI };
