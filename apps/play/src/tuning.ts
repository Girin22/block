/**
 * Values the planner can tune live from the admin panel during polishing. The defaults are the
 * shipped feel; players never see or change them. When the planner settles on a value, it is copied
 * from the panel and becomes the new default here.
 */
export interface Tuning {
  /** How fast rain streaks fall, as a multiple of the original speed. */
  rainSpeed: number;
  /** Size of the ring each raindrop spreads on the ground, as a multiple of the original 7–14 px. */
  rippleSize: number;
  /** The one gap between the pause screen's rows, as a multiple of the screen-height-based gap. */
  pauseGap: number;
  /** Cells per second the active block sinks on its own. */
  fallSpeed: number;
  /** How fast white fillers are laid into sealed spaces, as a multiple of the original pace. */
  fillSpeed: number;
  /** Onboarding handwriting: characters written per second. */
  typingSpeed: number;
  /** Seconds each written character takes to settle in: fading up from a slight blur, dropping into place. */
  inkSeconds: number;
  /** Breaths after commas, full stops and line ends, as a multiple of the designed pauses (0 = none). */
  pauseScale: number;
  /** 1 lets the gap between characters vary slightly, like a hand; 0 keeps it even. */
  rhythmJitter: number;
  /** Seconds a tutorial line (rotate, move, place) takes to fade away once its action is done. */
  stepFadeSeconds: number;
  /** Seconds after a tutorial line is written before the screen takes the next action. */
  stepReadySeconds: number;
  /** 1 shows a fingertip hint on the block once a tutorial line is done and the screen takes input. */
  gestureHint: number;
  /** Onboarding text size, as a multiple of the designed size (2% of the screen height, 16–24 px). */
  onboardingSize: number;
  /** On a phone (screen under 600 px wide), the onboarding text is this share of its tablet size. */
  onboardingPhoneScale: number;
  /** How the intro appears: 1 sweeps the whole text into view from the top down, 0 writes it character by character. */
  introSweep: number;
    /** Sweep: seconds for the whole intro to be uncovered from top to bottom. */
  introSweepSeconds: number;
  /** Sweep: seconds for any later (short) onboarding text to be uncovered in one soft pass. */
  stepSweepSeconds: number;
  /** Snow: flakes in the air at full strength. */
  snowAmount: number;
  /** Snow: how fast flakes drift down, as a multiple of the designed speed. */
  snowSpeed: number;
  /** Snow: sideways drift, -1 (left) to 1 (right). */
  snowWind: number;
  /** Snow: flake size, as a multiple of the designed size. */
  snowSize: number;
  /** Snow: seconds of full snowfall for bare ground (or a fresh block) to be fully covered. */
  snowAccumSeconds: number;
  /** Snow: how much of the pavement a full cover hides (1 = solid white). */
  snowCover: number;
  /** Snow: 1 lets a dog trot across now and then, leaving paw prints. */
  snowTracks: number;
  /** Snow: the dog crosses every `snowTrackFrom`-`snowTrackTo` seconds at random. */
  snowTrackFrom: number;
  snowTrackTo: number;
  /** Snow: how deep the cover must be (0-1) before the dog comes. */
  snowTrackDepth: number;
  /** Snow: where the cover gathers: 0 on the pavers only, 1 over the whole ground. */
  snowArea: number;
  /** Auto stacking: seconds between one block landing and the next one being aimed. */
  autoInterval: number;
  /** Winter greeting: 1 lets the garland of letters come up during play, 0 keeps it away. */
  greeting: number;
  /** Winter greeting: seconds each phrase rests once all its letters are up. */
  greetingHold: number;
  /** Winter greeting: seconds between one letter coming down and the next. */
  greetingStagger: number;
  /** Winter greeting: minutes before it may come up again in the same run (0 = once a run). */
  greetingEvery: number;
  /** Christmas: what one-cell fillers are. 0 plain white pavers; 1 wrapped gifts that a tap opens onto an ornament; 2 snow ducks pressed out by tongs (spaces are then filled with one-cell pieces only). */
  giftWrap: number;
  /** Christmas: share of one-cell fillers that come wrapped, in percent (the rest stay plain white). */
  giftChance: number;
  /** Christmas: 1 hangs a string of lights down each side of the pavement. */
  snowLights: number;
  /** String lights: 0 mixed colours, 1 all gold, 2 all white. */
  lightsColour: number;
  /** String lights: 0 slow breath, 1 twinkle, 2 a wave running along the string, 3 neighbours taking turns. */
  lightsEffect: number;
  /** String lights: cells between one bulb and the next along a string. */
  /** String lights: 1 draws the dark wire the bulbs hang on, 0 shows the bulbs alone. */
  lightsWire: number;
  lightsPitch: number;
  /** String lights: how far each wire runs from the middle of the screen, as a share of half its width (100 is the screen's edge). */
  lightsSpan: number;
  /** String lights: how far apart, in cells, the bulbs on either side of the wire stand (the zigzag's width). */
  lightsZigzag: number;
  /** String lights: how far a bulb may sit off its place along the wire, as a share of the spacing (0-100). */
  lightsJitterY: number;
  /** String lights: how far a bulb may sit off its place across the wire, in cells either way. */
  lightsJitterX: number;
  /** Snow ducks: how much snow piles into a new gap before the tongs come, in percent (0: none). */
  duckHeap: number;
  /** Snow ducks: how that pile lies, in percent. 0 a tight mound in the middle of the gap; 100 spread evenly over all of it. */
  duckHeapSpread: number;
  /** Snow ducks: how much snow stays on the gap's floor around a finished duck, in percent (0: bare ground). */
  duckFloor: number;
  /** Snow ducks: 0 the plain duck, 1 the duck in a Santa hat. */
  duckKind: number;
  /** Snow ducks: the sound of one being pressed out. 0 the stone hit every filler makes; 1-4 drafts of a snow crunch (crunch.ts). */
  duckSound: number;
  /** Snow ducks: each duck leans up to this many degrees either way. */
  duckTilt: number;
}

