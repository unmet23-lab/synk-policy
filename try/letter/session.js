// The first draft is immutable once review starts. Self-checks are not a score.
export const createSession=()=>({stage:'story',guide:null,draft:'',initial:null,final:'',checks:[],hintsOpen:false,hint:null,hintMore:false});
export function updateDraft(state,value){
  if(state.draft!==value)state.checks=[];
  state.draft=value;
}
export function beginReview(state){
  if(!state.draft.trim())return false;
  if(state.initial===null)state.initial=state.draft;
  state.stage='review';
  return true;
}
export function finishLetter(state){
  if(!state.draft.trim())return false;
  state.final=state.draft;
  state.stage='done';
  return true;
}
