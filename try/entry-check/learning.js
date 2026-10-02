// 게임은 원고와 판정을 맡고, 아틀라스는 공통 기록과 다음 연습의 선택을 맡는다.
// 손님 한 명 = 읽기 문항 하나. 통과 또는 규칙 하나를 고르는 응답이라 형식은 single-choice다(보기 = 통과 + 규칙 3~4개).
import { VENUES } from './content.js';
import { SKILL_LABEL } from './content.js';

export const GAME_ID = 'entry-check';
export const FORMAT = 'single-choice';

export function caseMetadata(c) {
  const key = `${GAME_ID}.${c.id}.v1`;
  return { id: `${GAME_ID}.${c.id}`, itemKey: key, familyKey: key, skillId: c.skill, difficulty: c.difficulty,
    modality: 'reading', responseFormat: FORMAT, audioRequired: false, confounded: false };
}

export function caseCandidates(cases) {
  return cases.map((c) => {
    const m = caseMetadata(c);
    return { id: m.id, caseId: c.id, skillIds: [m.skillId], difficulty: m.difficulty, modality: m.modality,
      responseFormat: m.responseFormat, itemKey: m.itemKey };
  });
}

/** 한 근무지 안에서 필요 순서. 아틀라스를 못 쓰면 null(원고 순서로 진행). */
export function rankCases(coach, cases) {
  if (!coach) return null;
  try {
    const r = coach.recommend(caseCandidates(cases), { audioAvailable: true });
    if (r.status !== 'ready') return null;
    return { order: [r.selected, ...r.alternatives].map((x) => x.caseId), reason: r.reason, skillId: r.focusSkillId, state: r.state };
  } catch { return null; }
}

/**
 * 열린 근무지 전체에서 지금 가장 필요한 학습 항목을 받고, 그 항목의 손님이 가장 많은 근무지를 고른다.
 * 같으면 아틀라스가 1순위로 고른 손님의 근무지, 그다음 앞 일차. 이유 문구는 아틀라스(Vellum)의 것이다.
 */
export function recommendVenue(coach, venueIds) {
  const venues = VENUES.filter((v) => venueIds.includes(v.id));
  if (!coach || !venues.length) return null;
  try {
    const cands = venues.flatMap((v) => caseCandidates(v.cases).map((c) => ({ ...c, venueId: v.id })));
    const r = coach.recommend(cands, { audioAvailable: true });
    if (r.status !== 'ready') return null;
    const skill = r.focusSkillId || r.selected.skillIds[0];
    const count = (v) => v.cases.filter((c) => c.skill === skill).length;
    const best = [...venues].sort((a, b) => count(b) - count(a) || (b.id === r.selected.venueId) - (a.id === r.selected.venueId) || a.day - b.day)[0];
    return { venueId: best.id, reason: r.reason, skillId: skill, state: r.state, count: count(best) };
  } catch { return null; }
}

/** 도장(응답)을 아틀라스 답안으로. 안내문은 늘 보이는 읽기 지문이라 도움으로 세지 않는다(레이싱 읽기 관례). */
export const answerPayload = (correct) => ({ correct, assessable: true });

const STATUS = {
  unseen: { text: '아직 기록이 적어요', tone: 'quiet' },
  checking: { text: '확인하는 중이에요', tone: 'quiet' },
  practice: { text: '조금 더 연습하면 좋아요', tone: 'focus' },
  supported: { text: '도움과 함께 해냈어요', tone: 'quiet' },
  'recent-independent': { text: '최근 혼자 해냈어요', tone: 'good' },
  review: { text: '다시 볼 때예요', tone: 'focus' },
};
const PRIORITY = { practice: 6, review: 5, supported: 4, checking: 3, unseen: 2, 'recent-independent': 1 };

/**
 * 공통 기록 요약에서 이 게임이 연습하는 세 학습 항목의 상태를 뽑는다.
 * 같은 형식(single-choice)·읽기 기록만 본다. 다른 형식의 정답률을 섞지 않는다.
 */
export function skillReport(summary) {
  if (!summary?.skills) return [];
  return Object.keys(SKILL_LABEL).map((id) => {
    const s = summary.skills.find((x) => x.id === id);
    const buckets = s ? [1, 2, 3].map((d) => s.levels?.[d]?.formats?.[FORMAT]).filter((f) => f && (f.lastAt || f.assisted)) : [];
    const top = buckets.sort((a, b) => (PRIORITY[b.status] || 0) - (PRIORITY[a.status] || 0))[0];
    const status = top?.status || 'unseen';
    const n = buckets.reduce((sum, f) => sum + (f.n || 0), 0);
    const correct = buckets.reduce((sum, f) => sum + (f.correct || 0), 0);
    return { id, label: SKILL_LABEL[id], status, ...STATUS[status], n, correct };
  });
}
