// AI-GENERATED: 메인 프로세스가 계산한 2세대 전투 스냅샷과 이벤트만 표시한다.
// 화면 구성은 원작(금/은) 배틀 UI를 따른다 — 적 HP박스 좌상단, 아군 HP박스 우하단,
// 하단 텍스트 박스, 기술 선택 시 텍스트 박스를 메뉴가 대체.
import { loadSpriteCutout } from './sprite-alpha.js';
import { createBattleMusic } from './battle-audio.js';
import { battleResultView } from './battle-result.js';
import { battleEventSchedule, battleTimelineDuration } from '../core/battle-timeline.js';
import {
  hpBarPercent, hpTone, introMessage, promptMessage, moveMenuModel, typeLabel, withParticle,
} from './battle-view.js';

const root = document.getElementById('screen');
const message = document.getElementById('message');
const textbox = document.getElementById('textbox');
const menu = document.getElementById('menu');
const moveList = document.getElementById('move-list');
const infoType = document.getElementById('info-type');
const infoPp = document.getElementById('info-pp');
const infoPower = document.getElementById('info-power');
const close = document.getElementById('close');
const musicButton = document.getElementById('music');
const resultPanel = document.getElementById('result');
const resultTitle = document.getElementById('result-title');
const resultXp = document.getElementById('result-xp');
const resultDetail = document.getElementById('result-detail');

let latest = null;
let localLock = false;
let cryPlayed = false;
let introShown = false;
// 시작 연출·등장 대사가 떠 있는 동안에는 메뉴를 열지 않는다(원작도 연출 → 대사 → 행동선택).
let menuSuppressed = false;
let introRunning = false;
let introTimers = [];
let eventTimers = [];
// CSS의 시작 연출 길이와 맞춰야 한다(플래시 .45s → 블라인드 .45s → 슬라이드인 .45s).
const INTRO_ANIM_MS = 1400;
const INTRO_HOLD_MS = 1700;
const spriteSources = new Map();
const battleMusic = createBattleMusic();
let resultShown = false;
let musicMuted = false;

function ensureBattleMusic() {
  if (!musicMuted && !latest?.battle?.winner) battleMusic.start().catch(() => {});
}

function updateMusicButton() {
  musicButton.setAttribute('aria-pressed', String(!musicMuted));
  musicButton.title = musicMuted ? '배틀 음악 켜기' : '배틀 음악 끄기';
  musicButton.setAttribute('aria-label', musicButton.title);
}

function setMenuOpen(open) {
  menu.classList.toggle('open', open);
  textbox.classList.toggle('hidden', open);
}

function showResult(payload) {
  if (resultShown) return;
  const view = battleResultView(payload);
  if (!view) return;
  resultShown = true;
  resultTitle.textContent = view.title;
  resultXp.textContent = view.xpText;
  resultDetail.textContent = view.detail;
  resultPanel.hidden = false;
  setMenuOpen(false);
  textbox.classList.add('hidden');
  if (view.won) battleMusic.playVictory().catch(() => {});
  else battleMusic.stopLoop();
}

function combatantElements(key) {
  const element = document.getElementById(key);
  const box = document.getElementById(`${key}-box`);
  return {
    element,
    canvas: element.querySelector('canvas'),
    name: box.querySelector('.name'),
    level: box.querySelector('.level'),
    hp: box.querySelector('.bar>span'),
    hpnum: box.querySelector('.hpnum'),
  };
}

async function drawSprite(key, src) {
  const elements = combatantElements(key);
  if (!src || spriteSources.get(key) === src) return;
  spriteSources.set(key, src);
  try {
    const sprite = await loadSpriteCutout(src);
    const context = elements.canvas.getContext('2d');
    context.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    context.imageSmoothingEnabled = false;
    context.drawImage(sprite, 0, 0, elements.canvas.width, elements.canvas.height);
  } catch { /* 데이터 준비 실패 시 텍스트/HP 전투는 유지 */ }
}

function renderCombatant(key, data) {
  const elements = combatantElements(key);
  // 원작 HP박스는 이름과 수치를 나눠 표시한다(적은 수치 비공개 — CSS에서 숨김).
  elements.name.textContent = key === 'enemy' ? `야생 ${data.name}` : data.name;
  elements.level.textContent = `Lv.${data.level}`;
  renderCombatantHp(key, data.hp, data.maxHp);
}

function renderCombatantHp(key, hp, maxHp) {
  const elements = combatantElements(key);
  elements.hp.style.width = `${hpBarPercent(hp, maxHp)}%`;
  elements.hp.dataset.tone = hpTone(hp, maxHp);
  elements.hpnum.textContent = `${hp}/ ${maxHp}`;
}

