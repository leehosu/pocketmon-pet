// AI-GENERATED: 투명 야생 조우 창의 스프라이트, 체류 시간, 클릭을 처리한다.
import { loadSpriteCutout } from './sprite-alpha.js';

const button = document.getElementById('wild');
const canvas = document.getElementById('sprite');
const context = canvas.getContext('2d');
let encounter = null;
let audioPlayed = false;

async function drawSprite(src) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  try {
    const sprite = await loadSpriteCutout(src);
    context.imageSmoothingEnabled = false;
    context.drawImage(sprite, 0, 0, canvas.width, canvas.height);
  } catch { /* 메인에서 준비된 데이터만 전달하므로 창 종료를 기다린다 */ }
}

button.addEventListener('click', () => {
  if (encounter && window.pkmn?.acceptEncounter) window.pkmn.acceptEncounter(encounter.id);
});

window.pkmn?.onWildState?.((payload) => {
  encounter = payload;
  const label = `야생 ${payload.name} Lv.${payload.level} — 클릭하여 배틀`;
  button.title = label;
  button.setAttribute('aria-label', label);
  canvas.setAttribute('aria-label', `야생 ${payload.name}`);
  drawSprite(payload.sprite);
  if (!audioPlayed && payload.cry) {
    audioPlayed = true;
    try { new Audio(payload.cry).play().catch(() => {}); } catch { /* ignore */ }
  }
});
