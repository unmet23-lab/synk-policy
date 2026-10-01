// Real SYNK Suno recordings. Oscillators are only countdown and key feedback.
const cache=new Map();
const frequency=m=>440*2**((m-69)/12);
export async function loadRecording(track,context,signal){
 if(!track.audioUrl)throw new Error('이 곡의 음원 파일을 찾지 못했어요.');
 const key=track.audioUrl+'@'+context.sampleRate;
 if(cache.has(key))return cache.get(key);
 const response=await fetch(track.audioUrl,{signal});
 if(!response.ok)throw new Error('곡을 불러오지 못했어요. 연결을 확인하고 다시 시작해 주세요.');
 const bytes=await response.arrayBuffer();if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 const buffer=await context.decodeAudioData(bytes);
 if(!Number.isFinite(buffer.duration)||Math.abs(buffer.duration-track.duration)>.15)throw new Error('음원과 노트의 길이가 달라요. 새로고침한 뒤 다시 시작해 주세요.');
 cache.clear();cache.set(key,buffer);return buffer;
}
export class MusicPlayer{
 constructor(){this.context=null;this.source=null;this.origin=0;this.master=null;this.enabled=true;this.analyser=null;this.recording=null;this.abort=null;}
 async prepare(track){
  this.stop();const context=new AudioContext({latencyHint:'interactive'});this.context=context;this.abort=new AbortController();await context.resume();
  this.master=context.createGain();this.master.gain.value=this.enabled?.7:0;this.analyser=context.createAnalyser();this.analyser.fftSize=2048;
  this.master.connect(this.analyser);this.analyser.connect(context.destination);
  const buffer=await loadRecording(track,context,this.abort.signal);
  if(this.context!==context||context.state==='closed')throw new DOMException('Cancelled','AbortError');
  this.recording={title:track.title,sourceId:track.sourceId,url:track.audioUrl,duration:buffer.duration,sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels};return buffer;
 }
 start(buffer,beat){
  this.origin=this.context.currentTime+4*beat+.12;this.source=this.context.createBufferSource();this.source.buffer=buffer;this.source.loop=false;this.source.connect(this.master);this.source.start(this.origin);
  for(let i=0;i<4;i++)this.note(76,this.origin-(4-i)*beat,.13,.045);
 }
 get time(){return this.context?this.context.currentTime-this.origin:0;}
 get state(){return this.context?.state||'closed';}
 get signalLevel(){if(!this.analyser)return 0;const data=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length);}
 async pause(){if(this.context?.state==='running')await this.context.suspend();}
 async resume(){if(this.context?.state==='suspended')await this.context.resume();}
 setSound(enabled){this.enabled=enabled;if(this.master&&this.context&&this.context.state!=='closed')this.master.gain.setTargetAtTime(enabled?.7:0,this.context.currentTime,.02);}
 note(midi,time=this.context?.currentTime,len=.16,gain=.035){if(!this.context||this.context.state==='closed')return;const o=this.context.createOscillator(),g=this.context.createGain();o.type='sine';o.frequency.value=frequency(midi);g.gain.setValueAtTime(gain,time);g.gain.exponentialRampToValueAtTime(.0001,time+len);o.connect(g);g.connect(this.master);o.start(time);o.stop(time+len+.01);}
 hit(lane){this.note([72,76,79,81][lane]);}
 stop(){this.abort?.abort();this.abort=null;if(this.source){try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}if(this.context&&this.context.state!=='closed')this.context.close().catch(()=>{});this.context=null;this.master=null;this.analyser=null;this.recording=null;}
}
