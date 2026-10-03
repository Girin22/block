import { onTuning, setTuning, tuning, TUNING_DEFAULTS, TUNING_FIELDS, TUNING_GROUPS, type Tuning, type TuningField } from './tuning';
import { ONBOARDING_DEFAULTS, ONBOARDING_PAGES, onboardingText, resetOnboarding, type OnboardingPage } from './onboarding';

/** Kept only on the tester's own device, so a planner's values survive reloads while polishing. */
const STORAGE_KEY = 'blockstep.tuning', TEXT_KEY = 'blockstep.onboardingText';

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Tuning>;
    for (const field of TUNING_FIELDS) if (typeof saved[field.key] === 'number') setTuning(field.key, saved[field.key]!);
  } catch { /* Defaults stay. */ }
  try {
    const saved = JSON.parse(localStorage.getItem(TEXT_KEY) ?? '{}') as Partial<Record<OnboardingPage, string>>;
    for (const { key } of ONBOARDING_PAGES) if (typeof saved[key] === 'string') onboardingText[key] = saved[key]!;
  } catch { /* Default copy stays. */ }
}
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning)); } catch { /* Session only. */ } }
function persistText() { try { localStorage.setItem(TEXT_KEY, JSON.stringify(onboardingText)); } catch { /* Session only. */ } }

const decimals = (step: number) => (String(step).split('.')[1] ?? '').length;

/** One value: its name and number on one line, the gauge (or switch) under it, then what it means. */
function row(field: TuningField) {
  if (field.choices) return `<div class="tuning-row" data-key="${field.key}">
      <div class="row-head"><label>${field.label}</label></div>
      <div class="tuning-choices" role="radiogroup" aria-label="${field.label}">${field.choices.map(choice => `<button type="button" role="radio" data-value="${choice.value}">${choice.label}</button>`).join('')}</div>
      <p class="hint"></p>
    </div>`;
  return `<div class="tuning-row" data-key="${field.key}">
      <div class="row-head">
        <label for="tuning-${field.key}">${field.label}</label>
        <span class="value"><input type="number" inputmode="decimal" min="${field.min}" max="${field.max}" step="${field.step}" aria-label="${field.label} 숫자 입력"><span class="unit">${field.unit}</span></span>
      </div>
      <input type="range" id="tuning-${field.key}" min="${field.min}" max="${field.max}" step="${field.step}">
      <p class="hint"></p>
    </div>`;
}

/**
 * The planner's live tuning sheet, grouped by what it changes, with the device readout on top and the
 * reset and copy actions always at hand at the bottom. Docked beside the game on a PC, a popup on a
 * phone. Admin builds only; players never get it.
 */