export const TUNING_DEFAULTS: Readonly<Tuning> = { rainSpeed: 1, rippleSize: 1, pauseGap: 1, fallSpeed: 1.1, fillSpeed: 1, typingSpeed: 14, inkSeconds: 0.6, pauseScale: 1, rhythmJitter: 1, stepFadeSeconds: 1.4, stepReadySeconds: 0.5, gestureHint: 1, onboardingSize: 1.5, onboardingPhoneScale: 0.8, introSweep: 1, introSweepSeconds: 6, stepSweepSeconds: 1.4, snowAmount: 90, snowSpeed: 1, snowWind: 0.25, snowSize: 1, snowAccumSeconds: 90, snowCover: 0.75, snowTracks: 1, snowTrackFrom: 18, snowTrackTo: 35, snowTrackDepth: 0.5, snowArea: 0, autoInterval: 0.9, greeting: 0, greetingHold: 2.8, greetingStagger: 0.09, greetingEvery: 5.5, giftWrap: 2, giftChance: 100, duckHeap: 0, duckHeapSpread: 50, duckFloor: 30, duckKind: 0, duckSound: 2, snowLights: 1, lightsColour: 0, lightsEffect: 3, lightsWire: 0, lightsPitch: 0.95, lightsSpan: 98, lightsZigzag: 0.18, lightsJitterY: 10, lightsJitterX: 0.025, duckTilt: 15 };

