/* Scroll reveals, count-up numbers, and reduced-motion handling for SVG animations. */
(()=>{
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) { document.querySelectorAll("svg.art").forEach(s => { try { s.pauseAnimations(); } catch(e){} }); return; }

  // Reveal on scroll: only elements that start below the fold get hidden, so the page is never blank.
  const sel = ".section-head, .area, .minor, .pcard, .pubs li, .topics-grid > div, .mosaic .av, .card, .year-block, .prose, .sidebar";
  const els = [...document.querySelectorAll(sel)].filter(el => el.getBoundingClientRect().top > innerHeight * 0.92);
  const groups = new Map();
  els.forEach(el => {
    const p = el.parentElement, i = (groups.get(p) || 0); groups.set(p, i + 1);
    el.style.setProperty("--d", Math.min(i * 0.05, 0.6) + "s");
    el.classList.add("reveal");
  });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach(el => io.observe(el));
  } else els.forEach(el => el.classList.add("in"));

  // Count-up for the hero numbers (final value is already in the HTML)
  document.querySelectorAll("[data-count-up]").forEach(el => {
    const end = parseInt(el.textContent, 10); if (!end) return;
    const from = end > 1900 ? end - 40 : 0, t0 = performance.now(), dur = 1400;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (end - from) * e); if (k < 1) requestAnimationFrame(step); };
    el.textContent = from; requestAnimationFrame(step);
  });
})();
