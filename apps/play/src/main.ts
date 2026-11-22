/// <reference types="vite/client" />
import './style.css';
import { formatMeters, Pavement, SPAWN_ROTATION, SPAWN_X, WIDTH, type Rotation } from '../../../packages/play-core';
import { PlayScene } from './scene';
import { INTRO_GAIN, PlaySound } from './sound';
import { isDownSwipe, swipeAxis, type SwipeAxis } from './input';
import { downloadFile, Receipt, receiptArt, receiptPhoto } from './export';
import { showSavedToast } from './saved-toast';
import { mountReceiptPreview } from './receipt-preview';
import { PauseIcon } from './pause-icon';
import { PlayTimer } from './play-timer';
import { onTileOverrides, slotPicture, tileImages, type TileSkin } from './tile-assets';
import { cue, onCue, onHalloween, PAVER_LIBRARY, pickPaver } from './halloween';
import { NightSky } from './night-sky';
import { Glitches } from './glitches';
import { CHRISTMAS, eventOpen, GREETINGS, greetingPhrases, HALLOWEEN } from './events';
import { Greeting } from './greeting';
import { DuckTongs, ducksOn, forceSanta, prepareDucks } from './duck';
import { giftsOn, isGiftTile, isOpened, openGift, prepareGifts, resetGifts, tearOpen } from './gift';
import { Rain } from './rain';
import { Snow } from './snow';
import { AutoPlay } from './auto-stack';
import { AUTO_PATTERNS, type AutoPattern } from '../../../packages/play-core/auto';
import { RainAmbience } from './rain-sound';
import pausePopURL from '../../../assets/sfx/pause-pop.wav?url';
import resumePopURL from '../../../assets/sfx/resume-pop.wav?url';
import stone01URL from '../../../assets/sfx/place/stone-01.wav?url';
import stone02URL from '../../../assets/sfx/place/stone-02.wav?url';
import stone03URL from '../../../assets/sfx/place/stone-03.wav?url';
import stone04URL from '../../../assets/sfx/place/stone-04.wav?url';
import stone05URL from '../../../assets/sfx/place/stone-05.wav?url';
import rainSoundURL from '../../../assets/audio/날씨_비/rain-window.m4a?url';
import { Soundscape, type Environment } from './ambience';
import hanokAlleyURL from '../../../assets/audio/거리/L03256-004.m4a?url';
import seonbiAlleyURL from '../../../assets/audio/거리/L03258-004.m4a?url';
import pohangMarketURL from '../../../assets/audio/거리/L03314-004.m4a?url';
import ulsanStreetURL from '../../../assets/audio/거리/L03320-004.m4a?url';
import halloweenLofiURL from '../../../assets/audio/할로윈/halloween-lofi.m4a?url';
import misterioLofiURL from '../../../assets/audio/할로윈/misterio-lofi.m4a?url';
import christmasLofiURL from '../../../assets/audio/크리스마스/christmas-lofi.m4a?url';
import jazzChristmasURL from '../../../assets/audio/크리스마스/jazz-christmas.m4a?url';
import { environmentIcons, santaIcon, type PickedEnvironment } from './environment-icons';
import { onTuning, tuning } from './tuning';
import { installNative, isNativeApp, mixWithOtherAudio, nativeEffects, platform, saveExport } from './native';
import { Onboarding } from './onboarding';
import { playStudioIntro } from './studio-intro';

