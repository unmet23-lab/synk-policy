// Shared web/PC selections. No URLs, app permissions, or private product contents.
export const PLATFORM_APP_IDS = Object.freeze(['world','messenger','teacher','path','pulse','partners','care','fortune','rehearsal','family-album']);
export const PLATFORM_NOTE_LIMIT = 60;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const invalid = () => { throw Object.assign(new TypeError('플랫폼 기록 형식을 확인해 주세요.'), { code:'INVALID_PERSONAL_STATE' }); };
const noteLimit = () => { throw Object.assign(new Error('메모는 최대 '+PLATFORM_NOTE_LIMIT+'개까지 보관할 수 있어요. 필요 없는 메모를 삭제한 뒤 다시 시도해 주세요.'), { code:'NOTE_LIMIT' }); };
const exact = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key)) && keys.every(key => Object.hasOwn(value,key));
const stamp = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
const text = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value);
const ids = value => Array.isArray(value) && value.length <= PLATFORM_APP_IDS.length && new Set(value).size === value.length && value.every(id => PLATFORM_APP_IDS.includes(id));
const note = row => exact(row,['id','appId','title','done','createdAt']) && text(row.id,80) && /^[a-zA-Z0-9-]+$/.test(row.id) && PLATFORM_APP_IDS.includes(row.appId) && text(row.title,240) && typeof row.done === 'boolean' && stamp(row.createdAt);
export function emptyPlatformLibrary() { return {version:1,consent:false,favorites:[],recent:[],rememberRecent:true,notes:[]}; }
export function validatePlatformLibrary(value) {
  if (!exact(value,['version','consent','favorites','recent','rememberRecent','notes']) || value.version !== 1 || typeof value.consent !== 'boolean' || !ids(value.favorites) || typeof value.rememberRecent !== 'boolean' || !Array.isArray(value.recent) || value.recent.length > PLATFORM_APP_IDS.length || !Array.isArray(value.notes) || value.notes.length > PLATFORM_NOTE_LIMIT) invalid();
  if ((!value.consent && (value.favorites.length || value.recent.length || value.notes.length)) || (!value.rememberRecent && value.recent.length)) invalid();
  const seen = new Set();
  for (const row of value.recent) { if (!exact(row,['id','at','mode']) || !PLATFORM_APP_IDS.includes(row.id) || !stamp(row.at) || !['web','client'].includes(row.mode) || seen.has(row.id)) invalid(); seen.add(row.id); }
  seen.clear();
  for (const row of value.notes) { if (!note(row) || seen.has(row.id)) invalid(); seen.add(row.id); }
  return structuredClone(value);
}
export function updatePlatformLibrary(value, action, now = Date.now()) {
  const next = validatePlatformLibrary(value);
  if (action.type === 'consent') { if (action.value !== true) return emptyPlatformLibrary(); next.consent=true; return next; }
  if (!next.consent) throw new Error('계정에 저장할 항목을 확인하고 연결을 켜 주세요.');
  if (['favorite','launch','note','edit-note'].includes(action.type) && !PLATFORM_APP_IDS.includes(action.id)) invalid();
  if (action.type === 'favorite') next.favorites = next.favorites.includes(action.id) ? next.favorites.filter(id=>id!==action.id) : [...next.favorites,action.id];
  else if (action.type === 'launch' && next.rememberRecent) next.recent=[{id:action.id,at:now,mode:action.mode},...next.recent.filter(row=>row.id!==action.id)];
  else if (action.type === 'remember') { next.rememberRecent=action.value; if (!action.value) next.recent=[]; }
  else if (action.type === 'clear-recent') next.recent=[];
  else if (action.type === 'note') { if(next.notes.length>=PLATFORM_NOTE_LIMIT)noteLimit();next.notes.unshift({id:globalThis.crypto.randomUUID(),appId:action.id,title:String(action.title||'').trim(),done:false,createdAt:now}); }
  else if (action.type === 'edit-note') { const row=next.notes.find(row=>row.id===action.noteId);if(!row||!text(action.title,240))invalid();row.title=action.title.trim();row.appId=action.id; }
  else if (action.type === 'restore-note') { if(!note(action.note)||!Number.isSafeInteger(action.index)||action.index<0||action.index>next.notes.length||next.notes.some(row=>row.id===action.note.id))invalid();if(next.notes.length>=PLATFORM_NOTE_LIMIT)noteLimit();next.notes.splice(action.index,0,structuredClone(action.note)); }
  else if (action.type === 'toggle-note') { const row=next.notes.find(row=>row.id===action.noteId);if(!row)invalid();row.done=!row.done; }
  else if (action.type === 'remove-note') next.notes=next.notes.filter(row=>row.id!==action.noteId);
  else if (!['favorite','launch','remember','clear-recent'].includes(action.type)) invalid();
  return validatePlatformLibrary(next);
}
