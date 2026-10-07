import { REAL_PLACES, REAL_META } from './real-places.mjs';
import { CATEGORIES, REAL_STORAGE_KEY, normalizeRealState, findRealPlaces, readRealState, serializeRealState, mapLink, exportRealMemo } from './real-guide.mjs';

const $ = selector => document.querySelector(selector);
const byId = new Map(REAL_PLACES.map(item => [item.id, item]));
let state = normalizeRealState();
const consent = $('#real-consent');
const status = $('#real-storage-status');
function node(tag, className, text) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}
function button(text, action, className = 'felt-choice') {
  const value = node('button', className, text); value.type = 'button'; value.addEventListener('click', action); return value;
}
function external(text, url) {
  const value = node('a', '', text); value.href = url; value.target = '_blank'; value.rel = 'noopener noreferrer'; return value;
}
function save() {
  if (!consent.checked) return;
  try { localStorage.setItem(REAL_STORAGE_KEY, serializeRealState(state)); status.textContent = '관심 분야와 담은 장소를 이 브라우저에 저장했어요.'; }
  catch { status.textContent = '브라우저가 저장을 허용하지 않았어요. 현재 화면에서는 계속 고를 수 있어요.'; }
}
function announce(text) { $('#real-status').textContent = text; }
function render() {
  for (const item of CATEGORIES) $('#real-interest-' + item.id).setAttribute('aria-pressed', String(state.interests.includes(item.id)));
  const visible = findRealPlaces(state);
  $('#real-count').textContent = state.interests.length ? `고른 관심 분야의 장소 ${visible.length}곳` : `공식 안내를 확인한 장소 ${visible.length}곳`;
  $('#real-cards').replaceChildren(...visible.map(place => {
    const article = node('article', 'real-card'); article.dataset.place = place.id;
    const top = node('div', 'real-card-heading');
    top.append(node('p', 'eyebrow', CATEGORIES.find(item => item.id === place.category).label), node('h3', '', place.name));
    const address = node('p', 'real-address', place.address);
    const facts = node('dl', 'real-facts');
    for (const [label, value] of [['비용', place.costNote], ['방문 전', place.visitNote]]) { facts.append(node('dt', '', label), node('dd', '', value)); }
    const links = node('div', 'real-links'); links.append(external(place.category === 'stay' ? '객실·예약 안내 ↗' : '공식 안내 ↗', place.sourceUrl), external('지도 검색 ↗', mapLink(place)));
    const selected = state.selected.includes(place.id);
    const choose = button(selected ? '내 목록에서 빼기' : '내 방문 목록에 담기', () => {
      state.selected = selected ? state.selected.filter(id => id !== place.id) : [...state.selected, place.id];
      save(); render(); announce(`${place.name}${selected ? '을(를) 목록에서 뺐어요.' : '을(를) 목록에 담았어요.'}`);
      $(`[data-place="${place.id}"] .real-choose`)?.focus({ preventScroll: true });
    });
    choose.classList.add('real-choose'); choose.dataset.selected = String(selected); choose.setAttribute('aria-label', `${place.name} ${selected ? '목록에서 빼기' : '목록에 담기'}`);
    article.append(top, node('p', 'real-description', place.description), address, facts, node('p', 'real-source', `${place.sourceLabel} · 공식 안내 확인 ${place.checkedAt}`), links, choose);
    return article;
  }));
  $('#real-picked').replaceChildren(...state.selected.map((id, index) => {
    const place = byId.get(id), row = node('li', 'real-picked-item');
    row.append(node('span', '', `${index + 1}. ${place.name}`));
    const actions = node('div', 'real-picked-actions');
    for (const [offset, label] of [[-1, '앞으로'], [1, '뒤로']]) {
      const move = button(label, () => {
        const next = index + offset;
        [state.selected[index], state.selected[next]] = [state.selected[next], state.selected[index]];
        save(); render(); announce(`${place.name} 순서를 바꿨어요.`);
        const row = $(`[data-picked="${id}"]`);
        (row?.querySelector(`[data-move="${offset}"]:not(:disabled)`) ?? row?.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
      });
      move.dataset.move = String(offset); move.disabled = index + offset < 0 || index + offset >= state.selected.length; move.setAttribute('aria-label', `${place.name} ${label}`); actions.append(move);
    }
    const remove = button('빼기', () => {
      state.selected = state.selected.filter(value => value !== id); save(); render(); announce(`${place.name}을(를) 목록에서 뺐어요.`);
      $('#real-list-title').focus({ preventScroll: true });
    }); remove.setAttribute('aria-label', `${place.name} 목록에서 빼기`); actions.append(remove); row.dataset.picked = id; row.append(actions); return row;
  }));
  $('#real-empty').hidden = state.selected.length > 0;
  $('#real-export').disabled = state.selected.length === 0;
  $('#real-list-count').textContent = `${state.selected.length}곳 담음`;
}
for (const item of CATEGORIES) {
  const choice = button(item.label, () => {
    state.interests = state.interests.includes(item.id) ? state.interests.filter(id => id !== item.id) : [...state.interests, item.id];
    save(); render(); announce($('#real-count').textContent);
  }); choice.id = 'real-interest-' + item.id; choice.setAttribute('aria-pressed', 'false'); $('#real-interests').append(choice);
}
$('#real-show-all').addEventListener('click', () => { state.interests = []; save(); render(); announce('모든 관심 분야를 다시 보여드려요. 담은 목록은 그대로예요.'); });
try {
  const restored = readRealState(localStorage.getItem(REAL_STORAGE_KEY));
  if (restored) { state = restored; consent.checked = true; status.textContent = '이 브라우저에 저장한 관심 분야와 장소를 불러왔어요.'; }
} catch { status.textContent = '브라우저 저장소를 읽을 수 없어요. 현재 화면에서만 사용합니다.'; }
consent.addEventListener('change', () => {
  if (consent.checked) save();
  else {
    try { localStorage.removeItem(REAL_STORAGE_KEY); status.textContent = '저장 기록을 지웠어요. 현재 화면의 선택은 유지됩니다.'; }
    catch { status.textContent = '저장 기록을 지우지 못했어요. 브라우저의 사이트 데이터에서 삭제해 주세요.'; }
  }
});
$('#real-reset').addEventListener('click', () => {
  state = normalizeRealState(); consent.checked = false;
  try { localStorage.removeItem(REAL_STORAGE_KEY); status.textContent = '실제 장소의 관심 분야와 방문 목록을 화면과 저장소에서 지웠어요.'; }
  catch { status.textContent = '화면은 초기화했지만 저장 기록은 지우지 못했어요. 브라우저 사이트 데이터를 확인해 주세요.'; }
  $('#real-memo-content').value = ''; render(); announce('관심 분야와 방문 목록을 초기화했어요.');
});
window.addEventListener('storage', event => {
  if ((event.key === REAL_STORAGE_KEY || event.key === null) && event.newValue === null) {
    consent.checked = false; status.textContent = '다른 탭에서 저장 기록을 지웠어요. 현재 선택은 유지하며 다시 저장하지 않습니다.';
  }
});
$('#real-export').addEventListener('click', () => { $('#real-memo-content').value = exportRealMemo(state); $('#real-memo-dialog').showModal(); });
$('#real-memo-close').addEventListener('click', () => $('#real-memo-dialog').close());
$('#real-memo-select').addEventListener('click', () => { $('#real-memo-content').focus(); $('#real-memo-content').select(); });
$('#real-memo-save').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([$('#real-memo-content').value], { type: 'text/plain;charset=utf-8' }));
  const link = node('a'); link.href = url; link.download = 'synk-jongno-places.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  $('#real-memo-status').textContent = '메모 파일 저장을 요청했어요. 브라우저의 다운로드를 확인해 주세요.';
});
function showMode(mode) {
  const real = mode === 'real';
  $('#real-guide').hidden = !real; $('#prototype-note').hidden = real; $('#planner').hidden = real; $('#simulation-storage').hidden = real;
  for (const value of ['real', 'simulation']) $('#mode-' + value).setAttribute('aria-pressed', String(mode === value));
  $('#mode-description').textContent = real ? '종로·안국·인사동·북촌의 실제 장소를 고르고, 나만의 방문 목록으로 가져가세요.' : '가상 장소와 가격으로 예산·숙소·음식 등 26가지 조건의 차이를 비교해 보세요.';
}
$('#mode-real').addEventListener('click', () => showMode('real'));
$('#mode-simulation').addEventListener('click', () => showMode('simulation'));
$('#real-checked').textContent = `공식 안내 확인 ${REAL_META.checkedAt} · 장소 ${REAL_PLACES.length}곳`;
showMode('real'); render();
