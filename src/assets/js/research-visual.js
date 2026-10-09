/* Animated research visuals for the profile pages. A canvas with data-scene="<name>" gets one of
   the scenes below, drawn in the colours of the person's research area (CSS variable --c).
   Scenes: bootstrap, dirac, cosmos, lensing, bloch, chain. */
(() => {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = Math.PI * 2;

  // ---------- helpers ----------
  const rgba = (hex, a) => {
    const h = hex.replace("#", "").trim();
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------- scenes: each is (ctx, w, h, t, col) where t is seconds ----------
  const scenes = {
    // Analytic/lightcone bootstrap: double-twist families tau_n(J) = 2Δ + 2n - c_n / J^τmin approach their asymptotes
    bootstrap(c, w, h, t, col) {
      const L = w * 0.36, R = w * 0.95, T = h * 0.1, B = h * 0.84;
      const X = (J) => L + (R - L) * (J / 16), Y = (tau) => B - (B - T) * (tau / 7.5);
      c.strokeStyle = rgba(col.ink, 0.35); c.lineWidth = 1;
      c.beginPath(); c.moveTo(L, T); c.lineTo(L, B); c.lineTo(R, B); c.stroke();
      c.fillStyle = rgba(col.ink, 0.55); c.font = `${Math.round(h * 0.045)}px Helvetica, Arial, sans-serif`;
      c.fillText("spin J", R - h * 0.16, B + h * 0.08); c.save(); c.translate(L - h * 0.06, T + h * 0.2); c.rotate(-Math.PI / 2); c.fillText("twist τ", 0, 0); c.restore();
      const cyc = 9, ph = (t % cyc) / cyc;
      for (let n = 0; n < 3; n++) {
        const asym = 2 * 1.2 + 2 * n;                 // 2Δφ + 2n with Δφ = 1.2
        c.setLineDash([4, 5]); c.strokeStyle = rgba(col.ink, 0.35);
        c.fillStyle = rgba(col.ink, 0.6); c.fillText(`n = ${n}`, R - h * 0.12, Y(asym) - h * 0.025);
        c.beginPath(); c.moveTo(L, Y(asym)); c.lineTo(R, Y(asym)); c.stroke(); c.setLineDash([]);
        const cn = 1.6 + 0.7 * n, pts = [];
        for (let J = 2; J <= 16; J += 2) pts.push([J, asym - cn / Math.pow(J, 1)]);
        const shown = ease(ph * 1.6 - n * 0.18) * pts.length;
        c.strokeStyle = rgba(col.accent, 0.9); c.lineWidth = 2.2; c.beginPath();
        pts.forEach(([J, tau], i) => { if (i < shown) (i ? c.lineTo(X(J), Y(tau)) : c.moveTo(X(J), Y(tau))); }); c.stroke();
        pts.forEach(([J, tau], i) => {
          if (i >= shown) return;
          const a = Math.min(1, shown - i);
          c.fillStyle = rgba(n === 0 ? col.accent : col.ink, 0.95 * a);
          c.beginPath(); c.arc(X(J), Y(tau), h * 0.022 * (0.6 + 0.4 * a), 0, TAU); c.fill();
        });
      }
      // stress tensor (J=2, τ=2) and the leading Regge-like pull
      c.fillStyle = rgba(col.ink, 0.9); c.beginPath(); c.arc(X(2), Y(2), h * 0.02, 0, TAU); c.fill();
      c.fillText("T", X(2) + h * 0.03, Y(2) + h * 0.015);
    },

    // Graphene bands E(k) = ±|1 + e^{ik·a1} + e^{ik·a2}| as a rotating wireframe, Dirac cones at K, K'
    dirac(c, w, h, t, col) {
      const N = 26, span = 4.6, rot = t * 0.18, tilt = 0.95, s = Math.min(w, h) * 0.17;
      const cx = w * 0.55, cy = h * 0.5;
      const E = (kx, ky) => { const a = kx, b = kx / 2 + ky * Math.sqrt(3) / 2; const re = 1 + Math.cos(a) + Math.cos(b), im = Math.sin(a) + Math.sin(b); return Math.hypot(re, im); };
      const P = (x, y, z) => { const xr = x * Math.cos(rot) - y * Math.sin(rot), yr = x * Math.sin(rot) + y * Math.cos(rot); return [cx + xr * s, cy + yr * s * Math.cos(tilt) - z * s * 0.75 * Math.sin(tilt)]; };
      for (const sign of [1, -1]) {
        c.strokeStyle = rgba(sign > 0 ? col.accent : col.ink, sign > 0 ? 0.55 : 0.32); c.lineWidth = 1;
        for (let dir = 0; dir < 2; dir++) for (let i = 0; i <= N; i++) {
          c.beginPath();
          for (let j = 0; j <= N; j++) {
            const u = -span + 2 * span * i / N, v = -span + 2 * span * j / N;
            const [kx, ky] = dir ? [u, v] : [v, u];
            const [px, py] = P(kx * 0.42, ky * 0.42, sign * E(kx, ky) * 0.45);
            j ? c.lineTo(px, py) : c.moveTo(px, py);
          }
          c.stroke();
        }
      }
      // mark the Dirac points (E = 0)
      const K = [[4 * Math.PI / 3, 0], [-4 * Math.PI / 3, 0], [2 * Math.PI / 3, 2 * Math.PI / Math.sqrt(3)], [-2 * Math.PI / 3, -2 * Math.PI / Math.sqrt(3)]];
      c.fillStyle = rgba(col.ink, 0.95);
      for (const [kx, ky] of K) { if (Math.abs(kx) > span || Math.abs(ky) > span) continue; const [px, py] = P(kx * 0.42, ky * 0.42, 0); c.beginPath(); c.arc(px, py, 2.6 + 1.2 * Math.sin(t * 2), 0, TAU); c.fill(); }
    },

    // Hubble diagram: supernovae appear on the ΛCDM curve; the matter-only universe falls below
    cosmos(c, w, h, t, col) {
      const L = w * 0.36, R = w * 0.95, T = h * 0.1, B = h * 0.84;
      const X = (z) => L + (R - L) * (z / 1.6), Y = (mu) => B - (B - T) * ((mu - 35.5) / 11);
      const dl = (z, Om, OL) => { let s = 0, n = 60; for (let i = 0; i < n; i++) { const zz = (i + 0.5) * z / n; s += 1 / Math.sqrt(Om * (1 + zz) ** 3 + OL + (1 - Om - OL) * (1 + zz) ** 2); } return (1 + z) * s * z / n * 4283; };
      const mu = (z, Om, OL) => 5 * Math.log10(dl(z, Om, OL)) + 25;
      c.strokeStyle = rgba(col.ink, 0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(L, T); c.lineTo(L, B); c.lineTo(R, B); c.stroke();
      c.fillStyle = rgba(col.ink, 0.55); c.font = `${Math.round(h * 0.045)}px Helvetica, Arial, sans-serif`;
      c.fillText("redshift z", R - h * 0.22, B + h * 0.08); c.save(); c.translate(L - h * 0.06, T + h * 0.3); c.rotate(-Math.PI / 2); c.fillText("distance", 0, 0); c.restore();
      for (const [Om, OL, a, lab] of [[1, 0, 0.35, "matter only"], [0.3, 0.7, 0.85, "ΛCDM"]]) {
        c.strokeStyle = rgba(OL ? col.accent : col.ink, a); c.lineWidth = OL ? 2 : 1.2; c.setLineDash(OL ? [] : [5, 5]);
        c.beginPath(); for (let z = 0.02; z <= 1.6; z += 0.02) { const p = [X(z), Y(mu(z, Om, OL))]; z < 0.03 ? c.moveTo(...p) : c.lineTo(...p); } c.stroke(); c.setLineDash([]);
        c.fillStyle = rgba(OL ? col.accent : col.ink, a); c.fillText(lab, X(1.6) - c.measureText(lab).width, Y(mu(1.6, Om, OL)) + (OL ? -h * 0.04 : h * 0.07));
      }
      seed = 11; const cyc = 8, k = (t % cyc) / cyc;
      for (let i = 0; i < 40; i++) {
        const z = 0.03 + 1.5 * rnd() ** 1.3, e = (rnd() - 0.5) * 0.5, show = ease(k * 2.2 - i / 40);
        if (show <= 0) continue;
        const px = X(z), py = Y(mu(z, 0.3, 0.7) + e);
        c.strokeStyle = rgba(col.ink, 0.35 * show); c.beginPath(); c.moveTo(px, py - h * 0.025); c.lineTo(px, py + h * 0.025); c.stroke();
        c.fillStyle = rgba(col.ink, 0.95 * show); c.beginPath(); c.arc(px, py, h * 0.016, 0, TAU); c.fill();
      }
    },

    // Black hole: shadow, photon ring, and a background star field bent by the lens as the hole drifts
    lensing(c, w, h, t, col) {
      const bx = w * (0.55 + 0.08 * Math.sin(t * 0.25)), by = h * 0.5, rs = Math.min(w, h) * 0.12, rE = rs * 1.9;
      seed = 3;
      for (let i = 0; i < 260; i++) {
        let x = rnd() * w, y = rnd() * h; const m = 0.3 + rnd() * 0.7;
        const dx = x - bx, dy = y - by, b = Math.hypot(dx, dy) || 1;
        // point-lens images: θ± = (b ± sqrt(b² + 4 rE²)) / 2
        for (const sgn of [1, -1]) {
          const th = (b + sgn * Math.sqrt(b * b + 4 * rE * rE)) / 2;
          if (Math.abs(th) < rs * 1.02) continue;
          const px = bx + dx / b * th, py = by + dy / b * th;
          const mag = Math.min(4, Math.abs((th / b) * (th / (b + (sgn > 0 ? 1e-3 : 1e-3)))));
          c.fillStyle = rgba(col.ink, Math.min(1, (sgn > 0 ? 0.55 : 0.35) * m * Math.sqrt(mag)));
          c.beginPath(); c.arc(px, py, 0.8 + m * 0.9, 0, TAU); c.fill();
        }
      }
      const g = c.createRadialGradient(bx, by, rs * 0.9, bx, by, rs * 1.6);
      g.addColorStop(0, rgba(col.accent, 0.9)); g.addColorStop(0.25, rgba(col.accent, 0.35)); g.addColorStop(1, rgba(col.accent, 0));
      c.fillStyle = g; c.beginPath(); c.arc(bx, by, rs * 1.6, 0, TAU); c.fill();
      c.fillStyle = col.bg; c.beginPath(); c.arc(bx, by, rs, 0, TAU); c.fill();
      // photons on the unstable circular orbit
      for (let i = 0; i < 3; i++) { const a = t * 1.3 + i * TAU / 3; c.fillStyle = rgba(col.ink, 0.9); c.beginPath(); c.arc(bx + Math.cos(a) * rs * 1.18, by + Math.sin(a) * rs * 0.42, 2, 0, TAU); c.fill(); }
    },

    // Bloch sphere with a precessing qubit state
    bloch(c, w, h, t, col) {
      const cx = w * 0.56, cy = h * 0.5, r = Math.min(w, h) * 0.34, tilt = 0.35;
      const P = (x, y, z) => [cx + x * r, cy - z * r * Math.cos(tilt) + y * r * Math.sin(tilt)];
      c.strokeStyle = rgba(col.ink, 0.3); c.lineWidth = 1;
      for (let k = -2; k <= 2; k++) { const z = k / 3, rr = Math.sqrt(1 - z * z); c.beginPath(); for (let a = 0; a <= TAU + 0.01; a += 0.1) { const p = P(rr * Math.cos(a), rr * Math.sin(a), z); a ? c.lineTo(...p) : c.moveTo(...p); } c.stroke(); }
      for (let m = 0; m < 6; m++) { const ph = m * Math.PI / 6; c.beginPath(); for (let a = 0; a <= TAU + 0.01; a += 0.1) { const p = P(Math.sin(a) * Math.cos(ph), Math.sin(a) * Math.sin(ph), Math.cos(a)); a ? c.lineTo(...p) : c.moveTo(...p); } c.stroke(); }
      c.fillStyle = rgba(col.ink, 0.7); c.font = `${Math.round(h * 0.05)}px Helvetica, Arial, sans-serif`;
      const top = P(0, 0, 1.12), bot = P(0, 0, -1.2); c.fillText("|0⟩", top[0] - 8, top[1]); c.fillText("|1⟩", bot[0] - 8, bot[1] + 10);
      const th = 1.0 + 0.45 * Math.sin(t * 0.4), phi = t * 0.9;
      const trail = [];
      for (let k = 0; k < 60; k++) { const tt = t - k * 0.05, a = 1.0 + 0.45 * Math.sin(tt * 0.4), b = tt * 0.9; trail.push(P(Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b), Math.cos(a))); }
      trail.forEach((p, k) => { c.fillStyle = rgba(col.accent, 0.5 * (1 - k / 60)); c.beginPath(); c.arc(p[0], p[1], 2, 0, TAU); c.fill(); });
      const tip = P(Math.sin(th) * Math.cos(phi), Math.sin(th) * Math.sin(phi), Math.cos(th));
      c.strokeStyle = rgba(col.accent, 0.95); c.lineWidth = 2.4; c.beginPath(); c.moveTo(cx, cy); c.lineTo(...tip); c.stroke();
      c.fillStyle = col.accent; c.beginPath(); c.arc(tip[0], tip[1], 5, 0, TAU); c.fill();
    },

    // 1D Hubbard chain: an injected hole splits into a holon (charge) and a spinon (spin) moving at different speeds
    chain(c, w, h, t, col) {
      const N = 22, L = w * 0.08, R = w * 0.96, y = h * 0.5, dx = (R - L) / (N - 1), cyc = 7, k = (t % cyc) / cyc;
      const x0 = N / 2, holon = x0 + k * 9, spinon = x0 - k * 5;
      c.strokeStyle = rgba(col.ink, 0.25); c.lineWidth = 1; c.beginPath(); c.moveTo(L, y); c.lineTo(R, y); c.stroke();
      for (let i = 0; i < N; i++) {
        const x = L + i * dx;
        const isHolon = Math.abs(i - holon) < 0.5, isSpinon = Math.abs(i - spinon) < 0.5;
        if (isHolon) { c.strokeStyle = rgba(col.accent, 0.95); c.lineWidth = 2; c.beginPath(); c.arc(x, y, h * 0.05, 0, TAU); c.stroke(); continue; }
        let up = i % 2 === 0; if (i > holon) up = !up; if (i < spinon) up = !up;
        const len = h * 0.11 * (isSpinon ? 1.25 : 1);
        c.strokeStyle = isSpinon ? col.accent : rgba(col.ink, 0.75); c.lineWidth = isSpinon ? 2.6 : 1.8;
        c.beginPath(); c.moveTo(x, y + (up ? len / 2 : -len / 2)); c.lineTo(x, y + (up ? -len / 2 : len / 2)); c.stroke();
        const ty = y + (up ? -len / 2 : len / 2), d = up ? 1 : -1;
        c.beginPath(); c.moveTo(x, ty); c.lineTo(x - 4, ty + 6 * d); c.moveTo(x, ty); c.lineTo(x + 4, ty + 6 * d); c.stroke();
      }
      c.fillStyle = rgba(col.ink, 0.6); c.font = `${Math.round(h * 0.05)}px Helvetica, Arial, sans-serif`;
      const hx = L + holon * dx, sx = L + spinon * dx;
      if (holon < N) c.fillText("charge", hx - 18, y + h * 0.2);
      if (spinon > 0) c.fillText("spin", sx - 12, y - h * 0.17);
    },
  };

  function start(cv) {
    const scene = scenes[cv.dataset.scene]; if (!scene) return;
    const ctx = cv.getContext("2d"); let W = 0, H = 0, dpr = 1, visible = true;
    const cs = getComputedStyle(cv);
    const col = { accent: (cs.getPropertyValue("--c") || "#92C1E9").trim() || "#92C1E9", ink: (cs.getPropertyValue("--viz-ink") || "#E6EAF0").trim(), bg: (cs.getPropertyValue("--viz-bg") || "#0B1220").trim() };
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
    const t0 = performance.now() - 4500;
    const frame = (now) => { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); scene(ctx, W, H, still ? 4 : (now - t0) / 1000, col); };
    size(); addEventListener("resize", () => { size(); frame(performance.now()); });
    if (still) { frame(performance.now()); return; }
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(cv);
    const loop = (now) => { if (visible) frame(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  document.querySelectorAll("canvas[data-scene]").forEach(start);

  // Featured works: show one at a time
  document.querySelectorAll("[data-featured]").forEach((box) => {
    const items = [...box.querySelectorAll(".fw-item")]; if (items.length < 2 || still) return;
    let i = 0; setInterval(() => { items[i].classList.remove("on"); i = (i + 1) % items.length; items[i].classList.add("on"); }, 6500);
  });
})();
