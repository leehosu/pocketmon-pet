import { loadSpriteCutout } from './sprite-alpha.js';
import { PokegoldAnimationRenderer, pokegoldBattleLayout } from './pokegold-anim-renderer.js';
import { PokegoldAnimationVM } from './pokegold-anim-vm.js';

// Gold 기술은 pret/pokegold VM으로, 부화/진화 연출은 기존 canvas 애니메이션으로 재생한다.
(function () {
  const query = new URLSearchParams(location.search);
  const effect = query.get('effect') || 'leaf';
  const spriteSource = query.get('sprite');
  const useBattleLayout = query.get('layout') === 'battle';
  const battleActor = query.get('actor') || 'player';
  const isPreview = query.get('preview') === '1';
  const frozenFrame = query.has('frame') ? Math.max(0, Number(query.get('frame')) || 0) : null;
  const isPokegold = effect.startsWith('gsc_');
  if (isPreview) document.documentElement.classList.add('preview');
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

  let pokemonSprite = null;
  const spritePromise = spriteSource
    ? loadSpriteCutout(spriteSource)
      .then((sprite) => { pokemonSprite = sprite; })
      .catch(() => { pokemonSprite = null; })
    : Promise.resolve();
  const pokegoldVm = isPokegold ? new PokegoldAnimationVM(effect) : null;
  const pokegoldRenderer = isPokegold ? new PokegoldAnimationRenderer() : null;
  let pokegoldReady = !isPokegold;
  if (isPokegold) {
    Promise.all([pokegoldRenderer.load(), spritePromise]).then(() => {
      pokegoldReady = true;
      document.documentElement.dataset.pokegoldReady = 'true';
    });
    window.__pokegoldAnimation = { effect, vm: pokegoldVm, renderer: pokegoldRenderer };
  }

  const COL = {
    leaf: ['#3a9e3a', '#57b84f', '#2e7d32', '#7cc576'],
    fire: ['#f8c838', '#e08a1e', '#d13b27', '#ff6a3d'],
    water: ['#1e6bd1', '#7ac6ff', '#4aa8ff', '#bfe6ff'],
    electric: ['#f8c838', '#ffffff', '#fff27a'],
  };
  const family = effect.split('_')[0];
  const colors = COL[family] || COL.leaf;

  // 부드러운 방사형 글로우 스프라이트를 한 번만 만들어 두고(성능) additive로 겹쳐 불꽃을 그린다.
  // 매 프레임 createRadialGradient를 호출하지 않아 각진 벡터가 아닌 진짜 불처럼 부드럽게 빛난다.
  function makeGlow(size, r, g, b) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d'); const h = size / 2;
    const grd = x.createRadialGradient(h, h, 0, h, h, h);
    grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grd.addColorStop(0.4, `rgba(${r},${g},${b},0.55)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd; x.fillRect(0, 0, size, size);
    return c;
  }
  const GLOW = {
    fire: [makeGlow(128, 255, 236, 140), makeGlow(128, 240, 140, 40), makeGlow(128, 209, 59, 39)],
  };
  // 하단(ox,oy)에서 위로 타오르는 부드러운 불기둥. 글로우 스프라이트를 세로로 쌓아 난류로 흔든다.
  function flameColumn(a, ox, oy, height, width, t, seed) {
    const [gY, gO, gR] = GLOW.fire;
    ctx.globalCompositeOperation = 'lighter';
    const N = 26;
    for (let i = 0; i < N; i++) {
      const f = i / N;                                   // 0(밑동)~1(끝)
      const sway = Math.sin(t * 6 + seed + f * 6) * width * 0.5 * f + Math.sin(t * 11 + seed * 2 + f * 10) * width * 0.18;
      const x = ox + sway;
      const y = oy - f * height - Math.sin(t * 9 + seed) * 4;
      const wob = 0.85 + 0.3 * Math.sin(t * 14 + i + seed);
      const s = width * (1.15 - f * 0.85) * wob;         // 밑동 큼→끝 작음
      const img = f < 0.33 ? gY : (f < 0.7 ? gO : gR);   // 밑/속 노랑→중간 주황→끝 빨강
      ctx.globalAlpha = a * (1 - f * 0.7) * 0.9;
      ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
    }
    for (let i = 0; i < 14; i++) {                       // 속불 밝은 코어
      const f = i / 14; const x = ox + Math.sin(t * 7 + seed + f * 5) * width * 0.18 * f;
      const y = oy - f * height * 0.72; const s = width * 0.5 * (1 - f * 0.8);
      ctx.globalAlpha = a * (1 - f) * 0.9; ctx.drawImage(gY, x - s / 2, y - s / 2, s, s);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

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
    const f = query.get('from'), t = query.get('to');
    if (f) { fromImg = new Image(); fromImg.onload = () => { try { fromSil = makeSilhouette(fromImg); } catch { /* ignore */ } }; fromImg.src = f; }
    if (t) { toImg = new Image(); toImg.onload = () => { try { toSil = makeSilhouette(toImg); } catch { /* ignore */ } }; toImg.src = t; }
  }

  function setup() {
    if (effect === 'leaf') {
      for (let i = 0; i < 120; i++) parts.push({
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
      for (let i = 0; i < 220; i++) parts.push({
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
      for (let i = 0; i < 180; i++) parts.push({
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
      for (let i = 0; i < 110; i++) parts.push({
        x: rand(0, W), y: rand(0, H), size: rand(2, 6),
        on: rand(0, 1), blink: rand(6, 16), phase: rand(0, TAU), c: pick(colors),
      });
    } else if (effect === 'hatch') {
      // 부화: 중앙에서 바깥으로 튀는 별 반짝이 (오리지널 연출)
      for (let i = 0; i < 60; i++) parts.push({
        ang: rand(0, TAU), speed: rand(120, 460), size: rand(3, 9),
        c: pick(['#ffffff', '#f8c838', '#fff27a']), spin: rand(-6, 6), delay: rand(0, 0.45),
      });
    } else if (effect === 'fire_kanji') {
      // 大 획 위로 타오를 불티
      for (let i = 0; i < 90; i++) parts.push({
        x: rand(0, W), delay: rand(0, 1.6), life: rand(0.6, 1.3),
        vy: rand(60, 150), drift: rand(-30, 30), size: rand(3, 8), c: pick(COL.fire),
      });
    } else if (effect === 'evolve') {
      // 진화: 바깥에서 중앙으로 모여드는 에너지(수렴) + 이후 폭발용 별
      for (let i = 0; i < 70; i++) parts.push({
        ang: rand(0, TAU), r0: rand(Math.min(W, H) * 0.25, Math.max(W, H) * 0.6),
        size: rand(2, 6), c: pick(['#ffffff', '#7ac6ff', '#f8c838', '#fff27a']),
        spin: rand(-6, 6), delay: rand(0, 0.3),
      });
    } else if (effect.endsWith('_beam')) {
      // 빔 끝 스파크
      for (let i = 0; i < 40; i++) parts.push({ off: rand(0, 1), y: rand(-8, 8), size: rand(1.5, 4), c: pick(colors) });
    } else if (effect.endsWith('_impact')) {
      // 임팩트 파편(사방으로) — 길쭉한 불꽃잎, 길이/거리 지터로 폭발감
      for (let i = 0; i < 55; i++) parts.push({ ang: rand(0, TAU), speed: rand(160, 520), size: rand(2.5, 6), c: pick(colors), delay: rand(0, 0.08), lenf: rand(0.55, 1.5) });
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
    // 잔가지: 중간 지점 몇 곳에서 짧게 갈라져 나감
    const branches = [];
    const nb = big ? 3 : 1;
    for (let i = 0; i < nb; i++) {
      const from = segs[Math.floor(rand(1, segs.length - 1))];
      const bs = [{ x: from.x, y: from.y }];
      let bx = from.x, by = from.y;
      const bsteps = Math.floor(rand(2, 5));
      for (let s = 0; s < bsteps; s++) { bx += rand(-40, 40); by += rand(20, 50); bs.push({ x: bx, y: by }); }
      branches.push(bs);
    }
    return { segs, branches, born: nowT, life: rand(0.14, 0.26), c: pick(COL.electric), w: big ? rand(3, 6) : rand(2, 3.5) };
  }

  function drawLeaf(x, y, rot, size, c) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // 끝이 뾰족한 나뭇잎 실루엣(양쪽 곡선)
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.quadraticCurveTo(size * 0.62, -size * 0.15, 0, size);
    ctx.quadraticCurveTo(-size * 0.62, -size * 0.15, 0, -size);
    ctx.closePath();
    ctx.fill();
    // 잎맥
    ctx.strokeStyle = 'rgba(0,0,0,.20)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.85); ctx.lineTo(0, size * 0.85);
    ctx.stroke();
    // 하이라이트(입체감)
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.beginPath();
    ctx.ellipse(-size * 0.2, -size * 0.15, size * 0.12, size * 0.34, 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function pxRect(x, y, w, h, c, a) {
    ctx.globalAlpha = a == null ? ctx.globalAlpha : a;
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawChargeCross(cx, cy, r, c, a) {
    pxRect(cx - r, cy - 2, r * 2, 4, c, a);
    pxRect(cx - 2, cy - r, 4, r * 2, c, a);
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
      drawChargeCross(W / 2, H / 2, Math.min(W, H) * 0.18, '#fff27a', alpha * 0.28);
    }
    bolts = bolts.filter((b) => nowT - b.born < b.life);
    const strokePath = (pts, w) => {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const b of bolts) {
      ctx.shadowColor = '#f8c838';
      ctx.shadowBlur = 16;
      // 바깥 글로우(굵고 노란)
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = b.c;
      strokePath(b.segs, b.w + 2.5);
      for (const br of b.branches) strokePath(br, Math.max(1, b.w - 0.5));
      // 밝은 흰 코어
      ctx.shadowBlur = 6;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      strokePath(b.segs, Math.max(1, b.w - 1));
    }
    ctx.shadowBlur = 0;
  }

  let nowT = 0, elapsed = 0, startTs = null, alpha = 1;

  const isSkill = !['hatch', 'evolve'].includes(effect);
  // juice: 임팩트 순간 화면 흔들림 세기(px)
  function shakeFor() {
    if (effect === 'fire_kanji') return 0; // 大 획이 흔들려 휘어 보이지 않게 흔들림 제외
    if (effect === 'hatch') return (nowT > 0.45 && nowT < 1.0) ? 4 : 0;
    if (effect === 'evolve') return (nowT > 1.25 && nowT < 1.6) ? 6 : 0;
    const strong = effect.endsWith('_bolts') || effect.endsWith('_breath') ? 1.9 : 1;
    return Math.max(0, 1 - nowT / 0.8) * 3.2 * strong; // 시작 직후 강하게, 빠르게 감쇠
  }

  function continueOrFinish() {
    if (elapsed < DURATION) {
      requestAnimationFrame(frame);
    } else if (isPreview) {
      startTs = null;
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, W, H);
    }
  }

  function frame(ts) {
    if (isPokegold && !pokegoldReady) {
      ctx.clearRect(0, 0, W, H);
      requestAnimationFrame(frame);
      return;
    }
    if (startTs === null) startTs = ts;
    elapsed = ts - startTs;
    nowT = elapsed / 1000;
    const dt = 1 / 60;

    ctx.clearRect(0, 0, W, H);
    if (isPokegold) {
      const targetFrame = frozenFrame ?? Math.floor(elapsed * 60 / 1000);
      const state = pokegoldVm.seek(targetFrame);
      const layout = useBattleLayout ? pokegoldBattleLayout(W, H, battleActor === 'enemy') : null;
      pokegoldRenderer.render(ctx, state, { pokemonSprite, width: W, height: H, layout });
      document.documentElement.dataset.pokegoldFrame = String(state.frame);
      document.documentElement.dataset.pokegoldDone = String(state.done);
      if (frozenFrame != null) return;
      if (state.done) {
        if (isPreview && elapsed >= (state.frame + 30) * 1000 / 60) {
          pokegoldVm.reset();
          startTs = null;
        } else if (!isPreview) {
          ctx.clearRect(0, 0, W, H);
        }
      }
      if (isPreview || !state.done) requestAnimationFrame(frame);
      return;
    }
    alpha = 1;
    if (elapsed < FADE_IN) alpha = elapsed / FADE_IN;
    else if (elapsed > DURATION - FADE_OUT) alpha = Math.max(0, (DURATION - elapsed) / FADE_OUT);
    ctx.globalAlpha = alpha;

    // 화면 흔들림 적용(전체 드로잉을 감싼다)
    const shk = shakeFor();
    ctx.save();
    if (shk > 0.15) ctx.translate((Math.random() * 2 - 1) * shk, (Math.random() * 2 - 1) * shk);

    // 기술 계열은 배경을 칠하지 않고 이펙트 요소만 그린다.

    if (effect.endsWith('_beam')) {
      // 빔: 왼쪽에서 충전 → 화면을 가로지르는 굵은 에너지 광선(타입 색). 오리지널.
      const cyB = H / 2, ox = W * 0.14;
      ctx.globalCompositeOperation = 'lighter';
      if (nowT < 0.45) {
        const r = 10 + nowT * 70;
        const g = ctx.createRadialGradient(ox, cyB, 0, ox, cyB, r);
        g.addColorStop(0, colors[0]); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = alpha; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ox, cyB, r, 0, TAU); ctx.fill();
      } else {
        const fp = Math.min(1, (nowT - 0.45) / 0.18);
        const x2 = ox + (W - ox + 40) * fp;
        const wob = Math.sin(nowT * 45) * 4;
        ctx.lineCap = 'round';
        ctx.shadowColor = colors[0]; ctx.shadowBlur = 26;
        for (const [w, c] of [[50, colors[0]], [28, colors[1] || colors[0]], [12, '#ffffff']]) {
          ctx.globalAlpha = alpha * 0.6; ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(ox, cyB); ctx.lineTo(x2, cyB + wob); ctx.stroke();
        }
        ctx.shadowBlur = 0;
        for (const p of parts) { // 빔 끝 스파크
          ctx.globalAlpha = alpha * rand(0.3, 0.8);
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(x2 + rand(-14, 14), cyB + p.y + wob, p.size, 0, TAU); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (effect.endsWith('_impact')) {
      // 임팩트: 중심 섬광 + 확장 충격파 링 + 방사형 길쭉한 불꽃잎(타입 색). 오리지널.
      const cx = W / 2, cy = H / 2;
      ctx.globalCompositeOperation = 'lighter';
      // 중심 섬광(흰→타입색으로 페이드)
      if (nowT < 0.5) {
        const fr = Math.max(0, 1 - nowT / 0.5);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 150);
        g.addColorStop(0, `rgba(255,255,255,${alpha * 0.9 * fr})`);
        g.addColorStop(0.4, `rgba(248,200,56,${alpha * 0.5 * fr})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, 150, 0, TAU); ctx.fill();
      }
      // 얇은 충격파 링 1개(빠르게 확산하며 사라짐)
      ctx.globalAlpha = alpha * Math.max(0, 0.6 - nowT * 1.1);
      ctx.strokeStyle = colors[0]; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, nowT * 760, 0, TAU); ctx.stroke();
      // 방사형 길쭉한 불꽃잎 — ang 방향으로 늘여 그려 폭발 파편처럼
      for (const p of parts) {
        const age = nowT - p.delay;
        if (age < 0) continue;
        const d = p.speed * age * p.lenf;
        const x = cx + Math.cos(p.ang) * d, y = cy + Math.sin(p.ang) * d;
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.ang + Math.PI / 2);
        ctx.globalAlpha = alpha * Math.max(0, 1 - age * 1.6);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 3.2 * p.lenf, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (effect === 'leaf') {
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
      // 화면 폭을 가득 메우는 부드러운 불꽃 띠(여러 기둥이 이글이글)
      const n = Math.max(9, Math.round(W / 90));
      for (let k = 0; k < n; k++) {
        const ox = (k + 0.5) * W / n;
        flameColumn(alpha, ox, H, H * 0.5 * (0.7 + 0.3 * Math.sin(nowT * 5 + k)), Math.max(30, W / n * 0.5), nowT, k * 1.7);
      }
    } else if (effect === 'fire_breath') {
      // 하단 중앙에서 위로 활활 타오르는 큰 부드러운 불기둥 + 좌우 보조 불꽃. 오리지널.
      const ox = W / 2, oy = H + 6;
      const scale = W / 560;
      for (const dx of [-140, 140]) flameColumn(alpha * 0.85, ox + dx * scale, oy, H * 0.55, 70 * scale, nowT, dx);
      for (const dx of [-70, 70]) flameColumn(alpha * 0.9, ox + dx * scale, oy, H * 0.75, 90 * scale, nowT, dx * 3);
      flameColumn(alpha, ox, oy, H * 0.95, 150 * scale, nowT, 0);
    } else if (effect === 'fire_kanji') {
      // 큰 대(大) 글자를 불로 — 획이 차례로 타오르며 그려진다. (大는 공용 한자, 애니는 오리지널)
      const cx = W / 2, cy = H / 2, S = Math.min(W, H) * 0.58;
      // 大 3획: 가로(一) → 왼쪽 삐침(丿, 위 중앙에서 왼쪽 아래로) → 오른쪽 파임(乀, 교차점에서 오른쪽 아래로)
      // 왼쪽 삐침이 가로선과 만나는 교차점(≈ x -0.06, y -0.22)에서 오른쪽 파임이 시작해야 大가 제대로 보임
      const strokes = [
        [[-0.5, -0.22], [0.5, -0.22]],   // 一
        [[0.10, -0.5], [-0.48, 0.52]],   // 丿
        [[-0.06, -0.22], [0.48, 0.52]],  // 乀
      ];
      // 획 등장 진행도 + 끝점 계산
      const ends = strokes.map(([a, b], si) => {
        const p = Math.min(1, Math.max(0, (nowT - si * 0.22) / 0.35));
        const ax = cx + a[0] * S, ay = cy + a[1] * S;
        return { ax, ay, ex: ax + (b[0] * S - a[0] * S) * p, ey: ay + (b[1] * S - a[1] * S) * p, p };
      });
      ctx.globalCompositeOperation = 'lighter'; // additive 글로우(shadowBlur 미사용 — 성능)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // 1) 매끈한 굵은 획: 어두운빨강→빨강→주황→노랑 코어 레이어(살짝 flicker)
      const flickW = 0.92 + 0.08 * Math.sin(nowT * 18);
      for (const [w, c] of [[46, '#5a1108'], [34, '#d13b27'], [20, '#e08a1e'], [9, '#f8c838']]) {
        ctx.strokeStyle = c; ctx.lineWidth = w * flickW;
        for (const e of ends) {
          if (e.p <= 0) continue;
          ctx.globalAlpha = alpha * 0.55;
          ctx.beginPath(); ctx.moveTo(e.ax, e.ay); ctx.lineTo(e.ex, e.ey); ctx.stroke();
        }
      }
      // 2) 획 위로 솟는 작은 불꽃 텅(이글이글)
      ctx.fillStyle = '#f8c838';
      for (let si = 0; si < ends.length; si++) {
        const e = ends[si];
        if (e.p <= 0) continue;
        const len = Math.hypot(e.ex - e.ax, e.ey - e.ay);
        const n = Math.floor(len / 14);
        for (let k = 0; k <= n; k++) {
          const t = k / n, x = e.ax + (e.ex - e.ax) * t, y = e.ay + (e.ey - e.ay) * t;
          const fl = 0.5 + 0.5 * Math.sin(nowT * 12 + k * 0.9 + si * 3);
          const h = 9 + 13 * Math.max(0, fl);
          ctx.globalAlpha = alpha * 0.45;
          ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, 4, h, 0, 0, TAU); ctx.fill();
        }
      }
      // 획을 타고 오르는 불티
      for (const pt of parts) {
        const age = nowT - pt.delay;
        if (age < 0 || age > pt.life) continue;
        const f = age / pt.life;
        const y = H - f * pt.vy * pt.life * 3.2;
        const x = pt.x + Math.sin(age * 6 + pt.x) * pt.drift * f;
        ctx.globalAlpha = alpha * (1 - f) * 0.8;
        ctx.fillStyle = f < 0.4 ? '#f8c838' : '#e08a1e';
        ctx.beginPath(); ctx.arc(x, y, pt.size * (1 - f * 0.6), 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    } else if (effect === 'water') {
      for (const p of parts) {
        const age = nowT - p.delay;
        if (age < 0 || age > p.life) continue;
        const y = age * p.vy;
        const w = 2.6;
        ctx.globalAlpha = alpha * 0.9;
        // 물방울: 아래는 둥글고 위는 뾰족한 테어드롭
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.moveTo(p.x, y);                                   // 뾰족한 위
        ctx.quadraticCurveTo(p.x + w, y + p.len * 0.7, p.x, y + p.len);
        ctx.quadraticCurveTo(p.x - w, y + p.len * 0.7, p.x, y);
        ctx.closePath();
        ctx.fill();
        // 하이라이트
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x - 0.7, y + p.len * 0.72, 0.9, 0, TAU);
        ctx.fill();
      }
      // 하단 물결 링(퍼짐)
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#7ac6ff';
      for (let r = 0; r < 3; r++) {
        const age = nowT - r * 0.35;
        if (age < 0) continue;
        const rad = (age % 0.9) * 280;
        ctx.globalAlpha = alpha * Math.max(0, 0.5 - (age % 0.9) * 0.55);
        ctx.beginPath();
        ctx.ellipse(W * (0.3 + r * 0.2), H - 12, rad, rad * 0.28, 0, 0, TAU);
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

    ctx.restore(); // shake 복원
    continueOrFinish();
  }
  requestAnimationFrame(frame);
})();