// Planner preview: the pause screen can switch the ambient environment. Not decided for release yet.
// Morning and night are out of the app (2026-10-01); only off, street and rain remain.
// Seasonal events join at the right end for their days (events.ts); admin builds always show them to test.
// A preview build (VITE_PREVIEW=1) is the one framed by the planner's review page: it shows every event too,
// and hands that page its settings (preview-bridge.ts). It carries no admin panel of its own.
const preview = import.meta.env.VITE_PREVIEW === '1';
const showEvents = preview || new URLSearchParams(location.search).has('admin') || import.meta.env.VITE_ADMIN === '1';
// A check build (VITE_CHECK=1, the `check` branch's Codemagic variable) is for looking at winter on a phone
// before December without changing its date: the picker always carries winter twice, as it is from the
// first of December (plain snow ducks) and as it is on Christmas Eve and Day (ducks in Santa hats).
const check = import.meta.env.VITE_CHECK === '1';
const ENVIRONMENTS: { id: PickedEnvironment; label: string; event?: boolean; santa?: boolean }[] = [
  { id: 'off', label: '환경음 끄기' }, { id: 'day', label: '거리' }, { id: 'rain', label: '비' },
  ...(showEvents || eventOpen(HALLOWEEN) ? [{ id: 'halloween' as const, label: '할로윈', event: true }] : []),
  ...(check ? [{ id: 'christmas' as const, label: '눈', event: true }, { id: 'christmas' as const, label: '크리스마스', event: true, santa: true }]
    : showEvents || eventOpen(CHRISTMAS) ? [{ id: 'christmas' as const, label: '크리스마스', event: true }] : []),
];
document.querySelector('#app')!.innerHTML = `<main class="play">
  <canvas id="playfield" tabindex="0" aria-label="블록 쌓기. 좌우 스와이프로 이동, 탭으로 회전, 아래 스와이프로 배치."></canvas>
  <section id="pause-actions" aria-label="일시정지 기록" aria-hidden="true" inert>
    <div class="pause-content">
      <div id="environment" role="radiogroup" aria-label="환경" style="--count:${ENVIRONMENTS.length}">
        <span class="environment-thumb" aria-hidden="true"></span>
        ${ENVIRONMENTS.map(({ id, label, event, santa }) => `<button role="radio" data-environment="${id}"${event ? ' data-event' : ''}${santa ? ' data-santa' : ''} aria-label="${label}" title="${label}" aria-checked="false" tabindex="-1">${santa ? santaIcon : environmentIcons[id]}</button>`).join('')}
      </div>
      <span class="stat-text" id="path-length" aria-label="깔린 길이">0.0미터</span>
      <img class="stat-icon" src="${tileImages.vertical}" alt="놓은 초록 블록"/>
      <span class="stat-text" id="green-count" aria-label="놓은 초록 블록 수">0</span>
      <img class="stat-icon small" src="${tileImages.center}" alt="자동 채움 흰 블록"/>
      <span class="stat-text" id="white-count" aria-label="자동 채움 흰 블록 수">0</span>
      <button id="export">내보내기</button>
      <button id="restart">새로 쌓기</button>
    </div>
  </section>
  <button id="pause" aria-label="일시정지" aria-pressed="false" aria-controls="pause-actions"><canvas id="pause-animation" width="40" height="40" aria-hidden="true"></canvas></button>
  <button id="loop" role="switch" aria-checked="false" aria-label="자동으로 쌓기" tabindex="-1"><span class="loop-label">루프</span><span class="loop-track" aria-hidden="true"><span class="loop-knob"></span></span></button>
</main><dialog id="pause-menu" class="receipt-open" aria-label="이미지 저장"></dialog>`;
const canvas = document.querySelector<HTMLCanvasElement>('#playfield')!;
canvas.setAttribute('aria-label', '화면 어디서든 좌우 스와이프로 이동, 아래 스와이프로 내리기. 위로 이동 불가. 탭으로 회전.');
const menu = document.querySelector<HTMLDialogElement>('#pause-menu')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
const play = document.querySelector<HTMLElement>('.play')!;
const pauseActions = document.querySelector<HTMLElement>('#pause-actions')!;
// The pause screen's single row gap, scaled by the planner's tuning (1 = the designed gap).
onTuning(({ pauseGap }) => pauseActions.querySelector<HTMLElement>('.pause-content')!.style.setProperty('--gap-scale', String(pauseGap)));
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
// Starts a fresh session, exported or not. Exporting no longer resets, so the export stays available
// above it in case the saved file did not come out and the player wants it again.
const restartButton = document.querySelector<HTMLButtonElement>('#restart')!;
// The receipt preview popup is legacy: kept for the browser checks, reached only with ?receipt.
const legacyReceipt = new URLSearchParams(location.search).has('receipt');
let exporting = false;
// Warm the handwriting face so the pause summary and the exported label never fall back.
void Promise.all([document.fonts?.load('16px GangBuJang'), document.fonts?.load('16px Jost')]).catch(() => {});
let photo: File | undefined, photoURL: string | undefined;
let photoGeneration = 0, savingPhoto = false, manualPhoto = false;
let generationAbort: AbortController | undefined, disposePreview: (() => void) | undefined;
// Admin mode (?admin on the web, or an internal test build of the app) adds tools outside the game
// screen. Nothing here affects rules or the export; the tuning sheet only changes feel, on this device.
const admin = new URLSearchParams(location.search).has('admin') || import.meta.env.VITE_ADMIN === '1';
const weather = document.createElement('canvas'); weather.id = 'weather'; weather.setAttribute('aria-hidden', 'true');
// The rain recording is only requested once the rain environment is first chosen.
const rainAmbience = new RainAmbience(rainSoundURL);
canvas.after(weather); const rain = new Rain(weather, rainAmbience);
// Christmas: flakes drift on their own canvas; the cover that builds up is drawn by the scene.
const snowfall = document.createElement('canvas'); snowfall.id = 'snowfall'; snowfall.setAttribute('aria-hidden', 'true');
weather.after(snowfall); const snow = new Snow(snowfall);
// Winter's greeting hangs over the board for a moment; a preview or admin build shows both phrases on any date.
const greeting = new Greeting(play);
const greetingNow = () => showEvents ? [...GREETINGS] : greetingPhrases();
const isGift = (tile?: { id: number; white: boolean; w: number; h: number }) => !!tile && tile.white && tile.w + tile.h === 2 && isGiftTile(tile.id) && skin() === 'christmas';
/** Snow ducks: the one-cell fillers of the Christmas environment while that option is chosen. */
const isDuck = (tile?: { white: boolean; w: number; h: number }) => !!tile && tile.white && tile.w + tile.h === 2 && ducksOn() && skin() === 'christmas';
// A filler still being lowered into its gap is not there yet: its cell stays bare until it seats. A snow
// duck's gap is open ground: the cover is laid on its floor too (thicker, see `floor`), and the duck sits on it.
snow.ground = { filled: (column, row) => { const tile = board.tileAt(column, row); return !!tile && (!tile.white || !view || view.seated(tile.id)); }, floor: (column, row) => isDuck(board.tileAt(column, row)), height: () => board.height, joined: (x1, y1, x2, y2) => { const tile = board.tileAt(x1, y1); return !!tile && tile === board.tileAt(x2, y2); } };
// Halloween's lantern light: a warm glow breathing in from the screen's edges over the night ground.
const lantern = document.createElement('div'); lantern.id = 'lantern'; lantern.setAttribute('aria-hidden', 'true');
weather.after(lantern);
// Halloween's sky sits behind the board, which is drawn on a clear background while the event is on.
const nightSky = new NightSky(PAVER_LIBRARY.find(paver => paver.id === 'pumpkin')!.url);
canvas.before(nightSky.element);
let glitchEnd = 0;
const glitches = new Glitches((amount, ms) => {
  view?.glitch(amount, ms);
  play.classList.add('glitching'); clearTimeout(glitchEnd); glitchEnd = window.setTimeout(() => play.classList.remove('glitching'), ms);
});
// The planner's saved values and onboarding copy load with the admin panel, before the intro starts.
let adminReady: Promise<unknown> = Promise.resolve();
if (admin) {
  const panel = document.createElement('aside'); panel.id = 'admin'; panel.setAttribute('aria-label', '관리자 도구');
  panel.innerHTML = '<span>관리자</span><p class="device" id="device-motion"></p><p class="device" id="device-audio"></p>';
  // The game ignores this setting; the readout only explains what a tester's phone is doing.
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const showMotion = () => { panel.querySelector('#device-motion')!.innerHTML = reduceMotion.matches ? '동작 줄이기 <b>켜짐</b> (앱 동작에는 영향 없음)' : '동작 줄이기 꺼짐'; };
  showMotion(); reduceMotion.addEventListener('change', showMotion);
  document.body.append(panel);
  adminReady = import('./tuning-panel').then(({ mountTuningPanel }) => mountTuningPanel(panel)).catch(() => {});
  // Silent mode on an iPhone mutes this page's sound without any error, so "재생 중" with no sound
  // points at the device, while "막힘" points at the browser refusing to start audio.
  const audio = panel.querySelector('#device-audio')!;
  setInterval(() => { audio.innerHTML = soundscape.status; }, 500);
}
let board = new Pavement(), started = new Date();
const sound = new PlaySound({ pause: pausePopURL, resume: resumePopURL }, [stone01URL, stone02URL, stone03URL, stone04URL, stone05URL]);
// The iOS app plays the effects itself in the X environment, so they mix with another app's music (native.ts).
const appEffects = nativeEffects({ pause: pausePopURL, resume: resumePopURL, hit0: stone01URL, hit1: stone02URL, hit2: stone03URL, hit3: stone04URL, hit4: stone05URL });
// Loudness of each recording (integrated LUFS) so every environment plays at the same level. Morning and
// night were dropped from the app on 2026-10-01; their recordings stay in assets/audio, out of the build.
const soundscape = new Soundscape({
  day: { repeat: false, tracks: [{ url: hanokAlleyURL, lufs: -25.6 }, { url: seonbiAlleyURL, lufs: -25.7 }, { url: pohangMarketURL, lufs: -25.9 }, { url: ulsanStreetURL, lufs: -26.4 }] },
  // Two lo-fi pieces (Pixabay Content License) in order, crossed over at their ends so they run as one
  // loop. Music sits 5 dB above the ambience level, and swells in slowly the first time it is heard.
  halloween: { repeat: false, ordered: true, fadeIn: 10, tracks: [{ url: halloweenLofiURL, lufs: -14.7, trim: 5 }, { url: misterioLofiURL, lufs: -19.1, trim: 5 }] },
  // Winter plays the same way: a lo-fi piece, then a jazz one, round and round. It comes in sooner than
  // Halloween (4 s), and the lo-fi piece's 3 quiet seconds of lead-in are cut from the file, so the music
  // is there soon after the environment is chosen.
  christmas: { repeat: false, ordered: true, fadeIn: 4, tracks: [{ url: christmasLofiURL, lufs: -11.3, trim: 5 }, { url: jazzChristmasURL, lufs: -15.9, trim: 5 }] },
});
/** The pavers' artwork follows the environment: only an event has its own. */
const skin = (): TileSkin => { const environment = soundscape.environment; return environment === 'halloween' || environment === 'christmas' ? environment : 'everyday'; };
/**
 * Ambience keeps playing on the pause screen (the picker's X turns it off); it only holds while the page
 * is hidden. Browsers need a gesture to start it. It stays silent through the studio intro, whose own
 * sound is the pavers landing, and first swells in slowly when the tutorial opens or, once that has been
 * seen, when the first block is placed (allowAmbience).
 */
