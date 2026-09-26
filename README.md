# opus-5.5-video-test

A ~23 second monochrome explainer video for **Singularity**, a machine-learning anticheat for Minecraft. It is written in plain JavaScript on a `<canvas>`. Every frame is a pure function of time, so the output is deterministic.

## What is in the video

| Time | Scene |
|---|---|
| 0.0 - 3.0 s | Interstellar-style black hole (white on black) and title |
| 3.0 - 5.4 s | **2.0 s simulated player clip (40 ticks at 20 TPS).** The player is fully transparent, drawn only as white outlines: wireframe model, hitbox, look ray, velocity vector, 20 Hz sample ghosts. A live panel shows all 55 features per tick. The clip ends on a falling critical hit on a zombie. |
| 5.4 - 7.4 s | The 40 x 55 input tensor fills row by row and spirals into the black hole |
| 7.4 - 10.9 s | Standard LSTM cell visualiser: forget, input, candidate, cell update, output, hidden state, with the equations |
| 10.9 - 14.4 s | The same cell running backwards, then an unrolled bidirectional LSTM with concatenated outputs and attention |
| 14.4 - 18.9 s | The three models |
| 18.9 - 23.5 s | Open source / closed source / inference API, outro |

### Models

| Model | Parameters | Architecture |
|---|---|---|
| Graviton | 2.77M | BLSTM + Bahdanau (additive) attention |
| Event Horizon | 10M | BLSTM + multi-head attention |
| Singularity | 100M | Transformer + multi-head attention |

Training code and data collection plugins are open source, so you can train your own model. The production models are closed source. An inference API that takes the same inputs is coming soon.

## Input format

One row per server tick, 55 features:

```
tick pos_x pos_y pos_z delta_pos_x delta_pos_y delta_pos_z vel_x vel_y vel_z delta_vel_x delta_vel_y delta_vel_z
yaw pitch delta_yaw delta_pitch on_ground is_sneaking is_sprinting is_swimming in_water on_ladder is_elytra_flying
has_riptide is_riptide_charging active_potion_effects attribute_modified_list armor_items_enchantments held_slot
held_item offhand_item totem_count delta_item_change_tick hit_entity_type hit_entity_distance hit_yaw_diff
hit_pitch_diff damage_dealt attack_cooldown is_critical_hit last_place_tick last_break_tick placed_block broken_block
place_break_delta server_tps ping delta_ping tick_alignment_ms packets_freq delta_packets_freq delta_mouse_yaw
delta_mouse_pitch last_key_press_delta_ms
```

- `data/real_sample.txt`: real rows (ticks 4375 - 4397, player standing still).
- `src/sim.js`: simulator that continues from tick 4398 and produces the same 55 columns for a 40-tick scenario: idle, hotbar switch to a diamond sword, sprint, sprint-jump, second jump, W-tap, falling critical hit on a zombie. It uses vanilla-like physics (jump 0.42, gravity `(v - 0.08) * 0.98`, grounded `vel_y = -0.0784`). The `SingularitySim.toTSV(SingularitySim.simulate())` helper dumps the rows.

## Run it

**Preview in a browser:** open `index.html` (no server needed). The controls are play/pause, scrub, and **Record WebM** (a realtime capture of the canvas).

**Frame-exact MP4 (1920x1080, 60 fps):**

```bash
npm install          # installs puppeteer (headless Chrome)
npm run render       # needs ffmpeg on PATH -> singularity.mp4
```

**GitHub Actions:** every push to `main` runs `.github/workflows/render.yml`. It renders the MP4 and uploads it as the `singularity-video` artifact on the workflow run.

## Files

```
index.html                   canvas + preview controls
src/sim.js                   55-feature tick simulator
src/video.js                 all scenes, renderFrame(t)
src/player.js                preview loop + WebM recorder
render.mjs                   puppeteer + ffmpeg MP4 export
data/real_sample.txt         real captured rows
.github/workflows/render.yml CI render -> artifact
```