export function mountTuningPanel(admin: HTMLElement) {
  restore();
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.id = 'tuning-toggle';
  toggle.textContent = '조절'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'tuning');
  const sheet = document.createElement('section'); sheet.id = 'tuning'; sheet.setAttribute('aria-label', '기획 조절값');
  sheet.innerHTML = `<header class="tuning-head">
      <div><b>기획 조절값</b><span>바꾼 값은 이 기기에만 저장돼요</span></div>
      <button type="button" id="tuning-close" aria-label="닫기">닫기</button>
    </header>
    <div class="tuning-body">
      <section class="tuning-group" id="tuning-device"><h3>기기 상태</h3></section>
      ${TUNING_GROUPS.map(group => `<section class="tuning-group" data-group="${group.key}"><h3>${group.label}</h3>
        ${TUNING_FIELDS.filter(field => field.group === group.key).map(row).join('')}
      </section>`).join('')}
      <section class="tuning-group"><h3>온보딩 문구</h3>
        <p class="note">줄바꿈은 그대로 반영돼요. 빈 줄은 문단 간격, <code>_문구_</code>처럼 감싼 줄은 밑줄이에요. 바꾼 문구는 그 페이지가 다음에 나올 때 적용돼요. 시작 화면에서 탭하면 빈 줄로 나뉜 문단을 두 개씩 건너뛰고, 마지막 문단과 ‘시작하기’는 건너뛰지 않아요.</p>
        ${ONBOARDING_PAGES.map(({ key, label }) => `<div class="tuning-row text-row" data-text="${key}">
          <div class="row-head"><label for="text-${key}">${label}</label></div>
          <textarea id="text-${key}" rows="${Math.min(12, ONBOARDING_DEFAULTS[key].split('\n').length + 1)}"></textarea>
        </div>`).join('')}
        <button type="button" class="wide" id="onboarding-replay">온보딩 처음부터 다시 보기</button>
      </section>
    </div>
    <footer class="tuning-foot">
      <p class="tuning-status" role="status"></p>
      <div class="actions"><button type="button" id="tuning-reset">기본값으로</button><button type="button" class="primary" id="tuning-copy">설정값 복사</button></div>
    </footer>`;
  admin.prepend(toggle); document.body.append(sheet);
  // The device readout moves in with the values, so the corner of the game stays clear.
  sheet.querySelector('#tuning-device')!.append(...Array.from(admin.querySelectorAll('.device')));
  admin.classList.add('has-tuning');

  const status = sheet.querySelector<HTMLElement>('.tuning-status')!;
  for (const field of TUNING_FIELDS) {
    const element = sheet.querySelector<HTMLElement>(`[data-key="${field.key}"]`)!;
    if (field.choices) {
      element.querySelectorAll<HTMLButtonElement>('[data-value]').forEach(button => button.addEventListener('click', () => { setTuning(field.key, Number(button.dataset.value)); persist(); }));
      continue;
    }
    const range = element.querySelector<HTMLInputElement>('input[type=range]')!, number = element.querySelector<HTMLInputElement>('input[type=number]')!;
    const apply = (input: HTMLInputElement) => { if (input.value !== '') { setTuning(field.key, Number(input.value)); persist(); } };
    range.addEventListener('input', () => apply(range));
    number.addEventListener('change', () => apply(number));
    number.addEventListener('keydown', (event: KeyboardEvent) => { if (event.key === 'Enter') apply(number); });
  }
  onTuning(value => {
    for (const field of TUNING_FIELDS) {
      const element = sheet.querySelector<HTMLElement>(`[data-key="${field.key}"]`)!;
      if (field.choices) element.querySelectorAll<HTMLButtonElement>('[data-value]').forEach(button => button.setAttribute('aria-checked', String(Number(button.dataset.value) === value[field.key])));
      else {
        const range = element.querySelector<HTMLInputElement>('input[type=range]')!, number = element.querySelector<HTMLInputElement>('input[type=number]')!;
        const shown = value[field.key].toFixed(decimals(field.step));
        range.value = shown; if (document.activeElement !== number) number.value = shown;
        // The filled part of the gauge, for browsers that do not draw it themselves.
        range.style.setProperty('--fill', `${(value[field.key] - field.min) / (field.max - field.min) * 100}%`);
      }
      element.querySelector('.hint')!.textContent = field.hint(value[field.key]);
      element.classList.toggle('changed', value[field.key] !== TUNING_DEFAULTS[field.key]);
    }
  });
  for (const { key } of ONBOARDING_PAGES) {
    const element = sheet.querySelector<HTMLElement>(`[data-text="${key}"]`)!, area = element.querySelector('textarea')!;
    const mark = () => element.classList.toggle('changed', onboardingText[key] !== ONBOARDING_DEFAULTS[key]);
    area.value = onboardingText[key]; mark();
    area.addEventListener('input', () => { onboardingText[key] = area.value; persistText(); mark(); });
  }
  // Forget the "seen" marks and start over, so the planner sees the intro and the first-hole tip again.
  sheet.querySelector('#onboarding-replay')!.addEventListener('click', () => { resetOnboarding(); location.reload(); });
  const open = (show: boolean) => { sheet.classList.toggle('open', show); toggle.setAttribute('aria-expanded', String(show)); };
  toggle.addEventListener('click', () => open(!sheet.classList.contains('open')));
  sheet.querySelector('#tuning-close')!.addEventListener('click', () => open(false));
  sheet.querySelector('#tuning-reset')!.addEventListener('click', () => {
    for (const field of TUNING_FIELDS) setTuning(field.key, TUNING_DEFAULTS[field.key]);
    for (const { key } of ONBOARDING_PAGES) {
      onboardingText[key] = ONBOARDING_DEFAULTS[key];
      const element = sheet.querySelector<HTMLElement>(`[data-text="${key}"]`)!; element.querySelector('textarea')!.value = onboardingText[key]; element.classList.remove('changed');
    }
    persist(); persistText(); status.textContent = '기본값으로 되돌렸어요.';
  });
  sheet.querySelector('#tuning-copy')!.addEventListener('click', async () => {
    const text = TUNING_FIELDS.map(field => `${field.label}: ${tuning[field.key]}${field.unit}`).join('\n')
      + '\n\n' + ONBOARDING_PAGES.map(({ key, label }) => `[${label}]\n${onboardingText[key]}`).join('\n\n')
      + `\n\n${JSON.stringify({ tuning, onboardingText })}`;
    try { await navigator.clipboard.writeText(text); status.textContent = '복사했어요. 개발자에게 붙여 넣어 보내 주세요.'; }
    catch { status.textContent = text; }
  });
}