let ambienceAllowed = false;
function allowAmbience() {
  if (ambienceAllowed) return;
  ambienceAllowed = true;
  if (!menu.open && !document.hidden) playAmbience();
}
function playAmbience() {
  if (!ambienceAllowed) return;
  soundscape.play();
  if (soundscape.environment === 'rain') rainAmbience.unlock();
  rainAmbience.setPaused(false);
}
// Touch-down starts sound early where browsers allow it; strict ones (Chrome on iPhone, Android Chrome)
// only allow it when the finger lifts, so every tap retries until the ambience and effects are running.
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const) {
  document.addEventListener(type, () => {
    if (menu.open || document.hidden) return;
    // Effects only wake for play; the pause screen keeps their context asleep.
    if (!paused) sound.unlock();
    playAmbience();
  }, { capture: true });
}
// iOS reads a held finger as the start of a text selection and brings up its magnifier loupe, even with
// selection turned off in CSS. Declining the touch's default outside the controls stops that; play reads
// pointer events, which still arrive. Controls, fields and the scrolling sheets keep their own behaviour.
document.addEventListener('touchstart', event => {
  if (event.target instanceof Element && event.target.closest('button,a,input,textarea,select,label,dialog,#admin,#tuning')) return;
  event.preventDefault();
}, { passive: false });
let view: PlayScene;
let x = SPAWN_X, rotation: Rotation = SPAWN_ROTATION;
let gesture: { id: number; x: number; y: number; lastY: number; column: number; moved: boolean; lowered: boolean; axis?: SwipeAxis } | undefined;
// Development only: ?nowebgl fails the scene as if WebGL were off; ?nowebgl=ios|android|web picks whose guide shows.
const noWebGL = import.meta.env.DEV ? new URLSearchParams(location.search).get('nowebgl') : null;
/**
 * A new block appears with its top edge on the red button's top line (2026-11-21): higher up, an
 * iPhone's Dynamic Island covered it. Measured from layout, so the button's own animation does not move it.
 */
