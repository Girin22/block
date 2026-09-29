/// <reference types="vite/client" />
import './style.css';
import { formatMeters, Pavement, SPAWN_ROTATION, SPAWN_X, type Rotation } from '../../../packages/play-core';
import { PlayScene } from './scene';
import { PlaySound } from './sound';
import { isDownSwipe, swipeAxis, type SwipeAxis } from './input';
import { downloadFile, Receipt, receiptPhoto } from './export';
import { mountReceiptPreview } from './receipt-preview';
import { PauseIcon } from './pause-icon';
import { PlayTimer } from './play-timer';
import { tileImages } from './tile-assets';
import { Rain } from './rain';
import { RainAmbience } from './rain-sound';
import pauseButtonSoundURL from '../../../assets/sfx/ES_Objects, Fashion, Shoes, Work Boot, Drop Down On Ground - Epidemic Sound.mp3?url';
import hit01URL from '../../../assets/sfx/place/place-01.wav?url';
import hit05URL from '../../../assets/sfx/place/place-05.wav?url';
import hit06URL from '../../../assets/sfx/place/place-06.wav?url';
import hit12URL from '../../../assets/sfx/place/place-12.wav?url';
import hit14URL from '../../../assets/sfx/place/place-14.wav?url';
import hit16URL from '../../../assets/sfx/place/place-16.wav?url';
import fillDragURL from '../../../assets/sfx/place/ES_Rocks, Movement, Stone, Drag, Stone Surface, Small, Short Movements - Epidemic Sound - 7121-9251.wav?url';
import rainSoundURL from '../../../assets/audio/날씨_비/rain-window.mp3?url';
import { Soundscape, type Environment } from './ambience';
import hanokAlleyURL from '../../../assets/audio/거리/L03256-004.mp3?url';
import seonbiAlleyURL from '../../../assets/audio/거리/L03258-004.mp3?url';
import pohangMarketURL from '../../../assets/audio/거리/L03314-004.mp3?url';
import ulsanStreetURL from '../../../assets/audio/거리/L03320-004.mp3?url';
import buntingURL from '../../../assets/audio/아침 새/L01336-002+B+KR_KSL2022_A0184+동물_조류_가을 숲속, 봄가을 철새인 촉새가 촉촉거리며 우는 소리_48khz320kbp_Mono.mp3?url';
import sparrowURL from '../../../assets/audio/아침 새/L01371-002+B+KR_KSL2022_A0219+새_참새_철원 동송읍_오덕리 학저수지 주차장 옆 쉼터 초가지붕에서 짹짹거리는 소리_48khz320kbps_Mono-01.mp3?url';
import warblerURL from '../../../assets/audio/아침 새/L01534-002+B+KR_KSL2022_A0382+동물_조류_무당개구리 울음소리 배경, 솔새 지저귀는 소리_48khz320kbps_Mono.mp3?url';
import cricketURL from '../../../assets/audio/밤 개구리/L01330-002+B+KR_KSL2022_A0178+동물_곤충_강 마을의 극동귀뚜라미 울음소리_48khz320kbp_Mono.mp3?url';
import woodFrogURL from '../../../assets/audio/밤 개구리/L01554-002+B+KR_KSL2022_A0402+동물_양서류_계곡 숲의 북방산개구리 울음소리, 새소리와 함께_48khz320kbps_Mono.mp3?url';
import frogsURL from '../../../assets/audio/밤 개구리/개구리C.wav?url';
import { environmentIcons } from './environment-icons';

