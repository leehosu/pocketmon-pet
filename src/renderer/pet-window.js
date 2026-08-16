import { getFrames } from '../core/sprites/index.js';
import { PALETTE } from '../core/sprites/palette.js';
import { drawFrame } from './canvas-render.js';
import { xpForLevel, XP_RULES } from '../core/xp-engine.js';
import { getSpeciesByKey } from '../core/roster.js';
import { customCandidates } from '../core/sprite-files.js';

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

// 타입별 오리지널 기술 목록(공식 포켓몬 기술 아님). 각 기술은 이름 + 화면 이펙트 종류.
const SKILLS_BY_KEY = {
  grass: [{ name: '잎 흩날리기', effect: 'leaf' }, { name: '새싹 회오리', effect: 'leaf' }],
  fire: [{ name: '불꽃 튀기기', effect: 'fire' }, { name: '화염 숨결', effect: 'fire' }],
  water: [{ name: '물보라', effect: 'water' }, { name: '거품 세례', effect: 'water' }],
  electric: [{ name: '스파크', effect: 'electric' }, { name: '번개 방출', effect: 'electric' }],
};

// species(getSpeciesByKey 결과)에 맞는 기술 배열 반환. 없으면 빈 배열.
export function skillsFor(species) {
  if (!species || !species.key) return [];
  return SKILLS_BY_KEY[species.key] || [];
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

// available(Set 또는 배열)에 존재하는 첫 customCandidates 키를 반환, 없으면 null.
export function pickCustomKey(available, species, stage, anim) {
  const has = available instanceof Set ? (k) => available.has(k) : (k) => available.includes(k);
  for (const key of customCandidates(species, stage, anim)) if (has(key)) return key;
  return null;
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

  let latest = null; // 마지막으로 수신한 { state, changes, activity, command }

  // 커스텀 스프라이트: ~/.pocketmon/sprites/ 에서 로드된 사용자 PNG 캐시.
  // payload.customSprites는 최초 1회 + 변경 시에만 실려오므로(메인 프로세스가 gate),
  // 여기서는 받을 때마다 누적 교체한다 — 안 오면 이전 값을 그대로 유지.
  const customImages = new Map(); // key -> HTMLImageElement
  let customKeys = new Set();     // 로드된(로드 시도된) key 집합

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
    const { state, changes, activity, command, customSprites } = payload;

    if (customSprites) {
      // 변경분이 실려온 tick — (재)로드. 로드 실패 시 해당 key는 캐시에 안 잡히므로
      // pickCustomKey가 골라도 img.complete 체크에서 걸러져 코드 도트로 자연 폴백된다.
      for (const [key, dataUrl] of Object.entries(customSprites)) {
        const img = new Image();
        img.onerror = () => { customImages.delete(key); };
        img.src = dataUrl;
        customImages.set(key, img);
      }
      customKeys = new Set(Object.keys(customSprites));
    }

    if (activity) busy = Boolean(activity.busy);
    if (activity && activity.skillPulse) triggerSkillPulse();

    if (changes) {
      if (changes.evolved) triggerReact('진화!');
      else if (changes.leveledUp) triggerReact('Lv↑');
    }

    if (command === 'showStatus') {
      pinned = true;
      setDetailOpen(true); // 메뉴바 "상태 보기" → 상세 패널 확실히 열기(더블클릭 대체 경로)
    } else if (command === 'replayIntro') {
      triggerReact('첫 만남!');
    }

    if (state) renderHud(state);
    if (detailOpen) renderDetail(); // 상세 패널이 열려 있으면 최신 상태로 갱신
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
    // 상세 패널이 열려 있으면 기본 HUD는 숨긴다(중복 방지 + 커진 창 아래로 밀려나는 것 회피).
    const visible = !detailOpen && hudVisible({ hovering, pinned });
    hudEl.style.opacity = visible ? '1' : '0';
  }

  function renderDetail() {
    if (!detailOpen) { detailEl.style.opacity = '0'; return; }
    const state = latest && latest.state;
    if (!state) return;
    const species = getSpeciesByKey(state.species);
    const d = statusDetail(state, species, xpForLevel, XP_RULES.dailyCap);
    const skills = skillsFor(species);
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
    }, DBLCLICK_MS);
  });

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
    const species = state && state.species;
    const stage = state ? state.stage : 0;
    if (species) {
      const customKey = pickCustomKey(customKeys, species, stage, currentAnim);
      const customImg = customKey ? customImages.get(customKey) : null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (customImg && customImg.complete && customImg.naturalWidth > 0) {
        // 사용자 제공 PNG를 그대로 캔버스 크기에 맞춰 그린다(코드 도트 매트릭스 대신).
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(customImg, 0, 0, canvas.width, canvas.height);
      } else {
        // 커스텀 이미지가 없거나(파일 없음) 아직 로드 실패/미완료 → 기존 코드 도트 폴백.
        const frames = getFrames(species, stage, currentAnim);
        const idx = nextFrameIndex({ tickCount, frameCount: frames.length });
        const frame = frames[idx];
        drawFrame(ctx, frame, PALETTE, SCALE);
      }
    }

    updateHud();
  }

  updateHud();
  clearPop();
  setInterval(tickAnim, FRAME_MS);
}
