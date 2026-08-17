// AI-GENERATED: 메인 프로세스가 계산한 2세대 전투 스냅샷과 이벤트만 표시한다.
import { loadSpriteCutout } from './sprite-alpha.js';
import { createBattleMusic } from './battle-audio.js';
import { battleResultView } from './battle-result.js';

const root = document.getElementById('battle');
const message = document.getElementById('message');
const moves = document.getElementById('moves');
const close = document.getElementById('close');
const musicButton = document.getElementById('music');
const resultPanel = document.getElementById('result');
const resultTitle = document.getElementById('result-title');
const resultXp = document.getElementById('result-xp');
const resultDetail = document.getElementById('result-detail');
let latest = null;
let localLock = false;
let cryPlayed = false;
let eventTimers = [];
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

function showResult(payload) {
  if (resultShown) return;
  const view = battleResultView(payload);
  if (!view) return;
  resultShown = true;
  resultTitle.textContent = view.title;
  resultXp.textContent = view.xpText;
  resultDetail.textContent = view.detail;
  resultPanel.hidden = false;
  moves.classList.add('hidden');
  message.style.visibility = 'hidden';
  if (view.won) battleMusic.playVictory().catch(() => {});
  else battleMusic.stopLoop();
}

function combatantElements(key) {
  const element = document.getElementById(key);
  return {
    element,
    canvas: element.querySelector('canvas'),
    name: element.querySelector('.name'),
    level: element.querySelector('.level'),
    hp: element.querySelector('.hp>span'),
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

function hpColor(ratio) {
  if (ratio <= 0.2) return '#ef5959';
  if (ratio <= 0.5) return '#e6bf45';
  return '#4ed36b';
}

function renderCombatant(key, data) {
  const elements = combatantElements(key);
  const ratio = Math.max(0, Math.min(1, data.hp / Math.max(1, data.maxHp)));
  elements.name.textContent = `${data.name}  ${data.hp}/${data.maxHp}`;
  elements.level.textContent = `Lv.${data.level}`;
  elements.hp.style.width = `${Math.round(ratio * 100)}%`;
  elements.hp.style.background = hpColor(ratio);
}

function eventText(event) {
  if (event.kind === 'move') {
    const actor = event.actor === 'player' ? latest.battle.player.name : latest.battle.enemy.name;
    const move = event.actor === 'player'
      ? latest.playerMoves.find((entry) => entry.slug === event.moveSlug)?.name
      : null;
    return `${actor}의 ${move || event.move.replaceAll('_', ' ')}`;
  }
  if (event.kind === 'miss') return '공격이 빗나갔다';
  if (event.kind === 'no-effect') return '효과가 없는 것 같다';
  if (event.kind === 'charge') return '빛을 모으기 시작했다';
  if (event.kind === 'heal') return `HP를 ${event.amount} 회복했다`;
  if (event.kind === 'status') return `${statusName(event.status)} 상태가 되었다`;
  if (event.kind === 'status-cleared') return `${statusName(event.status)} 상태에서 회복했다`;
  if (event.kind === 'stat') return `${event.stat} ${event.change > 0 ? '상승' : '하락'}`;
  if (event.kind === 'unable') return `${event.reason} 때문에 움직일 수 없다`;
  if (event.kind === 'faint') return `${event.target === 'player' ? latest.battle.player.name : latest.battle.enemy.name}은(는) 쓰러졌다`;
  if (event.kind === 'damage' && event.critical) return '급소에 맞았다';
  if (event.kind === 'damage' && event.effectiveness > 1) return '효과가 굉장했다';
  if (event.kind === 'damage' && event.effectiveness > 0 && event.effectiveness < 1) return '효과가 별로인 듯하다';
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
  const rect = anchor.getBoundingClientRect();
  element.style.left = `${rect.left + rect.width / 2}px`;
  element.style.top = `${rect.top + rect.height / 2}px`;
  root.appendChild(element);
  setTimeout(() => element.remove(), 950);
}

function playEvents(events) {
  for (const timer of eventTimers) clearTimeout(timer);
  eventTimers = [];
  events.forEach((event, index) => {
    eventTimers.push(setTimeout(() => {
      const text = eventText(event);
      if (text) message.textContent = text;
      damageFloat(event);
    }, index * 300));
  });
  if (latest.battle.winner) {
    eventTimers.push(setTimeout(() => {
      showResult(latest);
    }, events.length * 300 + 120));
  }
}

function renderMoves(payload) {
  moves.replaceChildren();
  const disabled = localLock || payload.resolving || Boolean(payload.battle.winner);
  for (const move of payload.playerMoves) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'move';
    button.textContent = move.name;
    button.disabled = disabled;
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
    moves.appendChild(button);
  }
}

function render(payload) {
  latest = payload;
  localLock = Boolean(payload.resolving);
  renderCombatant('player', payload.battle.player);
  renderCombatant('enemy', payload.battle.enemy);
  drawSprite('player', payload.playerSprite);
  drawSprite('enemy', payload.enemySprite);
  renderMoves(payload);
  ensureBattleMusic();
  if (payload.events?.length) playEvents(payload.events);
  else if (payload.battle.winner) showResult(payload);
  else message.textContent = `TURN ${payload.turn}`;
  if (!cryPlayed && payload.enemyCry) {
    cryPlayed = true;
    try { new Audio(payload.enemyCry).play().catch(() => {}); } catch { /* ignore */ }
  }
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
