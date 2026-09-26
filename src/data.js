/* Input schema, the real captured rows, and a simulated 2 second clip that uses the same schema. */
(function (SV) {
  SV.HEADER = (
    'tick pos_x pos_y pos_z delta_pos_x delta_pos_y delta_pos_z vel_x vel_y vel_z ' +
    'delta_vel_x delta_vel_y delta_vel_z yaw pitch delta_yaw delta_pitch on_ground is_sneaking ' +
    'is_sprinting is_swimming in_water on_ladder is_elytra_flying has_riptide is_riptide_charging ' +
    'active_potion_effects attribute_modified_list armor_items_enchantments held_slot held_item ' +
    'offhand_item totem_count delta_item_change_tick hit_entity_type hit_entity_distance hit_yaw_diff ' +
    'hit_pitch_diff damage_dealt attack_cooldown is_critical_hit last_place_tick last_break_tick ' +
    'placed_block broken_block place_break_delta server_tps ping delta_ping tick_alignment_ms ' +
    'packets_freq delta_packets_freq delta_mouse_yaw delta_mouse_pitch last_key_press_delta_ms'
  ).split(' ');

  // Real capture: an idle player, ticks 4375-4397. Only these fields change between rows:
  // [tick, vel_y, delta_vel_y, on_ground, delta_item_change_tick, attack_cooldown, server_tps, ping, delta_ping, tick_alignment_ms]
  const REAL_VARYING = [
    [4375, 0, 0, 'FALSE', 0, 0, 19.44, 2, 0, 9],
    [4376, -0.0784, -0.0784, 'FALSE', 1, 0.2, 19.26, 2, 0, 20],
    [4377, -0.0784, 0, 'TRUE', 2, 0.4, 19.24, 2, 0, 43],
    [4378, -0.0784, 0, 'TRUE', 3, 0.6, 19.24, 15, 13, 30],
    [4379, -0.0784, 0, 'TRUE', 4, 0.8, 19.25, 15, 0, 45],
    [4380, -0.0784, 0, 'TRUE', 5, 1, 19.26, 15, 0, 25],
    [4381, -0.0784, 0, 'TRUE', 6, 1, 19.27, 15, 0, 44],
    [4382, -0.0784, 0, 'TRUE', 7, 1, 19.28, 15, 0, 15],
    [4383, -0.0784, 0, 'TRUE', 8, 1, 19.29, 15, 0, 34],
    [4384, -0.0784, 0, 'TRUE', 9, 1, 19.3, 15, 0, 49],
    [4385, -0.0784, 0, 'TRUE', 10, 1, 19.31, 15, 0, 23],
    [4386, -0.0784, 0, 'TRUE', 11, 1, 19.32, 15, 0, 25],
    [4387, -0.0784, 0, 'TRUE', 12, 1, 19.32, 15, 0, 23],
    [4388, -0.0784, 0, 'TRUE', 13, 1, 19.32, 15, 0, 24],
    [4389, -0.0784, 0, 'TRUE', 14, 1, 19.32, 15, 0, 24],
    [4390, -0.0784, 0, 'TRUE', 15, 1, 19.32, 15, 0, 24],
    [4391, -0.0784, 0, 'TRUE', 16, 1, 19.32, 15, 0, 23],
    [4392, -0.0784, 0, 'TRUE', 17, 1, 19.32, 15, 0, 22],
    [4393, -0.0784, 0, 'TRUE', 18, 1, 19.32, 15, 0, 23],
    [4394, -0.0784, 0, 'TRUE', 19, 1, 19.32, 15, 0, 24],
    [4395, -0.0784, 0, 'TRUE', 20, 1, 19.32, 15, 0, 26],
    [4396, -0.0784, 0, 'TRUE', 21, 1, 19.32, 15, 0, 23],
    [4397, -0.0784, 0, 'TRUE', 22, 1, 19.32, 15, 0, 23],
  ];

  SV.REAL_ROWS = REAL_VARYING.map(([tick, vy, dvy, og, itemTick, cd, tps, ping, dping, align]) =>
    [
      tick, 14.5, 64, 1.5, 0, 0, 0, 0, vy, 0, 0, dvy, 0, 0, 0, 0, 0, og,
      'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE',
      'NONE', 'NONE', 'NONE', 0, 'NONE', 'NONE', 0, itemTick,
      'NONE', 0, 0, 0, 0, cd, 'FALSE', -1, -1, 'NONE', 'NONE', -1,
      tps, ping, dping, align, 0, 0, 0, 0, -1,
    ].map(String)
  );

  SV.fmt = (v) => {
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return String(Math.round(v * 1e4) / 1e4);
    return String(v);
  };
  SV.rowToArray = (row) => SV.HEADER.map((h) => SV.fmt(row[h]));

  // ---- simulated clip: 40 ticks (2 s at 20 TPS), continuing from the real capture ----
  // Vanilla-like physics: gravity 0.08, air drag 0.98, jump 0.42, ground friction 0.546, sprint-jump boost 0.2.
  const HIT = 32;
  function simulate() {
    const rnd = SV.rng(4242);
    const rows = [];
    let x = 14.5, y = 64, z = 1.5, vx = 0, vy = -0.0784, vz = 0;
    let yaw = 0, pitch = 0, onGround = true;
    let cooldown = 1, itemTick = 22, keyMs = -1, ping = 15, packets = 0;

    for (let i = 0; i < 40; i++) {
      const p = { x, y, z, vx, vy, vz, yaw, pitch };
      const fwd = i >= 4 && i < 35;
      const sprint = i >= 9 && i < 31; // sprint released just before the hit, so the falling hit can crit
      const wantJump = i === 12 || i === 25;
      const keyPress = i === 0 || i === 4 || i === 9 || wantJump || i === 35;

      // look script: slow drift, then a fast snap onto the zombie at tick 28
      let ty, tp;
      if (i < 4) { ty = 0; tp = 0; }
      else if (i < 28) { ty = 20 * SV.ease(SV.clamp((i - 4) / 18)); tp = 6; }
      else { ty = 58; tp = 13; }
      const k = i >= 28 && i <= 30 ? 0.72 : 0.4;
      yaw += (ty - yaw) * k + (i >= 4 ? (rnd() - 0.5) * 0.5 : 0);
      pitch += (tp - pitch) * 0.35 + (i >= 4 ? (rnd() - 0.5) * 0.3 : 0);

      const yr = (yaw * Math.PI) / 180;
      const dx = -Math.sin(yr), dz = Math.cos(yr);
      if (wantJump && onGround) {
        vy = 0.42;
        if (sprint) { vx += dx * 0.2; vz += dz * 0.2; }
      }
      const acc = fwd ? (onGround ? (sprint ? 0.13 : 0.1) : sprint ? 0.026 : 0.02) : 0;
      vx += dx * acc;
      vz += dz * acc;
      x += vx; y += vy; z += vz;
      if (y <= 64) { y = 64; vy = 0; onGround = true; } else onGround = false;
      const fr = onGround ? 0.546 : 0.91;
      vx *= fr; vz *= fr;
      vy = (vy - 0.08) * 0.98;

      if (i === 0) { cooldown = 0; itemTick = 0; } // swapped to the sword on the first tick
      else { cooldown = Math.min(1, Math.round((cooldown + 0.2) * 10) / 10); itemTick++; }
      if (i === HIT + 1) cooldown = 0;

      keyMs = keyPress ? 0 : keyMs >= 0 ? keyMs + 50 : -1;
      const np = 15 + (rnd() < 0.15 ? 1 : 0);
      const dping = np - ping;
      ping = np;
      const moving = fwd || !onGround || Math.hypot(x - p.x, z - p.z) > 0.003;
      const pf = moving ? 20 : 0;
      const dpf = pf - packets;
      packets = pf;

      const hit = i === HIT;
      const crit = hit && !onGround && !sprint;
      rows.push({
        tick: 4398 + i,
        pos_x: x, pos_y: y, pos_z: z,
        delta_pos_x: x - p.x, delta_pos_y: y - p.y, delta_pos_z: z - p.z,
        vel_x: vx, vel_y: vy, vel_z: vz,
        delta_vel_x: vx - p.vx, delta_vel_y: vy - p.vy, delta_vel_z: vz - p.vz,
        yaw, pitch, delta_yaw: yaw - p.yaw, delta_pitch: pitch - p.pitch,
        on_ground: onGround, is_sneaking: false, is_sprinting: sprint, is_swimming: false, in_water: false,
        on_ladder: false, is_elytra_flying: false, has_riptide: false, is_riptide_charging: false,
        active_potion_effects: 'NONE', attribute_modified_list: 'NONE', armor_items_enchantments: 'NONE',
        held_slot: 1, held_item: 'DIAMOND_SWORD', offhand_item: 'NONE', totem_count: 0, delta_item_change_tick: itemTick,
        hit_entity_type: hit ? 'ZOMBIE' : 'NONE', hit_entity_distance: hit ? 2.9 : 0,
        hit_yaw_diff: hit ? 1.8 : 0, hit_pitch_diff: hit ? 0.9 : 0, damage_dealt: hit ? (crit ? 10.5 : 7) : 0,
        attack_cooldown: cooldown, is_critical_hit: crit,
        last_place_tick: -1, last_break_tick: -1, placed_block: 'NONE', broken_block: 'NONE', place_break_delta: -1,
        server_tps: Math.round((19.32 + (rnd() - 0.5) * 0.02) * 100) / 100,
        ping, delta_ping: dping, tick_alignment_ms: 20 + Math.floor(rnd() * 28),
        packets_freq: pf, delta_packets_freq: dpf,
        delta_mouse_yaw: Math.round((yaw - p.yaw) / 0.15), delta_mouse_pitch: Math.round((pitch - p.pitch) / 0.15),
        last_key_press_delta_ms: keyMs,
      });
    }
    return rows;
  }

  SV.SIM = simulate();
  SV.SIM_ROWS = SV.SIM.map(SV.rowToArray);
  SV.HIT_INDEX = HIT;

  // Zombie target: 2.9 blocks from the player on the hit tick, 1.8 deg off the crosshair.
  const hr = SV.SIM[HIT];
  const zy = ((hr.yaw + 1.8) * Math.PI) / 180;
  SV.ZOMBIE = { x: hr.pos_x - Math.sin(zy) * 2.9, y: 64, z: hr.pos_z + Math.cos(zy) * 2.9, hitYawRad: zy, bodyRot: -(zy + Math.PI) };

  // ---- normalisation used for the "what the network sees" cell grids ----
  const SCALE = {
    pos_x: 64, pos_y: 128, pos_z: 64, yaw: 180, pitch: 90, delta_yaw: 30, delta_pitch: 15,
    delta_mouse_yaw: 150, delta_mouse_pitch: 100, server_tps: 20, ping: 100, delta_ping: 20,
    tick_alignment_ms: 50, packets_freq: 20, delta_packets_freq: 20, last_key_press_delta_ms: 500,
    delta_item_change_tick: 40, hit_entity_distance: 6, hit_yaw_diff: 10, hit_pitch_diff: 10, damage_dealt: 12,
    attack_cooldown: 1, held_slot: 8, totem_count: 2, last_place_tick: 100, last_break_tick: 100, place_break_delta: 20,
  };
  SV.featVec = (row) =>
    SV.HEADER.map((h) => {
      const v = row[h];
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'string') return v === 'NONE' ? 0 : 0.7;
      if (h === 'tick') return 0.3;
      return Math.tanh(v / (SCALE[h] || 0.5));
    });

  // Pseudo hidden states for the diagrams (deterministic).
  SV.hidden = (i, seed, n = 8) => {
    const r = SV.rng(i * 97 + seed * 13 + 5);
    return Array.from({ length: n }, () => r() * 2 - 1);
  };

  // The window shown in the BiLSTM scenes: the aim snap (28) through the crit hit (32) and after.
  SV.SEQ = [28, 29, 30, 31, 32, 33, 34];
  const e = SV.SEQ.map((i) => Math.abs(SV.SIM[i].delta_yaw) / 8 + Math.abs(SV.SIM[i].delta_pitch) / 6 + (i === HIT ? 2.4 : 0));
  const m = Math.max(...e);
  const ex = e.map((v) => Math.exp(v - m));
  const s = ex.reduce((a, b) => a + b, 0);
  SV.ATT = ex.map((v) => v / s);
})(window.SV);