function playImpact(target) {
  const elements = combatantElements(target);
  const box = document.getElementById(`${target}-box`);
  elements.element.classList.remove('hit');
  box.classList.remove('hp-change');
  void elements.element.offsetWidth;
  elements.element.classList.add('hit');
  box.classList.add('hp-change');
  setTimeout(() => {
    elements.element.classList.remove('hit');
    box.classList.remove('hp-change');
  }, 450);
}

function eventText(event) {
  if (event.kind === 'move') {
    const actor = event.actor === 'player' ? latest.battle.player.name : latest.battle.enemy.name;
    const move = event.actor === 'player'
      ? latest.playerMoves.find((entry) => entry.slug === event.moveSlug)?.name
      : null;
    const label = move || event.move.replaceAll('_', ' ');
    // 원작 문구: "<이름>의 <기술>!"
    return `${actor}의 ${label}!`;
  }
  if (event.kind === 'miss') return '하지만 빗나갔다!';
  if (event.kind === 'no-effect') return '효과가 없는 것 같다…';
  if (event.kind === 'charge') return '빛을 모으기 시작했다!';
  if (event.kind === 'heal') return `HP를 ${event.amount} 회복했다!`;
  if (event.kind === 'status') return `${statusName(event.status)} 상태가 되었다!`;
  if (event.kind === 'status-cleared') return `${statusName(event.status)} 상태에서 회복했다!`;
  if (event.kind === 'stat') return `${event.stat}${event.change > 0 ? ' 올라갔다!' : ' 떨어졌다!'}`;
  if (event.kind === 'unable') return `${event.reason} 때문에 움직일 수 없다!`;
  if (event.kind === 'faint') {
    const name = event.target === 'player' ? latest.battle.player.name : latest.battle.enemy.name;
    return `${withParticle(name, ['은', '는'])} 쓰러졌다!`;
  }
  if (event.kind === 'damage' && event.critical) return '급소에 맞았다!';
  if (event.kind === 'damage' && event.effectiveness > 1) return '효과가 굉장했다!';
  if (event.kind === 'damage' && event.effectiveness > 0 && event.effectiveness < 1) return '효과가 별로인 듯하다…';
  return null;
}

function statusName(status) {
  return ({
    paralysis: '마비', burn: '화상', freeze: '얼음', poison: '독', confusion: '혼란',
  })[status] || status;
}

function damageFloat(event) {
  if (!['damage', 'heal'].includes(event.kind)) return;
  const target = event.target || 'player';
  const element = document.createElement('span');
  element.className = `damage ${event.kind === 'heal' ? 'heal' : (event.effectiveness > 1 ? 'good' : '')}`;
  element.textContent = event.kind === 'heal' ? `+${event.amount}` : `-${event.amount}`;
  const anchor = combatantElements(target).element;
  const rootRect = root.getBoundingClientRect();
  const rect = anchor.getBoundingClientRect();
  // 화면 패널 기준 좌표로 환산(패널이 화면 가운데 letterbox 되어 있으므로).
  element.style.left = `${rect.left - rootRect.left + rect.width / 2}px`;
  element.style.top = `${rect.top - rootRect.top + rect.height / 2}px`;
  root.appendChild(element);
  setTimeout(() => element.remove(), 950);
}

function playEvents(events) {
  for (const timer of eventTimers) clearTimeout(timer);
  eventTimers = [];
  setMenuOpen(false); // 연출 중에는 원작처럼 텍스트 박스를 보여준다
  battleEventSchedule(events).forEach(({ event, at }) => {
    eventTimers.push(setTimeout(() => {
      const text = eventText(event);
      if (text) message.textContent = text;
      if (['damage', 'heal'].includes(event.kind) && ['player', 'enemy'].includes(event.target)) {
        const maxHp = latest.battle[event.target].maxHp;
        renderCombatantHp(event.target, event.hp, maxHp);
      }
      if (event.kind === 'damage' && ['player', 'enemy'].includes(event.target)) {
        playImpact(event.target);
      }
      damageFloat(event);
    }, at));
  });
  const timelineEnd = battleTimelineDuration(events);
  eventTimers.push(setTimeout(() => {
    renderCombatant('player', latest.battle.player);
    renderCombatant('enemy', latest.battle.enemy);
  }, timelineEnd));
  if (latest.battle.winner) {
    eventTimers.push(setTimeout(() => {
      showResult(latest);
    }, timelineEnd + 120));
  }
}

