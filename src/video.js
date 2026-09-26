/*
 * SINGULARITY · ML anticheat explainer video.
 * Every frame is a pure function of time: window.renderFrame(t).
 * Monochrome only: white on black, no colour anywhere.
 *
 * Timeline (seconds)
 *   0.0 -  3.0  intro        black hole + title
 *   3.0 -  5.4  capture      2.0 s simulated player clip (40 ticks) as the model sees it
 *   5.4 -  7.4  tensor       40 x 55 input tensor falls into the model
 *   7.4 - 10.9  lstm         forward LSTM cell, gate by gate
 *  10.9 - 14.4  blstm        backward LSTM cell, then unrolled bidirectional LSTM
 *  14.4 - 18.9  models       Graviton / Event Horizon / Singularity
 *  18.9 - 23.5  outro        open source / closed source / API
 */
(function () {
  'use strict';

  const W = 1920, H = 1080, FPS = 60, DURATION = 23.5;
  const MONO = '"JetBrains Mono","IBM Plex Mono","SFMono-Regular",Menlo,Consolas,"DejaVu Sans Mono",monospace';
  const SANS = '"Helvetica Neue",Helvetica,Arial,"DejaVu Sans",sans-serif';
  const TAU = Math.PI * 2, D2R = Math.PI / 180;

  const canvas = document.getElementById('c');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const SIMM = window.SingularitySim;
  const SIM = SIMM.simulate(4375);
  const ROWS = SIM.rows, FEAT = SIM.features, fmt = SIMM.fmt;
  const NT = 40;

  // ------------------------------------------------------------------ math
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
  const easeIn = t => { t = clamp(t, 0, 1); return t * t * t; };
  const easeInOut = t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function rng(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // --------------------------------------------------------------- drawing
  function txt(str, x, y, o) {
    o = o || {};
    const size = o.size || 24, weight = o.weight || 400, family = o.family || MONO;
    const alpha = o.alpha === undefined ? 1 : o.alpha;
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = weight + ' ' + size + 'px ' + family;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    ctx.fillStyle = '#fff';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (o.spacing || 0) + 'px';
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function poly(pts, w, a, dash) {
    if (a === undefined) a = 1;
    if (a <= 0 || !pts || pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = w || 1.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke(); ctx.restore();
  }
  function line(x1, y1, x2, y2, w, a, dash) { poly([[x1, y1], [x2, y2]], w, a, dash); }
  function arrowHead(p0, p1, a, size) {
    if (a === undefined) a = 1; size = size || 8;
    const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#fff'; ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p1[0] - size * Math.cos(ang - 0.42), p1[1] - size * Math.sin(ang - 0.42));
    ctx.lineTo(p1[0] - size * Math.cos(ang + 0.42), p1[1] - size * Math.sin(ang + 0.42));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function arrowLine(x1, y1, x2, y2, w, a, size) { poly([[x1, y1], [x2, y2]], w, a); arrowHead([x1, y1], [x2, y2], a, size); }
  function circle(x, y, r, w, a, fill) {
    if (a === undefined) a = 1;
    ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    if (fill) { ctx.fillStyle = '#000'; ctx.fill(); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = w || 1.5; ctx.stroke(); ctx.restore();
  }
  function dot(x, y, r, a) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore(); }
  function glowDot(x, y, r, a) {
    ctx.save(); ctx.globalAlpha *= a;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
    g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // Filled-black rounded box with white outline. Path must be built by rr() first.
  function strokeBox(a, lit, lw) {
    ctx.save();
    ctx.fillStyle = '#000'; ctx.fill();
    if (lit) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
      ctx.save(); ctx.globalAlpha *= 0.14; ctx.lineWidth = 10; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha *= a; ctx.lineWidth = lw || (lit ? 2.4 : 1.6); ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }
  function box(x, y, w, h, a, lit) { rr(x - w / 2, y - h / 2, w, h, 8); strokeBox(a, lit); }
  function pointAlong(pts, f) {
    const L = []; let tot = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(l); tot += l; }
    let d = clamp(f, 0, 1) * tot;
    for (let i = 0; i < L.length; i++) {
      if (d <= L[i] || i === L.length - 1) { const u = L[i] ? clamp(d / L[i], 0, 1) : 0; return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]; }
      d -= L[i];
    }
    return pts[pts.length - 1];
  }

  // ------------------------------------------------------------ normalised data
  const NORM = (function () {
    const out = []; for (let r = 0; r < NT; r++) out.push(new Array(FEAT.length).fill(0));
    FEAT.forEach(function (k, c) {
      const vals = [];
      for (let r = 0; r < NT; r++) {
        const v = ROWS[r][k];
        vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' ? v : (v === 'NONE' ? 0 : 0.4 + 0.6 * strHash(v)));
      }
      const mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
      for (let r = 0; r < NT; r++) out[r][c] = mx - mn < 1e-9 ? (mx !== 0 ? 0.5 : 0) : (vals[r] - mn) / (mx - mn);
    });
    return out;
  })();

  function featureStrip(x, y, w, h, row, a) {
    const n = FEAT.length, bw = w / n;
    ctx.save();
    for (let c = 0; c < n; c++) {
      const v = NORM[row][c], bh = 2 + v * (h - 2);
      ctx.fillStyle = 'rgba(255,255,255,' + (a * (0.3 + 0.7 * v)).toFixed(3) + ')';
      ctx.fillRect(x + c * bw, y + h - bh, Math.max(1, bw - 1), bh);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- stars
  const STARS = (function () {
    const r = rng(7), s = [];
    for (let i = 0; i < 1100; i++) s.push({ x: r() * W * 1.4 - W * 0.2, y: r() * H * 1.4 - H * 0.2, b: Math.pow(r(), 3), z: r() * TAU });
    return s;
  })();
  function drawStars(cx, cy, R, t, a) {
    const A0 = ctx.globalAlpha;
    ctx.save(); ctx.fillStyle = '#fff';
    for (const s of STARS) {
      let dx = s.x - cx, dy = s.y - cy;
      if (R > 0) {
        const d = Math.hypot(dx, dy) || 1;
        const nd = d + (R * R * 1.2) / d; // gravitational lensing push
        dx *= nd / d; dy *= nd / d;
      }
      const tw = 0.7 + 0.3 * Math.sin(t * 2 + s.z * 5);
      ctx.globalAlpha = A0 * a * (0.12 + 0.88 * s.b) * tw;
      const sz = s.b > 0.6 ? 2 : 1.2;
      ctx.fillRect(cx + dx, cy + dy, sz, sz);
    }
    ctx.restore();
  }

  // ----------------------------------------------------------- black hole
  // Interstellar-style, monochrome: back disk, lensed arc over the top,
  // black shadow, photon ring, lensed underside, front disk across the shadow.
  function diskPass(cx, cy, R, t, a0, a1, tilt, flat, rings) {
    const step = 0.075;
    for (let i = 0; i < rings; i++) {
      const f = i / (rings - 1);
      const r = R * (1.5 + f * 3.0);
      const om = 2.2 / Math.pow(r / R, 1.5);
      const base = 0.06 + 0.94 * Math.pow(1 - f, 1.8);
      const ph = hash(i + 1) * TAU, k1 = 2 + Math.floor(hash(i + 7) * 4), k2 = 5 + Math.floor(hash(i + 13) * 6);
      ctx.lineWidth = Math.max(1, R * 0.055);
      for (let a = a0; a < a1 - 1e-6; a += step) {
        const ar = a - t * om;
        const streak = 0.35 + 0.65 * Math.abs(Math.sin(ar * k1 + ph) * Math.sin(ar * k2 - ph * 1.7));
        const dop = 0.35 + 0.65 * (0.5 - 0.5 * Math.cos(a)); // approaching side brighter
        const al = base * streak * dop * 0.42;
        if (al < 0.004) continue;
        ctx.strokeStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * flat, tilt, a, Math.min(a1, a + step * 1.15)); ctx.stroke();
      }
    }
  }
  function lensPass(cx, cy, R, t, top, tilt, rings) {
    const n = Math.max(10, Math.floor(rings * 0.5)), step = 0.08;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const rx = R * (1.07 + f * 0.6), ry = rx * (top ? 0.9 : 0.78);
      const base = (top ? 1 : 0.5) * (0.05 + 0.95 * Math.pow(1 - f, 2.2));
      const ph = hash(i + 31) * TAU, om = 1.6 / (1 + f * 2);
      ctx.lineWidth = Math.max(1, R * 0.04);
      const a0 = top ? Math.PI : 0, a1 = top ? TAU : Math.PI;
      for (let a = a0; a < a1 - 1e-6; a += step) {
        const ar = a + t * om * (top ? 1 : -1);
        const streak = 0.4 + 0.6 * Math.abs(Math.sin(ar * 3 + ph));
        const dop = 0.35 + 0.65 * (0.5 - 0.5 * Math.cos(a));
        const al = base * streak * dop * 0.32;
        if (al < 0.004) continue;
        ctx.strokeStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, tilt, a, a + step * 1.15); ctx.stroke();
      }
    }
  }
  function drawBlackHole(cx, cy, R, t, o) {
    o = o || {};
    const rings = o.rings || 40, tilt = o.tilt === undefined ? -0.06 : o.tilt, flat = o.flat || 0.2;
    ctx.save();
    if (o.stars !== false) drawStars(cx, cy, R, t, o.starAlpha === undefined ? 1 : o.starAlpha);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 5);
    g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.35, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - R * 5, cy - R * 5, R * 10, R * 10);
    diskPass(cx, cy, R, t, Math.PI, TAU, tilt, flat, rings);
    lensPass(cx, cy, R, t, true, tilt, rings);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    lensPass(cx, cy, R, t, false, tilt, rings);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = R * 0.12;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.03, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1.2, R * 0.012);
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.02, 0, TAU); ctx.stroke();
    diskPass(cx, cy, R, t, 0, Math.PI, tilt, flat, rings);
    ctx.restore();
  }

  // ------------------------------------------------------------- 3D wireframe
  function makeCamera(eye, target, focal, cx, cy) {
    const f = norm(sub(target, eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    return {
      project: function (p) {
        const d = sub(p, eye), z = dot3(d, f);
        if (z < 0.1) return null;
        return [cx + dot3(d, r) / z * focal, cy - dot3(d, u) / z * focal, z];
      }
    };
  }
  // Minecraft player model in pixels (1 block = 16 px). Origin at the feet.
  const PARTS = [
    { n: 'head', s: [8, 8, 8], p: [0, 24, 0], o: [-4, 0, -4] },
    { n: 'body', s: [8, 12, 4], p: [0, 12, 0], o: [-4, 0, -2] },
    { n: 'armR', s: [4, 12, 4], p: [-6, 22, 0], o: [-2, -10, -2] },
    { n: 'armL', s: [4, 12, 4], p: [6, 22, 0], o: [-2, -10, -2] },
    { n: 'legR', s: [4, 12, 4], p: [-2, 12, 0], o: [-2, -12, -2] },
    { n: 'legL', s: [4, 12, 4], p: [2, 12, 0], o: [-2, -12, -2] }
  ];
  const BOX_EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

  function modelParts(pos, bodyYawDeg, headYawDeg, pitchDeg, pose) {
    const by = -bodyYawDeg * D2R, cb = Math.cos(by), sb = Math.sin(by);
    const out = [];
    for (const P of PARTS) {
      let rx = 0, ry = 0;
      if (P.n === 'head') { ry = -(headYawDeg - bodyYawDeg) * D2R; rx = pitchDeg * D2R; }
      else rx = pose[P.n] || 0;
      const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
      const pts = [];
      for (let c = 0; c < 8; c++) {
        let x = P.o[0] + ((c & 1) ? P.s[0] : 0), y = P.o[1] + ((c & 2) ? P.s[1] : 0), z = P.o[2] + ((c & 4) ? P.s[2] : 0);
        const y1 = y * cx - z * sx, z1 = y * sx + z * cx; y = y1; z = z1;
        const x2 = x * cy + z * sy, z2 = -x * sy + z * cy; x = x2; z = z2;
        x += P.p[0]; y += P.p[1]; z += P.p[2];
        const x3 = x * cb + z * sb, z3 = -x * sb + z * cb;
        pts.push([pos[0] + x3 / 16, pos[1] + y / 16, pos[2] + z3 / 16]);
      }
      out.push({ n: P.n, pts: pts });
    }
    return out;
  }
  function drawModel(cam, parts, alpha, w) {
    if (alpha <= 0) return;
    const segs = [];
    for (const P of parts) {
      const sp = P.pts.map(p => cam.project(p));
      for (const e of BOX_EDGES) if (sp[e[0]] && sp[e[1]]) segs.push(sp[e[0]], sp[e[1]]);
    }
    const A0 = ctx.globalAlpha;
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    const passes = [[w * 6, 0.06], [w * 2.5, 0.16], [w, 1]];
    for (const pa of passes) {
      ctx.globalAlpha = A0 * alpha * pa[1]; ctx.lineWidth = pa[0]; ctx.beginPath();
      for (let i = 0; i < segs.length; i += 2) { ctx.moveTo(segs[i][0], segs[i][1]); ctx.lineTo(segs[i + 1][0], segs[i + 1][1]); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function wireBox(cam, mn, mx, a, w, dash) {
    const c = [];
    for (let i = 0; i < 8; i++) c.push(cam.project([(i & 1) ? mx[0] : mn[0], (i & 2) ? mx[1] : mn[1], (i & 4) ? mx[2] : mn[2]]));
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = '#fff'; ctx.lineWidth = w || 1;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    for (const e of BOX_EDGES) { if (!c[e[0]] || !c[e[1]]) continue; ctx.moveTo(c[e[0]][0], c[e[0]][1]); ctx.lineTo(c[e[1]][0], c[e[1]][1]); }
    ctx.stroke(); ctx.restore();
  }
  function drawGrid(cam, c, a) {
    const N = 12, gx = Math.floor(c[0]), gz = Math.floor(c[2]), y = 64;
    const A0 = ctx.globalAlpha;
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    for (let k = -N; k <= N; k++) {
      for (let m = -N; m < N; m++) {
        for (let axis = 0; axis < 2; axis++) {
          const p1 = axis ? [gx + m, y, gz + k] : [gx + k, y, gz + m];
          const p2 = axis ? [gx + m + 1, y, gz + k] : [gx + k, y, gz + m + 1];
          const d = Math.hypot((p1[0] + p2[0]) / 2 - c[0], (p1[2] + p2[2]) / 2 - c[2]) / N;
          if (d > 1) continue;
          const s1 = cam.project(p1), s2 = cam.project(p2);
          if (!s1 || !s2) continue;
          ctx.globalAlpha = A0 * a * 0.28 * Math.pow(1 - d, 1.6);
          ctx.beginPath(); ctx.moveTo(s1[0], s1[1]); ctx.lineTo(s2[0], s2[1]); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  function label3(cam, p, str, dx, dy, a) {
    const s = cam.project(p); if (!s) return;
    line(s[0], s[1], s[0] + dx, s[1] + dy, 1, a * 0.6);
    txt(str, s[0] + dx + (dx >= 0 ? 6 : -6), s[1] + dy + 5, { size: 14, align: dx >= 0 ? 'left' : 'right', alpha: a });
  }

  // ------------------------------------------------------------ sim helpers
  const DIST = (function () {
    const d = [0];
    for (let i = 1; i < ROWS.length; i++) d.push(d[i - 1] + Math.hypot(ROWS[i].pos_x - ROWS[i - 1].pos_x, ROWS[i].pos_z - ROWS[i - 1].pos_z));
    return d;
  })();
  function stateAt(tf) {
    const n = ROWS.length; tf = clamp(tf, 0, n - 1.0001);
    const i = Math.floor(tf), f = tf - i, a = ROWS[i], b = ROWS[Math.min(n - 1, i + 1)];
    return {
      i: i, f: f,
      x: lerp(a.pos_x, b.pos_x, f), y: lerp(a.pos_y, b.pos_y, f), z: lerp(a.pos_z, b.pos_z, f),
      yaw: lerp(a.yaw, b.yaw, f), pitch: lerp(a.pitch, b.pitch, f),
      vx: lerp(a.vel_x, b.vel_x, f), vy: lerp(a.vel_y, b.vel_y, f), vz: lerp(a.vel_z, b.vel_z, f),
      dist: lerp(DIST[i], DIST[Math.min(n - 1, i + 1)], f)
    };
  }

  // ================================================================ SCENES

  // ---- 1. intro
  function sceneIntro(s, d, t) {
    const R = 140 + s * 14;
    drawBlackHole(W / 2, H * 0.43, R, t + 3, { rings: 46 });
    const p = smooth(seg(s, 0.7, 1.8));
    txt('SINGULARITY', W / 2, H * 0.84, { size: 92, weight: 200, family: SANS, align: 'center', spacing: lerp(70, 30, easeOut(seg(s, 0.7, 2.4))), alpha: p });
    txt('MACHINE-LEARNING ANTICHEAT FOR MINECRAFT', W / 2, H * 0.84 + 54, { size: 20, align: 'center', spacing: 8, alpha: smooth(seg(s, 1.5, 2.2)) * 0.7 });
  }

  // ---- 2. capture: 2.0 s simulated clip, what the model sees
  function drawPanel(idx) {
    const x0 = 1170, y0 = 70, w = 720, h = 940;
    rr(x0, y0, w, h, 6);
    ctx.save(); ctx.globalAlpha *= 0.3; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    txt('PACKET STREAM  ·  55 FEATURES', x0 + 24, y0 + 42, { size: 15, spacing: 4, alpha: 0.6 });
    txt('TICK ' + ROWS[idx].tick, x0 + w - 24, y0 + 42, { size: 22, align: 'right' });
    line(x0 + 16, y0 + 62, x0 + w - 16, y0 + 62, 1, 0.25);
    const r = ROWS[idx], pr = idx > 0 ? ROWS[idx - 1] : null;
    FEAT.forEach(function (k, j) {
      const col = j < 28 ? 0 : 1, row = j < 28 ? j : j - 28;
      const cx = x0 + 24 + col * 350, cy = y0 + 100 + row * 30;
      const v = fmt(r[k]);
      const changed = pr && fmt(pr[k]) !== v;
      if (changed) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(cx - 6, cy - 19, 338, 26); ctx.restore(); }
      txt(k, cx, cy, { size: 14, alpha: changed ? 0.85 : 0.42 });
      txt(v, cx + 326, cy, { size: 14, align: 'right', alpha: changed ? 1 : 0.7, weight: changed ? 700 : 400 });
    });
  }
  function drawTimeline(tf) {
    const x0 = 80, x1 = 1110, y = 985, n = NT;
    line(x0, y, x1, y, 1, 0.3);
    for (let k = 0; k < n; k++) {
      const x = x0 + (x1 - x0) * k / (n - 1);
      line(x, y - (k % 5 === 0 ? 12 : 6), x, y, 1, k <= tf ? 0.9 : 0.3);
    }
    glowDot(x0 + (x1 - x0) * clamp(tf / (n - 1), 0, 1), y, 4, 1);
    SIM.events.forEach(function (e, j) {
      const x = x0 + (x1 - x0) * e.i / (n - 1);
      txt(e.label, x, y - (j % 2 ? 40 : 22), { size: 12, align: 'center', alpha: tf >= e.i ? 0.95 : 0.35 });
    });
    txt('tick ' + ROWS[Math.min(NT - 1, Math.floor(tf))].tick, x0, y + 28, { size: 13, alpha: 0.6 });
    txt('t = ' + (Math.min(tf, NT) / 20).toFixed(2) + ' s', x1, y + 28, { size: 13, align: 'right', alpha: 0.6 });
  }
  function sceneCapture(s, d, t) {
    const clipP = seg(s, 0.2, 2.2), tf = clipP * NT;
    const st = stateAt(tf), idx = Math.min(NT - 1, st.i);
    const body = stateAt(Math.max(0, tf - 2.5));
    const tgt = [st.x, st.y + 0.95, st.z];
    const ang = lerp(-0.95, 0.25, easeInOut(clipP)), dist = 6.4;
    const eye = [tgt[0] + Math.cos(ang) * dist, tgt[1] + 1.5, tgt[2] + Math.sin(ang) * dist];
    const cam = makeCamera(eye, tgt, 980, 600, 600);
    const A = SIM.attackIndex;

    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1150, H); ctx.clip();
    drawStars(0, 0, 0, t, 0.25);
    drawGrid(cam, [st.x, 64, st.z], 1);

    // ground trail + 20 Hz sample ghosts
    const trail = [];
    for (let j = 0; j <= idx; j++) { const p = cam.project([ROWS[j].pos_x, 64.01, ROWS[j].pos_z]); if (p) trail.push([p[0], p[1]]); }
    const pc = cam.project([st.x, 64.01, st.z]); if (pc) trail.push([pc[0], pc[1]]);
    poly(trail, 1.5, 0.5, [4, 6]);
    for (let j = 0; j < trail.length - 1; j++) dot(trail[j][0], trail[j][1], 2, 0.6);
    for (let k = 1; k <= 5; k++) {
      const j = idx - k * 2; if (j < 0) break;
      const r = ROWS[j];
      wireBox(cam, [r.pos_x - 0.3, r.pos_y, r.pos_z - 0.3], [r.pos_x + 0.3, r.pos_y + 1.8, r.pos_z + 0.3], 0.22 * (1 - k / 6), 1, [3, 5]);
    }

    // zombie target
    const zi = Math.min(NT, Math.floor(tf)), zj = Math.min(NT, zi + 1);
    const zp = lerp3(SIM.zombie[zi], SIM.zombie[zj], tf - Math.floor(tf));
    const zYaw = Math.atan2(-(st.x - zp[0]), (st.z - zp[2])) / D2R;
    const hurt = tf >= A && tf < A + 8;
    const zA = (hurt ? 1 : 0.5) * smooth(seg(tf, 1, 6));
    drawModel(cam, modelParts(zp, zYaw, zYaw, 0, { armR: -Math.PI / 2, armL: -Math.PI / 2, legR: 0, legL: 0 }), zA, 1.6);
    label3(cam, [zp[0], zp[1] + 2.15, zp[2]], 'ZOMBIE', 24, -28, 0.6 * smooth(seg(tf, 1, 6)));

    // player: fully transparent, white outlines only
    const sp = Math.hypot(st.vx, st.vz), amp = clamp(sp / 0.28, 0, 1) * 0.9, ph = st.dist * 3.3, air = st.y > 64.001;
    const pose = { legR: Math.sin(ph) * amp, legL: -Math.sin(ph) * amp, armR: -Math.sin(ph) * amp * 0.8, armL: Math.sin(ph) * amp * 0.8 };
    if (air) { pose.legR = pose.legR * 0.4 - 0.3; pose.legL = pose.legL * 0.4 + 0.25; }
    const sw = seg(tf, A - 0.5, A + 4.5);
    if (sw > 0 && sw < 1) { const k = Math.sin(Math.PI * sw); pose.armR = -1.9 * k + pose.armR * (1 - k); }
    drawModel(cam, modelParts([st.x, st.y, st.z], body.yaw, st.yaw, st.pitch, pose), 1, 2);
    wireBox(cam, [st.x - 0.3, st.y, st.z - 0.3], [st.x + 0.3, st.y + 1.8, st.z + 0.3], 0.35, 1, [5, 5]);
    label3(cam, [st.x + 0.3, st.y + 1.8, st.z + 0.3], 'hitbox 0.6 × 1.8', -30, -40, 0.5);

    // look ray (yaw / pitch)
    const yr = st.yaw * D2R, pr = st.pitch * D2R;
    const e3 = [st.x, st.y + 1.62, st.z];
    const dir = [-Math.sin(yr) * Math.cos(pr), -Math.sin(pr), Math.cos(yr) * Math.cos(pr)];
    const s1 = cam.project(e3), s2 = cam.project(add(e3, scl(dir, 3.4)));
    if (s1 && s2) {
      poly([[s1[0], s1[1]], [s2[0], s2[1]]], 1.2, 0.8, [2, 5]);
      circle(s2[0], s2[1], 6, 1.2, 0.9);
      txt('yaw ' + fmt(ROWS[idx].yaw) + '   pitch ' + fmt(ROWS[idx].pitch), s2[0] + 14, s2[1] - 10, { size: 13, alpha: 0.8 });
    }
    // velocity vector
    const a1 = cam.project([st.x, st.y + 0.02, st.z]);
    const a2 = cam.project([st.x + st.vx * 7, st.y + 0.02 + (air ? st.vy * 7 : 0), st.z + st.vz * 7]);
    if (a1 && a2 && Math.hypot(a2[0] - a1[0], a2[1] - a1[1]) > 6) {
      arrowLine(a1[0], a1[1], a2[0], a2[1], 2, 0.95, 10);
      txt('v', a2[0] + 8, a2[1] + 4, { size: 14, alpha: 0.85 });
    }
    // critical hit
    if (tf >= A && tf < A + 10) {
      const q = (tf - A) / 10;
      const zc = cam.project([zp[0], zp[1] + 1.2, zp[2]]), es = cam.project(e3);
      if (zc && es) {
        poly([[es[0], es[1]], [zc[0], zc[1]]], 2, 1 - q);
        for (let k = 0; k < 12; k++) {
          const an = k / 12 * TAU + 0.3, r0 = 14 + q * 30, r1 = r0 + 18 + q * 50;
          line(zc[0] + Math.cos(an) * r0, zc[1] + Math.sin(an) * r0, zc[0] + Math.cos(an) * r1, zc[1] + Math.sin(an) * r1, 1.5, 1 - q);
        }
        txt('CRITICAL HIT', zc[0] + 40, zc[1] - 60, { size: 22, weight: 700, alpha: 1 - q * 0.6 });
        txt('ZOMBIE · ' + fmt(ROWS[A].damage_dealt) + ' dmg · ' + fmt(ROWS[A].hit_entity_distance) + ' m', zc[0] + 40, zc[1] - 36, { size: 14, alpha: 0.8 * (1 - q * 0.6) });
      }
    }
    ctx.restore();

    txt('WHAT THE MODEL SEES', 80, 110, { size: 30, weight: 300, family: SANS, spacing: 10 });
    txt('simulated player  ·  2.0 s  ·  40 ticks @ 20 TPS  ·  55 features per tick', 80, 148, { size: 15, alpha: 0.6 });
    drawPanel(idx);
    drawTimeline(tf);
  }

  // ---- 3. tensor
  function sceneTensor(s, d, t) {
    const x0 = 150, y0 = 270, cs = 13, pitch = 16, nR = NT, nC = FEAT.length;
    const hx = 1500, hy = 560, HR = 70;
    drawBlackHole(hx, hy, HR * smooth(seg(s, 0, 0.6)) + 1, t, { rings: 30, starAlpha: 0.5 });
    const labA = 1 - smooth(seg(s, 1.05, 1.3));
    txt('INPUT TENSOR', x0, 130, { size: 30, weight: 300, family: SANS, spacing: 10, alpha: labA });
    txt(nR + ' ticks × ' + nC + ' features  ·  each column normalised', x0, 168, { size: 16, alpha: 0.6 * labA });
    txt('shape  [batch, ' + nR + ', ' + nC + ']', x0, y0 + nR * pitch + 50, { size: 16, alpha: 0.7 * labA });

    // column labels
    for (let c = 0; c < nC; c++) {
      ctx.save(); ctx.translate(x0 + c * pitch + cs / 2 + 4, y0 - 10); ctx.rotate(-Math.PI / 3);
      txt(FEAT[c], 0, 0, { size: 10, alpha: 0.45 * labA * smooth(seg(s, 0.05, 0.4)) });
      ctx.restore();
    }
    for (let r = 0; r < nR; r += 5) txt(String(ROWS[r].tick), x0 - 12, y0 + r * pitch + 11, { size: 11, align: 'right', alpha: 0.45 * labA });

    // empty grid
    ctx.save(); ctx.globalAlpha *= 0.1 * (1 - smooth(seg(s, 1.1, 1.3))); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath();
    for (let r = 0; r < nR; r++) for (let c = 0; c < nC; c++) ctx.rect(x0 + c * pitch + 0.5, y0 + r * pitch + 0.5, cs, cs);
    ctx.stroke(); ctx.restore();

    // cells fill row by row, then spiral into the hole
    ctx.save();
    for (let r = 0; r < nR; r++) {
      const app = smooth(seg(s, 0.1 + r * 0.02, 0.25 + r * 0.02));
      if (app <= 0) continue;
      for (let c = 0; c < nC; c++) {
        const v = NORM[r][c];
        const px = x0 + c * pitch + cs / 2, py = y0 + r * pitch + cs / 2;
        const dxh = px - hx, dyh = py - hy, rho = Math.hypot(dxh, dyh), phi = Math.atan2(dyh, dxh);
        const dn = clamp((rho - 400) / 1100, 0, 1);
        const q = easeIn(seg(s, 1.15 + dn * 0.35, 1.55 + dn * 0.35));
        if (q > 0.98) continue;
        const rr2 = rho * (1 - q), ph2 = phi + q * 2.2;
        const X = hx + Math.cos(ph2) * rr2, Y = hy + Math.sin(ph2) * rr2;
        const size = cs * (1 - q * 0.85);
        const horizon = q > 0 ? clamp((rr2 - HR) / 40, 0, 1) : 1;
        const al = app * (0.07 + 0.93 * v) * (1 - q * 0.5) * horizon;
        if (al <= 0.003) continue;
        ctx.fillStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')';
        ctx.fillRect(X - size / 2, Y - size / 2, size, size);
      }
    }
    ctx.restore();
  }

  // ---- 4/5. LSTM cell geometry (local units, forward orientation)
  const LG = {
    lines: [
      { p: [[-180, -80], [-132, -80]], st: 0, ar: 1 },
      { p: [[-108, -80], [-42, -80]], st: 3, ar: 1 },
      { p: [[-18, -80], [180, -80]], st: 3, ar: 1 },
      { p: [[-180, 80], [-150, 80]], st: 0 },
      { p: [[-150, 175], [-150, 80]], st: 0 },
      { p: [[-150, 80], [-120, 80]], st: 0 },
      { p: [[-120, 80], [-60, 80]], st: 1 },
      { p: [[-60, 80], [0, 80]], st: 2 },
      { p: [[0, 80], [60, 80]], st: 4 },
      { p: [[-120, 80], [-120, 35]], st: 0, ar: 1 },
      { p: [[-60, 80], [-60, 35]], st: 1, ar: 1 },
      { p: [[0, 80], [0, 35]], st: 2, ar: 1 },
      { p: [[60, 80], [60, 35]], st: 4, ar: 1 },
      { p: [[-120, 5], [-120, -68]], st: 0, ar: 1 },
      { p: [[-60, 5], [-60, -30], [-42, -30]], st: 1, ar: 1 },
      { p: [[0, 5], [0, -30], [-18, -30]], st: 2, ar: 1 },
      { p: [[-30, -42], [-30, -68]], st: 3, ar: 1 },
      { p: [[110, -80], [110, -44]], st: 4, ar: 1 },
      { p: [[110, -16], [110, 8]], st: 4, ar: 1 },
      { p: [[78, 20], [98, 20]], st: 4, ar: 1 },
      { p: [[110, 32], [110, 80], [180, 80]], st: 5, ar: 1 },
      { p: [[150, 80], [150, -72]], st: 5 },
      { p: [[150, -88], [150, -160]], st: 5, ar: 1 }
    ],
    gates: [
      { x: -120, w: 36, l: 'σ', st: 0, n: 'f' },
      { x: -60, w: 36, l: 'σ', st: 1, n: 'i' },
      { x: 0, w: 50, l: 'tanh', st: 2, n: '~C' },
      { x: 60, w: 36, l: 'σ', st: 4, n: 'o' }
    ],
    ops: [
      { x: -120, y: -80, l: '×', st: 0 },
      { x: -30, y: -30, l: '×', st: 2 },
      { x: -30, y: -80, l: '+', st: 3 },
      { x: 110, y: 20, l: '×', st: 4 }
    ]
  };
  const STAGES = [
    ['FORGET GATE', 'what to drop from memory'],
    ['INPUT GATE', 'how much new information to write'],
    ['CANDIDATE', 'new memory content from this tick'],
    ['CELL UPDATE', 'memory carried to the next tick'],
    ['OUTPUT GATE', 'what part of memory to expose'],
    ['HIDDEN STATE', 'output for this tick']
  ];
  function eqs(p) {
    return [
      'f(t) = σ(W_f · [h(' + p + '), x(t)] + b_f)',
      'i(t) = σ(W_i · [h(' + p + '), x(t)] + b_i)',
      '~C(t) = tanh(W_c · [h(' + p + '), x(t)] + b_c)',
      'C(t) = f(t) ⊙ C(' + p + ') + i(t) ⊙ ~C(t)',
      'o(t) = σ(W_o · [h(' + p + '), x(t)] + b_o)',
      'h(t) = o(t) ⊙ tanh(C(t))'
    ];
  }

  function drawLSTMScene(s, dir, o) {
    const cx = 960, cy = 520, S = 1.55;
    const X = lx => cx + dir * lx * S, Y = ly => cy + ly * S, P = pt => [X(pt[0]), Y(pt[1])];
    const cur = (s - o.stageStart) / o.stageDur, ci = Math.floor(cur), cf = cur - ci;
    const al = st => (cur < 0 ? 0.25 : ci >= 6 ? 0.85 : st < ci ? 0.6 : st === ci ? 1 : 0.2);
    const prev = dir > 0 ? 't-1' : 't+1', next = dir > 0 ? 't+1' : 't-1';

    txt(o.title, W / 2, 115, { size: 34, weight: 300, family: SANS, align: 'center', spacing: 12 });
    txt(o.sub, W / 2, 155, { size: 17, align: 'center', alpha: 0.6 });
    if (ci >= 0 && ci < 6) txt(STAGES[ci][0] + '  ·  ' + STAGES[ci][1], W / 2, 205, { size: 19, align: 'center', spacing: 4, alpha: smooth(cf * 5) });

    // chain lines to neighbour cells
    [-80, 80].forEach(function (yy) {
      poly([P([-560, yy]), P([-180, yy])], 2, 0.55);
      poly([P([180, yy]), P([560, yy])], 2, 0.55);
    });
    // neighbour cells
    [-1, 1].forEach(function (side) {
      const bx = side * 430, lab = side < 0 ? prev : next;
      poly([P([bx, 175]), P([bx, 130])], 1.6, 0.5); arrowHead(P([bx, 175]), P([bx, 130]), 0.5, 8);
      poly([P([bx, -130]), P([bx, -165])], 1.6, 0.5); arrowHead(P([bx, -130]), P([bx, -165]), 0.5, 8);
      rr(Math.min(X(bx - 110), X(bx + 110)), Y(-130), 220 * S, 260 * S, 14); strokeBox(0.45, false, 1.6);
      txt('LSTM', X(bx), Y(0) - 6, { size: 22, align: 'center', alpha: 0.55, spacing: 4 });
      txt('cell  ' + lab, X(bx), Y(0) + 24, { size: 15, align: 'center', alpha: 0.45 });
      txt('x(' + lab + ')', X(bx), Y(175) + 24, { size: 15, align: 'center', alpha: 0.5 });
      txt('h(' + lab + ')', X(bx), Y(-165) - 10, { size: 15, align: 'center', alpha: 0.5 });
    });
    // memory + hidden pulses travelling along the chain
    [[-80, 0], [80, 0.5]].forEach(function (q) {
      const f = (s * 0.55 + q[1]) % 1, lx = -560 + f * 1120;
      if (Math.abs(lx) > 185) glowDot(X(lx), Y(q[0]), 3.5, 0.8);
    });

    // main cell
    rr(Math.min(X(-180), X(180)), Y(-120), 360 * S, 240 * S, 18); strokeBox(0.9, false, 2);
    for (const L of LG.lines) {
      const a = al(L.st), pts = L.p.map(P), act = ci === L.st;
      if (act) poly(pts, 10, 0.12);
      poly(pts, act ? 2.8 : 1.8, a);
      if (L.ar) arrowHead(pts[pts.length - 2], pts[pts.length - 1], a, act ? 11 : 8);
    }
    for (const g of LG.gates) {
      const a = al(g.st), act = ci === g.st, w = g.w * S, h = 30 * S, gx = X(g.x), gy = Y(20);
      rr(gx - w / 2, gy - h / 2, w, h, 5); strokeBox(a, act, act ? 2.6 : 1.8);
      txt(g.l, gx, gy + 7, { size: g.l === 'tanh' ? 16 : 22, align: 'center', alpha: a });
      txt(g.n, gx - w / 2 - 6, gy + 5, { size: 14, align: 'right', alpha: a * 0.9 });
    }
    for (const op of LG.ops) {
      const a = al(op.st), act = ci === op.st;
      if (act) circle(X(op.x), Y(op.y), 12 * S + 5, 6, 0.12);
      circle(X(op.x), Y(op.y), 12 * S, act ? 2.6 : 1.8, a, true);
      txt(op.l, X(op.x), Y(op.y) + 7, { size: 20, align: 'center', alpha: a });
    }
    {
      const a = al(4), act = ci === 4;
      ctx.save(); ctx.beginPath(); ctx.ellipse(X(110), Y(-30), 24 * S, 14 * S, 0, 0, TAU);
      ctx.fillStyle = '#000'; ctx.fill(); ctx.globalAlpha *= a; ctx.strokeStyle = '#fff'; ctx.lineWidth = act ? 2.6 : 1.8; ctx.stroke(); ctx.restore();
      txt('tanh', X(110), Y(-30) + 5, { size: 14, align: 'center', alpha: a });
    }
    if (ci >= 0 && ci < 6) for (const L of LG.lines) if (L.st === ci) { const pp = pointAlong(L.p.map(P), cf); glowDot(pp[0], pp[1], 4, 1); }

    // labels + input vector
    txt('C(' + prev + ')', X(-215), Y(-80) - 14, { size: 17, align: 'center', alpha: 0.85 });
    txt('h(' + prev + ')', X(-215), Y(80) - 14, { size: 17, align: 'center', alpha: 0.85 });
    txt('C(t)', X(215), Y(-80) - 14, { size: 17, align: 'center', alpha: 0.85 });
    txt('h(t)', X(215), Y(80) - 14, { size: 17, align: 'center', alpha: 0.85 });
    txt('h(t)', X(150) + (dir > 0 ? 34 : -34), Y(-160) + 6, { size: 17, align: 'center', alpha: 0.85 });
    txt('x(t)', X(-150), Y(175) + 26, { size: 17, align: 'center' });
    featureStrip(X(-150) - 110, Y(175) + 40, 220, 30, o.row, 1);
    txt('tick ' + ROWS[o.row].tick + '  ·  55 features', X(-150), Y(175) + 92, { size: 13, align: 'center', alpha: 0.55 });

    eqs(prev).forEach(function (e, k) {
      const col = k < 3 ? 0 : 1, row = k % 3;
      const a = cur < 0 ? 0.25 : ci >= 6 ? 0.75 : k < ci ? 0.5 : k === ci ? 1 : 0.2;
      txt(e, col ? 1000 : 200, 930 + row * 36, { size: 20, alpha: a, weight: k === ci ? 700 : 400 });
    });
  }

  function drawUnrolled(sb) {
    const n = 8, x0 = 330, dx = 180, yF = 450, yB = 610, yX = 790, yH = 290;
    const xs = []; for (let k = 0; k < n; k++) xs.push(x0 + k * dx);
    txt('BIDIRECTIONAL LSTM', W / 2, 115, { size: 34, weight: 300, family: SANS, align: 'center', spacing: 12 });
    txt('a forward pass and a backward pass over the same ticks, outputs concatenated', W / 2, 155, { size: 17, align: 'center', alpha: 0.6 });
    const pf = seg(sb, 0.05, 0.9) * n, pb = pf;
    const att = smooth(seg(sb, 0.95, 1.35));
    const WT = [0.04, 0.05, 0.08, 0.1, 0.33, 0.22, 0.12, 0.06];

    xs.forEach(function (x) {
      poly([[x, yX - 34], [x, yF + 30]], 1.5, 0.35);
      poly([[x - 18, yF - 30], [x - 18, yH + 26]], 1.5, 0.35);
      poly([[x + 18, yB - 30], [x + 18, yH + 26]], 1.5, 0.35);
    });
    for (let k = 0; k < n - 1; k++) {
      arrowLine(xs[k] + 56, yF, xs[k + 1] - 56, yF, 2, pf > k + 1 ? 0.95 : 0.3, 9);
      arrowLine(xs[k + 1] - 56, yB, xs[k] + 56, yB, 2, pb > n - 1 - k ? 0.95 : 0.3, 9);
    }
    if (att > 0) {
      xs.forEach(function (x, k) { poly([[x, yH - 26], [W / 2, 216]], 1 + WT[k] * 10, att * (0.3 + WT[k] * 1.4)); });
      circle(W / 2, 200, 16, 2, att, true);
      txt('c', W / 2, 206, { size: 16, align: 'center', alpha: att });
      txt('attention  →  context', W / 2 + 30, 206, { size: 14, alpha: att * 0.8 });
    }
    xs.forEach(function (x, k) {
      const litF = pf >= k + 0.5, litB = pb >= n - k - 0.5;
      box(x, yF, 110, 60, litF ? 1 : 0.45, litF);
      txt('LSTM →', x, yF + 6, { size: 15, align: 'center', alpha: litF ? 1 : 0.45 });
      box(x, yB, 110, 60, litB ? 1 : 0.45, litB);
      txt('← LSTM', x, yB + 6, { size: 15, align: 'center', alpha: litB ? 1 : 0.45 });
      featureStrip(x - 40, yX - 30, 80, 26, k * 5, 0.8);
      txt('tick ' + ROWS[k * 5].tick, x, yX + 16, { size: 12, align: 'center', alpha: 0.55 });
      const both = litF && litB;
      ctx.save(); ctx.globalAlpha *= both ? 1 : 0.25; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 22, yH - 26, 18, 52); ctx.strokeRect(x + 4, yH - 26, 18, 52);
      if (both) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 22, yH - 26, 18, 52); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(x + 4, yH - 26, 18, 52); }
      ctx.restore();
    });
    if (pf > 0 && pf < n) glowDot(x0 + (pf - 0.5) * dx, yF, 5, 1);
    if (pb > 0 && pb < n) glowDot(x0 + (n - 0.5 - pb) * dx, yB, 5, 1);
    txt('h(t) = [ →h(t) ; ←h(t) ]   ·   every tick sees both past and future context', W / 2, 900, { size: 20, align: 'center', alpha: 0.85 });
  }

  function sceneLSTM(s) {
    drawLSTMScene(s, 1, { title: 'LSTM  ·  LONG SHORT-TERM MEMORY', sub: 'one cell, reading the tick sequence forward   t-1  →  t  →  t+1', stageStart: 0.45, stageDur: 0.42, row: 14 });
  }
  function sceneBLSTM(s) {
    const aA = 1 - smooth(seg(s, 1.55, 1.85)), aB = smooth(seg(s, 1.8, 2.1));
    if (aA > 0) {
      ctx.save(); ctx.globalAlpha *= aA;
      drawLSTMScene(s, -1, { title: 'BACKWARD LSTM', sub: 'the same cell, running over the sequence in reverse   t-1  ←  t  ←  t+1', stageStart: 0.3, stageDur: 0.2, row: 26 });
      ctx.restore();
    }
    if (aB > 0) { ctx.save(); ctx.globalAlpha *= aB; drawUnrolled(s - 1.8); ctx.restore(); }
  }

  // ---- 6. models
  function glyphRows(x, y, n, sp, g) {
    const x0 = x - (n - 1) * sp / 2, xs = [];
    for (let k = 0; k < n; k++) {
      const px = x0 + k * sp; xs.push(px);
      circle(px, y, 7, 1.5, 0.9); circle(px, y + 34, 7, 1.5, 0.9);
      if (k < n - 1) { arrowLine(px + 10, y, px + sp - 10, y, 1.2, 0.6, 6); arrowLine(px + sp - 10, y + 34, px + 10, y + 34, 1.2, 0.6, 6); }
    }
    const kf = ((Math.max(0, g) * 1.2) % 1) * (n - 1);
    glowDot(x0 + kf * sp, y, 3, 0.9); glowDot(x0 + (n - 1 - kf) * sp, y + 34, 3, 0.9);
    return xs;
  }
  function glyphBahdanau(x, y, g) {
    const xs = glyphRows(x, y + 20, 6, 46, g), cy = y - 55, w = [0.05, 0.1, 0.38, 0.27, 0.12, 0.08];
    xs.forEach(function (px, k) { poly([[px, y + 10], [x, cy + 14]], 0.6 + w[k] * 9, 0.25 + w[k] * 1.6); });
    circle(x, cy, 13, 1.8, 1, true); txt('c', x, cy + 5, { size: 15, align: 'center' });
    txt('BLSTM  →  additive attention', x, y + 100, { size: 14, align: 'center', alpha: 0.6 });
  }
  function glyphMHA(x, y, g) {
    const xs = glyphRows(x, y + 20, 6, 46, g), hy = y - 40;
    [-66, -22, 22, 66].forEach(function (d, j) {
      const h = x + d;
      xs.forEach(function (px, k) { const w = 0.3 + 0.7 * hash(j * 17 + k * 3); poly([[px, y + 10], [h, hy + 8]], 0.5 + w * 1.2, 0.12 + w * 0.3); });
      poly([[h, hy - 8], [x, y - 78]], 1.2, 0.7);
      circle(h, hy, 7, 1.5, 1, true);
    });
    circle(x, y - 88, 11, 1.8, 1, true); txt('Σ', x, y - 83, { size: 13, align: 'center' });
    txt('BLSTM  →  multi-head attention', x, y + 100, { size: 14, align: 'center', alpha: 0.6 });
  }
  function glyphTransformer(x, y, g) {
    for (let b = 0; b < 3; b++) {
      const by = y - 78 + b * 38;
      rr(x - 120, by, 240, 28, 4); strokeBox(0.85, false, 1.5);
      txt('MULTI-HEAD ATTN  →  FFN', x, by + 19, { size: 12, align: 'center', alpha: 0.85 });
    }
    txt('× N', x + 138, y - 30, { size: 16, alpha: 0.8 });
    arrowLine(x, y + 46, x, y + 30, 1.4, 0.7, 6);
    const tx0 = x - 105, ty = y + 62, hk = Math.floor(Math.max(0, g) * 6) % 8;
    for (let i = 0; i < 8; i++) {
      for (let j = i + 1; j < 8; j++) {
        const lit = i === hk || j === hk;
        if (!lit && hash(i * 8 + j) < 0.6) continue;
        const xa = tx0 + i * 30, xb = tx0 + j * 30;
        ctx.save(); ctx.globalAlpha *= lit ? 0.8 : 0.25; ctx.strokeStyle = '#fff'; ctx.lineWidth = lit ? 1.4 : 1;
        ctx.beginPath(); ctx.moveTo(xa, ty - 8); ctx.quadraticCurveTo((xa + xb) / 2, ty - 8 - (j - i) * 7, xb, ty - 8); ctx.stroke(); ctx.restore();
      }
    }
    for (let i = 0; i < 8; i++) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.strokeRect(tx0 + i * 30 - 6, ty - 6, 12, 12); ctx.restore(); }
    txt('self-attention over every tick', x, y + 100, { size: 14, align: 'center', alpha: 0.6 });
  }
  const MODELS = [
    { name: 'GRAVITON', params: 2.77e6, dec: 2, arch: 'BLSTM + BAHDANAU ATTENTION', R: 26, x: 380, t0: 0.35, g: glyphBahdanau },
    { name: 'EVENT HORIZON', params: 10e6, dec: 0, arch: 'BLSTM + MULTI-HEAD ATTENTION', R: 40, x: 960, t0: 1.25, g: glyphMHA },
    { name: 'SINGULARITY', params: 100e6, dec: 0, arch: 'TRANSFORMER + MULTI-HEAD ATTENTION', R: 60, x: 1540, t0: 2.15, g: glyphTransformer }
  ];
  function sceneModels(s, d, t) {
    drawStars(0, 0, 0, t, 0.5);
    txt('THREE MODELS', W / 2, 120, { size: 34, weight: 300, family: SANS, align: 'center', spacing: 14 });
    txt('the same 55-feature tick input  ·  increasing capacity', W / 2, 162, { size: 17, align: 'center', alpha: 0.6 });
    line(670, 250, 670, 960, 1, 0.15); line(1250, 250, 1250, 960, 1, 0.15);
    for (const m of MODELS) {
      const p = smooth(seg(s, m.t0, m.t0 + 0.6));
      if (p <= 0) continue;
      const R = m.R * easeOut(seg(s, m.t0, m.t0 + 0.8));
      if (R > 1) drawBlackHole(m.x, 380, R, t + m.R, { rings: 26, stars: false });
      txt(m.name, m.x, 550, { size: 40, weight: 300, family: SANS, align: 'center', spacing: 10, alpha: p });
      const v = m.params * easeOut(seg(s, m.t0, m.t0 + 1.0));
      txt((v / 1e6).toFixed(m.dec) + 'M PARAMETERS', m.x, 598, { size: 22, align: 'center', alpha: p });
      txt(m.arch, m.x, 636, { size: 15, align: 'center', spacing: 3, alpha: p * 0.7 });
      ctx.save(); ctx.globalAlpha *= smooth(seg(s, m.t0 + 0.3, m.t0 + 0.9)); m.g(m.x, 800, s - m.t0); ctx.restore();
    }
  }

  // ---- 7. outro
  function sceneOutro(s, d, t) {
    const R = 110 + s * 18;
    drawBlackHole(W / 2, 420, R, t, { rings: 44 });
    const L = [
      ['TRAINING CODE  ·  DATA COLLECTION PLUGINS', 0.3, 24, 1],
      ['OPEN SOURCE  ·  TRAIN YOUR OWN MODEL', 0.6, 20, 0.65],
      ['PRODUCTION MODELS  ·  CLOSED SOURCE', 1.1, 24, 1],
      ['INFERENCE API  ·  COMING SOON', 1.6, 24, 1]
    ];
    const fadeText = 1 - smooth(seg(s, 2.5, 2.8));
    L.forEach(function (l, k) { txt(l[0], W / 2, 760 + k * 52, { size: l[2], align: 'center', spacing: 6, alpha: smooth(seg(s, l[1], l[1] + 0.35)) * fadeText * l[3] }); });
    const pt = smooth(seg(s, 2.8, 3.2));
    txt('SINGULARITY', W / 2, 850, { size: 96, weight: 200, family: SANS, align: 'center', spacing: lerp(50, 30, pt), alpha: pt });
    txt('GRAVITON  ·  EVENT HORIZON  ·  SINGULARITY', W / 2, 910, { size: 16, align: 'center', spacing: 6, alpha: pt * 0.6 });
  }

  // ------------------------------------------------------------- composition
  const SCENES = [
    { a: 0.0, b: 3.0, fin: 0.6, fout: 0.3, draw: sceneIntro },
    { a: 3.0, b: 5.4, fin: 0.2, fout: 0.2, draw: sceneCapture },
    { a: 5.4, b: 7.4, draw: sceneTensor },
    { a: 7.4, b: 10.9, draw: sceneLSTM },
    { a: 10.9, b: 14.4, draw: sceneBLSTM },
    { a: 14.4, b: 18.9, draw: sceneModels },
    { a: 18.9, b: 23.5, fout: 0.7, draw: sceneOutro }
  ];
  function env(t, sc) {
    const fin = sc.fin === undefined ? 0.3 : sc.fin, fout = sc.fout === undefined ? 0.3 : sc.fout;
    if (t < sc.a || t > sc.b) return 0;
    return Math.min(fin > 0 ? smooth((t - sc.a) / fin) : 1, fout > 0 ? smooth((sc.b - t) / fout) : 1);
  }

  const GRAIN = (function () {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), im = g.createImageData(256, 256), r = rng(99);
    for (let i = 0; i < im.data.length; i += 4) { const v = (r() * 255) | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); return c;
  })();
  function post(t) {
    const f = Math.round(t * FPS);
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.05;
    const ox = Math.floor(hash(f * 1.37) * 256), oy = Math.floor(hash(f * 2.11 + 5) * 256);
    for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) ctx.drawImage(GRAIN, x, y);
    ctx.restore();
    const sec = Math.floor(t), fr = f % FPS;
    txt(String(sec).padStart(2, '0') + ':' + String(fr).padStart(2, '0'), W - 40, H - 32, { size: 13, align: 'right', alpha: 0.35 });
    txt('SINGULARITY  //  ML ANTICHEAT', 40, H - 32, { size: 13, spacing: 3, alpha: 0.35 });
  }

  function renderFrame(t) {
    t = clamp(t, 0, DURATION);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([]);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    for (const sc of SCENES) {
      const e = env(t, sc);
      if (e <= 0.001) continue;
      ctx.save(); ctx.globalAlpha = e; sc.draw(t - sc.a, sc.b - sc.a, t); ctx.restore();
    }
    post(t);
  }

  window.renderFrame = renderFrame;
  window.VIDEO = { W: W, H: H, FPS: FPS, DURATION: DURATION };
  window.SIM = SIM;
})();
