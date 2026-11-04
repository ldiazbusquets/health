/* Header, menu, theme button, scroll reveals, footer year. Shared by every page. */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var head = $('header.top');
  function onScroll() { if (head) head.classList.toggle('scrolled', scrollY > 30); }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var tb = $('#themeBtn'); if (tb) tb.addEventListener('click', window.ldbToggleTheme);
  var mb = $('#menuBtn'), nav = $('#nav');
  if (mb && nav) {
    mb.addEventListener('click', function () { var o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) { nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); } });
  }
  var rv = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('in'); });
  // highlight the section in view
  var links = document.querySelectorAll('.nav a[href^="#"]');
  if (links.length && 'IntersectionObserver' in window) {
    var map = {}; links.forEach(function (a) { var id = a.getAttribute('href').slice(1), s = document.getElementById(id); if (s) map[id] = a; });
    var so = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { links.forEach(function (a) { a.classList.remove('on'); }); if (map[e.target.id]) map[e.target.id].classList.add('on'); } }); }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { so.observe(document.getElementById(id)); });
  }
  var y = $('#yr'); if (y) y.textContent = new Date().getFullYear();
  // colours that canvases read (they follow the theme)
  window.ldbColors = function () { var cs = getComputedStyle(document.documentElement); var g = function (n) { return cs.getPropertyValue(n).trim(); };
    return { ink: g('--ink'), t2: g('--t2'), t3: g('--t3'), ln: g('--ln'), ln2: g('--ln2'), acc: g('--acc'), acc2: g('--acc2'), green: g('--green'), rose: g('--rose'), blue: g('--blue'), bg: g('--bg'), s1: g('--s1'), lt: document.documentElement.classList.contains('lt') }; };

  // footer wordmark: letters come into focus near the cursor, and a slow wave runs through them otherwise
  var wm = document.getElementById('wm');
  if (wm) {
    var L = [].slice.call(wm.querySelectorAll('span')), wx = -1, w0 = performance.now(), won = false, wred = matchMedia('(prefers-reduced-motion: reduce)').matches;
    wm.addEventListener('pointermove', function (e) { wx = e.clientX; });
    wm.addEventListener('pointerleave', function () { wx = -1; });
    var wf = function (now) {
      if (!won) return; var t = (now - w0) / 1000;
      L.forEach(function (s, i) {
        var r = s.getBoundingClientRect(), c = r.left + r.width / 2, b;
        if (wx >= 0) b = Math.min(14, Math.abs(wx - c) / 40);
        else { var ph = (t * .45 - i / L.length) % 1.6; b = ph > 0 && ph < .45 ? 14 * Math.sin(ph / .45 * Math.PI) : 0; }
        s.style.filter = 'blur(' + b.toFixed(1) + 'px)';
      });
      requestAnimationFrame(wf);
    };
    if (!wred && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { var v = es[0].isIntersecting; if (v && !won) { won = true; requestAnimationFrame(wf); } if (!v) won = false; }).observe(wm);
  }
})();
