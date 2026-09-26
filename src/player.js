/* 3D wireframe renderer for the simulated clip: transparent player, outlines only. */
(function (SV) {
  const { W, H } = SV;
  const PX = 1.8 / 32; // Steve is 32 model pixels tall; the hitbox is 1.8 blocks
  const PARTS = {
    head: { pivot: [0, 24, 0], min: [-4, 0, -4], max: [4, 8, 4] },
    body: { pivot: [0, 12, 0], min: [-4, 0, -2], max: [4, 12, 2] },
    armR: { pivot: [-6, 24, 0], min: [-2, -12, -2], max: [2, 0, 2] },
    armL: { pivot: [6, 24, 0], min: [-2, -12, -2], max: [2, 0, 2] },
    legR: { pivot: [-2, 12, 0], min: [-2, -12, -2], max: [2, 0, 2] },
    legL: { pivot: [2, 12, 0], min: [-2, -12, -2], max: [2, 0, 2] },
  };
  // corner index bits: 1 = x max, 2 = y max, 4 = z max
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const CUBES = [[18, 64, 6], [18, 65, 6], [18, 64, 7], [10, 64, 11], [11, 64, 11], [6, 64, 4], [21, 64, 13], [21, 65, 13], [21, 66, 13]];

  const rotX = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
  const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
  const rotZ = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };

  SV.camera = (eye, target, f = 1150, cx = W / 2, cy = H / 2) => {
    const dx = target.x - eye.x, dy = target.y - eye.y, dz = target.z - eye.z;
    return { eye, yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), f, cx, cy };
  };

  // Minecraft axes: +x east, +y up, +z south. Looking along +z, +x is on the left.
  SV.project = (cam, p) => {
    const x = p.x - cam.eye.x, y = p.y - cam.eye.y, z = p.z - cam.eye.z;
    const cyw = Math.cos(-cam.yaw), syw = Math.sin(-cam.yaw);
    const x1 = x * cyw + z * syw;
    const z1 = -x * syw + z * cyw;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    if (z2 < 0.15) return null;
    return { x: cam.cx - (cam.f * x1) / z2, y: cam.cy - (cam.f * y2) / z2, z: z2 };
  };

  function seg(ctx, cam, a, b) {
    const p = SV.project(cam, a), q = SV.project(cam, b);
    if (!p || !q) return;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }

  function strokeEdges(ctx, pts, alpha, lw) {
    // soft glow pass, then the crisp outline
    for (const [w, a] of [[lw * 4, alpha * 0.08], [lw, alpha]]) {
      ctx.strokeStyle = SV.white(a);
      ctx.lineWidth = w;
      ctx.beginPath();
      for (const [i, j] of EDGES) {
        if (!pts[i] || !pts[j]) continue;
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
      }
      ctx.stroke();
    }
  }

  function drawModel(ctx, cam, pose, alpha, lw = 2) {
    for (const name in PARTS) {
      const part = PARTS[name];
      const r = pose.rot[name] || [0, 0, 0];
      const pts = [];
      for (let i = 0; i < 8; i++) {
        let p = [i & 1 ? part.max[0] : part.min[0], i & 2 ? part.max[1] : part.min[1], i & 4 ? part.max[2] : part.min[2]];
        p = rotZ(p, r[1] || 0);
        p = rotX(p, r[0] || 0);
        if (r[2]) p = rotY(p, r[2]);
        p = [p[0] + part.pivot[0], p[1] + part.pivot[1], p[2] + part.pivot[2]];
        p = rotY(p, pose.bodyRot);
        pts.push(SV.project(cam, { x: pose.x + p[0] * PX, y: pose.y + p[1] * PX, z: pose.z + p[2] * PX }));
      }
      strokeEdges(ctx, pts, alpha, lw);
    }
  }

  function boxPts(cam, x0, y0, z0, x1, y1, z1) {
    const pts = [];
    for (let i = 0; i < 8; i++) pts.push(SV.project(cam, { x: i & 1 ? x1 : x0, y: i & 2 ? y1 : y0, z: i & 4 ? z1 : z0 }));
    return pts;
  }

  function drawGrid(ctx, cam, cx, cz, y) {
    const N = 14, x0 = Math.floor(cx), z0 = Math.floor(cz);
    ctx.lineWidth = 1;
    const line = (ax, az, bx, bz) => {
      const d = Math.hypot((ax + bx) / 2 - cx, (az + bz) / 2 - cz);
      const a = 0.45 * Math.pow(Math.max(0, 1 - d / N), 1.5);
      if (a < 0.01) return;
      ctx.strokeStyle = SV.white(a);
      seg(ctx, cam, { x: ax, y, z: az }, { x: bx, y, z: bz });
    };
    for (let i = -N; i <= N; i++) {
      for (let j = -N; j < N; j++) {
        line(x0 + i, z0 + j, x0 + i, z0 + j + 1);
        line(x0 + j, z0 + i, x0 + j + 1, z0 + i);
      }
    }
  }

  let PHASE = null, SPEED = null;
  function prep() {
    PHASE = [0];
    SPEED = [0];
    for (let i = 1; i < SV.SIM.length; i++) {
      const r = SV.SIM[i];
      const d = Math.hypot(r.delta_pos_x, r.delta_pos_z);
      PHASE.push(PHASE[i - 1] + d * 2.6);
      SPEED.push(d);
    }
  }

  const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const f3 = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
  const B = (v) => (v ? 'TRUE' : 'FALSE');

  SV.drawClip = (ctx, tau, t) => {
    if (!PHASE) prep();
    const S = SV.SIM, n = S.length;
    tau = SV.clamp(tau, 0, n - 1);
    const i = Math.min(n - 2, Math.floor(tau));
    const f = tau - i;
    const A = S[i], Bn = S[i + 1];
    const L = (k) => SV.lerp(A[k], Bn[k], f);
    const px = L('pos_x'), py = L('pos_y'), pz = L('pos_z');
    const yaw = L('yaw'), pitch = L('pitch');
    const phase = SV.lerp(PHASE[i], PHASE[i + 1], f);
    const amp = SV.clamp(SV.lerp(SPEED[i], SPEED[i + 1], f) / 0.25) * 0.85;
    const cur = S[Math.round(tau)];
    const prev = S[Math.max(0, Math.round(tau) - 1)];
    const Z = SV.ZOMBIE;

    const focus = { x: SV.lerp(px, Z.x, 0.3), y: 64.9, z: SV.lerp(pz, Z.z, 0.3) };
    const ang = 2.25 + t * 0.18;
    const eye = { x: focus.x + Math.sin(ang) * 8, y: focus.y + 2.8, z: focus.z + Math.cos(ang) * 8 };
    const cam = SV.camera(eye, focus, 1150, W * 0.4, H * 0.54);

    drawGrid(ctx, cam, px, pz, 64);
    for (const c of CUBES) strokeEdges(ctx, boxPts(cam, c[0], c[1], c[2], c[0] + 1, c[1] + 1, c[2] + 1), 0.3, 1.2);

    // sampled trajectory: one dot per tick
    for (let k = 0; k <= Math.round(tau); k++) {
      const p = SV.project(cam, { x: S[k].pos_x, y: S[k].pos_y + 0.02, z: S[k].pos_z });
      if (p) { ctx.fillStyle = SV.white(0.55); ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
      const g = SV.project(cam, { x: S[k].pos_x, y: 64.01, z: S[k].pos_z });
      if (g) { ctx.fillStyle = SV.white(0.18); ctx.fillRect(g.x - 1, g.y - 1, 2, 2); }
    }

    // zombie target
    const since = tau - SV.HIT_INDEX;
    const kb = since > 0 ? 1.1 * (1 - Math.exp(-since / 1.8)) : 0;
    const zx = Z.x - Math.sin(Z.hitYawRad) * kb;
    const zz = Z.z + Math.cos(Z.hitYawRad) * kb;
    const zy = 64 + (since > 0 ? Math.sin(Math.min(since / 5, 1) * Math.PI) * 0.35 : 0);
    const flash = since > 0 && since < 3 ? 1 - since / 3 : 0;
    const sway = 0.1 * Math.sin(t * 3);
    drawModel(ctx, cam, { x: zx, y: zy, z: zz, bodyRot: Z.bodyRot, rot: { armR: [-Math.PI / 2 + sway, 0], armL: [-Math.PI / 2 - sway, 0], head: [0.15, 0, 0] } }, 0.4 + 0.6 * flash, 1.6);
    const zl = SV.project(cam, { x: zx, y: zy + 2.15, z: zz });
    if (zl) SV.text(ctx, 'ZOMBIE', zl.x, zl.y, { size: 13, align: 'center', alpha: 0.5, spacing: 3 });

    // player
    const swingP = since >= -1 && since < 5 ? (since + 1) / 6 : -1;
    const armSwing = swingP >= 0 ? -Math.sin(swingP * Math.PI) * 1.7 : 0;
    const s = Math.sin(phase) * amp;
    const pose = {
      x: px, y: py, z: pz, bodyRot: (-yaw * Math.PI) / 180,
      rot: { head: [(pitch * Math.PI) / 180, 0, 0], legR: [s, 0], legL: [-s, 0], armR: [-s * 0.8 + armSwing, 0.05], armL: [s * 0.8, -0.05] },
    };
    drawModel(ctx, cam, pose, 1, 2.2);

    // hitbox (dashed), look ray, movement vector
    ctx.setLineDash([6, 6]);
    strokeEdges(ctx, boxPts(cam, px - 0.3, py, pz - 0.3, px + 0.3, py + 1.8, pz + 0.3), 0.28, 1);
    const yr = (yaw * Math.PI) / 180, pr = (pitch * Math.PI) / 180;
    const e0 = { x: px, y: py + 1.62, z: pz };
    const e1 = { x: px - Math.sin(yr) * Math.cos(pr) * 3.4, y: py + 1.62 - Math.sin(pr) * 3.4, z: pz + Math.cos(yr) * Math.cos(pr) * 3.4 };
    ctx.strokeStyle = SV.white(0.7);
    ctx.lineWidth = 1.5;
    seg(ctx, cam, e0, e1);
    ctx.setLineDash([]);
    const m0 = SV.project(cam, { x: px, y: py + 0.05, z: pz });
    const m1 = SV.project(cam, { x: px + L('delta_pos_x') * 6, y: py + 0.05 + L('delta_pos_y') * 6, z: pz + L('delta_pos_z') * 6 });
    if (m0 && m1 && Math.hypot(m1.x - m0.x, m1.y - m0.y) > 6) SV.drawPoly(ctx, [[m0.x, m0.y], [m1.x, m1.y]], 1, 0.85, 2, true);
    const pl = SV.project(cam, { x: px, y: py + 2.15, z: pz });
    if (pl) SV.text(ctx, 'PLAYER', pl.x, pl.y, { size: 13, align: 'center', alpha: 0.7, spacing: 3 });

    // hit marker
    if (flash > 0) {
      const hp = SV.project(cam, { x: zx, y: zy + 1.2, z: zz });
      if (hp) {
        ctx.strokeStyle = SV.white(flash);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, 20 + (1 - flash) * 90, 0, Math.PI * 2);
        ctx.stroke();
        SV.text(ctx, 'HIT · ZOMBIE · 2.9 m · CRIT', hp.x, hp.y - 40 - (1 - flash) * 60, { size: 16, align: 'center', alpha: flash, spacing: 2 });
      }
    }

    // ---- live feature panel ----
    const x0 = 1370, x1 = 1860;
    SV.text(ctx, `TICK ${cur.tick}`, x0, 205, { size: 40, weight: 300, alpha: 1, spacing: 4 });
    const rows = [
      ['pos', `${cur.pos_x.toFixed(2)} ${cur.pos_y.toFixed(2)} ${cur.pos_z.toFixed(2)}`],
      ['delta_pos', `${f3(cur.delta_pos_x)} ${f3(cur.delta_pos_y)} ${f3(cur.delta_pos_z)}`],
      ['vel', `${f3(cur.vel_x)} ${f3(cur.vel_y)} ${f3(cur.vel_z)}`],
      ['yaw / pitch', `${f1(cur.yaw)} / ${f1(cur.pitch)}`],
      ['delta_yaw / pitch', `${f1(cur.delta_yaw)} / ${f1(cur.delta_pitch)}`],
      ['on_ground', B(cur.on_ground)],
      ['is_sprinting', B(cur.is_sprinting)],
      ['held_item', cur.held_item],
      ['attack_cooldown', f1(cur.attack_cooldown)],
      ['hit_entity', cur.hit_entity_type === 'NONE' ? 'NONE' : `${cur.hit_entity_type} ${cur.hit_entity_distance}m`],
      ['is_critical_hit', B(cur.is_critical_hit)],
      ['ping / tps', `${cur.ping} / ${cur.server_tps}`],
      ['last_key_press_ms', String(cur.last_key_press_delta_ms)],
    ];
    const prevVals = { on_ground: B(prev.on_ground), is_sprinting: B(prev.is_sprinting), hit_entity: prev.hit_entity_type === 'NONE' ? 'NONE' : '', is_critical_hit: B(prev.is_critical_hit) };
    rows.forEach(([k, v], r) => {
      const y = 250 + r * 37;
      const changed = prevVals[k] !== undefined && prevVals[k] !== v;
      SV.text(ctx, k, x0, y, { size: 15, alpha: 0.5 });
      SV.text(ctx, v, x1, y, { size: 18, align: 'right', alpha: changed ? 1 : 0.8, weight: changed ? 600 : 400 });
    });
    ctx.strokeStyle = SV.white(0.2);
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 20, 160, x1 - x0 + 40, 600);

    // delta_yaw sparkline: the aim snap stands out
    const gy = 820, gh = 70;
    SV.text(ctx, 'delta_yaw', x0, gy - gh / 2 - 12, { size: 14, alpha: 0.5 });
    ctx.strokeStyle = SV.white(0.15);
    ctx.beginPath();
    ctx.moveTo(x0, gy + gh / 2);
    ctx.lineTo(x1, gy + gh / 2);
    ctx.stroke();
    ctx.strokeStyle = SV.white(0.9);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k <= Math.round(tau); k++) {
      const x = x0 + (k / (n - 1)) * (x1 - x0);
      const y = gy + gh / 2 - SV.clamp(Math.abs(S[k].delta_yaw) / 30) * gh;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // raw input stream: real captured rows first, then the simulated ticks
    const all = SV.REAL_ROWS.concat(SV.SIM_ROWS);
    const ci = SV.REAL_ROWS.length + Math.round(tau);
    const clip = (str) => (str.length > 230 ? str.slice(0, 229) + '…' : str);
    SV.text(ctx, clip(SV.HEADER.join(' ')), 60, 905, { size: 12, alpha: 0.35 });
    for (let k = 0; k < 4; k++) {
      const row = all[ci - 3 + k];
      if (!row) continue;
      SV.text(ctx, clip(row.join(' ')), 60, 928 + k * 22, { size: 12, alpha: 0.3 + k * 0.23 });
    }
  };
})(window.SV);
