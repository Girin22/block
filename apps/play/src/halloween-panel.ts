import { changeHalloween, cue, halloween, HALLOWEEN_DEFAULTS, PAVER_LIBRARY, paverOf, replaceHalloween, SLOT_SHAPE, SLOTS, VISITORS, type HalloweenSettings, type HalloweenSlot, type Visitor } from './halloween';

/** Kept only on the tester's own device, like the other tuning values. */
// v2: the settled defaults (2026-10-25) replace whatever a device kept from the review.
const STORAGE_KEY = 'blockstep.halloween.v2';
/** Images the planner adds are scaled to this height at most, so a few of them fit in the device's storage. */
const UPLOAD_HEIGHT = 360;

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as HalloweenSettings | null;
    if (saved?.tiles) replaceHalloween({ ...HALLOWEEN_DEFAULTS, ...saved, visitors: { ...HALLOWEEN_DEFAULTS.visitors, ...saved.visitors } });
  } catch { /* Defaults stay. */ }
}
/** False when the device's storage is full (large added images); the values still apply until reload. */
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(halloween)); return true; } catch { return false; } }

const percent = (slot: HalloweenSlot, weight: number) => {
  const total = halloween.tiles[slot].reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  return total ? `${Math.round(Math.max(0, weight) / total * 100)}%` : '0%';
};

/** An added image, scaled down and kept as a data URL. */
function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image(), url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, UPLOAD_HEIGHT / image.naturalHeight);
      const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url); resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    image.src = url;
  });
}

/**
 * The Halloween section of the planner's tuning sheet. Each slot lists its pavers like components on an
 * object: add one from the drafts (or from a file), set its weight, remove it; the board re-dresses at
 * once. Below are the sky (backdrop and visitors, with a button to send each one now) and the glitch
 * (automatic or not, how often, how strong, how long, and one now; G does the same on a keyboard).
 */
