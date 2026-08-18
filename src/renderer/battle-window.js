// AI-GENERATED: 메인 프로세스가 계산한 2세대 전투 스냅샷과 이벤트만 표시한다.
// 화면 구성은 원작(금/은) 배틀 UI를 따른다 — 적 HP박스 좌상단, 아군 HP박스 우하단,
// 하단 텍스트 박스, 기술 선택 시 텍스트 박스를 메뉴가 대체.
import { loadSpriteCutout } from './sprite-alpha.js';
import { createBattleMusic } from './battle-audio.js';
import {
  CHRIS_BACK_SPRITE_DATA_URL,
  FALKNER_SPRITE_DATA_URL,
} from './trainer-sprites.js';
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
const commandMenu = document.getElementById('command-menu');
const commandPrompt = document.getElementById('command-prompt');
const fightButton = document.getElementById('fight');
const partyButton = document.getElementById('party-command');
const packButton = document.getElementById('pack-command');
const infoType = document.getElementById('info-type');
const infoPp = document.getElementById('info-pp');
const infoPower = document.getElementById('info-power');
const runButton = document.getElementById('run');
const close = document.getElementById('close');
const musicButton = document.getElementById('music');
const resultPanel = document.getElementById('result');
const resultTitle = document.getElementById('result-title');
const resultXp = document.getElementById('result-xp');
const resultDetail = document.getElementById('result-detail');
const trainerParty = document.getElementById('trainer-party');

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
let lastOpponentSequence = null;
let menuMode = 'text';
let commandMessageTimer = null;

async function ensureBattleMusic() {
  if (musicMuted || latest?.battle?.winner) return false;
  const started = await battleMusic.start().catch(() => false);
  musicButton.dataset.audioState = started ? 'playing' : 'blocked';
  if (!started) {
    musicButton.title = '배틀 음악을 재생하려면 클릭';
    musicButton.setAttribute('aria-label', musicButton.title);
  }
  return started;
}

function updateMusicButton() {
  musicButton.setAttribute('aria-pressed', String(!musicMuted));
  musicButton.title = musicMuted ? '배틀 음악 켜기' : '배틀 음악 끄기';
  musicButton.setAttribute('aria-label', musicButton.title);
}

function showTextBox() {
  menuMode = 'text';
  menu.classList.remove('open');
  commandMenu.classList.remove('open');
  textbox.classList.remove('hidden');
}

function showCommandMenu(payload = latest) {
  if (!payload || localLock || payload.resolving || payload.battle.winner || menuSuppressed || resultShown) {
    showTextBox();
    return;
  }
  menuMode = 'command';
  menu.classList.remove('open');
  textbox.classList.add('hidden');
  commandMenu.classList.add('open');
  commandPrompt.textContent = `${payload.battle.player.name}은\n무엇을 할까?`;
  requestAnimationFrame(() => fightButton.focus());
}

function showMoveMenu() {
  if (!latest || localLock || latest.resolving || latest.battle.winner || menuSuppressed || resultShown) return;
  menuMode = 'moves';
  commandMenu.classList.remove('open');
  textbox.classList.add('hidden');
  menu.classList.add('open');
  requestAnimationFrame(() => moveList.querySelector('button:not(:disabled)')?.focus());
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
  menu.classList.remove('open');
  commandMenu.classList.remove('open');
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
    const sourceWidth = sprite.naturalWidth || sprite.width;
    const sourceHeight = sprite.naturalHeight || sprite.height;
    const scale = Math.min(1, elements.canvas.width / sourceWidth, elements.canvas.height / sourceHeight);
    const width = Math.round(sourceWidth * scale);
    const height = Math.round(sourceHeight * scale);
    context.drawImage(
      sprite,
      Math.round((elements.canvas.width - width) / 2),
      elements.canvas.height - height,
      width,
      height,
    );
  } catch { /* 데이터 준비 실패 시 텍스트/HP 전투는 유지 */ }
}

