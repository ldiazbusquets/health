/* Hero: an anatomical heart, rendered with WebGL.
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
    .then(function (buf) { parse(buf); if (gl) setup(); else fallback(); })
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

  var prog, U = {}, W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1), mobile = false;
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function setup() {
    try {
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    } catch (e) { gl = null; fallback(); return; }
    gl.useProgram(prog);
    function attr(name, data, size, type, norm) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); var l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, type, norm, 0, 0); }
    attr('aPos', M.pos, 3, gl.UNSIGNED_SHORT, true); attr('aNrm', M.nrm, 3, gl.BYTE, true); attr('aGrp', M.grp, 1, gl.UNSIGNED_BYTE, false);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, M.idx, gl.STATIC_DRAW);
    ['uMin', 'uMax', 'uRot', 'uBeat', 'uAspect', 'uScale', 'uOffY', 'uLight', 'uTime'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
    gl.uniform3fv(U.uMin, M.bmin); gl.uniform3fv(U.uMax, M.bmax);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
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
  function req() { if (!raf && gl && prog && M) raf = requestAnimationFrame(frame); }
  function start() { req(); window.addEventListener('themechange', req); }
  function frame(now) {
    raf = 0;
    var t = reduced ? 1.3 : (now - t0) / 1000, phase = (t / PERIOD) % 1;
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
    var ay = Math.sin(t * 0.4) * 0.5 + mx * 0.9 - 0.12, ax = 0.06 + my * 0.35, az = 0;
    var cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    // rotation: yaw then pitch (column-major for GLSL)
    var R = [cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy];
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // place the heart: centred, a bit lower on desktop; size from the shorter side
    gl.uniformMatrix3fv(U.uRot, false, R); gl.uniform1f(U.uBeat, window.ldbBeat(phase)); gl.uniform1f(U.uAspect, W / H);
    gl.uniform1f(U.uScale, mobile ? 1.4 : Math.min(1.3, 1.3 * (W / H) / 1.5)); gl.uniform1f(U.uOffY, mobile ? -0.06 : -0.05); gl.uniform1f(U.uLight, document.documentElement.classList.contains('lt') ? 1 : 0); gl.uniform1f(U.uTime, t);
    gl.drawElements(gl.TRIANGLES, M.ni, gl.UNSIGNED_SHORT, 0);
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
