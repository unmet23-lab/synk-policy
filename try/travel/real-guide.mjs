import { REAL_PLACES, REAL_META } from './real-places.mjs';

export const REAL_STORAGE_KEY = 'synk-path-real-places-v1';
export const CATEGORIES = Object.freeze([
  { id: 'food', label: '한식 한 끼' },
  { id: 'tea', label: '차와 카페' },
  { id: 'culture', label: '전시와 문화' },
  { id: 'stay', label: '하룻밤 숙소' },
]);
const categories = new Set(CATEGORIES.map(item => item.id));
const places = new Map(REAL_PLACES.map(item => [item.id, item]));
export function normalizeRealState(input = {}) {
  return {
    version: 1,
    interests: [...new Set(Array.isArray(input.interests) ? input.interests.filter(id => categories.has(id)) : [])],
    selected: [...new Set(Array.isArray(input.selected) ? input.selected.filter(id => places.has(id)) : [])],
  };
}
export function findRealPlaces(input = {}) {
  const { interests } = normalizeRealState(input);
  return REAL_PLACES.filter(item => !interests.length || interests.includes(item.category));
}
export function readRealState(raw) {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.version === 1 && parsed.consent === true ? normalizeRealState(parsed) : null;
  } catch { return null; }
}
export function serializeRealState(state) {
  return JSON.stringify({ ...normalizeRealState(state), consent: true });
}
export function mapLink(place) {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', `${place.name} ${place.address}`);
  return url.href;
}
export function exportRealMemo(input) {
  const state = normalizeRealState(input);
  const chosen = state.selected.map(id => places.get(id));
  return [
    'SYNK PATH · 종로에서 고른 장소',
    `공식 안내 확인일: ${REAL_META.checkedAt}`,
    '직접 담은 순서의 방문 후보입니다. 이동 경로·시간·총예산이나 예약을 확정한 일정이 아닙니다.',
    '영업·휴관·메뉴 가격·객실 요금은 방문일에 공식 안내에서 다시 확인해 주세요.',
    '',
    `관심 분야: ${CATEGORIES.filter(item => state.interests.includes(item.id)).map(item => item.label).join(', ') || '전체 둘러보기'}`,
    '',
    ...chosen.flatMap((place, index) => [
      `${index + 1}. ${place.name}`, place.description, `주소: ${place.address}`,
      `비용: ${place.costNote}`, `방문 전 확인: ${place.visitNote}`,
      `공식 안내 (${place.sourceLabel}): ${place.sourceUrl}`, `지도 검색: ${mapLink(place)}`, '',
    ]),
    '이 목록은 공식 안내를 확인해 모은 일부 후보이며 업체 제휴·예약·실시간 영업 확인을 뜻하지 않습니다.',
  ].join('\n');
}