// Planner preview: the pause screen can switch the ambient environment. Not decided for release yet.
const ENVIRONMENTS: { id: Environment; label: string }[] = [
  { id: 'morning', label: '아침' }, { id: 'day', label: '낮' }, { id: 'night', label: '밤' }, { id: 'rain', label: '비' },
];
document.querySelector('#app')!.innerHTML = `<main class="play">
  <canvas id="playfield" tabindex="0" aria-label="블록 쌓기. 좌우 스와이프로 이동, 탭으로 회전, 아래 스와이프로 배치."></canvas>
  <section id="pause-actions" aria-label="일시정지 기록" aria-hidden="true" inert>
    <div class="pause-content">
      <div id="environment" role="radiogroup" aria-label="환경">
        <span class="environment-thumb" aria-hidden="true"></span>
        ${ENVIRONMENTS.map(({ id, label }) => `<button role="radio" data-environment="${id}" aria-label="${label}" title="${label}" aria-checked="false" tabindex="-1">${environmentIcons[id]}</button>`).join('')}
      </div>
      <span class="stat-text" id="path-length" aria-label="깔린 길이">0.0미터</span>
      <img class="stat-icon" src="${tileImages.vertical}" alt="놓은 초록 블록"/>
      <span class="stat-text" id="green-count" aria-label="놓은 초록 블록 수">0</span>
      <img class="stat-icon small" src="${tileImages.center}" alt="자동 채움 흰 블록"/>
      <span class="stat-text" id="white-count" aria-label="자동 채움 흰 블록 수">0</span>
      <button id="export">내보내기</button>
    </div>
  </section>
  <button id="pause" aria-label="일시정지" aria-pressed="false" aria-controls="pause-actions"><canvas id="pause-animation" width="40" height="40" aria-hidden="true"></canvas></button>
</main><dialog id="pause-menu" class="receipt-open" aria-label="이미지 저장"></dialog>`;
const canvas = document.querySelector<HTMLCanvasElement>('#playfield')!;
canvas.setAttribute('aria-label', '화면 어디서든 좌우 스와이프로 이동, 아래 스와이프로 내리기. 위로 이동 불가. 탭으로 회전.');
const menu = document.querySelector<HTMLDialogElement>('#pause-menu')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
const play = document.querySelector<HTMLElement>('.play')!;
const pauseActions = document.querySelector<HTMLElement>('#pause-actions')!;
const pauseIcon = new PauseIcon(pauseButton, document.querySelector<HTMLCanvasElement>('#pause-animation')!);
const playTimer = new PlayTimer();
let paused = false;
const receiptPanel = document.createElement('section');
receiptPanel.id = 'receipt-panel'; receiptPanel.hidden = true;
receiptPanel.innerHTML = `<header class="receipt-header"><button id="receipt-back" aria-label="영수증 닫기">닫기</button></header><div id="receipt-scroll"><div id="receipt-image" role="img" aria-label="이번 게임에서 만든 보도 영수증"></div></div><footer class="receipt-footer"><p id="receipt-status" role="status"></p><button id="receipt-save">이미지 저장</button></footer>`;
menu.append(receiptPanel);
const saveButton = document.querySelector<HTMLButtonElement>('#receipt-save')!;
const backButton = document.querySelector<HTMLButtonElement>('#receipt-back')!;
const receiptStatus = document.querySelector<HTMLElement>('#receipt-status')!;
const limitNote = document.createElement('p'); limitNote.id = 'session-limit'; limitNote.hidden = true;
limitNote.textContent = '172,800개를 모두 놓았어요. 내보내기로 길을 저장해 주세요.';
const exportButton = document.querySelector<HTMLButtonElement>('#export')!;
exportButton.before(limitNote);
const exportStatus = document.createElement('p'); exportStatus.id = 'export-status'; exportStatus.setAttribute('role', 'status');
exportButton.after(exportStatus);
// The receipt preview popup is legacy: kept for the browser checks, reached only with ?receipt.
const legacyReceipt = new URLSearchParams(location.search).has('receipt');
let exporting = false;
// Warm the handwriting face so the pause summary and the exported label never fall back.
void Promise.all([document.fonts?.load('16px GangBuJang'), document.fonts?.load('16px Jost')]).catch(() => {});
let photo: File | undefined, photoURL: string | undefined;
let photoGeneration = 0, savingPhoto = false, manualPhoto = false;
let generationAbort: AbortController | undefined, disposePreview: (() => void) | undefined;
// Admin mode (?admin) adds tools outside the game screen. Nothing here affects rules or the export.
const admin = new URLSearchParams(location.search).has('admin');
const weather = document.createElement('canvas'); weather.id = 'weather'; weather.setAttribute('aria-hidden', 'true');
// The rain recording is only requested once the rain environment is first chosen.
const rainAmbience = new RainAmbience(rainSoundURL);
canvas.after(weather); const rain = new Rain(weather, rainAmbience);
if (admin) {
  const panel = document.createElement('aside'); panel.id = 'admin'; panel.setAttribute('aria-label', '관리자 도구');
  panel.innerHTML = '<span>관리자</span><p class="device" id="device-motion"></p><p class="device" id="device-audio"></p>';
  // The game ignores this setting; the readout only explains what a tester's phone is doing.
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const showMotion = () => { panel.querySelector('#device-motion')!.innerHTML = reduceMotion.matches ? '동작 줄이기 <b>켜짐</b> (앱 동작에는 영향 없음)' : '동작 줄이기 꺼짐'; };
  showMotion(); reduceMotion.addEventListener('change', showMotion);
  document.body.append(panel);
  // Silent mode on an iPhone mutes this page's sound without any error, so "재생 중" with no sound
  // points at the device, while "막힘" points at the browser refusing to start audio.
  const audio = panel.querySelector('#device-audio')!;
  setInterval(() => { audio.innerHTML = soundscape.status; }, 500);
}
let board = new Pavement(), started = new Date();
const sound = new PlaySound(pauseButtonSoundURL, [hit01URL, hit05URL, hit06URL, hit12URL, hit14URL, hit16URL], fillDragURL);
// Loudness of each recording (integrated LUFS) so every environment plays at the same level. The frog
// chorus never pauses, so at the same measured level it feels louder; it sits 3 dB lower.
const soundscape = new Soundscape({
  day: { repeat: false, tracks: [{ url: hanokAlleyURL, lufs: -25.6 }, { url: seonbiAlleyURL, lufs: -25.7 }, { url: pohangMarketURL, lufs: -25.9 }, { url: ulsanStreetURL, lufs: -26.4 }] },
  morning: { repeat: true, tracks: [{ url: buntingURL, lufs: -36.2 }, { url: sparrowURL, lufs: -35.2 }, { url: warblerURL, lufs: -27.8 }] },
  night: { repeat: true, tracks: [{ url: cricketURL, lufs: -29.5 }, { url: woodFrogURL, lufs: -47.9 }, { url: frogsURL, lufs: -28.2, trim: -3 }] },
});
/** Ambience plays while the game plays and holds while it is paused. Browsers need a gesture to start it. */
function playAmbience() {
  soundscape.play();
  if (soundscape.environment === 'rain') rainAmbience.unlock();
  rainAmbience.setPaused(false);
}
// Touch-down starts sound early where browsers allow it; strict ones (Chrome on iPhone, Android Chrome)
// only allow it when the finger lifts, so every tap retries until the ambience and effects are running.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const) {
  document.addEventListener(type, () => { if (!paused && !menu.open) { sound.unlock(); playAmbience(); } }, { capture: true });
}
let view: PlayScene;
let x = SPAWN_X, rotation: Rotation = SPAWN_ROTATION;
let gesture: { id: number; x: number; y: number; lastY: number; column: number; moved: boolean; lowered: boolean; axis?: SwipeAxis } | undefined;
function createScene() {
  try {
    view = new PlayScene(canvas, board, drop, rain); view.aim(x, rotation);
    view.onFillSeat = () => { if (!paused && !document.hidden) sound.place(true); };
    view.onFillDrag = () => { if (!paused && !document.hidden) sound.drag(); };
    if (import.meta.env.DEV && board.tiles.length) view.add(board.tiles.filter(tile => tile.y >= board.height - 24), false);
  }
  catch (error) {
    console.error(error); const message = document.createElement('p'); message.className = 'render-error';
    message.textContent = '3D 화면을 열 수 없어요. 하드웨어 가속을 지원하는 브라우저에서 다시 열어주세요.';
    document.querySelector('.play')!.append(message);
  }
}
// Explicit, local-development-only fixture. A normal reload/session is unchanged.
if (import.meta.env.DEV) {
  const params = new URLSearchParams(location.search);
  const count = Number(params.get('stress'));
  if (Number.isFinite(count) && count > 0) {
    const { stressBoard } = await import('./stress');
    board = stressBoard(count, params.get('layout') === 'tower');
    started = new Date(Date.now() - 3600000);
  }
}
createScene();
const blocked = () => paused || menu.open || !view || view.busy || document.hidden;
function aim(column: number, nextRotation = rotation) {
  if (view.aim(column, nextRotation)) { rotation = nextRotation; x = view.column; }
}
function drop() {
  if (blocked()) return;
  sound.unlock();
  const column = x, orientation = rotation;
  const landing = board.landingFrom(column, view.activeY, orientation);
  view.drop(() => {
    const added = board.place(column, landing.y, orientation); view.add(added); sound.place();
    // A fresh piece always enters at the current camera's upper center.
    x = SPAWN_X; rotation = SPAWN_ROTATION; view.spawn();
    if (board.atLimit) pause();
  });
}
canvas.addEventListener('pointerdown', event => {
  if (blocked() || gesture || !event.isPrimary || event.button !== 0) return;
  event.preventDefault(); canvas.focus({ preventScroll: true }); sound.unlock();
  view.beginDrag(); playTimer.start();
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastY: event.clientY, column: x, moved: false, lowered: false };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!gesture || gesture.id !== event.pointerId || blocked()) return;
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
  if (Math.hypot(dx, dy) > 12) gesture.moved = true;
  gesture.axis ??= swipeAxis(dx, dy);
  if (gesture.moved) {
    if (gesture.axis === 'horizontal') aim(gesture.column + Math.round(dx / view.cellPixels));
    const down = Math.max(0, event.clientY - gesture.lastY);
    if (gesture.axis === 'vertical') {
      if (isDownSwipe(dx, dy)) gesture.lowered = true;
      if (down > 0) view.lower(down / view.cellPixels);
    }
  }
  gesture.lastY = event.clientY;
});
canvas.addEventListener('pointerup', event => {
  const g = gesture; if (!g || g.id !== event.pointerId) return;
  gesture = undefined; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  view.endDrag();
  if (blocked()) return;
  const dx = event.clientX - g.x, dy = event.clientY - g.y;
  if (!g.moved && Math.hypot(dx, dy) < 12) aim(x, ((rotation + 1) % 4) as Rotation);
  else if (g.lowered && isDownSwipe(dx, dy) && view.canRelease) drop();
});
function cancelGesture() { if (gesture) { gesture = undefined; view?.endDrag(); } }
canvas.addEventListener('pointercancel', cancelGesture);
canvas.addEventListener('lostpointercapture', cancelGesture);
canvas.addEventListener('keydown', event => {
  if (blocked() || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) return;
  view.start(); playTimer.start(); // Keyboard testing is equivalent to the first tile interaction.
  event.preventDefault(); sound.unlock();
  if (event.code === 'ArrowLeft') aim(x - 1);
  else if (event.code === 'ArrowRight') aim(x + 1);
  else if (event.code === 'ArrowUp') aim(x, ((rotation + 1) % 4) as Rotation);
  else drop();
});
function updatePauseUI() {
  play.classList.toggle('is-paused', paused);
  pauseActions.inert = !paused; pauseActions.setAttribute('aria-hidden', String(!paused));
  canvas.inert = paused;
  pauseButton.setAttribute('aria-pressed', String(paused));
  pauseButton.setAttribute('aria-label', paused ? '재개' : '일시정지');
  pauseButton.disabled = board.atLimit;
  limitNote.hidden = !board.atLimit;
  pauseIcon.setPaused(paused);
}
function pause() {
  cancelGesture(); playTimer.pause(); view?.pause(true); sound.pause();
  soundscape.pause(); rainAmbience.setPaused(true);
  if (paused) return;
  paused = true;
  document.querySelector('#path-length')!.textContent = formatMeters(board.filled);
  document.querySelector('#green-count')!.textContent = String(board.greens);
  document.querySelector('#white-count')!.textContent = String(board.tiles.length - board.greens);
  updatePauseUI();
}
function resume() {
  if (board.atLimit || menu.open) return;
  paused = false; updatePauseUI(); playTimer.resume();
  view?.pause(false); sound.unlock(); playAmbience(); canvas.focus({ preventScroll: true });
}
const environmentButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#environment [data-environment]'));
function showEnvironment() {
  const index = ENVIRONMENTS.findIndex(({ id }) => id === soundscape.environment);
  document.querySelector<HTMLElement>('#environment')!.style.setProperty('--selected', String(index));
  environmentButtons.forEach((button, i) => { button.setAttribute('aria-checked', String(i === index)); button.tabIndex = i === index ? 0 : -1; });
}
function chooseEnvironment(environment: Environment) {
  soundscape.select(environment); rain.set(environment === 'rain');
  // Unlocking inside the tap lets the rain recording start later, when play resumes.
  if (environment === 'rain') rainAmbience.unlock();
  showEnvironment();
}
environmentButtons.forEach(button => button.addEventListener('click', () => chooseEnvironment(button.dataset.environment as Environment)));
document.querySelector<HTMLElement>('#environment')!.addEventListener('keydown', event => {
  const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  const index = (ENVIRONMENTS.findIndex(({ id }) => id === soundscape.environment) + step + ENVIRONMENTS.length) % ENVIRONMENTS.length;
  chooseEnvironment(ENVIRONMENTS[index].id); environmentButtons[index].focus();
});
showEnvironment();
function closeReceipt() {
  generationAbort?.abort(); generationAbort = undefined;
  disposePreview?.(); disposePreview = undefined;
  photoGeneration++; photo = undefined; manualPhoto = false;
  if (photoURL) URL.revokeObjectURL(photoURL); photoURL = undefined;
  receiptPanel.hidden = true;
  document.querySelector('#receipt-image')!.replaceChildren();
}
function resetSession() {
  gesture = undefined; view?.dispose(); sound.reset(); rain.clearMarks(); soundscape.newSession();
  board = new Pavement(); started = new Date(); x = SPAWN_X; rotation = SPAWN_ROTATION; playTimer.reset();
  limitNote.hidden = true; pauseButton.disabled = false;
  createScene(); view?.pause(paused);
}
pauseButton.addEventListener('click', () => { sound.button(); if (paused) resume(); else pause(); });
document.addEventListener('keydown', event => {
  if (event.code === 'Escape' && paused && !menu.open) { event.preventDefault(); resume(); }
});
exportButton.addEventListener('click', async () => {
  if (!paused || menu.open || exporting) return;
  if (legacyReceipt) { void openReceipt(); return; }
  // Save straight away: a transparent PNG of the whole pavement, then a fresh session.
  exporting = true; exportButton.disabled = true; exportButton.textContent = '저장 중'; exportStatus.textContent = '';
  try {
    const receipt = new Receipt(board, started);
    let file: File;
    if (receipt.format === 'png' && typeof CompressionStream !== 'undefined') {
      file = await receiptPhoto(receipt, undefined, value => { exportButton.textContent = `저장 중 ${Math.round(value * 100)}%`; })
        .catch(() => receipt.svgFile());
    } else file = await receipt.svgFile();
    downloadFile(file);
    resetSession(); resume();
  } catch {
    exportStatus.textContent = '저장하지 못했어요. 다시 시도해 주세요.';
  } finally { exporting = false; exportButton.disabled = false; exportButton.textContent = '내보내기'; }
});
async function openReceipt() {
  generationAbort?.abort(); disposePreview?.();
  generationAbort = new AbortController();
  const signal = generationAbort.signal;
  const generation = ++photoGeneration;
  const receipt = new Receipt(board, started);
  receiptStatus.textContent = '';
  photo = undefined; manualPhoto = false;
  saveButton.disabled = true; saveButton.textContent = '사진 준비 중…';
  receiptPanel.hidden = false; menu.returnValue = ''; menu.showModal();
  document.querySelector('#receipt-scroll')!.scrollTop = 0;
  disposePreview = mountReceiptPreview(document.querySelector<HTMLElement>('#receipt-image')!, document.querySelector<HTMLElement>('#receipt-scroll')!, receipt);
  try {
    const useSVG = receipt.format === 'svg' || typeof CompressionStream === 'undefined';
    if (useSVG) {
      saveButton.textContent = 'SVG 준비 중…';
      receiptStatus.textContent = '전체를 선명하게 보관하기 위해 SVG 파일로 저장해요. 사진 앱이 아닌 파일에 저장됩니다.';
    }
    // Prepare before the save tap to retain iOS user activation for its native menu.
    let prepared: File;
    if (useSVG) prepared = await receipt.svgFile(signal);
    else {
      try {
        prepared = await receiptPhoto(receipt, signal, value => {
          if (generation === photoGeneration) saveButton.textContent = `사진 준비 중 ${Math.round(value * 100)}%`;
        });
      } catch (error) {
        if (signal.aborted) throw error;
        receiptStatus.textContent = '이 기기에서 사진을 만들 수 없어 SVG 파일로 저장해요. 파일 앱에서 확인해 주세요.';
        prepared = await receipt.svgFile(signal);
      }
    }
    if (generation !== photoGeneration) return;
    photo = prepared; saveButton.disabled = false; saveButton.textContent = prepared.type === 'image/png' ? '사진 저장' : 'SVG 파일 저장';
  } catch {
    if (generation !== photoGeneration) return;
    saveButton.textContent = '사진 준비 실패';
    receiptStatus.textContent = '사진을 만들지 못했어요. 닫고 다시 시도해 주세요.';
  }
}
document.querySelector('#receipt-back')!.addEventListener('click', () => {
  menu.close('cancelled');
});
saveButton.addEventListener('click', async () => {
  if (savingPhoto || !photo) return;
  if (manualPhoto) { resetSession(); menu.close('saved'); return; }
  if (photo.type === 'image/svg+xml') {
    try { downloadFile(photo); resetSession(); menu.close('saved'); }
    catch { receiptStatus.textContent = '파일을 저장하지 못했어요. 다시 시도해 주세요.'; }
    return;
  }
  if (navigator.share && navigator.canShare?.({ files: [photo] })) {
    savingPhoto = true; saveButton.disabled = true; backButton.disabled = true;
    receiptStatus.textContent = '저장 메뉴에서 ‘이미지 저장’을 선택해 주세요.';
    try {
      await navigator.share({ files: [photo] });
      resetSession(); menu.close('saved');
    } catch (error) {
      receiptStatus.textContent = error instanceof Error && error.name === 'AbortError'
        ? '' : '저장 메뉴를 열지 못했어요. 다시 시도해 주세요.';
    } finally {
      savingPhoto = false; saveButton.disabled = false; backButton.disabled = false;
    }
  } else {
    // HTTP LAN / unsupported browser: show a real PNG for native long-press Save Image.
    photoURL = URL.createObjectURL(photo);
    disposePreview?.(); disposePreview = undefined;
    const image = document.createElement('img'); image.src = photoURL; image.alt = '전체 패턴 사진';
    document.querySelector('#receipt-image')!.replaceChildren(image);
    manualPhoto = true; saveButton.textContent = '저장 완료';
    receiptStatus.textContent = '사진을 길게 눌러 저장해 주세요. PC에서는 우클릭으로 저장할 수 있어요. 저장 후 아래 버튼을 눌러 주세요.';
  }
});
menu.addEventListener('cancel', event => { if (savingPhoto) event.preventDefault(); });
menu.addEventListener('close', () => {
  closeReceipt();
  if (menu.returnValue === 'saved') resume();
  else exportButton.focus();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { gesture = undefined; playTimer.pause(); sound.pause(); soundscape.pause(); rainAmbience.setPaused(true); });
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  // A full navigation back from the browser cache starts a fresh, unsaved canvas.
  resetSession(); if (menu.open) menu.close('saved'); else resume();
});
if (board.atLimit) pause();
