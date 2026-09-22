/// <reference types="vite/client" />
import './style.css';
import { Pavement, SPAWN_ROTATION, SPAWN_X, type Rotation } from '../../../packages/play-core';
import { PlayScene } from './scene';
import { PlaySound } from './sound';
import { isDownSwipe, swipeAxis, type SwipeAxis } from './input';
import { downloadFile, Receipt, receiptPhoto } from './export';
import { mountReceiptPreview } from './receipt-preview';
import { PauseIcon } from './pause-icon';
import { PlayTimer } from './play-timer';
import { FILL_LANDS } from './drop-motion';
import { tileImages } from './tile-assets';
import { Rain } from './rain';
import { RainAmbience } from './rain-sound';
import rainSoundURL from '../../../assets/audio/rain-window.mp3?url';

document.querySelector('#app')!.innerHTML = `<main class="play">
  <canvas id="playfield" tabindex="0" aria-label="블록 쌓기. 좌우 스와이프로 이동, 탭으로 회전, 아래 스와이프로 배치."></canvas>
  <section id="pause-actions" aria-label="일시정지 기록" aria-hidden="true" inert>
    <div class="pause-content">
      <div class="pause-stat" aria-label="플레이 시간"><img src="${tileImages.vertical}" alt=""/><span id="play-time">0min</span></div>
      <div class="pause-stat" aria-label="놓은 초록 블록 수"><img src="${tileImages.vertical}" alt=""/><span id="green-count">0</span></div>
      <div class="pause-stat" aria-label="자동 채움 흰 블록 수"><img class="center-icon" src="${tileImages.center}" alt=""/><span id="white-count">0</span></div>
      <button id="export">Export</button>
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
limitNote.textContent = '172,800개를 모두 놓았어요. Export에서 길을 저장해 주세요.';
document.querySelector('#export')!.before(limitNote);
let photo: File | undefined, photoURL: string | undefined;
let photoGeneration = 0, savingPhoto = false, manualPhoto = false;
let generationAbort: AbortController | undefined, disposePreview: (() => void) | undefined;
// Admin mode (?admin) adds tools outside the game screen. Nothing here affects rules or the export.
const admin = new URLSearchParams(location.search).has('admin');
let rain: Rain | undefined;
if (admin) {
  const weather = document.createElement('canvas'); weather.id = 'weather'; weather.setAttribute('aria-hidden', 'true');
  // The recording is only requested once the rain is first switched on.
  const ambience = new RainAmbience(rainSoundURL);
  canvas.after(weather); rain = new Rain(weather, ambience);
  const panel = document.createElement('aside'); panel.id = 'admin'; panel.setAttribute('aria-label', '관리자 도구');
  panel.innerHTML = '<span>관리자</span><button id="rain-toggle" aria-pressed="false">비 내림</button>';
  document.body.append(panel);
  const toggle = panel.querySelector<HTMLButtonElement>('#rain-toggle')!;
  toggle.addEventListener('click', () => {
    ambience.unlock();
    toggle.setAttribute('aria-pressed', String(rain!.toggle()));
    // Hand the keyboard back to the game so admin clicks never interrupt play.
    if (!paused && !menu.open) canvas.focus({ preventScroll: true });
  });
}
let board = new Pavement(), started = new Date();
const sound = new PlaySound();
let view: PlayScene;
let x = SPAWN_X, rotation: Rotation = SPAWN_ROTATION;
let gesture: { id: number; x: number; y: number; lastY: number; column: number; moved: boolean; lowered: boolean; axis?: SwipeAxis } | undefined;
let fillSound: ReturnType<typeof setTimeout> | undefined;
function createScene() {
  try {
    view = new PlayScene(canvas, board, drop, rain); view.aim(x, rotation);
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
    // The filler is heard at the moment it seats, not when it first appears.
    if (added.some(tile => tile.white)) fillSound = setTimeout(() => { if (!paused && !document.hidden) sound.place(true); }, FILL_LANDS * 1000);
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
  cancelGesture(); clearTimeout(fillSound); playTimer.pause(); view?.pause(true); sound.pause();
  if (paused) return;
  paused = true;
  document.querySelector('#play-time')!.textContent = `${Math.floor(playTimer.elapsed() / 60000)}min`;
  document.querySelector('#green-count')!.textContent = String(board.greens);
  document.querySelector('#white-count')!.textContent = String(board.tiles.length - board.greens);
  updatePauseUI();
}
function resume() {
  if (board.atLimit || menu.open) return;
  paused = false; updatePauseUI(); playTimer.resume();
  view?.pause(false); sound.unlock(); canvas.focus({ preventScroll: true });
}
function closeReceipt() {
  generationAbort?.abort(); generationAbort = undefined;
  disposePreview?.(); disposePreview = undefined;
  photoGeneration++; photo = undefined; manualPhoto = false;
  if (photoURL) URL.revokeObjectURL(photoURL); photoURL = undefined;
  receiptPanel.hidden = true;
  document.querySelector('#receipt-image')!.replaceChildren();
}
function resetSession() {
  clearTimeout(fillSound); gesture = undefined; view?.dispose(); sound.reset(); rain?.clearMarks();
  board = new Pavement(); started = new Date(); x = SPAWN_X; rotation = SPAWN_ROTATION; playTimer.reset();
  limitNote.hidden = true; pauseButton.disabled = false;
  createScene(); view?.pause(paused);
}
pauseButton.addEventListener('click', () => { if (paused) resume(); else pause(); });
document.addEventListener('keydown', event => {
  if (event.code === 'Escape' && paused && !menu.open) { event.preventDefault(); resume(); }
});
document.querySelector('#export')!.addEventListener('click', async () => {
  if (!paused || menu.open) return;
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
});
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
  else document.querySelector<HTMLButtonElement>('#export')!.focus();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { clearTimeout(fillSound); gesture = undefined; playTimer.pause(); sound.pause(); });
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  // A full navigation back from the browser cache starts a fresh, unsaved canvas.
  resetSession(); if (menu.open) menu.close('saved'); else resume();
});
if (board.atLimit) pause();
