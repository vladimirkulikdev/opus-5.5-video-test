/* Browser preview + realtime WebM recorder. For a frame-exact MP4 use `npm run render`. */
(function () {
  'use strict';
  const renderMode = new URLSearchParams(location.search).has('render');
  if (renderMode) { document.body.classList.add('render'); window.renderFrame(0); return; }

  const DURATION = window.VIDEO.DURATION;
  const $ = id => document.getElementById(id);
  let t = 0, playing = true, last = performance.now();
  let recorder = null, chunks = [];

  function stopRec() { if (recorder && recorder.state !== 'inactive') recorder.stop(); playing = false; $('play').textContent = 'Play'; }

  function startRec() {
    if (recorder) return;
    const stream = $('c').captureStream(60);
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 40e6 });
    chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'singularity.webm'; a.click();
      recorder = null; $('rec').textContent = 'Record WebM';
    };
    t = 0; playing = true; $('play').textContent = 'Pause';
    recorder.start();
    $('rec').textContent = 'Recording...';
  }

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) {
      t += dt;
      if (t >= DURATION) {
        if (recorder) { t = DURATION - 1e-3; stopRec(); }
        else t = t % DURATION;
      }
    }
    window.renderFrame(Math.min(t, DURATION - 1e-3));
    $('scrub').value = String(Math.round(t / DURATION * 1000));
    $('time').textContent = t.toFixed(2) + 's / ' + DURATION.toFixed(1) + 's';
    requestAnimationFrame(loop);
  }

  $('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
  $('restart').onclick = () => { t = 0; };
  $('scrub').oninput = e => { t = e.target.value / 1000 * DURATION; };
  $('rec').onclick = startRec;
  requestAnimationFrame(loop);
})();