/** A `choices` field is a switch between labelled values instead of a gauge. */
export type TuningGroup = 'weather' | 'snow' | 'lights' | 'tracks' | 'greeting' | 'gift' | 'screen' | 'block' | 'auto' | 'onboarding';
export const TUNING_GROUPS: readonly { key: TuningGroup; label: string }[] = [
  { key: 'weather', label: '비' }, { key: 'snow', label: '눈' }, { key: 'lights', label: '줄조명' }, { key: 'tracks', label: '눈 발자국' }, { key: 'greeting', label: '겨울 인사말' }, { key: 'gift', label: '선물·눈오리' }, { key: 'screen', label: '일시정지 화면' }, { key: 'block', label: '블록' }, { key: 'auto', label: '자동 쌓기' }, { key: 'onboarding', label: '온보딩' },
];
export interface TuningField { key: keyof Tuning; group: TuningGroup; label: string; min: number; max: number; step: number; unit: string; hint: (value: number) => string; choices?: readonly { value: number; label: string }[]; }

export const TUNING_FIELDS: readonly TuningField[] = [
  { key: 'rainSpeed', group: 'weather', label: '비가 내리는 속도', min: 0.25, max: 3, step: 0.05, unit: '배', hint: v => `빗줄기 한 개가 ${Math.round(220 / v)}ms 동안 떨어짐` },
  { key: 'rippleSize', group: 'weather', label: '빗방울 동심원 크기', min: 0.25, max: 3, step: 0.05, unit: '배', hint: v => `반지름 ${(7 * v).toFixed(1)}~${(14 * v).toFixed(1)}px` },
  { key: 'snowAmount', group: 'snow', label: '눈송이 수', min: 0, max: 250, step: 5, unit: '개', hint: v => v ? `화면에 눈송이가 ${Math.round(v)}개쯤 떠 있음` : '눈송이 없이 쌓이기만 함' },
  { key: 'snowSpeed', group: 'snow', label: '눈이 내리는 속도', min: 0.3, max: 3, step: 0.05, unit: '배', hint: v => `눈송이 하나가 ${(4.5 / v).toFixed(1)}초쯤 떠 있다가 내려앉음` },
  { key: 'snowWind', group: 'snow', label: '바람', min: -1, max: 1, step: 0.05, unit: '', hint: v => Math.abs(v) < 0.03 ? '바람 없이 곧게 내림' : `${v < 0 ? '왼쪽' : '오른쪽'}으로 초당 ${Math.round(Math.abs(v) * 40)}px씩 밀림` },
  { key: 'snowSize', group: 'snow', label: '눈송이 크기', min: 0.5, max: 2.5, step: 0.05, unit: '배', hint: v => `지름 ${(2 * v).toFixed(1)}~${(7 * v).toFixed(1)}px` },
  { key: 'snowArea', group: 'snow', label: '눈이 쌓이는 곳', min: 0, max: 1, step: 1, unit: '', hint: v => v ? '블록과 빈 바닥 모두에 쌓임 (발자국도 화면 어디에나 찍힘)' : '블록 위에만 쌓이고 빈 바닥은 그대로 (발자국도 블록 위에만 찍힘)', choices: [{ value: 0, label: '블록 위에만' }, { value: 1, label: '화면 전체' }] },
  { key: 'snowAccumSeconds', group: 'snow', label: '눈이 다 쌓이는 시간', min: 5, max: 180, step: 1, unit: '초', hint: v => `눈이 내리기 시작해 ${Math.round(v)}초 뒤에 다 쌓임` },
  { key: 'snowLights', group: 'lights', label: '양옆 줄조명', min: 0, max: 1, step: 1, unit: '', hint: v => v ? '양옆 가장자리를 따라 전구 줄이 걸리고 은은하게 반짝임' : '줄조명 없음', choices: [{ value: 1, label: '켜기' }, { value: 0, label: '끄기' }] },
  { key: 'lightsColour', group: 'lights', label: '전구 색', min: 0, max: 2, step: 1, unit: '', hint: v => v === 1 ? '모든 전구가 황금색' : v === 2 ? '모든 전구가 흰색' : '따뜻한 흰색 위주에 금색·옅은 빨강·옅은 초록이 섞임', choices: [{ value: 0, label: '여러 색' }, { value: 1, label: '황금색' }, { value: 2, label: '흰색' }] },
  { key: 'lightsEffect', group: 'lights', label: '조명 효과', min: 0, max: 3, step: 1, unit: '', hint: v => v === 1 ? '켜진 채로 있다가 전구마다 가끔 반짝 빛남' : v === 2 ? '빛이 줄을 따라 위에서 아래로 흘러감' : v === 3 ? '이웃한 전구가 번갈아 밝아짐' : '전구마다 다른 박자로 천천히 밝아졌다 어두워짐', choices: [{ value: 0, label: '은은하게' }, { value: 1, label: '반짝임' }, { value: 2, label: '흐르기' }, { value: 3, label: '번갈아' }] },
  { key: 'lightsWire', group: 'lights', label: '전선', min: 0, max: 1, step: 1, unit: '', hint: v => v ? '전구가 달린 어두운 전선을 함께 그림' : '전선 없이 전구만 보임', choices: [{ value: 0, label: '숨기기' }, { value: 1, label: '보이기' }] },
  { key: 'lightsSpan', group: 'lights', label: '중앙에서 전선까지 거리', min: 20, max: 100, step: 1, unit: '%', hint: v => v >= 100 ? '두 전선이 화면 양 끝에 붙음' : `두 전선이 화면 중앙에서 양쪽으로 화면 반 너비의 ${Math.round(v)}%만큼 떨어져 있음` },
  { key: 'lightsPitch', group: 'lights', label: '전구 간격', min: 0.4, max: 2.5, step: 0.05, unit: '칸', hint: v => `한 줄에 ${v.toFixed(2)}칸마다 전구 하나 (작을수록 촘촘함)` },
  { key: 'lightsZigzag', group: 'lights', label: '지그재그 폭', min: 0, max: 0.6, step: 0.01, unit: '칸', hint: v => v <= 0 ? '전구가 모두 전선 위에 한 줄로 달림' : `전선 안쪽과 바깥쪽 전구가 ${v.toFixed(2)}칸 벌어짐` },
  { key: 'lightsJitterY', group: 'lights', label: '상하 랜덤', min: 0, max: 50, step: 1, unit: '%', hint: v => v <= 0 ? '전구가 정확히 같은 간격으로 달림' : `전구마다 간격의 ±${Math.round(v)}%까지 위아래로 어긋남` },
  { key: 'lightsJitterX', group: 'lights', label: '좌우 랜덤', min: 0, max: 0.3, step: 0.005, unit: '칸', hint: v => v <= 0 ? '좌우 어긋남 없음' : `전구마다 ±${v.toFixed(3)}칸까지 좌우로 어긋남` },
  { key: 'snowCover', group: 'snow', label: '쌓인 눈의 짙기', min: 0.2, max: 1, step: 0.02, unit: '', hint: v => `다 쌓였을 때 보도의 ${Math.round(v * 100)}%가 눈에 가려짐` },
  { key: 'snowTracks', group: 'tracks', label: '강아지 발자국', min: 0, max: 1, step: 1, unit: '', hint: v => v ? '눈이 쌓이면 강아지가 가끔 밟고 지나감' : '발자국 없음', choices: [{ value: 1, label: '켜기' }, { value: 0, label: '끄기' }] },
  { key: 'snowTrackDepth', group: 'tracks', label: '발자국이 생기는 눈 깊이', min: 0.1, max: 1, step: 0.05, unit: '', hint: v => `눈이 ${Math.round(v * 100)}% 쌓인 뒤부터 강아지가 지나감` },
  { key: 'snowTrackFrom', group: 'tracks', label: '지나가는 간격 (최소)', min: 3, max: 120, step: 1, unit: '초', hint: v => `강아지가 지나간 뒤 적어도 ${Math.round(v)}초는 조용함` },
  { key: 'snowTrackTo', group: 'tracks', label: '지나가는 간격 (최대)', min: 3, max: 180, step: 1, unit: '초', hint: v => `늦어도 ${Math.round(v)}초 안에는 다시 지나감 (최소보다 작으면 최소와 같게 봄)` },
  { key: 'greeting', group: 'greeting', label: '인사말 가랜드', min: 0, max: 1, step: 1, unit: '', hint: v => v ? '눈이 다 쌓인 뒤 블록을 놓으면 글자 가랜드가 한 번 내려옴' : '인사말이 나오지 않음', choices: [{ value: 1, label: '켜기' }, { value: 0, label: '끄기' }] },
  { key: 'greetingHold', group: 'greeting', label: '문구가 머무는 시간', min: 1, max: 8, step: 0.1, unit: '초', hint: v => `글자가 다 걸린 뒤 ${v.toFixed(1)}초 머물다 떨어짐` },
  { key: 'greetingStagger', group: 'greeting', label: '글자가 내려오는 간격', min: 0.03, max: 0.3, step: 0.01, unit: '초', hint: v => `Merry Christmas(14자)가 ${(13 * v + 0.64).toFixed(1)}초에 걸쳐 다 걸림` },
  { key: 'greetingEvery', group: 'greeting', label: '다시 나오는 간격', min: 0, max: 30, step: 0.5, unit: '분', hint: v => v ? `한 번 나온 뒤 ${v.toFixed(1)}분이 지나면 다음 블록을 놓을 때 다시 나옴` : '한 번 실행에 한 번만 나옴' },
  { key: 'giftWrap', group: 'gift', label: '1칸 채움 꾸밈', min: 0, max: 2, step: 1, unit: '', hint: v => v === 1 ? '1칸 채움 블록이 포장된 선물로 놓이고, 누르면 포장이 뜯기며 오너먼트(산타모자·진저쿠키·별·반짝이는 공)가 박힌 흰 블록이 나옴' : v === 2 ? '빈 공간이 1칸짜리로만 채워지고, 블록 대신 눈오리 집게가 돌아다니며 한 칸씩 눈오리를 찍어 냄' : '1칸 채움 블록은 평소처럼 흰 블록', choices: [{ value: 0, label: '없음' }, { value: 1, label: '선물' }, { value: 2, label: '눈오리' }] },
  { key: 'giftChance', group: 'gift', label: '선물이 나올 확률', min: 0, max: 100, step: 5, unit: '%', hint: v => v >= 100 ? '1칸 채움 블록이 모두 선물로 나옴' : v <= 0 ? '선물이 나오지 않음' : `1칸 채움 블록 100개 중 약 ${Math.round(v)}개가 선물로 나오고 나머지는 흰 블록` },
  { key: 'duckHeap', group: 'gift', label: '눈오리: 빈칸에 쌓이는 눈', min: 0, max: 100, step: 5, unit: '%', hint: v => v <= 0 ? '빈칸에 눈더미가 쌓이지 않고 집게가 바로 옴' : `집게가 오기 전 빈칸에 눈더미가 쌓임 (100%면 칸이 하얗게 덮일 만큼)` },
  { key: 'duckHeapSpread', group: 'gift', label: '눈오리: 눈더미 퍼짐', min: 0, max: 100, step: 5, unit: '%', hint: v => v <= 15 ? '칸 가운데에 봉긋하게 뭉침' : v >= 85 ? '칸 전체에 고르게 깔림' : '가운데가 두껍고 가장자리로 갈수록 옅어짐' },
  { key: 'duckFloor', group: 'gift', label: '눈오리: 주변에 남는 눈', min: 0, max: 100, step: 5, unit: '%', hint: v => v <= 0 ? '눈오리 주변 바닥에 눈이 남지 않음 (어두운 바닥 그대로)' : '눈오리를 만든 뒤 그 칸 바닥에 남는 눈의 양' },
  { key: 'duckKind', group: 'gift', label: '눈오리: 그림', min: 0, max: 1, step: 1, unit: '', hint: v => v ? '날짜와 상관없이 산타 모자를 쓴 눈오리 (확인용)' : '기본 눈오리, 12월 24일·25일에만 산타 모자를 쓴 눈오리', choices: [{ value: 0, label: '날짜에 따라' }, { value: 1, label: '항상 산타 모자' }] },
  { key: 'duckSound', group: 'gift', label: '눈오리: 찍히는 소리 (시안)', min: 0, max: 4, step: 1, unit: '', hint: v => v ? '눈을 꾹 누르는 뽀드득 소리 시안 (자동 쌓기를 켜 두면 눈오리가 찍힐 때마다 들림)' : '다른 채움 블록과 같은 벽돌 소리', choices: [{ value: 0, label: '벽돌' }, { value: 1, label: '1 뽀드득' }, { value: 2, label: '2 뽀득' }, { value: 3, label: '3 꾹' }, { value: 4, label: '4 뽀득 낮게' }] },
  { key: 'duckTilt', group: 'gift', label: '눈오리: 기울기 범위', min: 0, max: 25, step: 1, unit: '도', hint: v => v <= 0 ? '모든 눈오리가 똑바로 놓임' : `눈오리마다 ±${Math.round(v)}도 안에서 제각각 기울어 놓임` },
  { key: 'autoInterval', group: 'auto', label: '자동 쌓기 간격', min: 0.1, max: 3, step: 0.05, unit: '초', hint: v => `블록 하나가 놓이고 ${v.toFixed(2)}초 뒤에 다음 블록을 옮기기 시작함` },
  { key: 'pauseGap', group: 'screen', label: '일시정지 화면 상하 간격', min: 0.3, max: 2.5, step: 0.05, unit: '배', hint: v => `기본 간격(화면 높이의 3.8%, 14~34px)의 ${Math.round(v * 100)}%` },
  { key: 'fallSpeed', group: 'block', label: '블록 자연 낙하 속도', min: 0.2, max: 6, step: 0.05, unit: '칸/초', hint: v => `한 칸 내려가는 데 ${(1 / v).toFixed(2)}초` },
  { key: 'fillSpeed', group: 'block', label: '빈 공간 채움 속도', min: 0.25, max: 4, step: 0.05, unit: '배', hint: v => `흰 타일 하나 ${(0.86 / v).toFixed(2)}초, 다음 타일까지 ${(0.2 / v).toFixed(2)}초` },
  { key: 'typingSpeed', group: 'onboarding', label: '온보딩 글씨가 써지는 속도', min: 2, max: 60, step: 1, unit: '글자/초', hint: v => `한 글자 ${Math.round(1000 / v)}ms, 두 줄 문구(약 25자) ${(25 / v).toFixed(1)}초` },
  { key: 'inkSeconds', group: 'onboarding', label: '글자 번짐 시간', min: 0.1, max: 1.5, step: 0.05, unit: '초', hint: v => `한 글자가 흐릿하게 시작해 ${v.toFixed(2)}초에 걸쳐 또렷해지며 내려앉음` },
  { key: 'pauseScale', group: 'onboarding', label: '문장부호·줄바꿈 쉼', min: 0, max: 3, step: 0.1, unit: '배', hint: v => v ? `쉼표 뒤 ${(0.3 * v).toFixed(2)}초, 마침표 뒤 ${(0.5 * v).toFixed(2)}초, 줄바꿈 ${(0.4 * v).toFixed(2)}초 쉼` : '쉬지 않고 같은 간격으로 씀' },
  { key: 'rhythmJitter', group: 'onboarding', label: '리듬 흔들림', min: 0, max: 1, step: 1, unit: '', hint: v => v ? '글자 사이 간격이 ±15% 안에서 손으로 쓰듯 조금씩 달라짐' : '모든 글자를 같은 간격으로 씀', choices: [{ value: 1, label: '켜기' }, { value: 0, label: '끄기' }] },
  { key: 'stepFadeSeconds', group: 'onboarding', label: '튜토리얼 문구 사라지는 시간', min: 0.3, max: 3, step: 0.1, unit: '초', hint: v => `회전·이동·쌓기 문구가 ${v.toFixed(1)}초에 걸쳐 살짝 떠오르며 흐려짐` },
  { key: 'stepReadySeconds', group: 'onboarding', label: '튜토리얼 조작 대기', min: 0, max: 3, step: 0.1, unit: '초', hint: v => `문구가 다 써진 뒤 ${v.toFixed(1)}초가 지나야 다음 조작을 받음 (그 전에는 블록도 멈춤)` },
  { key: 'gestureHint', group: 'onboarding', label: '조작 안내 손짓', min: 0, max: 1, step: 1, unit: '', hint: v => v ? '조작할 수 있게 되면 블록 위에 탭·좌우·아래 손짓이 은은하게 반복됨' : '손짓 없이 문구만 보여 줌', choices: [{ value: 1, label: '켜기' }, { value: 0, label: '끄기' }] },
  { key: 'onboardingSize', group: 'onboarding', label: '온보딩 글씨 크기', min: 0.6, max: 2.5, step: 0.05, unit: '배', hint: v => `시안 크기의 ${Math.round(v * 100)}% (화면 높이 900px 기준 약 ${Math.round(18 * v)}px)` },
  { key: 'onboardingPhoneScale', group: 'onboarding', label: '스마트폰 글씨 비율', min: 0.5, max: 1, step: 0.05, unit: '배', hint: v => `너비 600px 미만(스마트폰)에서는 온보딩 글씨를 태블릿의 ${Math.round(v * 100)}%로 줄임` },
  { key: 'introSweep', group: 'onboarding', label: '온보딩 문구 표시 방식', min: 0, max: 1, step: 1, unit: '', hint: v => v ? '모든 문구가 위에서 아래로 쓸어내리듯 드러남' : '모든 문구가 한 글자씩 써짐 (글씨 속도 적용)', choices: [{ value: 1, label: '전체 쓸어내리기' }, { value: 0, label: '한 글자씩 쓰기' }] },
  { key: 'introSweepSeconds', group: 'onboarding', label: '쓸어내리기 시간', min: 0.5, max: 8, step: 0.1, unit: '초', hint: v => `시작 화면 문구 전체가 ${v.toFixed(1)}초 동안 위에서 아래로 드러남` },
  { key: 'stepSweepSeconds', group: 'onboarding', label: '이후 문구 쓸어내리기 시간', min: 0.3, max: 4, step: 0.1, unit: '초', hint: v => `회전·이동·쌓기·빨간 버튼 문구가 ${v.toFixed(1)}초 동안 한 번에 부드럽게 드러남` },
];

export const tuning: Tuning = { ...TUNING_DEFAULTS };

const listeners = new Set<(value: Tuning) => void>();

/** Clamps to the field's range, applies, and tells every listener. */
export function setTuning(key: keyof Tuning, value: number) {
  const field = TUNING_FIELDS.find(f => f.key === key);
  if (!field || !Number.isFinite(value)) return;
  tuning[key] = Math.min(field.max, Math.max(field.min, value));
  listeners.forEach(listener => listener(tuning));
}

export function onTuning(listener: (value: Tuning) => void) { listeners.add(listener); listener(tuning); return () => listeners.delete(listener); }

/** Kept only on a tester's own device (admin panel, preview page), so tuned values survive reloads. */
const STORAGE_KEY = 'blockstep.tuning';
export function restoreSavedTuning() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Tuning>;
    for (const field of TUNING_FIELDS) if (typeof saved[field.key] === 'number') setTuning(field.key, saved[field.key]!);
  } catch { /* Defaults stay. */ }
}
export function saveTuning() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning)); } catch { /* Session only. */ } }