function drawTrainerIntroSprites() {
  spriteSources.delete('enemy');
  spriteSources.delete('player');
  drawSprite('enemy', FALKNER_SPRITE_DATA_URL);
  drawSprite('player', CHRIS_BACK_SPRITE_DATA_URL);
}

function renderTrainerParty(payload) {
  const isTrainer = payload.battleKind === 'trainer';
  trainerParty.hidden = !isTrainer;
  trainerParty.replaceChildren();
  if (!isTrainer) return;
  for (let index = 0; index < payload.trainerTeamSize; index += 1) {
    const ball = document.createElement('span');
    ball.className = 'party-ball';
    if (index < payload.trainerTeamIndex) ball.classList.add('defeated');
    if (index === payload.trainerTeamIndex) ball.classList.add('active');
    trainerParty.appendChild(ball);
  }
}

function renderCombatant(key, data) {
  const elements = combatantElements(key);
  // 원작 HP박스는 이름과 수치를 나눠 표시한다(적은 수치 비공개 — CSS에서 숨김).
  elements.name.textContent = key === 'enemy' && latest?.battleKind !== 'trainer'
    ? `야생 ${data.name}`
    : data.name;
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
  showTextBox(); // 연출 중에는 원작처럼 텍스트 박스를 보여준다
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
      if (latest.trainerHasNext) {
        message.textContent = `${withParticle(latest.trainerName || '관장', ['은', '는'])} 다음 포켓몬을 준비한다!`;
      } else {
        showResult(latest);
      }
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
  fightButton.disabled = disabled;
  partyButton.disabled = disabled;
  packButton.disabled = disabled;
  runButton.disabled = disabled;
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
  if (disabled || resultShown || menuSuppressed) showTextBox();
  else if (menuMode === 'moves') showMoveMenu();
  else showCommandMenu(payload);
}

// 전투 개시 연출: 화면 플래시 → 블라인드 와이프 → 포켓몬 슬라이드 인 → 등장 대사 → 메뉴.
// 연출 자체는 CSS(#screen.intro)가 돌리고, 여기서는 문구와 메뉴 타이밍만 맞춘다.
function startIntro(payload) {
  menuSuppressed = true;
  introRunning = true;
  showTextBox();
  message.textContent = '';
  root.classList.add('intro');
  for (const timer of introTimers) clearTimeout(timer);
  introTimers = [];

  // 슬라이드 인이 끝나는 시점 = 야생 포켓몬이 화면에 자리잡는 순간. 울음소리도 여기서.
  const isTrainer = payload.battleKind === 'trainer';
  root.classList.toggle('trainer-intro', isTrainer);
  introTimers.push(setTimeout(() => {
    root.classList.remove('intro');
    introRunning = false;
    if (!latest || resultShown) return;
    message.textContent = isTrainer
      ? `체육관 관장 ${withParticle(latest.trainerName || '비상', ['이', '가'])} 승부를 걸어왔다!`
      : introMessage(latest.battle.enemy.name);
    if (!isTrainer) playEnemyCry(latest);
  }, INTRO_ANIM_MS));

  if (isTrainer) {
    introTimers.push(setTimeout(() => {
      if (!latest || resultShown) return;
      root.classList.remove('trainer-intro');
      drawSprite('player', latest.playerSprite);
      drawSprite('enemy', latest.enemySprite);
      message.textContent = `${withParticle(latest.trainerName || '비상', ['은', '는'])} ${withParticle(latest.battle.enemy.name, ['을', '를'])} 내보냈다!`;
      playEnemyCry(latest);
    }, INTRO_ANIM_MS + INTRO_HOLD_MS));
  }

  introTimers.push(setTimeout(() => {
    menuSuppressed = false;
    if (!latest || latest.battle.winner || resultShown) return;
    message.textContent = promptMessage(latest.battle.player.name);
    renderMoves(latest);
  }, INTRO_ANIM_MS + INTRO_HOLD_MS * (isTrainer ? 2 : 1)));
}

