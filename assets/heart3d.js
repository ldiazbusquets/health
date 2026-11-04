/* Hero: an anatomical heart, rendered with WebGL as a cloud of dots (default) or as a solid model (?heart=solid).
   Geometry: BodyParts3D 4.0, © The Database Center for Life Science, CC BY 4.0
   (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/). Adapted: heart walls, coronary vessels,
   aorta, pulmonary vessels and venae cavae extracted, cut where they leave the heart, merged and
   quantised. Groups: 0 = heart wall, 1 = arteries, 2 = veins. */
(function () {
  var cv = document.getElementById('heart3d'); if (!cv) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PERIOD = 0.92;
  var gl = null;
  try { gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true }) || cv.getContext('experimental-webgl'); } catch (e) {}

  function g(p, m, s) { var d = (p - m) / s; return Math.exp(-d * d); }
  window.ldbBeat = function (p) { return 0.06 * g(p, .27, .035) + 0.03 * g(p, .47, .05); };

  fetch(cv.dataset.src).then(function (r) { if (!r.ok) throw new Error('model'); return r.body.pipeThrough(new DecompressionStream('gzip')); })
    .then(function (s) { return new Response(s).arrayBuffer(); })
    .then(function (buf) { parse(buf); if (!gl) fallback(); else setup(/[?&]heart=solid/.test(location.search) ? 'solid' : 'dots'); })
    .catch(function () { window.ldbHeartFailed = true; });

  var M = null;
  function parse(buf) {
    var dv = new DataView(buf), n = dv.getUint32(4, true), ni = dv.getUint32(8, true), o = 12, bmin = [], bmax = [];
    for (var i = 0; i < 3; i++) bmin.push(dv.getFloat32(o + i * 4, true)); o += 12;
    for (i = 0; i < 3; i++) bmax.push(dv.getFloat32(o + i * 4, true)); o += 12;
    var pos = new Uint16Array(buf, o, n * 3); o += n * 6;
    var nrm = new Int8Array(buf, o, n * 3); o += n * 3;
    var grp = new Uint8Array(buf, o, n); o += n; o += (2 - o % 2) % 2;
    var idx = new Uint16Array(buf, o, ni);
    M = { n: n, ni: ni, bmin: bmin, bmax: bmax, pos: pos, nrm: nrm, grp: grp, idx: idx };
    window.ldbHeartReady = true;
  }

  var VS = [
    'attribute vec3 aPos; attribute vec3 aNrm; attribute float aGrp;',
    'uniform vec3 uMin; uniform vec3 uMax; uniform mat3 uRot; uniform float uBeat; uniform float uAspect; uniform float uScale; uniform float uOffY;',
    'varying vec3 vN; varying vec3 vP; varying float vG; varying vec3 vO;',
    'void main() {',
    '  vec3 p = uMin + aPos * (uMax - uMin);',
    '  float w = aGrp < 0.5 ? (p.y < 0.05 ? 1.0 : 0.55) : 0.35;',   // the ventricles squeeze most
    '  vec3 c = vec3(0.04, -0.05, 0.0); p = c + (p - c) * (1.0 + uBeat * w);',
    '  vO = p; vec3 r = uRot * p; vN = uRot * aNrm; vG = aGrp; vP = r;',
    '  float z = 2.4 - r.z * 0.55;',
    '  gl_Position = vec4(r.x * uScale * 2.4 / z / uAspect, r.y * uScale * 2.4 / z + uOffY, -r.z * 0.3, 1.0);',
    '}'].join('\n');
  var FS = [
    'precision highp float;',
    'varying vec3 vN; varying vec3 vP; varying float vG; varying vec3 vO;',
    'uniform float uLight; uniform float uTime;',
    'float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
    'float noise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),',
    '             mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }',
    'void main() {',
    '  vec3 N = normalize(vN);',
    '  float nz = noise(vO * 38.0) * 0.6 + noise(vO * 90.0) * 0.4;',   // fine, wet-looking surface detail
    '  N = normalize(N + 0.07 * (vec3(noise(vO * 60.0 + 3.1), noise(vO * 60.0 + 7.7), noise(vO * 60.0 + 1.3)) - 0.5));',
    '  vec3 V = vec3(0.0, 0.0, 1.0);',
    '  vec3 base = vG < 0.5 ? mix(vec3(0.30, 0.03, 0.05), vec3(0.46, 0.07, 0.09), nz)',
    '            : vG < 1.5 ? mix(vec3(0.62, 0.08, 0.10), vec3(0.78, 0.16, 0.17), nz)',
    '            : mix(vec3(0.17, 0.03, 0.07), vec3(0.26, 0.05, 0.10), nz);',
    '  vec3 L1 = normalize(vec3(-0.55, 0.65, 0.75)), L2 = normalize(vec3(0.8, -0.2, 0.35)), L3 = normalize(vec3(0.3, 0.6, -0.9));',
    '  float d1 = max(0.0, (dot(N, L1) + 0.15) / 1.15), d2 = max(0.0, dot(N, L2)) * 0.35;',
    '  vec3 H1 = normalize(L1 + V), H2 = normalize(L2 + V);',
    '  float s = pow(max(dot(N, H1), 0.0), 70.0) * 1.1 + pow(max(dot(N, H1), 0.0), 14.0) * 0.12 + pow(max(dot(N, H2), 0.0), 50.0) * 0.35;',
    '  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
    '  float back = pow(max(0.0, dot(N, L3)), 2.0);',
    '  vec3 col = base * (0.07 + 1.05 * d1 + d2) + vec3(1.0, 0.9, 0.88) * s * (0.6 + 0.4 * nz)',
    '           + mix(vec3(0.9, 0.25, 0.28), vec3(1.0, 0.75, 0.75), uLight) * fres * 0.45 + vec3(0.9, 0.2, 0.22) * back * 0.25;',
    '  col = col / (col + vec3(0.85)) * 1.55;',   // soft tone mapping
    '  gl_FragColor = vec4(pow(col, vec3(0.92)), 1.0);',
    '}'].join('\n');


  // ---------- dots ----------
  function sampleDots(count) {
    var n = M.ni / 3, area = new Float32Array(n), tot = 0, P = M.pos, B0 = M.bmin, B1 = M.bmax;
    function v(i, k) { return B0[k] + P[i * 3 + k] / 65535 * (B1[k] - B0[k]); }
    for (var t = 0; t < n; t++) {
      var a = M.idx[t * 3], b = M.idx[t * 3 + 1], c = M.idx[t * 3 + 2];
      var ux = v(b, 0) - v(a, 0), uy = v(b, 1) - v(a, 1), uz = v(b, 2) - v(a, 2), wx = v(c, 0) - v(a, 0), wy = v(c, 1) - v(a, 1), wz = v(c, 2) - v(a, 2);
      var cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx, ar = Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
      ar *= M.grp[a] === 0 ? 1 : 1.8;   // vessels get a little extra so the coronary tree stays visible
      tot += ar; area[t] = tot;
    }
    var pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), grp = new Float32Array(count), rnd = new Float32Array(count), seed = 12345;
    function r() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < count; i++) {
      var x = r() * tot, lo = 0, hi = n - 1; while (lo < hi) { var m = (lo + hi) >> 1; if (area[m] < x) lo = m + 1; else hi = m; }
      var A = M.idx[lo * 3], Bv = M.idx[lo * 3 + 1], Cv = M.idx[lo * 3 + 2], u = r(), w = r(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
      for (var k = 0; k < 3; k++) {
        pos[i * 3 + k] = v(A, k) + u * (v(Bv, k) - v(A, k)) + w * (v(Cv, k) - v(A, k));
        nrm[i * 3 + k] = (M.nrm[A * 3 + k] + M.nrm[Bv * 3 + k] + M.nrm[Cv * 3 + k]) / 381;
      }
      grp[i] = M.grp[A]; rnd[i] = r();
    }
    return { n: count, pos: pos, nrm: nrm, grp: grp, rnd: rnd };
  }
  var DVS = [
    'attribute vec3 aPos; attribute vec3 aNrm; attribute float aGrp; attribute float aRnd;',
    'uniform mat3 uRot; uniform float uBeat; uniform float uAspect; uniform float uScale; uniform float uOffY; uniform float uPx; uniform float uTime;',
    'varying float vF; varying float vG; varying float vD; varying float vT; varying float vL;',
    'void main() {',
    '  vec3 p = aPos;',
    '  float w = aGrp < 0.5 ? (p.y < 0.05 ? 1.0 : 0.55) : 0.35;',
    '  vec3 c = vec3(0.04, -0.05, 0.0); p = c + (p - c) * (1.0 + uBeat * w);',
    '  vec3 r = uRot * p; vec3 n = normalize(uRot * aNrm);',
    '  vL = max(0.0, dot(n, normalize(vec3(-0.55, 0.65, 0.75)))) * 0.85 + max(0.0, dot(n, normalize(vec3(0.8, -0.2, 0.35)))) * 0.25;',
    '  vF = n.z; vG = aGrp; vD = clamp(r.z + 0.5, 0.0, 1.0); vT = 0.8 + 0.2 * sin(uTime * 2.0 + aRnd * 40.0);',
    '  float z = 2.4 - r.z * 0.55;',
    '  gl_Position = vec4(r.x * uScale * 2.4 / z / uAspect, r.y * uScale * 2.4 / z + uOffY, -r.z * 0.3, 1.0);',
    '  gl_PointSize = uPx * (aGrp < 0.5 ? 1.0 : 1.15) * (0.75 + 0.6 * vD) * (2.4 / z);',
    '}'].join('\n');
  var DFS = [
    'precision mediump float;',
    'varying float vF; varying float vG; varying float vD; varying float vT; varying float vL;',
    'uniform float uLight;',
    'void main() {',
    '  vec2 q = gl_PointCoord - 0.5; float d = dot(q, q); if (d > 0.25) discard;',
    '  float front = clamp(0.15 + vL, 0.0, 1.0);',          // dots facing you are bright, the far side dim
    '  vec3 darkC = vG < 0.5 ? mix(vec3(0.62, 0.20, 0.24), vec3(1.0, 0.86, 0.86), front)',
    '              : vG < 1.5 ? mix(vec3(0.75, 0.22, 0.26), vec3(1.0, 0.55, 0.58), front)',
    '              : mix(vec3(0.42, 0.14, 0.22), vec3(0.78, 0.45, 0.55), front);',
    '  vec3 lightC = vG < 0.5 ? mix(vec3(0.80, 0.55, 0.57), vec3(0.50, 0.08, 0.13), front)',
    '              : vG < 1.5 ? mix(vec3(0.85, 0.45, 0.48), vec3(0.72, 0.10, 0.16), front)',
    '              : mix(vec3(0.70, 0.52, 0.58), vec3(0.36, 0.08, 0.16), front);',
    '  vec3 col = mix(darkC, lightC, uLight);',
    '  float a = (0.3 + 0.7 * front) * (0.7 + 0.3 * vD) * vT * (1.0 - smoothstep(0.12, 0.25, d));',
    '  gl_FragColor = vec4(col * a, a);',
    '}'].join('\n');

  // the invisible depth pass: the solid heart hides the dots on its far side and inside the chambers
  var DEPTH_FS = 'precision mediump float; void main() { gl_FragColor = vec4(0.0); }';

  // the LDB HEALTH wordmark: wordmark.js runs the particles, this canvas draws them at the back of the depth range,
  // so the heart's silhouette always covers them. Two passes: soft gaussian sprites (out of focus), then sharp squares.
  var QVS = ['attribute vec4 aP; uniform vec4 uRect; uniform vec2 uWH; uniform float uDpr, uG; uniform mediump float uBlur, uMode; varying mediump float vA, vS;',
    'void main() { vA = fract(aP.z); vS = aP.w; gl_Position = vec4(mix(uRect.x, uRect.z, aP.x / uWH.x), mix(uRect.y, uRect.w, aP.y / uWH.y), 0.99, 1.0);',
    '  gl_PointSize = uMode < 0.5 ? (uG + uBlur * 7.0) * uDpr : max(1.0, uG * floor(aP.z) / 100.0 * uDpr); }'].join('\n');
  var QFS = ['precision mediump float; uniform vec4 uCol; uniform float uMode, uBlur; varying float vA, vS;',
    'void main() { float a;',
    '  if (uMode < 0.5) { vec2 d = gl_PointCoord - 0.5; a = uCol.a * vA * exp(-dot(d, d) * 18.0) * clamp(2.6 / uBlur, 0.35, 1.0); if (a < 0.002) discard; }',
    '  else { a = vS; if (a < 0.03) discard; }',
    '  gl_FragColor = vec4(uCol.rgb * a, a); }'].join('\n');
  var wmCv = document.getElementById('wordmark'), progQ = null, UQ = {}, wmN = 0;
  function drawWordmark() {
    var S = window.ldbWM; if (!progQ || !S || !S.n) return;
    var hr = cv.getBoundingClientRect(), wr = wmCv.getBoundingClientRect(); if (!hr.width || !hr.height) return;
    gl.useProgram(progQ);
    gl.bindBuffer(gl.ARRAY_BUFFER, B.wm);
    if (wmN !== S.buf.length) { gl.bufferData(gl.ARRAY_BUFFER, S.buf, gl.DYNAMIC_DRAW); wmN = S.buf.length; } else gl.bufferSubData(gl.ARRAY_BUFFER, 0, S.buf);
    var l = gl.getAttribLocation(progQ, 'aP'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 0, 0);
    gl.uniform4f(UQ.uRect, (wr.left - hr.left) / hr.width * 2 - 1, 1 - (wr.top - hr.top) / hr.height * 2, (wr.right - hr.left) / hr.width * 2 - 1, 1 - (wr.bottom - hr.top) / hr.height * 2);
    gl.uniform2f(UQ.uWH, S.W, S.H); gl.uniform1f(UQ.uDpr, cv.width / hr.width); gl.uniform1f(UQ.uG, S.g); gl.uniform1f(UQ.uBlur, S.blur);
    gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // out of focus
    gl.uniform1f(UQ.uMode, 0); if (S.lt) gl.uniform4f(UQ.uCol, 160 / 255, 74 / 255, 82 / 255, 0.5); else gl.uniform4f(UQ.uCol, 1, 186 / 255, 192 / 255, 0.42);
    gl.drawArrays(gl.POINTS, 0, S.n);
    // in focus near the cursor and along the sweep
    gl.uniform1f(UQ.uMode, 1); if (S.lt) gl.uniform4f(UQ.uCol, 122 / 255, 40 / 255, 48 / 255, 1); else gl.uniform4f(UQ.uCol, 1, 226 / 255, 228 / 255, 1);
    gl.drawArrays(gl.POINTS, 0, S.n);
    gl.disableVertexAttribArray(l);
  }

  var mode, progMesh, progDots, U = {}, UD = {}, W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1), mobile = false, B = {}, D = null;
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function program(vs, fs) { var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link'); return p; }
  function buf(data) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; }
  function bindAttr(p, name, b, size, type, norm) { var l = gl.getAttribLocation(p, name); if (l < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, type, norm, 0, 0); }
  function uniforms(p, names, into) { names.forEach(function (k) { into[k] = gl.getUniformLocation(p, k); }); }

  function setup(m) {
    mode = m;
    try { progMesh = program(VS, mode === 'solid' ? FS : DEPTH_FS); if (mode === 'dots') progDots = program(DVS, DFS); }
    catch (e) { gl = null; fallback(); return; }
    B.pos = buf(M.pos); B.nrm = buf(M.nrm); B.grp = buf(M.grp);
    B.idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, B.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, M.idx, gl.STATIC_DRAW);
    uniforms(progMesh, ['uMin', 'uMax', 'uRot', 'uBeat', 'uAspect', 'uScale', 'uOffY', 'uLight', 'uTime'], U);
    if (mode === 'dots') {
      D = sampleDots(innerWidth < 700 ? 38000 : 65000);
      B.dpos = buf(D.pos); B.dnrm = buf(D.nrm); B.dgrp = buf(D.grp); B.drnd = buf(D.rnd);
      uniforms(progDots, ['uRot', 'uBeat', 'uAspect', 'uScale', 'uOffY', 'uLight', 'uTime', 'uPx'], UD);
    }
    if (wmCv) try {
      progQ = program(QVS, QFS); uniforms(progQ, ['uRect', 'uWH', 'uDpr', 'uG', 'uBlur', 'uMode', 'uCol'], UQ); B.wm = gl.createBuffer();
      wmCv.classList.add('ingl'); addEventListener('wordmarkdraw', req); dispatchEvent(new Event('wordmarkgl'));
    } catch (e) { progQ = null; }
    resize(); cv.classList.add('on'); start();
  }
  function resize() {
    var r = cv.getBoundingClientRect(); W = r.width; H = r.height; mobile = innerWidth <= 980;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  addEventListener('resize', function () { if (gl) resize(); });

  var mx = 0, my = 0, tx = 0, ty = 0, t0 = performance.now(), raf = 0, visible = true;
  addEventListener('pointermove', function (e) { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) req(); }).observe(cv);
  function req() { if (!raf && gl && progMesh && M) raf = requestAnimationFrame(frame); }
  function start() { req(); window.addEventListener('themechange', req); }
  function common(u, t, phase, R, lt) {
    gl.uniformMatrix3fv(u.uRot, false, R); gl.uniform1f(u.uBeat, window.ldbBeat(phase)); gl.uniform1f(u.uAspect, W / H);
    gl.uniform1f(u.uScale, mobile ? 1.4 : Math.min(1.3, 1.3 * (W / H) / 1.5)); gl.uniform1f(u.uOffY, mobile ? -0.06 : -0.05);
    gl.uniform1f(u.uLight, lt); gl.uniform1f(u.uTime, t);
  }
  function frame(now) {
    raf = 0;
    var t = reduced ? 1.3 : (now - t0) / 1000, phase = (t / PERIOD) % 1, lt = document.documentElement.classList.contains('lt') ? 1 : 0;
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
    // anatomical view from the front; a slow sway shows its depth without turning it side-on
    var ay = Math.sin(t * 0.4) * 0.45 + mx * 0.9 - 0.1, ax = 0.06 + my * 0.35;
    var cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    var R = [cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy];   // pitch after yaw, column-major
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND);
    // the mesh: lit in solid mode, depth only in dots mode (pushed back a touch so surface dots win)
    gl.useProgram(progMesh);
    bindAttr(progMesh, 'aPos', B.pos, 3, gl.UNSIGNED_SHORT, true); bindAttr(progMesh, 'aNrm', B.nrm, 3, gl.BYTE, true); bindAttr(progMesh, 'aGrp', B.grp, 1, gl.UNSIGNED_BYTE, false);
    gl.uniform3fv(U.uMin, M.bmin); gl.uniform3fv(U.uMax, M.bmax); common(U, t, phase, R, lt);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, B.idx);
    if (mode === 'dots') { gl.colorMask(false, false, false, false); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4); }
    gl.drawElements(gl.TRIANGLES, M.ni, gl.UNSIGNED_SHORT, 0);
    gl.colorMask(true, true, true, true); gl.disable(gl.POLYGON_OFFSET_FILL);
    drawWordmark();
    if (mode === 'dots') {
      gl.useProgram(progDots); [3, 4, 5, 6].forEach(function () {});
      bindAttr(progDots, 'aPos', B.dpos, 3, gl.FLOAT, false); bindAttr(progDots, 'aNrm', B.dnrm, 3, gl.FLOAT, false); bindAttr(progDots, 'aGrp', B.dgrp, 1, gl.FLOAT, false); bindAttr(progDots, 'aRnd', B.drnd, 1, gl.FLOAT, false);
      common(UD, t, phase, R, lt); gl.uniform1f(UD.uPx, (mobile ? 1.7 : 1.9) * dpr * Math.min(1.25, Math.max(0.8, H / 800)));
      gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.POINTS, 0, D.n);
    }
    if (!reduced && visible) req();
  }

  // no WebGL: draw the same anatomy as dots on a 2D canvas
  function fallback() {
    var c = cv.getContext('2d'); if (!c || !M) return; cv.classList.add('on');
    function draw() {
      var r = cv.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = r.height * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      var s = Math.min(r.width, r.height) * 0.8, ox = r.width / 2, oy = r.height / 2;
      c.fillStyle = 'rgba(224,87,95,.7)';
      for (var i = 0; i < M.n; i += 3) { var x = M.bmin[0] + M.pos[i * 3] / 65535 * (M.bmax[0] - M.bmin[0]), y = M.bmin[1] + M.pos[i * 3 + 1] / 65535 * (M.bmax[1] - M.bmin[1]); c.fillRect(ox + x * s, oy - y * s, 1.4, 1.4); }
    }
    draw(); addEventListener('resize', draw);
  }
})();
