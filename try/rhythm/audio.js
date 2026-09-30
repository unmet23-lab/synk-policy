// Original deterministic music. No third-party recordings, samples or services.
const SR=44100;
const frequency=m=>440*2**((m-69)/12);
const cache=new Map();
export async function renderTrack(track){
  if(cache.has(track.id))return cache.get(track.id);
  const beat=60/track.bpm,duration=track.bars*4*beat+2;
  const context=new OfflineAudioContext(2,Math.ceil(duration*SR),SR);
  const compressor=context.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=15;compressor.ratio.value=3;compressor.attack.value=.005;compressor.release.value=.13;
  const master=context.createGain();master.gain.value=.57;master.connect(compressor);compressor.connect(context.destination);
  const delay=context.createDelay(.8);delay.delayTime.value=beat*.75;
  const feedback=context.createGain();feedback.gain.value=.28;delay.connect(feedback);feedback.connect(delay);
  const wet=context.createGain();wet.gain.value=.20;delay.connect(wet);wet.connect(master);
  const noise=context.createBuffer(1,SR,SR);const data=noise.getChannelData(0);let seed=19;
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296)*2-1;}
  const chords=[[57,60,64,67],[53,57,60,64],[48,52,55,59],[55,59,62,67]].map(c=>c.map(n=>n+track.key));
  function tone(note,time,len,gain,type='sine',filter=5000,pan=0,echo=false){
    const osc=context.createOscillator(),g=context.createGain(),f=context.createBiquadFilter(),p=context.createStereoPanner();osc.type=type;osc.frequency.value=frequency(note);f.type='lowpass';f.frequency.value=filter;p.pan.value=pan;
    g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(gain,time+Math.min(.013,len/8));g.gain.exponentialRampToValueAtTime(.0001,time+len);
    osc.connect(f);f.connect(g);g.connect(p);p.connect(master);if(echo)p.connect(delay);osc.start(time);osc.stop(time+len+.02);
  }
  function kick(t,gain=.68){const o=context.createOscillator(),g=context.createGain();o.frequency.setValueAtTime(155,t);o.frequency.exponentialRampToValueAtTime(47,t+.12);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+.32);o.connect(g);g.connect(master);o.start(t);o.stop(t+.33);}
  function hiss(t,len,gain,cutoff,type){const s=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();s.buffer=noise;f.type=type;f.frequency.value=cutoff;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+len);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+len+.01);}
  for(let b=0;b<128;b++){
    const t=b*beat,section=Math.floor(b/32),bar=Math.floor(b/4),chord=chords[bar%4];
    const qWindow=track.questions.some((_,i)=>b>=24+i*24-10&&b<=24+i*24+1);
    const quiet=qWindow?.52:1,outro=b>=120?(128-b)/8:1;
    if(b>=4&&b<126){kick(t,.62*quiet*outro);if(b%2===1){hiss(t,.16,.22*quiet*outro,1200,'highpass');tone(50,t,.09,.035*quiet,'triangle',1500);}hiss(t+.5*beat,.055,.1*quiet*outro,7800,'highpass');if(section>0&&!qWindow)hiss(t+.75*beat,.035,.048,8600,'highpass');}
    if(b>=8&&b<124){tone(chord[0]-12,t+.02,beat*.64,.25*quiet*outro,'triangle',720);if(b%4===3&&!qWindow)tone(chord[0]-12,t+beat*.75,beat*.21,.14,'sine',500);}
    if(b%4===0){for(let j=0;j<chord.length;j++){tone(chord[j],t+.04,beat*3.9,.058*quiet*outro,'triangle',section===2?2400:1500,(j-1.5)*.3,true);tone(chord[j]+12,t+.07,beat*3.2,.013*quiet*outro,'sine',5000,(j-1.5)*.25);}}
    const motif=[0,2,1,3,2,1,3,2];
    if(b>=8&&b<120){const m=chord[motif[b%8]]+12;const sparkle=qWindow?.036:.105;tone(m,t,beat*.42,sparkle*outro,'sine',8000,b%2?.36:-.36,true);tone(m+12,t,.065,sparkle*.13,'sine',12000);if(section===2&&!qWindow)tone(chord[motif[(b+3)%8]]+12,t+beat*.5,beat*.23,.055,'triangle',6000,0,true);}
    if(b>=60&&b<64){hiss(t,beat*.2,.08*(b-59),4000,'highpass');hiss(t+beat*.5,beat*.1,.065*(b-59),4800,'highpass');}
    if(b===64){hiss(t,1.1,.11,7000,'highpass');tone(84+track.key,t,1.7,.08,'sine',10000,0,true);}
  }
  const rendered=await context.startRendering();cache.set(track.id,rendered);return rendered;
}

export class MusicPlayer{
  constructor(){this.context=null;this.source=null;this.origin=0;this.master=null;this.enabled=true;}
  async prepare(track){
    this.stop();this.context=new AudioContext({latencyHint:'interactive'});await this.context.resume();
    this.master=this.context.createGain();this.master.gain.value=this.enabled?.7:0;this.master.connect(this.context.destination);
    const buffer=await renderTrack(track);return buffer;
  }
  start(buffer,beat){
    this.origin=this.context.currentTime+4*beat+.12;this.source=this.context.createBufferSource();this.source.buffer=buffer;this.source.connect(this.master);this.source.start(this.origin);
    for(let i=0;i<4;i++)this.note(76,this.origin-(4-i)*beat,.13,.065);
  }
  get time(){return this.context?this.context.currentTime-this.origin:0;}
  get state(){return this.context?.state||'closed';}
  async pause(){if(this.context?.state==='running')await this.context.suspend();}
  async resume(){if(this.context?.state==='suspended')await this.context.resume();}
  setSound(enabled){this.enabled=enabled;if(this.master&&this.context&&this.context.state!=='closed')this.master.gain.setTargetAtTime(enabled?.7:0,this.context.currentTime,.02);}
  note(midi,time=this.context?.currentTime,len=.16,gain=.045){if(!this.context||this.context.state==='closed')return;const o=this.context.createOscillator(),g=this.context.createGain();o.type='sine';o.frequency.value=frequency(midi);g.gain.setValueAtTime(gain,time);g.gain.exponentialRampToValueAtTime(.0001,time+len);o.connect(g);g.connect(this.master);o.start(time);o.stop(time+len+.01);}
  hit(lane){this.note([72,76,79,81][lane]);}
  stop(){if(this.source){try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}if(this.context&&this.context.state!=='closed')this.context.close().catch(()=>{});this.context=null;this.master=null;}
}
