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
  /** How the intro appears: 1 sweeps the whole text into view from the top down, 0 writes it character by character. */
  introSweep: number;
    /** Sweep: seconds for the whole intro to be uncovered from top to bottom. */
  introSweepSeconds: number;
}

export const TUNING_DEFAULTS: Readonly<Tuning> = { rainSpeed: 1, rippleSize: 1, pauseGap: 1, fallSpeed: 1.1, fillSpeed: 1, typingSpeed: 14, inkSeconds: 0.6, pauseScale: 1, rhythmJitter: 1, stepFadeSeconds: 1.4, stepReadySeconds: 0.5, gestureHint: 1, onboardingSize: 1.5, introSweep: 1, introSweepSeconds: 3 };

/** A `choices` field is a switch between labelled values instead of a gauge. */
export type TuningGroup = 'weather' | 'screen' | 'block' | 'onboarding';
export const TUNING_GROUPS: readonly { key: TuningGroup; label: string }[] = [
  { key: 'weather', label: '비' }, { key: 'screen', label: '일시정지 화면' }, { key: 'block', label: '블록' }, { key: 'onboarding', label: '온보딩' },
];
export interface TuningField { key: keyof Tuning; group: TuningGroup; label: string; min: number; max: number; step: number; unit: string; hint: (value: number) => string; choices?: readonly { value: number; label: string }[]; }

export const TUNING_FIELDS: readonly TuningField[] = [
  { key: 'rainSpeed', group: 'weather', label: '비가 내리는 속도', min: 0.25, max: 3, step: 0.05, unit: '배', hint: v => `빗줄기 한 개가 ${Math.round(220 / v)}ms 동안 떨어짐` },
  { key: 'rippleSize', group: 'weather', label: '빗방울 동심원 크기', min: 0.25, max: 3, step: 0.05, unit: '배', hint: v => `반지름 ${(7 * v).toFixed(1)}~${(14 * v).toFixed(1)}px` },
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
  { key: 'introSweep', group: 'onboarding', label: '시작 화면 문구 표시 방식', min: 0, max: 1, step: 1, unit: '', hint: v => v ? '문구 전체가 위에서 아래로 쓸어내리듯 드러남' : '한 글자씩 써짐 (글씨 속도 적용)', choices: [{ value: 1, label: '전체 쓸어내리기' }, { value: 0, label: '한 글자씩 쓰기' }] },
  { key: 'introSweepSeconds', group: 'onboarding', label: '쓸어내리기 시간', min: 0.5, max: 8, step: 0.1, unit: '초', hint: v => `시작 화면 문구 전체가 ${v.toFixed(1)}초 동안 위에서 아래로 드러남` },
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
