// 화면 전체 기술 이펙트 — 전부 오리지널 canvas 파티클 애니메이션.
// effect 종류를 쿼리로 받아 재생 후 페이드아웃. 종류별로 서로 다른 움직임.
(function () {
  const effect = new URLSearchParams(location.search).get('effect') || 'leaf';
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const DURATION = 2600, FADE_IN = 180, FADE_OUT = 550;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const TAU = Math.PI * 2;

  const COL = {
    leaf: ['#3a9e3a', '#57b84f', '#2e7d32', '#7cc576'],
    fire: ['#f8c838', '#e08a1e', '#d13b27', '#ff6a3d'],
    water: ['#1e6bd1', '#7ac6ff', '#4aa8ff', '#bfe6ff'],
    electric: ['#f8c838', '#ffffff', '#fff27a'],
  };
  const family = effect.split('_')[0];
  const colors = COL[family] || COL.leaf;

  let parts = [];
  let bolts = [];
  let lastBolt = -1;
  let flashUntil = -1;

  // 진화 변신용: 이전/다음 폼 이미지(main이 data URL로 전달) + 흰 실루엣 사전 생성.
  const MORPH = 176;
  let fromImg = null, toImg = null, fromSil = null, toSil = null;
  function makeSilhouette(img) {
    const c = document.createElement('canvas');
    c.width = MORPH; c.height = MORPH;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, MORPH, MORPH);
    g.globalCompositeOperation = 'source-atop'; // 불투명 픽셀만 흰색으로 칠함 → 실루엣
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, MORPH, MORPH);
    return c;
  }
  if (effect === 'evolve') {
    const q = new URLSearchParams(location.search);
    const f = q.get('from'), t = q.get('to');
    if (f) { fromImg = new Image(); fromImg.onload = () => { try { fromSil = makeSilhouette(fromImg); } catch { /* ignore */ } }; fromImg.src = f; }
    if (t) { toImg = new Image(); toImg.onload = () => { try { toSil = makeSilhouette(toImg); } catch { /* ignore */ } }; toImg.src = t; }
  }

  function setup() {
    if (effect === 'leaf') {
      for (let i = 0; i < 80; i++) parts.push({
        baseX: rand(0, W), y: rand(-H * 0.5, H * 0.4), vy: rand(40, 105),
        sway: rand(20, 55), freq: rand(0.5, 1.6), phase: rand(0, TAU),
        rot: rand(0, TAU), vrot: rand(-2.5, 2.5), size: rand(9, 20), c: pick(colors),
      });
    } else if (effect === 'leaf_swirl') {
      // 화면 중앙을 도는 소용돌이(회오리)
      for (let i = 0; i < 90; i++) parts.push({
        angle: rand(0, TAU), radius: rand(20, Math.min(W, H) * 0.45),
        av: rand(1.6, 3.2), rot: rand(0, TAU), vrot: rand(-4, 4),
        size: rand(8, 18), c: pick(colors), yoff: rand(-40, 40),
      });
    } else if (effect === 'fire') {
      for (let i = 0; i < 150; i++) parts.push({
        x: rand(0, W), delay: rand(0, 1.7), life: rand(0.8, 1.6),
        vy: rand(70, 190), drift: rand(-40, 40), size: rand(4, 11), c: pick(colors),
      });
    } else if (effect === 'fire_breath') {
      // 하단 중앙에서 위로 부채꼴로 뿜는 큰 불꽃
      for (let i = 0; i < 110; i++) parts.push({
        ang: rand(Math.PI * 0.15, Math.PI * 0.85), speed: rand(240, 620),
        delay: rand(0, 1.0), life: rand(0.7, 1.4), size: rand(12, 30), c: pick(colors),
      });
    } else if (effect === 'water') {
      for (let i = 0; i < 130; i++) parts.push({
        x: rand(0, W), delay: rand(0, 1.4), life: rand(0.5, 1.0),
        vy: rand(280, 620), len: rand(10, 26), c: pick(colors),
      });
    } else if (effect === 'water_bubbles') {
      // 아래에서 떠오르는 거품(테두리 원) + 좌우 흔들림
      for (let i = 0; i < 90; i++) parts.push({
        x: rand(0, W), delay: rand(0, 1.6), life: rand(1.0, 2.0),
        vy: rand(80, 220), size: rand(5, 18), amp: rand(6, 22), freq: rand(1, 3),
        phase: rand(0, TAU), c: pick(colors),
      });
    } else if (effect === 'electric') {
      // 무작위 위치에서 깜빡이는 스파크 점
      for (let i = 0; i < 70; i++) parts.push({
        x: rand(0, W), y: rand(0, H), size: rand(2, 6),
        on: rand(0, 1), blink: rand(6, 16), phase: rand(0, TAU), c: pick(colors),
      });
    } else if (effect === 'hatch') {
      // 부화: 중앙에서 바깥으로 튀는 별 반짝이 (오리지널 연출)
      for (let i = 0; i < 60; i++) parts.push({
        ang: rand(0, TAU), speed: rand(120, 460), size: rand(3, 9),
        c: pick(['#ffffff', '#f8c838', '#fff27a']), spin: rand(-6, 6), delay: rand(0, 0.45),
      });
    } else if (effect === 'evolve') {
      // 진화: 바깥에서 중앙으로 모여드는 에너지(수렴) + 이후 폭발용 별
      for (let i = 0; i < 70; i++) parts.push({
        ang: rand(0, TAU), r0: rand(Math.min(W, H) * 0.25, Math.max(W, H) * 0.6),
        size: rand(2, 6), c: pick(['#ffffff', '#7ac6ff', '#f8c838', '#fff27a']),
        spin: rand(-6, 6), delay: rand(0, 0.3),
      });
    }
    // electric_bolts는 프레임 루프에서 동적으로 큰 볼트 + 화면 번쩍 생성
  }
  setup();

  function makeBolt(big) {
    const x = rand(W * 0.08, W * 0.92);
    const segs = [];
    let cx = x, cy = 0;
    const steps = Math.floor(rand(7, 12));
    const stepY = H / steps;
    for (let s = 0; s <= steps; s++) {
      segs.push({ x: cx, y: cy });
      cx += rand(-70, 70);
      cy += stepY;
    }
    return { segs, born: nowT, life: rand(0.14, 0.26), c: pick(COL.electric), w: big ? rand(3, 6) : rand(2, 3.5) };
  }

  function drawLeaf(x, y, rot, size, c) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.5, size, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -size); ctx.lineTo(0, size);
    ctx.stroke();
    ctx.restore();
  }

  function drawBolts(alpha) {
    if (nowT - lastBolt > 0.11 && elapsed < DURATION - FADE_OUT) {
      const big = effect === 'electric_bolts';
      bolts.push(makeBolt(big));
      if (big) { bolts.push(makeBolt(true)); flashUntil = nowT + 0.06; }
      else if (Math.random() < 0.4) bolts.push(makeBolt(false));
      lastBolt = nowT;
    }
    if (effect === 'electric_bolts' && nowT < flashUntil) {
      ctx.globalAlpha = alpha * 0.28;
      ctx.fillStyle = '#fff27a';
      ctx.fillRect(0, 0, W, H);
    }
    bolts = bolts.filter((b) => nowT - b.born < b.life);
    for (const b of bolts) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = b.c;
      ctx.lineWidth = b.w;
      ctx.shadowColor = '#f8c838';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(b.segs[0].x, b.segs[0].y);
      for (let i = 1; i < b.segs.length; i++) ctx.lineTo(b.segs[i].x, b.segs[i].y);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  let nowT = 0, elapsed = 0, startTs = null;

  function frame(ts) {
    if (startTs === null) startTs = ts;
    elapsed = ts - startTs;
    nowT = elapsed / 1000;
    const dt = 1 / 60;

    ctx.clearRect(0, 0, W, H);
    let alpha = 1;
    if (elapsed < FADE_IN) alpha = elapsed / FADE_IN;
    else if (elapsed > DURATION - FADE_OUT) alpha = Math.max(0, (DURATION - elapsed) / FADE_OUT);
    ctx.globalAlpha = alpha;

    if (effect === 'leaf') {
      for (const p of parts) {
        p.y += p.vy * dt; p.rot += p.vrot * dt;
        if (p.y > H + 30) p.y = -30;
        const x = p.baseX + Math.sin(nowT * p.freq + p.phase) * p.sway;
        drawLeaf(x, p.y, p.rot, p.size, p.c);
      }
    } else if (effect === 'leaf_swirl') {
      const cx = W / 2, cy = H / 2;
      for (const p of parts) {
        p.angle += p.av * dt; p.rot += p.vrot * dt;
        const x = cx + Math.cos(p.angle) * p.radius;
        const y = cy + Math.sin(p.angle) * p.radius * 0.62 + p.yoff;
        drawLeaf(x, y, p.rot, p.size, p.c);
      }
    } else if (effect === 'fire') {
      for (const p of parts) {
        const age = nowT - p.delay;
        if (age < 0 || age > p.life) continue;
        const f = age / p.life;
        const y = H - f * p.vy * p.life * 3.2;
        const x = p.x + Math.sin(age * 6 + p.x) * p.drift * f;
        ctx.globalAlpha = alpha * (1 - f);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (1 - f * 0.6), 0, TAU);
        ctx.fill();
      }
    } else if (effect === 'fire_breath') {
      const ox = W / 2, oy = H + 10;
      for (const p of parts) {
        const age = nowT - p.delay;
        if (age < 0 || age > p.life) continue;
        const f = age / p.life;
        const d = p.speed * age;
        const x = ox + Math.cos(p.ang) * d;
        const y = oy - Math.sin(p.ang) * d;
        ctx.globalAlpha = alpha * (1 - f) * 0.95;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(x, y, p.size * (1 - f * 0.5), 0, TAU);
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
        ctx.moveTo(p.x, y); ctx.lineTo(p.x, y + p.len);
        ctx.stroke();
      }
    } else if (effect === 'water_bubbles') {
      for (const p of parts) {
        const age = nowT - p.delay;
        if (age < 0 || age > p.life) continue;
        const f = age / p.life;
        const y = H + 20 - age * p.vy;
        const x = p.x + Math.sin(age * p.freq + p.phase) * p.amp;
        ctx.globalAlpha = alpha * (1 - f * 0.7);
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = alpha * (1 - f) * 0.5; // 하이라이트
        ctx.beginPath();
        ctx.arc(x - p.size * 0.3, y - p.size * 0.3, p.size * 0.25, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    } else if (effect === 'electric') {
      for (const p of parts) {
        const on = (Math.sin(nowT * p.blink + p.phase) + 1) / 2; // 0..1 깜빡임
        ctx.globalAlpha = alpha * on;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
      drawBolts(alpha); // 작은 볼트도 간간이
    } else if (effect === 'electric_bolts') {
      drawBolts(alpha);
    } else if (effect === 'hatch') {
      const cx = W / 2, cy = H / 2;
      // 1) 알 + 균열 (0~0.6s)
      if (nowT < 0.6) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff8e0';
        ctx.strokeStyle = '#1a1400';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 30, 40, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        const cp = Math.min(1, nowT / 0.6); // 균열 진행
        ctx.lineWidth = 2;
        ctx.beginPath();
        let zx = cx - 24, zy = cy - 12;
        ctx.moveTo(zx, zy);
        for (let i = 0; i < Math.floor(7 * cp); i++) { zx += 8; zy += (i % 2 ? 9 : -9); ctx.lineTo(zx, zy); }
        ctx.stroke();
      }
      // 2) 빛 폭발 (0.45~1.3s): 방사 그라디언트 + 광선
      if (nowT > 0.45 && nowT < 1.3) {
        const bp = (nowT - 0.45) / 0.85;
        const r = Math.max(1, bp * Math.max(W, H) * 0.75);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,255,255,${alpha * (1 - bp)})`);
        g.addColorStop(0.5, `rgba(248,200,56,${alpha * (1 - bp) * 0.6})`);
        g.addColorStop(1, 'rgba(248,200,56,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = `rgba(255,242,122,${alpha * (1 - bp)})`;
        ctx.lineWidth = 3;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + nowT * 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.stroke();
        }
      }
      // 3) 별 반짝이 (0.6s~): 중앙에서 바깥으로 + 약한 중력
      for (const p of parts) {
        const age = nowT - 0.6 - p.delay;
        if (age < 0) continue;
        const d = p.speed * age;
        const x = cx + Math.cos(p.ang) * d;
        const y = cy + Math.sin(p.ang) * d + 60 * age * age;
        ctx.save();
        ctx.globalAlpha = alpha * Math.max(0, 1 - age / 1.6);
        ctx.translate(x, y);
        ctx.rotate(age * p.spin);
        ctx.fillStyle = p.c;
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s, 0); ctx.lineTo(s * 0.3, s * 0.3);
        ctx.lineTo(0, s); ctx.lineTo(-s * 0.3, s * 0.3); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.3, -s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (effect === 'evolve' && (fromImg || toImg)) {
      // 가운데 변신: 현재 폼 실루엣이 점점 빠르게 점멸 → 흰 플래시 → 새 폼 공개 + 별 폭발.
      // (원작 애니 복제가 아니라 흔한 변신 연출을 이미지로 표현)
      const cx = W / 2, cy = H / 2;
      const dx = cx - MORPH / 2, dy = cy - MORPH / 2;
      ctx.imageSmoothingEnabled = false;
      if (nowT < 1.45) {
        const speed = 4 + nowT * 9;                 // 점멸 가속
        const showTo = Math.floor(nowT * speed) % 2 === 1;
        const sil = showTo ? (toSil || fromSil) : (fromSil || toSil);
        ctx.globalAlpha = alpha;
        if (sil) ctx.drawImage(sil, dx, dy);
        else if (fromImg && fromImg.complete) ctx.drawImage(fromImg, dx, dy, MORPH, MORPH);
      } else if (toImg && toImg.complete) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(toImg, dx, dy, MORPH, MORPH); // 새 폼 공개(컬러)
      }
      // 흰 플래시(1.3~1.6s)
      if (nowT > 1.3 && nowT < 1.6) {
        const fp = 1 - Math.abs((nowT - 1.45) / 0.15);
        ctx.globalAlpha = Math.max(0, fp) * alpha;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
      }
      // 공개 후 별 폭발(1.5s~)
      for (const p of parts) {
        const age = nowT - 1.5 - p.delay;
        if (age < 0) continue;
        const d = (p.r0 * 0.4 + 80) * age;
        const x = cx + Math.cos(p.ang) * d, y = cy + Math.sin(p.ang) * d;
        ctx.save();
        ctx.globalAlpha = alpha * Math.max(0, 1 - age / 1.1);
        ctx.translate(x, y);
        ctx.rotate(age * p.spin);
        ctx.fillStyle = p.c;
        const s = p.size + 2;
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s, 0); ctx.lineTo(s * 0.3, s * 0.3);
        ctx.lineTo(0, s); ctx.lineTo(-s * 0.3, s * 0.3); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.3, -s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (effect === 'evolve') {
      // 이미지가 없을 때(코드 도트 펫): 파티클 진화 연출(수렴→플래시→별).
      const cx = W / 2, cy = H / 2;
      // 1) 수렴 (0~1.1s): 바깥의 에너지가 중앙으로 모임
      const conv = Math.min(1, nowT / 1.1);
      for (const p of parts) {
        const age = nowT - p.delay;
        if (age < 0) continue;
        if (nowT < 1.1) {
          const r = p.r0 * (1 - conv);
          const x = cx + Math.cos(p.ang) * r;
          const y = cy + Math.sin(p.ang) * r;
          ctx.globalAlpha = alpha * (0.4 + 0.6 * conv);
          ctx.strokeStyle = p.c;
          ctx.lineWidth = p.size * 0.6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(cx + Math.cos(p.ang) * (r + 14), cy + Math.sin(p.ang) * (r + 14));
          ctx.stroke();
        }
      }
      // 2) 플래시 (1.05~1.55s): 흰 화면 피크
      if (nowT > 1.05 && nowT < 1.55) {
        const fp = 1 - Math.abs((nowT - 1.3) / 0.25); // 1.3s에서 최대
        ctx.globalAlpha = Math.max(0, fp) * alpha;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
      }
      // 3) 폭발 별 (1.4s~): 중앙에서 바깥으로 + 페이드
      for (const p of parts) {
        const age = nowT - 1.4 - p.delay;
        if (age < 0) continue;
        const d = (p.r0 * 0.5 + 80) * age;
        const x = cx + Math.cos(p.ang) * d;
        const y = cy + Math.sin(p.ang) * d;
        ctx.save();
        ctx.globalAlpha = alpha * Math.max(0, 1 - age / 1.1);
        ctx.translate(x, y);
        ctx.rotate(age * p.spin);
        ctx.fillStyle = p.c;
        const s = p.size + 2;
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s, 0); ctx.lineTo(s * 0.3, s * 0.3);
        ctx.lineTo(0, s); ctx.lineTo(-s * 0.3, s * 0.3); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.3, -s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    if (elapsed < DURATION) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
})();
