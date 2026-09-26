/* Timeline playback, overlays (grain, vignette, HUD), and WebM export. */
(function (SV) {
  const { W, H } = SV;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  SV.canvas = canvas;

  const scenes = SV.SCENES;
  const starts = [];
  let total = 0;
  for (const s of scenes) { starts.push(total); total += s.dur; }
  SV.TOTAL = total;
  const FADE = 0.4;

  // film grain tiles (monochrome)
  const grain = [];
  const gr = SV.rng(7);
  for (let g = 0; g < 4; g++) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const gx = c.getContext('2d');
    const img = gx.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = gr() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 14;
    }
    gx.putImageData(img, 0, 0);
    grain.push(c);
  }
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.75)');

  function overlays(T) {
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    const tile = grain[Math.floor(T * 24) % grain.length];
    for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) ctx.drawImage(tile, x, y);
    SV.text(ctx, 'SINGULARITY · ML ANTICHEAT FOR MINECRAFT', W - 60, 60, { size: 14, align: 'right', alpha: 0.35, spacing: 3 });
    SV.text(ctx, `T+${T.toFixed(2).padStart(5, '0')}s`, W - 60, H - 30, { size: 14, align: 'right', alpha: 0.35 });
    ctx.strokeStyle = SV.white(0.3);
    ctx.lineWidth = 1;
    for (const [x, y, sx, sy] of [[30, 30, 1, 1], [W - 30, 30, -1, 1], [30, H - 30, 1, -1], [W - 30, H - 30, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * 24, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + sy * 24);
      ctx.stroke();
    }
  }

  function renderAt(T) {
    T = SV.clamp(T, 0, total - 1e-6);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    let k = 0;
    while (k < scenes.length - 1 && T >= starts[k + 1]) k++;
    const s = scenes[k];
    const lt = T - starts[k];
    ctx.save();
    s.draw(ctx, lt, s.dur);
    ctx.restore();
    const env = Math.min(SV.clamp(lt / FADE), SV.clamp((s.dur - lt) / FADE));
    if (env < 1) {
      ctx.fillStyle = SV.black(1 - env);
      ctx.fillRect(0, 0, W, H);
    }
    overlays(T);
  }
  SV.renderAt = renderAt;

  // ---- playback UI ----
  const params = new URLSearchParams(location.search);
  const headless = params.has('headless');
  if (headless) document.body.classList.add('headless');
  const $ = (id) => document.getElementById(id);
  const playBtn = $('play'), restartBtn = $('restart'), recBtn = $('record'), scrub = $('scrub'), timeEl = $('time'), status = $('status');
  scrub.max = total.toFixed(3);

  let playing = !headless;
  let cur = SV.clamp(parseFloat(params.get('t')) || 0, 0, total);
  let last = performance.now();
  let recorder = null;
  let chunks = [];

  function setPlaying(v) {
    playing = v;
    playBtn.textContent = v ? 'Pause' : 'Play';
  }

  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (!recorder) dt = Math.min(dt, 0.25);
    if (playing) {
      cur += dt;
      if (cur >= total) {
        if (recorder) { cur = total; stopRecording(); }
        else cur %= total;
      }
    }
    renderAt(cur);
    scrub.value = cur;
    timeEl.textContent = `${cur.toFixed(1)} / ${total.toFixed(1)} s`;
    requestAnimationFrame(loop);
  }

  function startRecording() {
    if (!canvas.captureStream || !window.MediaRecorder) {
      status.textContent = 'Recording is not supported in this browser. Use "npm run render" instead.';
      return;
    }
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = types.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const stream = canvas.captureStream(60);
    recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 20000000 } : { videoBitsPerSecond: 20000000 });
    chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'singularity.webm';
      a.click();
      status.textContent = `Saved singularity.webm (${(blob.size / 1e6).toFixed(1)} MB).`;
      recorder = null;
      recBtn.textContent = 'Record WebM';
    };
    cur = 0;
    last = performance.now();
    setPlaying(true);
    renderAt(0);
    recorder.start(250);
    recBtn.textContent = 'Recording...';
    status.textContent = 'Recording in real time. Keep this tab visible until the download starts.';
  }

  function stopRecording() {
    setPlaying(false);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  playBtn.onclick = () => setPlaying(!playing);
  restartBtn.onclick = () => { cur = 0; setPlaying(true); };
  recBtn.onclick = () => { if (!recorder) startRecording(); };
  scrub.oninput = () => { cur = parseFloat(scrub.value); };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    if (e.key === 'r' || e.key === 'R') { cur = 0; setPlaying(true); }
  });

  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => {
    SV.ready = true;
    renderAt(cur);
    if (!headless) requestAnimationFrame((now) => { last = now; loop(now); });
  });
})(window.SV);
