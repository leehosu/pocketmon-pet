// AI-GENERATED: 투명 야생 조우 창의 스프라이트, 체류 시간, 클릭을 처리한다.
import { loadSpriteCutout } from './sprite-alpha.js';
import { withParticle } from './battle-view.js';

const button = document.getElementById('wild');
const canvas = document.getElementById('sprite');
const context = canvas.getContext('2d');
const name = document.getElementById('name');
const level = document.getElementById('level');
const message = document.getElementById('message');
const life = document.getElementById('life-fill');
let encounter = null;
let startedAt = 0;
let audioPlayed = false;

async function drawSprite(src) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  try {
    const sprite = await loadSpriteCutout(src);
    context.imageSmoothingEnabled = false;
    context.drawImage(sprite, 0, 0, canvas.width, canvas.height);
  } catch { /* 메인에서 준비된 데이터만 전달하므로 창 종료를 기다린다 */ }
}

function animateLife(now) {
  if (!encounter) return requestAnimationFrame(animateLife);
  const duration = Math.max(1, encounter.expiresAt - startedAt);
  const remaining = Math.max(0, encounter.expiresAt - now);
  life.style.transform = `scaleX(${remaining / duration})`;
  requestAnimationFrame(animateLife);
}

button.addEventListener('click', () => {
  if (encounter && window.pkmn?.acceptEncounter) window.pkmn.acceptEncounter(encounter.id);
});

window.pkmn?.onWildState?.((payload) => {
  encounter = payload;
  startedAt = Date.now();
  name.textContent = payload.name;
  level.textContent = `Lv.${payload.level}`;
  message.textContent = `앗! 야생 ${withParticle(payload.name, ['이', '가'])} 나타났다!`;
  drawSprite(payload.sprite);
  if (!audioPlayed && payload.cry) {
    audioPlayed = true;
    try { new Audio(payload.cry).play().catch(() => {}); } catch { /* ignore */ }
  }
});

requestAnimationFrame(animateLife);
