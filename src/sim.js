/*
 * Tick simulator for a Minecraft player, in the exact 55-feature format the
 * Singularity data-collection plugin produces (one row per server tick, 20 TPS).
 * Scenario (40 ticks = 2.0 s): idle -> hotbar switch to sword -> sprint ->
 * sprint-jump -> second jump -> W-tap -> falling critical hit on a zombie.
 */
(function (global) {
  'use strict';

  const FEATURES = [
    'tick', 'pos_x', 'pos_y', 'pos_z', 'delta_pos_x', 'delta_pos_y', 'delta_pos_z',
    'vel_x', 'vel_y', 'vel_z', 'delta_vel_x', 'delta_vel_y', 'delta_vel_z',
    'yaw', 'pitch', 'delta_yaw', 'delta_pitch',
    'on_ground', 'is_sneaking', 'is_sprinting', 'is_swimming', 'in_water', 'on_ladder',
    'is_elytra_flying', 'has_riptide', 'is_riptide_charging',
    'active_potion_effects', 'attribute_modified_list', 'armor_items_enchantments',
    'held_slot', 'held_item', 'offhand_item', 'totem_count', 'delta_item_change_tick',
    'hit_entity_type', 'hit_entity_distance', 'hit_yaw_diff', 'hit_pitch_diff',
    'damage_dealt', 'attack_cooldown', 'is_critical_hit',
    'last_place_tick', 'last_break_tick', 'placed_block', 'broken_block', 'place_break_delta',
    'server_tps', 'ping', 'delta_ping', 'tick_alignment_ms', 'packets_freq',
    'delta_packets_freq', 'delta_mouse_yaw', 'delta_mouse_pitch', 'last_key_press_delta_ms'
  ];

  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const r4 = v => Math.round(v * 1e4) / 1e4;
  const r2 = v => Math.round(v * 100) / 100;
  const wrap = a => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fmt(v) {
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') { const s = String(r4(v)); return s === '-0' ? '0' : s; }
    return String(v);
  }

  function simulate(seed) {
    const N = 41;            // 40 shown ticks + 1 for interpolation
    const START = 4398;      // continues right after the real sample (4375..4397)
    const rnd = mulberry32(seed || 4375);
    const jit = a => (rnd() * 2 - 1) * a;

    // ---- pass 1: movement physics (vanilla-like constants) ----
    const S = [];
    let x = 14.5, y = 64, z = 1.5, vy = -0.0784, speed = 0, yaw = 0, pitch = 0;
    let onGround = true, jumps = 0, j2 = -1;
    const jumpTicks = [];
    for (let i = 0; i < N; i++) {
      const sprintKey = i >= 6 && i < 37;
      const wtap = j2 >= 0 && i >= j2 + 5 && i <= j2 + 7;
      const sprinting = sprintKey && !wtap;
      const tYaw = i < 6 ? 0 : i < 18 ? -38 : i < 30 ? -38 + (i - 18) * 5 : 22;
      const tPitch = i < 6 ? 0 : i < 24 ? 4 : 12;
      const dyaw = i < 6 ? 0 : (tYaw - yaw) * 0.32 + jit(0.6);
      const dpitch = i < 6 ? 0 : (tPitch - pitch) * 0.3 + jit(0.25);
      yaw += dyaw; pitch += dpitch;

      let jumped = false;
      if (onGround && ((jumps === 0 && i === 10) || (jumps === 1 && i >= 22))) {
        vy = 0.42; onGround = false; jumps++; jumped = true; jumpTicks.push(i);
        if (jumps === 2) j2 = i;
        if (sprinting) speed += 0.2;
      }
      if (onGround && !jumped) {
        const target = sprinting ? 0.2806 : (sprintKey ? 0.2158 : 0);
        speed += (target - speed) * 0.5;
        if (!sprintKey && speed < 0.003) speed = 0;
      } else if (!jumped) {
        speed = speed * 0.91 + (sprintKey ? (sprinting ? 0.0235 : 0.018) : 0);
      }
      const yr = yaw * D2R;
      const vx = -Math.sin(yr) * speed, vz = Math.cos(yr) * speed;
      const px = x, py = y, pz = z;
      x += vx; z += vz;
      let vyUsed;
      if (onGround) { vyUsed = -0.0784; }
      else {
        vyUsed = vy; y += vy; vy = (vy - 0.08) * 0.98;
        if (y <= 64) { y = 64; onGround = true; vy = -0.0784; }
      }
      S.push({ x, y, z, dx: x - px, dy: y - py, dz: z - pz, vx, vy: vyUsed, vz, yaw, pitch, dyaw, dpitch, onGround, sprinting, sprintKey, wtap });
    }

    // ---- pass 2: place the zombie so the falling crit lands ----
    const A = j2 >= 0 ? Math.min(N - 4, j2 + 6) : 30;
    const pa = S[A];
    const zyaw = (pa.yaw + 2.1) * D2R, zd = 2.55;
    const zx = pa.x - Math.sin(zyaw) * zd, zz = pa.z + Math.cos(zyaw) * zd, zy = 64;
    const kb = [-Math.sin(pa.yaw * D2R), Math.cos(pa.yaw * D2R)];
    const zombie = [];
    for (let i = 0; i < N; i++) {
      const k = i <= A ? 0 : Math.min(1, (i - A) / 4) * 0.5;
      const hop = i > A && i < A + 4 ? Math.sin((i - A) / 4 * Math.PI) * 0.25 : 0;
      zombie.push([zx + kb[0] * k, zy + hop, zz + kb[1] * k]);
    }
    const toYaw = Math.atan2(-(zx - pa.x), (zz - pa.z)) * R2D;
    const hyaw = wrap(toYaw - pa.yaw);
    const horiz = Math.hypot(zx - pa.x, zz - pa.z);
    const eyeY = pa.y + 1.62;
    const toPitch = -Math.atan2((zy + 1.0) - eyeY, horiz) * R2D;
    const hpitch = toPitch - pa.pitch;
    const hd = Math.max(0, horiz - 0.3);
    const vd = eyeY > zy + 1.95 ? eyeY - (zy + 1.95) : (eyeY < zy ? zy - eyeY : 0);
    const hitDist = Math.hypot(hd, vd);

    // ---- pass 3: build the 55-feature rows ----
    const keyTicks = new Set([4, 6].concat(jumpTicks));
    if (j2 >= 0) { keyTicks.add(j2 + 5); keyTicks.add(j2 + 8); }
    const rows = [];
    let prevV = [0, -0.0784, 0], slot = 0, item = 'NONE', lastItemChange = -23, cd = 1;
    let ping = 15, prevPk = 0, lastKey = -1, lastKeyOff = 0;
    for (let i = 0; i < N; i++) {
      const s = S[i];
      if (i === 4) { slot = 1; item = 'DIAMOND_SWORD'; lastItemChange = 4; cd = 0; }
      else if (i > 0) cd = Math.min(1, cd + (item === 'NONE' ? 0.2 : 0.08));
      if (keyTicks.has(i)) { lastKey = i; lastKeyOff = Math.floor(rnd() * 40); }
      const lkp = lastKey < 0 ? -1 : (i - lastKey) * 50 + lastKeyOff;
      const nping = rnd() < 0.18 ? 15 + Math.round(jit(3)) : 15;
      const dping = nping - ping; ping = nping;
      const moving = Math.abs(s.dx) + Math.abs(s.dy) + Math.abs(s.dz) > 1e-6 || Math.abs(s.dyaw) > 0.05;
      const pk = moving ? 20 + Math.round(jit(1.4)) : 0;
      const dpk = pk - prevPk; prevPk = pk;
      const hit = i === A;
      const v = {
        tick: START + i,
        pos_x: r4(s.x), pos_y: r4(s.y), pos_z: r4(s.z),
        delta_pos_x: r4(s.dx), delta_pos_y: r4(s.dy), delta_pos_z: r4(s.dz),
        vel_x: r4(s.vx), vel_y: r4(s.vy), vel_z: r4(s.vz),
        delta_vel_x: r4(s.vx - prevV[0]), delta_vel_y: r4(s.vy - prevV[1]), delta_vel_z: r4(s.vz - prevV[2]),
        yaw: r4(s.yaw), pitch: r4(s.pitch), delta_yaw: r4(s.dyaw), delta_pitch: r4(s.dpitch),
        on_ground: s.onGround, is_sneaking: false, is_sprinting: s.sprinting, is_swimming: false,
        in_water: false, on_ladder: false, is_elytra_flying: false, has_riptide: false, is_riptide_charging: false,
        active_potion_effects: 'NONE', attribute_modified_list: 'NONE', armor_items_enchantments: 'NONE',
        held_slot: slot, held_item: item, offhand_item: 'NONE', totem_count: 0,
        delta_item_change_tick: i - lastItemChange,
        hit_entity_type: hit ? 'ZOMBIE' : 'NONE',
        hit_entity_distance: hit ? r2(hitDist) : 0,
        hit_yaw_diff: hit ? r2(hyaw) : 0,
        hit_pitch_diff: hit ? r2(hpitch) : 0,
        damage_dealt: hit ? 10.5 : 0,
        attack_cooldown: r2(cd),
        is_critical_hit: hit,
        last_place_tick: -1, last_break_tick: -1, placed_block: 'NONE', broken_block: 'NONE', place_break_delta: -1,
        server_tps: r2(19.32 + jit(0.02)), ping: ping, delta_ping: dping,
        tick_alignment_ms: 15 + Math.floor(rnd() * 35),
        packets_freq: pk, delta_packets_freq: dpk,
        delta_mouse_yaw: Math.round(s.dyaw / 0.15), delta_mouse_pitch: Math.round(s.dpitch / 0.15),
        last_key_press_delta_ms: lkp
      };
      const row = {};
      for (const k of FEATURES) row[k] = v[k];
      rows.push(row);
      prevV = [s.vx, s.vy, s.vz];
      if (hit) cd = 0;
    }

    const events = [{ i: 4, label: 'SLOT 2' }, { i: 6, label: 'SPRINT' }]
      .concat(jumpTicks.map(i => ({ i, label: 'JUMP' })))
      .concat([{ i: A, label: 'CRIT' }])
      .sort((a, b) => a.i - b.i);

    return { features: FEATURES, rows, zombie, attackIndex: A, events, jumpTicks, startTick: START };
  }

  function toTSV(sim) {
    return [sim.features.join('\t')]
      .concat(sim.rows.slice(0, 40).map(r => sim.features.map(k => fmt(r[k])).join('\t')))
      .join('\n');
  }

  global.SingularitySim = { FEATURES, simulate, fmt, toTSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.SingularitySim;
})(typeof window !== 'undefined' ? window : globalThis);
