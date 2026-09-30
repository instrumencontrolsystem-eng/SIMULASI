/* ICS Cademy — Site Kit untuk 3D Twin: tekstur prosedural, material, dan aset lapangan yang realistis
   (struktur baja, grating, platform, tangga, pipe rack, bejana, pompa, valve, transmitter, JB, cable tray, lampu, orang).
   Semua aset statis digabung per material (Batch) agar ringan: ratusan komponen = beberapa draw call saja. */
var SK = (function () {
  'use strict';
  var T = THREE, SK = {};
  var UP = new T.Vector3(0, 1, 0);
  function v3(a) { return a && a.isVector3 ? a.clone() : new T.Vector3(a[0], a[1], a[2]); }
  SK.v3 = v3;
  SK.rng = function (seed) { var a = seed >>> 0 || 1; return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  /* ================================================================ TEKSTUR */
  var cache = {};
  function once(k, fn) { return cache[k] || (cache[k] = fn()); }
  function cv(w, h, fn) { var c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
  function tex(c, srgb) { var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; if (srgb !== false) t.encoding = T.sRGBEncoding; return t; }
  function blot(g, r, w, h, n, rmin, rmax, cols) {
    for (var i = 0; i < n; i++) {
      var x = r() * w, y = r() * h, rad = rmin + r() * (rmax - rmin), gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, cols[Math.floor(r() * cols.length)]); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  function speck(g, r, w, h, n, dark, light, big) {
    for (var i = 0; i < n; i++) { var d = r() < 0.5, s = r() < (big || 0.1) ? 2 : 1; g.fillStyle = d ? 'rgba(20,20,20,' + (dark * (0.3 + r() * 0.7)).toFixed(3) + ')' : 'rgba(255,255,255,' + (light * (0.3 + r() * 0.7)).toFixed(3) + ')'; g.fillRect(r() * w, r() * h, s, s); }
  }
  var TX = SK.tex = {};
  TX.concrete = function () {
    return once('concrete', function () {
      var r = SK.rng(11);
      return tex(cv(1024, 1024, function (g, w, h) {
        g.fillStyle = '#a3a39e'; g.fillRect(0, 0, w, h);
        blot(g, r, w, h, 90, 40, 190, ['rgba(70,68,60,0.10)', 'rgba(255,255,248,0.08)', 'rgba(120,110,90,0.07)']);
        speck(g, r, w, h, 42000, 0.22, 0.16, 0.08);
        for (var i = 0; i < 7; i++) { var x = r() * w, y = r() * h, rx = 20 + r() * 90, ry = 10 + r() * 50; g.fillStyle = 'rgba(40,36,30,' + (0.05 + r() * 0.1) + ')'; g.beginPath(); g.ellipse(x, y, rx, ry, r() * 3, 0, Math.PI * 2); g.fill(); }
        g.lineWidth = 1.3;
        for (i = 0; i < 6; i++) { var cx = r() * w, cy = r() * h; g.strokeStyle = 'rgba(35,35,35,' + (0.25 + r() * 0.25) + ')'; g.beginPath(); g.moveTo(cx, cy); for (var k = 0; k < 16; k++) { cx += (r() - 0.5) * 34; cy += (r() - 0.35) * 26; g.lineTo(cx, cy); } g.stroke(); }
        g.fillStyle = 'rgba(28,28,28,0.65)'; g.fillRect(0, 0, w, 5); g.fillRect(0, 0, 5, h);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 5, w, 2); g.fillRect(5, 0, 2, h);
      }));
    });
  };
  TX.gravel = function () {
    return once('gravel', function () {
      var r = SK.rng(23);
      return tex(cv(1024, 1024, function (g, w, h) {
        g.fillStyle = '#6f6a62'; g.fillRect(0, 0, w, h);
        blot(g, r, w, h, 60, 60, 220, ['rgba(40,35,30,0.12)', 'rgba(200,190,170,0.08)']);
        var cols = ['#8a857c', '#9c968b', '#5d5850', '#7a7063', '#a8a195', '#4d4943', '#8d7f6c'];
        for (var i = 0; i < 26000; i++) {
          var x = r() * w, y = r() * h, s = 1.2 + r() * 3.4;
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x + 0.8, y + 0.9, s, s * 0.75, r() * 3, 0, 6.3); g.fill();
          g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath(); g.ellipse(x, y, s, s * 0.75, r() * 3, 0, 6.3); g.fill();
        }
        speck(g, r, w, h, 8000, 0.25, 0.25, 0.2);
      }));
    });
  };
  TX.epoxy = function (base) {
    return once('epoxy' + base, function () {
      var r = SK.rng(31);
      return tex(cv(512, 512, function (g, w, h) {
        g.fillStyle = base || '#b7bdbc'; g.fillRect(0, 0, w, h);
        blot(g, r, w, h, 40, 50, 160, ['rgba(0,0,0,0.045)', 'rgba(255,255,255,0.05)']);
        speck(g, r, w, h, 9000, 0.10, 0.12, 0.02);
      }));
    });
  };
  TX.grating = function () {
    return once('grating', function () {
      return tex(cv(256, 256, function (g, w, h) {
        g.clearRect(0, 0, w, h);
        for (var x = 0; x < w; x += 16) { g.fillStyle = '#d7dadc'; g.fillRect(x, 0, 4, h); g.fillStyle = '#9aa0a4'; g.fillRect(x + 3, 0, 1, h); }
        for (var y = 0; y < h; y += 64) { g.fillStyle = '#c9cdd0'; g.fillRect(0, y, w, 3); }
      }));
    });
  };
  TX.brushed = function () {
    return once('brushed', function () {
      var r = SK.rng(41);
      return tex(cv(512, 512, function (g, w, h) {
        g.fillStyle = '#c4c9cd'; g.fillRect(0, 0, w, h);
        for (var i = 0; i < 5000; i++) { var y = r() * h, x = r() * w, L = 30 + r() * 300; g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,' + (0.02 + r() * 0.05) + ')' : 'rgba(60,65,70,' + (0.02 + r() * 0.04) + ')'; g.fillRect(x, y, L, 1); g.fillRect(x - w, y, L, 1); }
        blot(g, r, w, h, 12, 60, 180, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.04)']);
      }));
    });
  };
  TX.grime = function () {
    return once('grime', function () {
      var r = SK.rng(53);
      return tex(cv(512, 512, function (g, w, h) {
        g.fillStyle = '#eeeeec'; g.fillRect(0, 0, w, h);
        blot(g, r, w, h, 70, 20, 110, ['rgba(80,70,55,0.07)', 'rgba(255,255,255,0.08)', 'rgba(60,60,60,0.05)']);
        for (var i = 0; i < 90; i++) { var x = r() * w, y = r() * h * 0.6, L = 40 + r() * 200; var gr = g.createLinearGradient(0, y, 0, y + L); gr.addColorStop(0, 'rgba(70,60,45,' + (0.03 + r() * 0.06) + ')'); gr.addColorStop(1, 'rgba(70,60,45,0)'); g.fillStyle = gr; g.fillRect(x, y, 1 + r() * 3, L); }
        speck(g, r, w, h, 7000, 0.07, 0.06, 0.05);
      }));
    });
  };
  TX.hazard = function () {
    return once('hazard', function () {
      return tex(cv(256, 64, function (g, w, h) {
        g.fillStyle = '#f2c200'; g.fillRect(0, 0, w, h); g.fillStyle = '#111';
        for (var x = -64; x < w + 64; x += 64) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 32, h); g.lineTo(x + 64 + 32, 0); g.lineTo(x + 64, 0); g.closePath(); g.fill(); }
      }));
    });
  };
  TX.wallPanel = function () {
    return once('wallpanel', function () {
      var r = SK.rng(61);
      return tex(cv(512, 512, function (g, w, h) {
        var gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#e9eceb'); gr.addColorStop(0.5, '#f3f5f4'); gr.addColorStop(1, '#e9eceb');
        g.fillStyle = gr; g.fillRect(0, 0, w, h); speck(g, r, w, h, 2500, 0.04, 0.05);
        [0, 256].forEach(function (x) { g.fillStyle = 'rgba(110,118,122,0.55)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x + 3, 0, 2, h); });
      }));
    });
  };
  TX.cladding = function () {
    return once('cladding', function () {
      var r = SK.rng(71);
      return tex(cv(512, 512, function (g, w, h) {
        g.fillStyle = '#c9ced1'; g.fillRect(0, 0, w, h);
        for (var y = 0; y < h; y += 128) { g.fillStyle = 'rgba(40,45,50,0.45)'; g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, y + 3, w, 2); g.fillStyle = 'rgba(90,95,100,0.35)'; g.fillRect(0, y + 40, w, 5); }
        blot(g, r, w, h, 30, 30, 120, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.06)']);
        g.fillStyle = 'rgba(60,65,70,0.35)'; g.fillRect(w * 0.7, 0, 2, h);
      }));
    });
  };
  TX.ribPanel = function (base) {
    return once('rib' + base, function () {
      var r = SK.rng(81);
      return tex(cv(512, 512, function (g, w, h) {
        g.fillStyle = base || '#d9d6cf'; g.fillRect(0, 0, w, h);
        for (var x = 0; x < w; x += 32) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(x, 0, 6, h); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 6, 0, 3, h); }
        blot(g, r, w, h, 40, 30, 140, ['rgba(80,70,50,0.07)', 'rgba(255,255,255,0.05)']);
        for (var i = 0; i < 60; i++) { var x2 = r() * w, y2 = r() * h * 0.5, L = 50 + r() * 220; var gr = g.createLinearGradient(0, y2, 0, y2 + L); gr.addColorStop(0, 'rgba(90,70,50,0.07)'); gr.addColorStop(1, 'rgba(90,70,50,0)'); g.fillStyle = gr; g.fillRect(x2, y2, 2, L); }
      }));
    });
  };
  TX.asphalt = function () {
    return once('asphalt', function () {
      var r = SK.rng(91);
      return tex(cv(512, 512, function (g, w, h) {
        g.fillStyle = '#4a4c4f'; g.fillRect(0, 0, w, h); blot(g, r, w, h, 40, 40, 160, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.05)']);
        speck(g, r, w, h, 30000, 0.3, 0.25, 0.15);
      }));
    });
  };
  TX.fence = function () {
    return once('fence', function () {
      return tex(cv(128, 128, function (g, w, h) {
        g.clearRect(0, 0, w, h); g.strokeStyle = '#c3c7c9'; g.lineWidth = 3;
        for (var k = -w; k < w * 2; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
      }));
    });
  };
  TX.platePack = function () {
    return once('platepack', function () {
      return tex(cv(256, 64, function (g, w, h) {
        g.fillStyle = '#b8bec2'; g.fillRect(0, 0, w, h);
        for (var x = 0; x < w; x += 4) { g.fillStyle = 'rgba(40,45,50,0.55)'; g.fillRect(x, 0, 1, h); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x + 1, 0, 1, h); }
      }));
    });
  };
  /* papan teks (rambu, papan nama) */
  SK.signTex = function (w, h, fn) { var t = tex(cv(w, h, fn)); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; return t; };

  /* =============================================================== MATERIAL */
  var MT = SK.mat = {};
  function std(o) { return new T.MeshStandardMaterial(o); }
  MT.paint = function (hex, rough, metal) { return once('p' + hex + '_' + rough + '_' + metal, function () { return std({ color: hex, map: TX.grime(), roughness: rough == null ? 0.55 : rough, metalness: metal == null ? 0.25 : metal, envMapIntensity: 0.7 }); }); };
  MT.galv = function () { return once('galv', function () { return std({ color: 0xaeb4b8, map: TX.grime(), roughness: 0.42, metalness: 0.7, envMapIntensity: 0.9 }); }); };
  MT.ss = function () { return once('ss', function () { return std({ color: 0xf2f4f6, map: TX.brushed(), roughness: 0.3, metalness: 0.92, envMapIntensity: 1.0 }); }); };
  MT.ssPol = function () { return once('sspol', function () { return std({ color: 0xe3e8ec, roughness: 0.1, metalness: 1.0, envMapIntensity: 1.1 }); }); };
  MT.steel = function () { return once('steel', function () { return std({ color: 0x8e959a, map: TX.grime(), roughness: 0.45, metalness: 0.75 }); }); };
  MT.dark = function () { return once('dark', function () { return std({ color: 0x2a2d30, roughness: 0.6, metalness: 0.4 }); }); };
  MT.rubber = function () { return once('rubber', function () { return std({ color: 0x1a1a1a, roughness: 0.85, metalness: 0 }); }); };
  MT.yellow = function () { return MT.paint(0xe8b800, 0.5, 0.15); };
  MT.red = function () { return MT.paint(0xb3261e, 0.45, 0.15); };
  MT.glass = function () { return once('glass', function () { return std({ color: 0x1b2a33, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.3, transparent: true, opacity: 0.55 }); }); };
  MT.lamp = function (hex) { return once('lamp' + hex, function () { return std({ color: 0xffffff, emissive: hex || 0xfff3d6, emissiveIntensity: 1.6, roughness: 0.3 }); }); };
  MT.concrete = function () { return once('concreteM', function () { return std({ color: 0xffffff, map: TX.concrete(), roughness: 0.92, metalness: 0, envMapIntensity: 0.25 }); }); };
  MT.gravel = function () { return once('gravelM', function () { return std({ color: 0xffffff, map: TX.gravel(), roughness: 1, metalness: 0, envMapIntensity: 0.15 }); }); };
  MT.grating = function () { return once('gratingM', function () { return std({ color: 0xb4bbbf, map: TX.grating(), alphaTest: 0.5, side: T.DoubleSide, roughness: 0.5, metalness: 0.7 }); }); };
  MT.cladding = function () { return once('cladM', function () { return std({ color: 0xffffff, map: TX.cladding(), roughness: 0.35, metalness: 0.8, envMapIntensity: 0.9 }); }); };
  MT.hazard = function () { return once('hazM', function () { return std({ color: 0xffffff, map: TX.hazard(), roughness: 0.55, metalness: 0.1 }); }); };

  /* ================================================================== BATCH */
  function toNI(g) { return g.index ? g.toNonIndexed() : g; }
  function merge(list) {
    var n = 0; list.forEach(function (g) { n += g.attributes.position.count; });
    var P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), o = 0;
    list.forEach(function (g) {
      var p = g.attributes.position, nn = g.attributes.normal, uu = g.attributes.uv;
      P.set(p.array.subarray ? p.array.subarray(0, p.count * 3) : p.array, o * 3);
      if (nn) N.set(nn.array.subarray(0, p.count * 3), o * 3);
      if (uu) U.set(uu.array.subarray(0, p.count * 2), o * 2);
      o += p.count;
    });
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('normal', new T.BufferAttribute(N, 3)); geo.setAttribute('uv', new T.BufferAttribute(U, 2));
    geo.computeBoundingSphere(); geo.computeBoundingBox(); return geo;
  }
  SK.merge = merge;
  function scaleUV(g, su, sv) { var uv = g.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }
  SK.scaleUV = scaleUV;
  var _e = new T.Euler(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3();
  function M4(x, y, z, rx, ry, rz, sx, sy, sz) {
    _p.set(x || 0, y || 0, z || 0); _q.setFromEuler(_e.set(rx || 0, ry || 0, rz || 0)); _s.set(sx == null ? 1 : sx, sy == null ? (sx == null ? 1 : sx) : sy, sz == null ? (sx == null ? 1 : sx) : sz);
    return new T.Matrix4().compose(_p, _q, _s);
  }
  SK.M4 = M4;
  function Batch() { this.g = {}; this.order = []; this.base = new T.Matrix4(); this.stack = []; }
  Batch.prototype.add = function (geo, mat, m4) {
    var k = mat.uuid, e = this.g[k];
    if (!e) { e = this.g[k] = { mat: mat, list: [] }; this.order.push(k); }
    var g = toNI(geo); if (g === geo) g = geo.clone();
    var m = this.base.clone(); if (m4) m.multiply(m4); g.applyMatrix4(m);
    e.list.push(g); return this;
  };
  Batch.prototype.at = function (m4, fn) { this.stack.push(this.base.clone()); this.base.multiply(m4); fn(this); this.base = this.stack.pop(); return this; };
  Batch.prototype.box = function (mat, w, h, d, x, y, z, rx, ry, rz) { return this.add(new T.BoxGeometry(w, h, d), mat, M4(x, y, z, rx, ry, rz)); };
  Batch.prototype.cyl = function (mat, r0, r1, h, x, y, z, rx, ry, rz, seg, open) { return this.add(new T.CylinderGeometry(r0, r1, h, seg || 20, 1, !!open), mat, M4(x, y, z, rx, ry, rz)); };
  Batch.prototype.cylX = function (mat, r, h, x, y, z, seg) { return this.cyl(mat, r, r, h, x, y, z, 0, 0, Math.PI / 2, seg); };
  Batch.prototype.cylZ = function (mat, r, h, x, y, z, seg) { return this.cyl(mat, r, r, h, x, y, z, Math.PI / 2, 0, 0, seg); };
  Batch.prototype.sph = function (mat, r, x, y, z, seg, sx, sy, sz) { return this.add(new T.SphereGeometry(r, seg || 16, Math.max(6, Math.round((seg || 16) * 0.6))), mat, M4(x, y, z, 0, 0, 0, sx, sy, sz)); };
  Batch.prototype.torus = function (mat, R, r, x, y, z, rx, ry, rz, arc, seg) { return this.add(new T.TorusGeometry(R, r, 8, seg || 32, arc || Math.PI * 2), mat, M4(x, y, z, rx, ry, rz)); };
  Batch.prototype.lathe = function (mat, prof, x, y, z, rx, ry, rz, seg) { return this.add(new T.LatheGeometry(prof.map(function (p) { return new T.Vector2(p[0], p[1]); }), seg || 32), mat, M4(x, y, z, rx, ry, rz)); };
  Batch.prototype.geo = function (mat, geo, m4) { return this.add(geo, mat, m4); };
  Batch.prototype.rod = function (mat, p0, p1, r, seg, r1) {
    var a = v3(p0), b = v3(p1), d = b.clone().sub(a), L = d.length(); if (L < 1e-5) return this;
    var q = new T.Quaternion().setFromUnitVectors(UP, d.normalize());
    return this.add(new T.CylinderGeometry(r1 == null ? r : r1, r, L, seg || 12, 1, false), mat, new T.Matrix4().compose(a.add(b).multiplyScalar(0.5), q, new T.Vector3(1, 1, 1)));
  };
  Batch.prototype.tube = function (mat, pts, r, bend, radSeg) {
    var path = TW.roundedPath(pts, bend == null ? r * 3 : bend), L = path.getLength();
    return this.add(new T.TubeGeometry(path, Math.max(8, Math.round(L / 0.08)), r, radSeg || 14, false), mat);
  };
  Batch.prototype.plane = function (mat, w, d, x, y, z, rx, ry, rz, su, sv) { var g = new T.PlaneGeometry(w, d); if (su) scaleUV(g, su, sv || su); return this.add(g, mat, M4(x, y, z, rx == null ? -Math.PI / 2 : rx, ry, rz)); };
  /* profil baja: I/H, kanal C, siku L */
  SK.PROF = { W100: { h: .1, b: .1, tw: .006, tf: .008 }, W150: { h: .15, b: .15, tw: .007, tf: .01 }, W200: { h: .2, b: .2, tw: .008, tf: .012 }, W250: { h: .25, b: .25, tw: .009, tf: .014 }, W300: { h: .3, b: .3, tw: .01, tf: .015 },
    C100: { t: 'C', h: .1, b: .05, tw: .005, tf: .007 }, C150: { t: 'C', h: .15, b: .065, tw: .0065, tf: .009 }, L65: { t: 'L', a: .065, th: .007 }, L50: { t: 'L', a: .05, th: .006 } };
  function profShape(p) {
    var s = new T.Shape();
    if (p.t === 'C') { var h = p.h / 2; s.moveTo(0, -h); s.lineTo(p.b, -h); s.lineTo(p.b, -h + p.tf); s.lineTo(p.tw, -h + p.tf); s.lineTo(p.tw, h - p.tf); s.lineTo(p.b, h - p.tf); s.lineTo(p.b, h); s.lineTo(0, h); }
    else if (p.t === 'L') { s.moveTo(0, 0); s.lineTo(p.a, 0); s.lineTo(p.a, p.th); s.lineTo(p.th, p.th); s.lineTo(p.th, p.a); s.lineTo(0, p.a); }
    else { var hh = p.h / 2, b = p.b / 2, tw = p.tw / 2, tf = p.tf; s.moveTo(-b, -hh); s.lineTo(b, -hh); s.lineTo(b, -hh + tf); s.lineTo(tw, -hh + tf); s.lineTo(tw, hh - tf); s.lineTo(b, hh - tf); s.lineTo(b, hh); s.lineTo(-b, hh); s.lineTo(-b, hh - tf); s.lineTo(-tw, hh - tf); s.lineTo(-tw, -hh + tf); s.lineTo(-b, -hh + tf); }
    return s;
  }
  Batch.prototype.beam = function (mat, p0, p1, prof, up) {
    var a = v3(p0), b = v3(p1), d = b.clone().sub(a), L = d.length(); if (L < 1e-4) return this;
    var geo = new T.ExtrudeGeometry(profShape(typeof prof === 'string' ? SK.PROF[prof] : prof), { depth: L, bevelEnabled: false, steps: 1, curveSegments: 2 });
    var z = d.normalize(), ref = up ? v3(up) : (Math.abs(z.y) > 0.95 ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0));
    var y = ref.clone().sub(z.clone().multiplyScalar(ref.dot(z))).normalize(), x = new T.Vector3().crossVectors(y, z);
    var m = new T.Matrix4().makeBasis(x, y, z); m.setPosition(a);
    return this.add(geo, mat, m);
  };
  Batch.prototype.build = function (parent, o) {
    o = o || {}; var out = [];
    this.order.forEach(function (k) {
      var e = this.g[k], mesh = new T.Mesh(merge(e.list), e.mat);
      mesh.castShadow = o.cast !== false; mesh.receiveShadow = o.receive !== false;
      if (e.mat.alphaTest) mesh.customDepthMaterial = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: e.mat.map, alphaTest: e.mat.alphaTest });
      if (e.mat.transparent) mesh.castShadow = false;
      (parent || TW.get().scene).add(mesh); out.push(mesh);
      e.list.forEach(function (g) { g.dispose(); });
    }, this);
    this.g = {}; this.order = []; return out;
  };
  SK.Batch = Batch;

  /* =========================================================== LINGKUNGAN */
  /* tanah luas: kerikil + area beton */
  SK.ground = function (B, o) {
    o = o || {};
    var S = o.size || 260, g = new T.PlaneGeometry(S, S); scaleUV(g, S / 3.2, S / 3.2);
    var m = new T.Mesh(g, MT.gravel()); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; TW.add(m);
    (o.roads || []).forEach(function (rd) {   // [x0,z0,x1,z1]
      var w = rd[2] - rd[0], d = rd[3] - rd[1], gr = new T.PlaneGeometry(w, d); scaleUV(gr, w / 5, d / 5);
      var mat = once('asphM', function () { return std({ map: TX.asphalt(), roughness: 0.95, metalness: 0 }); });
      B.add(gr, mat, M4((rd[0] + rd[2]) / 2, 0.012, (rd[1] + rd[3]) / 2, -Math.PI / 2));
      var along = w > d, L = along ? w : d;
      for (var t = 2; t < L - 1; t += 6) { var cx2 = along ? rd[0] + t : (rd[0] + rd[2]) / 2, cz2 = along ? (rd[1] + rd[3]) / 2 : rd[1] + t; B.box(MT.paint(0xf2f2ee, 0.7, 0), along ? 3 : 0.15, 0.004, along ? 0.15 : 3, cx2, 0.016, cz2); }
    });
    (o.pads || []).forEach(function (p) {   // [x0,z0,x1,z1,h]
      var w = p[2] - p[0], d = p[3] - p[1], hh = p[4] || 0.12, cx = (p[0] + p[2]) / 2, cz = (p[1] + p[3]) / 2;
      var top = new T.PlaneGeometry(w, d); scaleUV(top, w / 4, d / 4); B.add(top, MT.concrete(), M4(cx, hh, cz, -Math.PI / 2));
      [[w, cx, p[1], Math.PI], [w, cx, p[3], 0], [d, p[0], cz, -Math.PI / 2], [d, p[2], cz, Math.PI / 2]].forEach(function (s) {
        var sg = new T.PlaneGeometry(s[0], hh); scaleUV(sg, s[0] / 4, hh / 4); B.add(sg, MT.concrete(), M4(s[1], hh / 2, s[2], 0, s[3], 0));
      });
      if (p[5]) { // tanggul (bund) keliling
        var bh = p[5], t = 0.2;
        B.box(MT.concrete(), w + t, bh, t, cx, hh + bh / 2, p[1] - t / 2); B.box(MT.concrete(), w + t, bh, t, cx, hh + bh / 2, p[3] + t / 2);
        B.box(MT.concrete(), t, bh, d, p[0] - t / 2, hh + bh / 2, cz); B.box(MT.concrete(), t, bh, d, p[2] + t / 2, hh + bh / 2, cz);
      }
    });
    return m;
  };
  /* siluet kilang/pabrik di kejauhan (tertutup kabut) */
  SK.horizon = function (o) {
    o = o || {}; var B = new Batch(), r = SK.rng(o.seed || 5), mat = MT.paint(o.color || 0xa7b2ba, 0.85, 0.15), R0 = o.r0 || 290, R1 = o.r1 || 420;
    for (var i = 0; i < (o.n || 60); i++) {
      var a = r() * Math.PI * 2; if (o.skip && Math.abs(Math.atan2(Math.sin(a - o.skip[0]), Math.cos(a - o.skip[0]))) < o.skip[1]) continue;
      var R = R0 + r() * (R1 - R0), x = Math.cos(a) * R, z = Math.sin(a) * R, k = r();
      if (k < 0.35) { var h = 14 + r() * 26; B.cyl(mat, 1.0 + r() * 1.2, 1.2 + r() * 1.4, h, x, h / 2, z, 0, 0, 0, 10); B.cyl(mat, 2.2, 2.2, 0.6, x, h * (0.4 + r() * 0.4), z, 0, 0, 0, 10); }
      else if (k < 0.65) { var th = 7 + r() * 8, tr = 9 + r() * 12; B.cyl(mat, tr, tr, th, x, th / 2, z, 0, 0, 0, 24); B.cyl(mat, tr * 0.98, tr * 0.2, 1.4, x, th + 0.7, z, 0, 0, 0, 24); }
      else if (k < 0.8) { var sh = 35 + r() * 35; B.cyl(mat, 0.9, 1.6, sh, x, sh / 2, z, 0, 0, 0, 8); }
      else { var bw = 12 + r() * 16, bh = 4 + r() * 6, bd = 8 + r() * 10; B.box(mat, bw, bh, bd, x, bh / 2, z, 0, a, 0); for (var c = 0; c < 3; c++) B.cyl(mat, 0.25, 0.25, bh + 6, x + (c - 1) * 3, (bh + 6) / 2, z, 0, 0, 0, 6); }
    }
    B.build(null, { cast: false, receive: false });
  };

  /* ====================================================== STRUKTUR BAJA */
  /* pagar pengaman (handrail): tiang, rail atas, rail tengah, toe-board */
  SK.handrail = function (B, segs, o) {
    o = o || {}; var mat = o.mat || MT.yellow(), H = o.h || 1.1;
    segs.forEach(function (sg) {
      var a = v3(sg[0]), b = v3(sg[1]), L = a.distanceTo(b); if (L < 0.05) return;
      var n = Math.max(1, Math.ceil(L / (o.sp || 1.8)));
      for (var i = 0; i <= n; i++) { var p = a.clone().lerp(b, i / n); B.box(mat, 0.045, H, 0.045, p.x, p.y + H / 2, p.z); }
      B.rod(mat, [a.x, a.y + H, a.z], [b.x, b.y + H, b.z], 0.021, 10);
      B.rod(mat, [a.x, a.y + H * 0.52, a.z], [b.x, b.y + H * 0.52, b.z], 0.017, 8);
      if (o.toe !== false && Math.abs(a.y - b.y) < 0.01) { var ang = Math.atan2(b.z - a.z, b.x - a.x); B.box(mat, L, 0.1, 0.008, (a.x + b.x) / 2, a.y + 0.05, (a.z + b.z) / 2, 0, -ang, 0); }
    });
  };
  /* platform grating dengan balok kanal, kolom H, base plate, handrail dan celah tangga */
  SK.platform = function (B, o) {
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, y = o.y, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, st = o.mat || MT.paint(0x56606a, 0.6, 0.3);
    var g = new T.PlaneGeometry(w, d); scaleUV(g, w / 0.5, d / 0.5); B.add(g, MT.grating(), M4(cx, y, cz, -Math.PI / 2));
    var hc = 0.15;
    B.beam(st, [x0, y - hc / 2, z0], [x1, y - hc / 2, z0], 'C150', [0, 1, 0]); B.beam(st, [x1, y - hc / 2, z1], [x0, y - hc / 2, z1], 'C150', [0, 1, 0]);
    B.beam(st, [x0, y - hc / 2, z1], [x0, y - hc / 2, z0], 'C150', [0, 1, 0]); B.beam(st, [x1, y - hc / 2, z0], [x1, y - hc / 2, z1], 'C150', [0, 1, 0]);
    var nj = Math.max(1, Math.round(w / 1.1));
    for (var i = 1; i < nj; i++) { var xj = x0 + w * i / nj; B.beam(st, [xj, y - 0.07, z0], [xj, y - 0.07, z1], 'W100'); }
    if (o.legs !== false) {
      var lx = [x0 + 0.08, x1 - 0.08], lz = [z0 + 0.08, z1 - 0.08]; if (w > 4.5) lx.splice(1, 0, cx);
      lx.forEach(function (x) { lz.forEach(function (z) { SK.column(B, st, x, z, o.y0 || 0, y - hc, 'W150'); }); });
      if (o.brace !== false) { var yb = (o.y0 || 0) + 0.3; B.beam(st, [lx[0], yb + (y - yb) * 0.1, lz[0]], [lx[lx.length - 1], y - 0.4, lz[0]], 'L65'); B.beam(st, [lx[0], yb + (y - yb) * 0.1, lz[1]], [lx[lx.length - 1], y - 0.4, lz[1]], 'L65'); }
    }
    var gaps = o.gaps || [], rails = o.rails || { n: 1, s: 1, e: 1, w: 1 }, segs = [];
    function edge(a, b, key) {
      if (!rails[key]) return; var cut = gaps.filter(function (gp) { return gp.e === key; }).sort(function (p, q) { return p.at - q.at; });
      var A = v3(a), Bv = v3(b), L = A.distanceTo(Bv), dir = Bv.clone().sub(A).normalize(), t = 0;
      cut.forEach(function (gp) { var t0 = gp.at - gp.w / 2, t1 = gp.at + gp.w / 2; if (t0 > t) segs.push([A.clone().addScaledVector(dir, t), A.clone().addScaledVector(dir, t0)]); t = t1; });
      if (t < L) segs.push([A.clone().addScaledVector(dir, t), Bv]);
    }
    edge([x0, y, z1], [x1, y, z1], 's'); edge([x0, y, z0], [x1, y, z0], 'n'); edge([x0, y, z0], [x0, y, z1], 'w'); edge([x1, y, z0], [x1, y, z1], 'e');
    SK.handrail(B, segs, { mat: o.rail });
  };
  SK.column = function (B, mat, x, z, y0, y1, prof) {
    B.beam(mat, [x, y0, z], [x, y1, z], prof || 'W150');
    B.box(mat, 0.3, 0.02, 0.3, x, y0 + 0.01, z);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { B.cyl(MT.dark(), 0.014, 0.014, 0.05, x + s[0] * 0.11, y0 + 0.035, z + s[1] * 0.11, 0, 0, 0, 6); });
  };
  /* tangga monyet dengan kurungan (cage) */
  SK.ladder = function (B, o) {
    var mat = o.mat || MT.yellow(), H = o.y1 - o.y0 + 1.1, W = 0.45;
    B.at(M4(o.x, o.y0, o.z, 0, o.ry || 0, 0), function (b) {
      [-1, 1].forEach(function (s) { b.box(mat, 0.012, H, 0.065, s * W / 2, H / 2, 0); });
      for (var y = 0.3; y < o.y1 - o.y0 + 0.01; y += 0.3) b.rod(mat, [-W / 2, y, 0], [W / 2, y, 0], 0.011, 8);
      if (o.cage !== false && H > 3) {
        for (var yc = 2.3; yc <= H + 0.01; yc += 0.9) { b.torus(mat, 0.36, 0.012, 0, yc, -0.3, -Math.PI / 2, 0, 0, Math.PI, 20); [-1, 1].forEach(function (s) { b.rod(mat, [s * W / 2, yc, 0], [s * 0.36, yc, -0.3], 0.01, 6); }); }
        for (var k = 0; k < 5; k++) { var a = Math.PI * (k + 0.5) / 5; b.box(mat, 0.04, H - 2.3, 0.008, Math.cos(a) * 0.36, 2.3 + (H - 2.3) / 2, -0.3 - Math.sin(a) * 0.36, 0, -a + Math.PI / 2, 0); }
      }
    });
  };
  /* tangga (stairs) dengan stringer, tread grating, handrail miring */
  SK.stairs = function (B, o) {
    var H = o.h, W = o.w || 0.9, n = Math.max(2, Math.round(H / 0.19)), rise = H / n, go = 0.25, L = n * go, mat = o.mat || MT.paint(0x56606a, 0.6, 0.3);
    B.at(M4(o.x, o.y0 || 0, o.z, 0, o.ry || 0, 0), function (b) {
      [-1, 1].forEach(function (s) { b.beam(mat, [0, 0, s * W / 2], [L, H, s * W / 2], 'C150', [0, 1, 0]); });
      for (var i = 1; i <= n; i++) { var g = new T.PlaneGeometry(go, W - 0.04); scaleUV(g, go / 0.5, (W - 0.04) / 0.5); b.add(g, MT.grating(), M4(i * go - go / 2, i * rise - 0.015, 0, -Math.PI / 2)); b.box(mat, 0.03, 0.03, W - 0.03, i * go - 0.015, i * rise - 0.03, 0); }
      SK.handrail(b, [[[0, 0.1, -W / 2 - 0.03], [L, H + 0.1, -W / 2 - 0.03]], [[0, 0.1, W / 2 + 0.03], [L, H + 0.1, W / 2 + 0.03]]], { toe: false, h: 0.95, sp: 1.6, mat: o.rail });
    });
    return { run: L };
  };
  /* pipe rack: kolom H + balok per tier, strut memanjang, knee brace, bracing X, pedestal beton */
  SK.pipeRack = function (B, o) {
    var mat = o.mat || MT.paint(0x4f5b66, 0.6, 0.3), xs = o.xs, zc = o.z || 0, W = o.w || 2.0, lv = o.levels || [3.5, 4.8], top = lv[lv.length - 1];
    xs.forEach(function (x) {
      [-1, 1].forEach(function (s) { var z = zc + s * W / 2; B.box(MT.concrete(), 0.55, 0.35, 0.55, x, 0.175, z); SK.column(B, mat, x, z, 0.35, top + 0.1, 'W250'); });
      lv.forEach(function (y) { B.beam(mat, [x, y - 0.1, zc - W / 2 - 0.13], [x, y - 0.1, zc + W / 2 + 0.13], 'W200'); [-1, 1].forEach(function (s) { B.beam(mat, [x, y - 0.75, zc + s * (W / 2 - 0.12)], [x, y - 0.2, zc + s * (W / 2 - 0.62)], 'L65'); }); });
    });
    for (var i = 0; i < xs.length - 1; i++) {
      [-1, 1].forEach(function (s) {
        var z = zc + s * W / 2; B.beam(mat, [xs[i] + 0.13, top - 0.1, z], [xs[i + 1] - 0.13, top - 0.1, z], 'W150');
        if (i === 0 || o.braceAll) { B.beam(mat, [xs[i] + 0.13, 0.5, z], [xs[i + 1] - 0.13, top - 0.3, z], 'L65'); B.beam(mat, [xs[i] + 0.13, top - 0.3, z], [xs[i + 1] - 0.13, 0.5, z], 'L65'); }
      });
    }
  };
  /* pipa lurus di atas rack (dengan shoe di tiap balok) */
  SK.rackPipe = function (B, o) {
    var mat = o.mat || MT.paint(0x8a929a, 0.5, 0.5), r = o.r;
    B.rod(mat, [o.x0, o.y + r, o.z], [o.x1, o.y + r, o.z], r, 20);
    if (o.clad) { B.rod(MT.cladding(), [o.x0, o.y + r, o.z], [o.x1, o.y + r, o.z], r + 0.04, 20); }
    (o.shoes || []).forEach(function (x) { B.box(MT.steel(), 0.25, 0.08, 0.16, x, o.y + 0.04, o.z); });
    if (o.flanges) o.flanges.forEach(function (x) { SK.flangeAt(B, mat, [x, o.y + r, o.z], [1, 0, 0], r); });
  };

  /* =============================================================== PIPA */
  /* flange (sepasang) + baut di titik p arah dir */
  SK.flangeAt = function (B, mat, p, dir, r, o) {
    o = o || {}; var P = v3(p), D = v3(dir).normalize(), R = Math.max(r * 1.75, r + 0.045), t = Math.max(0.025, r * 0.28);
    var q = new T.Quaternion().setFromUnitVectors(UP, D), mk = function (off, rr, h, seg) { return new T.Matrix4().compose(P.clone().addScaledVector(D, off), q, new T.Vector3(1, 1, 1)); };
    var fm = o.mat || mat;
    B.add(new T.CylinderGeometry(R, R, t, 28), fm, mk(-t / 2 - 0.002)); B.add(new T.CylinderGeometry(R, R, t, 28), fm, mk(t / 2 + 0.002));
    B.add(new T.CylinderGeometry(R * 0.86, r * 1.2, t * 0.9, 20), fm, mk(-t - t * 0.45)); B.add(new T.CylinderGeometry(r * 1.2, R * 0.86, t * 0.9, 20), fm, mk(t + t * 0.45));
    B.add(new T.CylinderGeometry(R * 0.97, R * 0.97, 0.004, 28), MT.dark(), mk(0));
    var nb = r < 0.04 ? 4 : (r < 0.1 ? 8 : 12), bc = (R + r * 1.2) / 2 + 0.01, ref = Math.abs(D.y) > 0.9 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0), u = new T.Vector3().crossVectors(D, ref).normalize(), w = new T.Vector3().crossVectors(D, u);
    for (var i = 0; i < nb; i++) {
      var a = (i + 0.5) / nb * Math.PI * 2, bp = P.clone().addScaledVector(u, Math.cos(a) * bc).addScaledVector(w, Math.sin(a) * bc);
      B.rod(MT.dark(), bp.clone().addScaledVector(D, -t * 1.9), bp.clone().addScaledVector(D, t * 1.9), Math.max(0.007, r * 0.09), 6);
      [-1, 1].forEach(function (s) { B.add(new T.CylinderGeometry(Math.max(0.011, r * 0.15), Math.max(0.011, r * 0.15), Math.max(0.01, r * 0.12), 6), MT.dark(), new T.Matrix4().compose(bp.clone().addScaledVector(D, s * (t + 0.006)), q, new T.Vector3(1, 1, 1))); });
    }
  };
  /* klem tri-clamp higienis */
  SK.triClamp = function (B, p, dir, r) {
    var P = v3(p), D = v3(dir).normalize(), q = new T.Quaternion().setFromUnitVectors(UP, D), ss = MT.ssPol();
    var at = function (off) { return new T.Matrix4().compose(P.clone().addScaledVector(D, off), q, new T.Vector3(1, 1, 1)); };
    B.add(new T.CylinderGeometry(r * 1.32, r * 1.32, 0.012, 28), ss, at(-0.007)); B.add(new T.CylinderGeometry(r * 1.32, r * 1.32, 0.012, 28), ss, at(0.007));
    var tq = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), D);
    B.add(new T.TorusGeometry(r * 1.42, 0.011, 8, 28), MT.ss(), new T.Matrix4().compose(P, tq, new T.Vector3(1, 1, 1)));
    var ref = Math.abs(D.y) > 0.9 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0), u = new T.Vector3().crossVectors(D, ref).normalize();
    B.rod(MT.ss(), P.clone().addScaledVector(u, r * 1.45), P.clone().addScaledVector(u, r * 1.45 + 0.05), 0.008, 6);
    B.sph(MT.ss(), 0.014, P.x + u.x * (r * 1.45 + 0.055), P.y + u.y * (r * 1.45 + 0.055), P.z + u.z * (r * 1.45 + 0.055), 8);
  };
  /* support pipa higienis (tiang stainless bulat + klem) */
  SK.hygSupport = function (B, x, z, y, r) {
    var ss = MT.ss(); B.cyl(ss, 0.03, 0.03, y - r - 0.03, x, (y - r - 0.03) / 2, z, 0, 0, 0, 14);
    B.cyl(ss, 0.06, 0.07, 0.02, x, 0.01, z, 0, 0, 0, 18); B.box(ss, 0.08, 0.02, 0.06, x, y - r - 0.03, z);
    B.torus(MT.ssPol(), r + 0.008, 0.008, x, y, z, 0, Math.PI / 2, 0, Math.PI * 2, 24);
  };
  /* valve gerbang manual (gate valve) — flange, bonnet, yoke, stem, handwheel */
  SK.gateValve = function (B, p, axis, r, o) {
    o = o || {}; var body = o.mat || MT.paint(0x3c4a3e, 0.55, 0.4), hw = o.wheel || MT.red();
    var ax = axis === 'z' ? [0, Math.PI / 2, 0] : (axis === 'y' ? [0, 0, Math.PI / 2] : [0, 0, 0]);
    B.at(M4(p[0], p[1], p[2], ax[0], ax[1], ax[2]), function (b) {
      b.cylX(body, r * 1.25, r * 3.2, 0, 0, 0, 20); b.sph(body, r * 1.55, 0, 0, 0, 20, 1, 1.1, 0.85);
      SK.flangeAt(b, body, [-r * 1.6, 0, 0], [1, 0, 0], r); SK.flangeAt(b, body, [r * 1.6, 0, 0], [1, 0, 0], r);
      var up = o.down ? -1 : 1, hb = r * 2.4;
      b.cyl(body, r * 0.8, r * 1.05, hb, 0, up * (r * 1.3 + hb / 2), 0, 0, 0, 0, 18);
      b.cyl(body, r * 1.15, r * 1.15, 0.03, 0, up * (r * 1.3 + hb), 0, 0, 0, 0, 18);
      var yb = up * (r * 1.3 + hb), yh = r * 2.2 + 0.08;
      [-1, 1].forEach(function (s) { b.box(body, 0.03, yh, 0.04, s * r * 0.65, yb + up * yh / 2, 0); });
      b.cyl(body, r * 0.5, r * 0.5, 0.03, 0, yb + up * yh, 0, 0, 0, 0, 14);
      b.cyl(MT.steel(), 0.012, 0.012, yh + 0.15, 0, yb + up * (yh / 2 + 0.07), 0, 0, 0, 0, 8);
      var wy = yb + up * (yh + 0.04), wr = Math.max(0.12, r * 2.1);
      b.torus(hw, wr, 0.016, 0, wy, 0, Math.PI / 2, 0, 0, Math.PI * 2, 28);
      for (var k = 0; k < 3; k++) { var a = k / 3 * Math.PI * 2; b.rod(hw, [0, wy, 0], [Math.cos(a) * wr, wy, Math.sin(a) * wr], 0.01, 6); }
      b.cyl(hw, 0.03, 0.03, 0.04, 0, wy, 0, 0, 0, 0, 10);
    });
  };
  /* ball valve dengan gear operator (handwheel samping) */
  SK.ballValve = function (B, p, axis, r, o) {
    o = o || {}; var body = o.mat || MT.paint(0x5b6770, 0.5, 0.45);
    var ax = axis === 'z' ? [0, Math.PI / 2, 0] : (axis === 'y' ? [0, 0, Math.PI / 2] : [0, 0, 0]);
    B.at(M4(p[0], p[1], p[2], ax[0], ax[1], ax[2]), function (b) {
      b.sph(body, r * 1.7, 0, 0, 0, 20, 1.15, 1, 1); b.cylX(body, r * 1.2, r * 4, 0, 0, 0, 20);
      SK.flangeAt(b, body, [-r * 2.1, 0, 0], [1, 0, 0], r); SK.flangeAt(b, body, [r * 2.1, 0, 0], [1, 0, 0], r);
      b.cyl(body, r * 0.5, r * 0.6, r * 1.4, 0, r * 2.2, 0, 0, 0, 0, 14);
      if (o.lever) { b.box(MT.red(), r * 5, 0.02, 0.04, r * 2.2, r * 2.9, 0); }
      else { b.box(MT.paint(0x33414f, 0.5, 0.4), r * 1.6, r * 1.1, r * 1.3, 0, r * 3.3, 0); b.cylZ(MT.steel(), 0.012, 0.2, 0, r * 3.3, r * 0.75, 8); b.torus(MT.red(), 0.1, 0.012, 0, r * 3.3, r * 0.75 + 0.1, 0, 0, 0, Math.PI * 2, 20); }
    });
  };

  /* =========================================================== PERALATAN */
  /* bejana horizontal: shell, head 2:1, seam las, saddle, plinth, nozzle */
  SK.hVessel = function (B, o) {
    var mat = o.mat || MT.paint(0xdfe2e0, 0.5, 0.2), R = o.R, L = o.L, c = o.c;
    B.at(M4(c[0], c[1], c[2], 0, o.ry || 0, 0), function (b) {
      if (o.parts !== 'supports') {
      b.cylX(mat, R, L, 0, 0, 0, 48);
      [-1, 1].forEach(function (s) { b.add(new T.SphereGeometry(R, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat, M4(s * L / 2, 0, 0, 0, 0, -s * Math.PI / 2, 1, 0.5, 1)); b.torus(MT.steel(), R + 0.004, 0.007, s * L / 2, 0, 0, 0, Math.PI / 2, 0, Math.PI * 2, 48); });
      for (var xs = -L / 2 + 1.6; xs < L / 2 - 0.5; xs += 1.6) b.torus(MT.steel(), R + 0.004, 0.006, xs, 0, 0, 0, Math.PI / 2, 0, Math.PI * 2, 48);
      }
      var yb = -(c[1] - (o.ground || 0)), sd = o.parts === 'body' ? [] : (o.saddle || [-L * 0.3, L * 0.3]);
      sd.forEach(function (x) {
        var ph = 0.35; b.box(MT.concrete(), 0.6, ph, R * 1.9, x, yb + ph / 2, 0);
        b.box(mat, 0.24, 0.025, R * 1.7, x, yb + ph + 0.0125, 0); b.box(mat, 0.02, -yb - ph - R * 0.55, R * 1.5, x, (yb + ph - R * 0.55) / 2, 0);
        for (var k = -1; k <= 1; k++) b.box(mat, 0.2, -yb - ph - R * 0.6, 0.02, x, (yb + ph - R * 0.6) / 2, k * R * 0.6);
        b.add(new T.CylinderGeometry(R + 0.012, R + 0.012, 0.36, 40, 1, true, Math.PI * 1.12, Math.PI * 0.76), mat, M4(x, 0, 0, 0, 0, Math.PI / 2));
        [-1, 1].forEach(function (s) { b.cyl(MT.dark(), 0.016, 0.016, 0.06, x + 0.07, yb + ph + 0.04, s * R * 0.75, 0, 0, 0, 6); });
      });
      (o.parts === 'supports' ? [] : (o.nozzles || [])).forEach(function (n) {
        var d = v3(n.d || [0, 1, 0]).normalize(), base = v3(n.p), len = n.len || 0.25;
        b.rod(mat, base, base.clone().addScaledVector(d, len), n.r, 16); SK.flangeAt(b, mat, base.clone().addScaledVector(d, len + 0.02), d, n.r);
        if (n.blind) b.add(new T.CylinderGeometry(Math.max(n.r * 1.75, n.r + 0.045), Math.max(n.r * 1.75, n.r + 0.045), 0.03, 28), mat, new T.Matrix4().compose(base.clone().addScaledVector(d, len + 0.07), new T.Quaternion().setFromUnitVectors(UP, d), new T.Vector3(1, 1, 1)));
      });
      if (o.plate) { b.box(MT.ssPol(), 0.4, 0.26, 0.01, o.plate[0], o.plate[1], o.plate[2]); }
    });
  };
  /* pompa sentrifugal proses: baseplate, casing, bearing housing, coupling guard, motor bersirip */
  SK.pump = function (B, o) {
    var cas = o.casing || MT.paint(0x4a6a8a, 0.5, 0.4), mot = o.motor || MT.paint(0x3d5566, 0.5, 0.35), base = MT.paint(0x3a4148, 0.6, 0.3);
    B.at(M4(o.x, o.y || 0, o.z, 0, o.ry || 0, 0), function (b) {
      b.box(MT.concrete(), 2.3, 0.2, 0.9, 0.55, 0.1, 0);
      [-1, 1].forEach(function (s) { b.beam(base, [-0.5, 0.26, s * 0.3], [1.6, 0.26, s * 0.3], 'C150', [0, 1, 0]); });
      b.box(base, 2.1, 0.02, 0.62, 0.55, 0.34, 0);
      b.cylX(cas, 0.24, 0.16, 0, 0.62, 0, 32); b.cylX(cas, 0.2, 0.08, -0.1, 0.62, 0, 28); b.cylX(cas, 0.2, 0.08, 0.1, 0.62, 0, 28);
      b.box(cas, 0.14, 0.28, 0.14, 0, 0.45, 0);
      b.rod(cas, [0, 0.78, 0], [0, 1.0, 0], 0.07, 16); SK.flangeAt(b, cas, [0, 1.02, 0], [0, 1, 0], 0.07);
      b.rod(cas, [-0.14, 0.62, 0], [-0.36, 0.62, 0], 0.085, 16); SK.flangeAt(b, cas, [-0.38, 0.62, 0], [1, 0, 0], 0.085);
      b.cylX(cas, 0.1, 0.34, 0.3, 0.62, 0, 20); b.box(cas, 0.3, 0.25, 0.2, 0.3, 0.46, 0);
      b.add(new T.CylinderGeometry(0.13, 0.13, 0.3, 20, 1, false, 0, Math.PI), MT.paint(0xe07b1a, 0.5, 0.2), M4(0.62, 0.62, 0, 0, 0, Math.PI / 2));
      b.box(MT.paint(0xe07b1a, 0.5, 0.2), 0.3, 0.02, 0.26, 0.62, 0.5, 0);
      var mx = 1.12, ml = 0.62, mr = 0.21;
      b.cylX(mot, mr, ml, mx, 0.64, 0, 32);
      for (var k = 0; k < 20; k++) { var a = k / 20 * Math.PI * 2; if (Math.sin(a) < -0.6) continue; b.box(mot, ml - 0.04, 0.022, 0.006, mx, 0.64 + Math.sin(a) * (mr + 0.01), Math.cos(a) * (mr + 0.01), Math.PI / 2 - a, 0, 0); }
      b.cylX(mot, mr * 1.02, 0.12, mx + ml / 2 + 0.06, 0.64, 0, 32); b.cylX(MT.dark(), mr * 0.85, 0.01, mx + ml / 2 + 0.125, 0.64, 0, 32);
      b.box(mot, 0.2, 0.14, 0.18, mx - 0.05, 0.64 + mr + 0.07, 0);
      b.box(mot, ml * 0.8, 0.12, 0.34, mx, 0.4, 0);
      b.box(MT.ssPol(), 0.1, 0.06, 0.004, mx, 0.64, mr + 0.012);
    });
  };
  /* JB (junction box) dengan tutup, baut dan cable gland */
  SK.jb = function (B, x, y, z, ry, o) {
    o = o || {}; var mat = o.mat || MT.paint(0x8c969e, 0.45, 0.4);
    B.at(M4(x, y, z, 0, ry || 0, 0), function (b) {
      var w = o.w || 0.3, h = o.h || 0.34, d = o.d || 0.16;
      b.box(mat, w, h, d, 0, 0, 0); b.box(mat, w + 0.02, h + 0.02, 0.025, 0, 0, d / 2);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { b.cylZ(MT.steel(), 0.009, 0.012, s[0] * (w / 2 - 0.015), s[1] * (h / 2 - 0.015), d / 2 + 0.014, 6); });
      for (var k = 0; k < (o.glands || 3); k++) { var gx = (k - ((o.glands || 3) - 1) / 2) * 0.07; b.cyl(MT.paint(0x2e2e2e, 0.5, 0.3), 0.017, 0.017, 0.05, gx, -h / 2 - 0.025, 0, 0, 0, 0, 6); }
      b.box(MT.ssPol(), 0.12, 0.035, 0.004, 0, h / 2 - 0.05, d / 2 + 0.014);
    });
  };
  /* cable tray tipe tangga + kabel */
  SK.cableTray = function (B, pts, o) {
    o = o || {}; var W = o.w || 0.3, mat = o.mat || MT.galv(), cab = MT.paint(0x1c1c1c, 0.7, 0.1);
    for (var i = 0; i < pts.length - 1; i++) {
      var a = v3(pts[i]), b = v3(pts[i + 1]), d = b.clone().sub(a), L = d.length(); if (L < 0.01) continue; d.normalize();
      var side = Math.abs(d.y) > 0.9 ? new T.Vector3(1, 0, 0) : new T.Vector3().crossVectors(d, UP).normalize(), upv = new T.Vector3().crossVectors(side, d);
      [-1, 1].forEach(function (s) { var off = side.clone().multiplyScalar(s * W / 2); var m = new T.Matrix4().makeBasis(side, upv, d); m.setPosition(a.clone().add(off).addScaledVector(upv, 0.04).addScaledVector(d, L / 2)); B.add(new T.BoxGeometry(0.004, 0.09, L), mat, m); });
      for (var t = 0.15; t < L; t += 0.3) { var m2 = new T.Matrix4().makeBasis(side, upv, d); m2.setPosition(a.clone().addScaledVector(d, t)); B.add(new T.BoxGeometry(W, 0.012, 0.03), mat, m2); }
      for (var c = 0; c < (o.cables || 3); c++) { var off2 = side.clone().multiplyScalar((c - ((o.cables || 3) - 1) / 2) * 0.035); B.rod(cab, a.clone().add(off2).addScaledVector(upv, 0.02), b.clone().add(off2).addScaledVector(upv, 0.02), 0.011, 8); }
    }
  };
  /* tiang lampu + lampu sorot */
  SK.lightPole = function (B, x, z, h, ry) {
    var g = MT.galv();
    B.box(MT.concrete(), 0.6, 0.3, 0.6, x, 0.15, z); B.cyl(g, 0.07, 0.1, h, x, 0.3 + h / 2, z, 0, 0, 0, 12);
    B.at(M4(x, 0.3 + h, z, 0, ry || 0, 0), function (b) {
      b.rod(g, [0, 0, 0], [0.9, 0.25, 0], 0.035, 8); b.box(MT.paint(0x4a4f55, 0.5, 0.4), 0.45, 0.12, 0.3, 1.05, 0.22, 0);
      b.box(MT.lamp(), 0.38, 0.01, 0.24, 1.05, 0.155, 0);
    });
  };
  /* rambu dari tekstur kanvas */
  SK.sign = function (x, y, z, ry, w, h, draw, post) {
    var t = SK.signTex(512, Math.round(512 * h / w), draw), m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.05 }));
    m.position.set(x, y, z); m.rotation.y = ry || 0; m.castShadow = true; TW.add(m);
    var back = new T.Mesh(new T.BoxGeometry(w + 0.02, h + 0.02, 0.012), MT.galv()); back.position.set(0, 0, -0.008); m.add(back);
    if (post) { var B = new Batch(), bx = x - Math.sin(ry || 0) * 0.03, bz = z - Math.cos(ry || 0) * 0.03; B.cyl(MT.galv(), 0.03, 0.03, y, bx, y / 2, bz, 0, 0, 0, 8); B.box(MT.concrete(), 0.3, 0.1, 0.3, bx, 0.05, bz); B.build(); }
    return m;
  };
  /* pekerja (skala manusia): coverall, rompi reflektif, helm, sepatu */
  SK.human = function (B, x, z, ry, o) {
    o = o || {}; var cov = MT.paint(o.suit || 0xd9531e, 0.85, 0), skin = once('skin', function () { return std({ color: 0xb98466, roughness: 0.75, metalness: 0 }); });
    var hat = MT.paint(o.hat || 0xf5f5f0, 0.35, 0.1), refl = once('refl', function () { return std({ color: 0xd9dde0, roughness: 0.35, metalness: 0.3, emissive: 0x1a1a1a }); }), boot = MT.rubber();
    var pose = o.pose || 'stand';
    B.at(M4(x, 0, z, 0, ry || 0, 0), function (b) {
      [-1, 1].forEach(function (s) {
        b.rod(cov, [s * 0.095, 0.93, 0], [s * 0.1, 0.5, 0.01], 0.072, 12, 0.08); b.rod(cov, [s * 0.1, 0.5, 0.01], [s * 0.1, 0.1, -0.01], 0.058, 12, 0.068);
        b.sph(cov, 0.07, s * 0.1, 0.5, 0.01, 10); b.box(boot, 0.105, 0.1, 0.26, s * 0.1, 0.05, 0.035);
        b.torus(refl, 0.062, 0.009, s * 0.1, 0.3, 0, Math.PI / 2, 0, 0, Math.PI * 2, 16);
      });
      b.add(new T.CylinderGeometry(0.17, 0.165, 0.2, 18), cov, M4(0, 0.97, 0, 0, 0, 0, 1, 1, 0.7));
      b.add(new T.CylinderGeometry(0.195, 0.165, 0.46, 18), cov, M4(0, 1.3, 0, 0, 0, 0, 1, 1, 0.62));
      b.add(new T.SphereGeometry(0.195, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), cov, M4(0, 1.53, 0, 0, 0, 0, 1, 0.35, 0.62));
      [1.18, 1.36].forEach(function (y) { b.add(new T.TorusGeometry(0.185, 0.011, 6, 26), refl, M4(0, y, 0, Math.PI / 2, 0, 0, 1, 0.62, 1)); });
      [-1, 1].forEach(function (s) {
        b.sph(cov, 0.07, s * 0.2, 1.5, 0, 10);
        var elbow = [s * 0.24, 1.2, 0.03], hand = pose === 'point' && s > 0 ? [s * 0.28, 1.38, 0.42] : (pose === 'tablet' ? [s * 0.1, 1.12, 0.3] : [s * 0.25, 0.93, 0.06]);
        if (pose === 'point' && s > 0) elbow = [s * 0.27, 1.37, 0.16]; if (pose === 'tablet') elbow = [s * 0.22, 1.18, 0.12];
        b.rod(cov, [s * 0.2, 1.5, 0], elbow, 0.05, 10, 0.058); b.sph(cov, 0.05, elbow[0], elbow[1], elbow[2], 8);
        b.rod(cov, elbow, hand, 0.042, 10, 0.05); b.sph(skin, 0.042, hand[0], hand[1], hand[2], 10);
      });
      if (pose === 'tablet') b.box(MT.dark(), 0.26, 0.012, 0.18, 0, 1.15, 0.33, -0.5, 0, 0);
      b.cyl(skin, 0.045, 0.05, 0.08, 0, 1.57, 0, 0, 0, 0, 10);
      b.sph(skin, 0.1, 0, 1.68, 0.01, 16, 0.9, 1.08, 1);
      b.add(new T.SphereGeometry(0.118, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), hat, M4(0, 1.71, 0, 0, 0, 0, 1, 0.95, 1.08));
      b.add(new T.CylinderGeometry(0.13, 0.138, 0.012, 22), hat, M4(0, 1.71, 0.012, 0, 0, 0, 1, 1, 1.12));
      b.add(new T.CylinderGeometry(0.06, 0.06, 0.012, 16, 1, false, -Math.PI / 2, Math.PI), hat, M4(0, 1.712, 0.11, 0, 0, 0, 1.3, 1, 1));
    });
  };

  /* ====================================================== TRANSMITTER */
  /* transmitter tekanan realistis (coplanar + housing dua ruang), origin = sambungan proses, naik +Y, layar menghadap +Z.
     style: 'alu' (cat aluminium), 'exd' (cast tebal, tutup berulir), 'ss' (stainless higienis), 'plastic' */
  SK.transmitter = function (o) {
    o = o || {}; var g = new T.Group(), B = new Batch(), style = o.style || 'alu';
    var hm = o.housing || (style === 'ss' ? MT.ssPol() : MT.paint(o.color || 0x2f5d8a, 0.42, 0.35)), sm = MT.ss();
    var R = style === 'exd' ? 0.064 : 0.056, len = style === 'exd' ? 0.15 : 0.13, yH = o.manifold === false ? 0.2 : 0.2;
    if (o.manifold !== false) {
      B.box(sm, 0.1, 0.05, 0.12, 0, 0.025, 0);
      [[-1, 0], [1, 0], [0, 1]].forEach(function (s) {
        var d = new T.Vector3(s[0], 0, s[1]), p0 = new T.Vector3(s[0] * 0.05, 0.025, s[1] * 0.06), p1 = p0.clone().addScaledVector(d, 0.045);
        B.rod(sm, p0, p1, 0.012, 10); var hdir = new T.Vector3(s[1], 0, s[0]);
        B.rod(MT.red(), p1.clone().addScaledVector(hdir, -0.03), p1.clone().addScaledVector(hdir, 0.03), 0.005, 6);
      });
      B.box(sm, 0.09, 0.03, 0.09, 0, 0.065, 0);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { B.cyl(MT.dark(), 0.007, 0.007, 0.04, s[0] * 0.035, 0.07, s[1] * 0.035, 0, 0, 0, 6); });
    }
    var ys = o.manifold === false ? 0.04 : 0.08;
    B.cyl(sm, 0.047, 0.047, 0.07, 0, ys + 0.035, 0, 0, 0, 0, 24); B.torus(MT.steel(), 0.047, 0.004, 0, ys + 0.055, 0, Math.PI / 2, 0, 0, Math.PI * 2, 24);
    B.cyl(sm, 0.024, 0.03, 0.035, 0, ys + 0.087, 0, 0, 0, 0, 16);
    var yh = ys + 0.105 + R;
    B.cylZ(hm, R, len, 0, yh, 0, 28);
    var cl = style === 'exd' ? 0.04 : 0.028, zf = len / 2 + cl;
    [-1, 1].forEach(function (s) {
      var cz = s * (len / 2 + cl / 2);
      B.cylZ(hm, R + (style === 'exd' ? 0.009 : 0.006), cl, 0, yh, cz, 28);
      B.torus(hm, R + 0.004, 0.006, 0, yh, cz + s * 0.006, 0, 0, 0, Math.PI * 2, 28);
      if (style === 'exd') { for (var k = 0; k < 6; k++) B.torus(MT.steel(), R + 0.002, 0.0025, 0, yh, s * (len / 2 - 0.004 - k * 0.005), 0, 0, 0, Math.PI * 2, 28); B.box(MT.dark(), 0.012, 0.012, 0.012, R + 0.012, yh - 0.02, cz); }
    });
    B.cylZ(MT.glass(), R * 0.74, 0.002, 0, yh, zf + 0.003, 24); B.torus(hm, R * 0.76, 0.005, 0, yh, zf + 0.002, 0, 0, 0, Math.PI * 2, 24);
    [-1, 1].forEach(function (s) { B.cylX(hm, 0.018, 0.035, s * (R + 0.012), yh - 0.018, -len * 0.18, 12); });
    B.cylX(MT.paint(0x2b2b2b, 0.5, 0.3), 0.019, 0.04, (o.glandSide || 1) * (R + 0.045), yh - 0.018, -len * 0.18, 6);
    B.cylX(MT.dark(), 0.02, 0.014, -(o.glandSide || 1) * (R + 0.034), yh - 0.018, -len * 0.18, 6);
    B.box(MT.ssPol(), 0.065, 0.002, 0.045, 0, yh + R + 0.001, -0.01);
    B.rod(MT.steel(), [R * 0.6, yh - R * 0.6, 0.02], [R * 0.9, yh - R - 0.05, 0.02], 0.0015, 4); B.box(MT.ssPol(), 0.05, 0.022, 0.002, R * 0.95, yh - R - 0.065, 0.02);
    B.build(g);
    var lcdC = document.createElement('canvas'); lcdC.width = 128; lcdC.height = 64; var lcdT = new T.CanvasTexture(lcdC); lcdT.encoding = T.sRGBEncoding;
    var lcd = new T.Mesh(new T.CircleGeometry(R * 0.66, 24), new T.MeshBasicMaterial({ map: lcdT, toneMapped: false }));
    lcd.position.set(0, yh, zf + 0.001); g.add(lcd);
    function setLCD(txt, sub, col) {
      var c = lcdC.getContext('2d'); c.fillStyle = col || '#9fbfa3'; c.fillRect(0, 0, 128, 64); c.fillStyle = '#111'; c.font = 'bold 26px monospace'; c.textAlign = 'center'; c.fillText(txt, 64, 34); c.font = '13px monospace'; c.fillText(sub || '', 64, 54); lcdT.needsUpdate = true;
    }
    setLCD(o.lcd || '0.00', o.lcdSub || 'bar');
    g.userData = { yh: yh, R: R, len: len, zf: zf, setLCD: setLCD, housing: hm };
    return g;
  };
  /* dudukan pipa 2" untuk instrumen */
  SK.pipeStand = function (B, x, z, h, o) {
    o = o || {}; var g = MT.galv();
    B.box(MT.concrete(), 0.4, 0.15, 0.4, x, 0.075 + (o.y0 || 0), z); B.box(g, 0.25, 0.015, 0.25, x, 0.16 + (o.y0 || 0), z);
    B.cyl(g, 0.03, 0.03, h, x, (o.y0 || 0) + 0.16 + h / 2, z, 0, 0, 0, 12); B.cyl(g, 0.034, 0.034, 0.02, x, (o.y0 || 0) + 0.16 + h, z, 0, 0, 0, 12);
    for (var k = 0; k < 3; k++) { var a = k / 3 * Math.PI * 2 + 0.5; B.box(g, 0.08, 0.1, 0.008, x + Math.cos(a) * 0.06, (o.y0 || 0) + 0.21, z + Math.sin(a) * 0.06, 0, -a, 0); }
  };
  /* peneduh instrumen (sunshade) */
  SK.sunshade = function (B, x, y, z, ry) {
    var m = MT.paint(0xe9ecec, 0.5, 0.2);
    B.at(M4(x, y, z, 0, ry || 0, 0), function (b) {
      b.box(m, 0.42, 0.006, 0.4, 0, 0.4, 0.02, -0.12, 0, 0); b.box(m, 0.006, 0.4, 0.38, -0.21, 0.2, 0.0); b.box(m, 0.006, 0.4, 0.38, 0.21, 0.2, 0.0); b.box(m, 0.42, 0.5, 0.006, 0, 0.15, -0.19);
    });
  };
  return SK;
})();
