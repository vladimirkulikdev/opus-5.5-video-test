# opus-5.5-video-test

A ~49 second monochrome explainer video for **Singularity**, a machine-learning anticheat for Minecraft.
It is written in plain JavaScript on a single 1920x1080 canvas. No colour: white lines on black, with an
Interstellar-style black hole as the visual theme.

## Watch / export

- **Watch:** open `index.html` in Chrome (double click works, no server needed).
- **Quick export:** click **Record WebM**. The video plays once in real time and downloads `singularity.webm`.
- **Frame-exact MP4 (60 fps):** `npm install && npm run render` (needs `ffmpeg` on PATH). Writes `singularity.mp4`.
- Jump to a time: `index.html?t=12`.

## Timeline

| # | Scene | What it shows |
|---|-------|---------------|
| 00 | Intro | Black hole, title |
| 01 | What the model sees | 2 s simulated clip (40 ticks at 20 TPS). The player is fully transparent, drawn only as white outlines, plus hitbox, look ray, movement vector, live feature panel and the raw input stream |
| 02 | One tick, one vector | The 55 features of the hit tick collapse into one input vector; a window of ticks becomes a sequence |
| 03 | LSTM cell | Standard LSTM cell diagram: forget, input, candidate, cell state, output |
| 04 | Forward LSTM | Unrolled LSTM reading the window past to future |
| 05 | Backward LSTM | Second LSTM reading future to past; outputs concatenated per tick |
| 06 | Bahdanau attention | Additive attention weights over the BiLSTM outputs, context vector, output (illustrative) |
| 07 | Three models | Graviton 2.77M (BiLSTM + Bahdanau), Event Horizon 10M (BiLSTM + multi-head attention), Singularity 100M (Transformer + multi-head attention) |
| 08 | Open training, closed models | Training code and data collection plugins are open source; production models are closed; inference API coming soon |
| 09 | Outro | Black hole, title |

## Data

- `src/data.js` holds the 55-column input schema and the real captured rows (ticks 4375-4397, an idle player).
- The clip is **simulated** with the same schema, continuing from tick 4398: the player swaps to a sword,
  walks, sprints, sprint-jumps, snaps aim onto a zombie (tick 4426) and lands a falling crit hit (tick 4430).
  Physics follow vanilla constants (gravity 0.08, drag 0.98, jump 0.42, ground friction 0.546).
- The model output in scene 06 is illustrative only; it is not produced by a real model.

## Files

```
index.html          page + controls
src/util.js         helpers (easing, text, animated polylines, token grids)
src/data.js         schema, real rows, simulator, attention weights
src/blackhole.js    monochrome black hole + star field
src/player.js       3D wireframe player / zombie renderer and live feature panel
src/scenes.js       all scenes and the timeline
src/main.js         playback, grain/vignette overlays, WebM recording
scripts/render.mjs  headless frame-exact MP4 render
```
