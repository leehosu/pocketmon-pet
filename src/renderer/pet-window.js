import { getFrames } from '../core/sprites/index.js';
import { PALETTE } from '../core/sprites/palette.js';
import { drawFrame } from './canvas-render.js';
import { xpForLevel, XP_RULES } from '../core/xp-engine.js';
import { getSpeciesByKey, canEvolve } from '../core/roster.js';
import { spriteKey } from '../core/sprite-files.js';
import { gen2SkillsForStage } from '../core/gsc-moves.js';
import { loadSpriteCutout } from './sprite-alpha.js';

// ============================================================
// 순수 함수 (테스트 대상 — test/anim.test.js)
// ============================================================

export function pickAnim({ reacting, skillActive, busy, walking }) {
  if (reacting) return 'skill';    // 레벨업/진화 = skill 프레임 + 팝 텍스트
  if (skillActive) return 'skill'; // 도구 사용 순간 기술
  if (busy) return 'run';          // 프롬프트 진행 중 = 달리기
  if (walking) return 'walk';      // 가끔 어슬렁
  return 'idle';
}

export function nextFrameIndex({ tickCount, frameCount }) {
  return tickCount % frameCount;
}

// 정지 이미지(PokéAPI 다운로드 스프라이트)에 입힐 모션 변형(순수). anim별로 다른 움직임.
// dx/dy=이동(px), rot=회전(rad), sx/sy=스케일.
export function spriteMotion(anim, tick) {
  const t = tick;
  switch (anim) {
    case 'run':   // 통통 뛰기(위로만) + 살짝 기울임
      return { dx: 0, dy: -Math.abs(Math.sin(t * 0.9)) * 6, rot: Math.sin(t * 0.9) * 0.06, sx: 1, sy: 1 };
    case 'walk':  // 뒤뚱뒤뚱(가벼운 상하 + 좌우 흔들림)
      return { dx: Math.sin(t * 0.7) * 1.5, dy: Math.sin(t * 0.7) * 2, rot: Math.sin(t * 0.7) * 0.06, sx: 1, sy: 1 };
    case 'skill': // 기술: 팝(확대) + 좌우 진동
      return { dx: Math.sin(t * 4) * 3, dy: -Math.abs(Math.sin(t * 2)) * 4, rot: 0, sx: 1.08, sy: 1.08 };
    case 'idle':
    default:      // 숨쉬기: 잔잔한 상하 바운스
      return { dx: 0, dy: Math.sin(t * 0.4) * 2, rot: 0, sx: 1, sy: 1 };
  }
}

export function hudVisible({ hovering, pinned }) {
  return Boolean(hovering || pinned);
}

// species(getSpeciesByKey 결과)에 맞는 기술 배열 반환. 없으면 빈 배열.
export function skillsFor(species) {
  if (!species || !species.key) return [];
  return gen2SkillsForStage(species.key, 0).map(({ name, effect }) => ({ name, effect }));
}

export function skillsForState(state) {
  if (!state || !state.species) return [];
  return gen2SkillsForStage(state.species, state.stage || 0).map(({ name, effect }) => ({ name, effect }));
}

export function movesSignature(state) {
  if (!state || !state.hatched || !state.species) return null;
  return `${state.species}_${state.stage || 0}`;
}

export function nextMovesCache(state, currentMoves, currentMovesSig, payloadMoves) {
  const sig = movesSignature(state);
  if (!sig) return { moves: null, sig: null };
  if (payloadMoves && payloadMoves.length) return { moves: payloadMoves, sig };
  if (currentMovesSig === sig) return { moves: currentMoves, sig };
  return { moves: skillsForState(state), sig };
}

// 현재 상태에서 "!" 클릭으로 할 수 있는 행동(순수). 부화 전이면 hatch, 부화 후 진화 가능하면 evolve.
export function petAction(state) {
  if (!state) return { kind: null, can: false };
  if (!state.hatched) {
    return { kind: 'hatch', can: (state.xp || 0) >= XP_RULES.hatchXp };
  }
  const sp = getSpeciesByKey(state.species);
  return { kind: 'evolve', can: canEvolve(sp, state.level || 1, state.stage || 0) };
}

