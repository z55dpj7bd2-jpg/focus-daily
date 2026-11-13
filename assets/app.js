/* 专注日课 — 每日三项专注力训练 */
(function () {
  'use strict';

  /* ================= 工具 ================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad2 = n => (n < 10 ? '0' + n : '' + n);
  const dstr = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  // QA 预览：?dev=1&d=2026-11-16 可查看指定日期的训练方案
  const QS = new URLSearchParams(location.search);
  const DEV_DATE = QS.get('dev') === '1' && /^\d{4}-\d{2}-\d{2}$/.test(QS.get('d') || '') ? QS.get('d') : null;
  const todayStr = () => DEV_DATE || dstr(new Date());
  const parseD = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const dayNum = s => Math.floor(parseD(s).getTime() / 86400000);
  const mod = (v, m) => ((v % m) + m) % m;

  function hash32(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngFrom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  const fmtSec = s => (s >= 60 ? Math.floor(s / 60) + '分' + pad2(Math.round(s % 60)) + '秒' : s.toFixed(1) + '秒');

  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  /* ================= 存储 ================= */
  const KEY = 'focus-daily-v1';
  function loadDB() {
    try {
      const raw = localStorage.getItem(KEY);
      const o = raw ? JSON.parse(raw) : {};
      return { days: o.days || {}, settings: Object.assign({ sound: true }, o.settings || {}) };
    } catch (e) { return { days: {}, settings: { sound: true } }; }
  }
  let db = loadDB();
  function saveDB() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  function saveRecord(dateStr, kind, rec) {
    if (!db.days[dateStr]) db.days[dateStr] = {};
    db.days[dateStr][kind] = rec;
    saveDB();
  }
  function isFull(dateStr) {
    const d = db.days[dateStr];
    return !!(d && d.schulte && d.track && d.third);
  }
  function calcStreak() {
    const cur = new Date(); cur.setHours(0, 0, 0, 0);
    let s = 0;
    if (!isFull(dstr(cur))) cur.setDate(cur.getDate() - 1);
    while (isFull(dstr(cur))) { s++; cur.setDate(cur.getDate() - 1); }
    return s;
  }

  /* ================= 每日方案 ================= */
  const TIPS = [
    '训练前先深呼吸三次，把视线放松，专注不是紧绷。',
    '视线尽量少跳，用余光完成任务，比用力盯更有效。',
    '手机开静音，把这次训练当成一次「注意力充电」。',
    '每组训练之间别刷短视频，让大脑留一点空档。',
    '专注力像肌肉，短而稳定的每日练习，比一次练很久更有效。',
    '今天的目标不是更快，而是更稳：慢一点，但别出错。',
    '如果中途走神了，不用自责，记录一下，再回到任务上。',
    '训练时把手机拿稳，头部保持不动，只让眼睛动。',
    '感到烦躁时先停下十秒，烦躁本身会吃掉注意力。',
    '完成后闭眼十秒，回忆刚才练习的感觉，巩固效果。'
  ];

  const THIRD_IDS = ['stroop', 'reverse', 'flash', 'rhythm'];
  const THIRD_INFO = {
    stroop: { name: '色词干扰', ic: '◐' },
    reverse: { name: '数字反序', ic: '⇄' },
    flash: { name: '闪点记忆', ic: '∴' },
    rhythm: { name: '节拍专注', ic: '◔' }
  };

  function getPlan(dateStr) {
    const n = dayNum(dateStr);
    const sizes = [5, 5, 6, 5, 4, 5, 6];
    const size = sizes[mod(n, 7)];
    const mode = mod(n, 2) === 0 ? 'pursuit' : 'multi';
    const pursuitDur = [60, 60, 75, 45][mod(n, 4)];
    const balls = [4, 5, 4, 5][mod(n, 4)];
    const thirdId = THIRD_IDS[mod(n, 4)];
    const p = {};
    if (thirdId === 'stroop') { p.dur = [30, 30, 45][mod(n, 3)]; }
    if (thirdId === 'reverse') { p.baseLen = mod(n, 2) === 0 ? 4 : 5; p.rounds = 8; }
    if (thirdId === 'flash') { p.rounds = 6; p.grid = 4; }
    if (thirdId === 'rhythm') { p.bpm = mod(n, 2) === 0 ? 72 : 84; p.beats = 48; }
    return { date: dateStr, size, mode, pursuitDur, balls, thirdId, p, tip: TIPS[mod(n, TIPS.length)] };
  }

  const TARGET = { 4: 18, 5: 35, 6: 65 };
  function schulteDesc(plan) { return plan.size + '×' + plan.size + ' · 目标 ' + TARGET[plan.size] + ' 秒内'; }
  function trackDesc(plan) {
    return plan.mode === 'pursuit' ? '平滑眼动 · ' + plan.pursuitDur + ' 秒' : '多目标追踪 · ' + plan.balls + ' 球 3 轮';
  }
  function thirdDesc(plan) {
    const id = plan.thirdId;
    if (id === 'stroop') return '色词干扰 · ' + plan.p.dur + ' 秒';
    if (id === 'reverse') return '数字反序 · ' + plan.p.baseLen + ' 位 × ' + plan.p.rounds + ' 题';
    if (id === 'flash') return '闪点记忆 · 3→5 点 × ' + plan.p.rounds + ' 轮';
    return '节拍专注 · ' + plan.p.bpm + ' BPM × ' + plan.p.beats + ' 拍';
  }

  /* ================= 舞台 ================= */
  let cleanupFn = null;
  const stage = $('#stage');
  function stageOpen() {
    stage.hidden = false;
    stage.innerHTML = '';
    stage.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    return stage;
  }
  function stageClose() {
    if (cleanupFn) { try { cleanupFn(); } catch (e) {} cleanupFn = null; }
    stage.hidden = true;
    stage.innerHTML = '';
    document.body.style.overflow = '';
  }
  function runGame(build) {
    const st = stageOpen();
    const fn = build(st);
    cleanupFn = fn || null;
  }
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !stage.hidden) stageClose(); });

  let toastTimer = 0;
  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function head(title, meta, tip) {
    return '<div class="train-head"><div class="th"><h1>' + title + '</h1><div class="meta">' + meta + '</div></div>' +
      '<button class="xbtn" data-x aria-label="退出">✕</button></div>' +
      '<div class="tip">' + tip + '</div>';
  }
  function bindClose(st) {
    const x = $('[data-x]', st);
    if (x) x.onclick = () => stageClose();
  }
  function saveAndExit(dateStr, kind, rec, msg) {
    saveRecord(dateStr, kind, rec);
    stageClose();
    render();
    toast(msg || '已记录，今天的进度 +1');
  }

  /* ================= 画布工具 ================= */
  function fitCanvas(canvas) {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /* ================= 音频 ================= */
  let AC = null;
  function audio() {
    try {
      if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
    } catch (e) { return null; }
    return AC;
  }
  function ping(ac, when, freq, vol) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
    o.connect(g); g.connect(ac.destination);
    o.start(when); o.stop(when + 0.14);
  }
  function beep(freq, vol) {
    if (!db.settings.sound) return;
    const ac = audio();
    if (!ac) return;
    ping(ac, ac.currentTime + 0.01, freq || 880, vol || 0.06);
  }

  /* ================= 1. 舒尔特方格 ================= */
  function TrainSchulte(st, cfg) {
    const dateStr = cfg.date;
    const n = cfg.size, total = n * n;
    const rng = rngFrom(hash32(dateStr + '|schulte'));
    const nums = shuffled(Array.from({ length: total }, (_, i) => i + 1), rng);
    let next = 1, errors = 0, t0 = 0, over = false;

    st.innerHTML = '<div class="wrap">' +
      head('舒尔特方格', n + '×' + n + ' · 共 ' + total + ' 格',
        '眼睛盯住中央的小圆环，尽量不要让视线离开中心，用<b>余光</b>按 1 → ' + total + ' 的顺序点击。') +
      '<div class="metrics">' +
      '<div class="metric"><div class="mk">下一个</div><div class="mv accent" data-next>1</div></div>' +
      '<div class="metric"><div class="mk">用时</div><div class="mv" data-time>0.0s</div></div>' +
      '<div class="metric"><div class="mk">错误</div><div class="mv" data-err>0</div></div>' +
      '</div>' +
      '<div class="schulte-wrap"><div class="schulte" data-grid style="--n:' + n + '"></div><div class="fixdot" data-dot></div></div>' +
      '<p class="footnote">首次点击开始计时，点完最后一个数字结束。点错只记一次错误，不会中断。</p>' +
      '</div>';
    bindClose(st);

    const grid = $('[data-grid]', st);
    const elNext = $('[data-next]', st), elTime = $('[data-time]', st), elErr = $('[data-err]', st);

    nums.forEach(v => {
      const b = document.createElement('button');
      b.className = 'cell';
      b.dataset.v = v;
      b.textContent = v;
      if (n === 6) b.dataset.n = '6';
      grid.appendChild(b);
    });

    let timerId = 0;
    grid.addEventListener('pointerdown', e => {
      const cell = e.target.closest('.cell');
      if (!cell || over) return;
      const v = Number(cell.dataset.v);
      if (!t0) {
        t0 = performance.now();
        timerId = setInterval(() => {
          if (!t0 || over) return;
          elTime.textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's';
        }, 100);
      }
      if (v === next) {
        cell.classList.add('done');
        cell.disabled = true;
        next++;
        elNext.textContent = next > total ? '✓' : next;
        beep(660, 0.035);
        if (next > total) finish();
      } else if (!cell.classList.contains('done')) {
        errors++;
        elErr.textContent = errors;
        cell.classList.add('wrong');
        setTimeout(() => cell.classList.remove('wrong'), 260);
        beep(220, 0.05);
      }
    });

    function finish() {
      over = true;
      clearInterval(timerId);
      const sec = Math.max(0.1, (performance.now() - t0) / 1000);
      elTime.textContent = sec.toFixed(1) + 's';
      const target = TARGET[n];
      const best = bestSchulte();
      const rec = { time: Math.round(sec * 10) / 10, errors, size: n, at: Date.now() };
      const isPB = !best || rec.time < best;
      showResult(st, {
        badge: '舒尔特方格 · 完成',
        title: !best ? '第一份成绩已记录' : isPB ? '刷新了个人最好成绩' : '完成，继续保持',
        sub: n + '×' + n + ' · ' + (sec <= target ? '达标' : '目标 ' + target + ' 秒'),
        rows: [
          { k: '用时', v: fmtSec(sec), hi: isPB },
          { k: '错误次数', v: errors + ' 次' },
          { k: '目标参考', v: target + ' 秒内', hi: sec <= target },
          { k: '个人最好', v: best ? fmtSec(Math.min(best, sec)) : fmtSec(sec) }
        ],
        note: sec <= target
          ? '速度不错。下次试着把眼睛更牢地钉在中心点上，减少视线搜索范围。'
          : '先别追速度，把视线固定在中心，只用余光扫；稳定下来后速度会自然提升。',
        again: () => runGame(s => TrainSchulte(s, cfg)),
        save: () => saveAndExit(dateStr, 'schulte', rec)
      });
    }

    return () => clearInterval(timerId);
  }

  /* ================= 2A. 追踪小球（平滑眼动） ================= */
  function TrainPursuit(st, cfg) {
    const dateStr = cfg.date, dur = cfg.pursuitDur;
    st.innerHTML = '<div class="wrap">' +
      head('追踪小球', '平滑眼动 · ' + dur + ' 秒 · ' + cfg.theme,
        '头不要动，只用眼睛跟着小球移动。它会走「8」字轨迹，偶尔会出现灰点，那是干扰，忽略它。') +
      '<div class="metrics">' +
      '<div class="metric"><div class="mk">剩余</div><div class="mv accent" data-left>' + dur + 's</div></div>' +
      '<div class="metric"><div class="mk">走神次数</div><div class="mv" data-drift>0</div></div>' +
      '</div>' +
      '<div class="barline"><i data-bar></i></div>' +
      '<div class="canvas-wrap"><canvas data-c></canvas></div>' +
      '<div class="statusbar" data-msg>眼睛盯住小球，头保持不动</div>' +
      '<button class="btn ghost" data-d style="width:100%">我走神了 · 0</button>' +
      '<p class="footnote">走神时按一下按钮，不用不好意思 —— 训练的重点是「发现走神并回来」这个动作。</p>' +
      '</div>';
    bindClose(st);

    const canvas = $('[data-c]', st);
    const { ctx, w, h } = fitCanvas(canvas);
    const cx = w / 2, cy = h / 2, A = w * 0.34, B = h * 0.28;
    const r = Math.max(9, Math.min(w, h) * 0.048);

    let raf = 0, t = 0, drifts = 0, last = performance.now(), started = performance.now(), done = false;
    const ax = 0.55; // 角速度：约 11 秒一圈
    const distract = [];
    const dr = $('[data-d]', st), elLeft = $('[data-left]', st), elDrift = $('[data-drift]', st), bar = $('[data-bar]', st);

    dr.onclick = () => { drifts++; elDrift.textContent = drifts; dr.textContent = '我走神了 · ' + drifts; beep(300, 0.03); };

    let nextDistract = 2.5;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const el = (now - started) / 1000;
      t += dt * ax;

      ctx.clearRect(0, 0, w, h);
      // 轨迹残影
      ctx.beginPath();
      for (let i = 0; i <= 1.001; i += 0.008) {
        const ang = t - i * 1.1;
        const px = cx + A * Math.sin(ang), py = cy + B * Math.sin(2 * ang);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(78,224,193,.10)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 干扰点
      if (el > nextDistract && el < dur - 3) {
        distract.push({ x: 24 + Math.random() * (w - 48), y: 24 + Math.random() * (h - 48), life: 1.0 });
        nextDistract = el + 2.4 + Math.random() * 1.6;
      }
      for (let i = distract.length - 1; i >= 0; i--) {
        const d = distract[i];
        d.life -= dt * 1.1;
        if (d.life <= 0) { distract.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.28 * Math.max(0, d.life)) + ')';
        ctx.fill();
      }

      // 球
      const bx = cx + A * Math.sin(t), by = cy + B * Math.sin(2 * t);
      const g = ctx.createRadialGradient(bx, by, 1, bx, by, r * 3.2);
      g.addColorStop(0, 'rgba(120,245,220,.55)');
      g.addColorStop(1, 'rgba(78,224,193,0)');
      ctx.beginPath(); ctx.arc(bx, by, r * 3.2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fillStyle = '#8df5e2'; ctx.fill();
      ctx.beginPath(); ctx.arc(bx - r * 0.3, by - r * 0.3, r * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();

      const left = Math.max(0, dur - el);
      elLeft.textContent = Math.ceil(left) + 's';
      bar.style.width = Math.min(100, el / dur * 100) + '%';

      if (el >= dur) { end(now); return; }
      raf = requestAnimationFrame(frame);
    }

    function end() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      const rec = { mode: 'pursuit', dur, drifts, at: Date.now() };
      showResult(st, {
        badge: '追踪小球 · 完成',
        title: '这一轮眼动做完了',
        sub: '时长 ' + dur + ' 秒 · 走神 ' + drifts + ' 次',
        rows: [
          { k: '训练时长', v: dur + ' 秒' },
          { k: '主动记录的走神', v: drifts + ' 次', hi: drifts <= 2 },
          { k: '个人最少走神', v: (bestDrift() === null ? drifts : Math.min(bestDrift(), drifts)) + ' 次' }
        ],
        note: drifts <= 2
          ? '保持得不错。明天可以试试把手机拿远一点，让眼球移动幅度更大。'
          : '走神多说明眼睛在「找」而不是「跟」。下次把注意力放在球的速度变化上，跟着它拐弯。',
        again: () => runGame(s => TrainPursuit(s, cfg)),
        save: () => saveAndExit(dateStr, 'track', rec)
      });
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }

  /* ================= 2B. 多目标追踪 ================= */
  function TrainMulti(st, cfg) {
    const dateStr = cfg.date, N = cfg.balls, ROUNDS = 3;
    const SHOW = 2.6, MOVE = 7.0;
    st.innerHTML = '<div class="wrap">' +
      head('追踪小球', N + ' 球 · ' + ROUNDS + ' 轮 · 多目标追踪',
        '先记住闪烁高亮的那颗球，之后所有球会一起移动，停下后点出它。') +
      '<div class="metrics">' +
      '<div class="metric"><div class="mk">第几轮</div><div class="mv accent" data-round>1/3</div></div>' +
      '<div class="metric"><div class="mk">命中</div><div class="mv" data-hit>0</div></div>' +
      '</div>' +
      '<div class="canvas-wrap"><canvas data-c></canvas></div>' +
      '<div class="statusbar" data-msg>准备</div>' +
      '<p class="footnote">用余光同时「罩住」所有球，比死盯目标球更省力。</p>' +
      '</div>';
    bindClose(st);

    const canvas = $('[data-c]', st);
    const { ctx, w, h } = fitCanvas(canvas);
    const r = Math.max(12, Math.min(w, h) * 0.055);
    const msg = $('[data-msg]', st), elRound = $('[data-round]', st), elHit = $('[data-hit]', st);

    let balls = [], target = 0, round = 0, hits = 0, phase = 'idle', phaseEnd = 0, raf = 0, done = false, tapLock = true;
    let last = performance.now();

    function setup() {
      balls = [];
      const pad = r + 8;
      const ok = [];
      for (let i = 0; i < N; i++) {
        let tries = 0;
        while (tries < 200) {
          const x = pad + Math.random() * (w - pad * 2);
          const y = pad + Math.random() * (h - pad * 2);
          if (ok.every(b => Math.hypot(b.x - x, b.y - y) > r * 3.2)) { ok.push({ x, y }); break; }
          tries++;
        }
      }
      balls = ok.map(p => {
        const a = Math.random() * Math.PI * 2;
        const sp = 75 + Math.random() * 55;
        return { x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, flash: 0 };
      });
      target = Math.floor(Math.random() * balls.length);
      phase = 'show';
      phaseEnd = performance.now() + SHOW * 1000;
      tapLock = true;
      elRound.textContent = (round + 1) + '/' + ROUNDS;
      msg.textContent = '记住高亮的这颗球';
    }

    function separate() {
      const minD = r * 2.3;
      for (let it = 0; it < 10; it++) {
        for (let i = 0; i < balls.length; i++) {
          for (let j = i + 1; j < balls.length; j++) {
            const a = balls[i], b = balls[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 0.001;
            if (d < minD) {
              const push = (minD - d) / 2 + 0.6;
              const ux = dx / d, uy = dy / d;
              a.x -= ux * push; a.y -= uy * push;
              b.x += ux * push; b.y += uy * push;
              [a, b].forEach(o => {
                o.x = Math.max(r + 2, Math.min(w - r - 2, o.x));
                o.y = Math.max(r + 2, Math.min(h - r - 2, o.y));
              });
            }
          }
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      balls.forEach((b, i) => {
        const isTarget = (phase === 'show' || phase === 'result') && i === target;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        if (isTarget) {
          const g = ctx.createRadialGradient(b.x, b.y, r * 0.4, b.x, b.y, r * 2.2);
          g.addColorStop(0, 'rgba(246,179,82,.55)');
          g.addColorStop(1, 'rgba(246,179,82,0)');
          ctx.beginPath(); ctx.arc(b.x, b.y, r * 2.2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
          ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
          ctx.fillStyle = '#f6b352'; ctx.fill();
        } else if (b.flash > 0) {
          ctx.fillStyle = b.flash > 0.5 ? 'rgba(78,224,193,.9)' : 'rgba(240,104,104,.9)';
          ctx.fill();
        } else {
          const g = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, r * 0.2, b.x, b.y, r);
          g.addColorStop(0, '#9fd6ff');
          g.addColorStop(1, '#4a7fb5');
          ctx.fillStyle = g; ctx.fill();
        }
        if (isTarget) {
          ctx.beginPath();
          ctx.arc(b.x - r * 0.32, b.y - r * 0.32, r * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
        }
      });
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now;

      if (phase === 'show' && t > phaseEnd) {
        phase = 'move';
        phaseEnd = t + MOVE * 1000;
        msg.textContent = '球在移动 · 用余光罩住目标';
        beep(520, 0.04);
      } else if (phase === 'move') {
        balls.forEach(b => {
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); }
          if (b.x > w - r) { b.x = w - r; b.vx = -Math.abs(b.vx); }
          if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy); }
          if (b.y > h - r) { b.y = h - r; b.vy = -Math.abs(b.vy); }
        });
        if (t > phaseEnd) {
          phase = 'answer';
          separate();
          tapLock = false;
          msg.textContent = '停 —— 点出刚才高亮的球';
        }
      } else if (phase === 'result') {
        if (t > phaseEnd) {
          if (round + 1 >= ROUNDS) { end(); return; }
          round++;
          setup();
        }
      }
      balls.forEach(b => { if (b.flash > 0) b.flash -= dt; });
      draw();
      raf = requestAnimationFrame(frame);
    }

    canvas.addEventListener('pointerdown', e => {
      if (tapLock || phase !== 'answer') return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      let pick = -1, best = 1e9;
      balls.forEach((b, i) => {
        const dd = Math.hypot(b.x - x, b.y - y);
        if (dd < best) { best = dd; pick = i; }
      });
      if (pick < 0 || best > r * 2.6) return;
      tapLock = true;
      const right = pick === target;
      balls[pick].flash = 1;
      if (!right) balls[target].flash = 1;
      if (right) { hits++; elHit.textContent = hits; beep(880, 0.05); }
      else beep(240, 0.06);
      msg.textContent = right ? '对了' : '不对，高亮的是刚才闪的那颗';
      elHit.textContent = hits;
      phase = 'result';
      phaseEnd = performance.now() + 1500;
    });

    function end() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      const rec = { mode: 'multi', balls: N, hits, rounds: ROUNDS, at: Date.now() };
      showResult(st, {
        badge: '追踪小球 · 完成',
        title: hits === ROUNDS ? '三轮全中' : '命中 ' + hits + ' / ' + ROUNDS,
        sub: N + ' 球 · 多目标追踪',
        rows: [
          { k: '命中', v: hits + ' / ' + ROUNDS + ' 轮', hi: hits >= 2 },
          { k: '球数', v: N + ' 颗' },
          { k: '移动时长', v: MOVE + ' 秒 / 轮' }
        ],
        note: hits >= 2
          ? '不错。下次试着不追着目标球看，而是把视野放大，用余光把整片区域都收进来。'
          : '跟丢很正常。提示：把注意力放在「它的位置关系」而不是「球本身」，命中率会明显上来。',
        again: () => runGame(s => TrainMulti(s, cfg)),
        save: () => saveAndExit(dateStr, 'track', rec)
      });
    }

    setup();
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }

  /* ================= 3A. 色词干扰 ================= */
  function TrainStroop(st, cfg) {
    const dateStr = cfg.date, dur = cfg.p.dur;
    const COLORS = [
      { n: '红', hex: '#e2483f' },
      { n: '黄', hex: '#e2a52b' },
      { n: '蓝', hex: '#3a7ee0' },
      { n: '绿', hex: '#2fa863' }
    ];
    st.innerHTML = '<div class="wrap">' +
      head('色词干扰', dur + ' 秒 · 抗干扰',
        '看字的<b>颜色</b>，不要读字的意思。点击下方对应颜色的按钮。') +
      '<div class="metrics">' +
      '<div class="metric"><div class="mk">剩余</div><div class="mv accent" data-left>' + dur + 's</div></div>' +
      '<div class="metric"><div class="mk">答对</div><div class="mv" data-ok>0</div></div>' +
      '<div class="metric"><div class="mk">答错</div><div class="mv" data-no>0</div></div>' +
      '</div>' +
      '<div class="stroop-word" data-word style="color:#e2483f">红</div>' +
      '<div class="stroop-grid">' +
      COLORS.map((c, i) => '<button class="cbtn c' + i + '" data-c="' + i + '">' + c.n + '</button>').join('') +
      '</div>' +
      '<p class="footnote">速度第二，正确率第一。答错不扣分，但会被记录。</p>' +
      '</div>';
    bindClose(st);

    const elWord = $('[data-word]', st), elLeft = $('[data-left]', st);
    let wordIdx = 0, inkIdx = 0, ok = 0, no = 0, left = dur, lock = false, over = false;

    function nextTrial() {
      wordIdx = Math.floor(Math.random() * 4);
      do { inkIdx = Math.floor(Math.random() * 4); } while (inkIdx === wordIdx);
      elWord.textContent = COLORS[wordIdx].n;
      elWord.style.color = COLORS[inkIdx].hex;
    }

    $$('[data-c]', st).forEach(btn => {
      btn.onpointerdown = () => {
        if (lock || over) return;
        lock = true;
        const pick = Number(btn.dataset.c);
        if (pick === inkIdx) { ok++; beep(880, 0.04); }
        else { no++; beep(240, 0.05); }
        $('[data-ok]', st).textContent = ok;
        $('[data-no]', st).textContent = no;
        elWord.style.opacity = '0.35';
        setTimeout(() => { elWord.style.opacity = '1'; nextTrial(); lock = false; }, 90);
      };
    });

    const tick = setInterval(() => {
      left--;
      elLeft.textContent = Math.max(0, left) + 's';
      if (left <= 0) finish();
    }, 1000);

    function finish() {
      if (over) return;
      over = true;
      clearInterval(tick);
      const total = ok + no;
      const acc = total ? Math.round(ok / total * 100) : 0;
      const rec = { type: 'stroop', count: ok, wrong: no, dur, at: Date.now() };
      showResult(st, {
        badge: '色词干扰 · 完成',
        title: '答对 ' + ok + ' 个',
        sub: dur + ' 秒 · 正确率 ' + acc + '%',
        rows: [
          { k: '答对', v: ok + ' 个', hi: acc >= 85 },
          { k: '答错', v: no + ' 个' },
          { k: '正确率', v: acc + '%', hi: acc >= 85 },
          { k: '速度', v: (ok / dur * 60).toFixed(1) + ' 个/分钟' }
        ],
        note: acc >= 85
          ? '抑制得很稳。真正难的场景是「读着读着就自动念出来」，明天可以试试边默念颜色边点。'
          : '如果错得多，通常是眼睛先看到了字义。把注意力压在「颜色」这个特征上，先看色块再看字。',
        again: () => runGame(s => TrainStroop(s, cfg)),
        save: () => saveAndExit(dateStr, 'third', rec)
      });
    }

    nextTrial();
    return () => clearInterval(tick);
  }

  /* ================= 3B. 数字反序 ================= */
  function TrainReverse(st, cfg) {
    const dateStr = cfg.date, ROUNDS = cfg.p.rounds;
    let baseLen = cfg.p.baseLen;
    st.innerHTML = '<div class="wrap">' +
      head('数字反序', ROUNDS + ' 题 · 起始 ' + baseLen + ' 位',
        '数字闪现约 1.5 秒后消失，请把它<b>倒过来</b>按顺序输入。答对两题长度加一位。') +
      '<div class="metrics">' +
      '<div class="metric"><div class="mk">第几题</div><div class="mv accent" data-round>1/' + ROUNDS + '</div></div>' +
      '<div class="metric"><div class="mk">答对</div><div class="mv" data-ok>0</div></div>' +
      '<div class="metric"><div class="mk">位数</div><div class="mv" data-len>' + baseLen + '</div></div>' +
      '</div>' +
      '<div data-area></div></div>';
    bindClose(st);

    const area = $('[data-area]', st);
    const elRound = $('[data-round]', st), elOk = $('[data-ok]', st), elLen = $('[data-len]', st);
    let round = 0, ok = 0, timers = [], answer = 0, locked = true, done = false;

    function clearTimers() { timers.forEach(t => clearTimeout(t)); timers = []; }

    function startRound() {
      clearTimers();
      const len = baseLen + Math.floor(ok / 2);
      let num = '';
      for (let i = 0; i < len; i++) num += (i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10));
      answer = num.split('').reverse().join('');
      elRound.textContent = (round + 1) + '/' + ROUNDS;
      elLen.textContent = len;
      locked = true;

      area.innerHTML = '<div class="rev-show" data-show>' + num + '</div>' +
        '<div class="barline"><i data-bar style="width:100%"></i></div>' +
        '<p class="footnote" style="margin-top:12px">记住，等它消失后再倒着输入</p>';
      const bar = $('[data-bar]', area);
      let p = 100;
      const iv = setInterval(() => {
        p -= 6.6;
        if (bar) bar.style.width = Math.max(0, p) + '%';
      }, 100);
      timers.push(iv);

      timers.push(setTimeout(() => {
        clearInterval(iv);
        answerPhase(len);
      }, 1500));
    }

    function answerPhase(len) {
      area.innerHTML = '<div class="rev-slots" data-slots></div>' +
        '<div class="keypad" data-keys>' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => '<button class="key" data-k="' + d + '">' + d + '</button>').join('') +
        '<button class="key fn" data-k="del">删除</button>' +
        '<button class="key" data-k="0">0</button>' +
        '<button class="key ok" data-k="ok">确认</button>' +
        '</div>';
      const slots = $('[data-slots]', area);
      let input = '';
      const draw = () => {
        slots.innerHTML = '';
        for (let i = 0; i < len; i++) {
          const s = document.createElement('div');
          s.className = 'slot' + (i < input.length ? '' : ' empty');
          s.textContent = i < input.length ? input[i] : '·';
          slots.appendChild(s);
        }
      };
      draw();
      $$('[data-k]', area).forEach(b => {
        b.onpointerdown = () => {
          const k = b.dataset.k;
          if (locked) return;
          if (k === 'del') input = input.slice(0, -1);
          else if (k === 'ok') { check(input); return; }
          else if (input.length < len) input += k;
          draw();
        };
      });
      locked = false;
    }

    function check(input) {
      locked = true;
      const right = input === answer;
      if (right) { ok++; elOk.textContent = ok; beep(880, 0.045); }
      else beep(240, 0.06);
      area.innerHTML = '<div class="rev-show" style="font-size:30px">' +
        (right ? '正确' : '应为 ' + answer) + '</div>' +
        '<p class="footnote" style="text-align:center">' + (right ? '很好，位数会加一位' : '倒序时容易在中间丢位，可以先倒着念一遍') + '</p>';
      round++;
      if (round >= ROUNDS) { timers.push(setTimeout(end, 1000)); return; }
      timers.push(setTimeout(startRound, 1000));
    }

    function end() {
      if (done) return;
      done = true;
      clearTimers();
      const rec = { type: 'reverse', score: ok, total: ROUNDS, maxLen: baseLen + Math.floor(ok / 2), at: Date.now() };
      showResult(st, {
        badge: '数字反序 · 完成',
        title: '答对 ' + ok + ' / ' + ROUNDS + ' 题',
        sub: '最高做到 ' + (baseLen + Math.floor(ok / 2)) + ' 位',
        rows: [
          { k: '答对', v: ok + ' / ' + ROUNDS + ' 题', hi: ok >= 5 },
          { k: '最终位数', v: baseLen + Math.floor(ok / 2) + ' 位' },
          { k: '起始位数', v: baseLen + ' 位' }
        ],
        note: ok >= 5
          ? '工作记忆保持得不错。想加难度的话，明天可以试试在倒序时同时倒数。'
          : '反序靠的是「先在脑内排好队」。建议看完数字后先默念最后一位，再往前推。',
        again: () => runGame(s => TrainReverse(s, cfg)),
        save: () => saveAndExit(dateStr, 'third', rec)
      });
    }

    startRound();
    return () => clearTimers();
  }

  /* ================= 3C. 闪点记忆 ================= */
  function TrainFlash(st, cfg) {
    const dateStr = cfg.date, ROUNDS = cfg.p.rounds, G = cfg.p.grid;
    st.innerHTML = '<div class="wrap">' +
      head('闪点记忆', ROUNDS + ' 轮 · ' + G + '×' + G + ' 点阵',
        '亮点只闪一下，记住位置，然后按原样点出来。') +
      '<div class="metrics">' +
      '<div class="metric"><div class="mk">第几轮</div><div class="mv accent" data-round>1/' + ROUNDS + '</div></div>' +
      '<div class="metric"><div class="mk">全对</div><div class="mv" data-ok>0</div></div>' +
      '<div class="metric"><div class="mk">点数</div><div class="mv" data-k>3</div></div>' +
      '</div>' +
      '<div class="dotgrid" data-grid></div>' +
      '<div class="barline"><i data-bar></i></div>' +
      '<button class="btn" data-confirm disabled style="width:100%">确认</button>' +
      '<p class="footnote" style="text-align:center" data-state>准备开始</p>' +
      '</div>';
    bindClose(st);

    const grid = $('[data-grid]', st), bar = $('[data-bar]', st), btn = $('[data-confirm]', st), stateEl = $('[data-state]', st);
    const cells = [];
    for (let i = 0; i < G * G; i++) {
      const d = document.createElement('div');
      d.className = 'dot';
      d.dataset.i = i;
      grid.appendChild(d);
      cells.push(d);
    }

    let round = 0, pass = 0, target = [], selected = new Set(), phase = 'idle', timers = [], done = false;
    const kOf = r => Math.min(5, 3 + Math.floor(r / 2));

    function clearT() { timers.forEach(t => clearTimeout(t)); timers = []; }

    function startRound() {
      clearT();
      const k = kOf(round);
      $('[data-k]', st).textContent = k;
      $('[data-round]', st).textContent = (round + 1) + '/' + ROUNDS;
      target = shuffled(Array.from({ length: G * G }, (_, i) => i), rngFrom(hash32(dateStr + 'flash' + round))).slice(0, k);
      selected.clear();
      cells.forEach(c => { c.className = 'dot'; });
      btn.disabled = true;
      phase = 'show';
      stateEl.textContent = '记住这些亮点';
      bar.style.width = '100%';
      target.forEach(i => cells[i].classList.add('on'));
      beep(700, 0.04);

      let p = 100;
      const iv = setInterval(() => { p -= 8; if (bar) bar.style.width = Math.max(0, p) + '%'; }, 100);
      timers.push(iv);
      timers.push(setTimeout(() => {
        clearInterval(iv);
        cells.forEach(c => c.classList.remove('on'));
        phase = 'input';
        bar.style.width = '0%';
        stateEl.textContent = '按顺序不重要，位置要对';
        btn.disabled = false;
      }, 1250));
    }

    cells.forEach((c, i) => {
      c.onpointerdown = () => {
        if (phase !== 'input') return;
        if (selected.has(i)) { selected.delete(i); c.classList.remove('sel'); }
        else if (selected.size < target.length) { selected.add(i); c.classList.add('sel'); beep(620, 0.03); }
      };
    });

    btn.onclick = () => {
      if (phase !== 'input') return;
      phase = 'check';
      btn.disabled = true;
      const allRight = selected.size === target.length && target.every(i => selected.has(i));
      if (allRight) { pass++; $('[data-ok]', st).textContent = pass; beep(960, 0.05); }
      else beep(240, 0.06);
      cells.forEach(c => c.classList.remove('sel', 'on'));
      target.forEach(i => cells[i].classList.add('hit'));
      selected.forEach(i => { if (!target.includes(i)) cells[i].classList.add('miss'); });
      stateEl.textContent = allRight ? '全对' : '正确位置已用绿色标出';
      round++;
      if (round >= ROUNDS) { timers.push(setTimeout(end, 1200)); return; }
      timers.push(setTimeout(startRound, 1200));
    };

    function end() {
      if (done) return;
      done = true;
      clearT();
      const rec = { type: 'flash', score: pass, total: ROUNDS, dots: kOf(ROUNDS - 1), at: Date.now() };
      showResult(st, {
        badge: '闪点记忆 · 完成',
        title: '全对 ' + pass + ' / ' + ROUNDS + ' 轮',
        sub: '最多同时记 ' + kOf(ROUNDS - 1) + ' 个点',
        rows: [
          { k: '全对', v: pass + ' / ' + ROUNDS + ' 轮', hi: pass >= 4 },
          { k: '最大点数', v: kOf(ROUNDS - 1) + ' 个' },
          { k: '点阵', v: G + '×' + G }
        ],
        note: pass >= 4
          ? '空间记忆不错。下次可以把点「连成形状」来记，比逐个记位置更省力。'
          : '建议别一个点一个点记，把它们当成一个整体图形（三角形、对角线）来抓。',
        again: () => runGame(s => TrainFlash(s, cfg)),
        save: () => saveAndExit(dateStr, 'third', rec)
      });
    }

    startRound();
    return () => clearT();
  }

  /* ================= 3D. 节拍专注 ================= */
  function TrainRhythm(st, cfg) {
    const dateStr = cfg.date, bpm = cfg.p.bpm, beats = cfg.p.beats;
    const interval = 60 / bpm;
    st.innerHTML = '<div class="wrap">' +
      head('节拍专注', bpm + ' BPM · ' + beats + ' 拍',
        '球每弹一下就是一拍，请在球弹起的<b>瞬间</b>点屏幕。跟着节奏，不要抢拍也不要拖拍。') +
      '<div class="metrics">' +
      '<div class="metric"><div class="mk">已打</div><div class="mv accent" data-n>0</div></div>' +
      '<div class="metric"><div class="mk">平均偏差</div><div class="mv" data-off>—</div></div>' +
      '</div>' +
      '<div class="beat-wrap"><div class="beat-ball" data-ball><span class="lbl">跟着节拍点我</span></div></div>' +
      '<div class="barline"><i data-bar></i></div>' +
      '<p class="footnote" style="text-align:center" data-state>等待第一拍…</p>' +
      '</div>';
    bindClose(st);

    const ball = $('[data-ball]', st), bar = $('[data-bar]', st), stateEl = $('[data-state]', st);
    const elN = $('[data-n]', st), elOff = $('[data-off]', st);
    const ac = db.settings.sound ? audio() : null;
    // 统一用 performance 时钟做基准：即使音频被系统挂起，视觉节奏和打分也不会卡住
    const t0 = performance.now() / 1000 + 0.9;
    const beatAt = i => t0 + i * interval;
    const now = () => performance.now() / 1000;
    const offs = [];
    let raf = 0, lastIdx = -1, done = false, playing = true;

    if (ac) {
      const delay = Math.max(0.05, t0 - now());
      for (let i = 0; i < beats; i++) ping(ac, ac.currentTime + delay + i * interval, i === 0 ? 1040 : 720, 0.05);
    } else {
      stateEl.textContent = '音效已关闭（在「我的」里可打开），只按视觉节奏来';
    }

    function pulse(idx) {
      ball.classList.add('pulse');
      setTimeout(() => ball.classList.remove('pulse'), 110);
      stateEl.textContent = '第 ' + (idx + 1) + ' 拍';
    }

    function frame() {
      const t = now();
      if (t < t0) {
        stateEl.textContent = '准备… 第 1 拍马上开始';
      } else {
        const idx = Math.floor((t - t0) / interval);
        if (idx >= 0 && idx < beats && idx !== lastIdx) { lastIdx = idx; pulse(idx); }
      }
      const prog = Math.max(0, Math.min(1, (t - t0) / (beats * interval)));
      bar.style.width = (prog * 100) + '%';
      if (t > beatAt(beats) + 0.3) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }

    ball.onpointerdown = () => {
      if (!playing || done) return;
      const t = now();
      const idx = Math.round((t - t0) / interval);
      if (idx < 0 || idx >= beats) return;
      const off = (t - beatAt(idx)) * 1000;
      offs.push(off);
      elN.textContent = offs.length;
      const avg = offs.reduce((a, b) => a + b, 0) / offs.length;
      elOff.textContent = (avg > 0 ? '+' : '') + Math.round(avg) + 'ms';
      beep(Math.abs(off) < 120 ? 1000 : 400, 0.03);
    };

    function finish() {
      if (done) return;
      done = true;
      playing = false;
      cancelAnimationFrame(raf);
      const n = offs.length;
      const hit = offs.filter(o => Math.abs(o) <= 120).length;
      const rate = n ? Math.round(hit / n * 100) : 0;
      const avg = n ? offs.reduce((a, b) => a + b, 0) / n : 0;
      const rec = { type: 'rhythm', hitRate: rate, taps: n, avgOff: Math.round(avg), at: Date.now() };
      showResult(st, {
        badge: '节拍专注 · 完成',
        title: '命中 ' + hit + ' / ' + n + ' 拍',
        sub: '偏差 ' + (Math.abs(avg) < 1 ? '0' : (avg > 0 ? '+' : '')) + Math.round(avg) + ' 毫秒（' +
          (avg > 30 ? '略拖拍' : avg < -30 ? '略抢拍' : '很贴拍') + '）',
        rows: [
          { k: '拍点命中（±120ms）', v: hit + ' / ' + n, hi: rate >= 70 },
          { k: '命中率', v: rate + '%', hi: rate >= 70 },
          { k: '平均偏差', v: Math.round(avg) + ' ms' }
        ],
        note: rate >= 70
          ? '节奏感很稳，这种稳定本身就是注意力的表现。明天可以试试闭眼只听声音。'
          : '抢拍比拖拍更常见 —— 试着等声音「落下来」再点，而不是预判它。',
        again: () => runGame(s => TrainRhythm(s, cfg)),
        save: () => saveAndExit(dateStr, 'third', rec)
      });
    }

    raf = requestAnimationFrame(frame);
    return () => { playing = false; cancelAnimationFrame(raf); };
  }

  /* ================= 统计 ================= */
  function bestSchulte() {
    let b = null;
    Object.keys(db.days).forEach(d => {
      const s = db.days[d].schulte;
      if (s && (!b || s.time < b)) b = s.time;
    });
    return b;
  }
  function bestDrift() {
    let b = null;
    Object.keys(db.days).forEach(d => {
      const t = db.days[d].track;
      if (t && t.mode === 'pursuit' && (!b || t.drifts < b)) b = t.drifts;
    });
    return b;
  }
  function statTotals() {
    const days = Object.keys(db.days);
    let items = 0, seams = 0, mins = 0, full = 0;
    days.forEach(d => {
      const r = db.days[d];
      const c = ['schulte', 'track', 'third'].filter(k => r[k]).length;
      items += c;
      if (c === 3) full++;
      if (r.schulte) mins += r.schulte.time / 60;
      if (r.track) mins += (r.track.mode === 'pursuit' ? r.track.dur : 30) / 60;
      if (r.third) mins += (r.third.dur || 30) / 60;
    });
    const bestTh = {};
    days.forEach(d => {
      const t = db.days[d].third;
      if (!t) return;
      if (t.type === 'stroop') bestTh.stroop = Math.max(bestTh.stroop || 0, t.count);
      if (t.type === 'reverse') bestTh.reverse = Math.max(bestTh.reverse || 0, t.maxLen);
      if (t.type === 'flash') bestTh.flash = Math.max(bestTh.flash || 0, t.score);
      if (t.type === 'rhythm') bestTh.rhythm = Math.max(bestTh.rhythm || 0, t.hitRate);
    });
    return { days: days.length, full, items, mins, bestTh };
  }

  /* ================= 结果页 ================= */
  function showResult(st, opt) {
    st.innerHTML = '<div class="result">' +
      '<div class="rbadge">' + opt.badge + '</div>' +
      '<h1>' + opt.title + '</h1>' +
      '<div class="rsub">' + opt.sub + '</div>' +
      '<div class="rlist">' +
      opt.rows.map(r => '<div class="rrow"><span class="rk">' + r.k + '</span><span class="rv ' + (r.hi ? 'hi' : '') + '">' + r.v + '</span></div>').join('') +
      '</div>' +
      '<div class="rnote">' + (opt.note || '') + '</div>' +
      '<div class="actions"><button class="btn ghost" data-again>再来一次</button><button class="btn" data-save>保存并返回</button></div>' +
      '</div>';
    $('[data-again]', st).onclick = () => opt.again();
    $('[data-save]', st).onclick = () => opt.save();
    $('[data-again]', st).scrollIntoView({ block: 'end' });
  }

  /* ================= 视图 ================= */
  let tab = 'today';

  function render() {
    const el = $('#main');
    el.innerHTML = tab === 'today' ? viewToday() : tab === 'history' ? viewHistory() : viewMe();
    $('#streak').innerHTML = calcStreak() > 0
      ? '连续 <b>' + calcStreak() + '</b> 天'
      : '<b>今天</b>开始';

    const root = $('#shell');
    $$('[data-open]', root).forEach(b => {
      b.onclick = () => {
        const k = b.dataset.open;
        const plan = getPlan(todayStr());
        if (k === 'schulte') runGame(s => TrainSchulte(s, { date: plan.date, size: plan.size }));
        if (k === 'track') {
          if (plan.mode === 'pursuit') runGame(s => TrainPursuit(s, { date: plan.date, pursuitDur: plan.pursuitDur, theme: '视觉平滑追踪' }));
          else runGame(s => TrainMulti(s, { date: plan.date, balls: plan.balls }));
        }
        if (k === 'third') {
          if (plan.thirdId === 'stroop') runGame(s => TrainStroop(s, { date: plan.date, p: plan.p }));
          if (plan.thirdId === 'reverse') runGame(s => TrainReverse(s, { date: plan.date, p: plan.p }));
          if (plan.thirdId === 'flash') runGame(s => TrainFlash(s, { date: plan.date, p: plan.p }));
          if (plan.thirdId === 'rhythm') runGame(s => TrainRhythm(s, { date: plan.date, p: plan.p }));
        }
      };
    });

    $$('[data-tab2]', root).forEach(b => { b.onclick = () => { tab = b.dataset.tab2; render(); window.scrollTo(0, 0); }; });
    $$('.tab', $('#tabs')).forEach(b => {
      b.classList.toggle('on', b.dataset.tab === tab);
      b.onclick = () => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); };
    });

    const soundRow = $('[data-sound]', root);
    if (soundRow) {
      soundRow.classList.toggle('on', db.settings.sound);
      soundRow.onclick = () => {
        db.settings.sound = !db.settings.sound;
        saveDB();
        soundRow.classList.toggle('on', db.settings.sound);
        toast(db.settings.sound ? '音效已打开' : '音效已关闭');
      };
    }
    const clearBtn = $('[data-clear]', root);
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (!confirm('确定清空全部训练记录吗？此操作不可恢复。')) return;
        db = { days: {}, settings: db.settings };
        saveDB();
        render();
        toast('记录已清空');
      };
    }
  }

  function viewToday() {
    const dateStr = todayStr();
    const plan = getPlan(dateStr);
    const day = db.days[dateStr] || {};
    const doneCount = ['schulte', 'track', 'third'].filter(k => day[k]).length;
    const d = new Date();
    const pct = doneCount / 3;
    const circ = 2 * Math.PI * 19;
    const dash = circ * (1 - pct);

    const schulteVal = day.schulte ? day.schulte.time.toFixed(1) + 's' : '开始';
    const trackVal = day.track ? (day.track.mode === 'pursuit' ? day.track.drifts + ' 次走神' : day.track.hits + '/3 命中') : '开始';
    let thirdVal = '开始';
    if (day.third) {
      const t = day.third;
      if (t.type === 'stroop') thirdVal = t.count + ' 个';
      if (t.type === 'reverse') thirdVal = t.score + '/' + t.total;
      if (t.type === 'flash') thirdVal = t.score + '/' + t.total;
      if (t.type === 'rhythm') thirdVal = t.hitRate + '%';
    }

    const third = THIRD_INFO[plan.thirdId];

    return '<section class="hero">' +
      '<div class="date">' + d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · 星期' + WEEK[d.getDay()] + '</div>' +
      '<h1>' + (doneCount === 3 ? '今天的三练已完成' : '今天练三项') + '</h1>' +
      '<div class="sub"><span class="pill"><b style="font-weight:600">今日主题</b> · ' + (plan.thirdId === 'stroop' ? '抗干扰' : plan.thirdId === 'reverse' ? '工作记忆' : plan.thirdId === 'flash' ? '空间记忆' : '节奏稳定') + '</span>' +
      '<span style="color:var(--tx3);font-size:12.5px">约 8 分钟 · 三项</span></div>' +
      '</section>' +
      '<div class="progress-card">' +
      '<div class="ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="4"/>' +
      '<circle cx="22" cy="22" r="19" fill="none" stroke="#4ee0c1" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + dash.toFixed(1) + '" transform="rotate(-90 22 22)"/></svg>' +
      '<span class="num">' + doneCount + '/3</span></div>' +
      '<div class="pc-main"><div class="pc-t">' + (doneCount === 3 ? '已完成今日打卡' : '今日进度') + '</div>' +
      '<div class="pc-d">' + (doneCount === 0 ? '从任意一项开始，顺序不重要' : doneCount === 3 ? '明天会有新的组合与参数' : '还剩 ' + (3 - doneCount) + ' 项没做') + '</div></div>' +
      '</div>' +
      '<div class="list">' +
      cardHtml('schulte', '舒尔特方格', '▦', schulteDesc(plan), schulteVal, !!day.schulte, plan.size >= 6 ? '今日加难' : '') +
      cardHtml('track', '追踪小球', '◎', trackDesc(plan), trackVal, !!day.track, '') +
      cardHtml('third', third.name, third.ic, thirdDesc(plan), thirdVal, !!day.third, '每日轮换') +
      '</div>' +
      '<div class="hint-card">今日提示：' + plan.tip + '</div>' +
      '<p class="footnote">训练方案由日期自动生成，每天参数都不同；换设备或清缓存后，同一天仍是同一套方案。</p>';
  }

  function cardHtml(key, title, icon, desc, val, done, badge) {
    return '<button class="card' + (done ? ' done' : '') + '" data-open="' + key + '">' +
      '<span class="card-ic">' + icon + '</span>' +
      '<span class="card-main"><span class="card-t">' + title +
      (badge ? '<span class="badge">' + badge + '</span>' : '') + '</span>' +
      '<span class="card-d">' + desc + '</span></span>' +
      '<span class="card-st">' + (done ? '<b>' + val + '</b><span>已完成</span>' : '<b>' + val + '</b><span>未开始</span>') + '</span>' +
      '</button>';
  }

  function viewHistory() {
    const td = new Date(); td.setHours(0, 0, 0, 0);
    const dow = (td.getDay() + 6) % 7;
    const monday = new Date(td); monday.setDate(td.getDate() - dow);
    const start = new Date(monday); start.setDate(monday.getDate() - 49);

    let cells = '';
    for (let i = 0; i < 56; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const ds = dstr(d);
      const cnt = db.days[ds] ? ['schulte', 'track', 'third'].filter(k => db.days[ds][k]).length : 0;
      const cls = 'hc' + (cnt === 1 ? ' l1' : cnt === 2 ? ' l2' : cnt === 3 ? ' l3' : '') +
        (ds === todayStr() ? ' today' : '') + (d > td ? ' future' : '');
      cells += '<div class="' + cls + '">' + d.getDate() + '</div>';
    }

    const t = statTotals();
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(td); d.setDate(td.getDate() - i);
      const ds = dstr(d);
      const r = db.days[ds];
      const cnt = r ? ['schulte', 'track', 'third'].filter(k => r[k]).length : 0;
      last7.push('<div class="dl"><span class="d">' + (d.getMonth() + 1) + '/' + d.getDate() + ' 星期' + WEEK[d.getDay()] + '</span>' +
        '<span class="' + (cnt === 3 ? 'ok' : 'n') + '">' + (cnt ? cnt + ' / 3 项' : '未训练') + '</span></div>');
    }

    return '<section class="hero" style="padding-bottom:14px"><div class="date">记录</div><h1>' + (calcStreak() ? '坚持第 ' + calcStreak() + ' 天' : '还没开始，今天就是第 1 天') + '</h1></section>' +
      '<div class="heat"><div class="heat-head"><span class="t">最近 8 周</span><span class="s">完整打卡 ' + t.full + ' 天 · 共 ' + t.items + ' 项</span></div>' +
      '<div class="wk"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
      '<div class="heat-grid">' + cells + '</div>' +
      '<div class="heat-legend"><span>少</span><i style="background:rgba(255,255,255,.05)"></i><i style="background:rgba(78,224,193,.18)"></i><i style="background:rgba(78,224,193,.42)"></i><i style="background:#4ee0c1"></i><span>多</span></div>' +
      '</div>' +
      '<div class="section-title">最近 7 天</div>' +
      '<div class="daylist" style="background:var(--card);border:1px solid var(--line);border-radius:18px;padding:4px 16px 8px">' + last7.join('') + '</div>' +
      '<p class="footnote">颜色越亮代表当天完成的项目越多，三项全绿即为完整打卡。</p>';
  }

  function viewMe() {
    const t = statTotals();
    const streak = calcStreak();
    const bestSch = bestSchulte();
    const bestDr = bestDrift();
    return '<section class="hero" style="padding-bottom:14px"><div class="date">我的</div><h1>专注力账本</h1></section>' +
      '<div class="stat-grid">' +
      statCard(streak, '连续打卡（天）') +
      statCard(t.full, '完整打卡（天）') +
      statCard(t.items, '累计训练（项）') +
      statCard(Math.round(t.mins), '累计专注（分钟）') +
      '</div>' +
      '<div class="section-title">个人最好</div>' +
      '<div class="row"><span class="k">舒尔特方格 · 最快</span><span class="v">' + (bestSch ? bestSch.toFixed(1) + '<small>秒</small>' : '—') + '</span></div>' +
      '<div class="row"><span class="k">追踪小球 · 最少走神</span><span class="v">' + (bestDr !== null ? bestDr + '<small>次</small>' : '—') + '</span></div>' +
      '<div class="row"><span class="k">色词干扰 · 最高答对</span><span class="v">' + (t.bestTh.stroop ? t.bestTh.stroop + '<small>个</small>' : '—') + '</span></div>' +
      '<div class="row"><span class="k">数字反序 · 最高位数</span><span class="v">' + (t.bestTh.reverse ? t.bestTh.reverse + '<small>位</small>' : '—') + '</span></div>' +
      '<div class="row"><span class="k">闪点记忆 · 最高全对</span><span class="v">' + (t.bestTh.flash !== undefined ? t.bestTh.flash + '<small>轮</small>' : '—') + '</span></div>' +
      '<div class="row" style="border-radius:0 0 18px 18px"><span class="k">节拍专注 · 最高命中率</span><span class="v">' + (t.bestTh.rhythm ? t.bestTh.rhythm + '<small>%</small>' : '—') + '</span></div>' +
      '<div class="section-title">设置</div>' +
      '<div class="row" style="border-radius:18px;margin-bottom:8px"><span class="k">训练音效</span><span class="switch" data-sound></span></div>' +
      '<div class="row" style="border-radius:18px;margin-bottom:16px"><span class="k">清空所有记录</span><button class="btn sm ghost" data-clear>清空</button></div>' +
      '<div class="hint-card">iPhone：Safari 打开链接 → 分享 → 「添加到主屏幕」，就会像 App 一样全屏运行，断网也能练（已缓存）。数据保存在本机浏览器里，不上传。</div>' +
      '<p class="footnote">专注日课 v1 · 三项/天 · 每日参数自动更新</p>';
  }

  function statCard(v, k) {
    return '<div class="stat"><div class="sv">' + v + '</div><div class="sk">' + k + '</div></div>';
  }

  /* ================= 启动 ================= */
  render();

  // 跨过零点后自动切到新一天
  setInterval(() => {
    if (stage.hidden && tab === 'today') {
      const cur = todayStr();
      if (cur !== render._day) { render._day = cur; render(); }
    }
  }, 30000);
  render._day = todayStr();

})();