function measureRestTop() {
  if (!view) return;
  let top = 0;
  for (let node: HTMLElement | null = document.querySelector<HTMLElement>('#pause'); node && node !== play; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
  view.restTop = top > 0 ? top : undefined;
}
function createScene() {
  try {
    if (noWebGL !== null) throw new Error('WebGL turned off with ?nowebgl');
    view = new PlayScene(canvas, board, drop, rain, snow); view.aim(x, rotation); view.setSkin(skin());
    view.instant = isDuck; view.above = isDuck;
    measureRestTop(); addEventListener('resize', measureRestTop);
    view.onFillSeat = () => { if (!paused && !document.hidden) sound.place(true); };
    // The witch paver brings the glitch as it is wedged into its single gap.
    view.onFillSeated = tile => { snow.rustle([tile], 0.5); if (skin() === 'halloween' && tile.white && tile.w + tile.h === 2 && pickPaver('single', tile.id)?.id === 'witch') glitches.witch(); };
    if (import.meta.env.DEV && board.tiles.length) view.add(board.tiles.filter(tile => tile.y >= board.height - 24), false);
  }
  catch (error) {
    console.error(error); showRenderError();
  }
}
/**
 * The board cannot be drawn, so nothing can be placed: the guide takes the whole screen instead of the
 * onboarding and the red button. Without WebGL 2 on an iPhone it is almost always Lockdown Mode, which
 * turns WebGL off inside apps too; the app can be excluded from it in Settings.
 */
function showRenderError() {
  const webgl = noWebGL === null && !!document.createElement('canvas').getContext('webgl2');
  const target = noWebGL || platform;
  const guide = document.createElement('section'); guide.id = 'render-error'; guide.setAttribute('role', 'alert');
  let body = '<p>앱을 완전히 닫고 다시 열어 주세요.</p>';
  if (!webgl && target === 'ios') body = `<p>차단 모드가 켜져 있으면<br>보도블럭을 생성할 수 없어요.</p>
    <ol><li>설정 › 개인정보 보호 및 보안 › 차단 모드</li><li>웹사이트 사용자화에서 보도보도 끄기</li><li>보도보도를 완전히 닫고 다시 열기</li></ol>`;
  else if (!webgl && target === 'android') body = '<p>Android System WebView와 Chrome을<br>최신 버전으로 업데이트한 뒤 다시 열어 주세요.</p>';
  else if (!webgl) body = '<p>하드웨어 가속을 지원하는 브라우저에서<br>다시 열어 주세요.</p>';
  guide.innerHTML = `<h1>3D 화면을 열 수 없어요.</h1>${body}`;
  play.append(guide); play.classList.add('render-failed');
}
// Explicit, local-development-only fixture. A normal reload/session is unchanged.
if (import.meta.env.DEV) {
  const params = new URLSearchParams(location.search);
  const count = Number(params.get('stress'));
  if (Number.isFinite(count) && count > 0) {
    const { pinwheelBoard, stressBoard } = await import('./stress');
    board = params.get('layout') === 'pinwheel' ? pinwheelBoard(count) : stressBoard(count, params.get('layout') === 'tower');
    started = new Date(Date.now() - 3600000);
  }
}
createScene();
// First-run guide over the board; it reads the scene through `view`, which "새로 쌓기" replaces.
const onboarding = new Onboarding(play, () => view, () => {
  pauseButton.disabled = board.atLimit || onboarding.pauseLocked; play.classList.toggle('onboarding-intro', onboarding.pauseLocked);
});
// The guide's demo hole moves and drops the active block itself, past the input lock.
onboarding.player = {
  heights: () => Array.from({ length: WIDTH }, (_, column) => board.landing(column, SPAWN_ROTATION).y),
  column: () => x, rotation: () => rotation,
  aim: (column, nextRotation) => { if (view) aim(column, nextRotation); },
  drop: () => drop(true),
};
const blocked = () => paused || menu.open || !view || view.busy || document.hidden || onboarding.blocking;
function aim(column: number, nextRotation = rotation) {
  const before = { x, rotation };
  if (!view.aim(column, nextRotation)) return;
  rotation = nextRotation; x = view.column;
  if (rotation !== before.rotation) onboarding.acted('rotate');
  else if (x !== before.x) onboarding.acted('move');
}
/** `auto`: the onboarding's own drop, which the input lock does not hold back. Resolves once placed. */
function drop(auto = false) {
  if (auto ? paused || !view || view.busy : blocked()) return Promise.resolve(false);
  sound.unlock();
  const column = x, orientation = rotation;
  const landing = board.landingFrom(column, view.activeY, orientation);
  return new Promise<boolean>(placed => view.drop(() => {
    const added = board.place(column, landing.y, orientation);
    // New gaps are told to the tongs before the scene dresses them, so they start as open gaps and not
    // as finished ducks. They first take their snow, quickly; the tongs come once it has settled.
    const gaps = added.filter(isDuck);
    // (With the heap switched off there is nothing to wait for, and the tongs come at once.)
    if (gaps.length) { const wait = tuning.duckHeap > 0 ? GAP_SNOW_SECONDS : 0.15; snow.gather(gaps, wait); tongs.add(gaps, wait + 0.15); }
    view.add(added, true, onboarding.placed(added)); snow.rustle(added.filter(tile => !tile.white));
    // The greeting comes with a block, once the snow has settled in, and never across the dog's path.
    if (soundscape.environment === 'christmas' && snow.depth >= 1 && !snow.walking && onboarding.finished && greeting.due) greeting.show(greetingNow()); sound.place(); allowAmbience();
    // A fresh piece always enters at the current camera's upper center.
    x = SPAWN_X; rotation = SPAWN_ROTATION; view.spawn();
    if (board.atLimit) pause();
    placed(true);
  }));
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
    if (gesture.axis === 'horizontal' && onboarding.allows('move')) aim(gesture.column + Math.round(dx / view.cellPixels));
    const down = Math.max(0, event.clientY - gesture.lastY);
    if (gesture.axis === 'vertical' && onboarding.allows('place')) {
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
  // During the tutorial a gesture does nothing until its step has opened it (see Onboarding.allows).
  if (!g.moved && Math.hypot(dx, dy) < 12) { if (!unwrapAt(event.clientX, event.clientY) && onboarding.allows('rotate')) aim(x, ((rotation + 1) % 4) as Rotation); }
  else if (g.lowered && isDownSwipe(dx, dy) && view.canRelease && onboarding.allows('place')) drop();
});
/** A tap on a wrapped gift block opens it instead of turning the block in play. */
function unwrapAt(clientX: number, clientY: number) {
  const bounds = canvas.getBoundingClientRect(), point = view.boardPoint(clientX - bounds.left, clientY - bounds.top);
  const tile = board.tileAt(Math.floor(point.x), Math.floor(point.y));
  if (!tile || !isGift(tile) || isOpened(tile.id)) return false;
  // The snow on the gift goes with the paper: that cell is bare again and gathers snow afresh.
  const lying = snow.depthAt(tile.x, tile.y); snow.cleared([tile]);
  openGift(tile.id); view.redress(); view.pop(tile.id); sound.place(true);
  const centre = view.screenPoint(tile.x + 0.5, tile.y + 0.5), frame = play.getBoundingClientRect();
  tearOpen(play, bounds.left - frame.left + centre.x, bounds.top - frame.top + centre.y, view.cellPixels, lying);
  return true;
}
function cancelGesture() { if (gesture) { gesture = undefined; view?.endDrag(); } }
canvas.addEventListener('pointercancel', cancelGesture);
canvas.addEventListener('lostpointercapture', cancelGesture);
canvas.addEventListener('keydown', event => {
  if (blocked() || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) return;
  if (!onboarding.allows(event.code === 'ArrowUp' ? 'rotate' : event.code === 'ArrowLeft' || event.code === 'ArrowRight' ? 'move' : 'place')) return;
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
  pauseButton.disabled = board.atLimit || onboarding.pauseLocked;
  limitNote.hidden = !board.atLimit;
  pauseIcon.setPaused(paused);
}
function pause() {
  onboarding.interrupt(); cancelGesture(); greeting.cancel(); playTimer.pause(); view?.pause(true); sound.pause();
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
/** Event environments the preview page has taken out of the picker, to see the pause screen with fewer of them. */
const hiddenEvents = new Set<Environment>();
const pickable = () => ENVIRONMENTS.filter(({ id }) => !hiddenEvents.has(id));
/** Check builds: whether winter is on as its Christmas Day entry. */
let santaPicked = false;
const isCurrent = (entry: { id: Environment; santa?: boolean }) => entry.id === soundscape.environment && !!entry.santa === santaPicked;
function showEnvironment() {
  const picker = document.querySelector<HTMLElement>('#environment')!, shown = pickable();
  picker.style.setProperty('--count', String(shown.length));
  // The thumb counts places among the buttons on show.
  picker.style.setProperty('--selected', String(shown.findIndex(isCurrent)));
  environmentButtons.forEach(button => {
    const id = button.dataset.environment as Environment, chosen = isCurrent({ id, santa: 'santa' in button.dataset });
    button.hidden = hiddenEvents.has(id); button.setAttribute('aria-checked', String(chosen)); button.tabIndex = chosen ? 0 : -1;
  });
}
/** Preview page: puts an event environment in the picker or takes it out. One that is chosen gives way to the street. */
function showEvent(environment: Environment, on: boolean) {
  if (on) hiddenEvents.delete(environment); else hiddenEvents.add(environment);
  if (!on && soundscape.environment === environment) chooseEnvironment('day'); else showEnvironment();
}
/** Seconds for snow to gather on the floor of a new gap before the tongs set to work. */
const GAP_SNOW_SECONDS = 0.9;
// Snow ducks: the tongs travel over the board and press a duck into each one-cell gap as it appears.
const tongs = new DuckTongs(play, {
  place: (column, row) => { if (!view) return undefined; const bounds = canvas.getBoundingClientRect(), frame = play.getBoundingClientRect(), point = view.screenPoint(column, row); return { x: bounds.left - frame.left + point.x, y: bounds.top - frame.top + point.y, cell: view.cellPixels }; },
  held: () => paused || menu.open,
  made: tile => { view?.redress(); view?.pop(tile.id); if (!paused && !document.hidden) { if (tuning.duckSound) sound.crunch(tuning.duckSound); else sound.place(true); } snow.burst(tile.x, tile.y); snow.spend(tile.x, tile.y); },
});
/** Spaces are filled with one-cell pieces only while the ducks are on show. */
function applyFillRule() { board.singlesOnly = ducksOn() && skin() === 'christmas'; }
let ducksShown = false, duckKind = tuning.duckKind, duckTilt = tuning.duckTilt;
onTuning(() => {
  applyFillRule();
  if (duckKind !== tuning.duckKind || duckTilt !== tuning.duckTilt) { duckKind = tuning.duckKind; duckTilt = tuning.duckTilt; view?.redress(); }
  if (ducksOn() === ducksShown) return;
  ducksShown = ducksOn();
  if (ducksShown) void prepareDucks().then(() => view?.redress()); else tongs.finishAll();
  view?.redress(); snow.touch();
});
// The choice stays on the device, so X keeps another app's music playing from the next launch on.
const ENVIRONMENT_KEY = 'bodobodo.environment';
function chooseEnvironment(environment: Environment, santa = false) {
  santa &&= environment === 'christmas';
  if (santa !== santaPicked) { santaPicked = santa; forceSanta(santa); view?.redress(); }
  // Choosing an environment the preview page had hidden puts it back in the picker.
  hiddenEvents.delete(environment);
  soundscape.select(environment); rain.set(environment === 'rain'); snow.set(environment === 'christmas');
  if (environment !== 'christmas') { greeting.cancel(); tongs.finishAll(); }
  applyFillRule();
  // X lets the game's sound mix with music from another app instead of stopping it. In the iOS app the
  // page then holds no audio: the effects go to the app's own player, and the rain lets go once faded.
  const mix = environment === 'off';
  sound.useNative(mix ? appEffects : undefined); mixWithOtherAudio(mix);
  if (mix && appEffects) window.setTimeout(() => { if (soundscape.environment === 'off') rainAmbience.release(); }, 3000);
  try { localStorage.setItem(ENVIRONMENT_KEY, environment); } catch { /* Chosen for this run only. */ }
  // An event dresses the board, the pause screen's counters and the light; the others keep the everyday look.
  const event = environment === 'halloween';
  view?.setSkin(skin()); play.classList.toggle('halloween', event); play.classList.toggle('christmas', environment === 'christmas');
  nightSky.setActive(event); glitches.setActive(event); showStatIcons();
  // Unlocking inside the tap lets the rain recording start later, when play resumes.
  if (environment === 'rain') rainAmbience.unlock();
  showEnvironment();
}
try {
  // An event that has ended is gone from the picker, and street (the default) takes its place.
  const saved = ENVIRONMENTS.find(({ id }) => id === localStorage.getItem(ENVIRONMENT_KEY));
  if (saved && saved.id !== soundscape.environment) chooseEnvironment(saved.id);
} catch { /* Street, as on a first launch. */ }
environmentButtons.forEach(button => button.addEventListener('click', () => chooseEnvironment(button.dataset.environment as Environment, 'santa' in button.dataset)));
document.querySelector<HTMLElement>('#environment')!.addEventListener('keydown', event => {
  const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  const shown = pickable(), next = shown[(shown.findIndex(isCurrent) + step + shown.length) % shown.length];
  chooseEnvironment(next.id, next.santa); environmentButtons.find(button => button.dataset.environment === next.id && 'santa' in button.dataset === !!next.santa)?.focus();
});
showEnvironment();
/** The pause screen's counters show the slot's most likely event paver while an event is on. */
function showStatIcons() {
  document.querySelector<HTMLImageElement>('.stat-icon')!.src = slotPicture('block', skin());
  document.querySelector<HTMLImageElement>('.stat-icon.small')!.src = slotPicture('single', skin());
}
// The planner's Halloween edits (admin panel) apply at once: pavers, sky, glitch timing.
onHalloween(settings => {
  view?.redress(); nightSky.apply(settings); glitches.apply(settings); showStatIcons();
  play.dataset.backdrop = settings.backdrop;
});
// Gift blocks: switching the option wraps or unwraps every one-cell filler at once (the pictures are drawn on first use).
let giftsShown = false, giftShare = -1;
onTuning(({ giftChance }) => {
  if (giftsOn() === giftsShown && giftChance === giftShare) return;
  giftsShown = giftsOn(); giftShare = giftChance; view?.redress();
  if (giftsShown) void prepareGifts().then(() => view?.redress());
});
// A picture swapped into a slot (preview page) shows at once, on the board and the counters.
onTileOverrides(() => { view?.redress(); showStatIcons(); });
// "Try it now" from the panel. A visitor needs the event's sky, so it switches to Halloween first.
onCue(value => {
  if (value === 'glitch') { glitches.now(); return; }
  if (soundscape.environment !== 'halloween') chooseEnvironment('halloween');
  nightSky.visit(value);
});
// Admin builds: G glitches on demand, to try timings against the music.
if (admin) document.addEventListener('keydown', event => { if (event.code === 'KeyG' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) glitches.now(); });
function closeReceipt() {
  generationAbort?.abort(); generationAbort = undefined;
  disposePreview?.(); disposePreview = undefined;
  photoGeneration++; photo = undefined; manualPhoto = false;
  if (photoURL) URL.revokeObjectURL(photoURL); photoURL = undefined;
  receiptPanel.hidden = true;
  document.querySelector('#receipt-image')!.replaceChildren();
}
function resetSession() {
  gesture = undefined; view?.dispose(); sound.reset(); rain.clearMarks(); snow.newSession(); resetGifts(); tongs.reset(); soundscape.newSession();
  board = new Pavement(); applyFillRule(); started = new Date(); x = SPAWN_X; rotation = SPAWN_ROTATION; playTimer.reset();
  limitNote.hidden = true; pauseButton.disabled = false;
  createScene(); onboarding.apply(); view?.pause(paused); autoPlay.restart();
}
// Pausing from the onboarding's red-button line: "새로 쌓기" breathes for about 3 seconds to show it.
let restartCue = 0;
function cueRestart(on: boolean) {
  clearTimeout(restartCue); play.classList.toggle('onboarding-restart', on);
  if (on) restartCue = window.setTimeout(() => play.classList.remove('onboarding-restart'), 3000);
}
pauseButton.addEventListener('click', () => {
  sound.button(paused ? 'resume' : 'pause');
  if (paused) { cueRestart(false); resume(); } else { cueRestart(onboarding.pauseTipShowing); pause(); }
});
/**
 * Auto stacking: the game lays blocks in a pattern through the same aim and drop a touch uses. The
 * button under "새로 쌓기" steps through off and each pattern; the choice stays on the device.
 */
let introOver = false;
const autoPlay = new AutoPlay({
  ready: () => introOver && !blocked() && !gesture && onboarding.finished,
  tops: () => Array.from({ length: WIDTH }, (_, column) => board.landing(column, 1).y),
  aim: (column, nextRotation) => { playTimer.start(); if (nextRotation !== rotation) aim(x, nextRotation); aim(column); },
  drop: () => drop(),
});
const AUTO_KEY = 'bodobodo.auto';
// The loop switch beside the cone: auto stacking on or off (one pattern, the pinwheel). It shows with the pause screen.
const loopButton = document.querySelector<HTMLButtonElement>('#loop')!;
function chooseAuto(pattern?: AutoPattern) {
  autoPlay.set(pattern);
  loopButton.setAttribute('aria-checked', String(!!pattern));
  try { if (pattern) localStorage.setItem(AUTO_KEY, pattern); else localStorage.removeItem(AUTO_KEY); } catch { /* Chosen for this run only. */ }
}
loopButton.addEventListener('click', () => {
  if (!paused || menu.open) return;
  chooseAuto(autoPlay.pattern ? undefined : AUTO_PATTERNS[0].key);
});
try { chooseAuto(AUTO_PATTERNS.find(({ key }) => key === localStorage.getItem(AUTO_KEY))?.key); } catch { /* Off, as on a first launch. */ }
restartButton.addEventListener('click', () => {
  if (!paused || menu.open || exporting) return;
  resetSession(); resume();
});
document.addEventListener('keydown', event => {
  if (event.code === 'Escape' && paused && !menu.open) { event.preventDefault(); resume(); }
});
exportButton.addEventListener('click', async () => {
  if (!paused || menu.open || exporting) return;
  if (legacyReceipt) { void openReceipt(); return; }
  // Save straight away: a transparent PNG of the whole pavement. The session is kept until the player
  // chooses to start over.
  exporting = true; exportButton.disabled = true; exportButton.textContent = '저장 중'; exportStatus.textContent = '';
  try {
    // Saved as it looks: an event saves its own pavers (each tile the same one as on screen).
    const receipt = new Receipt(board, started, await receiptArt(board.tiles, skin()));
    let file: File;
    if (receipt.format === 'png' && typeof CompressionStream !== 'undefined') {
      file = await receiptPhoto(receipt, undefined, value => { exportButton.textContent = `저장 중 ${Math.round(value * 100)}%`; })
        .catch(() => receipt.svgFile());
    } else file = await receipt.svgFile();
    // In the app there is no download folder: a PNG goes to the photo library, an SVG to the share sheet.
    // A saved photo shows the saved card (saved-toast.ts); only the rare SVG says where it went in words.
    if (isNativeApp) {
      const saved = await saveExport(file);
      if (saved.result === 'photo') showSavedToast(play, receipt, '사진에 저장했어요', saved.open);
      exportStatus.textContent = saved.result === 'shared' ? '파일로 내보냈어요. 사진이 아닌 파일 앱에서 확인해 주세요.' : '';
    } else { downloadFile(file); showSavedToast(play, receipt, '내려받았어요'); }
  } catch {
    exportStatus.textContent = '저장하지 못했어요. 다시 시도해 주세요.';
  } finally { exporting = false; exportButton.disabled = false; exportButton.textContent = '내보내기'; }
});
async function openReceipt() {
  generationAbort?.abort(); disposePreview?.();
  generationAbort = new AbortController();
  const signal = generationAbort.signal;
  const generation = ++photoGeneration;
  const receipt = new Receipt(board, started, await receiptArt(board.tiles, skin()));
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
function holdAmbience() { soundscape.pause(); rainAmbience.setPaused(true); }
/** Leaving the screen lets go of every audio context; coming back builds fresh ones (see Soundscape.release). */
function releaseAudio() { holdAmbience(); sound.release(); soundscape.release(); rainAmbience.release(); }
// Leaving the page pauses the game and holds the ambience; coming back brings the ambience back on the
// pause screen (or with the next tap, where the browser wants one).
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); releaseAudio(); } else if (!menu.open) playAmbience(); });
window.addEventListener('pagehide', () => { gesture = undefined; playTimer.pause(); sound.pause(); releaseAudio(); });
window.addEventListener('pageshow', event => {
  if (!event.persisted) return;
  // A full navigation back from the browser cache starts a fresh, unsaved canvas.
  resetSession(); if (menu.open) menu.close('saved'); else resume();
});
if (board.atLimit) pause();
// The studio intro plays over the board first. The board stays hidden under it if the onboarding will
// start, and the onboarding begins while the intro is still clearing, so its first line comes straight
// out of it.
onboarding.apply();
// The intro's landings sound only where audio may start on its own (the app shells). A browser holds
// its audio until the first tap, and held landings would then all sound at once.
sound.unlock();
const handOver = new Promise<void>(resolve => playStudioIntro(play, resolve, (white, inSeconds) => { if (sound.running) sound.place(white, INTRO_GAIN, inSeconds); }));
// Without a board the onboarding never starts, so its "seen" mark waits for a launch that can play.
void handOver.then(() => { introOver = true; });
void Promise.all([adminReady, handOver]).then(() => { if (!view) return; if (onboarding.pauseLocked) allowAmbience(); onboarding.begin(); });
pauseButton.disabled = board.atLimit || onboarding.pauseLocked; play.classList.toggle('onboarding-intro', onboarding.pauseLocked);
if (preview) void import('./preview-bridge').then(({ installPreview }) => installPreview({
  environments: ENVIRONMENTS, environment: () => soundscape.environment, chooseEnvironment,
  eventShown: environment => !hiddenEvents.has(environment), showEvent,
  auto: () => autoPlay.pattern, chooseAuto,
  cue: name => {
    if (name === 'glitch') glitches.now();
    else if (name === 'bats') cue('bats');
    else if (name === 'greeting') { if (soundscape.environment !== 'christmas') chooseEnvironment('christmas'); greeting.show([...GREETINGS]); }
    else { if (soundscape.environment !== 'christmas') chooseEnvironment('christmas'); snow.visit(); }
  },
}));
// App shell only: Android's back button opens the pause screen (and from there leaves the app), and
// leaving the app holds play and sound the same way leaving the page does.
void installNative({
  back: () => {
    if (menu.open) { if (!savingPhoto) menu.close('cancelled'); return true; }
    if (paused || board.atLimit) return false;
    sound.button('pause'); pause(); return true;
  },
  hidden: () => { pause(); releaseAudio(); },
  shown: () => { if (!menu.open) playAmbience(); },
});
