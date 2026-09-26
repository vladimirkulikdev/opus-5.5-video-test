/* Monochrome Interstellar-style black hole: glow, lensed halo, photon ring, shadow, and a tilted accretion disk. */
(function (SV) {
  const rnd = SV.rng(1337);
  const P = [];
  for (let i = 0; i < 1600; i++) {
    const u = rnd();
    P.push({ r: 1.25 + Math.pow(u, 1.6) * 2.4, a: rnd() * Math.PI * 2, b: 0.25 + rnd() * 0.75, w: 0.6 + rnd() * 1.4 });
  }

  const rs = SV.rng(99);
  const stars = [];
  for (let i = 0; i < 420; i++) stars.push({ x: rs(), y: rs(), s: rs() < 0.92 ? 1 : 2, b: 0.15 + rs() * 0.6, tw: rs() * 6.28 });

  SV.drawStars = (ctx, t, alpha = 1, drift = 6) => {
    for (const s of stars) {
      const x = (((s.x * SV.W + t * drift) % SV.W) + SV.W) % SV.W;
      const y = s.y * SV.H;
      ctx.fillStyle = SV.white(s.b * (0.7 + 0.3 * Math.sin(t * 2 + s.tw)) * alpha);
      ctx.fillRect(x, y, s.s, s.s);
    }
  };

  function disk(ctx, cx, cy, R, t, alpha, tilt, spin, front) {
    for (let k = 0; k < 22; k++) {
      const r = R * (1.3 + k * 0.1);
      ctx.strokeStyle = SV.white(alpha * 0.1 * Math.pow(1 - k / 22, 1.3));
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (front) ctx.ellipse(cx, cy, r, r * tilt, 0, 0, Math.PI);
      else ctx.ellipse(cx, cy, r, r * tilt, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    const sc = Math.max(0.6, R / 150);
    for (const p of P) {
      const ang = p.a + (t * spin * 0.9) / Math.pow(p.r, 1.5);
      const s = Math.sin(ang);
      if (s > 0 !== front) continue;
      const c = Math.cos(ang);
      const x = cx + p.r * R * c;
      const y = cy + p.r * R * s * tilt;
      const doppler = 0.5 - 0.42 * c; // the approaching side is brighter
      const a = alpha * p.b * doppler * (1.25 - ((p.r - 1.25) / 2.4) * 0.9);
      ctx.fillStyle = SV.white(a);
      const len = (1.5 + 6 * Math.abs(s)) * p.w * sc;
      ctx.fillRect(x - len / 2, y, len, p.w * sc);
    }
  }

  SV.drawBlackHole = (ctx, o) => {
    const { cx, cy, R, t = 0, alpha = 1, tilt = 0.14, spin = 1 } = o;
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R, cx, cy, R * 4.2);
    g.addColorStop(0, SV.white(0.2 * alpha));
    g.addColorStop(0.3, SV.white(0.05 * alpha));
    g.addColorStop(1, SV.white(0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 4.2, 0, Math.PI * 2);
    ctx.fill();
    disk(ctx, cx, cy, R, t, alpha, tilt, spin, false);
    // Lensed image of the far side of the disk: a halo that wraps over and under the shadow.
    for (let k = 0; k < 16; k++) {
      const rr = R * (1.05 + k * 0.032);
      ctx.strokeStyle = SV.white(alpha * 0.42 * Math.pow(1 - k / 16, 2));
      ctx.lineWidth = k < 3 ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr * 1.03, rr * 0.97, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = SV.black(alpha);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = SV.white(0.9 * alpha);
    ctx.lineWidth = Math.max(1, R * 0.012);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.012, 0, Math.PI * 2);
    ctx.stroke();
    disk(ctx, cx, cy, R, t, alpha, tilt, spin, true);
    ctx.restore();
  };
})(window.SV);
