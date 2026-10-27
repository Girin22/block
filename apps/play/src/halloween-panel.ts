import { changeHalloween, cue, halloween, HALLOWEEN_DEFAULTS, PAVER_LIBRARY, paverOf, replaceHalloween, SLOT_SHAPE, SLOTS, VISITOR_LOOKS, VISITORS, type HalloweenSettings, type HalloweenSlot, type Visitor } from './halloween';

/** Kept only on the tester's own device, like the other tuning values. */
// v4: the revised defaults (2026-10-27: no witch in the sky, plain bats, glitch on the witch paver) replace whatever a device kept.
const STORAGE_KEY = 'blockstep.halloween.v4';
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
      <p class="hw-sub">어두운 화면에서 보이게 하기</p>
      <div class="tuning-choices" id="hw-visitor-look" role="radiogroup" aria-label="박쥐·마녀 보이게 하기">${VISITOR_LOOKS.map(({ key, label }) => `<button type="button" role="radio" data-value="${key}">${label}</button>`).join('')}</div>
      <div class="hw-range"><label for="hw-visitor-glow">세기</label><input type="range" id="hw-visitor-glow" min="0.1" max="1" step="0.05"><span class="hw-value"></span></div>
      <div class="hw-range"><label for="hw-visitor-scale">크기</label><input type="range" id="hw-visitor-scale" min="1" max="2" step="0.05"><span class="hw-value"></span></div>
      <div class="hw-visitor"><label><input type="checkbox" id="hw-dim"> 어두운 화면 미리보기</label><button type="button" id="hw-visit-both">박쥐+마녀 같이</button></div>
      <p class="hint">윤곽 빛: 박쥐는 주황, 마녀는 달빛 테두리 · 뒤 밝히기: 날아가는 하늘 위쪽을 옅게 밝힘 · 밝은 색: 실루엣을 연보라 쪽으로. 세기는 각 방법의 강도예요. 어두운 화면 미리보기는 게임 화면만 어둡게 해서 휴대폰 밝기를 낮춘 상태를 흉내 내요(이 기기에서만, 저장 안 됨).</p>
      <p class="hint">켜 둔 효과마다 따로 최소~최대 간격 사이의 무작위 시간마다 지나가요. 그래서 둘 이상 켜면 동시에 나올 수도 있어요.</p></div>
    <div class="tuning-row"><div class="row-head"><label>로파이 글리치</label></div>
      <p class="hw-sub">마녀 타일이 끼워질 때</p>
      <div class="tuning-choices" id="hw-glitch-witch" role="radiogroup" aria-label="마녀 타일이 끼워질 때 글리치"><button type="button" role="radio" data-value="1">켜기</button><button type="button" role="radio" data-value="0">끄기</button></div>
      <div class="hw-range"><label for="hw-glitch-strength">세기</label><input type="range" id="hw-glitch-strength" min="0.1" max="1" step="0.05"><span class="hw-value"></span></div>
      <div class="hw-range"><label for="hw-glitch-ms">길이</label><input type="range" id="hw-glitch-ms" min="150" max="900" step="10"><span class="hw-value"></span></div>
      <button type="button" class="wide" id="hw-glitch-now">지금 글리치 (키보드 G)</button>
      <p class="hint">눈이 편하도록 깜빡임·밝기 변화 없이 짧게 찢어지고 색이 살짝 갈라져요. 1칸 빈 공간에 마녀 타일이 딱 맞아 들어가는 순간에만 한 번 나와요(쿨타임 없음, 한 번에 마녀가 여럿이면 한 번만). 마녀가 나오는 비율은 위의 ‘1칸 채움’ 비중으로 정해요.</p></div>
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
    choices('#hw-visitor-look', () => halloween.visitorLook, value => { halloween.visitorLook = value as HalloweenSettings['visitorLook']; }),
    choices('#hw-glitch-witch', () => halloween.glitchOnWitch ? '1' : '0', value => { halloween.glitchOnWitch = value === '1'; }),
  ];

  const range = (id: string, key: 'visitorFrom' | 'visitorTo' | 'visitorGlow' | 'visitorScale' | 'glitchStrength' | 'glitchMs', format: (value: number) => string) => {
    const input = section.querySelector<HTMLInputElement>(id)!, label = input.parentElement!.querySelector('.hw-value')!;
    const show = () => { input.value = String(halloween[key]); label.textContent = format(halloween[key]); };
    input.addEventListener('input', () => { changeHalloween(value => { value[key] = Number(input.value); }); label.textContent = format(halloween[key]); saved(); });
    show();
    return show;
  };
  const ranges = [
    range('#hw-visitor-from', 'visitorFrom', v => `${v}초`),
    range('#hw-visitor-to', 'visitorTo', v => `${v}초`),
    range('#hw-visitor-glow', 'visitorGlow', v => `${Math.round(v * 100)}%`),
    range('#hw-visitor-scale', 'visitorScale', v => `${v.toFixed(2)}배`),
    range('#hw-glitch-strength', 'glitchStrength', v => `${Math.round(v * 100)}%`),
    range('#hw-glitch-ms', 'glitchMs', v => `${v}ms`),
  ];

  const showVisitors = () => section.querySelectorAll<HTMLInputElement>('[data-visitor]').forEach(box => { box.checked = halloween.visitors[box.dataset.visitor as Visitor]; });
  section.querySelectorAll<HTMLInputElement>('[data-visitor]').forEach(box => box.addEventListener('change', () => {
    changeHalloween(value => { value.visitors[box.dataset.visitor as Visitor] = box.checked; }); saved();
  }));
  showVisitors();
  section.querySelectorAll<HTMLButtonElement>('[data-visit]').forEach(button => button.addEventListener('click', () => cue(button.dataset.visit as Visitor)));
  section.querySelector<HTMLInputElement>('#hw-dim')!.addEventListener('change', event => document.body.classList.toggle('dim-preview', (event.target as HTMLInputElement).checked));
  section.querySelector('#hw-visit-both')!.addEventListener('click', () => { cue('witch'); cue('bats'); });
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
