/* ICS Cademy — inti 3D Twin (Three.js r128): scene, kamera, label, X-ray, aliran, grafik tren, efek api/ledakan.
   Dipakai bersama oleh: HYGIENIC_CIP_3D_TWIN, HAZARDOUS_AREA_3D_TWIN, SIL_HIPPS_3D_TWIN. */
var TW = (function () {
  'use strict';
  var T = THREE;
  var TW = {};
  /* Manajemen warna: semua warna hex ditulis dalam sRGB lalu dikonversi ke linear (render output sRGB),
     sehingga pencahayaan fisik terlihat natural dan warna tetap sesuai yang ditulis. */
  (function () {
    var setHex = T.Color.prototype.setHex;
    T.Color.prototype.setHex = function (hex) { setHex.call(this, hex); return this.convertSRGBToLinear(); };
  })();
  TW.raw = function (hex) { return new T.Color().setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255); };
  var host, renderer, scene, camera, controls, clock = new T.Clock(), time = 0;
  var updaters = [], labels = [], shellMats = [], pickables = [], keyMap = {};
  var xrayOn = true, xrayOpacity = 0.16, labelsOn = true, fly = null;
  var shakeS = { t: 0, dur: 0, amp: 0 };
  var tmpV = new T.Vector3();

  TW.$ = function (id) { return document.getElementById(id); };
  TW.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  TW.lerp = function (a, b, t) { return a + (b - a) * t; };
  TW.rand = function (a, b) { return a + Math.random() * (b - a); };
  TW.ease = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  TW.fmt = function (v, d) { return (v == null || isNaN(v)) ? '--' : Number(v).toFixed(d == null ? 1 : d); };
  TW.sci = function (v) { if (v <= 0) return '0'; var e = Math.floor(Math.log10(v)); var m = v / Math.pow(10, e); return m.toFixed(1) + 'e' + e; };
  TW.hex = function (c) { return new T.Color(c); };
  TW.get = function () { return { scene: scene, camera: camera, renderer: renderer, controls: controls }; };
  TW.time = function () { return time; };

  /* ------------------------------------------------------------------ init */
  TW.init = function (o) {
    o = o || {};
    host = TW.$('lk-canvas-host');
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.physicallyCorrectLights = false;
    renderer.toneMappingExposure = o.exposure || 1.0;
    renderer.shadowMap.enabled = o.shadows !== false;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    scene = new T.Scene();
    scene.background = TW.raw(o.bg || 0x07111d);
    if (o.fog) scene.fog = new T.Fog(o.fog.color, o.fog.near, o.fog.far);
    camera = new T.PerspectiveCamera(o.fov || 45, window.innerWidth / window.innerHeight, 0.05, 900);
    camera.position.fromArray(o.cam || [6, 4, 8]);
    controls = new T.OrbitControls(camera, renderer.domElement);
    controls.target.fromArray(o.target || [0, 1, 0]);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = o.minDist || 0.35; controls.maxDistance = o.maxDist || 80;
    controls.update();
    controls.addEventListener('start', function () { fly = null; });

    if (o.sky) TW.sky(o.sky); else makeEnv(o.envTop, o.envBottom);
    if (o.room) makeRoomEnv(o.room);
    var hemi = new T.HemisphereLight(o.hemiSky || 0xbfd8ff, o.hemiGround || 0x5a5248, o.hemi == null ? 0.55 : o.hemi);
    scene.add(hemi);
    var sun = new T.DirectionalLight(o.sunColor || 0xfff4e2, o.sun == null ? 2.4 : o.sun);
    var ss = o.shadowSize || 12, sd = o.sunDir || [0.55, 1.0, 0.6];
    var sdv = new T.Vector3().fromArray(sd).normalize();
    sun.position.copy(sdv).multiplyScalar(ss * 2.2).add(new T.Vector3().fromArray(o.shadowCenter || [0, 0, 0]));
    sun.target.position.fromArray(o.shadowCenter || [0, 0, 0]);
    sun.castShadow = renderer.shadowMap.enabled;
    sun.shadow.mapSize.set(o.shadowMap || 4096, o.shadowMap || 4096);
    sun.shadow.camera.left = -ss; sun.shadow.camera.right = ss; sun.shadow.camera.top = ss; sun.shadow.camera.bottom = -ss;
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = ss * 5;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2;
    scene.add(sun); scene.add(sun.target);
    TW.sun = sun; TW.hemi = hemi; TW.sunDir = sdv;
    var fill = new T.DirectionalLight(o.fillColor || 0x9cc8ff, o.fill == null ? 0.35 : o.fill); fill.position.set(-ss, ss * .5, -ss * .4); scene.add(fill); TW.fillLight = fill;

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('keydown', function (e) {
      var tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
      var k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (keyMap[k]) { keyMap[k](e); if (k === ' ' || k.indexOf('Arrow') === 0) e.preventDefault(); }
    });
    initPick();
    TW.fx.init();
    return { scene: scene, camera: camera, renderer: renderer, controls: controls };
  };
  TW.key = function (k, fn) { keyMap[k] = fn; };
  TW.onUpdate = function (fn) { updaters.push(fn); };

  function makeEnv(topC, botC) {
    var pm = new T.PMREMGenerator(renderer);
    var es = new T.Scene();
    var g = new T.SphereGeometry(50, 32, 16), pos = g.attributes.position, col = [];
    var top = new T.Color(topC || 0x8fb4d8), bot = new T.Color(botC || 0x1a222c), c = new T.Color();
    for (var i = 0; i < pos.count; i++) { c.copy(bot).lerp(top, TW.clamp((pos.getY(i) / 50 + 1) / 2, 0, 1)); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    es.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    var panelMat = new T.MeshBasicMaterial({ color: new T.Color(3, 3, 3), side: T.DoubleSide });
    [[0, 30, 0, -Math.PI / 2, 0, 24, 12], [-30, 12, 8, 0, Math.PI / 2, 14, 8], [28, 10, -12, 0, -Math.PI / 2, 12, 6]].forEach(function (p) {
      var m = new T.Mesh(new T.PlaneGeometry(p[5], p[6]), panelMat);
      m.position.set(p[0], p[1], p[2]); m.rotation.set(p[3], p[4], 0); es.add(m);
    });
    scene.environment = pm.fromScene(es, 0.035).texture;
    pm.dispose();
  }

  /* lingkungan pantul untuk ruangan (pabrik food/farmasi): dinding putih, lampu panel di plafon */
  function makeRoomEnv(o) {
    var pm = new T.PMREMGenerator(renderer), es = new T.Scene();
    var wall = new T.MeshBasicMaterial({ color: new T.Color().setRGB(0.78, 0.8, 0.8), side: T.BackSide });
    var room = new T.Mesh(new T.BoxGeometry(36, 10, 22), wall); room.position.y = 3; es.add(room);
    var floor = new T.Mesh(new T.PlaneGeometry(36, 22), new T.MeshBasicMaterial({ color: new T.Color().setRGB(0.42, 0.46, 0.46), side: T.DoubleSide }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.8; es.add(floor);
    var dark = new T.MeshBasicMaterial({ color: new T.Color().setRGB(0.12, 0.14, 0.16), side: T.DoubleSide });
    [[-9, 0.4, -10.9, 0], [6, 0.4, -10.9, 0], [17.9, 0, 3, Math.PI / 2]].forEach(function (q) { var m = new T.Mesh(new T.PlaneGeometry(6, 1.4), dark); m.position.set(q[0], q[1], q[2]); m.rotation.y = q[3]; es.add(m); });
    var lamp = new T.MeshBasicMaterial({ color: new T.Color().setRGB(9, 9, 8.6), side: T.DoubleSide });
    for (var i = -3; i <= 3; i++) for (var j = -1; j <= 1; j++) { var l = new T.Mesh(new T.PlaneGeometry(1.2, 2.4), lamp); l.rotation.x = Math.PI / 2; l.position.set(i * 5, 7.9, j * 6); es.add(l); }
    scene.environment = pm.fromScene(es, 0.02, 0.1, 100).texture; pm.dispose();
  }
  /* langit: gradasi + matahari + awan (shader), juga dipakai sebagai env-map pantulan */
  var SKY_VS = 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  var SKY_FS = [
    'uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; uniform vec3 sunDir; uniform vec3 sunCol; uniform float cloud; uniform float toLin; varying vec3 vP;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }',
    'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }',
    'void main(){ vec3 d = normalize(vP); float h = d.y;',
    ' vec3 col = h > 0.0 ? mix(hor, top, pow(clamp(h, 0.0, 1.0), 0.5)) : mix(hor, gnd, pow(clamp(-h * 3.0, 0.0, 1.0), 0.6));',
    ' if (h > 0.0 && cloud > 0.0) { vec2 uv = d.xz / (h + 0.15) * 1.4; float c = fbm(uv + vec2(3.1, 1.7)); c = smoothstep(0.62 - cloud * 0.22, 0.9, c) * smoothstep(0.0, 0.18, h); col = mix(col, vec3(0.96, 0.97, 0.99), c * 0.8); }',
    ' float s = max(dot(d, normalize(sunDir)), 0.0); col += sunCol * (pow(s, 1200.0) * 8.0 + pow(s, 30.0) * 0.16 + pow(s, 4.0) * 0.05);',
    ' if (toLin > 0.5) { col = pow(col, vec3(2.2)) * (1.0 + pow(s, 1200.0) * 20.0); gl_FragColor = linearToOutputTexel(vec4(col, 1.0)); } else gl_FragColor = vec4(col, 1.0); }'].join('\n');
  function skyMat(o, lin) {
    var c = function (h) { var k = new T.Color().setRGB(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255); return new T.Vector3(k.r, k.g, k.b); };
    return new T.ShaderMaterial({ uniforms: { top: { value: c(o.top || 0x3f7fcf) }, hor: { value: c(o.hor || 0xcfdde8) }, gnd: { value: c(o.gnd || 0x6c6860) }, sunDir: { value: new T.Vector3().fromArray(o.sunDir || [0.55, 1.0, 0.6]).normalize() }, sunCol: { value: new T.Vector3(1, 0.95, 0.86) }, cloud: { value: o.cloud == null ? 0.5 : o.cloud }, toLin: { value: lin ? 1 : 0 } },
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: T.BackSide, depthWrite: false, depthTest: false, fog: false });
  }
  TW.sky = function (o) {
    var dome = new T.Mesh(new T.SphereGeometry(800, 48, 24), skyMat(o, false)); dome.renderOrder = -100; dome.frustumCulled = false; scene.add(dome);
    updaters.push(function () { dome.position.copy(camera.position); });
    var pm = new T.PMREMGenerator(renderer), es = new T.Scene(); es.add(new T.Mesh(new T.SphereGeometry(40, 48, 24), skyMat(o, true)));
    scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose();
    TW.skyDome = dome; return dome;
  };

  /* -------------------------------------------------------------- materials */
  var M = TW.M = {};
  M.std = function (color, metal, rough, extra) {
    var mt = metal == null ? 0.1 : metal;
    return new T.MeshStandardMaterial(Object.assign({ color: color, metalness: mt, roughness: rough == null ? 0.6 : rough, envMapIntensity: mt > 0.5 ? 0.9 : 0.3 }, extra || {}));
  };
  function applyShell(m) {
    if (xrayOn) { m.transparent = true; m.opacity = xrayOpacity; m.depthWrite = false; m.side = T.DoubleSide; }
    else { m.transparent = false; m.opacity = 1; m.depthWrite = true; m.side = m.userData.double ? T.DoubleSide : T.FrontSide; }
  }
  TW.shellDouble = function (m) { m.userData.double = true; applyShell(m); return m; };
  TW.shellize = function (m) { if (!m.userData.shell) { m.userData.shell = true; shellMats.push(m); } applyShell(m); return m; };
  /* material "dinding" — ikut X-ray */
  M.shell = function (color, metal, rough, extra) {
    var m = M.std(color, metal == null ? 0.92 : metal, rough == null ? 0.28 : rough, extra);
    m.userData.shell = true; shellMats.push(m); applyShell(m); return m;
  };
  M.glow = function (color, op, blend) {
    return new T.MeshBasicMaterial({ color: color, transparent: true, opacity: op == null ? 1 : op, depthWrite: false, blending: blend || T.NormalBlending });
  };
  TW.setXray = function (on, op) {
    if (on != null) xrayOn = on;
    if (op != null) xrayOpacity = op;
    shellMats.forEach(applyShell);
  };
  TW.isXray = function () { return xrayOn; };
  TW.setLabels = function (on) { labelsOn = on; };
  TW.isLabels = function () { return labelsOn; };

  /* -------------------------------------------------------------- geometry */
  var UP = new T.Vector3(0, 1, 0);
  TW.rod = function (p0, p1, r, mat, seg, openEnded) {
    var a = new T.Vector3().fromArray(p0), b = new T.Vector3().fromArray(p1), d = b.clone().sub(a), len = d.length();
    var m = new T.Mesh(new T.CylinderGeometry(r, r, len, seg || 24, 1, !!openEnded), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    m.castShadow = true; m.receiveShadow = true; return m;
  };
  TW.cyl = function (r0, r1, h, mat, seg, openEnded) {
    var m = new T.Mesh(new T.CylinderGeometry(r0, r1, h, seg || 28, 1, !!openEnded), mat); m.castShadow = true; m.receiveShadow = true; return m;
  };
  TW.box = function (w, h, d, mat) { var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m; };
  TW.sph = function (r, mat, seg) { var m = new T.Mesh(new T.SphereGeometry(r, seg || 24, seg ? seg * 0.66 : 16), mat); m.castShadow = true; return m; };
  TW.torus = function (R, r, mat, arc) { var m = new T.Mesh(new T.TorusGeometry(R, r, 12, 32, arc || Math.PI * 2), mat); m.castShadow = true; return m; };
  TW.lathe = function (prof, mat, seg) {
    var pts = prof.map(function (p) { return new T.Vector2(p[0], p[1]); });
    var m = new T.Mesh(new T.LatheGeometry(pts, seg || 40), mat); m.castShadow = true; m.receiveShadow = true; return m;
  };
  TW.at = function (obj, x, y, z) { obj.position.set(x, y, z); return obj; };

  /* jalur pipa dengan tikungan membulat -> CurvePath */
  TW.roundedPath = function (pts, rc) {
    rc = rc == null ? 0.16 : rc;
    var v = pts.map(function (p) { return new T.Vector3().fromArray(p); });
    var path = new T.CurvePath(), cur = v[0].clone();
    for (var i = 1; i < v.length - 1; i++) {
      var d1 = v[i].clone().sub(v[i - 1]), d2 = v[i + 1].clone().sub(v[i]);
      var l1 = d1.length(), l2 = d2.length(); d1.normalize(); d2.normalize();
      var r = Math.min(rc, l1 * 0.5, l2 * 0.5);
      var a = v[i].clone().addScaledVector(d1, -r), b = v[i].clone().addScaledVector(d2, r);
      if (cur.distanceTo(a) > 1e-5) path.add(new T.LineCurve3(cur.clone(), a));
      path.add(new T.QuadraticBezierCurve3(a, v[i].clone(), b));
      cur = b;
    }
    path.add(new T.LineCurve3(cur.clone(), v[v.length - 1].clone()));
    return path;
  };
  /* pipa + fluida di dalam.  return {group, shell, fluid, stripes, path, setFluid(color,opacity), setFlow(speed)} */
  var stripeTex;
  function getStripeTex() {
    if (stripeTex) return stripeTex;
    var c = document.createElement('canvas'); c.width = 256; c.height = 32; var g = c.getContext('2d');
    g.clearRect(0, 0, 256, 32);
    for (var i = 0; i < 9; i++) {
      var x = (i + Math.random() * 0.7) * 28, y = 8 + Math.random() * 16, r = 5 + Math.random() * 5;
      var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    stripeTex = new T.CanvasTexture(c); stripeTex.wrapS = stripeTex.wrapT = T.RepeatWrapping; return stripeTex;
  }
  TW.pipe = function (pts, r, o) {
    o = o || {};
    var path = TW.roundedPath(pts, o.bend), len = path.getLength();
    var seg = Math.max(24, Math.round(len / 0.06));
    var grp = new T.Group();
    var shellMat = o.mat || M.shell(o.color || 0xc9d1d8, 0.95, 0.24);
    var shell = new T.Mesh(new T.TubeGeometry(path, seg, r, 20, false), shellMat); shell.castShadow = true; shell.receiveShadow = true;
    grp.add(shell);
    var fill = new T.Mesh(new T.TubeGeometry(path, seg, r * 0.86, 16, false), new T.MeshStandardMaterial({ color: 0x3da0ff, transparent: true, opacity: 0, roughness: 0.2, emissive: 0x0a2a55, emissiveIntensity: 0.6, depthWrite: false }));
    fill.renderOrder = 2; grp.add(fill);
    var tex = getStripeTex().clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(Math.max(1, len / 0.9), 1);
    var stripes = new T.Mesh(new T.TubeGeometry(path, seg, r * 0.87, 16, false), new T.MeshBasicMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    stripes.renderOrder = 3; grp.add(stripes);
    var P = { group: grp, shell: shell, fill: fill, stripes: stripes, path: path, length: len, speed: 0, tex: tex, _op: 0 };
    P.setFluid = function (color, opacity) { fill.material.color.set(color); fill.material.emissive.set(color).multiplyScalar(0.25); stripes.material.color.set(color).lerp(new T.Color(0xffffff), 0.45); fill.material.opacity = opacity; P._op = opacity; };
    P.setFlow = function (spd) { P.speed = spd; stripes.material.opacity = spd > 0.01 ? Math.min(0.95, 0.35 + spd * 0.35) : 0; };
    updaters.push(function (dt) { if (P.speed > 0.01) tex.offset.x -= P.speed * dt / 0.9 * 0.5; });
    return P;
  };
  TW.canvasTex = function (w, h, fn) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c); t.anisotropy = 8; t.encoding = T.sRGBEncoding; return t;
  };
  TW.plate = function (w, h, fn, px) {
    px = px || 256;
    var tex = TW.canvasTex(Math.round(px * w / Math.max(w, h)), Math.round(px * h / Math.max(w, h)), fn);
    return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  };
  TW.ground = function (size, color, gridColor) {
    color = color || '#141d27';
    var tex = TW.canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = color || '#1c2733'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 2600; i++) { var v = Math.random() * 18 - 9; g.fillStyle = 'rgba(' + (v > 0 ? '255,255,255' : '0,0,0') + ',' + Math.abs(v) / 120 + ')'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.strokeStyle = gridColor || 'rgba(0,229,255,.12)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    });
    tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(size / 3, size / 3);
    var m = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05, envMapIntensity: 0.25 }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true; scene.add(m); return m;
  };
  TW.add = function (o) { scene.add(o); return o; };
  TW.remove = function (o) { scene.remove(o); };
  TW.dispose = function (obj) {
    obj.traverse(function (n) { if (n.geometry) n.geometry.dispose(); });
  };

  /* ---------------------------------------------------------------- labels */
  TW.label = function (html, target, o) {
    o = o || {};
    var d = document.createElement('div'); d.className = 'lbl3' + (o.cls ? ' ' + o.cls : ''); d.innerHTML = html;
    TW.$('lk-labels').appendChild(d);
    var L = {
      el: d, target: target, off: o.off || [0, 0.15, 0], group: o.group || 'main', maxD: o.maxD || 1e9, minD: o.minD || 0, hidden: false,
      set: function (h, cls) { if (h != null && d._h !== h) { d.innerHTML = h; d._h = h; } if (cls != null) { var c = 'lbl3 ' + cls; if (d.className !== c) d.className = c; } },
      remove: function () { d.remove(); labels.splice(labels.indexOf(L), 1); }
    };
    labels.push(L); return L;
  };
  function updateLabels() {
    var W = window.innerWidth, H = window.innerHeight;
    for (var i = 0; i < labels.length; i++) {
      var L = labels[i];
      if (!labelsOn || L.hidden) { if (L.el._vis !== 0) { L.el.style.display = 'none'; L.el._vis = 0; } continue; }
      if (L.target.isObject3D) L.target.getWorldPosition(tmpV); else tmpV.copy(L.target);
      tmpV.x += L.off[0]; tmpV.y += L.off[1]; tmpV.z += L.off[2];
      var dist = camera.position.distanceTo(tmpV);
      tmpV.project(camera);
      var vis = tmpV.z < 1 && dist <= L.maxD && dist >= L.minD && Math.abs(tmpV.x) < 1.1 && Math.abs(tmpV.y) < 1.1;
      if (!vis) { if (L.el._vis !== 0) { L.el.style.display = 'none'; L.el._vis = 0; } continue; }
      if (L.el._vis !== 1) { L.el.style.display = 'block'; L.el._vis = 1; }
      L.el.style.left = ((tmpV.x * 0.5 + 0.5) * W).toFixed(1) + 'px';
      L.el.style.top = ((-tmpV.y * 0.5 + 0.5) * H).toFixed(1) + 'px';
    }
  }

  /* ---------------------------------------------------------------- kamera */
  TW.flyTo = function (pos, tgt, dur) {
    if (TW.instant) { camera.position.fromArray(pos); controls.target.fromArray(tgt); controls.update(); return; }
    fly = { t: 0, dur: dur || 1.4, p0: camera.position.clone(), t0: controls.target.clone(), p1: new T.Vector3().fromArray(pos), t1: new T.Vector3().fromArray(tgt) };
  };
  TW.camButtons = function (containerId, views) {
    var box = TW.$(containerId); box.innerHTML = '';
    views.forEach(function (v, i) {
      var b = document.createElement('button'); b.className = 'btn'; b.textContent = v.name; b.title = v.tip || '';
      b.onclick = function () { TW.flyTo(v.pos, v.tgt, 1.3); Array.prototype.forEach.call(box.children, function (c) { c.classList.remove('active'); }); b.classList.add('active'); };
      box.appendChild(b);
    });
    if (views.length) { var f = views[0]; camera.position.fromArray(f.pos); controls.target.fromArray(f.tgt); controls.update(); box.children[0].classList.add('active'); }
  };
  TW.shake = function (amp, dur) { shakeS.amp = Math.max(shakeS.amp * (shakeS.t < shakeS.dur ? 1 : 0), amp); shakeS.dur = dur; shakeS.t = 0; };
  TW.wireView = function (o) {
    var bx = TW.$(o.xray), bl = TW.$(o.labels), sl = o.slider ? TW.$(o.slider) : null;
    if (bx) { bx.classList.toggle('active', xrayOn); bx.onclick = function () { TW.setXray(!xrayOn); bx.classList.toggle('active', xrayOn); }; TW.key('X', function () { bx.click(); }); }
    if (bl) { bl.classList.toggle('active', labelsOn); bl.onclick = function () { labelsOn = !labelsOn; bl.classList.toggle('active', labelsOn); }; TW.key('L', function () { bl.click(); }); }
    if (sl) { sl.oninput = function () { TW.setXray(null, parseFloat(sl.value)); }; }
  };

  /* ------------------------------------------------------------------ pick */
  function initPick() {
    var ray = new T.Raycaster(), mouse = new T.Vector2(), down = null;
    var el = renderer.domElement;
    el.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', function (e) {
      if (!down || Math.abs(e.clientX - down[0]) + Math.abs(e.clientY - down[1]) > 5) return;
      mouse.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      var hits = ray.intersectObjects(pickables, true);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object; while (o && !o.userData.pick) o = o.parent;
        if (o) { o.userData.pick(o); break; }
      }
    });
  }
  TW.pickable = function (obj, fn) { obj.userData.pick = fn; pickables.push(obj); };

  /* ----------------------------------------------------------- grafik tren */
  TW.Chart = function (canvas, o) {
    var C = { cv: canvas, ctx: canvas.getContext('2d'), o: o, data: [], span: o.span || 60 };
    C.push = function (t, vals) { C.data.push([t].concat(vals)); var lim = t - C.span * 1.05; while (C.data.length > 2 && C.data[0][0] < lim) C.data.shift(); };
    C.clear = function () { C.data.length = 0; };
    C.draw = function (tNow) {
      var g = C.ctx, W = canvas.width, H = canvas.height, pl = 34, pr = 8, pt = 8, pb = 16, w = W - pl - pr, h = H - pt - pb;
      g.clearRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,229,255,.10)'; g.lineWidth = 1; g.font = '10px JetBrains Mono, monospace'; g.fillStyle = '#7f9db3';
      var s0 = o.series[0];
      for (var i = 0; i <= 4; i++) {
        var y = pt + h * i / 4; g.beginPath(); g.moveTo(pl, y); g.lineTo(W - pr, y); g.stroke();
        var v = s0.max - (s0.max - s0.min) * i / 4; g.textAlign = 'right'; g.fillText((o.fmt ? o.fmt(v) : v.toFixed(0)), pl - 3, y + 3);
      }
      var t0 = tNow - C.span, tt = function (t) { return pl + w * (t - t0) / C.span; };
      g.textAlign = 'center'; for (var k = 0; k <= 4; k++) { g.fillText('-' + Math.round(C.span * (4 - k) / 4) + (o.tunit || 's'), pl + w * k / 4, H - 3); }
      (o.refs || []).forEach(function (r) {
        var s = o.series[r.s || 0], y = pt + h * (1 - (r.v - s.min) / (s.max - s.min)); if (y < pt || y > pt + h) return;
        g.strokeStyle = r.color; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(pl, y); g.lineTo(W - pr, y); g.stroke(); g.setLineDash([]);
        g.fillStyle = r.color; g.textAlign = 'left'; g.fillText(r.label, pl + 3, y - 3);
      });
      o.series.forEach(function (s, si) {
        g.strokeStyle = s.color; g.lineWidth = 1.8; g.beginPath(); var st = false;
        for (var j = 0; j < C.data.length; j++) {
          var d = C.data[j]; if (d[0] < t0 - 1) continue;
          var x = tt(d[0]), y = pt + h * (1 - (d[si + 1] - s.min) / (s.max - s.min)); y = TW.clamp(y, pt - 2, pt + h + 2);
          if (!st) { g.moveTo(x, y); st = true; } else g.lineTo(x, y);
        }
        g.stroke();
      });
      if (o.legend) { g.font = '10px Rajdhani, sans-serif'; g.textAlign = 'left'; var lx = pl + 4; o.series.forEach(function (s) { g.fillStyle = s.color; g.fillRect(lx, pt + 2, 8, 3); g.fillStyle = '#cfe6f5'; g.fillText(s.name, lx + 11, pt + 8); lx += 14 + g.measureText(s.name).width + 8; }); }
    };
    return C;
  };

  /* ------------------------------------------------- sistem partikel (billboard) */
  function softTex(kind) {
    return TW.canvasTex(128, 128, function (g, w, h) {
      var c = w / 2;
      if (kind === 'puff') {
        for (var i = 0; i < 9; i++) {
          var x = c + (Math.random() - .5) * 46, y = c + (Math.random() - .5) * 46, r = 30 + Math.random() * 22;
          var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.fillRect(0, 0, w, h);
        }
      } else {
        var gr2 = g.createRadialGradient(c, c, 0, c, c, c);
        gr2.addColorStop(0, 'rgba(255,255,255,1)'); gr2.addColorStop(.35, 'rgba(255,255,255,.6)'); gr2.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr2; g.fillRect(0, 0, w, h);
      }
    });
  }
  var VS = 'attribute vec3 aOff; attribute float aSize; attribute vec4 aCol; varying vec2 vUv; varying vec4 vCol;' +
    'void main(){ vUv = uv; vCol = aCol; vec4 mv = modelViewMatrix * vec4(aOff,1.0); mv.xy += position.xy * aSize; gl_Position = projectionMatrix * mv; }';
  var FS = 'uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;' +
    'void main(){ vec4 t = texture2D(map, vUv); float a = vCol.a * t.a; if(a < 0.004) discard; gl_FragColor = vec4(vCol.rgb * t.rgb, a); }';

  TW.PSys = function (n, kind, additive) {
    var S = this; S.n = n; S.ptr = 0;
    S.x = new Float32Array(n * 3); S.v = new Float32Array(n * 3);
    S.age = new Float32Array(n); S.life = new Float32Array(n); S.s0 = new Float32Array(n); S.s1 = new Float32Array(n);
    S.c0 = new Float32Array(n * 4); S.c1 = new Float32Array(n * 4); S.drag = new Float32Array(n); S.buoy = new Float32Array(n);
    var base = new T.PlaneGeometry(1, 1), g = new T.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    S.aOff = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3); S.aSize = new T.InstancedBufferAttribute(new Float32Array(n), 1); S.aCol = new T.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    S.aOff.setUsage(T.DynamicDrawUsage); S.aSize.setUsage(T.DynamicDrawUsage); S.aCol.setUsage(T.DynamicDrawUsage);
    g.setAttribute('aOff', S.aOff); g.setAttribute('aSize', S.aSize); g.setAttribute('aCol', S.aCol);
    g.instanceCount = n;
    var mat = new T.ShaderMaterial({ uniforms: { map: { value: softTex(kind) } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending });
    S.mesh = new T.Mesh(g, mat); S.mesh.frustumCulled = false; S.mesh.renderOrder = additive ? 8 : 6;
    scene.add(S.mesh);
    S.alive = 0;
  };
  TW.PSys.prototype.emit = function (x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag, buoy) {
    var i = this.ptr; this.ptr = (this.ptr + 1) % this.n;
    var i3 = i * 3, i4 = i * 4;
    this.x[i3] = x; this.x[i3 + 1] = y; this.x[i3 + 2] = z; this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.drag[i] = drag || 0; this.buoy[i] = buoy || 0;
    for (var k = 0; k < 4; k++) { this.c0[i4 + k] = c0[k]; this.c1[i4 + k] = c1[k]; }
  };
  TW.PSys.prototype.update = function (dt) {
    var n = this.n, oa = this.aOff.array, sa = this.aSize.array, ca = this.aCol.array, alive = 0;
    for (var i = 0; i < n; i++) {
      var L = this.life[i];
      if (L <= 0) { sa[i] = 0; continue; }
      var a = (this.age[i] += dt);
      if (a >= L) { this.life[i] = 0; sa[i] = 0; continue; }
      alive++;
      var k = a / L, i3 = i * 3, i4 = i * 4, dr = Math.max(0, 1 - this.drag[i] * dt);
      this.v[i3] *= dr; this.v[i3 + 1] = this.v[i3 + 1] * dr + this.buoy[i] * dt; this.v[i3 + 2] *= dr;
      this.x[i3] += this.v[i3] * dt; this.x[i3 + 1] += this.v[i3 + 1] * dt; this.x[i3 + 2] += this.v[i3 + 2] * dt;
      oa[i3] = this.x[i3]; oa[i3 + 1] = this.x[i3 + 1]; oa[i3 + 2] = this.x[i3 + 2];
      sa[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      var fi = Math.min(1, a / 0.12);
      for (var c = 0; c < 4; c++) ca[i4 + c] = this.c0[i4 + c] + (this.c1[i4 + c] - this.c0[i4 + c]) * k;
      ca[i4 + 3] *= fi;
    }
    this.alive = alive;
    this.aOff.needsUpdate = true; this.aSize.needsUpdate = true; this.aCol.needsUpdate = true;
  };
  TW.PSys.prototype.clear = function () { this.life.fill(0); this.aSize.array.fill(0); this.aSize.needsUpdate = true; };

  /* ------------------------------------------------------------------- FX */
  var fx = TW.fx = { fireSys: null, smokeSys: null, emitters: [], shocks: [], debris: null, lights: [], scorches: [] };
  fx.init = function () {
    fx.fireSys = new TW.PSys(2600, 'soft', true);
    fx.smokeSys = new TW.PSys(1500, 'puff', false);
    var dg = new T.BoxGeometry(1, 1, 1), dm = new T.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.7, roughness: 0.6 });
    fx.debris = new T.InstancedMesh(dg, dm, 90); fx.debris.frustumCulled = false; fx.debris.castShadow = false; scene.add(fx.debris);
    fx.dList = []; for (var i = 0; i < 90; i++) fx.dList.push({ on: false, p: new T.Vector3(), v: new T.Vector3(), r: new T.Vector3(), w: new T.Vector3(), s: 0.1, t: 0 });
    var z = new T.Object3D(); z.scale.setScalar(0); z.updateMatrix(); for (var j = 0; j < 90; j++) fx.debris.setMatrixAt(j, z.matrix);
    fx.debris.instanceMatrix.needsUpdate = true;
    var lg = new T.PointLight(0xff8a30, 0, 40, 1.6); lg.position.set(0, 3, 0); scene.add(lg); fx.flashLight = lg; fx.flashK = 0;
  };
  var CF0 = [1, 0.86, 0.45, 0.85], CF1 = [1, 0.22, 0.03, 0], CS0 = [0.12, 0.12, 0.13, 0.5], CS1 = [0.22, 0.22, 0.24, 0];
  fx.fire = function (pos, o) {
    o = o || {};
    var E = { pos: new T.Vector3().fromArray(pos), size: o.size || 1, rate: o.rate || 50, k: 0, dir: new T.Vector3().fromArray(o.dir || [0, 1, 0]), spread: o.spread == null ? 0.35 : o.spread, speed: o.speed || 2.2, smoke: o.smoke == null ? 0.25 : o.smoke, acc: 0, sacc: 0, light: null };
    if (o.light !== false) { E.light = new T.PointLight(0xff7a20, 0, 18, 1.8); E.light.position.copy(E.pos); scene.add(E.light); }
    fx.emitters.push(E); return E;
  };
  function updateEmitter(E, dt) {
    if (E.k <= 0.001) { if (E.light) E.light.intensity = 0; return; }
    var n = E.rate * E.k * dt + E.acc; var cnt = Math.floor(n); E.acc = n - cnt;
    var s = E.size, d = E.dir;
    for (var i = 0; i < cnt; i++) {
      var sp = E.speed * s * (0.6 + Math.random() * 0.8), r = E.spread;
      fx.fireSys.emit(E.pos.x + (Math.random() - .5) * 0.25 * s, E.pos.y + (Math.random() - .5) * 0.15 * s, E.pos.z + (Math.random() - .5) * 0.25 * s,
        d.x * sp + (Math.random() - .5) * r * sp, d.y * sp + (Math.random() - .5) * r * sp * 0.6, d.z * sp + (Math.random() - .5) * r * sp,
        0.5 + Math.random() * 0.7, 0.5 * s * (0.6 + Math.random() * 0.6), 1.5 * s, CF0, CF1, 0.4, 1.4 * s);
    }
    var sn = E.rate * E.k * E.smoke * dt + E.sacc; var sc = Math.floor(sn); E.sacc = sn - sc;
    for (var j = 0; j < sc; j++) {
      fx.smokeSys.emit(E.pos.x + (Math.random() - .5) * 0.3 * s, E.pos.y + 0.8 * s * Math.random(), E.pos.z + (Math.random() - .5) * 0.3 * s,
        (Math.random() - .5) * 0.7 * s + d.x * 1.2 * s, 1.0 * s + Math.random() * 1.3 * s + d.y * s, (Math.random() - .5) * 0.7 * s + d.z * 1.2 * s,
        3 + Math.random() * 3, 0.7 * s, 3.4 * s, CS0, CS1, 0.25, 0.5 * s);
    }
    if (E.light) E.light.intensity = E.k * s * (5 + Math.random() * 2.5);
  }
  fx.blast = function (pos, R, o) {
    o = o || {};
    var n = Math.round(200 * Math.min(2, R / 3 + 0.6));
    for (var i = 0; i < n; i++) {
      var th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = R * (0.6 + Math.random() * 1.6);
      fx.fireSys.emit(pos[0], pos[1], pos[2], Math.sin(ph) * Math.cos(th) * sp, Math.abs(Math.cos(ph)) * sp * 0.9 + R * 0.3, Math.sin(ph) * Math.sin(th) * sp,
        1.0 + Math.random() * 1.6, R * 0.5, R * (1.1 + Math.random() * 0.7), [1, 0.9, 0.55, 0.9], [1, 0.25, 0.03, 0], 1.6, R * 0.35);
    }
    for (var j = 0; j < n * 0.5; j++) {
      var th2 = Math.random() * Math.PI * 2, sp2 = R * (0.2 + Math.random() * 0.9);
      fx.smokeSys.emit(pos[0], pos[1], pos[2], Math.cos(th2) * sp2, R * (0.4 + Math.random() * 0.9), Math.sin(th2) * sp2,
        4 + Math.random() * 5, R * 0.6, R * 3.2, [0.1, 0.1, 0.1, 0.65], [0.28, 0.28, 0.3, 0], 0.7, R * 0.12);
    }
    var ring = new T.Mesh(new T.RingGeometry(0.85, 1, 72), new T.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(pos[0], Math.max(0.06, pos[1] * 0.3), pos[2]); ring.scale.setScalar(0.5); scene.add(ring);
    fx.shocks.push({ m: ring, t: 0, R: R * 7 });
    fx.flashK = Math.min(60, R * 14);
    var fl = TW.$('flash'); if (fl) { fl.style.transition = 'none'; fl.style.opacity = Math.min(0.5, 0.15 + R * 0.05); setTimeout(function () { fl.style.transition = 'opacity 0.9s'; fl.style.opacity = 0; }, 40); }
    fx.flashLight.position.set(pos[0], pos[1] + 1, pos[2]);
    TW.shake(Math.min(0.5, R * 0.05 + 0.05), 1.6 + R * 0.1);
    if (o.debris !== false) fx.debrisBurst(pos, Math.min(70, Math.round(R * 14)), R);
  };
  fx.debrisBurst = function (pos, n, R) {
    var c = 0;
    for (var i = 0; i < fx.dList.length && c < n; i++) {
      var d = fx.dList[i]; if (d.on) continue; c++;
      var th = Math.random() * Math.PI * 2, sp = R * (1.5 + Math.random() * 3);
      d.on = true; d.t = 0; d.p.set(pos[0], pos[1] + 0.3, pos[2]); d.v.set(Math.cos(th) * sp, R * (1.2 + Math.random() * 2.6), Math.sin(th) * sp);
      d.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); d.w.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4); d.s = 0.08 + Math.random() * 0.22 * Math.min(2, R * 0.5 + 0.5);
    }
  };
  fx.scorch = function (pos, r) {
    var tex = TW.canvasTex(128, 128, function (g, w, h) { var gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(.6, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    var m = new T.Mesh(new T.PlaneGeometry(r * 2, r * 2), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos[0], 0.02, pos[2]); scene.add(m); fx.scorches.push({ m: m, t: 0 }); return m;
  };
  fx.reset = function () {
    fx.fireSys.clear(); fx.smokeSys.clear();
    fx.emitters.forEach(function (E) { E.k = 0; if (E.light) E.light.intensity = 0; });
    fx.shocks.forEach(function (s) { scene.remove(s.m); }); fx.shocks.length = 0;
    fx.dList.forEach(function (d) { d.on = false; });
    fx.scorches.forEach(function (s) { scene.remove(s.m); }); fx.scorches.length = 0;
    fx.flashK = 0; fx.flashLight.intensity = 0;
    var z = new T.Object3D(); z.scale.setScalar(0); z.updateMatrix(); for (var j = 0; j < 90; j++) fx.debris.setMatrixAt(j, z.matrix); fx.debris.instanceMatrix.needsUpdate = true;
    var fl = TW.$('flash'); if (fl) fl.style.opacity = 0;
  };
  var dm4 = new T.Object3D();
  function updateFx(dt) {
    fx.emitters.forEach(function (E) { updateEmitter(E, dt); });
    fx.fireSys.update(dt); fx.smokeSys.update(dt);
    for (var i = fx.shocks.length - 1; i >= 0; i--) {
      var s = fx.shocks[i]; s.t += dt; var k = s.t / 1.4;
      if (k >= 1) { scene.remove(s.m); s.m.geometry.dispose(); fx.shocks.splice(i, 1); continue; }
      s.m.scale.setScalar(0.5 + s.R * (1 - Math.pow(1 - k, 2))); s.m.material.opacity = 0.8 * (1 - k);
    }
    fx.flashK *= Math.pow(0.02, dt); fx.flashLight.intensity = fx.flashK; if (fx.flashK < 0.05) fx.flashLight.intensity = 0;
    var any = false;
    fx.dList.forEach(function (d, i) {
      if (!d.on) return; any = true; d.t += dt; d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt);
      if (d.p.y < d.s * 0.5) { d.p.y = d.s * 0.5; d.v.multiplyScalar(0.35); d.v.y = Math.abs(d.v.y) * 0.3; d.w.multiplyScalar(0.5); }
      d.r.addScaledVector(d.w, dt);
      dm4.position.copy(d.p); dm4.rotation.set(d.r.x, d.r.y, d.r.z); dm4.scale.set(d.s, d.s * 0.6, d.s * 1.4); dm4.updateMatrix(); fx.debris.setMatrixAt(i, dm4.matrix);
    });
    if (any) fx.debris.instanceMatrix.needsUpdate = true;
    fx.scorches.forEach(function (s) { s.t += dt; s.m.material.opacity = Math.min(0.9, s.t * 0.5); });
  }

  /* panas pada material: k 0..1 -> merah membara */
  var hc = new T.Color();
  TW.heat = function (mat, k) {
    k = TW.clamp(k, 0, 1);
    if (k <= 0.01) { mat.emissive.setRGB(0, 0, 0); mat.emissiveIntensity = 1; return; }
    hc.setRGB(1, 0.18 + 0.55 * k * k, 0.02 + 0.3 * k * k * k);
    mat.emissive.copy(hc); mat.emissiveIntensity = 0.15 + k * 1.3;
  };

  /* ------------------------------------------------ ICS Cademy: logo, watermark & peringatan */
  /* Halaman memuat icsnotice.js (sama seperti 3D Twin Level). Bila file itu tidak ada di folder,
     peringatan bawaan di bawah ini yang ditampilkan agar tidak pernah dobel. */
  TW.ics = function (o) {
    o = o || {};
    var hl = document.querySelector('.hdr-left');
    if (hl && !hl.querySelector('.ics-logo')) {
      var lg = document.createElement('div'); lg.className = 'ics-logo'; lg.innerHTML = '<b>ICS</b><small>CADEMY</small>'; hl.insertBefore(lg, hl.firstChild);
    }
    if (!document.querySelector('.ics-wm')) { var wm = document.createElement('div'); wm.className = 'ics-wm'; wm.innerHTML = '&copy; ICS Cademy &middot; 3D Twin &middot; materi lanjutan'; document.body.appendChild(wm); }
    if (!window.ICS_NOTICE_MISSING) return;
    var ov = document.createElement('div'); ov.className = 'ics-notice';
    ov.innerHTML = '<div class="ics-box"><div class="ics-top"><div class="ics-logo big"><b>ICS</b><small>CADEMY</small></div><div><div class="ics-warn">&#9888; PERINGATAN</div><div class="ics-title">' + (o.title || '3D TWIN') + '</div><div class="ics-series">Materi lanjutan seri 3D Twin ICS Cademy</div></div></div>' +
      '<ul>' +
      '<li><b>Lanjutan dari:</b> 3D Twin Cara Kerja Instrument Level. Pelajari seri dasar terlebih dahulu.</li>' +
      '<li><b>Untuk pembelajaran.</b> Angka dan model di simulasi ini adalah ilustrasi, <b>bukan</b> untuk desain, validasi, klasifikasi area, atau perhitungan SIL nyata. Ikuti standar dan data produsen.</li>' +
      (o.extra ? '<li>' + o.extra + '</li>' : '') +
      '<li><b>Hak cipta ICS Cademy.</b> Jangan menyebarluaskan atau memperjualbelikan materi ini tanpa izin.</li>' +
      '</ul><button class="btn go" id="ics-ok">SAYA MENGERTI &mdash; MULAI SIMULASI</button></div>';
    document.body.appendChild(ov);
    TW.$('ics-ok').onclick = function () { ov.classList.add('hide'); setTimeout(function () { ov.remove(); }, 400); };
  };

  /* ----------------------------------------------------------------- loop */
  TW.stepSim = function (dt, n) { for (var k = 0; k < (n || 1); k++) { time += dt; for (var i = 0; i < updaters.length; i++) updaters[i](dt, time); updateFx(dt); } };
  TW.start = function () {
    function frame() {
      requestAnimationFrame(frame);
      var dt = Math.min(clock.getDelta(), 0.05); time += dt;
      if (fly) {
        fly.t += dt / fly.dur; var e = TW.ease(Math.min(1, fly.t));
        camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e);
        if (fly.t >= 1) fly = null;
      }
      controls.update();
      for (var i = 0; i < updaters.length; i++) updaters[i](dt, time);
      updateFx(dt);
      updateLabels();
      var off = null;
      if (shakeS.t < shakeS.dur) {
        shakeS.t += dt; var a = shakeS.amp * (1 - shakeS.t / shakeS.dur);
        off = new T.Vector3((Math.random() - .5) * a, (Math.random() - .5) * a, (Math.random() - .5) * a); camera.position.add(off);
      }
      renderer.render(scene, camera);
      if (off) camera.position.sub(off);
    }
    frame();
  };

  return TW;
})();
