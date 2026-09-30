/* ICS Cademy — 3D Twin Instrument Area Berbahaya (Ex / ATEX / IECEx)
   Transmitter di Zona 1 dekat flange yang bocor. Pilih jenis proteksi, bocorkan gas, gagalkan instrument:
   - Ex-rated yang SESUAI (Ex db sesuai kelompok gas / Ex ia + barrier)  -> gagal dengan aman
   - Instrument biasa / Ex tidak sesuai zona atau kelompok gas          -> menjadi sumber nyala -> flash fire, jet fire, BLEVE, domino
   Awan gas = partikel Gaussian (puff) dengan angin, daya apung/berat jenis gas; konsentrasi di titik = jumlah kernel puff.
   Semua angka = ilustrasi bahan ajar, bukan untuk perhitungan desain. */
var HZ = (function () {
  'use strict';
  var T = THREE, M = TW.M, $ = TW.$;
  var HZ = {};
  var idc = function (n, d) { return TW.fmt(n, d).replace('.', ','); };

  /* ------------------------------------------------------------ data gas */
  var GAS = {
    methane: { name: 'Metana (gas alam)', grp: 'IIA', lel: 5.0, uel: 15, mie: 0.28, ait: 537, mesg: 1.14, rho: 0.66, buoy: 0.9, front: 8, tip: 'Lebih ringan dari udara: naik dan cepat menyebar.' },
    propane: { name: 'Propana (LPG)', grp: 'IIA', lel: 2.1, uel: 9.5, mie: 0.25, ait: 470, mesg: 0.92, rho: 1.9, buoy: -0.35, front: 8, tip: 'Lebih berat dari udara (1,55×): mengendap di permukaan tanah.' },
    ethylene: { name: 'Etilena', grp: 'IIB', lel: 2.7, uel: 36, mie: 0.07, ait: 425, mesg: 0.65, rho: 1.18, buoy: -0.02, front: 12, tip: 'Hampir netral; MIE rendah, rentang mudah terbakar lebar.' },
    hydrogen: { name: 'Hidrogen', grp: 'IIC', lel: 4.0, uel: 75, mie: 0.017, ait: 560, mesg: 0.29, rho: 0.085, buoy: 2.5, front: 20, tip: 'Sangat ringan, MIE 0,017 mJ, rentang 4–75 %, MESG 0,29 mm: butuh proteksi kelompok IIC.' }
  };
  var GRP = { IIA: 1, IIB: 2, IIC: 3 };
  var SIZE = { small: { q: 0.03, I: 0.35, name: 'Kecil' }, medium: { q: 0.12, I: 0.65, name: 'Sedang' }, large: { q: 0.5, I: 1.0, name: 'Besar' } };

  /* -------------------------------------------------------- data instrument */
  var INSTR = {
    nonex: { name: 'Transmitter industri biasa', mark: 'CE · IP66 · TANPA sertifikat Ex', short: 'NON-Ex', cls: 'bad', epl: null, grp: null, color: 0xb9bec4, wall: 0.008, jb: 0xa9afb5, plate: '#e8e8e8', sign: 'TIDAK UNTUK AREA BERBAHAYA',
      d: 'Standar pabrik, IP66 anti debu/air, tetapi <b>tidak</b> dirancang mencegah/menahan penyalaan. Terminal terbuka, PCB dan kapasitor bisa memercik.' },
    exec: { name: 'Ex ec (Zona 2)', mark: 'II 3G Ex ec IIC T4 Gc', short: 'Ex ec · Gc', cls: 'warn', epl: 'Gc', grp: 'IIC', color: 0x8d99a6, wall: 0.012, jb: 0xd9b22c, plate: '#ffe27a', sign: 'Ex ec — HANYA ZONA 2',
      d: 'Increased safety / non-sparking: mencegah percikan saat operasi normal. EPL <b>Gc</b> hanya untuk Zona 2 (gas jarang ada), <b>tidak layak</b> di Zona 1.' },
    exdB: { name: 'Ex db IIB (flameproof)', mark: 'II 2G Ex db IIB T4 Gb', short: 'Ex db IIB · Gb', cls: 'ok', epl: 'Gb', grp: 'IIB', color: 0xc24a1b, wall: 0.05, jb: 0xc24a1b, plate: '#ffe27a', sign: 'Ex db IIB — ZONA 1',
      d: 'Enklosur tahan ledakan internal dan celah flame-path mendinginkan gas. Celah dirancang untuk gas <b>IIA/IIB</b>; <b>tidak cukup</b> untuk hidrogen (IIC).' },
    exdC: { name: 'Ex db IIC (flameproof)', mark: 'II 2G Ex db IIC T4 Gb', short: 'Ex db IIC · Gb', cls: 'ok', epl: 'Gb', grp: 'IIC', color: 0xc24a1b, wall: 0.05, jb: 0xc24a1b, plate: '#ffe27a', sign: 'Ex db IIC — ZONA 1',
      d: 'Flameproof dengan celah flame-path lebih sempit (≤ 0,15 mm) sehingga menahan semua gas termasuk hidrogen &amp; asetilena (IIC).' },
    exia: { name: 'Ex ia + barrier (intrinsically safe)', mark: 'II 1G Ex ia IIC T4 Ga', short: 'Ex ia · Ga', cls: 'ok', epl: 'Ga', grp: 'IIC', color: 0x1f70b8, wall: 0.012, jb: 0x2f8cff, plate: '#9fd0ff', sign: 'Ex ia — INTRINSICALLY SAFE',
      d: 'Energi dibatasi barrier (Zener / isolator galvanik) di area aman sehingga percikan <b>tak cukup</b> untuk menyulut, bahkan saat dua kegagalan. Boleh sampai Zona 0.' }
  };
  var INSTR_ORDER = ['nonex', 'exec', 'exdB', 'exdC', 'exia'];
  var MODES = {
    short: { name: 'Hubung singkat terminal / kabel terkelupas', E: { nonex: 4, exec: 3, exdB: 3, exdC: 3, exia: 0.009 }, txt: 'percikan di terminal' },
    comp: { name: 'Komponen elektronik gagal & meledak (kapasitor/PCB)', E: { nonex: 30, exec: 30, exdB: 30, exdC: 30, exia: 0.009 }, txt: 'komponen meledak di dalam enklosur' },
    surge: { name: 'Tegangan lebih 230 VAC salah kabel / surja', E: { nonex: 800, exec: 800, exdB: 800, exdC: 800, exia: 0.009 }, txt: 'busur listrik 230 VAC' }
  };

  var S = { leak: false, leakT: 0, leakK: 0, esd: false, esdT: 0, esdPend: -1, failed: false, ignited: false, igT: 0, event: null, verdict: null, H: 0, ruptured: false, domT: -1, tankBlast: false,
    cInst: 0, gdLel: 0, dmg: { pt: 0, pipe: 0, ves: 0, tank: 0 }, auto: false, flux: 0, sparkT: 0, log: [] };
  var CFG = { gas: 'propane', size: 'medium', wind: 2.5, dir: 20, autoEsd: false, inst: 'nonex', mode: 'short', zones: true, cloud: true };
  var scn = {}, gas, pm, INS = null, jet, vesFire, tankFire, flare, rackFire, burn = [], colT = 0, chartFlam, chartEn;

  /* ------------------------------------------------------------- posisi */
  var LEAK = new T.Vector3(2.24, 1.35, 0.14), P_INS = new T.Vector3(2.95, 0.95, 0.35), GD = new T.Vector3(3.8, 1.25, 0.1), VES = new T.Vector3(-0.8, 1.75, -3.3), TANK = new T.Vector3(10.5, 3.6, -2.4);
  var INS_C = new T.Vector3(2.95, 1.28, 0.35), PAD = 0.12, VR = 1.1, TR = 2.3;
  var MK = SK.mat;
  var mZ2, mZ1, mZ0;
  function put(g, m, x, y, z) { m.position.set(x, y, z); g.add(m); return m; }

  /* --------------------------------------------------------------- scene */
  function buildPlant() {
    var B = new SK.Batch(), st = MK.paint(0x4f5b66, 0.6, 0.3), pipe = MK.paint(0x8e969c, 0.5, 0.5);
    SK.ground(B, { pads: [[-8, -8.5, 14.5, 4.4, PAD, 0.3]], roads: [[-40, 11.5, 40, 16.5], [16.5, -40, 21.5, 11.5]] });
    SK.horizon({ skip: [-2.3, 0.35] });
    /* ---- pipe rack 4 bent, 2 tier + cable tray */
    var bents = [-11, -5.5, 0, 5.5];
    SK.pipeRack(B, { xs: bents, z: 0, w: 2.4, levels: [3.2, 4.4] });
    function rackLine(y, z, r, mat, clad) {
      var pts = [[-12.6, -0.1, z], [-12.6, y + r, z], [7.3, y + r, z], [7.3, PAD + 0.05, z]];
      B.tube(mat, pts, r, r * 3); if (clad) B.tube(MK.cladding(), pts, r + 0.045, (r + 0.045) * 3);
      bents.forEach(function (x) { B.box(MK.steel(), 0.26, 0.08, 0.18, x, y + 0.04, z); });
      B.box(MK.concrete(), 0.5, 0.25, 0.5, 7.3, PAD + 0.12, z);
      SK.flangeAt(B, mat, [-8.2, y + r, z], [1, 0, 0], r); SK.flangeAt(B, mat, [3.6, y + r, z], [1, 0, 0], r);
    }
    rackLine(3.2, -0.8, 0.06, pipe); rackLine(3.2, 0.72, 0.09, pipe, true); rackLine(3.2, -0.35, 0.05, MK.paint(0x2e7d4f, 0.5, 0.4));
    rackLine(4.4, -0.55, 0.15, MK.paint(0x9a9fa3, 0.55, 0.45)); rackLine(4.4, 0.35, 0.07, MK.paint(0x39658f, 0.5, 0.4));
    SK.cableTray(B, [[-12.6, 4.45, 1.0], [7.3, 4.45, 1.0]], { w: 0.4, cables: 6 });
    bents.forEach(function (x) { B.box(MK.red(), 0.18, 0.55, 0.18, x + 0.2, PAD + 1.2, 1.35); });
    /* ---- jalur LPG: V-201 -> rack -> riser F-201 -> valve -> jalur tanah -> T-202 (material bisa memanas) */
    scn.pipeMat = MK.paint(0x8e969c, 0.5, 0.5).clone(); scn.pipeMat.userData.base = scn.pipeMat.color.clone();
    var pm = scn.pipeMat, r6 = 0.084;
    B.tube(pm, [[-0.4, VES.y + VR + 0.3, VES.z], [-0.4, 3.2 + r6, VES.z], [-0.4, 3.2 + r6, 0], [2.2, 3.2 + r6, 0], [2.2, 1.43, 0]], r6, 0.3);
    SK.flangeAt(B, pm, [2.2, 1.35, 0], [0, 1, 0], r6);
    B.rod(pm, [2.2, 1.27, 0], [2.2, 1.0, 0], r6, 18);
    SK.gateValve(B, [2.2, 0.86, 0], 'y', r6, { mat: MK.paint(0x3c4a3e, 0.55, 0.4) });
    B.tube(pm, [[2.2, 0.72, 0], [2.2, PAD + 0.45, 0], [10.5, PAD + 0.45, 0], [10.5, PAD + 0.45, TANK.z], [10.5, TANK.y - TR - 0.12, TANK.z]], r6, 0.3);
    [3.6, 6.5, 9.2].forEach(function (x) { B.box(MK.concrete(), 0.35, 0.3, 0.6, x, PAD + 0.15, 0); B.box(MK.steel(), 0.2, 0.06, 0.16, x, PAD + 0.33, 0); });
    B.box(MK.concrete(), 0.6, 0.3, 0.35, 10.5, PAD + 0.15, -1.2);
    /* tapping + root valve + tubing ke manifold transmitter */
    B.rod(pm, [2.2 + r6, 1.06, 0], [2.36, 1.06, 0], 0.016, 10); SK.ballValve(B, [2.4, 1.06, 0], 'x', 0.014, { lever: true, mat: MK.ss() });
    B.tube(MK.ssPol(), [[2.44, 1.06, 0], [2.62, 1.06, 0], [2.62, 1.06, 0.35], [2.95 - 0.13, 0.95 + 0.035, 0.35]], 0.0065, 0.05);
    /* stand transmitter + JB */
    SK.pipeStand(B, 2.95, 0.13, 0.92, { y0: PAD }); B.box(MK.galv(), 0.02, 0.1, 0.24, 2.95 - 0.04, 0.99, 0.24); B.box(MK.galv(), 0.1, 0.02, 0.2, 2.95, 0.94, 0.25);
    SK.jb(B, 2.95, 0.62, 0.22, 0, { w: 0.24, h: 0.26, d: 0.12, mat: MK.paint(0x8c969e, 0.45, 0.4) });
    /* ---- separator V-201 (badan bisa pecah -> grup sendiri) */
    scn.vesMat = MK.paint(0xe3e5e2, 0.5, 0.2).clone(); scn.vesMat.userData.base = scn.vesMat.color.clone();
    var ves = scn.ves = new T.Group(); TW.add(ves);
    var VB = new SK.Batch();
    SK.hVessel(VB, { parts: 'body', c: [VES.x, VES.y, VES.z], R: VR, L: 5, ground: PAD, mat: scn.vesMat, plate: [0.6, 0.1, VR + 0.01],
      nozzles: [{ p: [0.4, VR - 0.05, 0], r: r6, len: 0.2 }, { p: [-1.9, VR - 0.05, 0], r: 0.1, len: 0.2 }, { p: [-0.9, VR - 0.05, 0], r: 0.05, len: 0.18 }, { p: [1.2, -VR + 0.05, 0], d: [0, -1, 0], r: 0.06, len: 0.18 },
        { p: [-2.1, 0.6, VR - 0.05], d: [0, 0, 1], r: 0.04, len: 0.28 }, { p: [-2.1, -0.6, VR - 0.05], d: [0, 0, 1], r: 0.04, len: 0.28 }, { p: [2.6, 0, 0], d: [1, 0, 0], r: 0.25, len: 0.12, blind: true }] });
    VB.build(ves);
    SK.hVessel(B, { parts: 'supports', c: [VES.x, VES.y, VES.z], R: VR, L: 5, ground: PAD, mat: MK.paint(0xe3e5e2, 0.5, 0.2) });
    scn.z0 = new T.Mesh(new T.CylinderGeometry(VR * 0.92, VR * 0.92, 5.2, 32), mZ0); scn.z0.rotation.z = Math.PI / 2; scn.z0.position.copy(VES); ves.add(scn.z0);
    TW.label('V-201 &middot; separator gas', ves, { off: [VES.x, VES.y + 1.9, VES.z], group: 'eq' });
    /* pipa inlet, PSV ke flare header, level bridle, drain */
    B.tube(pipe, [[VES.x - 1.9, VES.y + VR + 0.3, VES.z], [VES.x - 1.9, 3.45, VES.z], [-4.6, 3.45, VES.z], [-4.6, PAD + 0.45, VES.z], [-14, PAD + 0.45, VES.z]], 0.1, 0.35);
    [-6.5, -9.5, -12.5].forEach(function (x) { B.box(MK.concrete(), 0.35, 0.3, 0.6, x, PAD + 0.15, VES.z); });
    var psv = [VES.x - 0.9, VES.y + VR + 0.25, VES.z];
    B.cyl(MK.paint(0xc0392b, 0.45, 0.2), 0.07, 0.08, 0.2, psv[0], psv[1] + 0.12, psv[2], 0, 0, 0, 16); B.cyl(MK.paint(0xc0392b, 0.45, 0.2), 0.045, 0.06, 0.26, psv[0], psv[1] + 0.35, psv[2], 0, 0, 0, 14); B.cyl(MK.dark(), 0.03, 0.03, 0.06, psv[0], psv[1] + 0.51, psv[2], 0, 0, 0, 10);
    B.tube(pipe, [[psv[0] + 0.07, psv[1] + 0.12, psv[2]], [-1.2, psv[1] + 0.12, psv[2]], [-1.2, 4.95, psv[2]], [-1.2, 4.95, -0.55], [-1.2, 4.4 + 0.3, -0.55]], 0.05, 0.2);
    var bx = VES.x - 2.1, bz = VES.z + VR + 0.28;
    B.rod(pipe, [bx, VES.y - 0.9, bz], [bx, VES.y + 0.9, bz], 0.045, 14); B.box(MK.paint(0x39434b, 0.5, 0.4), 0.05, 1.2, 0.06, bx + 0.08, VES.y, bz); B.box(MK.glass(), 0.02, 1.1, 0.03, bx + 0.08, VES.y, bz + 0.03);
    B.tube(pipe, [[VES.x + 1.2, VES.y - VR - 0.25, VES.z], [VES.x + 1.2, PAD + 0.35, VES.z], [VES.x + 1.2, PAD + 0.35, -8.3]], 0.05, 0.15);
    SK.gateValve(B, [VES.x + 1.2, VES.y - VR - 0.45, VES.z], 'y', 0.05);
    /* platform akses + tangga monyet */
    SK.platform(B, { x0: -3.4, x1: 1.2, z0: VES.z - VR - 1.0, z1: VES.z - VR - 0.05, y: VES.y + VR + 0.05, y0: PAD, gaps: [{ e: 'w', at: 0.5, w: 0.7 }], rails: { n: 1, s: 0, e: 1, w: 1 } });
    SK.ladder(B, { x: -3.45, z: VES.z - VR - 0.55, y0: PAD, y1: VES.y + VR + 0.05, ry: -Math.PI / 2 });
    /* ---- bola LPG T-202 */
    scn.tankMat = MK.paint(0xeef0ef, 0.45, 0.2).clone(); scn.tankMat.userData.base = scn.tankMat.color.clone();
    var tk = scn.tank = new T.Group(); TW.add(tk);
    var TB = new SK.Batch();
    TB.sph(scn.tankMat, TR, TANK.x, TANK.y, TANK.z, 48);
    TB.torus(MK.steel(), TR + 0.01, 0.012, TANK.x, TANK.y, TANK.z, Math.PI / 2, 0, 0, Math.PI * 2, 64); TB.torus(MK.steel(), TR * 0.87, 0.01, TANK.x, TANK.y + TR * 0.5, TANK.z, Math.PI / 2, 0, 0, Math.PI * 2, 64); TB.torus(MK.steel(), TR * 0.87, 0.01, TANK.x, TANK.y - TR * 0.5, TANK.z, Math.PI / 2, 0, 0, Math.PI * 2, 64);
    TB.cyl(scn.tankMat, 0.7, 0.75, 0.12, TANK.x, TANK.y + TR - 0.02, TANK.z, 0, 0, 0, 24);
    [[0.35, 0], [-0.35, 0.1]].forEach(function (q) { TB.cyl(MK.paint(0xc0392b, 0.45, 0.2), 0.06, 0.07, 0.35, TANK.x + q[0], TANK.y + TR + 0.2, TANK.z + q[1], 0, 0, 0, 14); });
    TB.torus(MK.red(), TR * 0.55, 0.03, TANK.x, TANK.y + TR * 0.84, TANK.z, Math.PI / 2, 0, 0, Math.PI * 2, 40);
    TB.build(tk);
    var legs = [], nL = 8;
    for (var i = 0; i < nL; i++) { var a = (i + 0.5) / nL * Math.PI * 2; legs.push([TANK.x + Math.cos(a) * TR * 0.98, TANK.z + Math.sin(a) * TR * 0.98]); }
    legs.forEach(function (l, i) {
      B.cyl(MK.paint(0x6c7680, 0.55, 0.35), 0.13, 0.13, TANK.y - PAD, l[0], PAD + (TANK.y - PAD) / 2, l[1], 0, 0, 0, 14);
      B.cyl(MK.concrete(), 0.19, 0.19, (TANK.y - PAD) * 0.62, l[0], PAD + (TANK.y - PAD) * 0.31, l[1], 0, 0, 0, 14);
      B.box(MK.concrete(), 0.6, 0.3, 0.6, l[0], PAD + 0.15, l[1]);
      var n = legs[(i + 1) % nL], y0 = PAD + (TANK.y - PAD) * 0.64, y1 = TANK.y - 0.35;
      B.rod(MK.steel(), [l[0], y0, l[1]], [n[0], y1, n[1]], 0.022, 6); B.rod(MK.steel(), [l[0], y1, l[1]], [n[0], y0, n[1]], 0.022, 6);
    });
    var twx = TANK.x - TR - 1.4, top = TANK.y + TR + 0.12;
    SK.platform(B, { x0: twx - 0.6, x1: twx + 0.6, z0: TANK.z - 0.6, z1: TANK.z + 0.6, y: top, y0: PAD, gaps: [{ e: 'e', at: 0.6, w: 0.8 }, { e: 's', at: 0.6, w: 0.7 }] });
    SK.ladder(B, { x: twx, z: TANK.z + 0.62, y0: PAD, y1: top, ry: Math.PI });
    var bg = new T.PlaneGeometry(TANK.x - 0.7 - (twx + 0.6), 0.8); SK.scaleUV(bg, 4, 1.6); B.geo(MK.grating(), bg, SK.M4((TANK.x - 0.7 + twx + 0.6) / 2, top, TANK.z, -Math.PI / 2));
    SK.handrail(B, [[[twx + 0.6, top, TANK.z - 0.42], [TANK.x - 0.7, top, TANK.z - 0.42]], [[twx + 0.6, top, TANK.z + 0.42], [TANK.x - 0.7, top, TANK.z + 0.42]]]);
    TW.label('T-202 &middot; bola LPG', tk, { off: [TANK.x, TANK.y + TR + 1.6, TANK.z], group: 'eq' });
    /* ---- flare stack + guy wire */
    var FX = -17, FZ = -13, FH = 22;
    B.box(MK.concrete(), 1.4, 0.4, 1.4, FX, 0.2, FZ); B.cyl(MK.paint(0x8a8f93, 0.6, 0.4), 0.28, 0.4, FH, FX, 0.4 + FH / 2, FZ, 0, 0, 0, 16); B.cyl(MK.dark(), 0.34, 0.3, 0.8, FX, FH + 0.4, FZ, 0, 0, 0, 16);
    SK.ladder(B, { x: FX, z: FZ + 0.45, y0: 0.4, y1: FH - 1.5, ry: Math.PI, mat: MK.galv() });
    [0, 2.1, 4.2].forEach(function (a) { B.rod(MK.steel(), [FX, FH * 0.7, FZ], [FX + Math.cos(a) * 12, 0.05, FZ + Math.sin(a) * 12], 0.012, 4); B.box(MK.concrete(), 0.6, 0.3, 0.6, FX + Math.cos(a) * 12, 0.15, FZ + Math.sin(a) * 12); });
    B.tube(MK.paint(0x9a9fa3, 0.55, 0.45), [[-12.6, 4.4 + 0.15, -0.55], [-14.5, 4.4 + 0.15, -0.55], [-14.5, 0.6, -0.55], [-14.5, 0.6, FZ], [FX + 0.5, 0.6, FZ], [FX + 0.5, 0.6, FZ]], 0.15, 0.5);
    flare = TW.fx.fire([FX, FH + 0.9, FZ], { size: 0.8, rate: 50, speed: 1.8, spread: 0.25, smoke: 0.12, light: false }); flare.k = 0.22;
    TW.label('flare stack', new T.Vector3(FX, FH + 2.4, FZ), { group: 'eq', maxD: 70 });
    /* ---- gedung kontrol (area aman) */
    var CB = [-12.8, 6.8], cw = 8, ch = 3.8, cd = 5.2, wm = new T.MeshStandardMaterial({ map: SK.tex.ribPanel('#d8d3c6'), roughness: 0.75, metalness: 0.15 });
    var bgeo = new T.BoxGeometry(cw, ch, cd); SK.scaleUV(bgeo, cw / 4, 1); B.geo(wm, bgeo, SK.M4(CB[0], ch / 2, CB[1]));
    B.box(MK.paint(0x8f8a80, 0.7, 0.1), cw + 0.3, 0.3, cd + 0.3, CB[0], ch + 0.15, CB[1]);
    var fx = CB[0] + cw / 2, fz = CB[1] + cd / 2;
    B.box(MK.paint(0x4f5963, 0.5, 0.4), 0.08, 2.2, 1.1, fx + 0.02, 1.1, CB[1] - 0.8); B.box(MK.glass(), 0.02, 0.3, 0.3, fx + 0.07, 1.6, CB[1] - 0.8); B.box(MK.steel(), 0.04, 0.03, 0.14, fx + 0.08, 1.05, CB[1] - 0.45);
    B.box(MK.paint(0x6c747b, 0.5, 0.4), 0.9, 0.08, 1.4, fx + 0.45, 2.35, CB[1] - 0.8); B.box(MK.lamp(), 0.08, 0.1, 0.3, fx + 0.06, 2.5, CB[1] - 0.8);
    B.box(MK.concrete(), 1.4, 0.15, 1.8, fx + 0.7, 0.075, CB[1] - 0.8); B.box(MK.concrete(), 0.5, 0.15, 1.8, fx + 1.6, 0.075, CB[1] - 0.8);
    [[-2.2], [0.6]].forEach(function (q) { B.box(MK.paint(0xdfe2e0, 0.5, 0.1), 0.95, 0.7, 0.36, CB[0] + q[0], 0.5, fz + 0.22); B.cylZ(MK.dark(), 0.25, 0.02, CB[0] + q[0] - 0.1, 0.5, fz + 0.41, 24); for (var k2 = 0; k2 < 6; k2++) B.box(MK.steel(), 0.5, 0.008, 0.01, CB[0] + q[0] - 0.1, 0.32 + k2 * 0.07, fz + 0.42); B.tube(MK.paint(0x2b2b2b, 0.6, 0.1), [[CB[0] + q[0] + 0.3, 0.8, fz + 0.1], [CB[0] + q[0] + 0.3, 2.6, fz + 0.06]], 0.02, 0.1); });
    [-3.2, -0.4, 2.4].forEach(function (x) { B.box(MK.paint(0x5b646c, 0.4, 0.5), 0.7, 0.5, 0.06, CB[0] + x, 2.4, fz + 0.01); B.box(MK.glass(), 0.6, 0.4, 0.02, CB[0] + x, 2.4, fz + 0.045); });
    B.box(MK.paint(0x4f5963, 0.5, 0.4), 1.0, 2.2, 0.08, CB[0] - 1.0, 1.1, fz + 0.02);
    SK.sign(fx + 0.02, 3.05, CB[1] + 1.2, Math.PI / 2, 2.4, 0.46, function (g, w, h) { g.fillStyle = '#0d3b66'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.fillText('CONTROL ROOM', w / 2, h * 0.68); });
    SK.sign(CB[0] + 1.2, 3.1, fz + 0.03, 0, 1.6, 0.5, function (g, w, h) { g.fillStyle = '#1b8a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.fillText('MUSTER POINT', w / 2, h * 0.66); });
    TW.label('RUANG KONTROL &middot; AREA AMAN', new T.Vector3(CB[0], ch + 1.0, CB[1]), { group: 'eq', maxD: 60 });
    /* kabinet barrier / marshalling (area aman) */
    var cab = scn.cabinet = new T.Group(); cab.position.set(-8.2, 0, 8.7); cab.rotation.y = Math.PI / 2; TW.add(cab);
    var KB = new SK.Batch();
    KB.box(MK.concrete(), 1.4, 0.2, 0.9, 0, 0.1, 0); KB.box(MK.paint(0x8a939a, 0.45, 0.4), 1.0, 1.9, 0.5, 0, 1.15, 0); KB.box(MK.paint(0x7b848b, 0.45, 0.4), 1.02, 1.8, 0.02, 0, 1.15, 0.26);
    KB.box(MK.glass(), 0.7, 0.8, 0.01, 0, 1.45, 0.275); KB.box(MK.paint(0x6c7680, 0.5, 0.4), 1.3, 0.05, 0.9, 0, 2.35, 0.1);
    [-1, 1].forEach(function (sx) { KB.box(MK.galv(), 0.05, 2.25, 0.05, sx * 0.6, 1.25, 0.5); });
    for (var k = 0; k < 8; k++) KB.box(MK.paint(0x2f6fd6, 0.4, 0.2), 0.06, 0.12, 0.1, -0.3 + k * 0.085, 1.5, 0.2);
    KB.box(MK.steel(), 0.8, 0.02, 0.04, 0, 1.43, 0.2);
    KB.build(cab);
    scn.barLed = put(cab, new T.Mesh(new T.SphereGeometry(0.03, 10, 8), new T.MeshStandardMaterial({ color: 0x111111, emissive: 0x1aff7a, emissiveIntensity: 1.8 })), 0.38, 1.95, 0.28);
    scn.barLbl = TW.label('BARRIER Ex ia', cab, { off: [0, 2.7, 0], group: 'eq', maxD: 40 });
    /* parit kabel (cable trench) dari instrument ke kabinet */
    var tr = [[3.2, 3.9], [-7.6, 3.9]];
    B.box(MK.concrete(), Math.abs(tr[0][0] - tr[1][0]), 0.08, 0.5, (tr[0][0] + tr[1][0]) / 2, PAD + 0.02, 3.9);
    for (var tx = tr[1][0] + 0.3; tx < tr[0][0]; tx += 0.62) B.box(MK.concrete(), 0.58, 0.05, 0.46, tx, PAD + 0.085, 3.9);
    /* ---- detektor gas GD-201 */
    SK.pipeStand(B, GD.x, GD.z - 0.12, 1.0, { y0: PAD });
    var gd = new T.Group(); gd.position.copy(GD); TW.add(gd);
    var GB = new SK.Batch();
    GB.box(MK.paint(0x2b2f33, 0.5, 0.4), 0.16, 0.16, 0.1, 0, 0.02, -0.06); GB.cyl(MK.paint(0xf0c419, 0.45, 0.2), 0.045, 0.045, 0.12, 0, -0.12, 0, 0, 0, 0, 18);
    GB.cyl(MK.dark(), 0.05, 0.035, 0.07, 0, -0.21, 0, 0, 0, 0, 18); GB.cyl(MK.paint(0x2b2f33, 0.5, 0.4), 0.02, 0.02, 0.07, 0.1, -0.02, -0.06, 0, 0, Math.PI / 2, 8);
    GB.build(gd);
    scn.gdLed = put(gd, new T.Mesh(new T.SphereGeometry(0.018, 10, 8), new T.MeshStandardMaterial({ color: 0x111111, emissive: 0x1aff7a, emissiveIntensity: 1.8 })), 0, 0.07, -0.005);
    scn.gdLbl = TW.label('GD-201', gd, { off: [0, 0.35, 0], group: 'eq', maxD: 22 });
    /* ---- windsock, lampu, pemadam, rambu, pekerja */
    var WS = [CB[0] - 3.2, ch + 0.3, CB[1] - 1.8];
    var ws = scn.sock = new T.Group(); ws.position.set(WS[0], WS[1] - 3.0, WS[2]); TW.add(ws);
    B.box(MK.galv(), 0.3, 0.02, 0.3, WS[0], WS[1] + 0.01, WS[2]); B.cyl(MK.galv(), 0.04, 0.06, 3.2, WS[0], WS[1] + 1.6, WS[2], 0, 0, 0, 10);
    var stripes = SK.signTex(128, 128, function (g, w, h) { for (var k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#ff5a1f'; g.fillRect(k * 32, 0, 32, 128); } });
    var cone = new T.Mesh(new T.CylinderGeometry(0.34, 0.14, 1.5, 16, 1, true), new T.MeshStandardMaterial({ map: stripes, side: T.DoubleSide, roughness: 0.8 })); cone.geometry.translate(0, 0.75, 0); cone.castShadow = true;
    var sockPivot = scn.sockPivot = new T.Group(); sockPivot.position.set(0, 6.15, 0); ws.add(sockPivot); cone.rotation.z = -Math.PI / 2; sockPivot.add(cone); scn.sockCone = cone;
    TW.label('arah angin', ws, { off: [0, 7.0, 0], group: 'eq', maxD: 60 });
    SK.lightPole(B, -7.6, 3.9, 8, 0.3); SK.lightPole(B, 14.2, -8.0, 8, 2.4); SK.lightPole(B, -7.6, -8.2, 8, -0.4);
    B.cyl(MK.red(), 0.1, 0.1, 0.9, 6.6, PAD + 0.45, 3.5, 0, 0, 0, 14); B.cylX(MK.red(), 0.05, 0.4, 6.6, PAD + 0.7, 3.5, 10); B.rod(MK.red(), [6.6, PAD + 0.9, 3.5], [6.4, PAD + 1.3, 3.1], 0.035, 10);
    SK.sign(-3.5, 2.3, 4.15, 0, 1.5, 1.1, function (g, w, h) {
      g.fillStyle = '#f2c500'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#111'; g.beginPath(); g.moveTo(w * 0.5, 40); g.lineTo(w * 0.5 + 95, 200); g.lineTo(w * 0.5 - 95, 200); g.closePath(); g.fill(); g.fillStyle = '#f2c500'; g.font = 'bold 80px sans-serif'; g.textAlign = 'center'; g.fillText('Ex', w * 0.5, 185);
      g.fillStyle = '#111'; g.font = 'bold 40px sans-serif'; g.fillText('AREA BERBAHAYA', w * 0.5, 270); g.font = 'bold 30px sans-serif'; g.fillText('ZONA 1 / 2 · DILARANG API & HP', w * 0.5, 320);
    }, true);
    SK.human(B, -10.2, 3.6, 2.6, { suit: 0x1f4e8c, hat: 0xf5f5f0, pose: 'tablet' });
    SK.human(B, -7.0, 8.9, -1.4, { suit: 0xd9531e, hat: 0xf2c200 });
    B.build();
    /* ---- zona */
    scn.z1 = new T.Mesh(new T.SphereGeometry(1, 32, 20), mZ1); scn.z1.scale.set(3.4, 2.1, 2.7); scn.z1.position.set(2.2, 1.35, 0.1); TW.add(scn.z1);
    scn.z2 = new T.Mesh(new T.SphereGeometry(1, 32, 20), mZ2); scn.z2.scale.set(6.2, 3.0, 5.2); scn.z2.position.set(2.2, 1.35, 0.1); TW.add(scn.z2);
    scn.zoneLbls = [TW.label('ZONA 1', scn.z1, { off: [0, 2.4, 0], cls: 'warn', group: 'zone' }), TW.label('ZONA 2', scn.z2, { off: [3.6, 0.5, 0], cls: 'ok', group: 'zone' }), TW.label('ZONA 0 (dalam bejana)', scn.z0, { off: [0, 0, VR + 0.4], cls: 'bad', group: 'zone' })];
    TW.label('F-201 &middot; flange (sumber kebocoran)', LEAK, { off: [-0.2, 0.3, 0], group: 'eq', maxD: 16 });
  }

  /* ---------------------------------------------- transmitter (hero, bisa gagal) */
  function buildInstrument(type) {
    if (INS) { TW.remove(INS.g); TW.dispose(INS.g); INS.labels.forEach(function (l) { l.remove(); }); }
    var C = INSTR[type], g = new T.Group(); g.position.copy(P_INS); TW.add(g);
    var K = 1.4, exd = type === 'exdB' || type === 'exdC';
    var col = { nonex: 0xc9ccce, exec: 0x7f8a94, exdB: 0x3a4a5c, exdC: 0x3a4a5c, exia: 0x1f64b0 }[type];
    var housing = TW.shellize(new T.MeshStandardMaterial({ color: col, map: SK.tex.grime(), roughness: type === 'nonex' ? 0.6 : 0.42, metalness: type === 'nonex' ? 0.05 : 0.45 }));
    TW.shellDouble(housing);
    var hot = { g: g, housing: housing, labels: [], type: type, C: C };
    var R = (exd ? 0.066 : 0.056) * K, L = (exd ? 0.15 : 0.13) * K, wall = (exd ? 0.012 : 0.004) * K, cl = (exd ? 0.042 : 0.026) * K;
    var B = new SK.Batch(), ss = MK.ss();
    /* manifold 3-valve + flange coplanar + modul sensor */
    B.at(SK.M4(0, 0, 0, 0, 0, 0, K, K, K), function (b) {
      b.box(ss, 0.1, 0.05, 0.12, 0, 0.025, 0);
      [[-1, 0], [1, 0], [0, 1]].forEach(function (q) { var d = new T.Vector3(q[0], 0, q[1]), p0 = new T.Vector3(q[0] * 0.05, 0.025, q[1] * 0.06), p1 = p0.clone().addScaledVector(d, 0.045); b.rod(ss, p0, p1, 0.012, 10); var hd = new T.Vector3(q[1], 0, q[0]); b.rod(MK.red(), p1.clone().addScaledVector(hd, -0.03), p1.clone().addScaledVector(hd, 0.03), 0.005, 6); });
      b.box(ss, 0.09, 0.03, 0.09, 0, 0.065, 0);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { b.cyl(MK.dark(), 0.007, 0.007, 0.04, q[0] * 0.035, 0.07, q[1] * 0.035, 0, 0, 0, 6); });
      b.cyl(ss, 0.047, 0.047, 0.07, 0, 0.115, 0, 0, 0, 0, 24); b.cyl(ss, 0.024, 0.03, 0.035, 0, 0.167, 0, 0, 0, 0, 16);
    });
    var yh = 0.185 * K + R;
    /* housing dua ruang: badan (shell X-ray) + tutup depan (layar) & belakang (terminal) */
    var bodyProf = [[R - wall, -L / 2], [R, -L / 2], [R, L / 2], [R - wall, L / 2]];
    var body = new T.Mesh(new T.LatheGeometry(bodyProf.map(function (p) { return new T.Vector2(p[0], p[1]); }), 36), housing); body.rotation.x = Math.PI / 2; body.position.set(0, yh, 0); g.add(body); hot.wall = body;
    B.add(new T.CylinderGeometry(R - wall, R - wall, wall * 1.5, 32), housing, new T.Matrix4().compose(new T.Vector3(0, yh, 0), new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2, 0, 0)), new T.Vector3(1, 1, 1)));
    [-1, 1].forEach(function (sd) {
      var cz = sd * (L / 2 + cl / 2), rc = R + (exd ? 0.01 : 0.005) * K;
      B.add(new T.LatheGeometry([[rc - wall, -cl / 2], [rc, -cl / 2], [rc, cl / 2], [0.001, cl / 2]].map(function (p) { return new T.Vector2(p[0], p[1] * sd); }), 36), housing, new T.Matrix4().compose(new T.Vector3(0, yh, cz), new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2, 0, 0)), new T.Vector3(1, 1, 1)));
      B.torus(housing, rc + 0.002, 0.004 * K, 0, yh, cz + sd * cl * 0.2, 0, 0, 0, Math.PI * 2, 32);
      if (exd) { for (var k = 0; k < 7; k++) B.torus(MK.steel(), R - 0.001, 0.0022 * K, 0, yh, sd * (L / 2 - 0.004 - k * 0.0065 * K), 0, 0, 0, Math.PI * 2, 32); B.box(MK.dark(), 0.014 * K, 0.014 * K, 0.014 * K, rc + 0.008, yh - 0.03 * K, cz); }
    });
    var zf = L / 2 + cl;
    B.cylZ(MK.glass(), R * 0.7, 0.002, 0, yh, zf + 0.002, 24);
    /* bagian dalam: modul elektronik (depan) & blok terminal (belakang) */
    var pcbM = new T.MeshStandardMaterial({ color: 0x1c7a3c, roughness: 0.5, metalness: 0.2 });
    B.cylZ(pcbM, R - wall - 0.004, 0.004, 0, yh, L * 0.22, 28); B.cylZ(pcbM, R - wall - 0.004, 0.004, 0, yh, L * 0.02, 28);
    [[-0.3, 0.25], [0.25, 0.3], [0.1, -0.35], [-0.35, -0.2]].forEach(function (q) { B.box(MK.dark(), 0.022 * K, 0.022 * K, 0.006, q[0] * R, yh + q[1] * R, L * 0.22 - 0.005); });
    var capM = new T.MeshStandardMaterial({ color: 0x2f6fd6, roughness: 0.4, metalness: 0.3 }); hot.caps = [];
    [[0.35, -0.1], [0.05, -0.45]].forEach(function (q) { B.cylZ(capM, 0.007 * K, 0.028 * K, q[0] * R, yh + q[1] * R, L * 0.12, 12); });
    var tbM = new T.MeshStandardMaterial({ color: 0x8a929a, roughness: 0.5, metalness: 0.3 });
    B.box(tbM, R * 1.1, R * 0.45, 0.02 * K, 0, yh - R * 0.15, -L * 0.28);
    for (var t = 0; t < 4; t++) B.cylZ(MK.paint(0xd7b64a, 0.3, 0.8), 0.005 * K, 0.012 * K, -R * 0.4 + t * R * 0.27, yh - R * 0.15, -L * 0.28 - 0.014 * K, 8);
    [0xff5a3c, 0x2f8cff, 0xf2c500, 0x1aff7a].forEach(function (c2, k) { B.tube(new T.MeshStandardMaterial({ color: c2, roughness: 0.6 }), [[-R * 0.4 + k * R * 0.27, yh - R * 0.15, -L * 0.34], [-R * 0.4 + k * R * 0.27, yh - R * 0.55, -L * 0.34], [-R * 0.95, yh - R * 0.35, -L * 0.2]], 0.0022 * K, 0.01); });
    /* entri kabel (sisi -X) + gland + konduit ke JB */
    B.cylX(housing, 0.019 * K, 0.035 * K, -(R + 0.012 * K), yh - 0.02 * K, -L * 0.22, 12);
    var glM = type === 'exia' ? MK.paint(0x2f8cff, 0.4, 0.3) : (type === 'nonex' ? MK.paint(0x2a2a2a, 0.6, 0.1) : MK.paint(0xc9a227, 0.35, 0.8));
    B.cylX(glM, 0.02 * K, 0.045 * K, -(R + 0.05 * K), yh - 0.02 * K, -L * 0.22, 6);
    var cabM = MK.paint(type === 'exia' ? 0x2f8cff : 0x1d1d1d, 0.6, 0.1);
    B.tube(cabM, [[-(R + 0.07 * K), yh - 0.02 * K, -L * 0.22], [-(R + 0.1 * K), yh - 0.02 * K, -L * 0.22], [-0.16, 0.2, -0.14], [0, -0.2, -0.13]], 0.008, 0.05);
    B.cylX(MK.dark(), 0.02 * K, 0.014, R + 0.01 * K, yh - 0.02 * K, -L * 0.22, 6);
    /* papan nama di sisi +X */
    B.build(g);
    var np = TW.plate(0.1 * K, 0.064 * K, function (c, w, h) {
      c.fillStyle = C.plate; c.fillRect(0, 0, w, h); c.strokeStyle = '#000'; c.lineWidth = 4; c.strokeRect(3, 3, w - 6, h - 6);
      c.fillStyle = '#000'; c.font = 'bold 26px sans-serif'; c.textAlign = 'left'; c.fillText('PT-201  4–20 mA', 12, 34);
      c.font = 'bold 30px sans-serif'; c.fillStyle = type === 'nonex' ? '#c00' : '#000'; c.fillText(type === 'nonex' ? 'TANPA Ex' : C.mark.split(' ').slice(0, 2).join(' '), 12, 74);
      c.fillStyle = '#000'; c.font = 'bold 28px sans-serif'; c.fillText(type === 'nonex' ? 'IP66 · CE' : C.mark.split(' ').slice(2).join(' '), 12, 112); c.font = 'bold 20px sans-serif'; c.fillText(C.sign, 12, 146);
      if (type !== 'nonex') { c.beginPath(); c.moveTo(w - 80, 40); c.lineTo(w - 48, 20); c.lineTo(w - 16, 40); c.lineTo(w - 16, 76); c.lineTo(w - 48, 96); c.lineTo(w - 80, 76); c.closePath(); c.fillStyle = '#000'; c.fill(); c.fillStyle = '#ffd400'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('Ex', w - 48, 70); }
    }, 512);
    np.rotation.y = Math.PI / 2; np.position.set(R + (exd ? 0.012 : 0.004) * K, yh, 0.012); g.add(np);
    /* LCD */
    var lcdC = document.createElement('canvas'); lcdC.width = 128; lcdC.height = 64; var lcdT = new T.CanvasTexture(lcdC); lcdT.encoding = T.sRGBEncoding;
    var lcd = new T.Mesh(new T.CircleGeometry(R * 0.62, 28), new T.MeshBasicMaterial({ map: lcdT, toneMapped: false })); lcd.position.set(0, yh, zf + 0.0008); g.add(lcd);
    hot.setLCD = function (txt, sub, bg) { var c = lcdC.getContext('2d'); c.fillStyle = bg || '#a9c7a6'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#111'; c.font = 'bold 26px monospace'; c.textAlign = 'center'; c.fillText(txt, 64, 34); c.font = '13px monospace'; c.fillText(sub || '', 64, 54); lcdT.needsUpdate = true; };
    hot.setLCD('12.4', 'bar g');
    if (exd) { var fp = new T.Mesh(new T.TorusGeometry(R + 0.001, 0.003 * K, 8, 40), new T.MeshStandardMaterial({ color: 0xffd44a, emissive: 0x553300, emissiveIntensity: 0.7, metalness: 0.9, roughness: 0.2 })); fp.position.set(0, yh, L / 2 + 0.002); g.add(fp); hot.flamePath = fp; }
    var pl = new T.PointLight(0xffcc55, 0, 2.5, 1.5); pl.position.set(0, yh, 0); g.add(pl); hot.light = pl;
    hot.labels.push(TW.label('PT-201<small>' + C.short + '</small>', g, { off: [0, 0.62, 0], cls: C.cls, group: 'tag' }));
    TW.pickable(g, function () { });
    g.updateMatrixWorld(true);
    hot.spark = new T.Vector3(0, yh - R * 0.15, -L * 0.28 - 0.014 * K).applyMatrix4(g.matrixWorld);
    hot.center = new T.Vector3(0, yh, 0).applyMatrix4(g.matrixWorld); INS_C.copy(hot.center);
    hot.ringPos = new T.Vector3(0, yh, L / 2 + 0.002).applyMatrix4(g.matrixWorld); hot.ro = R; hot.ringU = new T.Vector3(1, 0, 0); hot.ringV = new T.Vector3(0, 1, 0); hot.ringN = new T.Vector3(0, 0, 1);
    INS = hot;
    /* kabel dari JB ke kabinet (warna biru = kabel IS) */
    if (scn.cable) { TW.remove(scn.cable.group); TW.dispose(scn.cable.group); }
    scn.cable = TW.pipe([[2.95, 0.49, 0.22], [2.95, PAD + 0.06, 0.22], [2.95, PAD + 0.06, 3.9], [-7.4, PAD + 0.06, 3.9], [-7.4, 0.07, 8.7], [-7.75, 0.07, 8.7], [-7.75, 0.6, 8.7]], 0.014, { mat: MK.paint(type === 'exia' ? 0x2f8cff : 0x1a1a1a, 0.6, 0.1), bend: 0.12 }); TW.add(scn.cable.group);
    scn.barLbl.set(type === 'exia' ? 'BARRIER Ex ia<small>Zener / isolator galvanik</small>' : 'Catu daya 24 VDC (non-IS)', type === 'exia' ? 'ok' : '');
    scn.barLed.material.emissive.set(type === 'exia' ? 0x1aff7a : 0x2f8cff);
    scn.cabinet.visible = true;
  }

  /* -------------------------------------------------- konsentrasi & awan */
  function concAt(p) {
    var G = GAS[CFG.gas], sum = 0, life = gas.life, age = gas.age, x = gas.x, n = gas.n;
    for (var i = 0; i < n; i++) {
      if (life[i] <= 0) continue;
      var sg = 0.12 + 1.08 * age[i] / 8, i3 = i * 3, dx = x[i3] - p.x, dy = x[i3 + 1] - p.y, dz = x[i3 + 2] - p.z, r2 = dx * dx + dy * dy + dz * dz;
      if (r2 > 9 * sg * sg) continue;
      sum += pm[i] / (G.rho * 15.75 * sg * sg * sg) * Math.exp(-r2 / (2 * sg * sg));
    }
    return Math.min(100, sum * 100);
  }
  var tmpP = new T.Vector3();
  function windVec() { var a = CFG.dir * Math.PI / 180; return [Math.cos(a) * CFG.wind, Math.sin(a) * CFG.wind]; }
  function emitGas(dt) {
    if (S.leakK < 0.01) return;
    var G = GAS[CFG.gas], Q = SIZE[CFG.size].q * S.leakK;
    S.acc = (S.acc || 0) + 70 * dt; var n = Math.floor(S.acc); S.acc -= n;
    var w = windVec(), sp = 2.4 + 3.2 * Math.min(1, SIZE[CFG.size].q / 0.5);
    for (var i = 0; i < n; i++) {
      var a = Math.atan2(w[1], w[0]) + TW.rand(-0.9, 0.9), e = TW.rand(-0.35, 0.35), idx = gas.ptr;
      gas.emit(LEAK.x, LEAK.y, LEAK.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp * 0.8, Math.sin(a) * Math.cos(e) * sp, 8, 0.41, 4.1, [0.72, 0.9, 1, 0.16], [0.72, 0.9, 1, 0.0], 0, G.buoy);
      pm[idx] = Q / 70;
    }
  }
  function stepGas(dt) {
    var w = windVec(), k = Math.min(1, 1.5 * dt), kv = Math.min(1, 1.2 * dt), tb = 0.55 * Math.sqrt(dt);
    for (var i = 0; i < gas.n; i++) {
      if (gas.life[i] <= 0) continue; var i3 = i * 3;
      gas.v[i3] += (w[0] - gas.v[i3]) * k + (Math.random() - .5) * tb; gas.v[i3 + 2] += (w[1] - gas.v[i3 + 2]) * k + (Math.random() - .5) * tb;
      gas.v[i3 + 1] -= gas.v[i3 + 1] * kv; if (gas.x[i3 + 1] < 0.15 && gas.v[i3 + 1] < 0) { gas.v[i3 + 1] = 0; gas.x[i3 + 1] = 0.15; }
    }
  }
  function recolorGas() {
    var G = GAS[CFG.gas];
    for (var i = 0; i < gas.n; i++) {
      if (gas.life[i] <= 0) continue; var i3 = i * 3; tmpP.set(gas.x[i3], gas.x[i3 + 1], gas.x[i3 + 2]);
      var c = concAt(tmpP), f = c / G.lel, i4 = i * 4;
      if (f >= 1 && c <= G.uel) { gas.c0[i4] = 1; gas.c0[i4 + 1] = 0.66; gas.c0[i4 + 2] = 0.16; gas.c0[i4 + 3] = 0.3; }
      else if (f >= 0.25) { gas.c0[i4] = 1; gas.c0[i4 + 1] = 0.93; gas.c0[i4 + 2] = 0.5; gas.c0[i4 + 3] = 0.2; }
      else { gas.c0[i4] = 0.72; gas.c0[i4 + 1] = 0.9; gas.c0[i4 + 2] = 1; gas.c0[i4 + 3] = 0.12; }
      gas.c1[i4] = gas.c0[i4]; gas.c1[i4 + 1] = gas.c0[i4 + 1]; gas.c1[i4 + 2] = gas.c0[i4 + 2]; gas.c1[i4 + 3] = 0;
    }
  }

  /* --------------------------------------------------------- kelayakan */
  function assess() {
    var C = INSTR[CFG.inst], G = GAS[CFG.gas], rows = [], ok = true;
    var cert = C.epl != null; rows.push([cert, 'Sertifikat Ex (IECEx / ATEX)', cert ? C.mark : 'tidak ada']); if (!cert) ok = false;
    var eplOk = C.epl === 'Ga' || C.epl === 'Gb'; rows.push([eplOk, 'EPL untuk Zona 1 (butuh ≥ Gb)', C.epl ? 'instrument: ' + C.epl : 'tidak ada EPL']); if (!eplOk) ok = false;
    var grpOk = C.grp != null && GRP[C.grp] >= GRP[G.grp]; rows.push([grpOk, 'Kelompok gas: instrument ' + (C.grp || '-') + ' vs gas ' + G.grp, grpOk ? 'sesuai' : (C.grp ? 'celah flame-path / energi tak memadai (MESG ' + idc(G.mesg, 2) + ' mm)' : 'tidak ada')]); if (!grpOk) ok = false;
    var tOk = C.epl != null; rows.push([tOk, 'Kelas suhu T4 (135 °C) < AIT gas ' + G.ait + ' °C', tOk ? 'permukaan aman' : 'suhu permukaan tak terkontrol']); if (!tOk) ok = false;
    return { ok: ok, rows: rows };
  }

  /* ---------------------------------------------------------- kejadian */
  function log(t, cls) { S.log.push([S.leak ? S.leakT : 0, t, cls || '']); renderResult(); }
  function startLeak() {
    if (S.leak) return; S.leak = true; S.leakT = 0; S.leakK = 1; S.esd = false; S.esdPend = -1;
    setState('KEBOCORAN GAS', 'warn'); log('Flange F-201 bocor: ' + GAS[CFG.gas].name + ', ' + SIZE[CFG.size].name.toLowerCase() + ' (' + idc(SIZE[CFG.size].q, 2) + ' kg/s).', 'warn'); renderCompat();
  }
  function failInstrument() {
    if (S.failed) return; S.failed = true; S.sparkT = 0;
    var m = MODES[CFG.mode]; log('Instrument PT-201 GAGAL: ' + m.name + '.', 'bad'); setState(S.ignited ? 'KEBAKARAN' : 'INSTRUMEN GAGAL', 'bad');
    if (CFG.inst === 'exia' && CFG.mode === 'surge') { scn.barLed.material.emissive.set(0xff2020); scn.barLbl.set('BARRIER Ex ia<small>sekring putus &mdash; loop terisolasi</small>', 'warn'); }
  }
  function doEsd() {
    if (S.esd) return; S.esd = true; S.esdT = 0; flare.k = 1; log('ESD aktif: isolasi feed &amp; depresurisasi ke flare (kebocoran meluruh).', 'ok'); $('k-esd').textContent = 'AKTIF'; $('k-esd').className = 'ok';
  }
  function eventEnergy() { return MODES[CFG.mode].E[CFG.inst]; }

  function sparkBurst(n, size, rate) {
    for (var i = 0; i < n; i++) TW.fx.fireSys.emit(INS.spark.x + TW.rand(-0.03, 0.03), INS.spark.y + TW.rand(-0.02, 0.04), INS.spark.z + TW.rand(-0.03, 0.03), TW.rand(-0.8, 0.8), TW.rand(-0.2, 1.0), TW.rand(-0.8, 0.8), TW.rand(0.15, 0.45), size, size * 0.4, [1, 0.9, 0.5, 1], [1, 0.4, 0.1, 0], 2, -2);
  }
  function internalFlash(escape) {
    var ctr = INS.center;
    for (var i = 0; i < 46; i++) TW.fx.fireSys.emit(ctr.x + TW.rand(-0.04, 0.04), ctr.y + TW.rand(-0.04, 0.04), ctr.z + TW.rand(-0.06, 0.06), TW.rand(-1, 1), TW.rand(-0.4, 1), TW.rand(-1, 1), TW.rand(0.25, 0.55), 0.07, 0.12, [1, 0.92, 0.55, 0.95], [1, 0.3, 0.05, 0], 3, 0);
    INS.light.intensity = 6; INS.flash = 0.5;
    INS.pulse = 0.5;
    var rp = INS.ringPos, U = INS.ringU, V = INS.ringV, N = INS.ringN;
    for (var j = 0; j < 44; j++) {
      var a = Math.random() * Math.PI * 2, r = INS.ro, cx = Math.cos(a), sy = Math.sin(a);
      var px = rp.x + (U.x * cx + V.x * sy) * r, py = rp.y + (U.y * cx + V.y * sy) * r, pz = rp.z + (U.z * cx + V.z * sy) * r;
      if (escape) { var sp = TW.rand(2, 4); TW.fx.fireSys.emit(px, py, pz, (U.x * cx + V.x * sy) * sp + N.x * 1.5, (U.y * cx + V.y * sy) * sp + TW.rand(0, 1.2), (U.z * cx + V.z * sy) * sp + N.z * 1.5, TW.rand(0.3, 0.7), 0.1, 0.35, [1, 0.8, 0.35, 0.95], [1, 0.25, 0.05, 0], 1, 0); }
      else TW.fx.fireSys.emit(px, py, pz, (U.x * cx + V.x * sy) * 0.3 + N.x * 0.2, (U.y * cx + V.y * sy) * 0.3, (U.z * cx + V.z * sy) * 0.3 + N.z * 0.2, TW.rand(0.3, 0.6), 0.04, 0.02, [1, 0.85, 0.4, 0.95], [0.25, 0.3, 0.4, 0], 3, 0);
    }
  }
  function safeEvent() {
    var C = CFG.inst, G = GAS[CFG.gas], E = eventEnergy();
    S.event = 'safe'; S.verdict = 'ok';
    if (C === 'exia') {
      sparkBurst(6, 0.02); INS.light.color.set(0x8fc8ff); INS.light.intensity = 0.7; INS.flash = 0.6;
      log('Percikan di terminal hanya ' + idc(E, 3) + ' mJ (dibatasi barrier) &lt; MIE ' + G.name.split(' ')[0] + ' ' + idc(G.mie, 3) + ' mJ &rarr; TIDAK menyulut.' + (CFG.mode === 'surge' ? ' Sekring barrier putus, 230 VAC tidak sampai ke area berbahaya.' : ''), 'ok');
      res('ok', 'AMAN &mdash; INSTRUMEN GAGAL, TIDAK ADA PENYALAAN', 'Energi dibatasi (Ex ia) &mdash; instrument bisa rusak, atmosfer tidak menyala.');
    } else {
      internalFlash(false);
      log('Gas masuk enklosur, meledak di dalam. Dinding tebal menahan tekanan; celah flame-path mendinginkan gas panas ~2000 &rarr; ~200 &deg;C (&lt; AIT ' + G.ait + ' &deg;C) &rarr; api TIDAK keluar.', 'ok');
      res('ok', 'AMAN &mdash; LEDAKAN INTERNAL DITAHAN', 'Enklosur flameproof ' + INSTR[C].mark.split(' ').slice(2, 5).join(' ') + ' utuh; awan gas di luar tidak menyala.');
    }
    setState('AMAN', 'ok'); showBanner('ok', 'AMAN &mdash; INSTRUMEN GAGAL, INSTALASI SELAMAT', 'Proteksi Ex bekerja: tidak ada sumber nyala yang keluar. Isolasi kebocoran &amp; ganti instrument.');
    renderInfo(); drawEnergy(); updatePanels();
  }
  function fireEvent(kind) {
    var C = CFG.inst, G = GAS[CFG.gas], E = eventEnergy();
    S.event = 'fire'; S.verdict = 'bad';
    if (kind === 'transmit') {
      internalFlash(true);
      log('Ledakan internal MENEMBUS celah flame-path IIB: MESG ' + G.name.split(' ')[0] + ' ' + idc(G.mesg, 2) + ' mm &lt; celah enklosur &rarr; api keluar dan menyulut awan gas.', 'bad');
    } else {
      sparkBurst(30, 0.05); INS.light.intensity = 8; INS.flash = 0.6;
      log('Percikan ' + idc(E, E < 1 ? 2 : 0) + ' mJ &raquo; MIE ' + G.name.split(' ')[0] + ' ' + idc(G.mie, 3) + ' mJ (' + Math.round(E / G.mie) + '×) di dalam awan pada ' + idc(S.cInst, 1) + ' % vol (LEL–UEL ' + G.lel + '–' + G.uel + ' %) &rarr; PENYALAAN.', 'bad');
    }
    ignite();
  }
  function ignite() {
    var G = GAS[CFG.gas]; S.ignited = true; S.igT = 0; setState('KEBAKARAN', 'bad');
    burn.length = 0; var mFlam = 0;
    for (var i = 0; i < gas.n; i++) {
      if (gas.life[i] <= 0) continue; var i3 = i * 3; tmpP.set(gas.x[i3], gas.x[i3 + 1], gas.x[i3 + 2]);
      var c = concAt(tmpP); if (c >= G.lel * 0.85 && c <= G.uel * 1.2) { burn.push({ i: i, t: tmpP.distanceTo(INS.center) / G.front + Math.random() * 0.15, done: false }); mFlam += pm[i]; }
    }
    S.mFlam = mFlam; var R = TW.clamp(2 + 25 * mFlam, 2.2, 7.5);
    TW.fx.fireSys.emit(INS.center.x, INS.center.y, INS.center.z, 0, 0, 0, 0.5, 1.2, 2.5, [1, 0.95, 0.6, 1], [1, 0.4, 0.1, 0], 0, 0);
    S.igPos = INS.center.clone(); S.vce = mFlam > 0.06 && SIZE[CFG.size].q >= 0.12;
    S.flameLeakT = INS.center.distanceTo(LEAK) / G.front;
    S.jetOn = false; S.blastPending = S.vce ? R : 0; S.blastT = 0.5;
    log('Flash fire menjalar melalui awan (' + idc(mFlam * 1000, 0) + ' g gas dalam rentang mudah terbakar)' + (S.vce ? ' &mdash; pipa/rack padat memicu ledakan awan uap (VCE)' : '') + '.', 'bad');
    charInstrument();
    $('redalert').style.transition = 'opacity .3s'; S.alert = true;
    TW.flyTo([11.5, 7.8, 18.5], [2.5, 2.6, -1.5], 1.8);
    showBanner('bad', 'KEBAKARAN HEBAT &mdash; INSTRUMEN SUMBER NYALA', 'Awan gas menyala; api menjalar ke flange, bejana dan tangki. ESD &amp; evakuasi!');
  }
  function charInstrument() { INS.housing.color.set(0x111111); INS.housing.emissive.set(0x300800); INS.g.children.forEach(function (c) { if (c.material && c.material.color && !c.material.userData.shell && c.material !== INS.housing) c.material = c.material.clone(), c.material.color.multiplyScalar(0.25); }); S.dmg.pt = 1; }
  function rupture() {
    S.ruptured = true; scn.ves.visible = false; scn.z0.visible = false;
    TW.fx.blast([VES.x, VES.y + 0.5, VES.z], 7.5); TW.fx.scorch([VES.x, 0, VES.z], 6);
    vesFire.k = 1; S.domT = 0; S.dmg.ves = 1;
    TW.flyTo([9.5, 8.5, 21], [2.5, 2.8, -2.5], 1.6);
    log('BEJANA V-201 PECAH (BLEVE): dinding melemah oleh api &rarr; bola api besar, pecahan terlempar.', 'bad');
    showBanner('bad', 'BEJANA V-201 MELEDAK (BLEVE)', 'Bola api, gelombang tekan, dan pecahan &mdash; api menjalar ke tangki T-202 (domino).');
  }
  function tankBlast() {
    S.tankBlast = true; scn.tank.visible = false; TW.fx.blast([TANK.x, TANK.y, TANK.z], 8); TW.fx.scorch([TANK.x, 0, TANK.z], 7); tankFire.k = 1; tankFire.size = 2.4; S.dmg.tank = 1;
    log('DOMINO: tangki bola T-202 ikut meledak akibat radiasi panas &mdash; seluruh instalasi terbakar.', 'bad');
    showBanner('bad', 'EFEK DOMINO &mdash; SELURUH INSTALASI TERBAKAR', 'Satu instrument non-Ex di Zona 1 memicu kerusakan total. Bandingkan dengan Ex db/ia yang sesuai.');
  }
  function reset() {
    var wasFire = S.ignited;
    S.leak = false; S.leakT = 0; S.leakK = 0; S.esd = false; S.esdPend = -1; S.failed = false; S.ignited = false; S.event = null; S.verdict = null; S.H = 0; S.ruptured = false; S.domT = -1; S.tankBlast = false; S.dmg = { pt: 0, pipe: 0, ves: 0, tank: 0 }; S.auto = false; S.flux = 0; S.log = []; S.alert = false; S.mFlam = 0; S.igT = 0; S.jetOn = false; S.acc = 0;
    burn.length = 0; gas.clear(); TW.fx.reset(); jet.k = vesFire.k = tankFire.k = 0; flare.k = 0.22;
    scn.ves.visible = true; scn.z0.visible = true; scn.tank.visible = true; TW.heat(scn.vesMat, 0); scn.vesMat.color.copy(scn.vesMat.userData.base); TW.heat(scn.tankMat, 0); scn.tankMat.color.copy(scn.tankMat.userData.base); scn.pipeMat.color.copy(scn.pipeMat.userData.base); TW.heat(scn.pipeMat, 0);
    buildInstrument(CFG.inst); $('banner').className = 'banner'; $('redalert').style.opacity = 0; $('k-esd').textContent = 'siaga'; $('k-esd').className = '';
    setState('NORMAL', ''); $('res-panel').className = 'panel'; renderResult(); renderCompat(); drawEnergy(); renderInfo(); if (wasFire) TW.flyTo([10.5, 7.5, 19.5], [1.5, 1.8, -1.5], 1.2);
  }

  /* ------------------------------------------------------------------ UI */
  function setState(t, c) { var b = $('state-badge'); b.textContent = t; b.className = 'badge ' + (c || ''); }
  function showBanner(cls, t, sub) { var b = $('banner'); b.className = 'banner ' + cls; b.innerHTML = t + '<small>' + sub + '</small>'; if (cls === 'ok') setTimeout(function () { if (b.className.indexOf('ok') >= 0) b.className = 'banner'; }, 9000); }
  function res(cls, title, sub) { S.resTitle = [cls, title, sub]; renderResult(); }
  function renderResult() {
    var box = $('res-box'), h = '';
    if (S.resTitle) h += '<div class="tag ' + S.resTitle[0] + '" style="font-size:11px">' + S.resTitle[1] + '</div><div class="note" style="margin-bottom:5px">' + S.resTitle[2] + '</div>';
    if (!S.log.length && !S.resTitle) h = 'Belum ada kejadian. Jalankan skenario.';
    h += S.log.map(function (l) { return '<div class="kv" style="display:block"><b class="' + l[2] + '" style="font-size:11px">t=' + idc(l[0], 0) + ' s</b> &nbsp;<span style="color:#cfe6f5;font-size:12px">' + l[1] + '</span></div>'; }).join('');
    box.innerHTML = h;
    $('res-panel').className = 'panel' + (S.verdict === 'bad' ? ' bad' : (S.verdict === 'ok' ? ' ok' : ''));
  }
  function renderCompat() {
    var a = assess(), h = '<div style="margin-bottom:5px"><span class="tag ' + (a.ok ? 'ok' : 'bad') + '">' + (a.ok ? 'LAYAK UNTUK ZONA 1 &middot; GAS ' + GAS[CFG.gas].grp : 'TIDAK LAYAK &mdash; ' + (a.rows.filter(function (r) { return !r[0]; }).length) + ' ketidaksesuaian') + '</span></div>';
    h += a.rows.map(function (r) { return '<div class="kv"><span>' + (r[0] ? '&#10003; ' : '&#10007; ') + r[1] + '</span><b class="' + (r[0] ? 'ok' : 'bad') + '" style="font-size:11px;text-align:right;max-width:150px">' + r[2] + '</b></div>'; }).join('');
    $('compat').innerHTML = h; $('hdr-mark').textContent = INSTR[CFG.inst].mark; $('hdr-sub').textContent = INSTR[CFG.inst].name + ' — ' + (a.ok ? 'sesuai' : 'TIDAK sesuai');
    INS.labels[0].set('PT-201<small>' + INSTR[CFG.inst].short + '</small>', a.ok ? 'ok' : 'bad');
  }
  function buildCards() {
    var box = $('inst-cards'); box.innerHTML = '';
    INSTR_ORDER.forEach(function (k) {
      var C = INSTR[k], d = document.createElement('div'); d.className = 'card' + (CFG.inst === k ? ' sel' : ''); d.dataset.k = k;
      d.innerHTML = '<div class="t"><span>' + C.name + '</span><span class="tag ' + C.cls + '">' + C.short + '</span></div><div class="m">' + C.mark + '</div><div class="d">' + C.d + '</div>';
      d.onclick = function () { CFG.inst = k; Array.prototype.forEach.call(box.children, function (c) { c.classList.toggle('sel', c.dataset.k === k); }); reset(); };
      box.appendChild(d);
    });
  }
  function drawEnergy() {
    var cv = $('en-canvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height, G = GAS[CFG.gas], E = eventEnergy();
    g.clearRect(0, 0, W, H); var pl = 96, pr = 10, w = W - pl - pr, lo = -3, hi = 3.2, X = function (v) { return pl + w * (Math.log10(v) - lo) / (hi - lo); };
    g.font = '10px JetBrains Mono, monospace'; g.strokeStyle = 'rgba(0,229,255,.12)'; g.textAlign = 'center'; g.fillStyle = '#7f9db3';
    ['0,001', '0,01', '0,1', '1', '10', '100', '1000'].forEach(function (t, k) { var x = X(Math.pow(10, k - 3)); g.beginPath(); g.moveTo(x, 8); g.lineTo(x, H - 16); g.stroke(); g.fillText(t, x, H - 4); });
    g.textAlign = 'right'; g.font = '11px Rajdhani, sans-serif'; g.fillStyle = '#cfe6f5';
    var bars = [['MIE ' + G.name.split(' ')[0], G.mie, '#5cf0ff'], ['Energi percikan', E, E > G.mie && CFG.inst !== 'exdB' && CFG.inst !== 'exdC' ? '#ff3d4d' : '#29e08a']];
    bars.forEach(function (b, k) { var y = 16 + k * 36; g.fillStyle = '#cfe6f5'; g.fillText(b[0], pl - 6, y + 13); g.fillStyle = b[2]; g.fillRect(pl, y, Math.max(2, X(Math.max(b[1], 0.001)) - pl), 20); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(idc(b[1], b[1] < 0.1 ? 3 : (b[1] < 10 ? 1 : 0)) + ' mJ', Math.min(X(Math.max(b[1], 0.001)) + 5, W - 60), y + 14); g.textAlign = 'right'; });
    var mx = X(G.mie); g.strokeStyle = '#5cf0ff'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(mx, 6); g.lineTo(mx, H - 16); g.stroke(); g.setLineDash([]);
    var C = CFG.inst, ratio = E / G.mie, note;
    if (C === 'exdB' || C === 'exdC') note = 'Ex d tidak membatasi energi: percikan ' + idc(E, 0) + ' mJ boleh terjadi di dalam, tetapi <b>tidak boleh keluar</b> (dinding + flame-path).';
    else if (C === 'exia') note = 'Ex ia membatasi energi di sumbernya: ' + idc(E, 3) + ' mJ &lt; MIE (' + idc(1 / ratio, 1) + '× di bawah). Tidak bisa menyulut.';
    else note = 'Percikan ' + idc(E, E < 1 ? 1 : 0) + ' mJ = <b>' + Math.round(ratio) + '× MIE</b> ' + G.name.split(' ')[0] + ' &rarr; cukup menyulut campuran di rentang mudah terbakar.';
    $('en-note').innerHTML = note;
  }
  function renderInfo() {
    var G = GAS[CFG.gas], C = INSTR[CFG.inst];
    var h = '<h4>GAS: ' + G.name + '</h4><p><code>LEL ' + G.lel + '% · UEL ' + G.uel + '% · MIE ' + G.mie + ' mJ · AIT ' + G.ait + '°C · MESG ' + G.mesg + ' mm · kelompok ' + G.grp + '</code></p><p>' + G.tip + '</p>';
    h += '<h4>SEGITIGA API &amp; ZONA</h4><ul class="pc"><li>Api butuh 3 hal: <b>bahan bakar</b> (konsentrasi antara LEL&ndash;UEL), <b>oksigen</b>, <b>sumber nyala</b>. Proteksi Ex menghilangkan sumber nyala.</li><li><b>Zona 0</b> gas ada terus-menerus (&gt;1000 j/th) &rarr; EPL Ga. <b>Zona 1</b> kadang ada saat normal (10&ndash;1000 j/th) &rarr; Gb. <b>Zona 2</b> jarang (&lt;10 j/th) &rarr; Gc. (IEC 60079-10-1; NEC: Class I Div 1/2.)</li></ul>';
    h += '<h4>KONSEP PROTEKSI</h4><ul class="pc"><li><b>Ex d</b> (flameproof): menahan ledakan internal, celah dingin mendinginkan api.</li><li><b>Ex ia / ib</b> (intrinsic safety): membatasi energi (Uo, Io, Po, Co, Lo) lewat barrier.</li><li><b>Ex e / ec / nA</b>: mencegah percikan &amp; panas berlebih, dipakai Zona 2 (ec) atau Zona 1 (e).</li><li><b>Ex p, Ex m, Ex o, Ex q</b>: pressurisasi, encapsulation, oil, pasir.</li></ul>';
    h += '<h4>MEMBACA PENANDAAN</h4><p><code>' + C.mark + '</code></p><p class="note"><b>II</b> industri permukaan &middot; <b>2G</b> kategori 2 gas (Zona 1) &middot; <b>Ex db</b> flameproof &middot; <b>IIC</b> kelompok gas (H₂/C₂H₂) &middot; <b>T4</b> suhu permukaan maks. 135 °C &middot; <b>Gb</b> EPL Zona 1.</p>';
    $('info-box').innerHTML = h;
  }
  function updatePanels() {
    var G = GAS[CFG.gas];
    $('c-vol').textContent = idc(S.cInst, 1); $('c-lel').textContent = Math.round(S.cInst / G.lel * 100);
    var gd = $('gd-lel'); gd.textContent = Math.round(S.gdLel); gd.style.color = S.gdLel >= 40 ? '#ff3d4d' : (S.gdLel >= 20 ? '#ffb020' : '#fff');
    $('gd-state').textContent = S.gdLel >= 40 ? 'ALARM TINGGI' : (S.gdLel >= 20 ? 'ALARM' : 'normal'); $('gd-state').style.color = S.gdLel >= 20 ? '#ffb020' : '';
    scn.gdLed.material.emissive.set(S.gdLel >= 40 ? 0xff2020 : (S.gdLel >= 20 ? 0xffb020 : 0x1aff7a));
    scn.gdLbl.set('GD-201<small>' + Math.round(S.gdLel) + '% LEL</small>', S.gdLel >= 40 ? 'bad' : (S.gdLel >= 20 ? 'warn' : ''));
    $('k-range').textContent = G.lel + ' – ' + G.uel + ' % vol';
    $('k-leak').textContent = S.leak ? (S.esd ? 'meluruh (ESD)' : SIZE[CFG.size].name + ' · ' + idc(S.leakT, 0) + ' s') : 'tidak bocor'; $('k-leak').className = S.leak ? 'warn' : '';
    var bars = [['pt', 'PT-201 (instrument)'], ['pipe', 'Pipa &amp; flange F-201'], ['ves', 'Bejana V-201'], ['tank', 'Tangki bola T-202']];
    var box = $('dmg-bars'); if (!box.children.length) bars.forEach(function (b) { var d = document.createElement('div'); d.className = 'row-bar'; d.innerHTML = '<div class="hd"><span>' + b[1] + '</span><b id="dm-v-' + b[0] + '"></b></div><div class="bar" id="dm-b-' + b[0] + '"><i></i></div>'; box.appendChild(d); });
    bars.forEach(function (b) { var v = S.dmg[b[0]] * 100, e = $('dm-b-' + b[0]); e.firstChild.style.width = v + '%'; e.className = 'bar ' + (v > 60 ? 'bad' : (v > 5 ? 'warn' : 'ok')); $('dm-v-' + b[0]).textContent = Math.round(v) + ' %'; });
    $('k-flux').textContent = Math.round(S.flux) + ' kW/m²'; $('k-flux').className = S.flux > 37 ? 'bad' : (S.flux > 12 ? 'warn' : '');
    // grafik ambang mudah terbakar
    var cv = $('flam-canvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height, mx = Math.min(100, G.uel * 1.6), X = function (v) { return 8 + (W - 16) * Math.min(v, mx) / mx; };
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(41,224,138,.28)'; g.fillRect(8, 12, X(G.lel) - 8, 16); g.fillStyle = 'rgba(255,61,77,.45)'; g.fillRect(X(G.lel), 12, X(G.uel) - X(G.lel), 16); g.fillStyle = 'rgba(255,176,32,.25)'; g.fillRect(X(G.uel), 12, W - 8 - X(G.uel), 16);
    g.font = '10px Rajdhani, sans-serif'; g.fillStyle = '#cfe6f5'; g.textAlign = 'center'; g.fillText('terlalu miskin', (8 + X(G.lel)) / 2, 24); g.fillText('MUDAH TERBAKAR', (X(G.lel) + X(G.uel)) / 2, 24); if (X(G.uel) < W - 60) g.fillText('kaya', (X(G.uel) + W) / 2, 24);
    g.textAlign = 'left'; g.fillStyle = '#7f9db3'; g.fillText('LEL ' + G.lel + '%', X(G.lel) - 12, 40); g.textAlign = 'right'; if (X(G.uel) < W - 50) g.fillText('UEL ' + G.uel + '%', X(G.uel) + 14, 40);
    var px = X(S.cInst); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(px, 30); g.lineTo(px - 5, 8); g.lineTo(px + 5, 8); g.closePath(); g.fill();
  }

  function wireUI() {
    var gs = $('sel-gas'); Object.keys(GAS).forEach(function (k) { gs.insertAdjacentHTML('beforeend', '<option value="' + k + '"' + (k === CFG.gas ? ' selected' : '') + '>' + GAS[k].name + ' (' + GAS[k].grp + ')</option>'); });
    gs.onchange = function () { CFG.gas = gs.value; reset(); };
    $('sel-size').onchange = function () { CFG.size = this.value; reset(); };
    var ms = $('sel-mode'); Object.keys(MODES).forEach(function (k) { ms.insertAdjacentHTML('beforeend', '<option value="' + k + '">' + MODES[k].name + '</option>'); });
    ms.onchange = function () { CFG.mode = ms.value; drawEnergy(); };
    var sw = $('sl-wind'), sd = $('sl-dir');
    sw.oninput = function () { CFG.wind = parseFloat(sw.value); $('sv-wind').textContent = idc(CFG.wind, 1) + ' m/s'; }; sw.oninput();
    sd.oninput = function () { CFG.dir = parseFloat(sd.value); $('sv-dir').innerHTML = Math.round(CFG.dir) + '&deg;'; }; sd.oninput();
    $('chk-esd').checked = CFG.autoEsd; $('chk-esd').onchange = function () { CFG.autoEsd = this.checked; };
    $('btn-leak').onclick = startLeak; $('btn-fail').onclick = failInstrument; $('btn-esd').onclick = function () { if (!S.leak) startLeak(); doEsd(); };
    $('btn-auto').onclick = function () { reset(); S.auto = true; startLeak(); $('scn-note').innerHTML = 'Otomatis: menunggu awan gas mencapai LEL di instrument, lalu instrument digagalkan.'; };
    $('btn-reset').onclick = reset;
    TW.key(' ', function () { $('btn-auto').click(); });
    TW.wireView({ xray: 'btn-xray', labels: 'btn-lbl', slider: 'sl-xop' }); TW.setXray(true, 0.2);
    var bz = $('btn-zone'), bc = $('btn-cloud');
    bz.onclick = function () { CFG.zones = !CFG.zones; bz.classList.toggle('active', CFG.zones); }; bc.onclick = function () { CFG.cloud = !CFG.cloud; bc.classList.toggle('active', CFG.cloud); };
    TW.camButtons('cam-btns', [
      { name: 'OVERVIEW', pos: [10.5, 7.5, 19.5], tgt: [1.5, 1.8, -1.5] },
      { name: 'INSTRUMEN', pos: [3.62, 1.55, 1.2], tgt: [2.95, 1.25, 0.33] },
      { name: 'FLANGE + AWAN', pos: [5.8, 2.6, 4.4], tgt: [2.4, 1.3, 0.1] },
      { name: 'BEJANA V-201', pos: [-7.8, 4.8, -10.2], tgt: [-1.0, 2.0, -3.3] },
      { name: 'ATAS &middot; ZONA', pos: [2.4, 18, 5.5], tgt: [2.2, 0, 0.0] },
      { name: 'TANGKI T-202', pos: [17, 6.5, 7], tgt: [10, 3, -2.4] },
      { name: 'AREA AMAN', pos: [-1.5, 3.8, 15.5], tgt: [-9.5, 1.6, 7] },
      { name: 'RACK &amp; FLARE', pos: [-3, 9, 14], tgt: [-10, 6, -6] }
    ]);
    Array.prototype.forEach.call($('cam-btns').children, function (b) { b.innerHTML = b.textContent; });
  }

  /* ---------------------------------------------------------------- loop */
  var uiAcc = 0, glowT = 0;
  function frame(dt) {
    var G = GAS[CFG.gas];
    // waktu
    if (S.leak) S.leakT += dt;
    if (S.esd) { S.esdT += dt; S.leakK = Math.exp(-S.esdT / 25); if (S.esdT > 40) flare.k = Math.max(0.22, flare.k - dt * 0.05); }
    if (S.esdPend >= 0) { S.esdPend -= dt; if (S.esdPend < 0) doEsd(); }
    // awan gas
    emitGas(dt); stepGas(dt); gas.update(dt);
    gas.mesh.visible = CFG.cloud;
    colT += dt; if (colT > 0.12) { colT = 0; if (S.leak || gas.alive > 0) recolorGas(); }
    S.cInst = concAt(INS.center); S.gdLel = concAt(GD) / G.lel * 100;
    // auto ESD dari detektor
    if (CFG.autoEsd && S.leak && !S.esd && S.esdPend < 0 && S.gdLel >= 40) { S.esdPend = 3; log('Detektor GD-201 &ge; 40 % LEL: perintah ESD (tunda 3 s untuk respons valve).', 'warn'); }
    // skenario otomatis
    if (S.auto && S.leak && !S.failed && S.cInst >= G.lel * 0.92) { S.auto = false; failInstrument(); }
    // instrument gagal -> evaluasi
    if (S.failed && !S.event) {
      var a = assess(), flam = S.cInst >= G.lel && S.cInst <= G.uel * 1.05, C = CFG.inst;
      S.sparkT += dt;
      if (C === 'nonex' || C === 'exec') { if (Math.random() < dt * 4) sparkBurst(3, 0.03); INS.light.intensity = Math.random() < 0.5 ? 2 : 0; if (flam) fireEvent('direct'); else if (!S.latentLogged && S.sparkT > 0.5) { S.latentLogged = true; S.verdict = null; res('warn', 'INSTRUMEN GAGAL &mdash; BELUM ADA GAS DI RENTANG MUDAH TERBAKAR', 'Ia memercik menunggu bahan bakar (sumber nyala aktif).'); log('Belum ada gas mudah terbakar di instrument &rarr; belum menyala, tetapi instrument non-Ex terus memercik (sumber nyala menunggu).', 'warn'); } }
      else if (C === 'exia') { if (flam || S.sparkT > 1.2) { if (flam) safeEvent(); } if (!flam && !S.latentLogged && S.sparkT > 0.6) { S.latentLogged = true; res('warn', 'INSTRUMEN GAGAL &mdash; MENUNGGU GAS', 'Energi percikan dibatasi barrier; aman walau gas datang.'); } }
      else { if (flam) { if (a.ok) safeEvent(); else fireEvent('transmit'); } else if (!S.latentLogged && S.sparkT > 0.6) { S.latentLogged = true; res('warn', 'INSTRUMEN GAGAL &mdash; MENUNGGU GAS', 'Belum ada gas di dalam/luar enklosur.'); } }
    }
    if (!S.failed) S.latentLogged = false;
    // penjalaran api pada awan
    if (S.ignited) {
      S.igT += dt;
      burn.forEach(function (b) {
        if (b.done || b.t > S.igT) return; b.done = true; var i3 = b.i * 3;
        if (gas.life[b.i] > 0) {
          var sg = 0.12 + 1.08 * gas.age[b.i] / 8, sz = Math.max(0.5, sg * 3.4);
          for (var k = 0; k < 4; k++) TW.fx.fireSys.emit(gas.x[i3] + TW.rand(-sg, sg) * 0.5, gas.x[i3 + 1] + TW.rand(-sg, sg) * 0.4, gas.x[i3 + 2] + TW.rand(-sg, sg) * 0.5, TW.rand(-0.6, 0.6), TW.rand(0.5, 2.2), TW.rand(-0.6, 0.6), TW.rand(0.6, 1.3), sz * 0.5, sz * 1.2, [1, 0.85, 0.45, 0.85], [1, 0.25, 0.04, 0], 0.8, 1.2);
          gas.life[b.i] = 0;
        }
      });
      if (S.blastPending && S.igT > S.blastT + 0.6) { TW.fx.blast([INS.center.x + 0.6, 1.8, INS.center.z], S.blastPending); S.blastPending = 0; S.dmg.pipe = Math.max(S.dmg.pipe, 0.25); }
      if (!S.jetOn && S.igT > S.flameLeakT + 0.4) { S.jetOn = true; log('Api sampai sumber kebocoran: JET FIRE di flange F-201.', 'bad'); }
      var wv = windVec(); var targetK = S.jetOn ? S.leakK * SIZE[CFG.size].I * 1.0 + 0.0 : 0;
      jet.k += (targetK - jet.k) * Math.min(1, dt * 3); jet.size = 0.5 + 1.1 * SIZE[CFG.size].I;
      var dv = new T.Vector3(wv[0] * 0.25, 1.0, wv[1] * 0.25).normalize(); jet.dir.copy(dv); jet.pos.copy(LEAK);
      if (jet.light) jet.light.position.set(LEAK.x, LEAK.y + 0.6, LEAK.z);
      // pemanasan bejana & pipa
      if (!S.ruptured) {
        S.H += jet.k * dt / 22 + (S.igT < 3 ? dt * 0.012 : 0);
        S.flux = jet.k * 85 + (S.igT < 4 ? 40 : 0);
        S.dmg.pipe = Math.max(S.dmg.pipe, Math.min(1, S.H * 1.05)); S.dmg.ves = Math.min(1, S.H);
        TW.heat(scn.vesMat, Math.max(0, (S.H - 0.25) / 0.75)); scn.vesMat.color.copy(scn.vesMat.userData.base).lerp(new T.Color(0x1a1512), Math.min(1, S.H * 0.9));
        TW.heat(scn.pipeMat, Math.max(0, (S.H - 0.15) / 0.85));
        if (S.H > 0.55 && vesFire.k < 0.5) vesFire.k = Math.min(0.5, (S.H - 0.55) * 1.4);
        vesFire.pos.set(VES.x + 1.6, VES.y + VR, VES.z + 0.4); vesFire.size = 1.1;
        if (S.H >= 1) rupture();
      } else {
        S.flux = 30 + 220 * Math.max(0, 1 - (S.domT || 0) / 10);
        if (S.domT >= 0) {
          S.domT += dt;
          if (S.domT > 5 && tankFire.k < 0.6) { tankFire.k = 0.6; tankFire.size = 1.2; tankFire.pos.set(TANK.x, TANK.y + 1.5, TANK.z); log('Radiasi panas menyulut T-202: api muncul di tangki bola.', 'bad'); }
          S.dmg.tank = Math.max(S.dmg.tank, Math.min(0.9, (S.domT - 3) / 14));
          TW.heat(scn.tankMat, Math.min(1, (S.domT - 3) / 14));
          if (S.domT > 17 && !S.tankBlast) tankBlast();
        }
        vesFire.pos.set(VES.x, 1.0, VES.z); vesFire.size = 2.3; vesFire.k = Math.min(1, vesFire.k + dt);
      }
      if (S.alert) $('redalert').style.opacity = 0.55 + 0.4 * Math.sin(TW.time() * 6);
    }
    // efek internal instrument
    if (INS.flash > 0) { INS.flash -= dt; if (INS.flash <= 0 && CFG.inst !== 'nonex' && CFG.inst !== 'exec') INS.light.intensity = 0; else if (INS.flash > 0) INS.light.intensity *= 0.94; }
    if (INS.pulse > 0) { INS.pulse -= dt; var s = 1 + 0.03 * Math.sin(INS.pulse * 40) * Math.min(1, INS.pulse * 3); INS.wall.scale.set(s, 1, s); if (INS.pulse <= 0) INS.wall.scale.set(1, 1, 1); }
    // zona, kantong angin
    scn.z1.visible = scn.z2.visible = scn.z0.visible = CFG.zones && !S.ruptured; scn.zoneLbls.forEach(function (l) { l.hidden = !CFG.zones; });
    scn.z1.material.opacity = 0.09 + 0.02 * Math.sin(TW.time() * 2); scn.z2.material.opacity = 0.06; scn.z0.material.opacity = 0.12 + 0.03 * Math.sin(TW.time() * 3);
    var w = windVec(); var ang = Math.atan2(-w[1], w[0]); scn.sockPivot.rotation.y = ang; scn.sockCone.rotation.z = -Math.PI / 2 + Math.max(0, 1 - CFG.wind / 5) * 1.1;
    uiAcc += dt; if (uiAcc > 0.1) { uiAcc = 0; updatePanels(); }
  }

  HZ.start = function () {
    TW.init({ bg: 0xcfdde8, sky: { sunDir: [0.45, 0.8, 0.6], cloud: 0.55 }, sunDir: [0.45, 0.8, 0.6], fog: { color: 0xcfdde8, near: 60, far: 430 }, cam: [10.5, 7.5, 19.5], target: [1.5, 1.8, -1.5], shadowSize: 19, shadowCenter: [0, 0, -2], exposure: 1.0, maxDist: 90 });
    mZ2 = M.glow(0x2aff88, 0.07); mZ1 = M.glow(0xffc400, 0.1); mZ0 = M.glow(0xff3040, 0.14);
    [mZ2, mZ1, mZ0].forEach(function (m) { m.side = T.DoubleSide; });
    buildPlant();
    gas = new TW.PSys(760, 'puff', false); pm = new Float32Array(gas.n);
    jet = TW.fx.fire([LEAK.x, LEAK.y, LEAK.z], { size: 1, rate: 150, speed: 3.2, spread: 0.32, smoke: 0.35 });
    vesFire = TW.fx.fire([VES.x, 1.0, VES.z], { size: 1.6, rate: 120, speed: 2.6, spread: 0.6, smoke: 0.3 });
    tankFire = TW.fx.fire([TANK.x, TANK.y + 1.2, TANK.z], { size: 1.4, rate: 120, speed: 2.6, spread: 0.6, smoke: 0.3 });
    buildInstrument(CFG.inst); wireUI(); buildCards(); renderCompat(); renderInfo(); drawEnergy(); renderResult();
    TW.ics({ title: '3D TWIN · INSTRUMENT AREA BERBAHAYA (Ex / ATEX)', extra: 'Skenario kebakaran &amp; ledakan hanya <b>simulasi visual</b> untuk memahami pentingnya proteksi Ex; jangan dicoba di lapangan.' });
    TW.onUpdate(frame); TW.start();
  };
  HZ.S = S; HZ.CFG = CFG; HZ.api = { frame: frame, startLeak: startLeak, failInstrument: failInstrument, reset: reset, doEsd: doEsd, setInst: function (k) { CFG.inst = k; buildCards(); reset(); }, setGas: function (k) { CFG.gas = k; $('sel-gas').value = k; reset(); }, concAt: function () { return concAt(INS.center); } };
  return HZ;
})();
