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
  var MK = SK.mat, mDown, mUp, mBody, mCan;
  function put(g, m, x, y, z) { m.position.set(x, y, z); g.add(m); return m; }
  function LED(color) { return new T.MeshStandardMaterial({ color: 0x101010, roughness: 0.4, emissive: color, emissiveIntensity: 1.8 }); }

  /* --------------------------------------------------------------- scene */
  var XA = -4.4, XB = -2.2, PTX = [0.5, 1.2, 1.9], YL = 1.2, RUP = new T.Vector3(4.2, 1.25, 0), CAB = new T.Vector3(1.4, 0, -4.4);
  var SKID = 0.32, PTZ = 0.78, PTY = 1.5;
  /* valve HIPPS: ball valve berflensa + aktuator scotch-yoke spring-return (pegas terlihat saat X-ray) */
  function buildValve(x, tag, idx) {
    var g = new T.Group(); g.position.set(x, YL, 0); TW.add(g);
    var V = { g: g, idx: idx, tag: tag }, B = new SK.Batch(), act = MK.paint(0x2f3a44, 0.45, 0.45), yel = MK.paint(0xe8b800, 0.45, 0.2);
    B.sph(mBody, 0.34, 0, 0, 0, 28, 1.05, 1, 1); B.cylX(mBody, 0.27, 0.62, 0, 0, 0, 28);
    SK.flangeAt(B, MK.paint(0x6f7b85, 0.5, 0.5), [-0.4, 0, 0], [1, 0, 0], 0.16); SK.flangeAt(B, MK.paint(0x6f7b85, 0.5, 0.5), [0.4, 0, 0], [1, 0, 0], 0.16);
    B.box(MK.paint(0x6f7b85, 0.5, 0.5), 0.3, YL - SKID - 0.34, 0.36, 0, -(YL - SKID + 0.34) / 2 + 0.0, 0); B.box(MK.steel(), 0.4, 0.02, 0.46, 0, -(YL - SKID) + 0.01, 0);
    B.cyl(MK.paint(0x6f7b85, 0.5, 0.5), 0.1, 0.12, 0.3, 0, 0.45, 0, 0, 0, 0, 20); B.box(MK.steel(), 0.3, 0.04, 0.3, 0, 0.6, 0);
    B.box(act, 0.46, 0.34, 0.4, 0, 0.8, 0); B.box(act, 0.5, 0.05, 0.44, 0, 0.99, 0);
    B.cylZ(act, 0.23, 0.04, 0, 0.8, 0.22, 32); B.cylZ(act, 0.23, 0.05, 0, 0.8, 1.16, 32);
    for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2; B.rod(MK.steel(), [Math.cos(a) * 0.21, 0.8 + Math.sin(a) * 0.21, 0.22], [Math.cos(a) * 0.21, 0.8 + Math.sin(a) * 0.21, 1.16], 0.008, 6); }
    B.cylZ(act, 0.12, 0.5, 0, 0.8, -0.45, 24); B.cylZ(act, 0.14, 0.04, 0, 0.8, -0.72, 24); B.cylZ(MK.steel(), 0.025, 0.12, 0, 0.8, -0.78, 10);
    B.box(yel, 0.36, 0.035, 0.03, 0, 0.8, 1.19);
    B.box(MK.paint(0x1f6fb5, 0.4, 0.4), 0.14, 0.2, 0.16, 0.33, 0.82, -0.12); B.box(MK.paint(0x1f6fb5, 0.4, 0.4), 0.1, 0.12, 0.12, 0.33, 0.64, -0.12);
    B.tube(MK.ssPol(), [[0.33, 0.72, -0.2], [0.33, 0.72, -0.45], [0.12, 0.72, -0.45]], 0.008, 0.05);
    B.tube(MK.ssPol(), [[0.33, 0.9, -0.04], [0.33, 0.9, 0.3], [0.2, 0.9, 0.3]], 0.008, 0.05);
    B.box(MK.paint(0x2a2f33, 0.45, 0.4), 0.2, 0.14, 0.18, 0, 1.08, 0);
    B.build(g);
    var can = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.9, 32, 1, true), mCan); can.rotation.x = Math.PI / 2; can.position.set(0, 0.8, 0.69); g.add(can);
    var ball = V.ball = new T.Group(); g.add(ball);
    ball.add(new T.Mesh(new T.SphereGeometry(0.25, 28, 18), new T.MeshStandardMaterial({ color: 0xd9b54a, metalness: 0.95, roughness: 0.2 })));
    var bore = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.52, 20), new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 })); bore.rotation.z = Math.PI / 2; ball.add(bore);
    var pts = []; for (var i = 0; i <= 240; i++) { var t = i / 240, an = t * Math.PI * 2 * 9; pts.push(new T.Vector3(Math.cos(an) * 0.15, Math.sin(an) * 0.15, -t)); }
    var spring = V.spring = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 480, 0.018, 8, false), new T.MeshStandardMaterial({ color: 0xc8ced3, metalness: 0.9, roughness: 0.3 }));
    spring.position.set(0, 0.8, 1.13); g.add(spring);
    var piston = V.piston = new T.Mesh(new T.CylinderGeometry(0.185, 0.185, 0.04, 28), new T.MeshStandardMaterial({ color: 0x9aa3aa, metalness: 0.8, roughness: 0.35 })); piston.rotation.x = Math.PI / 2; piston.position.set(0, 0.8, 0.86); g.add(piston);
    var rod = V.rod = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 1, 12), new T.MeshStandardMaterial({ color: 0xd8dde0, metalness: 0.95, roughness: 0.2 })); rod.rotation.x = Math.PI / 2; g.add(rod);
    V.ind = put(g, new T.Mesh(new T.BoxGeometry(0.18, 0.03, 0.05), new T.MeshStandardMaterial({ color: 0x1aff7a, emissive: 0x1aff7a, emissiveIntensity: 0.9 })), 0, 1.17, 0);
    put(g, new T.Mesh(new T.SphereGeometry(0.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), MK.glass()), 0, 1.15, 0);
    V.ledMat = LED(0x1aff7a); V.led = put(g, new T.Mesh(new T.SphereGeometry(0.022, 10, 8), V.ledMat), 0.41, 0.9, -0.12);
    V.lbl = TW.label(tag, g, { off: [0, 1.55, 0], group: 'tag' });
    V.stuckLbl = TW.label('MACET TERBUKA', g, { off: [0, 1.95, 0], cls: 'bad', group: 'tag' }); V.stuckLbl.hidden = true;
    TW.pickable(g, function () { var cb = $(idx === 0 ? 'f-xva' : 'f-xvb'); cb.checked = !cb.checked; cb.onchange(); });
    return V;
  }
  /* transmitter tekanan 2oo3 di rak instrumen, disambung tubing dari tapping di atas pipa */
  function buildPT(i) {
    var x = PTX[i], tx = SK.transmitter({ style: 'alu', color: 0x3d4f60, lcd: '40.0', lcdSub: 'bar' });
    tx.position.set(x, PTY, PTZ); TW.add(tx);
    var P = { g: tx, i: i, setLCD: tx.userData.setLCD };
    var band = new T.Mesh(new T.TorusGeometry(0.05, 0.007, 8, 28), new T.MeshStandardMaterial({ color: PT_HEX[i], emissive: PT_HEX[i], emissiveIntensity: 0.4 })); band.rotation.x = Math.PI / 2; band.position.set(0, 0.12, 0); tx.add(band);
    P.ledMat = LED(0x1aff7a); P.led = put(tx, new T.Mesh(new T.SphereGeometry(0.012, 8, 6), P.ledMat), 0.05, tx.userData.yh + 0.05, 0.05);
    TW.pickable(tx, function () { var k = (['ok', 'frozen', 'high', 'low'].indexOf(FLT.pt[i]) + 1) % 4; var sel = $('f-pt' + 'abc'.charAt(i)); sel.value = ['ok', 'frozen', 'high', 'low'][k]; sel.onchange(); });
    P.lbl = TW.label('PT-101' + 'ABC'.charAt(i), tx, { off: [0, 0.55 + i * 0.22, 0], group: 'tag' });
    return P;
  }
  function pcolor(P) {
    var st = [[20, 0x3da0ff], [40, 0x22d3a6], [48, 0xa8e05a], [55, 0xffd24a], [60, 0xff9a3a], [75, 0xff4d3a], [90, 0xff1010]];
    if (P <= st[0][0]) return new T.Color(st[0][1]);
    for (var i = 1; i < st.length; i++) if (P <= st[i][0]) return new T.Color(st[i - 1][1]).lerp(new T.Color(st[i][1]), (P - st[i - 1][0]) / (st[i][0] - st[i - 1][0]));
    return new T.Color(st[st.length - 1][1]);
  }
  function buildPlant() {
    var B = new SK.Batch(), st = MK.paint(0x4f5b66, 0.6, 0.3), red = MK.paint(0xb3261e, 0.45, 0.25), gry = MK.paint(0x7d8790, 0.5, 0.45);
    SK.ground(B, { pads: [[-11.5, -2.4, -7.2, 2.4, 0.08, 0], [-6.2, -1.9, 3.4, 1.9, 0.12, 0], [-0.6, -5.8, 3.4, -2.6, 0.15, 0], [7.2, -1.8, 13.2, 1.8, 0.1, 0]], roads: [[-40, 8.5, 40, 13.5]] });
    SK.horizon({});
    /* ---- sumur: cellar + Christmas tree */
    var WX = -9.4;
    B.box(MK.concrete(), 2.2, 0.08, 2.2, WX, 0.04, 0); var cg = new T.PlaneGeometry(1.8, 1.8); SK.scaleUV(cg, 3.6, 3.6); B.geo(MK.grating(), cg, SK.M4(WX, 0.1, 0, -Math.PI / 2));
    B.cyl(gry, 0.42, 0.42, 0.35, WX, 0.28, 0, 0, 0, 0, 28); B.cyl(gry, 0.5, 0.5, 0.06, WX, 0.48, 0, 0, 0, 0, 28);
    [-1, 1].forEach(function (sd) { B.cylZ(gry, 0.06, 0.4, WX, 0.3, sd * 0.55, 14); SK.gateValve(B, [WX, 0.3, sd * 0.85], 'z', 0.05, { mat: gry, wheel: red }); });
    B.cyl(gry, 0.32, 0.32, 0.35, WX, 0.7, 0, 0, 0, 0, 24); B.cyl(gry, 0.4, 0.4, 0.05, WX, 0.9, 0, 0, 0, 0, 24);
    SK.gateValve(B, [WX, 1.18, 0], 'y', 0.13, { mat: red, wheel: MK.yellow() }); SK.gateValve(B, [WX, 1.72, 0], 'y', 0.13, { mat: red, wheel: MK.yellow() });
    B.box(gry, 0.34, 0.34, 0.34, WX, 2.14, 0); SK.flangeAt(B, gry, [WX, 2.33, 0], [0, 1, 0], 0.12);
    SK.gateValve(B, [WX, 2.58, 0], 'y', 0.1, { mat: red, wheel: MK.yellow() }); B.cyl(gry, 0.14, 0.12, 0.2, WX, 2.9, 0, 0, 0, 0, 18); B.sph(gry, 0.1, WX, 3.02, 0, 12);
    B.cylX(gry, 0.12, 0.35, WX + 0.35, 2.14, 0, 18); SK.gateValve(B, [WX + 0.72, 2.14, 0], 'x', 0.1, { mat: red, wheel: MK.yellow() });
    B.cylX(gry, 0.11, 0.3, WX - 0.33, 2.14, 0, 16); SK.flangeAt(B, gry, [WX - 0.5, 2.14, 0], [1, 0, 0], 0.1); B.cylX(gry, 0.15, 0.03, WX - 0.54, 2.14, 0, 20);
    TW.label('SUMUR / CHRISTMAS TREE<small>150 bar &middot; kick s/d 200 bar</small>', new T.Vector3(WX, 3.5, 0), { group: 'eq' });
    /* flowline -> choke/PCV -> skid */
    B.tube(red, [[WX + 1.02, 2.14, 0], [-7.9, 2.14, 0], [-7.9, YL, 0], [-7.4, YL, 0]], 0.1, 0.3);
    var pcv = new T.Group(); pcv.position.set(-6.8, YL, 0); TW.add(pcv);
    var PB = new SK.Batch(), grn = MK.paint(0x2e7d4f, 0.5, 0.35);
    PB.sph(gry, 0.25, 0, 0, 0, 20, 1.1, 1, 0.9); SK.flangeAt(PB, gry, [-0.34, 0, 0], [1, 0, 0], 0.14); SK.flangeAt(PB, gry, [0.34, 0, 0], [1, 0, 0], 0.14);
    PB.cyl(gry, 0.12, 0.14, 0.2, 0, 0.3, 0, 0, 0, 0, 16); [-1, 1].forEach(function (sd) { PB.box(gry, 0.04, 0.34, 0.05, sd * 0.1, 0.56, 0); });
    PB.cyl(MK.steel(), 0.018, 0.018, 0.4, 0, 0.58, 0, 0, 0, 0, 8); PB.cyl(grn, 0.34, 0.3, 0.1, 0, 0.8, 0, 0, 0, 0, 32); PB.cyl(grn, 0.3, 0.34, 0.1, 0, 0.9, 0, 0, 0, 0, 32); PB.torus(MK.steel(), 0.34, 0.015, 0, 0.85, 0, Math.PI / 2, 0, 0, Math.PI * 2, 32);
    PB.box(MK.paint(0x5c6873, 0.45, 0.4), 0.18, 0.22, 0.14, 0.2, 0.5, 0.12); PB.tube(MK.ssPol(), [[0.2, 0.62, 0.12], [0.2, 0.8, 0.12], [0.12, 0.92, 0.1]], 0.006, 0.04);
    PB.build(pcv);
    scn.pcvLbl = TW.label('PCV-101', pcv, { off: [0, 1.35, 0], group: 'eq' });
    /* ---- skid HIPPS: rangka W200, deck grating, lifting lug, drip */
    var sx0 = -5.8, sx1 = 3.0, sw = 1.05;
    [-1, 1].forEach(function (sd) { B.beam(st, [sx0, 0.22, sd * sw], [sx1, 0.22, sd * sw], 'W200'); for (var lx = 0; lx < 2; lx++) { var xx = lx ? sx1 - 0.2 : sx0 + 0.2; B.box(MK.yellow(), 0.14, 0.2, 0.03, xx, 0.42, sd * (sw + 0.12)); B.torus(MK.yellow(), 0.045, 0.012, xx, 0.48, sd * (sw + 0.12), 0, 0, 0, Math.PI * 2, 12); } });
    for (var cx = sx0; cx <= sx1 + 0.01; cx += (sx1 - sx0) / 7) B.beam(st, [cx, 0.22, -sw], [cx, 0.22, sw], 'C150', [0, 1, 0]);
    var dg = new T.PlaneGeometry(sx1 - sx0, sw * 2); SK.scaleUV(dg, (sx1 - sx0) / 0.5, sw * 4); B.geo(MK.grating(), dg, SK.M4((sx0 + sx1) / 2, SKID, 0, -Math.PI / 2));
    SK.handrail(B, [[[sx0, SKID, -sw], [sx1, SKID, -sw]]], { h: 1.0 });
    TW.label('SKID HIPPS &middot; SIL 3', new T.Vector3((sx0 + sx1) / 2, 0.55, -sw - 0.3), { group: 'eq', maxD: 20 });
    /* pipa proses (fluida terlihat) */
    mUp = TW.shellize(new T.MeshStandardMaterial({ color: 0xa4553b, map: SK.tex.grime(), metalness: 0.5, roughness: 0.45 }));
    mDown = TW.shellize(new T.MeshStandardMaterial({ color: 0x9fb0c0, map: SK.tex.grime(), metalness: 0.5, roughness: 0.45 })); TW.shellDouble(mDown);
    mBody = TW.shellize(new T.MeshStandardMaterial({ color: 0x6f7b85, map: SK.tex.grime(), metalness: 0.6, roughness: 0.4 }));
    mCan = TW.shellize(new T.MeshStandardMaterial({ color: 0x2f3a44, metalness: 0.45, roughness: 0.45 })); TW.shellDouble(mCan);
    pipes.up = TW.pipe([[-7.4, YL, 0], [-7.15, YL, 0]], 0.14, { mat: mUp }); pipes.up2 = TW.pipe([[-6.46, YL, 0], [XA - 0.46, YL, 0]], 0.14, { mat: mUp });
    pipes.spool = TW.pipe([[XA + 0.46, YL, 0], [XB - 0.46, YL, 0]], 0.14, { mat: mUp });
    pipes.down = TW.pipe([[XB + 0.46, YL, 0], [7.6, YL, 0]], 0.12, { mat: mDown });
    Object.keys(pipes).forEach(function (k) { TW.add(pipes[k].group); });
    [pipes.up, pipes.up2, pipes.spool].forEach(function (p) { p.setFluid(0xff6a3a, 0.5); });
    XV = [buildValve(XA, 'XV-101A', 0), buildValve(XB, 'XV-101B', 1)];
    PT = [buildPT(0), buildPT(1), buildPT(2)];
    SK.flangeAt(B, gry, [-6.46, YL, 0], [1, 0, 0], 0.14); SK.flangeAt(B, gry, [-7.15, YL, 0], [1, 0, 0], 0.14);
    SK.flangeAt(B, gry, [0.0, YL, 0], [1, 0, 0], 0.12); SK.flangeAt(B, gry, [3.05, YL, 0], [1, 0, 0], 0.12);
    [-5.3, -3.3, -1.0, 1.2, 2.6].forEach(function (x) { B.box(st, 0.16, YL - 0.14 - SKID, 0.16, x, SKID + (YL - 0.14 - SKID) / 2, 0); B.box(st, 0.3, 0.02, 0.3, x, YL - 0.14, 0); B.torus(MK.galv(), 0.15, 0.01, x, YL, 0, 0, Math.PI / 2, 0, Math.PI, 20); });
    [4.6, 6.4].forEach(function (x) { B.box(MK.concrete(), 0.5, 0.4, 0.8, x, 0.2, 0); B.box(st, 0.14, YL - 0.13 - 0.4, 0.14, x, 0.4 + (YL - 0.53) / 2, 0); B.box(st, 0.28, 0.02, 0.3, x, YL - 0.13, 0); });
    /* spool: vent + drain + gauge */
    var spx = (XA + XB) / 2;
    B.rod(gry, [spx, YL + 0.14, 0], [spx, YL + 0.35, 0], 0.03, 10); SK.ballValve(B, [spx, YL + 0.42, 0], 'y', 0.03, { lever: true, mat: gry });
    B.rod(gry, [spx + 0.3, YL - 0.14, 0], [spx + 0.3, YL - 0.35, 0], 0.025, 10); SK.ballValve(B, [spx + 0.3, YL - 0.42, 0], 'y', 0.025, { lever: true, mat: gry });
    B.rod(MK.ssPol(), [spx - 0.3, YL + 0.14, 0], [spx - 0.3, YL + 0.3, 0], 0.012, 8); B.cylZ(MK.ssPol(), 0.07, 0.04, spx - 0.3, YL + 0.38, 0.0, 24); B.cylZ(MK.paint(0xf4f4f0, 0.4, 0), 0.06, 0.005, spx - 0.3, YL + 0.38, 0.022, 24);
    scn.spoolLbl = TW.label('spool (uji / vent)', new T.Vector3(spx, YL + 0.75, 0), { group: 'eq', maxD: 16 });
    /* ---- rak transmitter 2oo3 + tubing */
    [-0.05, 2.45].forEach(function (x) { B.box(st, 0.08, PTY - SKID - 0.04, 0.08, x, SKID + (PTY - SKID - 0.04) / 2, PTZ - 0.12); B.box(st, 0.25, 0.02, 0.25, x, SKID + 0.01, PTZ - 0.12); });
    B.beam(st, [-0.1, PTY - 0.08, PTZ - 0.12], [2.5, PTY - 0.08, PTZ - 0.12], 'C100', [0, 1, 0]);
    PTX.forEach(function (x) {
      B.box(MK.galv(), 0.12, 0.02, 0.2, x, PTY - 0.02, PTZ - 0.04);
      B.rod(gry, [x, YL + 0.14, 0], [x, YL + 0.3, 0], 0.02, 10); SK.ballValve(B, [x, YL + 0.36, 0], 'y', 0.02, { lever: true, mat: MK.ss() });
      B.tube(MK.ssPol(), [[x, YL + 0.42, 0], [x, YL + 0.55, 0], [x - 0.13, YL + 0.55, 0], [x - 0.13, YL + 0.55, PTZ], [x - 0.13, PTY + 0.035, PTZ]], 0.006, 0.05);
    });
    TW.label('BAGIAN HULU &middot; rating 150 bar', new T.Vector3(-6.0, YL + 0.9, 0), { cls: 'warn', group: 'eq' });
    scn.pdLbl = TW.label('P hilir', new T.Vector3(4.0, YL + 0.5, 0), { cls: 'ok', group: 'tag' });
    TW.label('BAGIAN HILIR &middot; desain 60 bar (MAWP)', new T.Vector3(5.4, YL + 1.0, 0), { cls: 'warn', group: 'eq' });
    SK.sign(3.9, 0.8, 0.45, 0, 1.2, 0.6, function (g, w, h) { g.fillStyle = '#f2c500'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#111'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.fillText('MAWP 60 bar', w / 2, h * 0.47); g.font = 'bold 40px sans-serif'; g.fillText('HIPPS SIL 3 · 2oo3', w / 2, h * 0.82); }, true);
    /* HPU (unit hidrolik lokal) */
    B.box(MK.paint(0x8a939a, 0.45, 0.4), 0.9, 1.1, 0.5, -3.3, SKID + 0.55, -0.75); B.box(MK.paint(0x7b848b, 0.45, 0.4), 0.92, 1.0, 0.02, -3.3, SKID + 0.58, -0.49);
    [-0.2, 0.2].forEach(function (dx) { B.cylZ(MK.ssPol(), 0.07, 0.04, -3.3 + dx, SKID + 0.85, -0.47, 24); B.cylZ(MK.paint(0xf4f4f0, 0.4, 0), 0.06, 0.005, -3.3 + dx, SKID + 0.85, -0.45, 24); });
    B.box(MK.paint(0x1f6fb5, 0.4, 0.3), 0.3, 0.3, 0.3, -3.3, SKID + 1.25, -0.8);
    TW.label('HPU hidrolik', new T.Vector3(-3.3, SKID + 1.6, -0.75), { group: 'eq', maxD: 12 });
    SK.jb(B, 2.75, SKID + 0.7, -0.75, 0, { w: 0.4, h: 0.4, d: 0.2 });
    SK.cableTray(B, [[2.75, SKID + 1.1, -0.9], [2.75, 2.7, -0.9], [2.75, 2.7, CAB.z - 0.1], [1.4, 2.7, CAB.z - 0.1], [1.4, 2.3, CAB.z - 0.1]], { w: 0.3, cables: 4 });
    /* ---- hilir: separator V-102, PSV, flare */
    B.tube(mDown, [[7.6, YL, 0], [8.0, YL, 0], [8.0, 1.65, 0], [8.4, 1.65, 0]], 0.12, 0.25);
    SK.hVessel(B, { c: [10.3, 1.65, 0], R: 0.95, L: 3.0, ground: 0.1, nozzles: [{ p: [0.8, 0.9, 0], r: 0.08 }, { p: [-0.6, -0.9, 0], d: [0, -1, 0], r: 0.06, len: 0.2 }] });
    scn.sep = new T.Object3D(); scn.sep.position.set(10.3, 1.65, 0); TW.add(scn.sep); TW.label('V-102 &middot; separator', scn.sep, { off: [0, 1.5, 0], group: 'eq' });
    B.rod(mDown, [6.0, YL + 0.12, 0], [6.0, 2.3, 0], 0.07, 14); SK.flangeAt(B, gry, [6.0, 2.32, 0], [0, 1, 0], 0.07);
    var psv = new T.Group(); psv.position.set(6.0, 2.36, 0); TW.add(psv);
    var SB = new SK.Batch(); SB.cyl(MK.paint(0x1f5fa8, 0.45, 0.3), 0.1, 0.12, 0.22, 0, 0.11, 0, 0, 0, 0, 18); SB.cyl(MK.paint(0xc0392b, 0.45, 0.25), 0.07, 0.09, 0.32, 0, 0.38, 0, 0, 0, 0, 16); SB.cyl(MK.dark(), 0.04, 0.04, 0.08, 0, 0.58, 0, 0, 0, 0, 10);
    SB.cylZ(MK.paint(0x1f5fa8, 0.45, 0.3), 0.08, 0.2, 0, 0.12, -0.15, 16); SK.flangeAt(SB, MK.paint(0x1f5fa8, 0.45, 0.3), [0, 0.12, -0.27], [0, 0, 1], 0.08); SB.build(psv);
    scn.psvLamp = put(psv, new T.Mesh(new T.SphereGeometry(0.035, 10, 8), LED(0x1aff7a)), 0.12, 0.3, 0);
    scn.psvLbl = TW.label('PSV 60 bar', psv, { off: [0, 0.95, 0], group: 'eq' });
    var FX = 15.5, FZ = -7;
    B.tube(gry, [[6.0, 2.48, -0.31], [6.0, 2.48, -2.6], [13.0, 2.48, -2.6], [13.0, 2.48, FZ], [FX - 0.6, 2.48, FZ]], 0.08, 0.3);
    [8, 11, 13].forEach(function (x) { B.box(st, 0.12, 2.3, 0.12, x, 1.25, -2.6); B.box(MK.concrete(), 0.35, 0.2, 0.35, x, 0.1, -2.6); });
    B.box(MK.concrete(), 1.4, 0.4, 1.4, FX, 0.2, FZ); B.cyl(MK.paint(0x8a8f93, 0.6, 0.4), 0.2, 0.3, 14, FX, 7.4, FZ, 0, 0, 0, 14); B.cyl(MK.dark(), 0.26, 0.22, 0.6, FX, 14.7, FZ, 0, 0, 0, 14);
    SK.ladder(B, { x: FX, z: FZ + 0.35, y0: 0.4, y1: 12.5, ry: Math.PI, mat: MK.galv() });
    [0, 2.1, 4.2].forEach(function (a) { B.rod(MK.steel(), [FX, 10, FZ], [FX + Math.cos(a) * 8, 0.05, FZ + Math.sin(a) * 8], 0.01, 4); });
    flare = TW.fx.fire([FX, 15.2, FZ], { size: 0.7, rate: 45, speed: 1.8, spread: 0.25, smoke: 0.15, light: false }); flare.k = 0.0;
    TW.label('flare', new T.Vector3(FX, 16.6, FZ), { group: 'eq', maxD: 60 });
    rupFire = TW.fx.fire([RUP.x, RUP.y, RUP.z], { size: 1.3, rate: 130, speed: 3.0, spread: 0.5, smoke: 0.4 });
    /* ---- shelter LER + kabinet SIS */
    var lw = 3.4, ld = 2.6, lh = 3.0, lx = CAB.x, lz = CAB.z + 0.3;
    var wmat = new T.MeshStandardMaterial({ map: SK.tex.ribPanel('#d9d6cf'), roughness: 0.75, metalness: 0.15 });
    var bw = new T.BoxGeometry(lw, lh, 0.1); SK.scaleUV(bw, lw / 3, 1); B.geo(wmat, bw, SK.M4(lx, 0.15 + lh / 2, lz - ld / 2));
    [-1, 1].forEach(function (sd) { var sg = new T.BoxGeometry(0.1, lh, ld); SK.scaleUV(sg, ld / 3, 1); B.geo(wmat, sg, SK.M4(lx + sd * lw / 2, 0.15 + lh / 2, lz)); });
    B.box(MK.paint(0x8f8a80, 0.7, 0.1), lw + 0.5, 0.15, ld + 0.6, lx, 0.15 + lh + 0.07, lz + 0.1);
    B.box(MK.paint(0xdfe2e0, 0.5, 0.1), 0.85, 0.6, 0.32, lx + lw / 2 + 0.2, 1.4, lz); B.cylX(MK.dark(), 0.22, 0.02, lx + lw / 2 + 0.37, 1.4, lz, 24);
    B.box(MK.lamp(), 1.2, 0.03, 0.2, lx, 0.15 + lh - 0.05, lz);
    SK.sign(lx, 0.15 + lh + 0.4, lz + ld / 2 + 0.36, 0, 2.4, 0.4, function (g, w, h) { g.fillStyle = '#0d3b66'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.fillText('LER · SIS HIPPS', w / 2, h * 0.7); });
    var cb = cab = new T.Group(); cb.position.set(CAB.x, 0.15, CAB.z); TW.add(cb);
    var CBt = new SK.Batch(), cg2 = MK.paint(0xc9ccc9, 0.5, 0.2);
    CBt.box(cg2, 1.9, 2.0, 0.8, 0, 1.0, 0); CBt.box(MK.paint(0x2a2d30, 0.6, 0.2), 1.94, 0.1, 0.84, 0, 0.05, 0); CBt.box(cg2, 1.94, 0.05, 0.84, 0, 2.03, 0);
    CBt.box(MK.dark(), 0.01, 1.9, 0.02, 0, 1.0, 0.41);
    for (var r2 = 0; r2 < 3; r2++) for (var c2 = 0; c2 < 7; c2++) CBt.box(MK.paint(r2 === 0 ? 0xd8392b : 0x3a4a5a, 0.4, 0.3), 0.08, 0.16, 0.06, 0.2 + c2 * 0.1, 0.35 + r2 * 0.28, 0.4);
    CBt.box(MK.glass(), 0.86, 0.9, 0.01, 0.48, 0.62, 0.42);
    CBt.build(cb);
    sisCv = document.createElement('canvas'); sisCv.width = 512; sisCv.height = 384; sisTex = new T.CanvasTexture(sisCv); sisTex.encoding = T.sRGBEncoding;
    put(cb, new T.Mesh(new T.PlaneGeometry(0.82, 0.62), new T.MeshBasicMaterial({ map: sisTex, toneMapped: false })), -0.48, 1.45, 0.405);
    scn.leds = []; for (var k = 0; k < 7; k++) { var lm = LED(0x1aff7a); scn.leds.push(lm); put(cb, new T.Mesh(new T.SphereGeometry(0.022, 10, 8), lm), -0.8 + k * 0.11, 1.03, 0.41); }
    TW.label('SIS &middot; LOGIC SOLVER SIL 3<small>TMR</small>', cb, { off: [0, 2.35, 0], group: 'eq' });
    /* pekerja & lampu */
    SK.human(B, -0.9, 1.75, 3.9, { suit: 0xd9531e, hat: 0xf5f5f0, pose: 'point' });
    SK.human(B, 0.0, -3.0, 2.39, { suit: 0x1f4e8c, hat: 0xf2c200, pose: 'tablet' });
    SK.lightPole(B, -6.8, 3.2, 8, 0.4); SK.lightPole(B, 8.2, 3.0, 8, 2.6);
    B.build();
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
      var pz = TW.lerp(0.3, 0.86, op); V.piston.position.z = pz; V.spring.scale.z = Math.max(0.05, 1.13 - pz - 0.02);
      V.rod.scale.y = pz + 0.6; V.rod.position.set(0, 0.8, (pz - 0.6) / 2);
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
    if (S.ruptured) pipes.down.group.visible = true;
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
      { name: 'OVERVIEW', pos: [1.5, 7.2, 19.5], tgt: [0.8, 1.2, 0] },
      { name: 'VALVE HIPPS', pos: [-1.6, 2.7, 4.6], tgt: [-3.3, 1.55, 0.3] },
      { name: 'PT 2oo3', pos: [2.4, 2.1, 2.7], tgt: [1.2, 1.55, 0.6] },
      { name: 'KABINET SIS', pos: [2.3, 2.0, -0.4], tgt: [1.3, 1.35, -4.4] },
      { name: 'SUMUR &middot; PCV', pos: [-5.6, 3.6, 6.4], tgt: [-8.2, 1.7, 0] },
      { name: 'HILIR &middot; PSV', pos: [8.6, 4.4, 9.2], tgt: [7.5, 1.9, -0.5] }
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
    panelA += dt; if (panelA > 0.25) { panelA = 0; drawSisPanel(); PT.forEach(function (p, i) { var f = FLT.pt[i]; p.setLCD(S.rd[i].toFixed(1), f !== 'ok' ? 'FAULT' : 'bar', f !== 'ok' ? '#d9b36a' : (S.votes[i] ? '#e5a3a3' : '#a9c7a6')); }); }
    if (S.ruptured) $('redalert').style.opacity = 0.5 + 0.35 * Math.sin(TW.time() * 6);
  }

  HP.start = function () {
    TW.init({ bg: 0xcfdde8, sky: { sunDir: [0.4, 0.85, 0.6], cloud: 0.5 }, sunDir: [0.4, 0.85, 0.6], fog: { color: 0xcfdde8, near: 60, far: 430 }, cam: [1.5, 7.2, 19.5], target: [0.8, 1.2, 0], shadowSize: 15, shadowCenter: [1, 0, 0], exposure: 1.0, maxDist: 80 });
    buildPlant(); resetState();
    chart = new TW.Chart($('trend-canvas'), { series: [{ name: 'P hilir bar', color: '#5cf0ff', min: 0, max: 100 }], span: 60, legend: true, fmt: function (v) { return v.toFixed(0); }, refs: [] });
    chart.o.refs = [{ v: 40, s: 0, color: '#29e08a', label: 'normal 40' }, { v: 48, s: 0, color: '#ffb020', label: 'setpoint' }, { v: MAWP, s: 0, color: '#ff8a3d', label: 'MAWP 60' }, { v: RUPT, s: 0, color: '#ff3d4d', label: 'pecah 90' }];
    wireUI(); renderSIL(); renderTT(); renderInfo(); scnNote();
    TW.ics({ title: '3D TWIN · INSTRUMENT SAFETY SIL &amp; HIPPS 2oo3', extra: 'Perhitungan PFD/SIL memakai persamaan sederhana dan laju kegagalan tipikal; verifikasi SIL nyata wajib memakai data sertifikat (FMEDA) dan IEC 61508/61511.' });
    var lastSp = null; TW.onUpdate(function (dt) { if (lastSp !== CFG.sp) { lastSp = CFG.sp; chart.o.refs[1].v = CFG.sp; } frame(dt); });
    TW.start();
  };
  HP.S = function () { return S; }; HP.CFG = CFG; HP.FLT = FLT; HP.calc = calcSIL;
  HP.api = { frame: frame, trigger: triggerDisturbance, reset: function () { resetState(true); }, step: step };
  return HP;
})();
