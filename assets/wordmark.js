/* Hero wordmark: "LDB HEALTH" as particles that scatter around the cursor and drift in and out of focus
   (the same effect as the LDB Lab hero, in red). */
(function () {
  var cv = document.getElementById('wordmark'); if (!cv) return;
  var x = cv.getContext('2d'), bl = document.createElement('canvas'), bx = bl.getContext('2d'), P = [], W = 0, H = 0, dpr = 1, mx = -9999, my = -9999, on = false, t0 = performance.now(), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function lt() { return document.documentElement.classList.contains('lt'); }
  function build() {
    W = cv.clientWidth; H = cv.clientHeight; dpr = Math.min(2, devicePixelRatio || 1); if (W < 10 || H < 10) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var o = document.createElement('canvas'), ox = o.getContext('2d', { willReadFrequently: true }); o.width = W; o.height = H;
    var A = 'LDB', B = 'HEALTH', gapK = .38, fs = H * 1.05;
    function setF() { ox.font = '500 ' + fs + 'px Manrope, system-ui, sans-serif'; if ('letterSpacing' in ox) ox.letterSpacing = (-fs * .055) + 'px'; }
    setF(); var w1 = ox.measureText(A).width, w2 = ox.measureText(B).width, tw = w1 + w2 + fs * gapK;
    fs *= Math.min(1, W * .94 / tw); setF();
    w1 = ox.measureText(A).width; w2 = ox.measureText(B).width; tw = w1 + w2 + fs * gapK;
    ox.textAlign = 'left'; ox.textBaseline = 'alphabetic'; ox.fillStyle = '#fff';
    var x0 = (W - tw) / 2, base = Math.min(H * .86, H / 2 + fs * .36);
    ox.fillText(A, x0, base); ox.fillText(B, x0 + w1 + fs * gapK, base);
    var d = ox.getImageData(0, 0, W, H).data, gap = Math.max(3, Math.round(W / 300)); P = [];
    for (var yy = 0; yy < H; yy += gap) for (var xx = 0; xx < W; xx += gap) if (d[(yy * W + xx) * 4 + 3] > 128) P.push({ x: xx + (Math.random() - .5) * 60, y: yy + (Math.random() - .5) * 60, ox: xx, oy: yy, vx: 0, vy: 0, s: .7 + Math.random() * .8 });
  }
  function gapSize() { return Math.max(1.6, W / 520); }
  function frame(now) {
    if (!on) return; var t = (now - t0) / 1000, R = Math.max(90, W * .09), sweep = (Math.sin(t * .35) * .55 + .5) * W, LT = lt(), g = gapSize();
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    for (var i = 0; i < P.length; i++) { var p = P[i], dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
      if (d2 < R * R) { var dd = Math.sqrt(d2) || 1, f = (1 - dd / R) * 7; p.vx += dx / dd * f; p.vy += dy / dd * f - .4; }
      p.vx += (p.ox - p.x) * .045; p.vy += (p.oy - p.y) * .045; p.vx *= .84; p.vy *= .84; p.x += p.vx; p.y += p.vy; }
    /* inside the heart's WebGL canvas (so the heart always covers it): hand over the particles, the GPU draws them */
    if (cv.classList.contains('ingl')) {
      var n = P.length, A = window.ldbWM && window.ldbWM.buf.length >= n * 4 ? window.ldbWM.buf : new Float32Array(Math.max(4, n * 4));
      for (var c = 0; c < n; c++) { var u = P[c], fu = Math.max(0, 1 - Math.abs(u.ox - (mx > -999 ? mx : sweep)) / (W * .16)), mv = Math.min(1, Math.abs(u.vx) + Math.abs(u.vy));
        /* particles pushed out of the word's box fade away instead of being cut off in a hard line */
        var out = Math.max(0, -u.y, u.y - H, -u.x, u.x - W), fd = Math.max(0, 1 - out / 36);
        A[c * 4] = u.x; A[c * 4 + 1] = u.y; A[c * 4 + 2] = Math.floor(u.s * 100) + Math.min(.99, fd); A[c * 4 + 3] = Math.min(.9, fu * .75 + mv * .6) * Math.min(1, t / 1.2) * fd; }
      window.ldbWM = { n: n, buf: A, W: W, H: H, g: g, blur: Math.max(2, 9 - t * 3), lt: LT, cv: cv };
      if (reduce) dispatchEvent(new Event('wordmarkdraw'));
      requestAnimationFrame(frame); return;
    }
    /* blurred layer: the letters out of focus */
    if (bl.width !== cv.width || bl.height !== cv.height) { bl.width = cv.width; bl.height = cv.height; }
    bx.setTransform(dpr, 0, 0, dpr, 0, 0); bx.clearRect(0, 0, W, H); bx.fillStyle = LT ? 'rgba(160,74,82,.5)' : 'rgba(255,186,192,.42)';
    for (var a = 0; a < P.length; a++) { var q = P[a]; bx.fillRect(q.x, q.y, g, g); }
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = .55; x.drawImage(bl, 0, 0); x.globalAlpha = 1; x.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* sharp layer: in focus near the cursor and along a slow sweep */
    for (var b = 0; b < P.length; b++) { var r = P[b], fx = Math.max(0, 1 - Math.abs(r.ox - (mx > -999 ? mx : sweep)) / (W * .16)), moving = Math.min(1, Math.abs(r.vx) + Math.abs(r.vy));
      var al = Math.min(.95, fx * .8 + moving * .9) * Math.min(1, t / 1.2); if (al < .03) continue;
      x.fillStyle = (LT ? 'rgba(122,40,48,' : 'rgba(255,226,228,') + al.toFixed(2) + ')'; x.fillRect(r.x, r.y, g * r.s, g * r.s); }
    requestAnimationFrame(frame);
  }
  var hero = document.querySelector('.hero') || cv.parentNode;
  hero.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; }, { passive: true });
  hero.addEventListener('pointerleave', function () { mx = -9999; my = -9999; });
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 150); });
  function still() { P.forEach(function (p) { p.x = p.ox; p.y = p.oy; }); on = true; t0 = performance.now() - 5000; frame(performance.now()); on = false; }
  function start() { build(); if (reduce) { still(); addEventListener('themechange', still); addEventListener('wordmarkgl', still); return; }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { var v = es[0].isIntersecting; if (v && !on) { on = true; requestAnimationFrame(frame); } if (!v) on = false; }).observe(cv);
    else { on = true; requestAnimationFrame(frame); } }
  if (document.fonts && document.fonts.load) document.fonts.load('500 100px Manrope').then(start, start); else start();
})();