function showMoveInfo(move) {
  infoType.textContent = move?.type ? typeLabel(move.type) : '—';
  infoPp.textContent = move?.pp != null ? `${move.pp}/${move.pp}` : '—';
  infoPower.textContent = move?.power != null ? String(move.power) : '—';
}

function renderMoves(payload) {
  moveList.replaceChildren();
  const disabled = localLock || payload.resolving || Boolean(payload.battle.winner);
  const model = moveMenuModel(payload.playerMoves, payload.battle.player.moves);
  showMoveInfo(model[0]);
  for (const move of model) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'move';
    button.textContent = move.name;
    button.disabled = disabled;
    button.addEventListener('mouseenter', () => showMoveInfo(move));
    button.addEventListener('focus', () => showMoveInfo(move));
    button.addEventListener('click', () => {
      if (button.disabled || !latest) return;
      localLock = true;
      renderMoves(latest);
      window.pkmn?.selectBattleMove?.({
        battleId: latest.battleId,
        turn: latest.turn,
        moveSlug: move.slug,
      });
    });
    moveList.appendChild(button);
  }
  // 내 차례일 때만 메뉴를 연다. 아니면 텍스트 박스가 보인다(원작과 동일).
  setMenuOpen(!disabled && !resultShown && !menuSuppressed);
}

// 전투 개시 연출: 화면 플래시 → 블라인드 와이프 → 포켓몬 슬라이드 인 → 등장 대사 → 메뉴.
// 연출 자체는 CSS(#screen.intro)가 돌리고, 여기서는 문구와 메뉴 타이밍만 맞춘다.
function startIntro(payload) {
  menuSuppressed = true;
  introRunning = true;
  message.textContent = '';
  root.classList.add('intro');
  for (const timer of introTimers) clearTimeout(timer);
  introTimers = [];

  // 슬라이드 인이 끝나는 시점 = 야생 포켓몬이 화면에 자리잡는 순간. 울음소리도 여기서.
  introTimers.push(setTimeout(() => {
    root.classList.remove('intro');
    introRunning = false;
    if (!latest || resultShown) return;
    message.textContent = introMessage(latest.battle.enemy.name);
    playEnemyCry(latest);
  }, INTRO_ANIM_MS));

  introTimers.push(setTimeout(() => {
    menuSuppressed = false;
    if (!latest || latest.battle.winner || resultShown) return;
    message.textContent = promptMessage(latest.battle.player.name);
    renderMoves(latest);
  }, INTRO_ANIM_MS + INTRO_HOLD_MS));
}

function playEnemyCry(payload) {
  if (cryPlayed || !payload?.enemyCry) return;
  cryPlayed = true;
  try { new Audio(payload.enemyCry).play().catch(() => {}); } catch { /* ignore */ }
}

function render(payload) {
  latest = payload;
  localLock = Boolean(payload.resolving);
  root.classList.toggle('player-front-fallback', !payload.playerSpriteIsBack);
  const visibleBattle = payload.events?.length && payload.previousBattle
    ? payload.previousBattle
    : payload.battle;
  renderCombatant('player', visibleBattle.player);
  renderCombatant('enemy', visibleBattle.enemy);
  drawSprite('player', payload.playerSprite);
  drawSprite('enemy', payload.enemySprite);
  ensureBattleMusic();

  if (payload.events?.length) {
    playEvents(payload.events);
    renderMoves(payload);
  } else if (payload.battle.winner) {
    showResult(payload);
  } else {
    // 첫 턴엔 원작의 전투 개시 연출 → 등장 대사 → 행동 선택 순서를 그대로 태운다.
    if (!introShown) {
      introShown = true;
      startIntro(payload);
    } else {
      message.textContent = promptMessage(payload.battle.player.name);
    }
    renderMoves(payload);
  }

  // 시작 연출 중이면 울음소리는 포켓몬이 자리잡는 순간(startIntro)에 맞춰 재생한다.
  if (!introRunning) playEnemyCry(payload);
}

musicButton.addEventListener('click', () => {
  musicMuted = !musicMuted;
  battleMusic.setMuted(musicMuted);
  updateMusicButton();
  if (!musicMuted) ensureBattleMusic();
});

window.addEventListener('pointerdown', ensureBattleMusic, { passive: true });

close.addEventListener('click', () => {
  if (latest) window.pkmn?.leaveBattle?.(latest.battleId);
});
window.addEventListener('keydown', (event) => {
  ensureBattleMusic();
  if (event.key === 'Escape' && latest) window.pkmn?.leaveBattle?.(latest.battleId);
});
window.addEventListener('beforeunload', () => battleMusic.stop());
window.pkmn?.onBattleState?.(render);
updateMusicButton();
