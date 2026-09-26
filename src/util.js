/* Shared helpers. Everything hangs off window.SV so index.html works from file:// with no bundler. */
window.SV = window.SV || {};
(function (SV) {
  SV.W = 1920;
  SV.H = 1080;
  SV.FONT = '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace';

  SV.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  SV.lerp = (a, b, t) => a + (b - a) * t;
  SV.prog = (t, start, dur) => SV.clamp((t - start) / dur);
  SV.ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  SV.easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // Deterministic PRNG (mulberry32) so every render of the video is identical.
  SV.rng = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  SV.white = (a = 1) => `rgba(255,255,255,${SV.clamp(a)})`;
  SV.black = (a = 1) => `rgba(0,0,0,${SV.clamp(a)})`;

  SV.text = (ctx, str, x, y, o = {}) => {
    const { size = 28, weight = 400, align = 'left', baseline = 'alphabetic', alpha = 1, spacing = 0 } = o;
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.font = `${weight} ${size}px ${SV.FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillStyle = SV.white(alpha);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(str, x, y);
    ctx.restore();
  };

  SV.roundRect = (ctx, x, y, w, h, r) => {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // ---- polylines with partial drawing (used for the animated diagrams) ----
  SV.polyLen = (pts) => {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  };

  SV.polyAt = (pts, d) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const l = Math.hypot(bx - ax, by - ay);
      if (d <= l) {
        const f = l ? d / l : 0;
        return [ax + (bx - ax) * f, ay + (by - ay) * f, Math.atan2(by - ay, bx - ax)];
      }
      d -= l;
    }
    const n = pts.length;
    return [pts[n - 1][0], pts[n - 1][1], Math.atan2(pts[n - 1][1] - pts[n - 2][1], pts[n - 1][0] - pts[n - 2][0])];
  };

  SV.arrowHead = (ctx, x, y, ang, s, a) => {
    ctx.fillStyle = SV.white(a);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - s * Math.cos(ang - 0.42), y - s * Math.sin(ang - 0.42));
    ctx.lineTo(x - s * Math.cos(ang + 0.42), y - s * Math.sin(ang + 0.42));
    ctx.closePath();
    ctx.fill();
  };

  SV.drawPoly = (ctx, pts, p = 1, a = 1, w = 1.5, arrow = false) => {
    if (p <= 0 || a <= 0) return null;
    const L = SV.polyLen(pts) * SV.clamp(p);
    ctx.strokeStyle = SV.white(a);
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    let d = L;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const l = Math.hypot(bx - ax, by - ay);
      if (d >= l) {
        ctx.lineTo(bx, by);
        d -= l;
      } else {
        const f = l ? d / l : 0;
        ctx.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f);
        break;
      }
    }
    ctx.stroke();
    const tip = SV.polyAt(pts, L);
    if (arrow) SV.arrowHead(ctx, tip[0], tip[1], tip[2], 9 + w * 2, a);
    return tip;
  };

  SV.glowDot = (ctx, x, y, a = 1, r = 18) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, SV.white(0.9 * a));
    g.addColorStop(1, SV.white(0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = SV.white(a);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  };

  SV.pulse = (ctx, pts, p, a = 1) => {
    const [x, y] = SV.polyAt(pts, SV.polyLen(pts) * SV.clamp(p));
    SV.glowDot(ctx, x, y, a);
  };

  // A 55-feature tick drawn as a 5 x 11 grid of cells; brightness = |normalised value|.
  SV.drawToken = (ctx, x, y, vec, a = 1, cell = 7) => {
    const cols = 5;
    const rows = Math.ceil(vec.length / cols);
    const x0 = x - (cols * cell) / 2;
    const y0 = y - (rows * cell) / 2;
    for (let k = 0; k < vec.length; k++) {
      const c = k % cols;
      const r = Math.floor(k / cols);
      ctx.fillStyle = SV.white(a * (0.07 + 0.93 * Math.abs(vec[k])));
      ctx.fillRect(x0 + c * cell, y0 + r * cell, cell - 1, cell - 1);
    }
    ctx.strokeStyle = SV.white(a * 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 3.5, y0 - 3.5, cols * cell + 6, rows * cell + 6);
  };

  // A hidden-state vector drawn as a vertical column of cells.
  SV.drawColumn = (ctx, x, y, vals, a = 1, w = 14, cell = 9) => {
    const y0 = y - (vals.length * cell) / 2;
    for (let k = 0; k < vals.length; k++) {
      ctx.fillStyle = SV.white(a * (0.08 + 0.92 * Math.abs(vals[k])));
      ctx.fillRect(x - w / 2, y0 + k * cell, w, cell - 1);
    }
    ctx.strokeStyle = SV.white(a * 0.4);
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2 - 3, y0 - 3, w + 6, vals.length * cell + 5);
  };

  SV.header = (ctx, num, title, sub, t) => {
    const a = SV.ease(SV.prog(t, 0.05, 0.6));
    SV.text(ctx, num, 80, 108, { size: 20, alpha: 0.45 * a });
    SV.text(ctx, title, 128, 108, { size: 32, weight: 600, alpha: a, spacing: 5 });
    SV.text(ctx, sub, 80, 146, { size: 19, alpha: 0.55 * a });
    ctx.strokeStyle = SV.white(0.25 * a);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 166);
    ctx.lineTo(80 + 520 * a, 166);
    ctx.stroke();
  };

  SV.caption = (ctx, str, t, start = 0.4, y = 1010) => {
    SV.text(ctx, str, SV.W / 2, y, { size: 21, align: 'center', alpha: 0.7 * SV.ease(SV.prog(t, start, 0.6)) });
  };
})(window.SV);