// 더블클릭 상세 패널용 값 계산(순수). species는 getSpeciesByKey 결과(없으면 undefined).
export function statusDetail(state, species, xpFor, dailyCap) {
  const level = state.level || 1;
  const stage = state.stage || 0;
  const total = state.xp || 0;
  const curFloor = xpFor(level);
  const nextFloor = xpFor(level + 1);
  const name = species ? (species.stages[stage]?.name || species.key) : '???';
  const type = species ? species.type : '?';

  let evolveText;
  if (!species) {
    evolveText = '—';
  } else if (stage >= 2) {
    evolveText = '최종 진화 완료';
  } else {
    const evLv = species.evolveLevels[stage]; // stage0→e1, stage1→e2
    const nextName = species.stages[stage + 1]?.name || '?';
    const remain = Math.max(0, evLv - level);
    evolveText = `${nextName}까지 Lv.${evLv} (${remain} 남음)`;
  }

  return {
    name, type, stage,
    stageLabel: `${stage + 1}/3단계`,
    level,
    xpInLevel: total - curFloor,
    xpNeededThisLevel: Math.max(0, nextFloor - curFloor),
    xpToNext: Math.max(0, nextFloor - total),
    totalXp: total,
    evolveText,
    dailyXp: state.dailyXp || 0,
    dailyCap,
  };
}

// available(Set 또는 배열)에 다운로드 스프라이트 키(<species>_<stage>)가 있으면 반환, 없으면 null.
export function pickSpriteKey(available, species, stage) {
  const has = available instanceof Set ? (k) => available.has(k) : (k) => available.includes(k);
  const key = spriteKey(species, stage);
  return has(key) ? key : null;
}

// ============================================================
// 브라우저 전용 배선 (수동 확인 — Vitest는 DOM 없이 이 모듈을 import하므로
// window 존재 여부로 가드한다)
// ============================================================