function startOpponentSwitch(payload) {
  menuSuppressed = true;
  cryPlayed = false;
  showTextBox();
  root.classList.remove('opponent-switch');
  void root.offsetWidth;
  root.classList.add('opponent-switch');
  drawSprite('enemy', payload.enemySprite);
  message.textContent = `${withParticle(payload.trainerName || '비상', ['은', '는'])} ${withParticle(payload.battle.enemy.name, ['을', '를'])} 내보냈다!`;
  playEnemyCry(payload);
  introTimers.push(setTimeout(() => {
    root.classList.remove('opponent-switch');
    menuSuppressed = false;
    if (!latest || latest.battle.winner || resultShown) return;
    message.textContent = promptMessage(latest.battle.player.name);
    renderMoves(latest);
  }, 1700));
}

function playEnemyCry(payload) {
  if (cryPlayed || !payload?.enemyCry) return;
  cryPlayed = true;
  try { new Audio(payload.enemyCry).play().catch(() => {}); } catch { /* ignore */ }
}

function render(payload) {
  const opponentChanged = lastOpponentSequence != null
    && payload.opponentSequence !== lastOpponentSequence;
  lastOpponentSequence = payload.opponentSequence;
  latest = payload;
  localLock = Boolean(payload.resolving);
  close.hidden = payload.canRun === false;
  root.classList.toggle('player-front-fallback', !payload.playerSpriteIsBack);
  const visibleBattle = payload.events?.length && payload.previousBattle
    ? payload.previousBattle
    : payload.battle;
  renderCombatant('player', visibleBattle.player);
  renderCombatant('enemy', visibleBattle.enemy);
  if (payload.battleKind === 'trainer' && !introShown) drawTrainerIntroSprites();
  else {
    drawSprite('player', payload.playerSprite);
    drawSprite('enemy', payload.enemySprite);
  }
  renderTrainerParty(payload);
  ensureBattleMusic();

  if (opponentChanged) {
    startOpponentSwitch(payload);
    return;
  }

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
  if (!musicMuted && !battleMusic.isPlaying()) {
    ensureBattleMusic();
    return;
  }
  musicMuted = !musicMuted;
  battleMusic.setMuted(musicMuted);
  updateMusicButton();
  if (!musicMuted) ensureBattleMusic();
});

fightButton.addEventListener('click', () => {
  if (fightButton.disabled || !latest) return;
  renderMoves(latest);
  showMoveMenu();
});

function showCommandMessage(text, holdMs = 900) {
  if (commandMessageTimer) clearTimeout(commandMessageTimer);
  showTextBox();
  message.textContent = text;
  commandMessageTimer = setTimeout(() => {
    commandMessageTimer = null;
    if (!latest || resultShown) return;
    message.textContent = promptMessage(latest.battle.player.name);
    showCommandMenu(latest);
  }, holdMs);
}

partyButton.addEventListener('click', () => {
  if (!partyButton.disabled) showCommandMessage('지금은 포켓몬을 바꿀 수 없다!');
});

packButton.addEventListener('click', () => {
  if (!packButton.disabled) showCommandMessage('지금은 도구를 사용할 수 없다!');
});

runButton.addEventListener('click', async () => {
  if (runButton.disabled || !latest) return;
  if (latest.canRun === false) {
    showCommandMessage('트레이너 배틀에서는 도망칠 수 없다!', 1100);
    return;
  }
  const battleId = latest.battleId;
  localLock = true;
  runButton.disabled = true;
  showTextBox();
  message.textContent = '무사히 도망쳤다!';
  await battleMusic.playRun();
  setTimeout(() => window.pkmn?.leaveBattle?.(battleId), 700);
});

window.addEventListener('pointerdown', ensureBattleMusic, { passive: true });

close.addEventListener('click', () => {
  if (latest?.canRun !== false) window.pkmn?.leaveBattle?.(latest.battleId);
});
window.addEventListener('keydown', (event) => {
  ensureBattleMusic();
  if (event.key === 'Escape' && menuMode === 'moves') showCommandMenu(latest);
  if (event.key.toLowerCase() === 'm') musicButton.click();
});
window.addEventListener('beforeunload', () => battleMusic.stop());
window.pkmn?.onBattleState?.(render);
updateMusicButton();