export function mountHalloweenPanel(body: HTMLElement, status: HTMLElement) {
  restore();
  const section = document.createElement('section'); section.className = 'tuning-group'; section.id = 'halloween-panel';
  section.innerHTML = `<h3>할로윈 이벤트</h3>
    <p class="note">일시정지 화면에서 호박 탭을 고르면 보여요. 비중은 칸 안에서 상대적인 값이고, 타일마다 고정된 확률로 골라져서 값을 바꾸면 쌓인 판도 바로 다시 입혀져요.</p>
    ${SLOTS.map(({ key, label }) => `<div class="tuning-row hw-slot" data-slot="${key}">
      <div class="row-head"><label>${label}</label><span class="hw-shape">${SLOT_SHAPE[key] === 'domino' ? '세로 2칸 그림' : '정사각형 그림'}</span></div>
      <ul class="hw-list"></ul>
      <select class="hw-add" aria-label="${label}에 타일 추가"></select>
      <input type="file" accept="image/*" hidden>
    </div>`).join('')}
    <div class="tuning-row"><div class="row-head"><label>배경</label></div>
      <div class="tuning-choices" id="hw-backdrop" role="radiogroup" aria-label="배경"><button type="button" role="radio" data-value="lantern">랜턴 불빛</button><button type="button" role="radio" data-value="lofi">로파이 밤하늘</button></div>
      <p class="hint">랜턴: 짙은 밤색에 가장자리 주황 불빛 · 로파이: 노을 진 밤하늘, 달, 안개, 필름 입자</p></div>
    <div class="tuning-row"><div class="row-head"><label>하늘의 등장 효과</label></div>
      ${VISITORS.map(({ key, label }) => `<div class="hw-visitor"><label><input type="checkbox" data-visitor="${key}"> ${label}</label><button type="button" data-visit="${key}">지금 보기</button></div>`).join('')}
      <div class="hw-range"><label for="hw-visitor-from">최소 간격</label><input type="range" id="hw-visitor-from" min="5" max="90" step="1"><span class="hw-value"></span></div>
      <div class="hw-range"><label for="hw-visitor-to">최대 간격</label><input type="range" id="hw-visitor-to" min="5" max="90" step="1"><span class="hw-value"></span></div>
      <p class="hint">켜 둔 효과마다 따로 최소~최대 간격 사이의 무작위 시간마다 지나가요. 그래서 박쥐와 마녀가 동시에 나올 수도 있어요. 마녀가 달을 지날 때는 글리치가 함께 와요(자동 글리치 켜짐일 때).</p></div>
    <div class="tuning-row"><div class="row-head"><label>로파이 글리치</label></div>
      <div class="tuning-choices" id="hw-glitch" role="radiogroup" aria-label="자동 글리치"><button type="button" role="radio" data-value="1">자동 켜기</button><button type="button" role="radio" data-value="0">끄기</button></div>
      <p class="hw-sub">빈 공간이 채워질 때 1회</p>
      <div class="tuning-choices" id="hw-glitch-fill" role="radiogroup" aria-label="빈 공간이 채워질 때 글리치"><button type="button" role="radio" data-value="1">켜기</button><button type="button" role="radio" data-value="0">끄기</button></div>
      <div class="hw-range"><label for="hw-glitch-every">평균 간격</label><input type="range" id="hw-glitch-every" min="12" max="120" step="1"><span class="hw-value"></span></div>
      <div class="hw-range"><label for="hw-glitch-strength">세기</label><input type="range" id="hw-glitch-strength" min="0.1" max="1" step="0.05"><span class="hw-value"></span></div>
      <div class="hw-range"><label for="hw-glitch-ms">길이</label><input type="range" id="hw-glitch-ms" min="150" max="900" step="10"><span class="hw-value"></span></div>
      <button type="button" class="wide" id="hw-glitch-now">지금 글리치 (키보드 G)</button>
      <p class="hint">눈이 편하도록 깜빡임·밝기 변화 없이 짧게 찢어지고 색이 살짝 갈라져요. 자동은 최소 12초 간격이에요. 채움 글리치는 흰 타일이 채워지기 시작하는 순간 한 번(여진 없음) 나오고, 글리치가 난 뒤 10초 안에 또 채워지면 나오지 않아요. 자동과 따로 켜고 끌 수 있어요.</p></div>
    <button type="button" class="wide" id="hw-reset">할로윈 설정 기본값으로</button>`;
  body.append(section);

  const saved = (message = '') => { status.textContent = persist() ? message : '이미지가 커서 이 기기에 저장하지 못했어요. 새로고침하면 사라져요.'; };

  const renderSlot = (slot: HalloweenSlot) => {
    const element = section.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
    element.querySelector('.hw-list')!.innerHTML = halloween.tiles[slot].map((entry, index) => {
      const paver = paverOf(entry);
      return `<li data-index="${index}"><img src="${paver?.url ?? ''}" alt=""><span class="hw-name">${paver?.name ?? entry.paver}</span>
        <input type="range" min="0" max="10" step="1" value="${entry.weight}" aria-label="${paver?.name ?? ''} 비중"><span class="hw-weight">${entry.weight}</span><span class="hw-percent">${percent(slot, entry.weight)}</span>
        <button type="button" class="hw-remove" aria-label="${paver?.name ?? ''} 빼기">✕</button></li>`;
    }).join('');
    const used = new Set(halloween.tiles[slot].map(entry => entry.paver));
    element.querySelector('.hw-add')!.innerHTML = '<option value="">+ 타일 추가</option>'
      + PAVER_LIBRARY.filter(paver => paver.shape === SLOT_SHAPE[slot] && !used.has(paver.id)).map(paver => `<option value="${paver.id}">${paver.name}</option>`).join('')
      + '<option value="upload">내 이미지 불러오기…</option>';
  };
  const showPercents = (slot: HalloweenSlot) => section.querySelectorAll<HTMLElement>(`[data-slot="${slot}"] li`).forEach(item => {
    const weight = halloween.tiles[slot][Number(item.dataset.index)].weight;
    item.querySelector('.hw-weight')!.textContent = String(weight); item.querySelector('.hw-percent')!.textContent = percent(slot, weight);
  });

  for (const { key: slot } of SLOTS) {
    const element = section.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
    const list = element.querySelector('.hw-list')!, add = element.querySelector<HTMLSelectElement>('.hw-add')!, file = element.querySelector<HTMLInputElement>('input[type=file]')!;
    list.addEventListener('input', event => {
      const input = event.target as HTMLInputElement, index = Number(input.closest('li')!.dataset.index);
      changeHalloween(value => { value.tiles[slot][index].weight = Number(input.value); }); showPercents(slot); saved();
    });
    list.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest('.hw-remove'); if (!button) return;
      const index = Number(button.closest('li')!.dataset.index);
      if (halloween.tiles[slot].length === 1) { status.textContent = '칸마다 타일이 하나는 있어야 해요.'; return; }
      changeHalloween(value => { value.tiles[slot].splice(index, 1); }); renderSlot(slot); saved();
    });
    add.addEventListener('change', () => {
      const choice = add.value; add.value = '';
      if (choice === 'upload') { file.click(); return; }
      if (!choice) return;
      changeHalloween(value => { value.tiles[slot].push({ paver: choice, weight: 1 }); }); renderSlot(slot); saved('추가했어요. 비중을 조절해 보세요.');
    });
    file.addEventListener('change', async () => {
      const picked = file.files?.[0]; file.value = '';
      if (!picked) return;
      try {
        const url = await readImage(picked);
        changeHalloween(value => { value.tiles[slot].push({ paver: `custom-${Date.now()}`, weight: 1, name: picked.name.replace(/\.[^.]+$/, ''), url }); });
        renderSlot(slot); saved('내 이미지를 추가했어요.');
      } catch { status.textContent = '이미지를 읽지 못했어요.'; }
    });
    renderSlot(slot);
  }

  const choices = (id: string, read: () => string, write: (value: string) => void) => {
    const group = section.querySelector<HTMLElement>(id)!;
    const show = () => group.querySelectorAll<HTMLButtonElement>('[data-value]').forEach(button => button.setAttribute('aria-checked', String(button.dataset.value === read())));
    group.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-value]'); if (!button) return;
      changeHalloween(() => write(button.dataset.value!)); show(); saved();
    });
    show();
    return show;
  };
  const switches = [
    choices('#hw-backdrop', () => halloween.backdrop, value => { halloween.backdrop = value as HalloweenSettings['backdrop']; }),
    choices('#hw-glitch', () => halloween.glitch ? '1' : '0', value => { halloween.glitch = value === '1'; }),
    choices('#hw-glitch-fill', () => halloween.glitchOnFill ? '1' : '0', value => { halloween.glitchOnFill = value === '1'; }),
  ];

  const range = (id: string, key: 'visitorFrom' | 'visitorTo' | 'glitchEvery' | 'glitchStrength' | 'glitchMs', format: (value: number) => string) => {
    const input = section.querySelector<HTMLInputElement>(id)!, label = input.parentElement!.querySelector('.hw-value')!;
    const show = () => { input.value = String(halloween[key]); label.textContent = format(halloween[key]); };
    input.addEventListener('input', () => { changeHalloween(value => { value[key] = Number(input.value); }); label.textContent = format(halloween[key]); saved(); });
    show();
    return show;
  };
  const ranges = [
    range('#hw-visitor-from', 'visitorFrom', v => `${v}초`),
    range('#hw-visitor-to', 'visitorTo', v => `${v}초`),
    range('#hw-glitch-every', 'glitchEvery', v => `${v}초`),
    range('#hw-glitch-strength', 'glitchStrength', v => `${Math.round(v * 100)}%`),
    range('#hw-glitch-ms', 'glitchMs', v => `${v}ms`),
  ];

  const showVisitors = () => section.querySelectorAll<HTMLInputElement>('[data-visitor]').forEach(box => { box.checked = halloween.visitors[box.dataset.visitor as Visitor]; });
  section.querySelectorAll<HTMLInputElement>('[data-visitor]').forEach(box => box.addEventListener('change', () => {
    changeHalloween(value => { value.visitors[box.dataset.visitor as Visitor] = box.checked; }); saved();
  }));
  showVisitors();
  section.querySelectorAll<HTMLButtonElement>('[data-visit]').forEach(button => button.addEventListener('click', () => cue(button.dataset.visit as Visitor)));
  section.querySelector('#hw-glitch-now')!.addEventListener('click', () => cue('glitch'));

  section.querySelector('#hw-reset')!.addEventListener('click', () => {
    replaceHalloween(HALLOWEEN_DEFAULTS);
    for (const { key } of SLOTS) renderSlot(key);
    [...switches, ...ranges].forEach(show => show()); showVisitors();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Nothing stored. */ }
    status.textContent = '할로윈 설정을 기본값으로 되돌렸어요.';
  });
}

/** The Halloween values for "설정값 복사", with added images named instead of pasted in full. */
export function halloweenForCopy() {
  return { ...halloween, tiles: Object.fromEntries(Object.entries(halloween.tiles).map(([slot, entries]) => [slot, entries.map(entry => entry.url ? { ...entry, url: '(내 이미지)' } : entry)])) };
}
