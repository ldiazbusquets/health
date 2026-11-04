/* Hero: a 3D particle heart that beats, an ECG trace in time with it, and the dot-matrix wordmark.
   The heart is the classic implicit surface (x² + 9/4 z² + y² − 1)³ − x² y³ − 9/80 z² y³ = 0,
   sampled by casting rays from its centre and finding where each ray leaves the surface. */
(function () {
  var cv = document.getElementById('heart'); if (!cv) return;
  var ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1), W = 0, H = 0, mobile = false;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PERIOD = 0.92; // seconds per beat (about 65 per minute)

  function f(x, y, z) { var a = x * x + 2.25 * z * z + y * y - 1; return a * a * a - x * x * y * y * y - 0.1125 * z * z * y * y * y; }
  var pts = [];
  (function sample() {
    var n = 4600, i = 0, guard = 0;
    while (pts.length < n && guard++ < n * 4) {
      var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      var dx = s * Math.cos(th), dy = u, dz = s * Math.sin(th);
      var lo = 0, hi = 1.7; if (f(dx * hi, dy * hi, dz * hi) < 0) continue;
      for (i = 0; i < 26; i++) { var m = (lo + hi) / 2; if (f(dx * m, dy * m, dz * m) < 0) lo = m; else hi = m; }
      var r = (lo + hi) / 2;
      pts.push([dx * r, dy * r - 0.1, dz * r, Math.random()]);
    }
  })();

  // dot-matrix wordmark
  var dots = [];
  function buildWordmark() {
    dots = [];
    var text = 'LDB HEALTH', o = document.createElement('canvas'), c = o.getContext('2d');
    var cols = mobile ? 0 : Math.floor(W / 7); if (!cols) return;
    var gw = cols, gh = Math.floor(gw * 0.22); o.width = gw; o.height = gh;
    c.fillStyle = '#000'; c.font = '600 ' + Math.floor(gh * 0.92) + 'px Manrope, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    var fit = c.measureText(text).width; if (fit > gw * 0.86) c.font = '600 ' + Math.floor(gh * 0.92 * gw * 0.86 / fit) + 'px Manrope, system-ui, sans-serif';
    c.fillText(text, gw / 2, gh / 2 + gh * 0.04);
    var d = c.getImageData(0, 0, gw, gh).data, step = W / gw, top = Math.max(84, H * 0.1);
    for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++) if (d[(y * gw + x) * 4 + 3] > 120) dots.push([x * step + step / 2, top + y * step, Math.random()]);
  }

  function resize() {
    var r = cv.getBoundingClientRect(); W = r.width; H = r.height; mobile = innerWidth <= 980;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildWordmark); else buildWordmark();
    buildWordmark();
  }
  addEventListener('resize', resize);

  function g(p, m, s) { var d = (p - m) / s; return Math.exp(-d * d); }
  function ecg(p) { return 0.1 * g(p, .12, .025) - 0.12 * g(p, .232, .008) + 1 * g(p, .25, .009) - 0.24 * g(p, .27, .01) + 0.28 * g(p, .45, .04); }
  function beat(p) { return 1 + 0.06 * g(p, .27, .035) + 0.03 * g(p, .47, .05); }

  var mx = 0, my = 0, tx = 0, ty = 0;
  addEventListener('pointermove', function (e) { tx = (e.clientX / innerWidth - .5); ty = (e.clientY / innerHeight - .5); }, { passive: true });

  var t0 = performance.now(), visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) req(); }).observe(cv);
  var raf = 0; function req() { if (!raf) raf = requestAnimationFrame(draw); }

  function draw(now) {
    raf = 0;
    var t = reduced ? 1.3 : (now - t0) / 1000, C = window.ldbColors ? window.ldbColors() : { lt: false };
    var lt = C.lt;
    ctx.clearRect(0, 0, W, H);
    // wordmark
    var wa = lt ? 'rgba(120,40,46,' : 'rgba(255,235,236,';
    for (var i = 0; i < dots.length; i++) { var d = dots[i], tw = 0.07 + 0.05 * Math.sin(t * 1.3 + d[2] * 12); ctx.fillStyle = wa + tw.toFixed(3) + ')'; ctx.fillRect(d[0] - 1.3, d[1] - 1.3, 2.6, 2.6); }

    // heart
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    var phase = (t / PERIOD) % 1, sc = beat(phase);
    var cx = W / 2, cy = mobile ? H * 0.5 : H * 0.53, R = Math.min(W * (mobile ? 0.36 : 0.2), H * (mobile ? 0.34 : 0.3)) * sc;
    var ay = Math.sin(t * 0.45) * 0.62 + mx * 0.7, ax = -0.18 + my * 0.3, ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax);
    var front = lt ? [150, 30, 40] : [255, 225, 226], back = lt ? [190, 120, 125] : [200, 70, 78];
    for (i = 0; i < pts.length; i++) {
      var p = pts[i], x = p[0], y = p[1], z = p[2];
      var x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
      var y1 = y * cb - z1 * sb, z2 = y * sb + z1 * cb;
      var depth = (z2 + 1.4) / 2.8, persp = 1 / (1 + z2 * 0.18);
      var sx = cx + x1 * R * persp, sy = cy - y1 * R * persp;
      var k = Math.max(0, Math.min(1, depth)), a = 0.22 + 0.78 * k;
      var flick = 0.85 + 0.15 * Math.sin(t * 2 + p[3] * 20);
      var c0 = Math.round(back[0] + (front[0] - back[0]) * k), c1 = Math.round(back[1] + (front[1] - back[1]) * k), c2 = Math.round(back[2] + (front[2] - back[2]) * k);
      ctx.fillStyle = 'rgba(' + c0 + ',' + c1 + ',' + c2 + ',' + (a * flick).toFixed(3) + ')';
      var s = (0.9 + 1.7 * k) * persp; ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
    // soft glow on the beat
    var glow = 0.1 + 0.25 * g(phase, .27, .06);
    var gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
    gr.addColorStop(0, lt ? 'rgba(200,65,74,' + (glow * 0.5).toFixed(3) + ')' : 'rgba(240,90,98,' + (glow * 0.6).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(cx - R * 1.7, cy - R * 1.7, R * 3.4, R * 3.4);

    // ECG trace: scrolls left, newest beat at the right
    var ey = mobile ? H * 0.9 : H * 0.84, amp = Math.min(70, H * 0.075), speed = Math.max(160, W * 0.16);
    ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; var x0;
    var x0 = mobile ? 0 : W * 0.3, grad = ctx.createLinearGradient(x0, 0, W, 0);
    var lc = lt ? '170,40,50' : '255,170,175';
    grad.addColorStop(0, 'rgba(' + lc + ',0)'); grad.addColorStop(0.55, 'rgba(' + lc + ',.35)'); grad.addColorStop(1, 'rgba(' + lc + ',.95)');
    ctx.strokeStyle = grad; ctx.beginPath();
    for (var px = x0; px <= W; px += 2) { var tt = t - (W - px) / speed, v = ecg(((tt / PERIOD) % 1 + 1) % 1); if (px === x0) ctx.moveTo(px, ey - v * amp); else ctx.lineTo(px, ey - v * amp); }
    ctx.stroke();
    var vNow = ecg(phase); ctx.fillStyle = 'rgba(' + lc + ',1)'; ctx.beginPath(); ctx.arc(W - 2, ey - vNow * amp, 3, 0, 7); ctx.fill();

    if (!reduced && visible) req();
  }
  resize(); req();
  window.addEventListener('themechange', req);
})();
