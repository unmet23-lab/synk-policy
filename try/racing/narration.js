export class Narrator {
  constructor({getContext,onActive,onUnavailable}){this.getContext=getContext;this.onActive=onActive;this.onUnavailable=onUnavailable;this.cache=new Map();this.queue=[];this.token=0;this.playing=false;this.activeKind=null;this.history=[];}
  async prepare(ids){await Promise.all([...new Set(ids)].map(id=>this.load(id).catch(()=>null)));}
  async load(id){
    if(!this.cache.has(id)){
      if(this.cache.size>=48)this.cache.delete(this.cache.keys().next().value);
      this.cache.set(id,fetch(`./assets/narration/${id}.mp3`).then(r=>{if(!r.ok)throw Error('Narration missing: '+id);return r.arrayBuffer();}).catch(error=>{this.cache.delete(id);throw error;}));
    }
    return this.cache.get(id);
  }
  speak(ids,text,kind='comment',{interrupt=false}={}){
    if(interrupt)this.cancel();
    this.queue.push({ids,text,kind});if(!this.playing)this.drain();
  }
  async drain(){
    const ticket=++this.token;this.playing=true;this.onActive(true);
    while(this.queue.length&&ticket===this.token){
      const item=this.queue.shift();this.activeKind=item.kind;
      try {
        for(const id of item.ids){
          const context=this.getContext();if(!context)throw Error('Audio context unavailable');
          const bytes=await this.load(id);const buffer=await context.decodeAudioData(bytes.slice(0));
          if(ticket!==this.token)return;
          await new Promise(resolve=>{
            const source=context.createBufferSource(),gain=context.createGain(),entry={id,kind:item.kind,at:Date.now(),completed:false};source.buffer=buffer;gain.gain.value=.95;source.connect(gain);gain.connect(context.destination);
            source.onended=()=>{entry.completed=ticket===this.token;entry.endedAt=Date.now();source.disconnect();gain.disconnect();resolve();};this.current=source;source.start();this.history.push(entry);if(this.history.length>80)this.history.shift();
          });
          if(ticket!==this.token)return;
        }
      } catch {
        if(ticket!==this.token)return;
        await this.fallback(item.text,ticket);
      }
    }
    if(ticket===this.token){this.playing=false;this.activeKind=null;this.onActive(false);}
  }
  fallback(text,ticket){
    const candidates=window.speechSynthesis?.getVoices().filter(v=>v.lang.toLowerCase().startsWith('ko'))||[];
    const voice=candidates.find(v=>/natural|enhanced|premium/i.test(v.name))||candidates[0];
    if(!voice){this.onUnavailable();return Promise.resolve();}
    return new Promise(resolve=>{if(ticket!==this.token){resolve();return;}const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.voice=voice;u.rate=.9;u.onend=u.onerror=resolve;speechSynthesis.speak(u);});
  }
  cancel(){this.token++;this.queue=[];try{this.current?.stop();}catch{}this.current=null;window.speechSynthesis?.cancel();this.playing=false;this.activeKind=null;this.onActive(false);}
  snapshot(){return {playing:this.playing,kind:this.activeKind,queued:this.queue.length,played:[...this.history]};}
}
