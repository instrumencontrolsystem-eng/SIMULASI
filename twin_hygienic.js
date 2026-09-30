/* ICS Cademy — 3D Twin Instrument Hygienic & CIP (food / farmasi)
   Ganti instrument (hygienic / semi / non-hygienic) -> jalankan CIP -> lihat residu tersisa -> kontaminasi Batch B.
   Model residu: dR/dt = -k(langkah, T, konsentrasi, kecepatan) x X(geometri) x R ; X = aksesibilitas aliran CIP ke titik tsb.
   Semua angka = ilustrasi bahan ajar, bukan data validasi. */
var HY = (function () {
  'use strict';
  var T = THREE, M = TW.M, $ = TW.$;
  var HY = {};

  /* ---------------------------------------------------------- konstanta */
  var RO = 0.055, RI = 0.047;                       // radius pipa luar / dalam (m) — diperbesar agar detail terlihat
  var COL = { water: 0x4db8ff, caustic: 0xffc233, acid: 0xc46bff, hot: 0xff8f6b, A: 0xe0552b, B: 0xe9f4ff, mineral: 0xd8d2c4, microbe: 0x7dff5a };
  var LIM = { atp: 150, cond: 0.6, cfu: 100, ppm: 0.5 };
  var BATCH_ML = 1.5e6, BATCH_KG = 1500, SHED = 2e-4, LEACH = 0.35;
  var idc = function (n, d) { return TW.fmt(n, d).replace('.', ','); };

  /* material */
  var MK = SK.mat;
  var mSteel = M.shell(0xc9d1d8, 0.95, 0.25);
  var mPipe = M.shell(0xd7dde2, 0.95, 0.2);
  var mSteelS = MK.ss(), mPolS = MK.ssPol(), mClamp = MK.ss();
  var mBlue = MK.paint(0x1f5f9a, 0.42, 0.35), mGlass = MK.glass();
  var mDark = MK.dark(), mBolt = MK.steel();
  var mTankShell = TW.shellDouble(M.shell(0xd3dae0, 0.95, 0.3));
  var HEADSTYLE = 'H';
  var lcdMat = null;
  function getLcdMat() {
    if (lcdMat) return lcdMat;
    var t = TW.canvasTex(128, 64, function (g, w, h) { g.fillStyle = '#9fc4a8'; g.fillRect(0, 0, w, h); g.fillStyle = '#0f1a12'; g.font = 'bold 30px monospace'; g.textAlign = 'center'; g.fillText('1.52', w / 2, 40); g.font = '12px monospace'; g.fillText('bar', w / 2, 58); });
    lcdMat = new T.MeshBasicMaterial({ map: t, toneMapped: false }); return lcdMat;
  }

  /* ------------------------------------------------------ helper geometri */
  function cylX(r, h, mat, seg) { var m = TW.cyl(r, r, h, mat, seg || 28); m.rotation.z = Math.PI / 2; return m; }
  function cylZ(r, h, mat, seg) { var m = TW.cyl(r, r, h, mat, seg || 28); m.rotation.x = Math.PI / 2; return m; }
  function put(g, m, x, y, z) { m.position.set(x, y, z); g.add(m); return m; }
  function soilMat() { return new T.MeshStandardMaterial({ color: COL.A, transparent: true, opacity: 0.9, roughness: 0.9, metalness: 0, emissive: 0x2a0c04, depthWrite: false, side: T.DoubleSide }); }
  function ringMesh(r0, r1) { var m = new T.Mesh(new T.RingGeometry(r0, r1, 32), soilMat()); return m; }
  function tor(R, r, rotAxis) { var m = new T.Mesh(new T.TorusGeometry(R, r, 8, 30), soilMat()); if (rotAxis === 'x') m.rotation.x = Math.PI / 2; if (rotAxis === 'y') m.rotation.y = Math.PI / 2; return m; }
  function openCyl(r, h, axis) { var m = new T.Mesh(new T.CylinderGeometry(r, r, h, 20, 1, true), soilMat()); if (axis === 'z') m.rotation.x = Math.PI / 2; if (axis === 'x') m.rotation.z = Math.PI / 2; return m; }
  function fillCyl(r, h, axis) { var m = new T.Mesh(new T.CylinderGeometry(r, r, h, 20), soilMat()); if (axis === 'z') m.rotation.x = Math.PI / 2; if (axis === 'x') m.rotation.z = Math.PI / 2; return m; }

  function addZone(ctx, name, X, mass, atpW, meshes, o) {
    var z = { slot: ctx.slot, name: name, X: X, mass: mass, atpW: atpW, meshes: meshes, Ro: 1, Rm: 1, logM: 5, chem: 0, mat: null, main: !!(o && o.main), dots: null };
    z.mat = meshes[0].material;
    meshes.forEach(function (m) { m.material = z.mat; m.renderOrder = 4; });
    ctx.zones.push(z); return z;
  }
  function addDots(z, parent) {
    var m0 = z.meshes[0]; m0.geometry.computeBoundingBox(); var bb = m0.geometry.boundingBox; m0.updateMatrix();
    var n = Math.round(Math.min(70, 16 + z.mass / 90)), pos = new Float32Array(n * 3), v = new T.Vector3();
    for (var i = 0; i < n; i++) {
      v.set(TW.lerp(bb.min.x, bb.max.x, Math.random()), TW.lerp(bb.min.y, bb.max.y, Math.random()), TW.lerp(bb.min.z, bb.max.z, Math.random()));
      if (bb.max.z - bb.min.z < 1e-4) v.z = 0.0015; if (bb.max.y - bb.min.y < 1e-4) v.y = 0.0015;
      v.applyMatrix4(m0.matrix); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setDrawRange(0, 0);
    z.dots = new T.Points(g, new T.PointsMaterial({ color: 0x35d84a, size: 0.011, transparent: true, opacity: 1, depthWrite: false }));
    z.dots.renderOrder = 5; z.dots.userData.n = n; parent.add(z.dots);
  }

  /* klem tri-clamp (ferrule + cincin klem) */
  function clampV(g, y, r) {
    put(g, TW.cyl(r, r, 0.012, mSteelS, 32), 0, y, 0);
    put(g, TW.cyl(r * 1.3, r * 1.3, 0.02, mClamp, 32), 0, y + 0.012, 0);
    put(g, TW.box(0.03, 0.03, 0.02, mClamp), r * 1.45, y + 0.012, 0);
  }
  function clampZ(g, z, r) {
    put(g, cylZ(r, 0.012, mSteelS, 32), 0, 0, z);
    put(g, cylZ(r * 1.3, 0.02, mClamp, 32), 0, 0, z + 0.012);
    put(g, TW.box(0.03, 0.02, 0.03, mClamp), 0, r * 1.45, z + 0.012);
  }
  /* kepala transmitter: stainless higienis (H/M) atau aluminium bercat industri (N); dibangun tegak (+Y) */
  function headGroup(neck) {
    var h = new T.Group(), ind = HEADSTYLE === 'N';
    h.add(TW.at(TW.cyl(0.018, 0.02, neck, mPolS, 20), 0, neck / 2, 0));
    if (!ind) {
      h.add(TW.at(TW.cyl(0.043, 0.04, 0.075, mPolS, 32), 0, neck + 0.0375, 0));
      h.add(TW.at(TW.cyl(0.046, 0.046, 0.016, mPolS, 32), 0, neck + 0.083, 0));
      var gl = TW.at(TW.cyl(0.036, 0.036, 0.004, mGlass, 28), 0, neck + 0.092, 0); h.add(gl);
      var lcd = new T.Mesh(new T.CircleGeometry(0.03, 24), getLcdMat()); lcd.rotation.x = -Math.PI / 2; lcd.position.set(0, neck + 0.0915, 0); h.add(lcd);
      var m12 = TW.cyl(0.009, 0.009, 0.035, mPolS, 12); m12.rotation.z = Math.PI / 2; m12.position.set(0.058, neck + 0.03, 0); h.add(m12);
      var nut = TW.cyl(0.012, 0.012, 0.014, mSteelS, 6); nut.rotation.z = Math.PI / 2; nut.position.set(0.079, neck + 0.03, 0); h.add(nut);
      var cab = TW.rod([0.086, neck + 0.03, 0], [0.13, neck + 0.02, 0], 0.006, MK.paint(0x6b6f73, 0.6, 0.1), 8); h.add(cab);
    } else {
      var body = TW.cyl(0.045, 0.045, 0.11, mBlue, 28); body.rotation.z = Math.PI / 2; body.position.set(0, neck + 0.05, 0); h.add(body);
      [-1, 1].forEach(function (sd) { var c = TW.cyl(0.05, 0.05, 0.022, mBlue, 28); c.rotation.z = Math.PI / 2; c.position.set(sd * 0.066, neck + 0.05, 0); h.add(c); });
      var w = TW.cyl(0.034, 0.034, 0.003, mGlass, 24); w.rotation.z = Math.PI / 2; w.position.set(0.078, neck + 0.05, 0); h.add(w);
      var l2 = new T.Mesh(new T.CircleGeometry(0.028, 24), getLcdMat()); l2.rotation.y = Math.PI / 2; l2.position.set(0.0775, neck + 0.05, 0); h.add(l2);
      var gd = TW.cyl(0.013, 0.013, 0.035, MK.paint(0x2a2a2a, 0.5, 0.2), 6); gd.position.set(-0.03, neck + 0.0, 0.035); gd.rotation.x = Math.PI / 2; h.add(gd);
    }
    return h;
  }
  function headV(g, y, neck) { var h = headGroup(neck || 0.09); h.position.y = y; g.add(h); }
  function headZ(g, z, len) { var h = headGroup(len || 0.16); h.rotation.x = Math.PI / 2; h.position.z = z; g.add(h); }
  function hexV(g, y, r) { var m = TW.cyl(r, r, 0.02, mSteelS, 6); return put(g, m, 0, y, 0); }

  /* ---------------------------------------------- pembangun tiap instrumen */
  function buildPT(v, g, ctx) {
    var y0 = RI, m;
    if (v === 0) {                                   // FLUSH tri-clamp
      put(g, TW.cyl(0.032, 0.032, 0.03, mSteel, 28), 0, y0 + 0.012, 0);
      put(g, TW.cyl(0.024, 0.024, 0.004, mPolS, 28), 0, y0 - 0.001, 0);
      clampV(g, y0 + 0.03, 0.038); headV(g, y0 + 0.05, 0.08);
      m = ringMesh(0.0245, 0.031); m.rotation.x = -Math.PI / 2; put(g, m, 0, y0 + 0.0015, 0);
      addZone(ctx, 'Tepi membran flush (film tipis)', 0.9, 30, 0.6, [m], { main: true });
    } else if (v === 1) {                            // recessed
      put(g, TW.cyl(0.034, 0.034, 0.05, mSteel, 28), 0, y0 + 0.025, 0);
      put(g, TW.cyl(0.026, 0.026, 0.004, mPolS, 28), 0, y0 + 0.024, 0);
      clampV(g, y0 + 0.052, 0.04); headV(g, y0 + 0.072, 0.08);
      m = fillCyl(0.026, 0.022, 'y'); put(g, m, 0, y0 + 0.011, 0);
      addZone(ctx, 'Rongga di depan membran (recessed)', 0.35, 350, 1.0, [m], { main: true });
    } else {                                         // ulir G1/2 + port berongga
      put(g, TW.cyl(0.03, 0.03, 0.07, mSteel, 28), 0, y0 + 0.035, 0);
      for (var i = 0; i < 5; i++) put(g, TW.torus(0.0305, 0.0022, mBolt).rotateX(Math.PI / 2), 0, y0 + 0.012 + i * 0.011, 0);
      hexV(g, y0 + 0.08, 0.034); headV(g, y0 + 0.09, 0.06);
      var port = fillCyl(0.008, 0.05, 'y'); put(g, port, 0, y0 + 0.025, 0);
      var ch = new T.Mesh(new T.SphereGeometry(0.018, 14, 10), null); put(g, ch, 0, y0 + 0.062, 0);
      var th = openCyl(0.026, 0.05, 'y'); put(g, th, 0, y0 + 0.032, 0);
      addZone(ctx, 'Port tekanan buntu + ruang sensor', 0.04, 700, 1.4, [port, ch], { main: true });
      addZone(ctx, 'Celah ulir G½"', 0.03, 250, 1.0, [th]);
    }
  }
  function buildTT(v, g, ctx) {
    var m;
    if (v === 0) {                                   // RTD higienis miring 45°, ujung menghadap aliran
      var t = new T.Group(); t.rotation.z = -Math.PI / 4; g.add(t);
      put(t, TW.cyl(0.03, 0.03, 0.045, mSteel, 24), 0, RI + 0.008, 0);
      put(t, TW.cyl(0.0085, 0.0085, RI + 0.05, mPolS, 16), 0, (RI + 0.05) / 2, 0);
      put(t, TW.sph(0.0085, mPolS, 12), 0, 0, 0);
      clampV(t, RI + 0.036, 0.034); headV(t, RI + 0.056, 0.05);
      m = fillCyl(0.0098, 0.03, 'y'); put(t, m, 0, 0.012, 0);
      addZone(ctx, 'Ujung thermowell (menghadap aliran)', 1.0, 15, 0.4, [m], { main: true });
      var gk = tor(0.03, 0.003, 'x'); put(t, gk, 0, RI + 0.036, 0);
      addZone(ctx, 'Gasket tri-clamp (rata)', 0.85, 20, 0.5, [gk]);
      t.updateMatrix();
    } else if (v === 1) {                            // dead-leg L/D ~ 3
      put(g, TW.cyl(0.033, 0.033, 0.18, mSteel, 24), 0, RI + 0.09, 0);
      put(g, TW.cyl(0.010, 0.010, RI + 0.19, mSteelS, 16), 0, (RI + 0.19) / 2, 0);
      clampV(g, RI + 0.18, 0.038); headV(g, RI + 0.2, 0.06);
      m = fillCyl(0.029, 0.178, 'y'); put(g, m, 0, RI + 0.09, 0);
      addZone(ctx, 'Dead-leg tee (L/D ≈ 3)', 0.35, 1100, 1.3, [m], { main: true });
    } else {                                         // NPT 1/2 thermowell berulir
      put(g, TW.cyl(0.026, 0.026, 0.075, mSteel, 24), 0, RI + 0.0375, 0);
      for (var i = 0; i < 5; i++) put(g, TW.torus(0.0262, 0.002, mBolt).rotateX(Math.PI / 2), 0, RI + 0.01 + i * 0.012, 0);
      put(g, TW.cyl(0.011, 0.011, RI + 0.1, mSteelS, 16), 0, (RI + 0.1) / 2, 0);
      hexV(g, RI + 0.085, 0.03); headV(g, RI + 0.095, 0.05);
      var an = fillCyl(0.019, 0.07, 'y'); put(g, an, 0, RI + 0.035, 0);
      var th = openCyl(0.0225, 0.05, 'y'); put(g, th, 0, RI + 0.04, 0);
      addZone(ctx, 'Celah annular thermowell-bung', 0.04, 450, 1.2, [an], { main: true });
      addZone(ctx, 'Celah ulir NPT ½"', 0.03, 300, 1.0, [th]);
    }
  }
  function buildFT(v, g, ctx) {
    var m, i;
    function coils() {
      var cm = HEADSTYLE === 'N' ? mBlue : mPolS;
      put(g, TW.box(0.22, 0.13, 0.05, cm), 0, 0, 0.098); put(g, TW.box(0.22, 0.13, 0.05, cm), 0, 0, -0.098);
      put(g, TW.cyl(0.02, 0.024, 0.05, mPolS, 16), 0, RO + 0.02, 0);
      put(g, TW.cyl(0.05, 0.05, 0.1, cm, 32), 0, RO + 0.09, 0); put(g, TW.cyl(0.053, 0.053, 0.016, cm, 32), 0, RO + 0.148, 0); put(g, TW.cyl(0.04, 0.04, 0.004, mGlass, 24), 0, RO + 0.158, 0);
      var fl = new T.Mesh(new T.CircleGeometry(0.034, 24), getLcdMat()); fl.rotation.x = -Math.PI / 2; fl.position.set(0, RO + 0.157, 0); g.add(fl);
    }
    if (v === 0) {                                   // magmeter PFA tri-clamp
      put(g, cylX(0.0575, 0.36, mSteel, 32), 0, 0, 0);
      [-1, 1].forEach(function (s) { put(g, cylX(0.072, 0.012, mSteelS, 32), s * 0.186, 0, 0); put(g, cylX(0.084, 0.024, mClamp, 32), s * 0.2, 0, 0); });
      coils();
      var a = tor(0.0478, 0.0032, 'y'), b = tor(0.0478, 0.0032, 'y'); put(g, a, -0.19, 0, 0); put(g, b, 0.19, 0, 0);
      addZone(ctx, 'Gasket tri-clamp rata bore (film)', 0.85, 50, 0.6, [a, b], { main: true });
    } else if (v === 1) {                            // DIN 11851 gasket berongga
      put(g, cylX(0.0575, 0.36, mSteel, 32), 0, 0, 0);
      [-1, 1].forEach(function (s) { put(g, cylX(0.088, 0.05, mClamp, 32), s * 0.205, 0, 0); });
      coils();
      var a1 = tor(0.0505, 0.0075, 'y'), b1 = tor(0.0505, 0.0075, 'y'); put(g, a1, -0.19, 0, 0); put(g, b1, 0.19, 0, 0);
      addZone(ctx, 'Celah gasket DIN 11851 (alur)', 0.35, 700, 1.2, [a1, b1], { main: true });
    } else {                                         // turbin flensa + O-ring pocket
      put(g, cylX(0.07, 0.30, mSteel, 32), 0, 0, 0);
      [-1, 1].forEach(function (s) {
        put(g, cylX(0.118, 0.022, mSteelS, 32), s * 0.165, 0, 0);
        for (var k = 0; k < 6; k++) { var an = k / 6 * Math.PI * 2; put(g, cylX(0.008, 0.07, mBolt, 10), s * 0.165, Math.cos(an) * 0.097, Math.sin(an) * 0.097); }
      });
      var a2 = tor(0.078, 0.011, 'y'), b2 = tor(0.078, 0.011, 'y'); put(g, a2, -0.15, 0, 0); put(g, b2, 0.15, 0, 0);
      var rc = fillCyl(0.043, 0.075, 'z'); put(g, rc, 0, 0.06, 0);
      var rot = new T.Group(); rot.position.set(0, 0.06, 0); g.add(rot); HY._rotors.push(rot);
      for (i = 0; i < 4; i++) { var bl = TW.box(0.07, 0.008, 0.06, mPolS); bl.rotation.z = i * Math.PI / 2; rot.add(bl); }
      put(g, TW.cyl(0.02, 0.02, 0.06, mSteelS, 20), 0, 0.14, 0); headV(g, 0.16, 0.03);
      addZone(ctx, 'Rumah rotor + bearing turbin', 0.04, 900, 1.5, [rc], { main: true });
      addZone(ctx, 'Kantong O-ring & gasket flensa', 0.05, 1200, 1.3, [a2, b2]);
    }
  }
  function buildLT(v, g, ctx) {
    var m;
    if (v === 0) {                                   // flush
      put(g, cylZ(0.05, 0.03, mSteel, 32), 0, 0, 0.015);
      put(g, cylZ(0.03, 0.004, mPolS, 28), 0, 0, 0.0);
      put(g, cylZ(0.03, 0.22, mSteelS, 24), 0, 0, 0.14);
      clampZ(g, 0.037, 0.058); headZ(g, 0.06 + 0.22, 0.06);
      m = ringMesh(0.031, 0.041); m.position.set(0, 0, 0.002); g.add(m);
      addZone(ctx, 'Tepi membran flush di dinding tangki', 0.9, 40, 0.6, [m], { main: true });
    } else if (v === 1) {                            // stub L/D ~ 3
      put(g, cylZ(0.05, 0.2, mSteel, 32), 0, 0, 0.1);
      put(g, cylZ(0.036, 0.004, mPolS, 28), 0, 0, 0.198);
      clampZ(g, 0.206, 0.058); put(g, cylZ(0.03, 0.16, mSteelS, 24), 0, 0, 0.30); headZ(g, 0.36, 0.06);
      m = fillCyl(0.046, 0.196, 'z'); put(g, m, 0, 0, 0.098);
      addZone(ctx, 'Nozzle stub (dead-leg L/D ≈ 3)', 0.35, 1800, 1.6, [m], { main: true });
    } else {                                         // stub ulir panjang
      put(g, cylZ(0.038, 0.4, mSteel, 32), 0, 0, 0.2);
      for (var i = 0; i < 4; i++) put(g, TW.torus(0.0385, 0.0025, mBolt), 0, 0, 0.335 + i * 0.012);
      put(g, cylZ(0.046, 0.02, mSteelS, 6), 0, 0, 0.41); put(g, cylZ(0.025, 0.08, mSteelS, 20), 0, 0, 0.46); headZ(g, 0.5, 0.05);
      var fillM = fillCyl(0.033, 0.396, 'z'); put(g, fillM, 0, 0, 0.198);
      var th = openCyl(0.031, 0.05, 'z'); put(g, th, 0, 0, 0.36);
      addZone(ctx, 'Nozzle stub ulir (dead-leg L/D ≈ 6)', 0.03, 5200, 2.0, [fillM], { main: true });
      addZone(ctx, 'Celah ulir NPT', 0.03, 250, 1.0, [th]);
    }
  }

  /* katalog instrumen: 3 varian per slot */
  var SLOTS = [
    {
      id: 'PT', tag: 'PT-101', title: 'Tekanan', mount: [0.3, 1.5, 0], build: buildPT, camView: 'PT',
      variants: [
        { cls: 'H', name: 'Diafragma FLUSH · tri-clamp 1½"', spec: '316L · Ra ≤ 0,8 µm · 3-A / EHEDG · EPDM/FKM FDA', why: 'Membran sejajar dinding pipa: tidak ada volume mati. Aliran CIP menyapu seluruh permukaan (gaya geser dinding), jadi kotoran terangkat sempurna.' },
        { cls: 'M', name: 'Tri-clamp, diafragma MENJOROK (recessed)', spec: 'Rongga ± 22 mm di depan membran', why: 'Ada rongga dangkal di depan membran. Aliran CIP hanya membuat pusaran pelan (eddy) di rongga: residu di sudut baru hilang bila CIP dibuat lebih lama/panas/cepat.' },
        { cls: 'N', name: 'Ulir G½" / ½"NPT + port tekanan berongga', spec: 'Port buntu Ø 8 mm + ruang sensor + ulir', why: 'Port buntu kecil = dead-leg; ulir = celah mikro. Cairan CIP nyaris tidak masuk (X ≈ 0,04): kotoran, mikroba, sisa kimia bertahan. Tidak diterima 3-A/EHEDG.' }
      ]
    },
    {
      id: 'TT', tag: 'TT-101', title: 'Suhu', mount: [1.6, 1.5, 0], build: buildTT, camView: 'TT',
      variants: [
        { cls: 'H', name: 'RTD higienis · tri-clamp, ujung menghadap aliran (45°)', spec: 'Thermowell pendek, poles · tanpa dead-leg', why: 'Dipasang miring pada pipa/elbow dengan ujung menghadap aliran: respons cepat dan seluruh permukaan tersapu aliran CIP. Tidak ada rongga yang tertinggal.' },
        { cls: 'M', name: 'Tee tri-clamp + thermowell panjang (dead-leg L/D ≈ 3)', spec: 'Stub vertikal ≈ 3× diameter', why: 'Stub vertikal menyisakan volume diam di atas pipa. Aturan praktis desain higienis: L/D ≤ 2 (ASME BPE), makin pendek makin baik. Stub L/D ≈ 3 hanya terbilas sebagian.' },
        { cls: 'N', name: 'Thermowell ulir ½"NPT pada bung las', spec: 'Celah ulir + celah annular · permukaan tidak dipoles', why: 'Dua sumber residu: celah ulir dan celah annular antara thermowell dan bung. Nyaris tidak tersentuh aliran CIP (X ≈ 0,03–0,04).' }
      ]
    },
    {
      id: 'FT', tag: 'FT-101', title: 'Aliran', mount: [2.75, 1.5, 0], build: buildFT, camView: 'FT',
      variants: [
        { cls: 'H', name: 'Magnetic flowmeter · lining PFA · tri-clamp', spec: 'Bore penuh = ID pipa · tanpa bagian bergerak', why: 'Bore rata dengan pipa, tanpa bagian bergerak dan gasket rata dengan bore. Aliran CIP menyapu bersih dan alat bisa mengering sendiri (self-draining) bila dipasang benar.' },
        { cls: 'M', name: 'Flowmeter sanitary · sambungan DIN 11851', spec: 'Gasket standar meninggalkan alur cincin', why: 'Sambungan susu DIN 11851 standar: gasket tidak rata dengan bore sehingga ada alur cincin yang menampung residu. Perlu gasket profil khusus / DIN 11864 agar lolos EHEDG.' },
        { cls: 'N', name: 'Turbin / paddlewheel · flensa + O-ring pocket', spec: 'Rotor, bearing, kantong gasket', why: 'Rotor, poros/bearing, dan kantong gasket flensa membentuk banyak sudut mati. Bagian bergerak sulit dibersihkan dan mudah menjadi sarang biofilm.' }
      ]
    },
    {
      id: 'LT', tag: 'LT-101', title: 'Level tangki', mount: [-3.2, 1.45, 0.95], build: buildLT, camView: 'LT',
      variants: [
        { cls: 'H', name: 'Level hidrostatik/radar FLUSH · tri-clamp', spec: 'Membran rata dengan dinding tangki', why: 'Membran rata dengan dinding tangki: tidak ada nozzle. Spray ball dan aliran film cairan CIP membilas seluruh permukaan.' },
        { cls: 'M', name: 'Nozzle stub + tri-clamp (dead-leg L/D ≈ 3)', spec: 'Stub Ø 90 mm × 200 mm', why: 'Sensor ada di ujung stub. Volume stub tidak ikut teraliri CIP dan hanya terbilas oleh percikan, sehingga residu produk tertahan.' },
        { cls: 'N', name: 'Stub ulir panjang (L/D ≈ 6) + NPT', spec: 'Stub Ø 76 mm × 400 mm + ulir', why: 'Dead-leg terburuk: stub panjang sempit + ulir. Produk mengendap dan tidak pernah terkena CIP secara efektif; mikroba berkembang biak saat jeda produksi.' }
      ]
    }
  ];
  var CLS = { H: { tag: 'HYGIENIC', cls: 'ok' }, M: { tag: 'SEMI (RAGU)', cls: 'warn' }, N: { tag: 'NON-HYGIENIC', cls: 'bad' } };

  /* -------------------------------------------------------------- state */
  var S = { tChart: 0, phase: 'SOILED', steps: [], i: 0, tStep: 0, tSim: 0, T: 20, Sc: 0.3, cond: 0.3, hold: 0, tB: 0, cfu: 0, mg: 0, contrib: {}, atp: null, verdict: null, finalCond: null, sel: 'LT' };
  var R = { Tc: 75, conc: 1.5, vel: 1.5, tCaus: 20, acid: true, sani: true, holdH: 8, speed: 240, auto: true };
  var zones = [], baseZone = null, slotState = {}, plant = {}, pipes = {}, films = {}, spray, shed, chart, rotors;
  HY._rotors = []; HY.S = S; HY.R = R; HY.zones = zones; HY.advance = function (x) { advance(x); }; HY.slotResidue = slotResidue;

  /* ----------------------------------------------------------- pemasangan */
  function installSlot(slot, vi) {
    var st = slotState[slot.id];
    if (st.group) { plant.root.remove(st.group); TW.dispose(st.group); st.labels.forEach(function (l) { l.remove(); }); }
    HY._rotors.length = 0;
    var g = new T.Group(); g.position.fromArray(slot.mount); plant.root.add(g);
    var ctx = { slot: slot.id, zones: [] };
    HEADSTYLE = slot.variants[vi].cls;
    slot.build(vi, g, ctx);
    g.updateMatrixWorld(true);
    ctx.zones.forEach(function (z) { addDots(z, g); });
    st.group = g; st.vi = vi; st.zones = ctx.zones; st.labels = [];
    TW.pickable(g, function () { select(slot.id); });
    var cls = CLS[slot.variants[vi].cls];
    var nm = TW.label(slot.tag, g, { off: slot.id === 'LT' ? [0, 0.18, 0.5] : (slot.id === 'FT' ? [0, 0.42, 0] : [0, 0.5, 0]), cls: cls.cls, group: 'tag' }); st.labels.push(nm); st.tagLbl = nm;
    var mz = ctx.zones.filter(function (z) { return z.main; })[0];
    st.resLbl = TW.label('', mz.meshes[0], { off: [0, 0.07, 0], cls: 'bad', group: 'res' }); st.labels.push(st.resLbl);
    // buang zona lama slot ini dari daftar global lalu tambahkan zona baru
    for (var k = zones.length - 1; k >= 0; k--) if (zones[k].slot === slot.id) zones.splice(k, 1);
    ctx.zones.forEach(function (z) { zones.push(z); });
    ctx.zones.forEach(function (z) { z.wpos = new T.Vector3(); z.meshes[0].getWorldPosition(z.wpos); });
    st.rotors = HY._rotors.slice(); rotors = [];
    SLOTS.forEach(function (s2) { if (slotState[s2.id].rotors) rotors = rotors.concat(slotState[s2.id].rotors); });
  }

  /* --------------------------------------------------------------- scene */
  var HALL = { X0: -7.5, X1: 10.5, Z0: -4.5, Z1: 5.5, H: 6.0 };
  function buildPlant() {
    var root = plant.root = new T.Group(); TW.add(root);
    var B = new SK.Batch(), ss = MK.ss(), sp = MK.ssPol(), X0 = HALL.X0, X1 = HALL.X1, Z0 = HALL.Z0, Z1 = HALL.Z1, H = HALL.H, W = X1 - X0, D = Z1 - Z0;
    /* ---- ruang produksi: lantai epoxy, dinding panel, plafon, drain */
    var og = new T.Mesh(new T.PlaneGeometry(160, 160), new T.MeshStandardMaterial({ color: 0x2b3137, roughness: 0.95 })); og.rotation.x = -Math.PI / 2; og.position.y = -0.03; og.receiveShadow = true; TW.add(og);
    var epox = new T.MeshStandardMaterial({ color: 0xffffff, map: SK.tex.epoxy('#aeb8b5'), roughness: 0.26, metalness: 0.0, envMapIntensity: 0.9 });
    var fg = new T.PlaneGeometry(W, D); SK.scaleUV(fg, W / 4, D / 4); B.geo(epox, fg, SK.M4((X0 + X1) / 2, 0, (Z0 + Z1) / 2, -Math.PI / 2));
    var WB = new SK.Batch(), wallM = new T.MeshStandardMaterial({ map: SK.tex.wallPanel(), roughness: 0.45, metalness: 0.05, envMapIntensity: 0.5 });
    function wall(cx, cz, len, ry) { var g = new T.PlaneGeometry(len, H); SK.scaleUV(g, len / 2.4, 1); WB.geo(wallM, g, SK.M4(cx, H / 2, cz, 0, ry, 0)); var k = new T.PlaneGeometry(len, 0.3); SK.scaleUV(k, len, 1); WB.geo(ss, k, SK.M4(cx + Math.sin(ry) * 0.012, 0.15, cz + Math.cos(ry) * 0.012, 0, ry, 0)); var cv = new T.PlaneGeometry(len, 0.13); WB.geo(epox, cv, SK.M4(cx + Math.sin(ry) * 0.05, 0.045, cz + Math.cos(ry) * 0.05, 0, ry, 0).multiply(SK.M4(0, 0, 0, -Math.PI / 4))); }
    wall((X0 + X1) / 2, Z0, W, 0); wall((X0 + X1) / 2, Z1, W, Math.PI); wall(X0, (Z0 + Z1) / 2, D, Math.PI / 2); wall(X1, (Z0 + Z1) / 2, D, -Math.PI / 2);
    var ceil = new T.PlaneGeometry(W, D); SK.scaleUV(ceil, W / 2.4, D / 2.4); WB.geo(new T.MeshStandardMaterial({ map: SK.tex.wallPanel(), color: 0xf4f6f6, roughness: 0.6 }), ceil, SK.M4((X0 + X1) / 2, H, (Z0 + Z1) / 2, Math.PI / 2));
    for (var lx = X0 + 2.2; lx < X1 - 1; lx += 3.2) for (var lz = Z0 + 1.6; lz < Z1 - 0.8; lz += 3.0) { WB.box(MK.lamp(0xfdf8ec), 0.6, 0.02, 1.2, lx, H - 0.02, lz); WB.box(sp, 0.64, 0.025, 1.24, lx, H - 0.005, lz); }
    /* jendela koridor pengunjung (dinding belakang) */
    var wx0 = -2.8, wx1 = 6.8, wy0 = 1.25, wy1 = 2.45;
    WB.box(new T.MeshStandardMaterial({ color: 0x2b3642, roughness: 0.9 }), wx1 - wx0, wy1 - wy0, 0.01, (wx0 + wx1) / 2, (wy0 + wy1) / 2, Z0 + 0.005);
    WB.box(MK.glass(), wx1 - wx0, wy1 - wy0, 0.01, (wx0 + wx1) / 2, (wy0 + wy1) / 2, Z0 + 0.03);
    for (var fx = wx0; fx <= wx1 + 0.01; fx += (wx1 - wx0) / 6) WB.box(sp, 0.05, wy1 - wy0 + 0.05, 0.05, fx, (wy0 + wy1) / 2, Z0 + 0.03);
    [wy0, wy1].forEach(function (y) { WB.box(sp, wx1 - wx0 + 0.05, 0.05, 0.06, (wx0 + wx1) / 2, y, Z0 + 0.03); });
    /* pintu higienis */
    [[X1 - 0.02, 2.8, -Math.PI / 2, 2], [X0 + 0.02, -2.0, Math.PI / 2, 1]].forEach(function (d) {
      var n = d[3], wd = 0.9;
      for (var k = 0; k < n; k++) { var off = (k - (n - 1) / 2) * wd; WB.at(SK.M4(d[0], 0, d[1] + off, 0, d[2], 0), function (b) { b.box(MK.paint(0x9aa4aa, 0.35, 0.3), wd - 0.02, 2.2, 0.05, 0, 1.1, 0.02); b.box(MK.glass(), 0.35, 0.45, 0.02, 0, 1.55, 0.05); b.box(ss, wd - 0.04, 0.3, 0.02, 0, 0.17, 0.05); b.box(sp, 0.03, 0.2, 0.05, (k ? -1 : 1) * 0.3, 1.05, 0.08); }); }
      WB.at(SK.M4(d[0], 0, d[1], 0, d[2], 0), function (b) { b.box(sp, n * wd + 0.12, 0.06, 0.08, 0, 2.23, 0.02); [-1, 1].forEach(function (sd) { b.box(sp, 0.06, 2.26, 0.08, sd * (n * wd / 2 + 0.03), 1.13, 0.02); }); b.box(MK.lamp(0x33ff88), 0.34, 0.14, 0.04, 0, 2.5, 0.04); });
    });
    WB.build(root, { cast: false });
    /* drain: slot drain & floor drain */
    var dgeo = new T.PlaneGeometry(16, 0.12); SK.scaleUV(dgeo, 32, 0.24); B.geo(MK.grating(), dgeo, SK.M4(1.5, 0.004, 1.15, -Math.PI / 2)); B.box(new T.MeshStandardMaterial({ color: 0x1a1f22, roughness: 0.9 }), 16, 0.002, 0.14, 1.5, 0.001, 1.15);
    [[-2.1, -1.2], [5.0, 1.8]].forEach(function (q) { B.box(ss, 0.3, 0.006, 0.3, q[0], 0.003, q[1]); var gg = new T.PlaneGeometry(0.26, 0.26); SK.scaleUV(gg, 0.5, 0.5); B.geo(MK.grating(), gg, SK.M4(q[0], 0.007, q[1], -Math.PI / 2)); });
    /* ---- utilitas di atas: fabric duct, sprinkler, cable tray + kabel turun ke instrumen */
    var fab = new T.MeshStandardMaterial({ color: 0xf1f2ef, roughness: 1.0, metalness: 0 });
    B.cylX(fab, 0.34, W - 1.5, (X0 + X1) / 2, 5.15, 2.3, 24); for (var hx = X0 + 1.5; hx < X1 - 1; hx += 1.5) B.rod(MK.steel(), [hx, 5.49, 2.3], [hx, H, 2.3], 0.004, 4);
    [-1.6, 3.4].forEach(function (z) { B.rod(MK.red(), [X0 + 0.3, 5.65, z], [X1 - 0.3, 5.65, z], 0.028, 10); for (var sx = X0 + 1.2; sx < X1; sx += 3.0) { B.rod(MK.red(), [sx, 5.65, z], [sx, 5.5, z], 0.012, 6); B.cyl(MK.paint(0xd6b24a, 0.4, 0.6), 0.02, 0.01, 0.04, sx, 5.47, z, 0, 0, 0, 8); } });
    SK.cableTray(B, [[X0 + 0.2, 4.4, -3.8], [X1 - 0.2, 4.4, -3.8]], { w: 0.3, mat: ss, cables: 5 });
    var cab = MK.paint(0x5d6166, 0.6, 0.1);
    [[0.3, 0, 1.78], [1.6, 0, 1.72], [2.75, 0, 1.78]].forEach(function (q) { B.tube(cab, [[q[0], 4.42, -3.7], [q[0], 4.42, -0.35], [q[0], 2.6, -0.35], [q[0] + 0.12, q[2] + 0.1, -0.05]], 0.008, 0.25); });
    B.tube(cab, [[-3.2, 4.42, -3.7], [-3.2, 4.42, -2.0], [-4.3, 3.2, 1.2], [-3.35, 1.6, 1.45]], 0.008, 0.4);
    /* ---- TANGKI TK-101 */
    var prof = [[0.06, 0.60], [0.95, 1.05], [0.95, 2.45], [0.90, 2.62], [0.75, 2.76], [0.5, 2.85], [0.2, 2.89], [0.001, 2.9]];
    var tank = plant.tank = new T.Group(); tank.position.set(-3.2, 0, 0); root.add(tank);
    tank.add(TW.lathe(prof, mTankShell, 56));
    var filmMat = plant.tankFilmMat = new T.MeshBasicMaterial({ color: COL.A, transparent: true, opacity: 0.5, depthWrite: false, side: T.BackSide });
    var tf = TW.lathe(prof.map(function (p) { return [p[0] * 0.985, p[1] - (p[1] > 0.7 ? 0.002 : 0)]; }), filmMat, 40); tf.castShadow = false; tf.renderOrder = 3; tank.add(tf);
    var TB = new SK.Batch();
    [1.05, 2.45].forEach(function (y) { TB.torus(sp, 0.955, 0.006, 0, y, 0, Math.PI / 2, 0, 0, Math.PI * 2, 56); });
    [[0.68, 0.68], [-0.68, 0.68], [0.68, -0.68], [-0.68, -0.68]].forEach(function (q) {
      TB.cyl(ss, 0.045, 0.045, 1.02, q[0], 0.6, q[1], 0, 0, 0, 16); TB.box(ss, 0.16, 0.2, 0.12, q[0] * 0.93, 1.05, q[1] * 0.93);
      TB.box(MK.paint(0x2f3a44, 0.4, 0.5), 0.12, 0.07, 0.12, q[0], 0.14, q[1]); TB.cyl(ss, 0.07, 0.08, 0.025, q[0], 0.0125, q[1], 0, 0, 0, 18); TB.sph(sp, 0.035, q[0], 0.06, q[1], 12);
      TB.rod(MK.paint(0x2a2a2a, 0.6, 0.1), [q[0], 0.17, q[1]], [q[0] * 1.2, 0.02, q[1] * 1.2], 0.005, 6);
    });
    TB.cyl(sp, 0.12, 0.12, 0.3, 0, 3.12, 0, 0, 0, 0, 24); TB.box(MK.paint(0x2f5d8a, 0.45, 0.35), 0.24, 0.16, 0.2, 0, 3.35, 0); TB.cylX(MK.paint(0x2f5d8a, 0.45, 0.35), 0.1, 0.36, 0.25, 3.35, 0, 24); TB.cyl(ss, 0.035, 0.035, 0.26, 0, 2.97, 0, 0, 0, 0, 12);
    TB.at(SK.M4(0.45, 2.8, 0.3, 0.38, 0, -0.5), function (b) { b.cyl(sp, 0.2, 0.2, 0.08, 0, 0.04, 0, 0, 0, 0, 32); b.cyl(sp, 0.215, 0.215, 0.025, 0, 0.09, 0, 0, 0, 0, 32); b.box(ss, 0.12, 0.05, 0.05, 0.22, 0.1, 0); b.rod(ss, [-0.15, 0.1, 0], [-0.3, 0.12, 0], 0.012, 8); });
    TB.cyl(sp, 0.06, 0.06, 0.25, -0.4, 3.0, -0.28, 0, 0, 0, 20); TB.cyl(sp, 0.075, 0.075, 0.02, -0.4, 3.13, -0.28, 0, 0, 0, 20);
    TB.cyl(sp, 0.05, 0.05, 0.08, 0.1, 2.93, -0.55, -0.3, 0, 0, 16); TB.cyl(MK.glass(), 0.04, 0.04, 0.01, 0.1, 2.975, -0.57, -0.3, 0, 0, 16);
    TB.sph(sp, 0.08, 0, 0.5, 0, 16); TB.cyl(sp, 0.06, 0.06, 0.16, 0, 0.4, 0.14, Math.PI / 2, 0, 0, 16); TB.cyl(MK.paint(0xf3f4f2, 0.3, 0.1), 0.06, 0.06, 0.2, 0, 0.62, 0.24, 0, 0, 0, 20);
    TB.build(tank);
    var liqMat = plant.liqMat = new T.MeshStandardMaterial({ color: COL.B, transparent: true, opacity: 0.55, roughness: 0.2, depthWrite: false });
    plant.liqCone = put(tank, new T.Mesh(new T.CylinderGeometry(0.94, 0.06, 0.45, 40), liqMat), 0, 0.825, 0);
    plant.liqCyl = put(tank, new T.Mesh(new T.CylinderGeometry(0.94, 0.94, 1, 40), liqMat), 0, 1.05, 0);
    plant.liqCone.renderOrder = plant.liqCyl.renderOrder = 2;
    put(tank, TW.cyl(0.03, 0.03, 1.7, mSteelS, 12), 0, 2.1, 0);
    plant.agit = new T.Group(); plant.agit.position.set(0, 1.35, 0); tank.add(plant.agit);
    for (var bl = 0; bl < 3; bl++) { var bb = TW.box(0.36, 0.02, 0.1, mPolS); bb.position.x = 0.18; var arm = new T.Group(); arm.rotation.y = bl * Math.PI * 2 / 3; bb.rotation.x = 0.5; arm.add(bb); plant.agit.add(arm); }
    plant.ball = put(tank, TW.sph(0.09, mPolS, 20), 0, 2.34, 0);
    for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; var hole = TW.sph(0.014, mDark, 6); hole.position.set(Math.cos(a) * 0.085, -0.02 - (i % 3) * 0.02, Math.sin(a) * 0.085); plant.ball.add(hole); }
    put(tank, TW.cyl(0.05, 0.05, 0.4, mSteelS, 16), 0, 2.62, 0);
    TW.label('TK-101 &middot; tangki produk', tank, { off: [0, 3.75, 0], cls: '', group: 'eq' });
    TW.label('bola spray CIP', plant.ball, { off: [0, -0.25, 0.1], cls: '', group: 'eq', maxD: 9 });
    /* platform & tangga stainless untuk akses atas tangki */
    SK.platform(B, { x0: -4.7, x1: -2.55, z0: -2.05, z1: -1.15, y: 2.3, mat: ss, rail: ss, gaps: [{ e: 'e', at: 0.45, w: 0.9 }], rails: { n: 1, s: 0, e: 1, w: 1 }, brace: false });
    SK.stairs(B, { x: 0.47, z: -1.6, h: 2.3, ry: Math.PI, mat: ss, rail: ss, w: 0.85 });
    /* ---- POMPA P-101 (higienis, shroud stainless) */
    var pump = new T.Group(); pump.position.set(-1.75, 0.42, 0); root.add(pump);
    var PB = new SK.Batch();
    PB.cylZ(sp, 0.22, 0.12, 0, 0, 0, 40); PB.cylZ(sp, 0.2, 0.03, 0, 0, 0.07, 40); PB.torus(ss, 0.205, 0.008, 0, 0, 0.06, 0, 0, 0, Math.PI * 2, 40);
    PB.cylZ(sp, 0.17, 0.62, 0, 0, -0.45, 40); PB.add(new T.SphereGeometry(0.17, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), sp, SK.M4(0, 0, -0.76, -Math.PI / 2, 0, 0, 1, 0.35, 1));
    PB.cylZ(ss, 0.08, 0.1, 0, 0, -0.1, 20);
    PB.box(ss, 0.5, 0.02, 0.95, 0, -0.26, -0.3); [[-0.2, 0.12], [0.2, 0.12], [-0.2, -0.72], [0.2, -0.72]].forEach(function (q) { PB.cyl(ss, 0.018, 0.018, 0.16, q[0], -0.34, q[1], 0, 0, 0, 10); PB.cyl(ss, 0.04, 0.045, 0.02, q[0], -0.41, q[1], 0, 0, 0, 14); });
    PB.cyl(sp, 0.055, 0.055, 0.22, 0, 0.3, 0, 0, 0, 0, 20); PB.cylX(sp, 0.055, 0.2, -0.24, -0.04, 0, 20);
    PB.build(pump);
    TW.label('P-101', pump, { off: [0, 0.55, 0], group: 'eq' });
    /* ---- PIPA proses */
    var y = 1.5, XA = 3.65;
    pipes.main = TW.pipe([[-3.2, 0.6, 0], [-3.2, 0.38, 0], [-1.95, 0.38, 0]], RO, { mat: mPipe });
    pipes.main2 = TW.pipe([[-1.75, 0.62, 0], [-1.75, y, 0], [XA, y, 0]], RO, { mat: mPipe });
    pipes.prod = TW.pipe([[XA, y, 0], [XA, 0.55, 0], [XA, 0.55, 1.7]], RO, { mat: mPipe });
    pipes.ret = TW.pipe([[XA, y, 0], [5.2, y, 0], [5.2, 2.05, 0], [6.95, 2.05, 0], [6.95, 1.72, 0]], RO, { mat: mPipe });
    pipes.sup = TW.pipe([[5.55, 0.65, 0.75], [5.55, 3.6, 0.75], [-3.2, 3.6, 0.75], [-3.2, 3.6, 0], [-3.2, 2.45, 0]], RO * 0.9, { mat: mPipe });
    Object.keys(pipes).forEach(function (k) { root.add(pipes[k].group); });
    var fm = plant.pipeFilmMat = new T.MeshBasicMaterial({ color: COL.A, transparent: true, opacity: 0.5, depthWrite: false });
    ['main', 'main2', 'prod'].forEach(function (k) {
      var f = new T.Mesh(new T.TubeGeometry(pipes[k].path, Math.max(24, Math.round(pipes[k].length / 0.06)), RO * 0.9, 16, false), fm); f.renderOrder = 3; root.add(f);
    });
    /* support higienis, hanger plafon, tri-clamp */
    [-1.1, 1.0, 2.2, 3.25].forEach(function (x) { SK.hygSupport(B, x, 0, y, RO); });
    SK.hygSupport(B, -2.55, 0, 0.38, RO); SK.hygSupport(B, 4.5, 0, y, RO); SK.hygSupport(B, 6.1, 0, 2.05, RO); SK.hygSupport(B, XA, 1.2, 0.55, RO);
    [4.4, 2.4, 0.4, -1.6].forEach(function (x) { B.rod(MK.steel(), [x, 3.6 + RO, 0.75], [x, H, 0.75], 0.006, 6); B.torus(sp, RO * 0.9 + 0.008, 0.008, x, 3.6, 0.75, 0, Math.PI / 2, 0, Math.PI * 2, 24); B.box(ss, 0.08, 0.02, 0.08, x, H - 0.01, 0.75); });
    B.rod(MK.steel(), [-3.2, 3.6 + RO, 0.2], [-3.2, H, 0.2], 0.006, 6);
    [[-1.4, y, 0, 1], [0.75, y, 0, 1], [1.95, y, 0, 1], [3.35, y, 0, 1], [4.2, y, 0, 1], [-2.6, 0.38, 0, 1], [3.0, 3.6, 0.75, 1], [-1.0, 3.6, 0.75, 1], [6.1, 2.05, 0, 1]].forEach(function (q) { SK.triClamp(B, [q[0], q[1], q[2]], [1, 0, 0], RO); });
    [[-1.75, 0.85, 0], [-1.75, 1.2, 0], [XA, 0.9, 0], [5.55, 2.4, 0.75], [-3.2, 2.75, 0]].forEach(function (q) { SK.triClamp(B, q, [0, 1, 0], RO); });
    /* valve kupu-kupu manual di discharge pompa */
    B.cyl(sp, RO + 0.02, RO + 0.02, 0.05, -1.75, 1.02, 0, 0, 0, 0, 24); B.box(ss, 0.03, 0.03, 0.05, -1.75, 1.02, RO + 0.04); B.box(MK.paint(0x2f5d8a, 0.4, 0.3), 0.03, 0.02, 0.26, -1.75, 1.02, RO + 0.18);
    /* valve divert V-101 (mixproof + control top) */
    var v3 = plant.v3 = new T.Group(); v3.position.set(XA, y, 0); root.add(v3);
    var VB = new SK.Batch();
    VB.sph(sp, 0.085, 0, 0, 0, 24); VB.cyl(sp, 0.07, 0.07, 0.2, 0, -0.1, 0, 0, 0, 0, 24); VB.cyl(sp, 0.028, 0.028, 0.1, 0, 0.12, 0, 0, 0, 0, 12);
    VB.cyl(sp, 0.07, 0.07, 0.3, 0, 0.32, 0, 0, 0, 0, 28); VB.torus(ss, 0.072, 0.006, 0, 0.18, 0, Math.PI / 2, 0, 0, Math.PI * 2, 28); VB.torus(ss, 0.072, 0.006, 0, 0.46, 0, Math.PI / 2, 0, 0, Math.PI * 2, 28);
    VB.cyl(MK.paint(0xf0f1ef, 0.35, 0.05), 0.075, 0.075, 0.1, 0, 0.53, 0, 0, 0, 0, 28); VB.add(new T.SphereGeometry(0.075, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), MK.paint(0xf0f1ef, 0.35, 0.05), SK.M4(0, 0.58, 0, 0, 0, 0, 1, 0.45, 1));
    VB.tube(MK.paint(0x2f7fd6, 0.4, 0.1), [[0.075, 0.53, 0], [0.12, 0.53, 0], [0.12, 0.3, 0.05]], 0.004, 0.02);
    VB.build(v3);
    plant.v3Led = new T.Mesh(new T.TorusGeometry(0.076, 0.006, 8, 32), new T.MeshStandardMaterial({ color: 0x111111, emissive: 0x2fd66b, emissiveIntensity: 1.6 })); plant.v3Led.rotation.x = Math.PI / 2; plant.v3Led.position.y = 0.5; v3.add(plant.v3Led);
    plant.v3Lbl = TW.label('V-101 &middot; 3-arah', v3, { off: [0, 0.85, 0], group: 'eq' });
    /* ---- FILLER + konveyor + botol */
    var fillG = new T.Group(); fillG.position.set(XA, 0.55, 1.7); root.add(fillG);
    B.box(ss, 1.3, 0.9, 0.9, XA, 0.45, 2.2); B.box(sp, 1.32, 0.03, 0.92, XA, 0.91, 2.2);
    B.box(MK.glass(), 1.3, 1.0, 0.02, XA, 1.42, 2.65); B.box(MK.glass(), 0.02, 1.0, 0.9, XA - 0.65, 1.42, 2.2); B.box(MK.glass(), 0.02, 1.0, 0.9, XA + 0.65, 1.42, 2.2);
    [[-0.65, 1.75], [0.65, 1.75], [-0.65, 2.65], [0.65, 2.65]].forEach(function (q) { B.box(sp, 0.04, 1.05, 0.04, XA + q[0], 1.42, q[1]); });
    B.box(ss, 1.34, 0.04, 0.94, XA, 1.94, 2.2); B.cyl(sp, 0.28, 0.24, 0.24, XA, 1.66, 2.2, 0, 0, 0, 32);
    for (var n = 0; n < 8; n++) { var an = n / 8 * Math.PI * 2; B.cyl(sp, 0.012, 0.012, 0.3, XA + Math.cos(an) * 0.2, 1.4, 2.2 + Math.sin(an) * 0.2, 0, 0, 0, 8); }
    B.box(ss, 0.5, 0.4, 0.3, XA + 0.35, 1.2, 1.8); B.box(new T.MeshBasicMaterial({ color: 0x1b3a5c }), 0.3, 0.2, 0.01, XA + 0.35, 1.25, 1.64);
    TW.label('ke FILLING', fillG, { off: [0, 1.75, 0.5], group: 'eq' });
    var cx0 = 0.9, cx1 = 9.6, cz = 2.2, cyv = 0.92;
    [-1, 1].forEach(function (sd) { B.box(sp, cx1 - cx0, 0.07, 0.015, (cx0 + cx1) / 2, cyv, cz + sd * 0.08); B.box(ss, cx1 - cx0, 0.012, 0.015, (cx0 + cx1) / 2, cyv + 0.07, cz + sd * 0.1); });
    B.box(new T.MeshStandardMaterial({ color: 0x3a4652, roughness: 0.5 }), cx1 - cx0, 0.01, 0.15, (cx0 + cx1) / 2, cyv + 0.03, cz);
    for (var lx2 = cx0 + 0.3; lx2 < cx1; lx2 += 1.4) { [-1, 1].forEach(function (sd) { B.cyl(ss, 0.018, 0.018, cyv, lx2, cyv / 2, cz + sd * 0.1, 0, 0, 0, 10); B.cyl(ss, 0.035, 0.04, 0.02, lx2, 0.01, cz + sd * 0.1, 0, 0, 0, 12); }); B.box(ss, 0.02, 0.02, 0.22, lx2, 0.3, cz); }
    var NB = 34, bot = plant.bottles = new T.InstancedMesh(new T.CylinderGeometry(0.035, 0.035, 0.17, 16), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.82 }), NB);
    var caps = plant.caps = new T.InstancedMesh(new T.CylinderGeometry(0.018, 0.018, 0.03, 12), MK.paint(0x2f6fd6, 0.4, 0.1), NB);
    bot.castShadow = true; root.add(bot); root.add(caps); plant.bot = { n: NB, x0: cx0 + 0.1, x1: cx1 - 0.1, y: cyv + 0.12, z: cz, off: 0 };
    for (var bi = 0; bi < NB; bi++) bot.setColorAt(bi, new T.Color(0xdde8ee));
    /* ---- SKID CIP */
    var sk = new T.Group(); root.add(sk);
    var SKB = new SK.Batch();
    [[5.1, -0.85], [8.8, -0.85], [5.1, 1.35], [8.8, 1.35]].forEach(function (q) { SKB.box(ss, 0.06, 0.28, 0.06, q[0], 0.14, q[1]); SKB.cyl(ss, 0.05, 0.055, 0.02, q[0], 0.01, q[1], 0, 0, 0, 14); });
    SKB.box(ss, 3.7, 0.06, 0.06, 6.95, 0.28, -0.85); SKB.box(ss, 3.7, 0.06, 0.06, 6.95, 0.28, 1.35); SKB.box(ss, 0.06, 0.06, 2.2, 5.1, 0.28, 0.25); SKB.box(ss, 0.06, 0.06, 2.2, 8.8, 0.28, 0.25);
    var dp = new T.PlaneGeometry(3.7, 2.2); SK.scaleUV(dp, 7.4, 4.4); SKB.geo(MK.grating(), dp, SK.M4(6.95, 0.31, 0.25, -Math.PI / 2));
    var tanks = plant.skidTanks = [];
    [[5.95, 'TK-AIR', COL.water], [6.95, 'TK-NaOH', COL.caustic], [7.95, 'TK-ASAM', COL.acid]].forEach(function (d) {
      var mat = new T.MeshStandardMaterial({ color: 0xffffff, map: SK.tex.brushed(), metalness: 0.9, roughness: 0.3, emissive: 0x000000 }); var t = new T.Group(); t.position.set(d[0], 0, -0.1); sk.add(t);
      put(t, TW.cyl(0.42, 0.42, 1.2, mat, 36), 0, 1.0, 0); put(t, TW.sph(0.42, mat, 28), 0, 1.6, 0).scale.y = 0.35; put(t, TW.cyl(0.42, 0.08, 0.3, mat, 36), 0, 0.25, 0);
      [0.0, 2.1, 4.2].forEach(function (a) { put(t, TW.cyl(0.03, 0.03, 0.5, mSteelS, 10), Math.cos(a) * 0.36, 0.55, Math.sin(a) * 0.36); });
      put(t, TW.cyl(0.425, 0.425, 0.12, M.std(d[2], 0.3, 0.5), 36), 0, 1.25, 0);
      put(t, TW.cyl(0.12, 0.12, 0.05, mPolS, 20), 0.15, 1.72, 0.1); put(t, TW.cyl(0.03, 0.03, 0.18, mPolS, 12), -0.2, 1.78, 0); put(t, TW.cyl(0.035, 0.035, 0.07, mPolS, 16), -0.2, 1.9, 0);
      tanks.push({ mat: mat, x: d[0], col: d[2], grp: t });
      TW.label(d[1], t, { off: [0, 2.2, 0], group: 'eq' });
      SKB.rod(mSteelS, [d[0], 0.12, -0.1], [d[0], 0.12, 0.55], 0.028, 12); SKB.cyl(mPolS, 0.045, 0.045, 0.08, d[0], 0.12, 0.3, Math.PI / 2, 0, 0, 16); SKB.cyl(MK.paint(0x2f5d8a, 0.4, 0.3), 0.03, 0.03, 0.12, d[0], 0.22, 0.3, 0, 0, 0, 14);
    });
    SKB.rod(mSteelS, [5.55, 0.12, 0.55], [7.95, 0.12, 0.55], 0.032, 12);
    SKB.at(SK.M4(5.55, 0.32, 0.75, 0, Math.PI, 0), function (b) { b.cylZ(sp, 0.16, 0.1, 0, 0.1, 0, 32); b.cylZ(sp, 0.12, 0.45, 0, 0.1, -0.3, 28); b.box(ss, 0.3, 0.02, 0.6, 0, -0.01, -0.2); });
    var phe = MK.paint(0x2f5d8a, 0.45, 0.35);
    SKB.box(phe, 0.12, 0.95, 0.52, 6.45, 0.8, 1.05); SKB.box(phe, 0.1, 0.85, 0.48, 7.45, 0.8, 1.05); SKB.box(ss, 0.05, 0.9, 0.05, 8.0, 0.75, 1.05);
    SKB.geo(new T.MeshStandardMaterial({ map: SK.tex.platePack(), metalness: 0.8, roughness: 0.35 }), new T.BoxGeometry(0.88, 0.8, 0.44), SK.M4(6.95, 0.8, 1.05));
    SKB.rod(ss, [6.45, 1.3, 1.05], [8.0, 1.3, 1.05], 0.025, 10); SKB.rod(ss, [6.45, 0.35, 1.05], [8.0, 0.35, 1.05], 0.02, 10);
    [[1.2, 0.84], [1.2, 1.26], [0.42, 0.84], [0.42, 1.26]].forEach(function (q) { SKB.rod(MK.steel(), [6.35, q[0], q[1]], [7.55, q[0], q[1]], 0.012, 8); SKB.cyl(MK.steel(), 0.022, 0.022, 0.03, 7.53, q[0], q[1], 0, 0, Math.PI / 2, 6); });
    [[1.05, 0.9], [1.05, 1.2], [0.55, 0.9], [0.55, 1.2]].forEach(function (q) { SKB.cylX(sp, 0.035, 0.12, 6.35, q[0], q[1], 14); });
    SKB.box(ss, 0.6, 1.5, 0.35, 9.35, 0.95, 0.25); SKB.box(sp, 0.62, 0.04, 0.37, 9.35, 1.72, 0.25);
    SKB.build(sk);
    plant.hmiC = document.createElement('canvas'); plant.hmiC.width = 256; plant.hmiC.height = 192; plant.hmiT = new T.CanvasTexture(plant.hmiC); plant.hmiT.encoding = T.sRGBEncoding;
    var hmiMat = new T.MeshBasicMaterial({ map: plant.hmiT, toneMapped: false });
    var hm1 = new T.Mesh(new T.PlaneGeometry(0.42, 0.31), hmiMat); hm1.rotation.y = -Math.PI / 2; hm1.position.set(9.02, 1.25, 0.25); sk.add(hm1);
    TW.label('SKID CIP', sk, { off: [6.95, 2.55, 0], group: 'eq' });
    TW.label('P-CIP', sk, { off: [5.55, 0.85, 0.75], group: 'eq', maxD: 12 });
    TW.label('PHE pemanas', sk, { off: [6.95, 1.45, 1.05], group: 'eq', maxD: 12 });
    TW.label('panel CIP + HMI', sk, { off: [9.35, 2.0, 0.25], group: 'eq', maxD: 14 });
    /* ---- HMI operator, panel MCC, wastafel, rambu, operator */
    B.cyl(ss, 0.05, 0.05, 1.1, -5.2, 0.55, 2.0, 0, 0, 0, 14); B.cyl(ss, 0.2, 0.22, 0.03, -5.2, 0.015, 2.0, 0, 0, 0, 20); B.box(ss, 0.5, 0.38, 0.08, -5.2, 1.3, 2.0, -0.35, 0, 0);
    var hm2 = new T.Mesh(new T.PlaneGeometry(0.44, 0.32), hmiMat); hm2.position.set(-5.2, 1.315, 2.045); hm2.rotation.x = -0.35; root.add(hm2);
    TW.label('HMI operator', new T.Vector3(-5.2, 1.75, 2.0), { group: 'eq', maxD: 12 });
    for (var m = 0; m < 3; m++) { B.box(MK.paint(0xd6dadc, 0.5, 0.2), 0.5, 2.0, 0.8, X1 - 0.27, 1.0, -3.4 + m * 0.82); B.box(MK.dark(), 0.02, 1.9, 0.01, X1 - 0.52, 1.0, -3.4 + m * 0.82 + 0.4); B.box(MK.paint(0xe8b800, 0.5, 0.2), 0.01, 0.12, 0.12, X1 - 0.53, 1.7, -3.4 + m * 0.82); }
    TW.label('panel MCC / PLC', new T.Vector3(X1 - 0.3, 2.3, -2.6), { group: 'eq', maxD: 16 });
    B.box(ss, 0.9, 0.2, 0.5, X0 + 0.3, 0.9, 0.6); B.box(ss, 0.06, 0.9, 0.5, X0 + 0.3, 0.45, 0.6); B.rod(sp, [X0 + 0.12, 1.0, 0.6], [X0 + 0.12, 1.25, 0.6], 0.012, 8); B.rod(sp, [X0 + 0.12, 1.25, 0.6], [X0 + 0.3, 1.25, 0.6], 0.012, 8);
    SK.sign(-4.6, 3.0, Z0 + 0.02, 0, 2.4, 0.8, function (g, w, h) { g.fillStyle = '#1565c0'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 48px sans-serif'; g.textAlign = 'center'; g.fillText('ZONA HIGIENIS', w / 2, h * 0.42); g.font = 'bold 30px sans-serif'; g.fillText('WAJIB APD · CUCI TANGAN', w / 2, h * 0.78); });
    SK.sign(8.2, 3.0, Z0 + 0.02, 0, 2.0, 0.6, function (g, w, h) { g.fillStyle = '#f2c500'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 46px sans-serif'; g.textAlign = 'center'; g.fillText('AWAS KIMIA CIP', w / 2, h * 0.45); g.font = 'bold 30px sans-serif'; g.fillText('NaOH · HNO₃ · PANAS', w / 2, h * 0.82); });
    SK.human(B, -5.2, 2.55, Math.PI, { suit: 0xf0f2f3, hat: 0xf6f7f8, pose: 'tablet' });
    SK.human(B, 6.2, 3.6, -2.6, { suit: 0xf0f2f3, hat: 0x2f6fd6 });
    B.build(root);
    spray = new TW.PSys(700, 'soft', true);
    shed = new TW.PSys(900, 'soft', false);
  }
  function drawHMI() {
    if (!plant.hmiC) return;
    var g = plant.hmiC.getContext('2d'), st = S.steps[S.i], ph = S.phase;
    g.fillStyle = '#0c1a26'; g.fillRect(0, 0, 256, 192); g.fillStyle = '#16324a'; g.fillRect(0, 0, 256, 26);
    g.fillStyle = '#9fe7ff'; g.font = 'bold 15px sans-serif'; g.fillText('CIP · TK-101 / L-101', 8, 18);
    var txt = { SOILED: 'SIAP CIP', CIP: st ? st.name : 'CIP', CIPDONE: 'CIP SELESAI', HOLD: 'JEDA', PRODB: 'PRODUKSI B', DONE: 'SELESAI' }[ph] || ph;
    g.fillStyle = ph === 'CIP' ? '#ffd27f' : (ph === 'PRODB' ? '#9fe7a8' : '#cfe6f5'); g.font = 'bold 19px sans-serif'; g.fillText(txt, 8, 52);
    g.fillStyle = '#cfe6f5'; g.font = '14px monospace';
    g.fillText('T balik : ' + S.T.toFixed(1) + ' C', 8, 82); g.fillText('Konduk. : ' + S.cond.toFixed(2) + ' mS', 8, 102); g.fillText('Aliran  : ' + (ph === 'CIP' ? R.vel.toFixed(1) : (ph === 'PRODB' ? '1.0' : '0.0')) + ' m/s', 8, 122);
    if (ph === 'CIP' && st) { g.fillStyle = '#23384d'; g.fillRect(8, 140, 240, 14); g.fillStyle = '#00e5ff'; g.fillRect(8, 140, 240 * S.tStep / st.dur, 14); g.fillStyle = '#cfe6f5'; g.font = '12px monospace'; g.fillText('langkah ' + (S.i + 1) + '/' + S.steps.length, 8, 176); }
    plant.hmiT.needsUpdate = true;
  }

  /* --------------------------------------------------- fluida & visual */
  function setPipeFluid(names, color, opacity, speed) {
    names.forEach(function (k) { pipes[k].setFluid(color, opacity); pipes[k].setFlow(speed); });
  }
  function fluidColorOf(f) { return { water: COL.water, caustic: COL.caustic, acid: COL.acid, hot: COL.hot, A: COL.A, B: COL.B }[f] || COL.water; }
  var FLUID_NAME = { water: 'Air bilas', caustic: 'Kaustik NaOH', acid: 'Asam HNO₃', hot: 'Air panas 90°C', A: 'Produk A', B: 'Produk B' };

  function applyFluidVisual() {
    var ph = S.phase, st = S.steps[S.i], fl = null, spd = 0, showSupply = false, retOn = false, prodOn = false;
    if (ph === 'CIP' && st) { fl = st.fluid; spd = R.vel / 1.5; showSupply = true; retOn = true; }
    else if (ph === 'PRODB') { fl = 'B'; spd = 0.7; prodOn = true; }
    var col = fl ? fluidColorOf(fl) : COL.water;
    if (fl === 'B') { var ck = contamK(); col = new T.Color(COL.B).lerp(new T.Color(0x8f9a3a), ck); }
    var op = fl ? (fl === 'B' ? 0.6 : 0.5) : 0;
    setPipeFluid(['main', 'main2'], col, op, fl ? spd : 0);
    setPipeFluid(['ret'], col, retOn ? op : 0, retOn ? spd : 0);
    setPipeFluid(['prod'], col, prodOn ? op : 0, prodOn ? spd : 0);
    setPipeFluid(['sup'], col, showSupply ? op : 0, showSupply ? spd : 0);
    plant.spraying = showSupply ? col : null;
    // level tangki
    var lvl = ph === 'PRODB' ? 0.75 * (1 - 0.35 * S.tB / 3600) : 0;
    plant.level = lvl;
    plant.liqMat.color.set(COL.B).lerp(new T.Color(0x8f9a3a), contamK());
    plant.liqCyl.visible = plant.liqCone.visible = lvl > 0.01;
    plant.liqCyl.scale.y = Math.max(0.001, lvl * 1.4); plant.liqCyl.position.y = 1.05 + lvl * 0.7;
    // skid
    plant.skidTanks.forEach(function (t, k) {
      var active = ph === 'CIP' && st && ((k === 0 && (st.fluid === 'water' || st.fluid === 'hot')) || (k === 1 && st.fluid === 'caustic') || (k === 2 && st.fluid === 'acid'));
      t.mat.emissive.set(active ? t.col : 0x000000); t.mat.emissiveIntensity = active ? 0.35 : 0;
    });
    plant.v3Lbl.set(ph === 'PRODB' ? 'V-101 &middot; &rarr; FILLING' : (ph === 'CIP' ? 'V-101 &middot; &rarr; RETURN CIP' : 'V-101 &middot; 3-arah'));
    var soilK = ph === 'SOILED' || ph === 'CIP' || ph === 'CIPDONE' || ph === 'HOLD' || ph === 'DONE' || ph === 'PRODB';
    plant.pipeFilmMat.opacity = 0.5 * baseFilm(); plant.tankFilmMat.opacity = 0.3 * baseFilm(); plant.pipeFilmMat.visible = plant.tankFilmMat.visible = baseFilm() > 0.003;
  }
  function baseFilm() { return baseZone ? (0.7 * baseZone.Ro + 0.3 * baseZone.Rm) : 1; }
  function contamK() { return TW.clamp(Math.max(S.cfu / LIM.cfu, S.mg / LIM.ppm) / 2, 0, 1); }

  function updateZoneVisuals(showRes) {
    zones.forEach(function (z) {
      var Rt = 0.7 * z.Ro + 0.3 * z.Rm, share = 0.7 * z.Ro / (0.7 * z.Ro + 0.3 * z.Rm + 1e-9);
      var c = new T.Color(COL.mineral).lerp(new T.Color(COL.A), share);
      var mt = TW.clamp((z.logM - 6) / 3, 0, 0.75) * (Rt > 0.02 ? 1 : 0); c.lerp(new T.Color(COL.microbe), mt);
      z.mat.color.copy(c); z.mat.opacity = Rt < 0.004 ? 0 : 0.10 + 0.88 * TW.clamp(Rt * 1.05, 0, 1);
      var cnt = TW.clamp((z.logM - 4) / 5, 0, 1) * z.dots.userData.n * (Rt > 0.01 ? 1 : 0); z.dots.geometry.setDrawRange(0, Math.floor(cnt));
      z.dots.material.size = 0.010 + 0.006 * Math.sin(TW.time() * 3 + z.mass);
    });
    SLOTS.forEach(function (sl) {
      var st = slotState[sl.id], r = slotResidue(sl.id);
      st.resLbl.hidden = !showRes;
      var pct = r * 100;
      st.resLbl.set(pct < 0.5 ? 'BERSIH' : 'RESIDU ' + idc(pct, pct < 10 ? 1 : 0) + '%', pct < 3 ? 'ok' : (pct < 25 ? 'warn' : 'bad'));
    });
  }
  function slotResidue(id) {
    var num = 0, den = 0;
    zones.forEach(function (z) { if (z.slot === id) { num += z.mass * (0.7 * z.Ro + 0.3 * z.Rm); den += z.mass; } });
    return den ? num / den : 0;
  }
  function slotRLU(id) { var m = 0; zones.forEach(function (z) { if (z.slot === id) m = Math.max(m, 10 + 2500 * z.Ro * z.atpW); }); return m; }

  /* -------------------------------------------------------- dinamika CIP */
  function buildSteps() {
    var s = [];
    s.push({ id: 'pre', name: 'PRA-BILAS AIR', fluid: 'water', T: 35, dur: 300, kOrg: 0.0008, kMin: 0.0003, kill: 0, target: 0 });
    s.push({ id: 'caus', name: 'KAUSTIK NaOH ' + idc(R.conc, 1) + '%', fluid: 'caustic', T: R.Tc, dur: R.tCaus * 60, kOrg: 0.0031, kMin: 0.0002, kill: 0.004, target: R.conc / 3 });
    s.push({ id: 'r1', name: R.acid ? 'BILAS ANTARA' : 'BILAS AKHIR', fluid: 'water', T: 45, dur: 300, kOrg: 0.0005, kMin: 0.0003, kill: 0, target: 0, final: !R.acid });
    if (R.acid) {
      s.push({ id: 'acid', name: 'ASAM HNO₃ 1%', fluid: 'acid', T: 65, dur: 600, kOrg: 0.0006, kMin: 0.008, kill: 0.002, target: 0.33 });
      s.push({ id: 'r2', name: 'BILAS AKHIR', fluid: 'water', T: 25, dur: 300, kOrg: 0.0004, kMin: 0.0004, kill: 0, target: 0, final: true });
    }
    if (R.sani) s.push({ id: 'sani', name: 'SANITASI AIR PANAS 90°C', fluid: 'hot', T: 90, dur: 600, kOrg: 0.0002, kMin: 0.0002, kill: 0.02, target: 0 });
    return s;
  }
  function effect(st, Tn) {
    var vf = Math.pow(TW.clamp(R.vel / 1.5, 0.15, 1.25), 0.8), chem = 1, tf;
    if (st.id === 'caus') { chem = Math.pow(TW.clamp(R.conc / 1.5, 0.2, 1.3), 0.7); tf = TW.clamp((Tn - 30) / 45, 0.08, 1.25); }
    else if (st.id === 'acid') tf = TW.clamp((Tn - 30) / 35, 0.1, 1.25);
    else if (st.id === 'sani') tf = TW.clamp((Tn - 50) / 40, 0, 1.15);
    else tf = TW.clamp((Tn - 15) / 35, 0.2, 1.2);
    return chem * tf * vf;
  }
  var STREAM_COND = { pre: 0.3, r1: 0.3, r2: 0.3, sani: 0.3 };
  function streamCondTarget(st) { return st.id === 'caus' ? 50 * R.conc / 1.5 : (st.id === 'acid' ? 35 : 0.3); }
  var everyZoneSlots = function () { return zones; };

  function advance(dt) {
    while (dt > 1e-6) {
      var h = Math.min(dt, 8);
      if (S.phase === 'CIP') {
        var st = S.steps[S.i]; h = Math.min(h, st.dur - S.tStep);
        S.T += (st.T - S.T) * (1 - Math.exp(-h / 40));
        var E = effect(st, S.T);
        zones.concat(baseZone).forEach(function (z) {
          var x = z.X;
          z.Ro *= Math.exp(-st.kOrg * E * x * h); z.Rm *= Math.exp(-st.kMin * E * x * h);
          z.logM -= st.kill * E * x * h;
          z.chem += (st.target - z.chem) * (1 - Math.exp(-0.01 * x * h));
        });
        S.Sc += (streamCondTarget(st) - S.Sc) * (1 - Math.exp(-h / 45));
        var tot = 0, leach = 0; zones.forEach(function (z) { tot += z.mass; }); zones.forEach(function (z) { leach += z.chem * z.mass / tot * 2.0; });
        S.cond = S.Sc + leach;
        S.tStep += h; S.tSim += h; S.tChart += h;
        if (S.tStep >= st.dur - 1e-6) {
          if (st.final) S.finalCond = S.cond;
          S.i++; S.tStep = 0;
          if (S.i >= S.steps.length) { finishCIP(); }
        }
      } else if (S.phase === 'PRODB') {
        h = Math.min(h, 3600 - S.tB);
        S.T += (20 - S.T) * (1 - Math.exp(-h / 30)); S.Sc += (0.3 - S.Sc) * (1 - Math.exp(-h / 30)); S.cond = S.Sc;
        zones.forEach(function (z) {
          var Rt = 0.7 * z.Ro + 0.3 * z.Rm, cfu = Rt * Math.pow(10, z.logM) * (z.mass / 100);
          var dc = cfu * SHED * h, dm = z.mass * Rt * LEACH * h / 3600;
          S.cfu += dc / BATCH_ML; S.mg += dm / BATCH_KG;
          var c = S.contrib[z.slot] || (S.contrib[z.slot] = { cfu: 0, mg: 0 }); c.cfu += dc / BATCH_ML; c.mg += dm / BATCH_KG;
        });
        S.tB += h; S.tSim += h; S.tChart += h;
        if (S.tB >= 3600 - 1e-6) finishBatch();
      } else break;
      dt -= h;
      if (S.phase !== 'CIP' && S.phase !== 'PRODB') break;
    }
  }
  function finishCIP() {
    S.phase = 'CIPDONE'; S.atp = {}; SLOTS.forEach(function (s) { S.atp[s.id] = slotRLU(s.id); });
    S.T = Math.min(S.T, 90); refreshAll();
    if (R.auto) startHold(); else { $('btn-next').style.display = 'block'; setState('CIP SELESAI — CEK VALIDASI', 'warn'); }
  }
  function startHold() {
    $('btn-next').style.display = 'none';
    S.phase = 'HOLD'; S.holdLeft = R.holdH; setState('JEDA SEBELUM PRODUKSI', 'warn');
    var H = R.holdH;
    zones.forEach(function (z) {
      var nutrient = (0.7 * z.Ro + 0.3 * z.Rm) / (0.7 * z.Ro + 0.3 * z.Rm + 0.03);
      z.logM0 = z.logM; z.logM1 = Math.min(9, z.logM + 0.4343 * 1.0 * nutrient * H);
    });
    S.holdAnim = 0; applyFluidVisual();
  }
  function startBatchB() {
    S.phase = 'PRODB'; S.tB = 0; S.cfu = 0; S.mg = 0; S.contrib = {}; S.T = 20; setState('PRODUKSI BATCH B', 'info'); applyFluidVisual();
  }
  function finishBatch() {
    S.phase = 'DONE'; applyFluidVisual();
    var atpOk = SLOTS.every(function (s) { return S.atp[s.id] < LIM.atp; }), condOk = S.finalCond == null || S.finalCond < LIM.cond;
    var micOk = S.cfu <= LIM.cfu, ppmOk = S.mg <= LIM.ppm;
    var v = (!micOk || !ppmOk) ? 'bad' : ((!atpOk || !condOk) ? 'warn' : 'ok');
    S.verdict = v;
    var worst = null, wv = -1; SLOTS.forEach(function (s) { var c = S.contrib[s.id]; if (c) { var sc = c.cfu / LIM.cfu + c.mg / LIM.ppm; if (sc > wv) { wv = sc; worst = s; } } });
    var tot = 0; SLOTS.forEach(function (s) { var c = S.contrib[s.id]; if (c) tot += c.cfu / LIM.cfu + c.mg / LIM.ppm; });
    var b = $('banner');
    if (v === 'ok') { b.className = 'banner ok'; b.innerHTML = 'BATCH B LULUS<small>Semua titik bersih setelah CIP &mdash; tidak ada kontaminasi produk.</small>'; setState('BATCH B LULUS', 'ok'); }
    else if (v === 'warn') { b.className = 'banner warn'; b.innerHTML = 'BATCH B DITAHAN &mdash; CIP TIDAK TERVALIDASI<small>Produk belum tercemar signifikan, tetapi swab ATP / konduktivitas gagal: ulangi CIP.</small>'; setState('DITAHAN', 'warn'); }
    else {
      b.className = 'banner bad'; setState('BATCH B DITOLAK', 'bad');
      b.innerHTML = 'BATCH B DITOLAK &mdash; KONTAMINASI<small>' + (worst ? 'Sumber utama: ' + worst.tag + ' (' + (100 * wv / Math.max(tot, 1e-9)).toFixed(0) + '% kontribusi) — ' + CLS[worst.variants[slotState[worst.id].vi].cls].tag.toLowerCase() + '.' : '') + '</small>';
    }
    setTimeout(function () { if (b.className.indexOf('bad') < 0) b.className = 'banner'; }, 9000);
    refreshAll();
  }

  /* ----------------------------------------------------------------- UI */
  function setState(txt, cls) { var b = $('state-badge'); b.textContent = txt; b.className = 'badge ' + (cls || ''); }
  function resetCycle(silent) {
    zones.forEach(function (z) { z.Ro = 1; z.Rm = 1; z.logM = 5; z.chem = 0; }); baseZone.Ro = 1; baseZone.Rm = 1; baseZone.logM = 5; baseZone.chem = 0;
    S.phase = 'SOILED'; S.steps = []; S.i = 0; S.tStep = 0; S.tSim = 0; S.tChart = 0; S.T = 20; S.Sc = 0.3; S.cond = 0.3; S.tB = 0; S.cfu = 0; S.mg = 0; S.contrib = {}; S.atp = null; S.verdict = null; S.finalCond = null;
    chart.clear(); $('btn-next').style.display = 'none'; $('banner').className = 'banner';
    shed.clear(); spray.clear();
    setState('JALUR KOTOR', 'bad'); applyFluidVisual(); refreshAll();
  }
  function runCycle() {
    if (S.phase !== 'SOILED') resetCycle();
    S.steps = buildSteps(); S.i = 0; S.tStep = 0; S.phase = 'CIP'; S.T = 20; S.tSim = 0; S.tChart = 0; S.finalCond = null; chart.clear();
    setState('CIP BERJALAN', 'info'); buildStepsUI(); applyFluidVisual(); refreshAll();
  }
  function buildStepsUI() {
    var box = $('steps'); box.innerHTML = '';
    S.steps.forEach(function (st, i) {
      var d = document.createElement('div'); d.className = 'row-bar'; d.innerHTML = '<div class="hd"><span>' + (i + 1) + '. ' + st.name + '</span><b id="stp-t' + i + '">' + Math.round(st.dur / 60) + ' mnt</b></div><div class="bar"><i id="stp-b' + i + '"></i></div>';
      box.appendChild(d);
    });
  }
  function fmtT(sec) { var m = Math.floor(sec / 60), s = Math.floor(sec % 60); return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function buildInstUI() {
    var box = $('inst-list'); box.innerHTML = '';
    SLOTS.forEach(function (sl) {
      var d = document.createElement('div'); d.className = 'slot-row'; d.style.marginTop = '7px';
      var opts = sl.variants.map(function (v, i) { return '<option value="' + i + '">' + v.name + '</option>'; }).join('');
      d.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px"><b style="font-size:12.5px;color:#fff">' + sl.tag + ' &middot; ' + sl.title + '</b><span class="tag" id="tg-' + sl.id + '"></span></div><select id="sel-' + sl.id + '">' + opts + '</select>';
      box.appendChild(d);
      var sel = d.querySelector('select'); sel.value = slotState[sl.id].vi;
      sel.onchange = function () { installSlot(sl, parseInt(sel.value, 10)); select(sl.id); resetCycle(); syncTags(); };
      sel.onfocus = function () { select(sl.id); };
    });
    syncTags();
  }
  function syncTags() {
    SLOTS.forEach(function (sl) { var c = CLS[sl.variants[slotState[sl.id].vi].cls]; var t = $('tg-' + sl.id); t.textContent = c.tag; t.className = 'tag ' + c.cls; });
  }
  function select(id) { S.sel = id; renderInfo(); var sl = SLOTS.filter(function (s) { return s.id === id; })[0]; }
  function renderInfo() {
    var sl = SLOTS.filter(function (s) { return s.id === S.sel; })[0], st = slotState[sl.id], v = sl.variants[st.vi], c = CLS[v.cls];
    var h = '<h4>' + sl.tag + ' &mdash; ' + v.name + ' <span class="tag ' + c.cls + '">' + c.tag + '</span></h4><p><code>' + v.spec + '</code></p><p>' + v.why + '</p>';
    h += '<h4>TITIK RESIDU PADA INSTRUMEN INI</h4><table class="mini"><thead><tr><th>Lokasi</th><th>X</th><th>Sisa</th></tr></thead><tbody>';
    st.zones.forEach(function (z) { var rt = 0.7 * z.Ro + 0.3 * z.Rm; h += '<tr><td>' + z.name + '</td><td>' + idc(z.X, 2) + '</td><td>' + idc(rt * 100, rt < .1 ? 1 : 0) + '%</td></tr>'; });
    h += '</tbody></table><p class="note"><b>X</b> = aksesibilitas aliran CIP ke titik itu (1 = tersapu penuh, mendekati 0 = dead-leg / celah). Laju pembersihan = k(langkah, suhu, konsentrasi, kecepatan) &times; X.</p>';
    h += '<h4>PRINSIP DESAIN HIGIENIS</h4><ul class="pc"><li>Standar: <b>3-A</b>, <b>EHEDG</b> (Doc. 8/10, tipe EL Class I), <b>ASME BPE</b> (farmasi/bioproses), FDA 21 CFR 110/117, EU 1935/2004.</li><li>316L, permukaan Ra &le; 0,8 &micro;m (food) atau &le; 0,4&ndash;0,5 &micro;m / elektropoles (farmasi).</li><li>Tanpa ulir & celah di sisi proses, tanpa dead-leg (L/D &le; 2), <b>self-draining</b>, sambungan tri-clamp / aseptik (DIN 11864), seal EPDM/PTFE/FKM sesuai FDA.</li></ul>';
    h += '<h4>URUTAN CIP</h4><ul class="pc"><li>Pra-bilas &rarr; kaustik (protein/lemak) &rarr; bilas &rarr; asam (kerak mineral) &rarr; bilas akhir &rarr; sanitasi (air panas / SIP 121&deg;C / asam perasetat).</li><li>Efektivitas = <b>T</b>ime, <b>A</b>ction (kecepatan &ge; 1,5 m/s / spray), <b>C</b>hemistry, <b>T</b>emperature (Sinner). Validasi: konduktivitas balik, swab ATP, TOC (farmasi).</li></ul>';
    $('info-box').innerHTML = h;
  }
  var lastUI = 0;
  function refreshAll() { updateUI(true); }
  function updateUI(force) {
    var now = performance.now(); if (!force && now - lastUI < 120) return; lastUI = now;
    var ph = S.phase, st = S.steps[S.i];
    var stepName = { SOILED: 'PRODUK A SELESAI — JALUR KOTOR', CIP: st ? 'CIP — ' + st.name : 'CIP', CIPDONE: 'CIP SELESAI — MENUNGGU', HOLD: 'JEDA ' + R.holdH + ' JAM (mikroba bisa tumbuh)', PRODB: 'PRODUKSI BATCH B', DONE: 'SIKLUS SELESAI' }[ph];
    $('hdr-step').textContent = stepName; $('hdr-time').textContent = 'T+ ' + fmtT(S.tSim);
    var fl = ph === 'CIP' && st ? FLUID_NAME[st.fluid] : (ph === 'PRODB' ? FLUID_NAME.B : 'kosong (film sisa produk A)');
    $('r-fluid').textContent = fl;
    var active = ph === 'CIP' || ph === 'PRODB';
    $('r-temp').textContent = idc(active ? S.T : 20, 1) + ' °C';
    $('r-cond').textContent = idc(S.cond, 2) + ' mS/cm';
    var vel = ph === 'CIP' ? R.vel : (ph === 'PRODB' ? 1.0 : 0); var q = vel * Math.PI * RI * RI * 3600;
    $('r-flow').textContent = idc(vel, 1) + ' m/s · ' + idc(q, 1) + ' m³/h';
    $('r-pres').textContent = active ? idc(1.0 + 0.9 * vel * vel, 2) + ' bar' : '0,00 bar';
    $('r-lvl').textContent = idc((plant.level || 0) * 100, 0) + ' %';
    // label
    SLOTS.forEach(function (sl) {
      var s = slotState[sl.id], val = { PT: active ? idc(1.0 + 0.9 * vel * vel, 1) + ' bar' : '0 bar', TT: idc(active ? S.T : 20, 0) + '°C', FT: idc(q, 0) + ' m³/h', LT: idc((plant.level || 0) * 100, 0) + '%' }[sl.id];
      s.tagLbl.set(sl.tag + '<small>' + val + '</small>', CLS[sl.variants[s.vi].cls].cls);
    });
    // steps
    if (ph === 'CIP' || S.steps.length) S.steps.forEach(function (stp, i) {
      var b = $('stp-b' + i), t = $('stp-t' + i); if (!b) return;
      var f = i < S.i ? 1 : (i === S.i && ph === 'CIP' ? S.tStep / stp.dur : (ph === 'SOILED' ? 0 : (i < S.i ? 1 : 0)));
      b.style.width = (f * 100).toFixed(0) + '%'; b.parentNode.className = 'bar' + (i === S.i && ph === 'CIP' ? '' : (f >= 1 ? ' ok' : ''));
    });
    // residu bars
    var rb = $('res-bars'); if (!rb.children.length) SLOTS.concat([{ id: 'BASE', tag: 'Pipa & tangki', variants: null }]).forEach(function (sl) {
      var d = document.createElement('div'); d.className = 'row-bar'; d.innerHTML = '<div class="hd"><span>' + sl.tag + (sl.title ? ' &middot; ' + sl.title : '') + '</span><b id="rb-v-' + sl.id + '"></b></div><div class="bar" id="rb-b-' + sl.id + '"><i></i></div>'; rb.appendChild(d);
    });
    var sumMain = 0;
    SLOTS.concat([{ id: 'BASE' }]).forEach(function (sl) {
      var r = sl.id === 'BASE' ? baseFilm() : slotResidue(sl.id); if (sl.id !== 'BASE') sumMain += r;
      var pct = r * 100, b = $('rb-b-' + sl.id); b.firstChild.style.width = Math.min(100, pct).toFixed(1) + '%';
      b.className = 'bar ' + (pct < 3 ? 'ok' : (pct < 25 ? 'warn' : 'bad')); $('rb-v-' + sl.id).textContent = idc(pct, pct < 10 ? 1 : 0) + ' %';
    });
    // ATP
    var ab = $('atp-body'); ab.innerHTML = '';
    SLOTS.forEach(function (sl) {
      var v = S.atp ? S.atp[sl.id] : null, ok = v != null && v < LIM.atp;
      ab.insertAdjacentHTML('beforeend', '<tr><td>' + sl.tag + '</td><td>' + (v == null ? '--' : Math.round(v)) + '</td><td>' + (v == null ? '<span class="tag info">MENUNGGU</span>' : (ok ? '<span class="tag ok">LULUS</span>' : '<span class="tag bad">GAGAL</span>')) + '</td></tr>');
    });
    var vc = $('v-cond'); if (S.finalCond == null) { vc.textContent = '--'; vc.className = ''; } else { vc.textContent = idc(S.finalCond, 2) + ' mS/cm · ' + (S.finalCond < LIM.cond ? 'LULUS' : 'GAGAL'); vc.className = S.finalCond < LIM.cond ? 'ok' : 'bad'; }
    // batch B
    var pp = ph === 'PRODB' ? S.tB / 3600 : (ph === 'DONE' ? 1 : 0);
    $('pb-prog').textContent = Math.round(pp * 100) + ' %'; $('pb-bar').style.width = pp * 100 + '%';
    var hasB = ph === 'PRODB' || ph === 'DONE';
    var cf = $('pb-cfu'), pm = $('pb-ppm'), vd = $('pb-verdict');
    cf.textContent = hasB ? (S.cfu < 10 ? idc(S.cfu, 2) : Math.round(S.cfu)) + ' CFU/mL' : '--'; cf.className = hasB ? (S.cfu > LIM.cfu ? 'bad' : (S.cfu > LIM.cfu * 0.3 ? 'warn' : 'ok')) : '';
    pm.textContent = hasB ? idc(S.mg, 2) + ' ppm' : '--'; pm.className = hasB ? (S.mg > LIM.ppm ? 'bad' : (S.mg > LIM.ppm * 0.3 ? 'warn' : 'ok')) : '';
    vd.textContent = ph === 'DONE' ? { ok: 'LULUS', warn: 'DITAHAN (CIP tak tervalidasi)', bad: 'DITOLAK (tercemar)' }[S.verdict] : (ph === 'PRODB' ? 'berjalan…' : '--');
    vd.className = ph === 'DONE' ? S.verdict : '';
    $('prodb-panel').className = 'panel' + (ph === 'DONE' ? (S.verdict === 'bad' ? ' bad' : (S.verdict === 'ok' ? ' ok' : '')) : '');
    $('res-note').innerHTML = ph === 'SOILED' ? 'Setelah Produk A semua titik <b>100 %</b> kotor. Jalankan CIP dan amati titik mana yang tetap kotor.' : (ph === 'DONE' || ph === 'CIPDONE' ? 'Titik yang <b>masih merah</b> = kotoran tertinggal &rarr; menjadi sumber kontaminasi produk berikutnya.' : '');
    if (force) renderInfo();
    return sumMain;
  }

  function wireUI() {
    function sl(id, sv, key, fmt, cb) {
      var e = $(id); e.oninput = function () { R[key] = parseFloat(e.value); $(sv).innerHTML = fmt(R[key]); if (cb) cb(); };
      e.oninput();
    }
    sl('sl-tc', 'sv-tc', 'Tc', function (v) { return v + ' &deg;C'; });
    sl('sl-conc', 'sv-conc', 'conc', function (v) { return idc(v, 1) + ' %'; });
    sl('sl-vel', 'sv-vel', 'vel', function (v) { return idc(v, 1) + ' m/s'; });
    sl('sl-tcaus', 'sv-tcaus', 'tCaus', function (v) { return v + ' mnt'; });
    sl('sl-hold', 'sv-hold', 'holdH', function (v) { return v + ' jam'; });
    sl('sl-speed', 'sv-speed', 'speed', function (v) { return '&times;' + v; });
    $('chk-acid').onchange = function () { R.acid = this.checked; };
    $('chk-sani').onchange = function () { R.sani = this.checked; };
    $('chk-auto').onchange = function () { R.auto = this.checked; };
    var PRESETS = { good: { PT: 0, TT: 0, FT: 0, LT: 0 }, mix: { PT: 2, TT: 0, FT: 1, LT: 2 }, bad: { PT: 2, TT: 2, FT: 2, LT: 2 } };
    Array.prototype.forEach.call(document.querySelectorAll('[data-preset]'), function (b) {
      b.onclick = function () {
        var p = PRESETS[b.getAttribute('data-preset')];
        SLOTS.forEach(function (sl) { installSlot(sl, p[sl.id]); $('sel-' + sl.id).value = p[sl.id]; });
        syncTags(); resetCycle();
      };
    });
    $('btn-run').onclick = runCycle;
    $('btn-reset').onclick = function () { resetCycle(); };
    $('btn-next').onclick = startHold;
    TW.wireView({ xray: 'btn-xray', labels: 'btn-lbl', slider: 'sl-xop' });
    var br = $('btn-res'); br.onclick = function () { HY.showRes = !HY.showRes; br.classList.toggle('active', HY.showRes); };
    TW.key('R', function () { br.click(); });
    TW.key(' ', function () { if (S.phase === 'SOILED' || S.phase === 'DONE') runCycle(); else resetCycle(); });
    TW.camButtons('cam-btns', [
      { name: 'OVERVIEW', pos: [1.8, 6.6, 17.5], tgt: [1.5, 1.4, -0.3] },
      { name: 'TANGKI &middot; LT', pos: [-2.6, 1.9, 2.4], tgt: [-3.2, 1.45, 0.9] },
      { name: 'PT-101', pos: [0.4, 1.95, 0.75], tgt: [0.3, 1.58, 0] },
      { name: 'TT-101', pos: [1.75, 2.05, 0.8], tgt: [1.62, 1.6, 0] },
      { name: 'FT-101', pos: [2.75, 1.95, 1.0], tgt: [2.75, 1.5, 0] },
      { name: 'SKID CIP', pos: [7.6, 2.7, 4.6], tgt: [7.0, 1.0, 0.1] },
      { name: 'DALAM RUANG', pos: [9.2, 2.3, 4.9], tgt: [-0.5, 1.3, -1.2] },
      { name: 'FILLING', pos: [4.9, 2.2, 4.6], tgt: [3.4, 1.1, 2.1] }
    ]);
    // ganti nama tombol dengan entitas HTML
    Array.prototype.forEach.call($('cam-btns').children, function (b) { b.innerHTML = b.textContent; });
    HY.showRes = true;
  }

  /* ---------------------------------------------------------------- loop */
  var shedAcc = {}, sprayAcc = 0, agitA = 0, hmiAcc = 1;
  var bm4 = new T.Object3D(), bCol = new T.Color(), eCol = new T.Color(0xdde8ee);
  function updateBottles(dt) {
    var b = plant.bot; if (!b) return; if (S.phase === 'PRODB') b.off += dt * 0.32;
    var L = b.x1 - b.x0, sp2 = L / b.n, fx = 3.65;
    bCol.copy(plant.liqMat.color);
    for (var i = 0; i < b.n; i++) {
      var x = b.x0 + ((i * sp2 + b.off) % L), filled = x > fx + 0.1 && (S.phase === 'PRODB' || S.phase === 'DONE');
      bm4.position.set(x, b.y, b.z); bm4.scale.set(1, 1, 1); bm4.updateMatrix(); plant.bottles.setMatrixAt(i, bm4.matrix);
      plant.bottles.setColorAt(i, filled ? bCol : eCol);
      bm4.position.y = b.y + 0.1; bm4.scale.setScalar(filled ? 1 : 0.0001); bm4.updateMatrix(); plant.caps.setMatrixAt(i, bm4.matrix);
    }
    plant.bottles.instanceMatrix.needsUpdate = true; plant.caps.instanceMatrix.needsUpdate = true; if (plant.bottles.instanceColor) plant.bottles.instanceColor.needsUpdate = true;
  }
  function frame(dt) {
    var sdt = dt * R.speed;
    if (S.phase === 'CIP' || S.phase === 'PRODB') advance(sdt);
    if (S.phase === 'HOLD') {
      S.holdAnim += dt; S.tSim += R.holdH * 3600 * dt / 2.2;
      var hk = TW.clamp(S.holdAnim / 2.2, 0, 1); zones.forEach(function (z) { z.logM = TW.lerp(z.logM0, z.logM1, hk); });
      if (S.holdAnim >= 2.2) { zones.forEach(function (z) { z.logM = z.logM1; }); S.tSim = Math.round(S.tSim); startBatchB(); }
    }
    // partikel semprotan (bola spray) saat CIP
    if (plant.spraying !== null && plant.spraying !== undefined) {
      sprayAcc += dt * 260; var n = Math.floor(sprayAcc); sprayAcc -= n;
      var c = new T.Color(plant.spraying).lerp(new T.Color(0xffffff), 0.5), col0 = [c.r, c.g, c.b, 0.8], col1 = [c.r, c.g, c.b, 0.0];
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, e = TW.rand(-0.15, 1.2), sp = TW.rand(2.4, 3.6);
        spray.emit(-3.2, 2.34, 0, Math.cos(a) * Math.cos(e) * sp, -Math.sin(e) * sp * 0.75 + 0.3, Math.sin(a) * Math.cos(e) * sp, TW.rand(0.25, 0.42), 0.05, 0.03, col0, col1, 0, -6);
      }
    }
    spray.update(dt);
    // pelepasan kotoran ke produk B
    if (S.phase === 'PRODB') {
      zones.forEach(function (z) {
        var Rt = 0.7 * z.Ro + 0.3 * z.Rm; var sev = TW.clamp(Rt * Math.log10(1 + z.mass) * 6, 0, 60) * (0.4 + 0.6 * TW.clamp((z.logM - 4) / 5, 0, 1));
        if (sev < 0.4) return;
        shedAcc[z.slot + z.name] = (shedAcc[z.slot + z.name] || 0) + sev * dt; var k = Math.floor(shedAcc[z.slot + z.name]); shedAcc[z.slot + z.name] -= k;
        for (var j = 0; j < k; j++) {
          var brown = Math.random() < 0.55, c0 = brown ? [0.85, 0.32, 0.12, 0.95] : [0.45, 1, 0.3, 0.95], sz = brown ? 0.035 : 0.028;
          if (z.slot === 'LT') shed.emit(-3.2 + TW.rand(-0.06, 0.06), 1.45 + TW.rand(-0.06, 0.06), 0.9 - 0.05, TW.rand(-0.1, 0.1), TW.rand(-0.1, 0.05), -TW.rand(0.2, 0.45), 2.2, sz, sz * 1.5, c0, [c0[0], c0[1], c0[2], 0], 0.2, 0);
          else shed.emit(z.wpos.x + TW.rand(-0.02, 0.02), 1.5 + TW.rand(-0.03, 0.03), TW.rand(-0.03, 0.03), 1.0, 0, 0, 1.5, sz, sz * 1.4, c0, [c0[0], c0[1], c0[2], 0], 0, 0);
        }
      });
    }
    shed.update(dt);
    if (rotors) rotors.forEach(function (r) { r.rotation.z += dt * (S.phase === 'CIP' || S.phase === 'PRODB' ? 9 : 0); });
    agitA += dt * (S.phase === 'PRODB' ? 2.2 : 0); plant.agit.rotation.y = agitA;
    updateBottles(dt);
    plant.v3Led.material.emissive.set(S.phase === 'CIP' ? 0xffc233 : (S.phase === 'PRODB' ? 0x2fd66b : 0x3a7bd5));
    hmiAcc += dt; if (hmiAcc > 0.3) { hmiAcc = 0; drawHMI(); }
    applyFluidVisual();
    updateZoneVisuals(HY.showRes);
    updateUI(false);
    // grafik
    if (S.phase === 'CIP' || S.phase === 'PRODB' || S.phase === 'HOLD') {
      chart._acc = (chart._acc || 0) + dt; if (chart._acc > 0.25) {
        chart._acc = 0; var sum = 0; SLOTS.forEach(function (s) { sum += slotResidue(s.id); });
        chart.push(S.tChart / 60, [(S.phase === 'PRODB' ? 20 : S.T), Math.min(60, S.cond), sum / SLOTS.length * 100]);
      }
    }
    chart.draw(Math.max(S.tChart / 60, 120));
  }

  HY.start = function () {
    TW.init({ bg: 0x1e252c, room: {}, hemi: 0.9, hemiSky: 0xffffff, hemiGround: 0x9aa3a8, sun: 1.5, sunColor: 0xfffaf0, sunDir: [0.25, 1.0, 0.4], fill: 0.25, cam: [1.8, 6.6, 17.5], target: [1.5, 1.4, -0.3], shadowSize: 11, shadowCenter: [1.5, 0, 0.5], exposure: 1.0, maxDist: 60 });
    buildPlant();
    baseZone = { slot: 'BASE', X: 1.0, mass: 1, Ro: 1, Rm: 1, logM: 5, chem: 0 };
    SLOTS.forEach(function (sl) { slotState[sl.id] = { vi: 0, group: null, labels: [], zones: [] }; });
    SLOTS.forEach(function (sl) { installSlot(sl, slotState[sl.id].vi); });
    chart = new TW.Chart($('trend-canvas'), { series: [{ name: 'Suhu °C', color: '#ffd27f', min: 0, max: 100 }, { name: 'Konduktivitas', color: '#5cf0ff', min: 0, max: 60 }, { name: 'Residu %', color: '#ff5d6c', min: 0, max: 100 }], span: 120, legend: true, tunit: 'm', fmt: function (v) { return v.toFixed(0); } });
    wireUI(); buildInstUI(); select('LT');
    TW.ics({ title: '3D TWIN \u00B7 INSTRUMENT HYGIENIC &amp; PROSES CIP', extra: 'Nilai residu, ATP, mikroba dan batas terima adalah ilustrasi; validasi CIP nyata mengikuti prosedur pabrik, 3-A/EHEDG/ASME BPE dan regulasi setempat.' });
    TW.onUpdate(frame);
    resetCycle();
    TW.start();
  };
  return HY;
})();
