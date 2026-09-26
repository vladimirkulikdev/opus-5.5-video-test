/* The timeline. Each scene gets (ctx, localTime, duration). All drawing is white on black. */
(function (SV) {
  const { W, H } = SV;

  // ---------- 00 intro ----------
  function intro(ctx, t) {
    SV.drawStars(ctx, t, 1);
    const R = 150 + 12 * SV.easeOut(SV.clamp(t / 4.5));
    SV.drawBlackHole(ctx, { cx: W / 2, cy: H / 2 - 70, R, t: t + 10, alpha: SV.ease(SV.clamp(t / 1.4)) });
    const p = SV.ease(SV.prog(t, 1.3, 1.3));
    SV.text(ctx, 'SINGULARITY', W / 2, H - 190, { size: 88, weight: 300, align: 'center', alpha: p, spacing: SV.lerp(60, 26, p) });
    SV.text(ctx, 'a machine-learning anticheat for minecraft', W / 2, H - 132, { size: 24, align: 'center', alpha: 0.6 * SV.ease(SV.prog(t, 2.1, 1)) });
  }

  // ---------- 01 the clip ----------
  function clipScene(ctx, t) {
    const tau = SV.clamp((t - 0.5) / 2.0) * (SV.SIM.length - 1);
    SV.drawStars(ctx, t, 0.25);
    SV.drawClip(ctx, tau, t);
    SV.header(ctx, '01', 'WHAT THE MODEL SEES', 'simulated 2 s clip · 40 ticks at 20 TPS · outlines only', t);
  }

  // ---------- 02 one tick -> one vector ----------
  function features(ctx, t) {
    const row = SV.SIM[SV.HIT_INDEX];
    const vals = SV.rowToArray(row);
    const vec = SV.featVec(row);
    SV.drawStars(ctx, t, 0.3);
    SV.header(ctx, '02', 'ONE TICK, ONE VECTOR', `tick ${row.tick} (the hit) · 55 raw features`, t);
    const cols = 5, cw = 345, rh = 58, gx = 90, gy = 225;
    const q = SV.ease(SV.prog(t, 2.2, 1.0));
    const tokX = 1600, tokY = 540, cell = 22;
    for (let k = 0; k < 55; k++) {
      const c = k % cols, r = Math.floor(k / cols);
      const appear = SV.ease(SV.prog(t, 0.25 + k * 0.022, 0.3));
      if (appear <= 0) continue;
      const x = SV.lerp(gx + c * cw, tokX - 2.5 * cell + c * cell, q);
      const y = SV.lerp(gy + r * rh, tokY - 5.5 * cell + r * cell, q);
      const v = Math.abs(vec[k]);
      if (q < 1) {
        SV.text(ctx, SV.HEADER[k], x, y, { size: 14, alpha: 0.45 * appear * (1 - q) });
        SV.text(ctx, vals[k], x, y + 25, { size: 21, weight: 500, alpha: (v > 0.01 ? 1 : 0.45) * appear * (1 - q) });
      }
      if (q > 0) {
        const sz = (cell - 3) * q;
        ctx.fillStyle = SV.white((0.07 + 0.93 * v) * q);
        ctx.fillRect(x, y, sz, sz);
      }
    }
    const la = SV.ease(SV.prog(t, 3.0, 0.6));
    if (la > 0) {
      ctx.strokeStyle = SV.white(0.5 * la);
      ctx.lineWidth = 1;
      ctx.strokeRect(tokX - 2.5 * cell - 6, tokY - 5.5 * cell - 6, 5 * cell + 9, 11 * cell + 9);
      SV.text(ctx, 'xₜ ∈ ℝ⁵⁵', tokX + 25, tokY + 5.5 * cell + 60, { size: 26, align: 'center', alpha: la });
      SV.text(ctx, `tick ${row.tick}`, tokX + 25, tokY + 5.5 * cell + 90, { size: 16, align: 'center', alpha: 0.5 * la });
    }
    let lastX = tokX;
    for (let j = 1; j <= 7; j++) {
      const a = SV.ease(SV.prog(t, 3.2 + j * 0.12, 0.4));
      if (a <= 0) continue;
      const r2 = SV.SIM[SV.HIT_INDEX - j];
      const x = tokX - 150 - (j - 1) * 118 + (1 - a) * 40;
      lastX = x;
      SV.drawToken(ctx, x, tokY + 25, SV.featVec(r2), a * 0.8, 14);
      SV.text(ctx, String(r2.tick), x, tokY + 130, { size: 13, align: 'center', alpha: 0.5 * a });
    }
    const ba = SV.ease(SV.prog(t, 3.9, 0.5));
    if (ba > 0) {
      ctx.strokeStyle = SV.white(0.5 * ba);
      ctx.beginPath();
      ctx.moveTo(lastX - 40, tokY + 150);
      ctx.lineTo(lastX - 40, tokY + 160);
      ctx.lineTo(tokX + 70, tokY + 160);
      ctx.lineTo(tokX + 70, tokY + 150);
      ctx.stroke();
    }
    if (t < 2.4) SV.caption(ctx, 'movement · rotation · state flags · inventory · combat · blocks · network · input timing', t, 0.8, 960);
    else SV.caption(ctx, 'a sliding window of ticks becomes one sequence for the network', t, 3.6, 960);
  }

  // ---------- 03 the LSTM cell ----------
  function cellGeom(x, y, w, h) {
    const X = (f) => x + f * w, Y = (f) => y + f * h, bus = Y(0.86), top = Y(0.16);
    return {
      box: [x, y, w, h],
      paths: {
        cell: [[x - 110, top], [x + w + 110, top]],
        hin: [[x - 110, bus], [X(0.66), bus]],
        xin: [[X(0.1), y + h + 80], [X(0.1), bus]],
        fUp: [[X(0.22), bus], [X(0.22), top]],
        iUp: [[X(0.38), bus], [X(0.38), Y(0.4)], [X(0.52), Y(0.4)]],
        gUp: [[X(0.52), bus], [X(0.52), Y(0.4)]],
        iAdd: [[X(0.52), Y(0.4)], [X(0.52), top]],
        oUp: [[X(0.66), bus], [X(0.66), Y(0.58)], [X(0.8), Y(0.58)]],
        cTanh: [[X(0.8), top], [X(0.8), Y(0.34)]],
        tanhO: [[X(0.8), Y(0.34)], [X(0.8), Y(0.58)]],
        hout: [[X(0.8), Y(0.58)], [X(0.8), bus], [x + w + 110, bus]],
        hup: [[X(0.92), bus], [X(0.92), y - 80]],
      },
      arrows: ['cell', 'hout', 'hup'],
      nodes: {
        fMul: [X(0.22), top, '×', 'op'],
        add: [X(0.52), top, '+', 'op'],
        iMul: [X(0.52), Y(0.4), '×', 'op'],
        tanhC: [X(0.8), Y(0.34), 'tanh', 'ell'],
        oMul: [X(0.8), Y(0.58), '×', 'op'],
        f: [X(0.22), Y(0.66), 'σ', 'gate', 'f'],
        i: [X(0.38), Y(0.66), 'σ', 'gate', 'i'],
        g: [X(0.52), Y(0.66), 'tanh', 'gate', 'C̃'],
        o: [X(0.66), Y(0.66), 'σ', 'gate', 'o'],
      },
      labels: [
        ['Cₜ₋₁', x - 125, top, 'right'], ['Cₜ', x + w + 125, top, 'left'],
        ['hₜ₋₁', x - 125, bus, 'right'], ['hₜ', x + w + 125, bus, 'left'],
        ['hₜ', X(0.92), y - 100, 'center'], ['xₜ', X(0.1), y + h + 108, 'center'],
      ],
    };
  }

  const STAGES = [
    { name: 'FORGET GATE', eq: 'fₜ = σ(W_f · [hₜ₋₁, xₜ] + b_f)', note: 'what to drop from memory', paths: ['hin', 'xin', 'fUp'], nodes: ['f', 'fMul'] },
    { name: 'INPUT GATE', eq: 'iₜ = σ(W_i · [hₜ₋₁, xₜ] + b_i)', note: 'how much new information to let in', paths: ['hin', 'xin', 'iUp'], nodes: ['i', 'iMul'] },
    { name: 'CANDIDATE', eq: 'C̃ₜ = tanh(W_C · [hₜ₋₁, xₜ] + b_C)', note: 'the proposed new memory', paths: ['hin', 'xin', 'gUp', 'iAdd'], nodes: ['g', 'iMul', 'add'] },
    { name: 'CELL STATE', eq: 'Cₜ = fₜ ⊙ Cₜ₋₁ + iₜ ⊙ C̃ₜ', note: 'long-term memory carried from tick to tick', paths: ['cell'], nodes: ['fMul', 'add'] },
    { name: 'OUTPUT GATE', eq: 'hₜ = oₜ ⊙ tanh(Cₜ)', note: 'what this tick passes on', paths: ['hin', 'xin', 'oUp', 'cTanh', 'tanhO', 'hout', 'hup'], nodes: ['o', 'tanhC', 'oMul'] },
  ];

  function node(ctx, x, y, label, kind, a) {
    ctx.fillStyle = '#000';
    ctx.strokeStyle = SV.white(a);
    ctx.lineWidth = a > 0.9 ? 2.5 : 1.8;
    ctx.beginPath();
    if (kind === 'op') ctx.arc(x, y, 20, 0, Math.PI * 2);
    else if (kind === 'gate') SV.roundRect(ctx, x - 38, y - 24, 76, 48, 6);
    else ctx.ellipse(x, y, 42, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    SV.text(ctx, label, x, y + 1, { size: kind === 'op' ? 26 : 20, align: 'center', baseline: 'middle', alpha: a });
  }

  function lstmCell(ctx, t) {
    SV.drawStars(ctx, t, 0.35);
    SV.drawBlackHole(ctx, { cx: W / 2, cy: H / 2, R: 260, t: t + 40, alpha: 0.07 });
    SV.header(ctx, '03', 'THE LSTM CELL', 'long short-term memory · one step per tick', t);
    const G = cellGeom(560, 250, 800, 520);
    const dp = SV.ease(SV.prog(t, 0.2, 1.6));
    const T0 = 1.9, SD = 0.78;
    const stage = t < T0 ? -1 : Math.min(4, Math.floor((t - T0) / SD));
    const sp = t < T0 ? 0 : t - T0 >= 5 * SD ? 1 : ((t - T0) / SD) % 1;
    const S = stage >= 0 ? STAGES[stage] : null;

    const [bx, by, bw, bh] = G.box;
    ctx.strokeStyle = SV.white(0.22 * dp);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    SV.roundRect(ctx, bx, by, bw, bh, 18);
    ctx.stroke();

    for (const name in G.paths) {
      const hl = S && S.paths.includes(name);
      SV.drawPoly(ctx, G.paths[name], dp, hl ? 1 : 0.35, hl ? 3 : 1.5, G.arrows.includes(name));
    }
    const na = SV.ease(SV.prog(t, 1.0, 0.6));
    for (const name in G.nodes) {
      const [x, y, label, kind, sub] = G.nodes[name];
      const hl = S && S.nodes.includes(name);
      node(ctx, x, y, label, kind, na * (hl ? 1 : 0.55));
      if (sub) SV.text(ctx, sub, x, y + 46, { size: 16, align: 'center', alpha: na * (hl ? 1 : 0.4) });
    }
    if (S) for (const name of S.paths) SV.pulse(ctx, G.paths[name], SV.ease(sp));
    for (const [str, x, y, align] of G.labels) SV.text(ctx, str, x, y + 7, { size: 22, align, alpha: 0.8 * na });

    if (S) {
      const a = SV.ease(SV.clamp(sp * 4));
      SV.text(ctx, S.name, W / 2, 935, { size: 26, weight: 600, align: 'center', alpha: a, spacing: 6 });
      SV.text(ctx, S.eq, W / 2, 978, { size: 26, align: 'center', alpha: a });
      SV.text(ctx, S.note, W / 2, 1015, { size: 19, align: 'center', alpha: 0.55 * a });
    } else {
      SV.caption(ctx, 'each tick xₜ updates a memory Cₜ and a hidden state hₜ', t, 0.6, 975);
    }
  }

  // ---------- 04 / 05 forward and backward LSTM ----------
  const SEQ_T = 7, BW = 110, BH = 56;
  const SX = (i) => W / 2 + (i - 3) * 215;
  const Y_OUT = 300, Y_F = 500, Y_B = 660, Y_IN = 860;

  function lstmBox(ctx, x, y, label, a) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    SV.roundRect(ctx, x - BW / 2, y - BH / 2, BW, BH, 8);
    ctx.fill();
    if (a > 0.9) {
      ctx.strokeStyle = SV.white(0.15);
      ctx.lineWidth = 9;
      ctx.stroke();
    }
    ctx.strokeStyle = SV.white(a);
    ctx.lineWidth = a > 0.9 ? 2.5 : 1.5;
    ctx.stroke();
    SV.text(ctx, label, x, y + 1, { size: 18, align: 'center', baseline: 'middle', alpha: Math.max(0.3, a) });
  }

  const stateOf = (s, order) => (s >= order + 1 ? 2 : s > order ? 1 : 0); // 0 idle, 1 active, 2 done
  const STATE_A = [0.22, 1, 0.7];

  function eventLabel(r) {
    if (r.hit_entity_type !== 'NONE') return r.is_critical_hit ? 'CRIT HIT' : 'HIT';
    if (Math.abs(r.delta_yaw) > 10) return 'SNAP';
    return '';
  }

  function bilstm(ctx, t, mode) {
    const fwd = mode === 'fwd';
    SV.drawStars(ctx, t, 0.35);
    if (fwd) SV.header(ctx, '04', 'FORWARD LSTM', 'reads the tick window past → future', t);
    else SV.header(ctx, '05', 'BACKWARD LSTM', 'a second LSTM reads the same window future → past', t);
    const sF = fwd ? SV.prog(t, 0.6, 2.6) * SEQ_T : SEQ_T;
    const sB = fwd ? 0 : SV.prog(t, 0.5, 2.6) * SEQ_T;
    const outP = fwd ? 0 : SV.ease(SV.prog(t, 3.3, 0.9));
    const ticks = SV.SEQ.map((i) => SV.SIM[i]);

    SV.text(ctx, 'FORWARD →', 40, Y_F + 6, { size: 16, alpha: 0.6 });
    if (!fwd) SV.text(ctx, 'BACKWARD ←', 40, Y_B + 6, { size: 16, alpha: 0.6 });
    SV.text(ctx, 'INPUT xₜ', 40, Y_IN + 6, { size: 16, alpha: 0.6 });
    if (outP > 0) SV.text(ctx, 'OUTPUT', 40, Y_OUT + 6, { size: 16, alpha: 0.6 * outP });

    // connections (drawn first so boxes sit on top)
    for (let i = 0; i < SEQ_T; i++) {
      const x = SX(i);
      const stF = stateOf(sF, i);
      SV.drawPoly(ctx, [[x - 16, Y_IN - 45], [x - 16, Y_F + BH / 2]], 1, fwd ? (stF ? 0.85 : 0.2) : 0.3, 1.5);
      if (!fwd) {
        const stB = stateOf(sB, SEQ_T - 1 - i);
        SV.drawPoly(ctx, [[x + 16, Y_IN - 45], [x + 16, Y_B + BH / 2]], 1, stB ? 0.85 : 0.2, 1.5);
      }
      if (outP > 0) {
        SV.drawPoly(ctx, [[x - 16, Y_F - BH / 2], [x - 16, Y_OUT + 42]], outP, 0.7, 1.5);
        SV.drawPoly(ctx, [[x + 16, Y_B - BH / 2], [x + 16, Y_OUT + 42]], outP, 0.7, 1.5);
      }
    }
    SV.drawPoly(ctx, [[SX(0) - BW / 2 - 80, Y_F], [SX(0) - BW / 2, Y_F]], 1, 0.6, 1.5, true);
    SV.text(ctx, 'h₀', SX(0) - BW / 2 - 95, Y_F + 7, { size: 18, align: 'right', alpha: 0.6 });
    for (let i = 0; i < SEQ_T - 1; i++) {
      const p = fwd ? SV.clamp((sF - i - 0.6) * 2.5) : 1;
      SV.drawPoly(ctx, [[SX(i) + BW / 2, Y_F], [SX(i + 1) - BW / 2, Y_F]], p, fwd ? 0.9 : 0.45, 2, true);
    }
    if (!fwd) {
      SV.drawPoly(ctx, [[SX(SEQ_T - 1) + BW / 2 + 80, Y_B], [SX(SEQ_T - 1) + BW / 2, Y_B]], 1, 0.6, 1.5, true);
      SV.text(ctx, 'h₀', SX(SEQ_T - 1) + BW / 2 + 95, Y_B + 7, { size: 18, alpha: 0.6 });
      for (let i = 0; i < SEQ_T - 1; i++) {
        const p = SV.clamp((sB - (SEQ_T - 2 - i) - 0.6) * 2.5);
        SV.drawPoly(ctx, [[SX(i + 1) - BW / 2, Y_B], [SX(i) + BW / 2, Y_B]], p, 0.9, 2, true);
      }
    }

    // boxes
    for (let i = 0; i < SEQ_T; i++) {
      lstmBox(ctx, SX(i), Y_F, 'LSTM →', fwd ? STATE_A[stateOf(sF, i)] : 0.5);
      if (!fwd) lstmBox(ctx, SX(i), Y_B, 'LSTM ←', STATE_A[stateOf(sB, SEQ_T - 1 - i)]);
    }
    if (fwd && sF > 0 && sF < SEQ_T) SV.glowDot(ctx, SX(0) + (sF - 0.5) * 215, Y_F, 1, 26);
    if (!fwd && sB > 0 && sB < SEQ_T) SV.glowDot(ctx, SX(SEQ_T - 1) - (sB - 0.5) * 215, Y_B, 1, 26);

    // inputs
    ticks.forEach((r, i) => {
      const x = SX(i);
      SV.drawToken(ctx, x, Y_IN, SV.featVec(r), 0.9, 7);
      SV.text(ctx, String(r.tick), x, Y_IN + 68, { size: 14, align: 'center', alpha: 0.55 });
      const ev = eventLabel(r);
      if (ev) SV.text(ctx, ev, x, Y_IN + 90, { size: 14, weight: 600, align: 'center', alpha: 0.95, spacing: 2 });
    });

    // concatenated outputs
    if (outP > 0) {
      for (let i = 0; i < SEQ_T; i++) {
        SV.drawColumn(ctx, SX(i) - 12, Y_OUT, SV.hidden(i, 1), outP, 14, 9);
        SV.drawColumn(ctx, SX(i) + 12, Y_OUT, SV.hidden(i, 2), outP, 14, 9);
      }
      SV.text(ctx, '[ h→ ; h← ]  one output per tick', W / 2, Y_OUT - 62, { size: 18, align: 'center', alpha: 0.7 * outP });
    }

    if (fwd) SV.caption(ctx, 'h→ at each tick summarises every earlier tick', t, 1.2);
    else SV.caption(ctx, 'h← summarises every later tick · together each tick sees the whole window', t, 1.2);
  }

  // ---------- 06 Bahdanau attention ----------
  function attention(ctx, t) {
    SV.drawStars(ctx, t, 0.35);
    SV.header(ctx, '06', 'BAHDANAU ATTENTION', 'graviton · additive attention over the BiLSTM outputs', t);
    const AX = (i) => 760 + (i - 3) * 165;
    const yS = 600, yBar = 930, cx = 760, cy = 330;
    const att = SV.ATT, amax = Math.max(...att);
    const fa = SV.ease(SV.prog(t, 0.3, 0.8));
    const pb = SV.ease(SV.prog(t, 0.6, 1.2));
    const pl = SV.ease(SV.prog(t, 1.5, 1.0));
    const po = SV.ease(SV.prog(t, 2.5, 0.8));
    const pr = SV.easeOut(SV.prog(t, 3.1, 1.3));

    SV.text(ctx, 'eₜ = vᵀ tanh(W₁hₜ + W₂s)', 80, 235, { size: 24, alpha: fa });
    SV.text(ctx, 'αₜ = softmax(eₜ)', 80, 275, { size: 24, alpha: fa });
    SV.text(ctx, 'c  = Σ αₜ hₜ', 80, 315, { size: 24, alpha: fa });

    for (let i = 0; i < SEQ_T; i++) {
      const w = att[i] / amax;
      SV.drawPoly(ctx, [[AX(i), yS - 48], [cx, cy + 36]], pl, 0.12 + 0.88 * w, 1 + 10 * w);
    }
    for (let i = 0; i < SEQ_T; i++) {
      const x = AX(i), r = SV.SIM[SV.SEQ[i]];
      SV.drawColumn(ctx, x - 10, yS, SV.hidden(i, 1), 0.9, 14, 9);
      SV.drawColumn(ctx, x + 10, yS, SV.hidden(i, 2), 0.9, 14, 9);
      const h = 190 * (att[i] / amax) * pb;
      ctx.fillStyle = SV.white(0.14);
      ctx.fillRect(x - 22, yBar - h, 44, h);
      ctx.strokeStyle = SV.white(0.85);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 22, yBar - h, 44, h);
      SV.text(ctx, (att[i] * pb).toFixed(2), x, yBar - h - 12, { size: 16, align: 'center', alpha: 0.9 * pb });
      SV.text(ctx, String(r.tick), x, yBar + 26, { size: 14, align: 'center', alpha: 0.55 });
      const ev = eventLabel(r);
      if (ev) SV.text(ctx, ev, x, yBar + 48, { size: 14, weight: 600, align: 'center', alpha: 0.95, spacing: 2 });
    }
    SV.text(ctx, 'α', AX(0) - 70, yBar - 8, { size: 22, alpha: 0.6 * pb });

    if (pl > 0.6) {
      const a = SV.clamp((pl - 0.6) / 0.4);
      ctx.fillStyle = '#000';
      ctx.strokeStyle = SV.white(a);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      SV.text(ctx, 'c', cx, cy + 2, { size: 28, align: 'center', baseline: 'middle', alpha: a });
      SV.text(ctx, 'context', cx, cy - 50, { size: 15, align: 'center', alpha: 0.5 * a });
    }
    if (po > 0) {
      SV.drawPoly(ctx, [[cx + 34, cy], [1180, cy]], po, 0.9, 2, true);
      const a = SV.clamp((po - 0.5) * 2);
      if (a > 0) {
        ctx.strokeStyle = SV.white(a);
        ctx.lineWidth = 2;
        ctx.strokeRect(1180, cy - 35, 220, 70);
        SV.text(ctx, 'DENSE · σ', 1290, cy + 2, { size: 20, align: 'center', baseline: 'middle', alpha: a, spacing: 2 });
        SV.drawPoly(ctx, [[1400, cy], [1490, cy]], a, 0.9, 2, true);
      }
    }
    if (pr > 0) {
      SV.text(ctx, 'P(cheat)', 1510, cy - 30, { size: 18, alpha: 0.6 * pr });
      SV.text(ctx, (0.94 * pr).toFixed(2), 1510, cy + 38, { size: 64, weight: 300, alpha: pr });
      ctx.strokeStyle = SV.white(0.4 * pr);
      ctx.lineWidth = 1;
      ctx.strokeRect(1510, cy + 62, 320, 10);
      ctx.fillStyle = SV.white(0.9 * pr);
      ctx.fillRect(1510, cy + 62, 320 * 0.94 * pr, 10);
    }
    const va = SV.ease(SV.prog(t, 4.2, 0.5));
    SV.text(ctx, 'FLAG', 1670, cy + 160, { size: 44, weight: 700, align: 'center', alpha: va, spacing: 14 });
    SV.text(ctx, 'illustrative output on simulated data', 1670, cy + 195, { size: 14, align: 'center', alpha: 0.45 * va });
    SV.caption(ctx, 'attention peaks on the aim snap and the crit hit', t, 2.2, 1040);
  }

  // ---------- 07 the three models ----------
  const MODELS = [
    { name: 'GRAVITON', params: 2.77, arch: ['BiLSTM', '+ Bahdanau attention'], R: 24, kind: 'bahdanau' },
    { name: 'EVENT HORIZON', params: 10, arch: ['BiLSTM', '+ multi-head attention'], R: 36, kind: 'mha' },
    { name: 'SINGULARITY', params: 100, arch: ['Transformer', '+ multi-head attention'], R: 54, kind: 'transformer' },
  ];

  function archGlyph(ctx, cx, y, kind, a, t) {
    const n = 6, gap = 60;
    const xs = Array.from({ length: n }, (_, j) => cx + (j - 2.5) * gap);
    if (kind !== 'transformer') {
      for (let j = 0; j < n - 1; j++) {
        SV.drawPoly(ctx, [[xs[j] + 9, y + 22], [xs[j + 1] - 9, y + 22]], 1, 0.6 * a, 1.2, true);
        SV.drawPoly(ctx, [[xs[j + 1] - 9, y + 40], [xs[j] + 9, y + 40]], 1, 0.6 * a, 1.2, true);
      }
    }
    const heads = kind === 'bahdanau' ? 1 : kind === 'mha' ? 3 : 0;
    ctx.lineWidth = 1.2;
    for (let h = 0; h < heads; h++) {
      const qx = cx + (h - (heads - 1) / 2) * 80, qy = y - 58;
      for (let j = 0; j < n; j++) {
        const w = 0.5 + 0.5 * Math.sin(t * 2.2 + j * 1.3 + h * 2.1);
        ctx.strokeStyle = SV.white(a * (0.12 + 0.6 * w));
        ctx.beginPath();
        ctx.moveTo(xs[j], y - 6);
        ctx.lineTo(qx, qy);
        ctx.stroke();
      }
      ctx.fillStyle = '#000';
      ctx.strokeStyle = SV.white(a);
      ctx.beginPath();
      ctx.arc(qx, qy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (kind === 'transformer') {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const w = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7 + j * 0.9);
          ctx.strokeStyle = SV.white(a * (0.1 + 0.55 * w));
          ctx.beginPath();
          ctx.moveTo(xs[i], y - 6);
          ctx.quadraticCurveTo((xs[i] + xs[j]) / 2, y - 6 - (j - i) * 22, xs[j], y - 6);
          ctx.stroke();
        }
      }
    }
    for (const x of xs) {
      ctx.fillStyle = '#000';
      ctx.strokeStyle = SV.white(a);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function models(ctx, t) {
    SV.drawStars(ctx, t, 0.5);
    SV.header(ctx, '07', 'THREE MODELS', 'same 55 inputs · three sizes', t);
    MODELS.forEach((m, k) => {
      const cx = W / 2 + (k - 1) * 540, top = 225, cw = 470, ch = 660;
      const a = SV.ease(SV.prog(t, 0.4 + k * 0.45, 0.7));
      if (a <= 0) return;
      ctx.save();
      ctx.translate(0, (1 - a) * 40);
      ctx.strokeStyle = SV.white(0.3 * a);
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - cw / 2, top, cw, ch);
      ctx.strokeStyle = SV.white(0.9 * a);
      ctx.lineWidth = 2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = cx + (sx * cw) / 2, y = top + (sy > 0 ? ch : 0);
        ctx.beginPath();
        ctx.moveTo(x - sx * 18, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y - sy * 18);
        ctx.stroke();
      }
      SV.drawBlackHole(ctx, { cx, cy: top + 150, R: m.R, t: t * 1.5 + k * 7, alpha: a, spin: 1.6 });
      SV.text(ctx, m.name, cx, top + 320, { size: 32, weight: 600, align: 'center', alpha: a, spacing: 6 });
      const cnt = m.params * SV.easeOut(SV.prog(t, 0.6 + k * 0.45, 1.4));
      const txt = (m.params < 10 ? cnt.toFixed(2) : String(Math.round(cnt))) + 'M';
      SV.text(ctx, txt, cx, top + 395, { size: 56, weight: 300, align: 'center', alpha: a });
      SV.text(ctx, 'parameters', cx, top + 425, { size: 16, align: 'center', alpha: 0.5 * a });
      SV.text(ctx, m.arch[0], cx, top + 475, { size: 24, align: 'center', alpha: 0.9 * a });
      SV.text(ctx, m.arch[1], cx, top + 505, { size: 20, align: 'center', alpha: 0.6 * a });
      archGlyph(ctx, cx, top + 600, m.kind, a, t);
      ctx.restore();
    });
    SV.caption(ctx, 'bigger model · more context · same per-tick inputs', t, 2.2, 1000);
  }

  // ---------- 08 open training, closed models, API soon ----------
  function padlock(ctx, x, y, open, a) {
    ctx.strokeStyle = SV.white(a);
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x - 16, y - 4, 32, 26);
    ctx.beginPath();
    if (open) {
      ctx.moveTo(x - 11, y - 16);
      ctx.arc(x, y - 16, 11, Math.PI, 0);
      ctx.lineTo(x + 11, y - 4);
    } else {
      ctx.moveTo(x - 11, y - 4);
      ctx.lineTo(x - 11, y - 12);
      ctx.arc(x, y - 12, 11, Math.PI, 0);
      ctx.lineTo(x + 11, y - 4);
    }
    ctx.stroke();
  }

  function panel(ctx, x, y, w, h, a) {
    ctx.strokeStyle = SV.white(0.35 * a);
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  function openSource(ctx, t) {
    SV.drawStars(ctx, t, 0.5);
    SV.header(ctx, '08', 'OPEN TRAINING · CLOSED MODELS', 'what you can use today, and what is coming', t);
    const aL = SV.ease(SV.prog(t, 0.4, 0.7));
    const aR = SV.ease(SV.prog(t, 1.2, 0.7));
    const aA = SV.ease(SV.prog(t, 2.2, 0.7));

    panel(ctx, 140, 230, 760, 420, aL);
    padlock(ctx, 200, 300, true, aL);
    SV.text(ctx, 'OPEN SOURCE', 245, 312, { size: 30, weight: 600, alpha: aL, spacing: 6 });
    SV.text(ctx, '+ all training code', 190, 400, { size: 26, alpha: aL });
    SV.text(ctx, '+ data collection plugins', 190, 450, { size: 26, alpha: aL });
    SV.text(ctx, 'collect your own data · train your own model', 190, 590, { size: 19, alpha: 0.6 * aL });

    panel(ctx, 1020, 230, 760, 420, aR);
    padlock(ctx, 1080, 300, false, aR);
    SV.text(ctx, 'CLOSED SOURCE', 1125, 312, { size: 30, weight: 600, alpha: aR, spacing: 6 });
    SV.text(ctx, '· the official production models', 1070, 400, { size: 26, alpha: aR });
    SV.text(ctx, '  graviton · event horizon · singularity', 1070, 450, { size: 22, alpha: 0.8 * aR });
    SV.text(ctx, 'the models the company runs stay private', 1070, 590, { size: 19, alpha: 0.6 * aR });

    SV.text(ctx, 'INFERENCE API', 140, 745, { size: 30, weight: 600, alpha: aA, spacing: 6 });
    ctx.strokeStyle = SV.white(aA);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(470, 716, 200, 40);
    SV.text(ctx, 'COMING SOON', 570, 743, { size: 17, align: 'center', alpha: aA, spacing: 3 });
    SV.text(ctx, 'send the same per-tick inputs · get a model verdict back', 140, 790, { size: 20, alpha: 0.6 * aA });

    // ticker of the input schema
    if (aA > 0) {
      const x0 = 140, y0 = 830, w = 1640, h = 64;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, w, h);
      ctx.clip();
      ctx.font = `400 18px ${SV.FONT}`;
      const str = SV.HEADER.join('   ·   ') + '   ·   ';
      const sw = ctx.measureText(str).width;
      const off = (t * 170) % sw;
      for (let k = -1; k < 3; k++) SV.text(ctx, str, x0 - off + k * sw, y0 + 40, { size: 18, alpha: 0.75 * aA });
      ctx.restore();
      ctx.strokeStyle = SV.white(0.35 * aA);
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, w, h);
    }
    SV.caption(ctx, '55 features per tick in · verdict out', t, 3.0, 960);
  }

  // ---------- 09 outro ----------
  function outro(ctx, t) {
    SV.drawStars(ctx, t, 1);
    SV.drawBlackHole(ctx, { cx: W / 2, cy: H / 2 - 70, R: 170 + t * 8, t: t + 60, alpha: 1 });
    const a = SV.ease(SV.prog(t, 0.6, 1));
    SV.text(ctx, 'SINGULARITY', W / 2, H - 175, { size: 80, weight: 300, align: 'center', alpha: a, spacing: 26 });
    SV.text(ctx, 'graviton · event horizon · singularity', W / 2, H - 120, { size: 22, align: 'center', alpha: 0.6 * SV.ease(SV.prog(t, 1.2, 1)) });
    SV.text(ctx, 'open-source training · inference api soon', W / 2, H - 84, { size: 18, align: 'center', alpha: 0.45 * SV.ease(SV.prog(t, 1.6, 1)) });
  }

  SV.SCENES = [
    { name: 'intro', dur: 4.5, draw: intro },
    { name: 'clip', dur: 3.0, draw: clipScene },
    { name: 'features', dur: 5.0, draw: features },
    { name: 'lstm-cell', dur: 6.0, draw: lstmCell },
    { name: 'forward-lstm', dur: 4.0, draw: (ctx, t) => bilstm(ctx, t, 'fwd') },
    { name: 'backward-lstm', dur: 4.8, draw: (ctx, t) => bilstm(ctx, t, 'bwd') },
    { name: 'attention', dur: 5.5, draw: attention },
    { name: 'models', dur: 6.0, draw: models },
    { name: 'open-source', dur: 6.0, draw: openSource },
    { name: 'outro', dur: 4.5, draw: outro },
  ];
})(window.SV);
