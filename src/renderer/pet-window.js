import { getFrames } from '../core/sprites/index.js';
import { PALETTE } from '../core/sprites/palette.js';
import { drawFrame } from './canvas-render.js';
import { xpForLevel } from '../core/xp-engine.js';
import { getSpeciesByKey } from '../core/roster.js';

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

export function hudVisible({ hovering, pinned }) {
  return Boolean(hovering || pinned);
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

  let latest = null; // 마지막으로 수신한 { state, changes, activity, command }

  // 애니메이션/상호작용 상태
  let hovering = false;
  let pinned = false;
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
    const { state, changes, activity, command } = payload;

    if (activity) busy = Boolean(activity.busy);
    if (activity && activity.skillPulse) triggerSkillPulse();

    if (changes) {
      if (changes.evolved) triggerReact('진화!');
      else if (changes.leveledUp) triggerReact('Lv↑');
    }

    if (command === 'showStatus') {
      pinned = true;
    } else if (command === 'replayIntro') {
      triggerReact('첫 만남!');
    }

    if (state) renderHud(state);
  }

  function renderHud(state) {
    const species = getSpeciesByKey(state.species);
    const level = state.level || 1;
    const curFloor = xpForLevel(level);
    const nextFloor = xpForLevel(level + 1);
    const span = Math.max(1, nextFloor - curFloor);
    const progress = Math.min(1, Math.max(0, (state.xp - curFloor) / span));
    xpFillEl.style.width = `${Math.round(progress * 100)}%`;

    const name = species ? species.stages[state.stage]?.name || species.key : '???';
    statusEl.textContent = `${name} Lv.${level} (${state.stage + 1}/3단계)`;
  }

  function updateHud() {
    const visible = hudVisible({ hovering, pinned });
    hudEl.style.opacity = visible ? '1' : '0';
  }

  canvas.addEventListener('mouseenter', () => { hovering = true; updateHud(); });
  canvas.addEventListener('mouseleave', () => { hovering = false; updateHud(); });
  canvas.addEventListener('click', () => { pinned = !pinned; updateHud(); });

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
    const species = state && state.species;
    const stage = state ? state.stage : 0;
    if (species) {
      const frames = getFrames(species, stage, currentAnim);
      const idx = nextFrameIndex({ tickCount, frameCount: frames.length });
      const frame = frames[idx];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawFrame(ctx, frame, PALETTE, SCALE);
    }

    updateHud();
  }

  updateHud();
  clearPop();
  setInterval(tickAnim, FRAME_MS);
}
