// 화면 전체 기술 이펙트 — 전부 오리지널 canvas 파티클 애니메이션.
// effect 종류(leaf/fire/water/electric)를 쿼리로 받아 재생 후 페이드아웃.
(function () {
  const effect = new URLSearchParams(location.search).get('effect') || 'leaf';
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const DURATION = 2600;
  const FADE_IN = 180;
  const FADE_OUT = 550;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const COLORS = {
    leaf: ['#3a9e3a', '#57b84f', '#2e7d32', '#7cc576'],
    fire: ['#f8c838', '#e08a1e', '#d13b27', '#ff6a3d'],
    water: ['#1e6bd1', '#7ac6ff', '#4aa8ff', '#bfe6ff'],
    electric: ['#f8c838', '#ffffff', '#fff27a'],
  };

  // --- 파티클 초기화 (효과별) ---
  let parts = [];
  function init() {
    if (effect === 'leaf') {
      for (let i = 0; i < 80; i++) {
        parts.push({
          baseX: rand(0, W), y: rand(-H * 0.5, H * 0.4), vy: rand(40, 105),
          sway: rand(20, 55), freq: rand(0.5, 1.6), phase: rand(0, 6.28),
          rot: rand(0, 6.28), vrot: rand(-2.5, 2.5), size: rand(9, 20), c: pick(COLORS.leaf),
        });
      }
    } else if (effect === 'fire') {
      for (let i = 0; i < 150; i++) {
        parts.push({
          x: rand(0, W), delay: rand(0, 1.7), life: rand(0.8, 1.6),
          vy: rand(70, 190), drift: rand(-40, 40), size: rand(4, 11), c: pick(COLORS.fire),
        });
      }
    } else if (effect === 'water') {
      for (let i = 0; i < 130; i++) {
        parts.push({
          x: rand(0, W), delay: rand(0, 1.4), life: rand(0.5, 1.0),
          vy: rand(280, 620), len: rand(10, 26), c: pick(COLORS.water),
        });
      }
    }
    // electric은 프레임에서 동적으로 볼트를 생성(아래).
  }
  init();

  // electric 볼트 상태
  let bolts = [];
  let lastBolt = -1;

  function makeBolt() {
    const x = rand(W * 0.1, W * 0.9);
    const segs = [];
    let cx = x, cy = 0;
    const steps = Math.floor(rand(6, 11));
    const stepY = H / steps;
    for (let s = 0; s <= steps; s++) {
      segs.push({ x: cx, y: cy });
      cx += rand(-60, 60);
      cy += stepY;
    }
    return { segs, born: nowT, life: rand(0.12, 0.22), c: pick(COLORS.electric), w: rand(2, 4) };
  }

  // --- 그리기 ---
  function drawLeaf(p, t) {
    const x = p.baseX + Math.sin(t * p.freq + p.phase) * p.sway;
    ctx.save();
    ctx.translate(x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.5, p.size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -p.size); ctx.lineTo(0, p.size);
    ctx.stroke();
    ctx.restore();
  }

  let nowT = 0; // 초 단위 경과
  let startTs = null;

  function frame(ts) {
    if (startTs === null) startTs = ts;
    const elapsed = ts - startTs; // ms
    nowT = elapsed / 1000;
    const dt = 1 / 60;

    ctx.clearRect(0, 0, W, H);
    let alpha = 1;
    if (elapsed < FADE_IN) alpha = elapsed / FADE_IN;
    else if (elapsed > DURATION - FADE_OUT) alpha = Math.max(0, (DURATION - elapsed) / FADE_OUT);
    ctx.globalAlpha = alpha;

    if (effect === 'leaf') {
      for (const p of parts) {
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        if (p.y > H + 30) p.y = -30;
        drawLeaf(p, nowT);
      }
    } else if (effect === 'fire') {
      for (const p of parts) {
        const age = nowT - p.delay;
        if (age < 0 || age > p.life) continue;
        const f = age / p.life; // 0..1
        const y = H - f * p.vy * p.life * 3.2;
        const x = p.x + Math.sin(age * 6 + p.x) * p.drift * f;
        ctx.globalAlpha = alpha * (1 - f);
        ctx.fillStyle = p.c;
        const s = p.size * (1 - f * 0.6);
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (effect === 'water') {
      ctx.lineCap = 'round';
      for (const p of parts) {
        const age = nowT - p.delay;
        if (age < 0 || age > p.life) continue;
        const y = age * p.vy;
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, y);
        ctx.lineTo(p.x, y + p.len);
        ctx.stroke();
      }
    } else if (effect === 'electric') {
      // 주기적으로 볼트 생성
      if (nowT - lastBolt > 0.11 && elapsed < DURATION - FADE_OUT) {
        bolts.push(makeBolt());
        if (Math.random() < 0.5) bolts.push(makeBolt());
        lastBolt = nowT;
      }
      bolts = bolts.filter((b) => nowT - b.born < b.life);
      for (const b of bolts) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = b.c;
        ctx.lineWidth = b.w;
        ctx.shadowColor = '#f8c838';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(b.segs[0].x, b.segs[0].y);
        for (let i = 1; i < b.segs.length; i++) ctx.lineTo(b.segs[i].x, b.segs[i].y);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    if (elapsed < DURATION) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, W, H); // 메인이 곧 창을 닫지만 마지막 프레임은 깨끗하게
    }
  }
  requestAnimationFrame(frame);
})();
