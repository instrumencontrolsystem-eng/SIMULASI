/* ICS Cademy — 3D Twin Instrument Safety SIL & HIPPS 2oo3
   HIPPS (High Integrity Pressure Protection System): 3 transmitter tekanan (voting 2oo3) -> logic solver SIL 3 -> 2 valve seri (1oo2).
   Proses : dP/dt = k_in x PCV x XV x (P_hulu - P_hilir) - k_out x (P_hilir - 20) - PSV      (model orde-1 bahan ajar)
   SIL    : PFDavg per subsistem (persamaan sederhana IEC 61508-6 / ISA-TR84.00.02) + batas arsitektur (IEC 61508-2, Route 1H)
   Semua angka = ilustrasi bahan ajar, BUKAN untuk desain SIS nyata. */
var HP = (function () {
  'use strict';
  var T = THREE, M = TW.M, $ = TW.$;
  var HP = {};
  var idc = function (n, d) { return TW.fmt(n, d).replace('.', ','); };

  /* --------------------------------------------------------- konstanta */
  var MAWP = 60, RUPT = 90, KIN = 0.03, KOUT0 = 0.02, PSINK = 20, PCV0 = 0.121, PSRC = 150, PSV_SET = 60, PSV_CAP = 1.2;
  var FIT = 1e-9, YEAR = 8760, MTTR = 8;
  var PAR = {
    sens: { lamDU: 100 * FIT, lamS: 300 * FIT, lamDD: 800 * FIT, beta: 0.05, type: 'B' },
    valve: { lamDU: 800 * FIT, lamS: 1500 * FIT, lamDD: 200 * FIT, beta: 0.10, type: 'A' },
    ls: { pfd: 2e-5, type: 'B', sil: 3 }
  };
  var CFG = { arch: '2oo3', nv: 2, hipps: true, psv: true, sp: 48, tclose: 1.5, ti: 1, scn: 'kick' };
  var FLT = { pt: ['ok', 'ok', 'ok'], xv: [false, false] };
  var FAULTS = [['ok', 'Normal'], ['frozen', 'Beku di nilai normal (BERBAHAYA, tak terdeteksi)'], ['high', 'Salah tinggi (aman → trip palsu)'], ['low', 'Baca terlalu rendah 45 % (BERBAHAYA)']];
  var PT_COL = ['#5cf0ff', '#ff7be5', '#ffd27f'], PT_HEX = [0x37d6ee, 0xff5fd8, 0xffc15a];
  var SCN = {
    kick: { name: 'Kick sumur + PCV terbuka', pu: 200, pcv: 1, kout: KOUT0, note: 'Tekanan hulu 200 bar dan PCV terbuka penuh: laju naik ≈ 4 bar/s. Setiap detik keterlambatan = +4 bar.' },
    pcv: { name: 'PCV-101 gagal terbuka', pu: 150, pcv: 1, kout: KOUT0, note: 'PCV terbuka penuh dari 150 bar: laju naik ≈ 3 bar/s. PSV kecil tidak cukup untuk menahan.' },
    block: { name: 'Hilir tersumbat', pu: 150, pcv: PCV0, kout: 0, note: 'Outlet tertutup: laju naik lambat ≈ 0,4 bar/s. Waktu cukup, tetapi tanpa proteksi tekanan tetap naik.' }
  };
  var S = {};
  var scn = {}, pipes = {}, flare, rupFire, chart, XV = [], PT = [], cab, wires = [], sisCv, sisTex;

  /* ----------------------------------------------------------- SIL calc */
  function silBand(pfd) { return pfd < 1e-4 ? 4 : (pfd < 1e-3 ? 3 : (pfd < 1e-2 ? 2 : (pfd < 1e-1 ? 1 : 0))); }
  function archMax(type, sff, hft) {
    var t = type === 'A' ? [[1, 2, 3], [2, 3, 4], [3, 4, 4], [3, 4, 4]] : [[0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 4]];
    var r = sff < 0.6 ? 0 : (sff < 0.9 ? 1 : (sff < 0.99 ? 2 : 3)); return t[r][Math.min(hft, 2)];
  }
  var HFT = { '1oo1': 0, '1oo2': 1, '2oo2': 0, '2oo3': 1 };
  function sensPFD(arch, TI, p) {
    var l = p.lamDU, b = p.beta, x = (1 - b) * l * TI;
    return arch === '1oo1' ? l * TI / 2 : (arch === '1oo2' ? x * x / 3 + b * l * TI / 2 : (arch === '2oo2' ? l * TI : x * x + b * l * TI / 2));
  }
  function sensSTR(arch, p) {   // per jam
    var l = p.lamS, b = p.beta;
    return arch === '1oo1' ? l : (arch === '1oo2' ? 2 * l : (arch === '2oo2' ? 2 * l * l * MTTR + b * l : 6 * l * l * MTTR + b * l));
  }
  function calcSIL(arch, nv, TIyr) {
    var TI = TIyr * YEAR, ps = PAR.sens, pv = PAR.valve;
    var pfdS = sensPFD(arch, TI, ps), sffS = (ps.lamS + ps.lamDD) / (ps.lamS + ps.lamDD + ps.lamDU), hS = HFT[arch];
    var x = (1 - pv.beta) * pv.lamDU * TI, pfdV = nv === 1 ? pv.lamDU * TI / 2 : x * x / 3 + pv.beta * pv.lamDU * TI / 2, sffV = (pv.lamS + pv.lamDD) / (pv.lamS + pv.lamDD + pv.lamDU), hV = nv === 1 ? 0 : 1;
    var pfd = pfdS + PAR.ls.pfd + pfdV, band = silBand(pfd);
    var aS = archMax(ps.type, sffS, hS), aV = archMax(pv.type, sffV, hV), aL = PAR.ls.sil;
    var arch3 = Math.min(aS, aV, aL), sil = Math.min(band, arch3);
    var strS = sensSTR(arch, ps) * YEAR, strV = (nv === 1 ? 1 : 2) * pv.lamS * YEAR, str = strS + strV;
    return { pfdS: pfdS, pfdV: pfdV, pfdL: PAR.ls.pfd, pfd: pfd, band: band, sffS: sffS, sffV: sffV, hS: hS, hV: hV, aS: aS, aV: aV, aL: aL, sil: sil, limit: (arch3 < band ? (aS <= aV ? 'S' : 'V') : null), strS: strS, strV: strV, str: str };
  }
  var sci = function (v) { if (!(v > 0)) return '0'; var e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e); return m.toFixed(1).replace('.', ',') + '×10' + String(e).replace('-', '⁻').replace(/\d/g, function (d) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'.charAt(+d); }); };

  /* ----------------------------------------------------------- materials */
  var mSteel = M.std(0xaeb6bd, 0.85, 0.35), mDark = M.std(0x15181a, 0.1, 0.7), mGlass = M.std(0x0b2c3f, 0.2, 0.15, { emissive: 0x0a4c66, emissiveIntensity: 0.9 });
  var mHP = M.shell(0xc85a3a, 0.7, 0.4), mLP = M.shell(0x8fa9c2, 0.7, 0.4), mPaint = M.std(0x3d6f8f, 0.4, 0.5), mYellow = M.std(0xf2c500, 0.3, 0.5), mBody = M.shell(0x8a949c, 0.8, 0.35);
  var mAct = M.shell(0xe0782a, 0.4, 0.45), mPlat = M.std(0x27313b, 0.3, 0.7, { envMapIntensity: 0.15 });
  var mDown; // material pipa hilir
  function put(g, m, x, y, z) { m.position.set(x, y, z); g.add(m); return m; }
  function cylX(r, h, mat, seg) { var m = TW.cyl(r, r, h, mat, seg || 20); m.rotation.z = Math.PI / 2; return m; }
  function LED(color) { return M.std(0x101010, 0, 0.4, { emissive: color, emissiveIntensity: 1.6 }); }

  /* --------------------------------------------------------------- scene */
  var XA = -4.4, XB = -2.2, PTX = [0.5, 1.2, 1.9], YL = 1.2, RUP = new T.Vector3(4.2, 1.25, 0), CAB = new T.Vector3(2.2, 0, 3.2);
  function buildValve(x, tag, idx) {
    var g = new T.Group(); g.position.set(x, YL, 0); TW.add(g);
    var V = { g: g, idx: idx, tag: tag };
    put(g, TW.sph(0.32, mBody, 24), 0, 0, 0);
    [-1, 1].forEach(function (s) { put(g, cylX(0.27, 0.07, mSteel, 24), s * 0.4, 0, 0); for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2; put(g, cylX(0.02, 0.1, mSteel, 6), s * 0.4, Math.cos(a) * 0.22, Math.sin(a) * 0.22); } });
    var ball = V.ball = new T.Group(); g.add(ball); ball.add(TW.sph(0.235, M.std(0xd6b04a, 0.9, 0.25), 24)); var bore = cylX(0.1, 0.5, mDark, 16); ball.add(bore);
    put(g, TW.cyl(0.1, 0.1, 0.5, mSteel, 14), 0, 0.5, 0);
    put(g, TW.cyl(0.26, 0.26, 0.7, mAct, 28), 0, 1.05, 0);
    put(g, TW.cyl(0.28, 0.28, 0.06, M.std(0xa8541a, 0.4, 0.5), 28), 0, 1.42, 0);
    V.piston = put(g, TW.cyl(0.245, 0.245, 0.05, mSteel, 24), 0, 1.25, 0);
    V.rings = []; for (var i = 0; i < 9; i++) V.rings.push(put(g, TW.torus(0.165, 0.02, M.std(0xcfd6db, 0.9, 0.3)).rotateX(Math.PI / 2), 0, 1.3, 0));
    V.ind = put(g, TW.box(0.5, 0.05, 0.07, M.std(0x1aff7a, 0, 0.3, { emissive: 0x1aff7a, emissiveIntensity: 0.9 })), 0, 1.5, 0);
    var sov = put(g, TW.box(0.24, 0.24, 0.2, M.std(0x1f70b8, 0.3, 0.5)), 0.5, 1.05, 0.22); V.ledMat = LED(0x1aff7a); V.led = put(g, TW.sph(0.035, V.ledMat, 8), 0.5, 1.2, 0.33);
    g.add(TW.rod([0.42, 1.05, 0.2], [0.24, 0.9, 0.0], 0.018, mSteel, 6));
    V.lbl = TW.label(tag, g, { off: [0, 1.95, 0], group: 'tag' });
    V.stuckLbl = TW.label('MACET TERBUKA', g, { off: [0, 2.35, 0], cls: 'bad', group: 'tag' }); V.stuckLbl.hidden = true;
    TW.pickable(g, function () { var cb = $(idx === 0 ? 'f-xva' : 'f-xvb'); cb.checked = !cb.checked; cb.onchange(); });
    return V;
  }
  function buildPT(i) {
    var x = PTX[i], g = new T.Group(); g.position.set(x, YL + 0.13, 0); TW.add(g);
    var P = { g: g, i: i }, col = PT_HEX[i];
    put(g, TW.cyl(0.035, 0.035, 0.2, mSteel, 12), 0, 0.1, 0); put(g, TW.box(0.16, 0.08, 0.1, mSteel), 0, 0.22, 0);
    put(g, TW.cyl(0.05, 0.05, 0.14, mSteel, 16), 0, 0.33, 0);
    put(g, TW.cyl(0.085, 0.085, 0.2, M.std(0xdfe5ea, 0.4, 0.4), 24), 0, 0.5, 0); put(g, TW.cyl(0.088, 0.088, 0.045, M.std(col, 0.3, 0.4, { emissive: col, emissiveIntensity: 0.5 }), 24), 0, 0.41, 0);
    put(g, TW.cyl(0.06, 0.06, 0.012, mGlass, 20), 0, 0.605, 0); P.ledMat = LED(0x1aff7a); P.led = put(g, TW.sph(0.02, P.ledMat, 8), 0.08, 0.55, 0.05);
    TW.pickable(g, function () { var k = (['ok', 'frozen', 'high', 'low'].indexOf(FLT.pt[i]) + 1) % 4; var sel = $('f-pt' + 'abc'.charAt(i)); sel.value = ['ok', 'frozen', 'high', 'low'][k]; sel.onchange(); });
    P.lbl = TW.label('PT-101' + 'ABC'.charAt(i), g, { off: [0, 0.9 + i * 0.3, 0], group: 'tag' });
    return P;
  }
  function pcolor(P) {
    var st = [[20, 0x3da0ff], [40, 0x22d3a6], [48, 0xa8e05a], [55, 0xffd24a], [60, 0xff9a3a], [75, 0xff4d3a], [90, 0xff1010]];
    if (P <= st[0][0]) return new T.Color(st[0][1]);
    for (var i = 1; i < st.length; i++) if (P <= st[i][0]) return new T.Color(st[i - 1][1]).lerp(new T.Color(st[i][1]), (P - st[i - 1][0]) / (st[i][0] - st[i - 1][0]));
    return new T.Color(st[st.length - 1][1]);
  }
  function buildPlant() {
    TW.ground(90, '#121a22', 'rgba(0,229,255,.08)');
    var plat = TW.box(6.6, 0.12, 3.0, mPlat); plat.position.set(-4.0, 0.06, 0); TW.add(plat);
    for (var i = 0; i < 13; i++) TW.add(TW.at(TW.box(0.03, 0.02, 3.0, M.std(0xf2c500, 0, 0.6)), -7.1 + i * 0.5, 0.13, 0));
    /* sumur / header HP */
    var wh = new T.Group(); wh.position.set(-7.6, 0, 0); TW.add(wh);
    put(wh, TW.cyl(0.22, 0.22, 3.0, M.std(0xc85a3a, 0.7, 0.4), 20), 0, 1.5, 0); put(wh, TW.box(0.5, 0.5, 0.5, M.std(0xb04a2c, 0.7, 0.4)), 0, 0.9, 0); put(wh, TW.box(0.5, 0.5, 0.5, M.std(0xb04a2c, 0.7, 0.4)), 0, 2.1, 0);
    put(wh, TW.torus(0.22, 0.04, mYellow).rotateX(Math.PI / 2), 0, 2.85, 0); put(wh, TW.cyl(0.05, 0.05, 0.5, mSteel, 8), 0, 3.25, 0); put(wh, TW.sph(0.16, mYellow, 12), 0, 3.55, 0); put(wh, TW.cyl(0.06, 0.06, 0.6, mSteel, 8), 0.4, 1.2, 0).rotation.z = Math.PI / 2;
    TW.label('SUMUR / HEADER<small>150 bar</small>', wh, { off: [0, 4.1, 0], group: 'eq' });
    /* PCV-101 */
    var pcv = new T.Group(); pcv.position.set(-6.2, YL, 0); TW.add(pcv);
    put(pcv, TW.sph(0.26, mBody, 20), 0, 0, 0); put(pcv, TW.cyl(0.08, 0.08, 0.5, mSteel, 12), 0, 0.4, 0); put(pcv, TW.sph(0.33, M.std(0x2fae6a, 0.4, 0.5), 20), 0, 0.85, 0).scale.y = 0.6; put(pcv, TW.cyl(0.33, 0.33, 0.1, M.std(0x2a8a58, 0.4, 0.5), 20), 0, 0.68, 0);
    scn.pcvLbl = TW.label('PCV-101', pcv, { off: [0, 1.5, 0], group: 'eq' });
    /* pipa */
    var mUp = mHP; mDown = M.shell(0x9fb3c8, 0.75, 0.4); TW.shellDouble(mDown);
    pipes.up = TW.pipe([[-7.6, YL, 0], [-6.5, YL, 0]], 0.16, { mat: mHP }); pipes.up2 = TW.pipe([[-5.9, YL, 0], [XA - 0.45, YL, 0]], 0.16, { mat: mHP });
    pipes.spool = TW.pipe([[XA + 0.45, YL, 0], [XB - 0.45, YL, 0]], 0.16, { mat: mHP });
    pipes.down = TW.pipe([[XB + 0.45, YL, 0], [7.4, YL, 0]], 0.13, { mat: mDown });
    Object.keys(pipes).forEach(function (k) { TW.add(pipes[k].group); });
    [pipes.up, pipes.up2, pipes.spool].forEach(function (p) { p.setFluid(0xff6a3a, 0.5); });
    /* valve HIPPS */
    XV = [buildValve(XA, 'XV-101A', 0), buildValve(XB, 'XV-101B', 1)];
    PT = [buildPT(0), buildPT(1), buildPT(2)];
    TW.label('BAGIAN HULU &middot; rating 150 bar', new T.Vector3(-5.2, YL + 0.5, 0), { off: [0, 0, 0], cls: 'warn', group: 'eq' });
    scn.spoolLbl = TW.label('spool (uji / vent)', new T.Vector3((XA + XB) / 2, YL + 0.35, 0), { group: 'eq', maxD: 16 });
    scn.pdLbl = TW.label('P hilir', new T.Vector3(3.4, YL + 0.5, 0), { cls: 'ok', group: 'tag' });
    TW.label('BAGIAN HILIR &middot; desain 60 bar (MAWP)', new T.Vector3(4.6, YL + 1.0, 0), { cls: 'warn', group: 'eq' });
    var plate = TW.plate(1.5, 0.75, function (g, w, h) { g.fillStyle = '#f2c500'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('MAWP 60 bar', w / 2, h * 0.5); g.font = 'bold 24px sans-serif'; g.fillText('HIPPS SIL 3 · 2oo3', w / 2, h * 0.82); }, 512);
    plate.position.set(3.2, 0.7, 0.25); TW.add(plate); TW.add(TW.at(TW.box(0.05, 0.6, 0.05, mSteel), 3.2, 0.3, 0.2));
    /* separator + PSV + flare */
    var sepM = M.std(0xb6c3bc, 0.6, 0.4), sep = new T.Group(); sep.position.set(8.6, 1.5, 0); TW.add(sep);
    sep.add(cylX(0.95, 2.6, sepM, 32)); [-1.3, 1.3].forEach(function (x) { var h = TW.sph(0.95, sepM, 24); h.scale.set(0.45, 1, 1); h.position.x = x; sep.add(h); });
    [-0.7, 0.7].forEach(function (x) { TW.add(TW.at(TW.box(0.25, 0.9, 1.5, mSteel), 8.6 + x, 0.5, 0)); });
    scn.sep = sep; TW.label('V-102 &middot; separator', sep, { off: [0, 1.5, 0], group: 'eq' });
    TW.add(TW.rod([7.2, YL, 0], [7.2, YL, 0], 0.01, mSteel, 4));
    TW.add(TW.rod([6.0, YL, 0], [6.0, 2.5, 0], 0.07, mSteel, 12));
    var psv = new T.Group(); psv.position.set(6.0, 2.5, 0); TW.add(psv); put(psv, TW.cyl(0.11, 0.11, 0.3, M.std(0x1f70b8, 0.4, 0.5), 16), 0, 0.15, 0); put(psv, TW.cyl(0.07, 0.07, 0.25, M.std(0xd84a3a, 0.4, 0.5), 12), 0, 0.42, 0); scn.psvLamp = put(psv, TW.sph(0.045, LED(0x1aff7a), 8), 0, 0.6, 0);
    TW.add(TW.rod([6.0, 2.5, 0], [6.0, 3.4, 0], 0.05, mSteel, 10)); TW.add(TW.rod([6.0, 3.4, 0], [10.8, 3.4, -2.6], 0.05, mSteel, 10)); TW.add(TW.rod([10.8, 3.4, -2.6], [10.8, 7.5, -2.6], 0.14, mSteel, 12));
    scn.psvLbl = TW.label('PSV 60 bar', psv, { off: [0, 0.9, 0], group: 'eq' });
    flare = TW.fx.fire([10.8, 7.7, -2.6], { size: 0.5, rate: 40, speed: 1.6, spread: 0.2, smoke: 0.2, light: false }); flare.k = 0.0;
    TW.label('flare', new T.Vector3(10.8, 8.1, -2.6), { group: 'eq', maxD: 40 });
    rupFire = TW.fx.fire([RUP.x, RUP.y, RUP.z], { size: 1.3, rate: 130, speed: 3.0, spread: 0.5, smoke: 0.4 });
    /* kabinet SIS */
    var cb = cab = new T.Group(); cb.position.copy(CAB); TW.add(cb);
    put(cb, TW.box(1.9, 2.0, 0.8, M.std(0x39424b, 0.5, 0.5)), 0, 1.0, 0); put(cb, TW.box(1.94, 0.06, 0.84, M.std(0x222a31, 0.4, 0.6)), 0, 2.03, 0);
    sisCv = document.createElement('canvas'); sisCv.width = 512; sisCv.height = 384; sisTex = new T.CanvasTexture(sisCv);
    put(cb, new T.Mesh(new T.PlaneGeometry(1.7, 1.28), new T.MeshBasicMaterial({ map: sisTex })), 0, 1.25, 0.41);
    scn.leds = []; for (var k = 0; k < 7; k++) { var lm = LED(0x1aff7a); scn.leds.push(lm); put(cb, TW.sph(0.045, lm, 8), -0.7 + k * 0.23, 0.32, 0.42); }
    TW.label('SIS &middot; LOGIC SOLVER SIL 3<small>TMR</small>', cb, { off: [0, 2.4, 0], group: 'eq' });
    /* kabel */
    PTX.forEach(function (x, i) {
      var y = 2.6 + 0.13 * i, ci = 1.6 + 0.3 * i; var w = TW.pipe([[x, YL + 0.75, 0], [x, y, 0], [x, y, 3.2], [ci, y, 3.2], [ci, 2.06, 3.2]], 0.014, { mat: M.std(PT_HEX[i], 0, 0.6), bend: 0.12 }); TW.add(w.group);
    });
    [XA, XB].forEach(function (x, k) {
      var y = 3.15 + 0.18 * k, cx = 2.75 + 0.18 * k; var w = TW.pipe([[cx, 2.06, 3.2], [cx, y, 3.2], [x + 0.5, y, 0.22], [x + 0.5, YL + 1.3, 0.22]], 0.016, { mat: M.std(0xff6a3a, 0, 0.6), bend: 0.12 }); TW.add(w.group);
    });
    /* alarm kerusakan */
    scn.rupBroken = new T.Group(); TW.add(scn.rupBroken);
  }

  /* ------------------------------------------------------------ dinamika */
  function resetState(keepFaults) {
    S = { t: 0, Pd: 40, Pu: PSRC, pcv: PCV0, kout: KOUT0, dist: false, tDist: -1, rd: [40, 40, 40], frozen: [40, 40, 40], votes: [0, 0, 0], trip: false, tripped: false, tTrip: -1, tCmd: -1, cmdClose: false, vpos: [1, 1], nextScan: 0, tSet: -1, tClosed: -1, peak: 40, dPdt: 0, ruptured: false, psvFlow: 0, disc: [false, false, false], verdictDone: false, spurious: false, psvOpened: false, log: [], acc: 0, leakK: 0 };
    if (chart) chart.clear();
    if (rupFire) rupFire.k = 0;
    if (scn.pipeVis) scn.pipeVis(true);
    if (flare) flare.k = 0;
    if (typeof TW.fx.reset === 'function' && rupFire) { TW.fx.reset(); rupFire.k = 0; if (flare) flare.k = 0; }
    var b = $('banner'); if (b) b.className = 'banner'; var ra = $('redalert'); if (ra) ra.style.opacity = 0;
    if (scn.pdLbl) { setBadge('SIAGA', ''); }
  }
  function setBadge(t, c) { var b = $('state-badge'); b.textContent = t; b.className = 'badge ' + (c || ''); }
  function logEv(t, cls) { S.log.push([S.t, t, cls || '']); }
  function triggerDisturbance() {
    if (S.dist) return; S.dist = true; S.tDist = S.t; S.peak = S.Pd; logEv('Gangguan: ' + SCN[CFG.scn].name + '.', 'warn'); setBadge('GANGGUAN PROSES', 'warn');
  }
  function fltVal(i, P) {
    var f = FLT.pt[i];
    if (f === 'frozen') return S.frozen[i];
    if (f === 'high') return 100;
    if (f === 'low') return P * 0.55;
    return P;
  }
  function median3(a) { var b = a.slice().sort(function (x, y) { return x - y; }); return b[1]; }
  function step(h) {
    S.t += h;
    // gangguan proses
    var tg = S.dist && !S.ruptured ? SCN[CFG.scn] : { pu: PSRC, pcv: PCV0, kout: KOUT0 };
    S.Pu += (tg.pu - S.Pu) * (1 - Math.exp(-h / 0.5)); S.pcv += (tg.pcv - S.pcv) * (1 - Math.exp(-h / 0.3)); S.kout += (tg.kout - S.kout) * (1 - Math.exp(-h / 0.5));
    // valve
    for (var i = 0; i < 2; i++) {
      if (i === 1 && CFG.nv === 1) continue;
      if (S.cmdClose) { if (S.t >= S.tCmd + 0.2 && !FLT.xv[i]) S.vpos[i] = Math.max(0, S.vpos[i] - h / CFG.tclose); }
      else S.vpos[i] = Math.min(1, S.vpos[i] + h / 4);
    }
    var eff = CFG.nv === 1 ? S.vpos[0] : Math.min(S.vpos[0], S.vpos[1]);
    // proses
    var inflow = KIN * S.pcv * eff * Math.max(0, S.Pu - S.Pd), outflow = S.kout * Math.max(0, S.Pd - PSINK);
    var psv = CFG.psv && S.Pd > PSV_SET ? Math.min(PSV_CAP, PSV_CAP * (S.Pd - PSV_SET) / 6) : 0; S.psvFlow = psv; if (psv > 0.05) S.psvOpened = true;
    var dP = inflow - outflow - psv; if (S.ruptured) dP = -0.4 * (S.Pd - 1);
    S.dPdt += (dP - S.dPdt) * Math.min(1, h * 6); S.Pd = Math.max(1, S.Pd + dP * h); S.eff = eff; S.flow = inflow;
    if (S.Pd > S.peak) S.peak = S.Pd;
    if (S.tSet < 0 && S.Pd >= CFG.sp) S.tSet = S.t;
    // sensor
    for (var k = 0; k < 3; k++) {
      var tv = fltVal(k, S.Pd); if (FLT.pt[k] === 'ok') S.frozen[k] = S.rd[k];
      S.rd[k] += (tv - S.rd[k]) * (1 - Math.exp(-h / 0.25));
    }
    // logic solver: scan 100 ms
    if (S.t >= S.nextScan) {
      S.nextScan = S.t + 0.1;
      for (var m = 0; m < 3; m++) S.votes[m] = (S.rd[m] + (Math.random() - 0.5) * 0.06) >= CFG.sp ? 1 : 0;
      var v = S.votes, trip = CFG.arch === '1oo1' ? v[0] : (CFG.arch === '1oo2' ? (v[0] || v[1]) : (CFG.arch === '2oo2' ? (v[0] && v[1]) : (v[0] + v[1] + v[2] >= 2)));
      S.trip = !!trip;
      if (CFG.hipps && S.trip && !S.tripped) {
        S.tripped = true; S.tTrip = S.t; S.cmdClose = true; S.tCmd = S.t; S.spurious = S.Pd < CFG.sp - 1;
        logEv(S.spurious ? 'TRIP PALSU: sensor salah tinggi memicu HIPPS padahal tekanan normal (' + idc(S.Pd, 1) + ' bar).' : 'HIPPS TRIP pada ' + idc(S.Pd, 1) + ' bar (voting ' + CFG.arch + '): solenoid de-energize, valve menutup.', S.spurious ? 'warn' : 'ok');
        setBadge(S.spurious ? 'TRIP PALSU' : 'HIPPS TRIP', S.spurious ? 'warn' : 'ok');
      }
      // diskrepansi
      var used = CFG.arch === '1oo1' ? [0] : (CFG.arch === '2oo3' ? [0, 1, 2] : [0, 1]);
      for (var q = 0; q < 3; q++) S.disc[q] = false;
      if (used.length === 3) { var md = median3(S.rd); used.forEach(function (u) { if (Math.abs(S.rd[u] - md) > 4) S.disc[u] = true; }); }
      else if (used.length === 2) { if (Math.abs(S.rd[0] - S.rd[1]) > 4) S.disc[0] = S.disc[1] = true; }
    }
    if (S.cmdClose && S.tClosed < 0 && eff <= 0.01) { S.tClosed = S.t; logEv('Valve tertutup penuh (' + idc(S.tClosed - (S.tSet >= 0 ? S.tSet : S.tTrip), 2) + ' s sejak setpoint terlampaui). Tekanan puncak ' + idc(S.peak, 1) + ' bar.', 'ok'); }
    if (S.Pd > PSV_SET && CFG.psv && S.psvFlow > 0.05 && !S.psvLogged) { S.psvLogged = true; logEv('PSV membuka pada ' + PSV_SET + ' bar: flaring gas (kapasitas terbatas).', 'warn'); }
    if (S.Pd >= RUPT && !S.ruptured) rupture();
    if (S.spurious && !S.spurDone && S.t - S.tTrip > 1) { S.spurDone = true; var bb = $('banner'); bb.className = 'banner warn'; bb.innerHTML = 'TRIP PALSU &mdash; PROSES BERHENTI<small>Satu sensor salah tinggi memicu HIPPS pada arsitektur ' + CFG.arch + '. Dengan 2oo3 / 2oo2 sensor tunggal yang salah tidak memicu trip.</small>'; setTimeout(function () { if (bb.className.indexOf('bad') < 0) bb.className = 'banner'; }, 9000); }
    // verdict
    if (S.dist && !S.verdictDone) {
      if (S.ruptured) { } // ditangani di rupture()
      else if (S.tripped && S.tClosed >= 0 && S.t - S.tClosed > 2) verdict(S.peak < MAWP ? 'ok' : 'warn');
      else if (!S.tripped && S.t - S.tDist > 45 && Math.abs(S.dPdt) < 0.03) verdict(S.peak > MAWP ? 'warn' : 'ok', true);
    }
  }
  function verdict(kind, noTrip) {
    S.verdictDone = true; var b = $('banner');
    if (kind === 'ok') { b.className = 'banner ok'; b.innerHTML = 'HIPPS BERHASIL &mdash; TEKANAN DITAHAN ' + idc(S.peak, 1) + ' bar &lt; MAWP 60<small>Valve menutup sebelum pipa hilir melampaui tekanan desain. Tidak ada PSV yang membuka, tidak ada flaring.</small>'; setBadge('AMAN', 'ok'); logEv('AMAN: puncak ' + idc(S.peak, 1) + ' bar &lt; MAWP ' + MAWP + ' bar.', 'ok'); }
    else { b.className = 'banner warn'; b.innerHTML = (noTrip ? 'TANPA HIPPS &mdash; OVERPRESSURE ' : 'HIPPS TERLAMBAT &mdash; OVERPRESSURE ') + idc(S.peak, 1) + ' bar &gt; MAWP 60<small>' + (noTrip ? 'Hanya PSV yang menahan: tekanan melampaui desain (perlu inspeksi/uji ulang).' : 'Respons SIF (sensor + logic + stroke valve) lebih lambat dari waktu aman proses. Percepat valve / turunkan setpoint.') + '</small>'; setBadge('OVERPRESSURE', 'warn'); logEv('OVERPRESSURE: puncak ' + idc(S.peak, 1) + ' bar &gt; MAWP.', 'warn'); }
    setTimeout(function () { if (b.className.indexOf('bad') < 0) b.className = 'banner'; }, 10000);
  }
  function rupture() {
    S.ruptured = true; S.verdictDone = true; logEv('PIPA HILIR PECAH pada ' + idc(S.Pd, 0) + ' bar (≥ ' + RUPT + ' bar): loss of containment, gas menyembur dan menyala.', 'bad');
    TW.fx.blast([RUP.x, RUP.y, RUP.z], 5.5); TW.fx.scorch([RUP.x, 0, 0], 5); rupFire.k = 1; setBadge('PIPA PECAH', 'bad'); $('redalert').style.opacity = 0.7;
    TW.flyTo([8.5, 5.2, 13.5], [3.0, 1.6, 0], 1.6);
    var b = $('banner'); b.className = 'banner bad'; b.innerHTML = 'PIPA PECAH &mdash; LOSS OF CONTAINMENT<small>' + (CFG.hipps ? 'HIPPS gagal menutup tepat waktu (sensor/valve gagal atau terlalu lambat).' : 'Tanpa HIPPS, PSV tidak sanggup menahan laju kenaikan tekanan.') + '</small>';
  }

  /* -------------------------------------------------------------- visual */
  function updateVisuals(dt) {
    var P = S.Pd, col = pcolor(P);
    pipes.down.setFluid(col, S.ruptured ? 0.15 : 0.55); pipes.down.setFlow(S.ruptured ? 1.6 : Math.min(2.2, S.flow * 0.6 + (S.dist ? 0 : 0.35)));
    var flowUp = S.eff * (S.pcv > 0.5 ? 1.2 : 0.4); [pipes.up, pipes.up2].forEach(function (p) { p.setFlow(0.4 + flowUp * 0.6); }); pipes.spool.setFlow(0.3 + S.eff * 0.9);
    var over = P > MAWP; mDown.emissive.setRGB(over ? 0.8 + 0.2 * Math.sin(TW.time() * 12) : 0, 0.0, 0.0); mDown.emissiveIntensity = over ? 0.6 : 0;
    // valve
    XV.forEach(function (V, i) {
      var op = S.vpos[i]; V.ball.rotation.y = (1 - op) * Math.PI / 2;
      V.piston.position.y = 1.0 + 0.3 * op; V.piston.position.y = TW.lerp(1.05, 1.25, op);
      var top = 1.38, n = V.rings.length, ys = V.piston.position.y + 0.03; V.rings.forEach(function (r, k) { r.position.y = ys + (k + 0.5) * (top - ys) / n; });
      V.ind.rotation.y = (1 - op) * Math.PI / 2; V.ind.material.color.set(op > 0.98 ? 0x1aff7a : (op < 0.02 ? 0xff3d4d : 0xffb020)); V.ind.material.emissive.set(op > 0.98 ? 0x1aff7a : (op < 0.02 ? 0xff3d4d : 0xffb020));
      var energized = !S.cmdClose; V.ledMat.emissive.set(energized ? 0x1aff7a : 0xff3d4d);
      var stuckVis = FLT.xv[i] && S.cmdClose; V.stuckLbl.hidden = !FLT.xv[i]; V.stuckLbl.set(S.cmdClose && FLT.xv[i] ? 'MACET TERBUKA &mdash; GAGAL MENUTUP' : 'MACET TERBUKA (kegagalan tersembunyi)', 'bad');
      var txt = op > 0.98 ? 'TERBUKA' : (op < 0.02 ? 'TERTUTUP' : 'MENUTUP ' + Math.round(op * 100) + '%');
      if (i === 1 && CFG.nv === 1) V.lbl.set(V.tag + '<small>tidak dalam SIF</small>', '');
      else V.lbl.set(V.tag + '<small>' + txt + '</small>', op < 0.02 ? 'bad' : (op < 0.98 ? 'warn' : 'ok'));
    });
    // PT
    PT.forEach(function (p, i) {
      var f = FLT.pt[i], used = CFG.arch === '1oo1' ? i === 0 : (CFG.arch === '2oo3' ? true : i < 2);
      var vote = S.votes[i] && used; var cls = f !== 'ok' ? 'bad' : (vote ? 'warn' : (used ? 'ok' : ''));
      p.lbl.set('PT-101' + 'ABC'.charAt(i) + '<small>' + idc(S.rd[i], 1) + ' bar' + (used ? '' : ' · tak dipakai') + '</small>', cls);
      p.ledMat.emissive.set(f !== 'ok' ? 0xffb020 : (vote ? 0xff3d4d : 0x1aff7a));
    });
    scn.pdLbl.set('P hilir ' + idc(P, 1) + ' bar', P > MAWP ? 'bad' : (P >= CFG.sp ? 'warn' : 'ok'));
    var pv = CFG.psv && S.psvFlow > 0.05; scn.psvLamp.material.emissive.set(pv ? 0xff3d4d : 0x1aff7a); scn.psvLbl.set('PSV 60 bar<small>' + (pv ? 'BUKA · flaring' : (CFG.psv ? 'tertutup' : 'tidak dipasang')) + '</small>', pv ? 'warn' : '');
    flare.k += ((pv ? Math.min(1, S.psvFlow / PSV_CAP) * 1.0 : 0) - flare.k) * Math.min(1, dt * 3);
    scn.pcvLbl.set('PCV-101<small>' + (S.dist && SCN[CFG.scn].pcv > 0.5 ? 'GAGAL TERBUKA 100%' : 'kendali ' + Math.round(S.pcv * 100) + '%') + '</small>', S.dist && SCN[CFG.scn].pcv > 0.5 ? 'bad' : '');
    // rupture fire follow
    if (S.ruptured) { rupFire.k = Math.max(0.35, rupFire.k * (1 - dt * 0.06)) * (S.Pd > 5 ? 1 : 0.6); }
    // kabinet: LED
    var v = S.votes;
    [0, 1, 2].forEach(function (i) { scn.leds[i].emissive.set(v[i] ? 0xff3d4d : (FLT.pt[i] !== 'ok' ? 0xffb020 : 0x1aff7a)); });
    scn.leds[3].emissive.set(S.trip ? 0xff3d4d : 0x1aff7a); scn.leds[4].emissive.set(S.tripped ? 0xff3d4d : 0x1a3a2a); scn.leds[5].emissive.set(S.cmdClose ? 0xff3d4d : 0x1aff7a); scn.leds[6].emissive.set(S.cmdClose ? 0xff3d4d : 0x1aff7a);
  }
  function drawSisPanel() {
    var g = sisCv.getContext('2d'), W = sisCv.width, H = sisCv.height;
    g.fillStyle = '#04101a'; g.fillRect(0, 0, W, H); g.strokeStyle = '#00e5ff'; g.lineWidth = 3; g.strokeRect(4, 4, W - 8, H - 8);
    g.fillStyle = '#00e5ff'; g.font = 'bold 30px monospace'; g.fillText('HIPPS SIS  SIL 3', 22, 46); g.fillStyle = '#7f9db3'; g.font = '20px monospace'; g.fillText('voting ' + CFG.arch + ' · ' + CFG.nv + ' valve · setpoint ' + CFG.sp + ' bar', 22, 76);
    ['A', 'B', 'C'].forEach(function (n, i) {
      var used = CFG.arch === '1oo1' ? i === 0 : (CFG.arch === '2oo3' ? true : i < 2); g.fillStyle = !used ? '#4a5a66' : (S.votes[i] ? '#ff3d4d' : '#1aff7a'); g.font = 'bold 26px monospace';
      g.fillText('PT-' + n + '  ' + S.rd[i].toFixed(1).padStart(5, ' ') + ' bar  ' + (FLT.pt[i] !== 'ok' ? 'FAULT' : (S.votes[i] ? 'TRIP' : 'ok')), 22, 130 + i * 40);
    });
    g.fillStyle = S.tripped ? '#ff3d4d' : (S.trip ? '#ffb020' : '#1aff7a'); g.font = 'bold 44px monospace'; g.fillText(S.tripped ? 'TRIP  LATCHED' : 'ARMED', 22, 290);
    g.fillStyle = '#cfe6f5'; g.font = '22px monospace'; g.fillText('XV-A ' + Math.round(S.vpos[0] * 100) + '%   XV-B ' + Math.round(S.vpos[1] * 100) + '%', 22, 335); g.fillText('P hilir ' + S.Pd.toFixed(1) + ' bar', 22, 366);
    sisTex.needsUpdate = true;
  }

  /* ------------------------------------------------------------------ UI */
  function svgVote() {
    var used = CFG.arch === '1oo1' ? [1, 0, 0] : (CFG.arch === '2oo3' ? [1, 1, 1] : [1, 1, 0]), c = { ok: '#29e08a', trip: '#ff3d4d', fault: '#ffb020', off: '#4a5a66' };
    var h = '<svg viewBox="0 0 340 150" width="100%" style="display:block;background:rgba(0,10,20,.55);border:1px solid rgba(0,229,255,.16);border-radius:3px" font-family="Rajdhani,sans-serif" font-size="11">';
    var votes = 0;
    for (var i = 0; i < 3; i++) {
      var y = 12 + i * 42, st = !used[i] ? 'off' : (S.votes[i] ? 'trip' : (FLT.pt[i] !== 'ok' ? 'fault' : 'ok')); if (used[i] && S.votes[i]) votes++;
      h += '<rect x="8" y="' + y + '" width="86" height="32" rx="3" fill="rgba(0,229,255,.06)" stroke="' + c[st] + '" stroke-width="1.6"/><text x="14" y="' + (y + 14) + '" fill="' + PT_COL[i] + '" font-weight="700">PT-101' + 'ABC'.charAt(i) + '</text><text x="14" y="' + (y + 27) + '" fill="' + c[st] + '" font-family="JetBrains Mono,monospace" font-size="10">' + S.rd[i].toFixed(1) + ' bar ' + (!used[i] ? '(off)' : (FLT.pt[i] !== 'ok' ? {frozen:'BEKU',high:'HIGH',low:'LOW'}[FLT.pt[i]] : (S.votes[i] ? 'TRIP' : 'ok'))) + '</text>';
      h += '<path d="M94 ' + (y + 16) + ' L128 ' + (y + 16) + ' L128 75" fill="none" stroke="' + c[st] + '" stroke-width="1.4"/>';
    }
    var need = { '1oo1': 1, '1oo2': 1, '2oo2': 2, '2oo3': 2 }[CFG.arch], tot = { '1oo1': 1, '1oo2': 2, '2oo2': 2, '2oo3': 3 }[CFG.arch], tv = S.trip ? c.trip : c.ok;
    h += '<rect x="128" y="52" width="58" height="46" rx="4" fill="rgba(0,229,255,.08)" stroke="' + tv + '" stroke-width="2"/><text x="157" y="72" text-anchor="middle" fill="#fff" font-weight="700" font-size="14">' + CFG.arch + '</text><text x="157" y="88" text-anchor="middle" fill="' + tv + '" font-family="JetBrains Mono,monospace" font-size="10">' + votes + '/' + tot + ' ≥ ' + need + '</text>';
    h += '<path d="M186 75 L214 75" stroke="' + tv + '" stroke-width="1.6" marker-end="url(#ar)"/><rect x="214" y="52" width="58" height="46" rx="4" fill="rgba(0,229,255,.08)" stroke="' + (S.tripped ? c.trip : c.ok) + '" stroke-width="2"/><text x="243" y="72" text-anchor="middle" fill="#fff" font-weight="700">LOGIC</text><text x="243" y="88" text-anchor="middle" fill="' + (S.tripped ? c.trip : c.ok) + '" font-size="10">SIL3 · ' + (S.tripped ? 'TRIP' : 'ARMED') + '</text>';
    for (var k = 0; k < 2; k++) {
      var y2 = 30 + k * 60, op = S.vpos[k], unused = k === 1 && CFG.nv === 1, st2 = unused ? 'off' : (FLT.xv[k] && S.cmdClose ? 'fault' : (op < 0.02 ? 'trip' : (op < 0.98 ? 'fault' : 'ok')));
      h += '<path d="M272 75 L288 75 L288 ' + (y2 + 12) + ' L296 ' + (y2 + 12) + '" fill="none" stroke="' + (S.cmdClose ? c.trip : c.ok) + '" stroke-width="1.4"/><rect x="296" y="' + y2 + '" width="38" height="26" rx="3" fill="rgba(0,229,255,.06)" stroke="' + c[st2] + '" stroke-width="1.6"/><text x="315" y="' + (y2 + 11) + '" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">XV-' + 'AB'.charAt(k) + '</text><text x="315" y="' + (y2 + 22) + '" text-anchor="middle" fill="' + c[st2] + '" font-size="9" font-family="JetBrains Mono,monospace">' + (unused ? 'n/a' : (FLT.xv[k] ? 'MACET' : Math.round(op * 100) + '%')) + '</text>';
    }
    h += '<defs><marker id="ar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#7f9db3"/></marker></defs></svg>';
    $('vote-svg').innerHTML = h;
  }
  function renderTT() {
    var n = CFG.arch === '1oo1' ? 1 : (CFG.arch === '2oo3' ? 3 : 2), head = '<tr>' + ['A', 'B', 'C'].slice(0, n).map(function (x) { return '<th>PT-' + x + '</th>'; }).join('') + '<th>Trip?</th><th>Keterangan</th></tr>';
    $('tt-head').innerHTML = head;
    var rows = '', cur = 0; for (var i = 0; i < n; i++) cur |= (S.votes[i] ? 1 : 0) << (n - 1 - i);
    for (var m = 0; m < (1 << n); m++) {
      var b = []; for (var k = 0; k < n; k++) b.push((m >> (n - 1 - k)) & 1); var s = b.reduce(function (a, c) { return a + c; }, 0);
      var trip = CFG.arch === '1oo1' ? b[0] : (CFG.arch === '1oo2' ? (b[0] || b[1]) : (CFG.arch === '2oo2' ? (b[0] && b[1]) : s >= 2));
      var note = CFG.arch === '2oo3' ? (s === 0 ? 'normal' : (s === 1 ? '1 sensor salah &rarr; DIABAIKAN' : (s === 2 ? '2 sensor setuju &rarr; TRIP' : 'semua setuju'))) : '';
      rows += '<tr' + (m === cur ? ' class="sel"' : '') + '>' + b.map(function (x) { return '<td style="color:' + (x ? '#ff5d6c' : '#7f9db3') + '">' + (x ? 'HIGH' : 'ok') + '</td>'; }).join('') + '<td style="color:' + (trip ? '#ff5d6c' : '#29e08a') + '"><b>' + (trip ? 'TRIP' : 'tidak') + '</b></td><td style="font-family:Rajdhani,sans-serif">' + note + '</td></tr>';
    }
    $('tt-body').innerHTML = rows;
  }
  function renderSIL() {
    var r = calcSIL(CFG.arch, CFG.nv, CFG.ti), rows = '';
    var cell = function (v, ok) { return '<td style="color:' + (ok === false ? '#ff5d6c' : '#fff') + '">' + v + '</td>'; };
    rows += '<tr><td>Sensor ' + CFG.arch + '</td>' + cell(sci(r.pfdS)) + cell(r.hS) + cell('SIL ' + r.aS + ' <span style="color:#7f9db3">(SFF ' + Math.round(r.sffS * 100) + '%)</span>', r.aS >= 3) + '</tr>';
    rows += '<tr><td>Logic solver</td>' + cell(sci(r.pfdL)) + cell('—') + cell('SIL ' + r.aL + ' <span style="color:#7f9db3">(cert.)</span>') + '</tr>';
    rows += '<tr><td>Valve ' + (CFG.nv === 1 ? '1oo1' : '1oo2') + '</td>' + cell(sci(r.pfdV)) + cell(r.hV) + cell('SIL ' + r.aV + ' <span style="color:#7f9db3">(SFF ' + Math.round(r.sffV * 100) + '%)</span>', r.aV >= 3) + '</tr>';
    $('sil-body').innerHTML = rows;
    var e = $('s-pfd'); e.textContent = sci(r.pfd) + ' / RRF ' + Math.round(1 / r.pfd); e.className = '';
    var s = $('s-sil'); s.textContent = (r.sil >= 1 ? 'SIL ' + r.sil : '< SIL 1') + (r.sil >= 3 ? ' ✓' : ' ✗ (butuh SIL 3)'); s.className = r.sil >= 3 ? 'ok' : 'bad';
    $('s-str').textContent = idc(r.str, 3) + ' /th · ' + (r.str > 0 ? Math.round(1 / r.str) + ' th' : '∞'); $('s-str').className = r.str > 0.05 ? 'warn' : '';
    var note = 'Band PFD: SIL 3 = 10⁻⁴–10⁻³ (RRF 1000–10.000). ';
    if (r.band > r.sil) note += '<b style="color:#ff5d6c">PFD-nya cukup untuk SIL ' + r.band + ', tetapi arsitektur (HFT/SFF) membatasi ke SIL ' + r.sil + '</b> &mdash; tambah redundansi.';
    else if (r.sil < 3) note += '<b style="color:#ff5d6c">PFD terlalu tinggi:</b> ' + (r.pfdV > r.pfdS ? 'final element (valve) dominan &mdash; pakai 2 valve / perpendek interval proof test.' : 'kurangi interval proof test atau pakai voting redundan.');
    else note += 'Kontribusi terbesar: ' + (r.pfdV >= r.pfdS && r.pfdV >= r.pfdL ? 'valve (final element)' : (r.pfdS >= r.pfdL ? 'sensor' : 'logic solver')) + '. Faktor common cause (β) mendominasi pada arsitektur redundan.';
    $('s-note').innerHTML = note;
    $('hdr-sil').textContent = 'SIF: ' + (r.sil >= 1 ? 'SIL ' + r.sil : '< SIL 1') + ' · ' + CFG.arch + ' / ' + (CFG.nv === 1 ? '1oo1' : '1oo2'); $('hdr-sub').textContent = 'PFDavg ' + sci(r.pfd) + ' · proof test ' + idc(CFG.ti, 2) + ' th';
    var cmp = ''; ['1oo1', '1oo2', '2oo2', '2oo3'].forEach(function (a) {
      var TI = CFG.ti * YEAR, pf = sensPFD(a, TI, PAR.sens), st = sensSTR(a, PAR.sens) * YEAR;
      cmp += '<tr' + (a === CFG.arch ? ' class="sel"' : '') + '><td>' + a + '</td><td>' + sci(pf) + '</td><td>' + sci(st) + '</td><td>' + HFT[a] + '</td></tr>';
    });
    $('cmp-body').innerHTML = cmp;
  }
  function renderInfo() {
    var h = '<h4>APA ITU HIPPS?</h4><p>Safety Instrumented Function yang menutup <b>valve cepat</b> sebelum tekanan hulu tinggi merusak pipa/bejana hilir yang bertekanan desain lebih rendah. Dipakai bila PSV/flare tidak sanggup menampung aliran penuh. Contoh: sumur bertekanan 150 bar ke pipa 60 bar.</p>';
    h += '<h4>ELEMEN SIF</h4><ul class="pc"><li><b>Sensor</b>: 3 transmitter tekanan bersertifikat SIL, voting <b>2oo3</b> (trip bila 2 dari 3 setuju).</li><li><b>Logic solver</b>: PLC keselamatan SIL 3 (TMR, TUV/exida).</li><li><b>Final element</b>: 2 valve ball/gate seri + aktuator spring-return + solenoid (1oo2). Fail-safe: <b>de-energize to trip</b>.</li></ul>';
    h += '<h4>IEC 61508 / 61511</h4><ul class="pc"><li>SIL 1&ndash;4 ditentukan oleh <b>PFDavg</b> (mode permintaan rendah): SIL 1: 10⁻²&ndash;10⁻¹ &middot; SIL 2: 10⁻³&ndash;10⁻² &middot; SIL 3: 10⁻⁴&ndash;10⁻³ &middot; SIL 4: 10⁻⁵&ndash;10⁻⁴.</li><li>Juga dibatasi <b>arsitektur</b>: HFT (toleransi kegagalan perangkat keras) dan SFF (safe failure fraction). SIL 3 umumnya butuh HFT ≥ 1.</li><li>PFD 2oo3 &asymp; (λ<sub>DU</sub>·TI)² + β·λ<sub>DU</sub>·TI/2. Suku β (common cause) mendominasi.</li></ul>';
    h += '<h4>KENAPA 2oo3?</h4><ul class="pc"><li>Satu sensor <b>berbahaya</b> gagal (beku/rendah): dua sisanya tetap trip &rarr; <b>tetap aman</b>.</li><li>Satu sensor <b>salah tinggi</b>: tidak memicu trip palsu (butuh 2) &rarr; pabrik tetap jalan.</li><li>Sensor menyimpang &gt; 4 bar dari median &rarr; alarm diskrepansi (perbaiki sebelum kegagalan kedua).</li></ul>';
    h += '<h4>WAKTU RESPONS</h4><p class="note">Waktu aman proses = waktu dari penyimpangan sampai bahaya. Respons SIF = lag sensor + scan logic + delay solenoid + <b>stroke valve</b> harus lebih kecil daripada itu. Tekanan puncak &asymp; setpoint + laju kenaikan × respons.</p>';
    $('info-box').innerHTML = h;
  }
  function renderStatus() {
    var P = S.Pd; $('r-pd').textContent = idc(P, 1); $('r-pd').style.color = P > MAWP ? '#ff3d4d' : (P >= CFG.sp ? '#ffb020' : '#5cf0ff');
    $('r-pu').textContent = Math.round(S.Pu); $('r-pcv').textContent = 'PCV ' + Math.round(S.pcv * 100) + ' %';
    ['a', 'b', 'c'].forEach(function (x, i) { var e = $('r-' + x), f = FLT.pt[i]; e.textContent = idc(S.rd[i], 1) + ' bar · ' + (f !== 'ok' ? { frozen: 'BEKU', high: 'SALAH TINGGI', low: 'BACA RENDAH' }[f] : (S.votes[i] ? 'TRIP' : 'normal')); e.className = f !== 'ok' ? 'bad' : (S.votes[i] ? 'warn' : 'ok'); });
    var need = { '1oo1': 1, '1oo2': 1, '2oo2': 2, '2oo3': 2 }[CFG.arch], vs = S.votes.slice(0, CFG.arch === '1oo1' ? 1 : (CFG.arch === '2oo3' ? 3 : 2)).reduce(function (a, b) { return a + b; }, 0);
    var vt = $('r-vote'); vt.textContent = vs + ' suara · ' + (S.tripped ? 'TRIP (latched)' : (S.trip ? 'TRIP!' : 'tidak trip')) + (CFG.hipps ? '' : ' · HIPPS OFF'); vt.className = S.tripped ? 'bad' : (S.trip ? 'warn' : 'ok');
    var xv = $('r-xv'); xv.textContent = Math.round(S.vpos[0] * 100) + '% / ' + (CFG.nv === 2 ? Math.round(S.vpos[1] * 100) + '%' : 'n/a'); xv.className = S.tripped && S.eff > 0.01 ? 'bad' : (S.eff < 0.02 ? 'warn' : 'ok');
    var anyD = S.disc.some(function (x) { return x; }); var dd = $('r-disc'); dd.textContent = anyD ? 'ALARM: ' + S.disc.map(function (x, i) { return x ? 'PT-' + 'ABC'.charAt(i) : ''; }).filter(Boolean).join(', ') : (CFG.arch === '1oo1' ? 'tak bisa deteksi (1 sensor)' : 'normal'); dd.className = anyD ? 'warn' : '';
    var rs = $('r-resp'); if (S.tClosed >= 0 && S.tSet >= 0) { var r = S.tClosed - S.tSet; rs.textContent = idc(r, 2) + ' s'; rs.className = ''; } else rs.textContent = S.cmdClose && S.tClosed < 0 ? 'menutup…' : '--';
    var pk = $('r-peak'); pk.textContent = idc(S.peak, 1) + ' bar / ' + (MAWP - S.peak >= 0 ? '+' : '') + idc(MAWP - S.peak, 1) + ' bar'; pk.className = S.peak >= MAWP ? 'bad' : (S.peak >= CFG.sp ? 'warn' : 'ok');
    var pst = $('r-pst'); if (S.dPdt > 0.05 && P < MAWP && !S.ruptured) { pst.textContent = idc((MAWP - P) / S.dPdt, 1) + ' s (laju ' + idc(S.dPdt, 1) + ' bar/s)'; pst.className = (MAWP - P) / S.dPdt < 4 ? 'warn' : ''; } else { pst.textContent = P >= MAWP ? 'MAWP terlampaui' : '--'; pst.className = P >= MAWP ? 'bad' : ''; }
    var ps = $('r-psv'); ps.textContent = !CFG.psv ? 'tidak dipasang' : (S.psvFlow > 0.05 ? 'BUKA · flaring ' + idc(S.psvFlow / PSV_CAP * 100, 0) + '%' : (S.psvOpened ? 'pernah membuka' : 'tertutup')); ps.className = S.psvFlow > 0.05 ? 'warn' : '';
    $('st-panel').className = 'panel' + (S.ruptured ? ' bad' : (S.verdictDone && S.peak < MAWP && S.tripped ? ' ok' : ''));
  }
  function fillFaults() {
    ['a', 'b', 'c'].forEach(function (x, i) {
      var sel = $('f-pt' + x); FAULTS.forEach(function (f) { sel.insertAdjacentHTML('beforeend', '<option value="' + f[0] + '">' + f[1] + '</option>'); });
      sel.onchange = function () { FLT.pt[i] = sel.value; if (sel.value === 'frozen') S.frozen[i] = S.rd[i]; };
    });
    $('f-xva').onchange = function () { FLT.xv[0] = this.checked; }; $('f-xvb').onchange = function () { FLT.xv[1] = this.checked; };
  }
  function wireUI() {
    fillFaults();
    function bind(id, key, sv, fmt, num) { var e = $(id); e.oninput = e.onchange = function () { CFG[key] = num ? parseFloat(e.value) : e.value; if (sv) $(sv).innerHTML = fmt(CFG[key]); renderSIL(); if (key === 'arch') renderTT(); scnNote(); }; e.oninput(); }
    bind('sl-sp', 'sp', 'sv-sp', function (v) { return v + ' bar'; }, true);
    bind('sl-tc', 'tclose', 'sv-tc', function (v) { return idc(v, 1) + ' s'; }, true);
    bind('sl-ti', 'ti', 'sv-ti', function (v) { return idc(v, 2) + ' tahun'; }, true);
    bind('sel-arch', 'arch'); bind('sel-scn', 'scn');
    $('sel-fe').onchange = function () { CFG.nv = parseInt(this.value, 10); renderSIL(); };
    $('chk-hipps').onchange = function () { CFG.hipps = this.checked; }; $('chk-psv').onchange = function () { CFG.psv = this.checked; };
    $('btn-dist').onclick = triggerDisturbance; $('btn-reset').onclick = function () { resetState(true); renderTT(); };
    TW.key(' ', function () { if (S.dist) $('btn-reset').click(); else $('btn-dist').click(); });
    TW.wireView({ xray: 'btn-xray', labels: 'btn-lbl', slider: 'sl-xop' }); TW.setXray(true, 0.2);
    TW.camButtons('cam-btns', [
      { name: 'OVERVIEW', pos: [1.4, 5.6, 20.5], tgt: [1.4, 1.2, 0] },
      { name: 'VALVE HIPPS', pos: [-3.3, 2.9, 6.2], tgt: [-3.3, 1.5, 0] },
      { name: 'PT 2oo3', pos: [1.2, 2.5, 3.8], tgt: [1.2, 1.5, 0] },
      { name: 'KABINET SIS', pos: [3.6, 2.4, 7.4], tgt: [2.2, 1.3, 3.2] },
      { name: 'SUMUR &middot; PCV', pos: [-7.0, 3.6, 7.4], tgt: [-7.0, 1.6, 0] },
      { name: 'HILIR &middot; PSV', pos: [7.6, 4.0, 9.6], tgt: [7.2, 1.6, 0] }
    ]);
    Array.prototype.forEach.call($('cam-btns').children, function (b) { b.innerHTML = b.textContent; });
  }
  function scnNote() { $('scn-note').textContent = SCN[CFG.scn].note; }

  var uiA = 0, chA = 0, panelA = 0;
  function frame(dt) {
    var h = dt / 2; step(h); step(h);
    updateVisuals(dt);
    chA += dt; if (chA > 0.1) { chA = 0; chart.push(S.t, [S.Pd]); }
    chart.draw(Math.max(S.t, 60));
    uiA += dt; if (uiA > 0.15) { uiA = 0; renderStatus(); svgVote(); renderTT(); }
    panelA += dt; if (panelA > 0.25) { panelA = 0; drawSisPanel(); }
    if (S.ruptured) $('redalert').style.opacity = 0.5 + 0.35 * Math.sin(TW.time() * 6);
  }

  HP.start = function () {
    TW.init({ bg: 0x101a25, fog: { color: 0x101a25, near: 45, far: 120 }, cam: [1.4, 5.6, 20.5], target: [1.4, 1.2, 0], shadowSize: 16, exposure: 1.05, maxDist: 70 });
    buildPlant(); resetState();
    chart = new TW.Chart($('trend-canvas'), { series: [{ name: 'P hilir bar', color: '#5cf0ff', min: 0, max: 100 }], span: 60, legend: true, fmt: function (v) { return v.toFixed(0); }, refs: [] });
    chart.o.refs = [{ v: 40, s: 0, color: '#29e08a', label: 'normal 40' }, { v: 48, s: 0, color: '#ffb020', label: 'setpoint' }, { v: MAWP, s: 0, color: '#ff8a3d', label: 'MAWP 60' }, { v: RUPT, s: 0, color: '#ff3d4d', label: 'pecah 90' }];
    wireUI(); renderSIL(); renderTT(); renderInfo(); scnNote();
    var lastSp = null; TW.onUpdate(function (dt) { if (lastSp !== CFG.sp) { lastSp = CFG.sp; chart.o.refs[1].v = CFG.sp; } frame(dt); });
    TW.start();
  };
  HP.S = function () { return S; }; HP.CFG = CFG; HP.FLT = FLT; HP.calc = calcSIL;
  HP.api = { frame: frame, trigger: triggerDisturbance, reset: function () { resetState(true); }, step: step };
  return HP;
})();