if (typeof window !== 'undefined') {
  const SCALE = 6; // 16px 스프라이트 * 6 = 96px (window 크기와 일치)
  const FPS = 8;
  const FRAME_MS = 1000 / FPS;
  const SKILL_ACTIVE_MS = 500;
  const REACT_MS = 1200;
  const IDLE_WALK_CHANCE = 0.05; // 매 프레임 tick마다 idle 중 가끔 걷기로 전환할 확률
  const WALK_DURATION_TICKS = 6;

  const canvas = document.getElementById('pet');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const popEl = document.getElementById('pop');
  const hudEl = document.getElementById('hud');
  const xpFillEl = document.getElementById('xp-fill');
  const statusEl = document.getElementById('status');
  const detailEl = document.getElementById('detail');
  const alertEl = document.getElementById('alert'); // 부화/진화 "!" 배지

  let latest = null; // 마지막으로 수신한 { state, changes, activity, command }

  // 다운로드 스프라이트: ~/.pocketmon/dex/ 에서 로드된 PokéAPI PNG 캐시.
  // payload.customSprites는 최초 1회 + 변경 시에만 실려오므로(메인 프로세스가 gate),
  // 여기서는 받을 때마다 누적 교체한다 — 안 오면 이전 값을 그대로 유지.
  const customImages = new Map(); // key -> HTMLImageElement
  let customKeys = new Set();     // 로드된(로드 시도된) key 집합
  let currentCry = null;          // 현재 종/단계 울음소리 data URL(PokéAPI 런타임 캐시)
  let currentMoves = null;        // 현재 종/단계 기술명 — payload 없으면 내장 단계별 기본으로 폴백
  let currentMovesSig = null;

  // 애니메이션/상호작용 상태
  let hovering = false;
  let pinned = false;
  let detailOpen = false;
  let skillActive = false;
  let reacting = false;
  let busy = false;
  let walking = false;
  let walkTicksLeft = 0;
  let tickCount = 0;
  let currentAnim = 'idle';

  let skillTimer = null;
  let reactTimer = null;

  function clearPop() {
    popEl.textContent = '';
    popEl.style.opacity = '0';
  }

  function showPop(text) {
    popEl.textContent = text;
    popEl.style.opacity = '1';
    clearTimeout(showPop._t);
    showPop._t = setTimeout(clearPop, REACT_MS);
  }

  function triggerSkillPulse() {
    skillActive = true;
    clearTimeout(skillTimer);
    skillTimer = setTimeout(() => { skillActive = false; }, SKILL_ACTIVE_MS);
  }

  function triggerReact(text) {
    reacting = true;
    showPop(text);
    clearTimeout(reactTimer);
    reactTimer = setTimeout(() => { reacting = false; }, REACT_MS);
  }

  function applyState(payload) {
    latest = payload;
    const { state, changes, activity, command, customSprites, cry, moves } = payload;
    if (cry) currentCry = cry; // 종/단계 바뀔 때만 실려옴 → 저장
    ({ moves: currentMoves, sig: currentMovesSig } = nextMovesCache(state, currentMoves, currentMovesSig, moves));

    if (customSprites) {
      // 변경분이 실린 tick에서 Gold PNG 외부 흰 배경을 제거해 다시 로드한다.
      for (const [key, dataUrl] of Object.entries(customSprites)) {
        loadSpriteCutout(dataUrl)
          .then((sprite) => { customImages.set(key, sprite); })
          .catch(() => { customImages.delete(key); });
      }
      customKeys = new Set(Object.keys(customSprites));
    }

    if (activity) busy = Boolean(activity.busy);
    if (activity && activity.skillPulse) triggerSkillPulse();

    if (changes) {
      if (changes.hatched) triggerReact('부화!');
      else if (changes.evolved) triggerReact('진화!');
      else if (changes.leveledUp) triggerReact('Lv↑');
      // 부화/진화 순간에도 울음소리(진화면 새 단계 소리 — currentCry가 위에서 갱신됨)
      if (changes.hatched || changes.evolved) playCry();
    }

    if (command === 'showStatus') {
      pinned = true;
      setDetailOpen(true); // 메뉴바 "상태 보기" → 상세 패널 확실히 열기(더블클릭 대체 경로)
    } else if (command === 'replayIntro') {
      triggerReact('첫 만남!');
    }

    if (state) renderHud(state);
    if (detailOpen) renderDetail(); // 상세 패널이 열려 있으면 최신 상태로 갱신
    updateAlert();
  }

  function renderHud(state) {
    if (!state.hatched) {
      // 알 상태: 부화까지의 진행도(정체 숨김).
      const p = Math.min(1, Math.max(0, (state.xp || 0) / XP_RULES.hatchXp));
      xpFillEl.style.width = `${Math.round(p * 100)}%`;
      statusEl.textContent = p >= 1 ? '알 · 부화 준비 완료!' : '알 · 부화 중…';
      return;
    }
    const species = getSpeciesByKey(state.species);
    const level = state.level || 1;
    const curFloor = xpForLevel(level);
    const nextFloor = xpForLevel(level + 1);
    const span = Math.max(1, nextFloor - curFloor);
    const progress = Math.min(1, Math.max(0, (state.xp - curFloor) / span));
    xpFillEl.style.width = `${Math.round(progress * 100)}%`;

    const name = species ? species.stages[state.stage]?.name || species.key : '???';
    statusEl.textContent = `${name} Lv.${level}`;
  }

  function updateHud() {
    // 상세 패널이 열려 있으면 기본 HUD는 숨긴다(중복 방지 + 커진 창 아래로 밀려나는 것 회피).
    const visible = !detailOpen && hudVisible({ hovering, pinned });
    hudEl.style.opacity = visible ? '1' : '0';
  }

  // 부화/진화 가능하면 "!" 배지 표시.
  function updateAlert() {
    const a = petAction(latest && latest.state);
    alertEl.style.opacity = a.can ? '1' : '0';
    alertEl.title = a.kind === 'hatch' ? '부화하기' : '진화하기';
  }

  // "!" 클릭 → 부화 또는 진화(메인이 서명 상태로 처리).
  alertEl.addEventListener('click', () => {
    const a = petAction(latest && latest.state);
    if (!a.can) return;
    if (a.kind === 'hatch') window.pkmn && window.pkmn.hatch && window.pkmn.hatch();
    else window.pkmn && window.pkmn.evolve && window.pkmn.evolve();
  });

  function renderDetail() {
    if (!detailOpen) { detailEl.style.opacity = '0'; return; }
    const state = latest && latest.state;
    if (!state) return;
    const species = getSpeciesByKey(state.species);
    const d = statusDetail(state, species, xpForLevel, XP_RULES.dailyCap);
    // 실제 PokéAPI 타입 기술명이 있으면 그걸, 없으면 내장 기본 기술로 폴백.
    const skills = (currentMoves && currentMoves.length) ? currentMoves : skillsForState(state);
    const skillBtns = skills
      .map((s) => `<button class="skill-btn" data-effect="${s.effect}">${s.name}</button>`)
      .join('');
    detailEl.innerHTML = [
      `<div class="d-name">${d.name}</div>`,
      `<div class="d-row"><span>타입</span><b>${d.type}</b></div>`,
      `<div class="d-row"><span>단계</span><b>${d.stageLabel}</b></div>`,
      `<div class="d-row"><span>레벨</span><b>Lv.${d.level}</b></div>`,
      `<div class="d-row"><span>이번 레벨</span><b>${d.xpInLevel}/${d.xpNeededThisLevel} XP</b></div>`,
      `<div class="d-row"><span>다음 레벨까지</span><b>${d.xpToNext} XP</b></div>`,
      `<div class="d-row"><span>총 경험치</span><b>${d.totalXp} XP</b></div>`,
      `<div class="d-row"><span>진화</span><b>${d.evolveText}</b></div>`,
      `<div class="d-row"><span>오늘 획득</span><b>${d.dailyXp}/${d.dailyCap} XP</b></div>`,
      `<div class="d-skills-label">기술 (클릭 → 화면 이펙트)</div>`,
      `<div class="d-skills">${skillBtns}</div>`,
    ].join('');
    detailEl.style.opacity = '1';
  }

  function setDetailOpen(open) {
    detailOpen = open;
    // 메인에 창 크기 변경 요청(상세 패널을 담기 위해 확장 / 닫으면 원복)
    if (window.pkmn && typeof window.pkmn.setDetail === 'function') {
      window.pkmn.setDetail(detailOpen);
    }
    renderDetail();
  }

  function toggleDetail() { setDetailOpen(!detailOpen); }

  canvas.addEventListener('mouseenter', () => { hovering = true; updateHud(); });
  canvas.addEventListener('mouseleave', () => { hovering = false; updateHud(); });

  // 수동 드래그 + 클릭 구분: mousedown~mouseup 사이 이동량이 임계값 미만이면 클릭(핀 토글),
  // 이상이면 드래그로 간주해 창을 옮긴다(pkmn.moveWindowBy). 네이티브 drag region 미사용.
  const CLICK_THRESHOLD_PX = 4;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let movedTotal = 0;

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.screenX;
    lastY = e.screenY;
    movedTotal = 0;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.screenX - lastX;
    const dy = e.screenY - lastY;
    lastX = e.screenX;
    lastY = e.screenY;
    movedTotal += Math.abs(dx) + Math.abs(dy);
    if (window.pkmn && typeof window.pkmn.moveWindowBy === 'function') {
      window.pkmn.moveWindowBy(dx, dy);
    }
  });

  // 단일 클릭 = 기본 HUD 핀 토글 / 더블클릭 = 상세 패널 토글.
  // 더블클릭은 브라우저 네이티브 dblclick 이벤트로 판별(수동 타이머보다 트랙패드에서 안정적).
  // 단일 클릭은 잠깐 보류했다가, 그 사이 dblclick이 오면 취소해 핀 토글이 안 튀게 한다.
  const DBLCLICK_MS = 280;
  let clickTimer = null;

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = 'grab';
    if (movedTotal >= CLICK_THRESHOLD_PX) return; // 드래그였음 → 클릭 아님
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickTimer = null;
      pinned = !pinned; // 단일 클릭 → 기본 HUD 핀 토글
      updateHud();
      playCry();        // 클릭하면 울음소리(있으면)
    }, DBLCLICK_MS);
  });

  function playCry() {
    if (!currentCry) return;
    try { const a = new Audio(currentCry); a.volume = 0.6; a.play().catch(() => {}); } catch { /* ignore */ }
  }

  // 네이티브 더블클릭 → 대기 중인 단일클릭(핀) 취소 후 상세 패널 토글.
  canvas.addEventListener('dblclick', () => {
    clearTimeout(clickTimer);
    clickTimer = null;
    toggleDetail();
  });

  // 기술 버튼(상세 패널 내부) 클릭 → 화면 전체 이펙트 재생(메인이 오버레이 창 생성).
  // 위임 방식: renderDetail이 innerHTML을 갱신해도 리스너가 유지된다.
  detailEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-effect]');
    if (!btn) return;
    if (window.pkmn && typeof window.pkmn.playSkill === 'function') {
      window.pkmn.playSkill(btn.dataset.effect);
    }
    playCry(); // 기술 사용 시 울음소리도 함께
  });

  if (window.pkmn && typeof window.pkmn.onState === 'function') {
    window.pkmn.onState(applyState);
  }

  function tickAnim() {
    tickCount++;

    // idle 중 가끔 어슬렁(walk)으로 전환 — busy/reacting/skill이 아닐 때만
    if (walkTicksLeft > 0) {
      walkTicksLeft--;
      walking = true;
    } else {
      walking = false;
      if (!busy && !reacting && !skillActive && Math.random() < IDLE_WALK_CHANCE) {
        walkTicksLeft = WALK_DURATION_TICKS;
        walking = true;
      }
    }

    currentAnim = pickAnim({ reacting, skillActive, busy, walking });

    const state = latest && latest.state;
    if (state) {
      // 부화 전이면 종과 무관하게 "알"을 그린다(어떤 포켓몬인지 숨김).
      const hatched = Boolean(state.hatched);
      const renderKey = hatched ? state.species : 'egg';
      const stage = hatched ? (state.stage || 0) : 0;
      if (renderKey) {
        // 다운로드된 PokéAPI 이미지는 부화 후에만 사용(알은 항상 코드 도트).
        const customKey = hatched ? pickSpriteKey(customKeys, renderKey, stage) : null;
        const customImg = customKey ? customImages.get(customKey) : null;
        const customReady = customImg
          && (customImg.naturalWidth || customImg.width) > 0
          && (customImg.naturalHeight || customImg.height) > 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (customReady) {
          // 정지 이미지(PokéAPI 다운로드 스프라이트)에 anim별 모션 변형(바운스·뒤뚱·팝)을 입혀 그린다.
          const m = spriteMotion(currentAnim, tickCount);
          const cw = canvas.width, ch = canvas.height;
          ctx.imageSmoothingEnabled = false;
          ctx.save();
          ctx.translate(cw / 2 + m.dx, ch / 2 + m.dy);
          ctx.rotate(m.rot);
          ctx.scale(m.sx, m.sy);
          ctx.drawImage(customImg, -cw / 2, -ch / 2, cw, ch);
          ctx.restore();
        } else {
          // 코드 도트(알 포함). 알도 idle/walk로 살짝 흔들린다.
          const frames = getFrames(renderKey, stage, currentAnim);
          const idx = nextFrameIndex({ tickCount, frameCount: frames.length });
          drawFrame(ctx, frames[idx], PALETTE, SCALE);
        }
      }
    }

    updateHud();
    updateAlert();
  }

  updateHud();
  clearPop();
  setInterval(tickAnim, FRAME_MS);
}
