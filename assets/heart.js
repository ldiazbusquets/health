/* Hero background layer: a soft glow on each beat and an ECG trace in time
   with it. The anatomical heart itself is drawn by heart3d.js on a WebGL canvas above this one. */
(function () {
  var cv = document.getElementById('heart'); if (!cv) return;
  var ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1), W = 0, H = 0, mobile = false;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PERIOD = 0.92; // seconds per beat (about 65 per minute)

  function resize() {
    var r = cv.getBoundingClientRect(); W = r.width; H = r.height; mobile = innerWidth <= 980;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    // heart
    mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
    var phase = (t / PERIOD) % 1, sc = 1 + (window.ldbBeat ? window.ldbBeat(phase) : 0);
    var cx = W / 2, cy = mobile ? H * 0.5 : H * 0.53, R = Math.min(W * (mobile ? 0.36 : 0.2), H * (mobile ? 0.34 : 0.3)) * sc;
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
