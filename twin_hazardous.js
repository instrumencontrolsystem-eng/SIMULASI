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
  var LEAK = new T.Vector3(2.24, 1.35, 0.14), P_INS = new T.Vector3(2.95, 0.95, 0.35), GD = new T.Vector3(3.8, 1.25, 0.1), VES = new T.Vector3(-1.8, 1.6, 0), TANK = new T.Vector3(7.0, 2.9, -1.2);
  var INS_C = new T.Vector3(2.95, 1.42, 0.35);

  var mSteel = M.std(0xaeb6bd, 0.85, 0.35), mDark = M.std(0x15181a, 0.1, 0.7), mGlass = M.std(0x0b2c3f, 0.2, 0.15, { emissive: 0x0a4c66, emissiveIntensity: 0.9 });
  var mVessel = M.std(0xb6c3bc, 0.6, 0.4), mTankM = M.std(0xd7dde0, 0.6, 0.35), mPaint = M.std(0x3d6f8f, 0.4, 0.5), mYellow = M.std(0xf2c500, 0.3, 0.5), mConcrete = M.std(0x2c343c, 0.05, 0.9, { envMapIntensity: 0.1 });
  var mZ2, mZ1, mZ0;
  function put(g, m, x, y, z) { m.position.set(x, y, z); g.add(m); return m; }
  function cylX(r, h, mat, seg) { var m = TW.cyl(r, r, h, mat, seg || 20); m.rotation.z = Math.PI / 2; return m; }
  function cylZ(r, h, mat, seg) { var m = TW.cyl(r, r, h, mat, seg || 20); m.rotation.x = Math.PI / 2; return m; }

  /* --------------------------------------------------------------- scene */
  function buildPlant() {
    TW.ground(80, '#161e26', 'rgba(255,180,0,.07)');
    var pad = TW.box(24, 0.06, 14, mConcrete); pad.position.set(1, 0.03, 0.5); TW.add(pad);
    var berm = M.std(0x1c242c, 0.05, 0.9, { envMapIntensity: 0.1 });
    /* bejana V-201 */
    var ves = scn.ves = new T.Group(); ves.position.copy(VES); TW.add(ves);
    scn.vesMat = mVessel.clone(); scn.vesMat.userData.base = mVessel.color.clone();
    var body = cylX(1.1, 5.0, scn.vesMat, 40); ves.add(body);
    [-2.5, 2.5].forEach(function (x) { var h = TW.sph(1.1, scn.vesMat, 30); h.scale.set(0.45, 1, 1); h.position.x = x; ves.add(h); });
    [-1.6, 1.4].forEach(function (x) { var s = TW.box(0.3, 1.1, 1.8, mSteel); s.position.set(VES.x + x, 0.5, 0); TW.add(s); });
    put(ves, TW.cyl(0.14, 0.14, 0.5, mSteel, 16), 0, 1.3, 0);
    scn.z0 = new T.Mesh(new T.CylinderGeometry(1.0, 1.0, 5.4, 32), mZ0); scn.z0.rotation.z = Math.PI / 2; ves.add(scn.z0);
    TW.label('V-201 &middot; separator gas', ves, { off: [0, 1.9, 0], group: 'eq' });
    /* rack pipa */
    var pr = M.std(0x9aa5ad, 0.8, 0.4);
    TW.add(TW.rod([VES.x, 2.7, 0], [VES.x, 3.7, 0], 0.11, pr, 16)); TW.add(TW.rod([VES.x, 3.7, 0], [9.2, 3.7, 0], 0.11, pr, 16)); TW.add(TW.rod([VES.x, 3.7, 0.42], [9.2, 3.7, 0.42], 0.07, pr, 14));
    TW.add(TW.rod([VES.x, 3.7, 0], [VES.x, 3.7, 0.42], 0.05, pr, 10));
    [3.6, 6.6, 9.2].forEach(function (x) { TW.add(TW.at(TW.box(0.14, 3.7, 0.14, mPaint), x, 1.85, 0.2)); TW.add(TW.at(TW.box(0.14, 0.14, 0.9, mPaint), x, 3.55, 0.2)); });
    /* riser + flange F-201 */
    scn.pipeMat = M.std(0x9aa5ad, 0.8, 0.4); scn.pipeMat.userData.base = scn.pipeMat.color.clone();
    TW.add(TW.rod([2.2, 3.7, 0], [2.2, 1.38, 0], 0.09, scn.pipeMat, 18)); TW.add(TW.rod([2.2, 1.32, 0], [2.2, 0.5, 0], 0.09, scn.pipeMat, 18));
    var fl = new T.Group(); fl.position.set(2.2, 1.35, 0); TW.add(fl);
    put(fl, TW.cyl(0.19, 0.19, 0.035, mSteel, 32), 0, 0.028, 0); put(fl, TW.cyl(0.19, 0.19, 0.035, mSteel, 32), 0, -0.028, 0); put(fl, TW.cyl(0.165, 0.165, 0.022, mDark, 32), 0, 0, 0);
    for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; put(fl, TW.cyl(0.013, 0.013, 0.15, mSteel, 8), Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15); }
    scn.flange = fl;
    var v = new T.Group(); v.position.set(2.2, 0.8, 0); TW.add(v); put(v, TW.sph(0.13, mPaint, 16), 0, 0, 0); put(v, TW.cyl(0.02, 0.02, 0.3, mSteel, 8), 0, 0.2, 0); put(v, TW.torus(0.09, 0.012, mYellow), 0, 0.36, 0).rotation.x = Math.PI / 2;
    TW.label('F-201 &middot; flange (sumber kebocoran)', LEAK, { off: [0, -0.28, 0], group: 'eq', maxD: 16 });
    /* impulse line ke instrument */
    TW.add(TW.rod([2.2, 1.0, 0], [2.6, 1.0, 0.2], 0.022, mSteel, 8)); TW.add(TW.rod([2.6, 1.0, 0.2], [P_INS.x, 0.9, P_INS.z], 0.022, mSteel, 8));
    /* tangki bola T-202 */
    var tk = scn.tank = new T.Group(); tk.position.copy(TANK); TW.add(tk);
    scn.tankMat = mTankM.clone(); scn.tankMat.userData.base = mTankM.color.clone();
    tk.add(TW.sph(1.5, scn.tankMat, 36));
    for (i = 0; i < 6; i++) { var b = i / 6 * Math.PI * 2; var lg = TW.cyl(0.07, 0.07, 1.9, mSteel, 8); lg.position.set(Math.cos(b) * 1.15, -1.0, Math.sin(b) * 1.15); lg.rotation.set(Math.sin(b) * 0.2, 0, -Math.cos(b) * 0.2); tk.add(lg); }
    TW.label('T-202 &middot; bola LPG', tk, { off: [0, 1.9, 0], group: 'eq' });
    /* flare */
    var fs = new T.Group(); fs.position.set(-9, 0, -5.5); TW.add(fs); put(fs, TW.cyl(0.3, 0.3, 0.6, mSteel, 12), 0, 0.3, 0); put(fs, TW.cyl(0.13, 0.17, 12, mSteel, 12), 0, 6, 0);
    TW.label('flare stack', fs, { off: [0, 12.6, 0], group: 'eq', maxD: 40 });
    flare = TW.fx.fire([-9, 12.15, -5.5], { size: 0.5, rate: 40, speed: 1.6, spread: 0.2, smoke: 0.15, light: false }); flare.k = 0.22;
    /* bangunan kontrol + barrier */
    var bd = new T.Group(); bd.position.set(-7.4, 0, 4.4); TW.add(bd);
    put(bd, TW.box(3.4, 2.6, 2.6, M.std(0x34434f, 0.1, 0.8)), 0, 1.3, 0); put(bd, TW.box(3.5, 0.15, 2.7, M.std(0x222c34, 0.1, 0.8)), 0, 2.65, 0);
    put(bd, TW.box(0.9, 1.6, 0.06, M.std(0x111a22, 0.3, 0.5)), 0.8, 0.9, 1.32);
    TW.label('RUANG KONTROL &middot; AREA AMAN', bd, { off: [0, 3.0, 0], group: 'eq', maxD: 40 });
    var cab = new T.Group(); cab.position.set(-4.9, 0, 3.7); TW.add(cab); put(cab, TW.box(0.8, 1.5, 0.4, M.std(0x707a82, 0.5, 0.5)), 0, 0.75, 0);
    var bar = put(cab, TW.box(0.5, 0.5, 0.06, M.std(0x1c7d4a, 0.3, 0.5)), 0, 1.0, 0.23); scn.barLed = put(cab, TW.sph(0.035, M.std(0x1aff7a, 0, 0.3, { emissive: 0x1aff7a, emissiveIntensity: 1.6 }), 10), 0.16, 1.2, 0.27);
    scn.barLbl = TW.label('BARRIER Ex ia', cab, { off: [0, 1.75, 0], group: 'eq', maxD: 30 });
    scn.cabinet = cab;
    /* detektor gas GD-201 */
    var gd = new T.Group(); gd.position.copy(GD); TW.add(gd); put(gd, TW.cyl(0.03, 0.03, 1.25, mSteel, 8), 0, -0.6, 0); put(gd, TW.cyl(0.08, 0.08, 0.13, mYellow, 16), 0, 0.02, 0);
    scn.gdLed = put(gd, TW.sph(0.028, M.std(0x1aff7a, 0, 0.3, { emissive: 0x1aff7a, emissiveIntensity: 1.6 }), 8), 0, 0.02, 0.08);
    scn.gdLbl = TW.label('GD-201', gd, { off: [0, 0.3, 0], group: 'eq', maxD: 22 });
    /* windsock */
    var ws = scn.sock = new T.Group(); ws.position.set(5.2, 0, 3.4); TW.add(ws); put(ws, TW.cyl(0.04, 0.05, 3.4, mSteel, 8), 0, 1.7, 0);
    var stripes = TW.canvasTex(128, 128, function (g, w, h) { for (var k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#ff5a1f'; g.fillRect(k * 32, 0, 32, 128); } });
    var cone = new T.Mesh(new T.CylinderGeometry(0.34, 0.14, 1.5, 16, 1, true), new T.MeshBasicMaterial({ map: stripes, side: T.DoubleSide })); cone.geometry.translate(0, 0.75, 0);
    var sockPivot = scn.sockPivot = new T.Group(); sockPivot.position.set(0, 3.4, 0); ws.add(sockPivot); cone.rotation.z = -Math.PI / 2; sockPivot.add(cone); scn.sockCone = cone;
    TW.label('arah angin', ws, { off: [0, 3.9, 0], group: 'eq', maxD: 25 });
    /* rambu Ex */
    var sg = new T.Group(); sg.position.set(-3.0, 0, 3.8); TW.add(sg); put(sg, TW.cyl(0.04, 0.04, 2.6, mSteel, 8), 0, 1.3, 0);
    var sp = TW.plate(1.5, 1.1, function (g, w, h) {
      g.fillStyle = '#f2c500'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#111'; g.font = 'bold 72px sans-serif'; g.textAlign = 'center'; g.fillText('Ex', w * 0.5, h * 0.52);
      g.font = 'bold 26px sans-serif'; g.fillText('AREA BERBAHAYA', w * 0.5, h * 0.72); g.font = 'bold 24px sans-serif'; g.fillText('ZONA 1 / 2 · DILARANG API', w * 0.5, h * 0.9);
    }, 512); sp.position.set(0, 2.4, 0.06); sg.add(sp);
    /* zona */
    scn.z1 = new T.Mesh(new T.SphereGeometry(1, 32, 20), mZ1); scn.z1.scale.set(3.4, 2.1, 2.7); scn.z1.position.set(2.2, 1.35, 0.1); TW.add(scn.z1);
    scn.z2 = new T.Mesh(new T.SphereGeometry(1, 32, 20), mZ2); scn.z2.scale.set(6.2, 3.0, 5.2); scn.z2.position.set(2.2, 1.35, 0.1); TW.add(scn.z2);
    scn.zoneLbls = [TW.label('ZONA 1', scn.z1, { off: [0, 2.4, 0], cls: 'warn', group: 'zone' }), TW.label('ZONA 2', scn.z2, { off: [3.6, 0.5, 0], cls: 'ok', group: 'zone' }), TW.label('ZONA 0 (dalam bejana)', scn.z0, { off: [0, -0.1, 1.3], cls: 'bad', group: 'zone' })];
  }

  /* ---------------------------------------------------- instrumen (hero) */
  function buildInstrument(type) {
    if (INS) { TW.remove(INS.g); TW.dispose(INS.g); INS.labels.forEach(function (l) { l.remove(); }); }
    var C = INSTR[type], g = new T.Group(); g.position.copy(P_INS); TW.add(g);
    var housing = M.shell(C.color, type === 'exdB' || type === 'exdC' ? 0.35 : 0.5, 0.42); TW.shellDouble(housing);
    var hot = { g: g, housing: housing, labels: [], type: type, C: C };
    // manifold + leher
    put(g, TW.box(0.24, 0.1, 0.13, mSteel), 0, 0.05, 0); put(g, TW.cyl(0.055, 0.055, 0.2, mSteel, 16), 0, 0.2, 0);
    var ro = 0.15 + (type.indexOf('exd') === 0 ? 0.035 : 0), ri = ro - C.wall, y0 = 0.3, y1 = 0.66;
    var prof = [[ri, y0], [ro, y0], [ro, y1], [ri, y1], [ri, y0]];
    var wall = TW.lathe(prof, housing, 40); g.add(wall); hot.wall = wall;
    put(g, TW.cyl(ro, ro, 0.02, housing, 32), 0, y0 + 0.01, 0);                       // dasar
    var cover = put(g, TW.cyl(ro * 0.98, ro * 0.98, 0.09, housing, 32), 0, y1 + 0.045, 0); hot.cover = cover;
    put(g, TW.cyl(0.085, 0.085, 0.012, mGlass, 24), 0, y1 + 0.096, 0);
    // isi enklosur: PCB, kapasitor, chip, terminal, layar
    var pcb = put(g, TW.box(0.2, 0.012, 0.2, M.std(0x1c7a3c, 0.2, 0.5)), 0, 0.42, 0); hot.pcb = pcb;
    [[-0.05, -0.04], [0.02, 0.05], [-0.06, 0.06]].forEach(function (p) { put(g, TW.box(0.05, 0.014, 0.05, mDark), p[0], 0.435, p[1]); });
    var caps = [put(g, TW.cyl(0.02, 0.02, 0.065, M.std(0x2f6fd6, 0.3, 0.4), 12), 0.05, 0.46, -0.06), put(g, TW.cyl(0.02, 0.02, 0.065, M.std(0x2f6fd6, 0.3, 0.4), 12), 0.09, 0.46, -0.03)]; hot.caps = caps;
    var tb = put(g, TW.box(0.1, 0.035, 0.05, M.std(0x8a929a, 0.3, 0.5)), 0.06, 0.37, 0.07);
    for (var i = 0; i < 4; i++) put(g, TW.cyl(0.008, 0.008, 0.02, M.std(0xd7b64a, 0.8, 0.3), 8), 0.03 + i * 0.025, 0.4, 0.07);
    put(g, TW.box(0.14, 0.02, 0.1, M.std(0x0d1f16, 0.1, 0.5, { emissive: 0x0d6a3a, emissiveIntensity: 0.9 })), 0, 0.58, 0);
    [0xff5a3c, 0x2f8cff, 0xf2c500, 0x1aff7a].forEach(function (c, k) { var w = TW.rod([0.03 + k * 0.025, 0.4, 0.07], [0.2, 0.42 - k * 0.006, 0.0], 0.005, M.std(c, 0, 0.6), 6); g.add(w); });
    // gland + konduit + JB
    var glandMat = type === 'exia' ? M.std(0x2f8cff, 0.4, 0.5) : (type === 'nonex' ? M.std(0x222222, 0.1, 0.7) : M.std(0xc9a227, 0.8, 0.3));
    put(g, cylX(0.032, 0.09, glandMat, 14), ro + 0.03, 0.42, 0);
    var jb = put(g, TW.box(0.24, 0.32, 0.16, M.std(C.jb, 0.35, 0.5)), 0.72, 0.42, 0);
    TW.add(TW.rod([P_INS.x + ro + 0.06, P_INS.y + 0.42, P_INS.z], [P_INS.x + 0.72 - 0.12, P_INS.y + 0.42, P_INS.z], 0.014, glandMat, 8)); hot.conduitAdded = true;
    // ring flame-path + ulir (Ex d)
    if (type.indexOf('exd') === 0) {
      var fp = put(g, TW.torus(ro, 0.009, M.std(0xffd44a, 0.9, 0.2, { emissive: 0x553300, emissiveIntensity: 0.7 })), 0, y1 - 0.005, 0); fp.rotation.x = Math.PI / 2; hot.flamePath = fp;
      for (var k2 = 0; k2 < 7; k2++) { var th = put(g, TW.torus(ro * 0.985, 0.004, mSteel), 0, y1 - 0.035 + k2 * 0.011 - 0.03, 0); th.rotation.x = Math.PI / 2; }
      for (var b = 0; b < 8; b++) { var an = b / 8 * Math.PI * 2; put(g, TW.cyl(0.012, 0.012, 0.03, mSteel, 6), Math.cos(an) * (ro - 0.02), y1 + 0.075, Math.sin(an) * (ro - 0.02)); }
    }
    if (type === 'exia') put(g, TW.box(0.1, 0.04, 0.05, M.std(0x1f70b8, 0.2, 0.5)), 0.03, 0.34, -0.08);
    // papan nama
    var np = TW.plate(0.26, 0.16, function (c, w, h) {
      c.fillStyle = C.plate; c.fillRect(0, 0, w, h); c.strokeStyle = '#000'; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4);
      c.fillStyle = '#000'; c.font = 'bold 15px sans-serif'; c.textAlign = 'left'; c.fillText('PT-201  4–20 mA', 8, 20);
      c.font = 'bold 17px sans-serif'; c.fillStyle = type === 'nonex' ? '#c00' : '#000'; c.fillText(C.mark.split(' · ')[type === 'nonex' ? 2 : 0] || C.mark, 8, 46);
      c.font = '13px sans-serif'; c.fillStyle = '#000'; c.fillText(type === 'nonex' ? 'IP66 · CE' : 'IECEx / ATEX · IP66', 8, 68); c.font = 'bold 12px sans-serif'; c.fillText(C.sign, 8, 90);
      if (type !== 'nonex') { c.beginPath(); c.moveTo(w - 50, 20); c.lineTo(w - 30, 8); c.lineTo(w - 10, 20); c.lineTo(w - 10, 42); c.lineTo(w - 30, 54); c.lineTo(w - 50, 42); c.closePath(); c.fillStyle = '#000'; c.fill(); c.fillStyle = '#ffd400'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('Ex', w - 30, 39); }
    }, 320);
    np.position.set(0, 0.42, ro + 0.003); np.scale.setScalar(0.85); g.add(np);
    var pl = new T.PointLight(0xffcc55, 0, 3, 1.5); pl.position.set(0.05, 0.45, 0); g.add(pl); hot.light = pl;
    hot.labels.push(TW.label('PT-201<small>' + C.short + '</small>', g, { off: [0, 1.15, 0], cls: C.cls, group: 'tag' }));
    TW.pickable(g, function () { });
    g.updateMatrixWorld(true); hot.spark = new T.Vector3(0.09, 0.4, 0.07).applyMatrix4(g.matrixWorld); hot.center = INS_C.clone(); hot.ringPos = new T.Vector3(0, y1, 0).applyMatrix4(g.matrixWorld); hot.ro = ro;
    INS = hot;
    // kabel ke barrier
    if (scn.cable) { TW.remove(scn.cable.group); TW.dispose(scn.cable.group); }
    scn.cable = TW.pipe([[-4.9, 0.7, 3.9], [-4.9, 0.06, 3.9], [3.64, 0.06, 3.9], [3.64, 0.06, 0.35], [3.64, 0.3, 0.35]], 0.018, { mat: M.std(type === 'exia' ? 0x2f8cff : 0x1a1a1a, 0.2, 0.6), bend: 0.2 }); TW.add(scn.cable.group);
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
    var ctr = new T.Vector3(0, 0.47, 0).applyMatrix4(INS.g.matrixWorld);
    for (var i = 0; i < 46; i++) TW.fx.fireSys.emit(ctr.x + TW.rand(-0.04, 0.04), ctr.y + TW.rand(-0.06, 0.06), ctr.z + TW.rand(-0.04, 0.04), TW.rand(-1, 1), TW.rand(-0.4, 1), TW.rand(-1, 1), TW.rand(0.25, 0.55), 0.13, 0.22, [1, 0.92, 0.55, 0.95], [1, 0.3, 0.05, 0], 3, 0);
    INS.light.intensity = 6; INS.flash = 0.5;
    INS.pulse = 0.5;
    var rp = INS.ringPos;
    for (var j = 0; j < 40; j++) {
      var a = Math.random() * Math.PI * 2, r = INS.ro;
      if (escape) TW.fx.fireSys.emit(rp.x + Math.cos(a) * r, rp.y, rp.z + Math.sin(a) * r, Math.cos(a) * TW.rand(2, 4), TW.rand(0, 1.2), Math.sin(a) * TW.rand(2, 4), TW.rand(0.3, 0.7), 0.1, 0.35, [1, 0.8, 0.35, 0.95], [1, 0.25, 0.05, 0], 1, 0);
      else TW.fx.fireSys.emit(rp.x + Math.cos(a) * (r - 0.02), rp.y - 0.01, rp.z + Math.sin(a) * (r - 0.02), Math.cos(a) * 0.35, 0.05, Math.sin(a) * 0.35, TW.rand(0.3, 0.6), 0.05, 0.02, [1, 0.85, 0.4, 0.95], [0.25, 0.3, 0.4, 0], 3, 0);
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
    TW.flyTo([10.5, 6.6, 16.5], [2.2, 2.2, -0.3], 1.8);
    showBanner('bad', 'KEBAKARAN HEBAT &mdash; INSTRUMEN SUMBER NYALA', 'Awan gas menyala; api menjalar ke flange, bejana dan tangki. ESD &amp; evakuasi!');
  }
  function charInstrument() { INS.housing.color.set(0x111111); INS.housing.emissive.set(0x300800); INS.g.children.forEach(function (c) { if (c.material && c.material.color && !c.material.userData.shell && c.material !== INS.housing) c.material = c.material.clone(), c.material.color.multiplyScalar(0.25); }); S.dmg.pt = 1; }
  function rupture() {
    S.ruptured = true; scn.ves.visible = false; scn.z0.visible = false;
    TW.fx.blast([VES.x, VES.y + 0.5, 0], 7.5); TW.fx.scorch([VES.x, 0, 0], 6);
    vesFire.k = 1; S.domT = 0; S.dmg.ves = 1;
    TW.flyTo([9.5, 5.5, 14.5], [1.5, 2.5, -0.5], 1.6);
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
    setState('NORMAL', ''); $('res-panel').className = 'panel'; renderResult(); renderCompat(); drawEnergy(); renderInfo(); if (wasFire) TW.flyTo([8.5, 6.2, 18.5], [1.0, 1.8, 0], 1.2);
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
      { name: 'OVERVIEW', pos: [8.5, 6.2, 18.5], tgt: [1.0, 1.8, 0] },
      { name: 'INSTRUMEN', pos: [3.75, 1.85, 1.55], tgt: [2.95, 1.35, 0.35] },
      { name: 'FLANGE + AWAN', pos: [5.6, 2.4, 3.6], tgt: [2.6, 1.3, 0.2] },
      { name: 'BEJANA V-201', pos: [-2.2, 3.4, 7.2], tgt: [-1.8, 1.6, 0] },
      { name: 'ATAS &middot; ZONA', pos: [2.4, 15.5, 4.6], tgt: [2.2, 0, 0.3] },
      { name: 'TANGKI T-202', pos: [11.5, 5, 6], tgt: [7, 2.4, -1.2] }
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
        vesFire.pos.set(VES.x + 0.6, 2.8, 0); vesFire.size = 1.1;
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
        vesFire.pos.set(VES.x, 1.0, 0); vesFire.size = 2.3; vesFire.k = Math.min(1, vesFire.k + dt);
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
    TW.init({ bg: 0x101a25, fog: { color: 0x101a25, near: 40, far: 110 }, cam: [8.5, 6.2, 18.5], target: [1.0, 1.8, 0], shadowSize: 15, exposure: 1.05, maxDist: 60 });
    mZ2 = M.glow(0x2aff88, 0.06); mZ1 = M.glow(0xffd400, 0.09); mZ0 = M.glow(0xff3040, 0.12);
    [mZ2, mZ1, mZ0].forEach(function (m) { m.side = T.DoubleSide; });
    buildPlant();
    gas = new TW.PSys(760, 'puff', false); pm = new Float32Array(gas.n);
    jet = TW.fx.fire([LEAK.x, LEAK.y, LEAK.z], { size: 1, rate: 150, speed: 3.2, spread: 0.32, smoke: 0.35 });
    vesFire = TW.fx.fire([VES.x, 1.0, 0], { size: 1.6, rate: 120, speed: 2.6, spread: 0.6, smoke: 0.3 });
    tankFire = TW.fx.fire([TANK.x, TANK.y + 1.2, TANK.z], { size: 1.4, rate: 120, speed: 2.6, spread: 0.6, smoke: 0.3 });
    buildInstrument(CFG.inst); wireUI(); buildCards(); renderCompat(); renderInfo(); drawEnergy(); renderResult();
    TW.onUpdate(frame); TW.start();
  };
  HZ.S = S; HZ.CFG = CFG; HZ.api = { frame: frame, startLeak: startLeak, failInstrument: failInstrument, reset: reset, doEsd: doEsd, setInst: function (k) { CFG.inst = k; buildCards(); reset(); }, setGas: function (k) { CFG.gas = k; $('sel-gas').value = k; reset(); }, concAt: function () { return concAt(INS.center); } };
  return HZ;
})();
