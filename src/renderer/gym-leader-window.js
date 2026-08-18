// AI-GENERATED: 골드 원작 비상 스프라이트와 데스크톱 도전 입력을 표시한다.
import { loadSpriteCutout } from './sprite-alpha.js';
import { FALKNER_SPRITE_DATA_URL } from './trainer-sprites.js';

const canvas = document.getElementById('leader');
const context = canvas.getContext('2d');
const challenge = document.getElementById('challenge');
const close = document.getElementById('close');
const line = document.getElementById('line');
const timeFill = document.querySelector('#time>span');

let encounter = null;
let shownAt = Date.now();

async function drawFalkner() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  try {
    const sprite = await loadSpriteCutout(FALKNER_SPRITE_DATA_URL);
    context.imageSmoothingEnabled = false;
    context.drawImage(sprite, 0, 0, canvas.width, canvas.height);
  } catch { /* 대사와 도전 버튼은 계속 동작한다 */ }
}

function animateLife(now) {
  if (encounter) {
    const duration = Math.max(1, encounter.expiresAt - shownAt);
    const remaining = Math.max(0, encounter.expiresAt - now);
    timeFill.style.transform = `scaleX(${Math.min(1, remaining / duration)})`;
  }
  requestAnimationFrame(animateLife);
}

challenge.addEventListener('click', () => {
  if (!encounter || encounter.busy) return;
  window.pkmn?.acceptGymLeader?.(encounter.id);
});

close.addEventListener('click', () => {
  if (encounter) window.pkmn?.dismissGymLeader?.(encounter.id);
});

window.pkmn?.onGymLeaderState?.((payload) => {
  const changed = encounter?.id !== payload.id;
  encounter = payload;
  if (changed) shownAt = Date.now();
  challenge.disabled = Boolean(payload.busy);
  challenge.textContent = payload.busy ? '포켓몬을 준비하는 중…' : '승부를 받아들인다';
  line.textContent = payload.error
    ? payload.error
    : '새처럼 우아한 비행포켓몬의 힘, 받아낼 수 있겠어?';
});

drawFalkner();
requestAnimationFrame(animateLife);
