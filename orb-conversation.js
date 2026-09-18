// Local procedural light; no microphone, remote renderer, or recorded input.
function mountOrb(button){
 const canvas=button.querySelector('canvas'),surface=button.querySelector('.orb-surface');
 const motion=button.parentElement.querySelector('.orb-motion');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,powerPreference:'low-power'});
 if(!gl)return;
 const vertex='attribute vec2 position; varying vec2 uv; void main(){uv=position;gl_Position=vec4(position,0.,1.);}';
 const fragment=`precision highp float;
 varying vec2 uv; uniform float time; uniform vec2 pointer; uniform vec3 accent; uniform float energy;
 float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float fbm(vec3 p){float n=0.,a=.55;for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.03+vec3(1.7,9.2,2.8);a*=.48;}return n;}
 void main(){
   vec2 p=uv*1.19; p-=pointer*.025;
   float r=length(p), edge=1.-smoothstep(.985,1.005,r);
   if(r>1.025){gl_FragColor=vec4(0.);return;}
   float z=sqrt(max(0.,1.-dot(p,p))); vec3 n=normalize(vec3(p,z));
   float t=time*.12;
   vec3 pos=vec3(p,z*.8); pos.x+=pointer.x*.1;pos.y+=pointer.y*.1;
   float swirl=fbm(pos*2.6+vec3(t,-t*.6,t*.3));
   float clouds=fbm(pos*4.+swirl*2.+vec3(-t,t*.5,0));
   float arc=p.y+.43*sin(p.x*2.7+t)+.32*(clouds-.5);
   float ribbon=exp(-abs(arc)*7.);
   float filament=pow(.5+.5*sin(arc*110.+clouds*10.),8.)*ribbon;
   float inner=exp(-abs(p.x-.32*sin(p.y*3.-t*1.3)+.12*(swirl-.5))*14.);
   vec3 base=mix(vec3(.026,.038,.075),vec3(.15,.18,.27),clouds);
   vec3 tint=mix(vec3(.20,.38,.76),accent,.36);
   vec3 pearl=mix(vec3(.67,.85,.96),vec3(.86,.69,.83),sin(t+p.x*2.)*.5+.5);
   vec3 color=base+tint*ribbon*(.80+energy*.3)+pearl*filament*.32+vec3(.34,.38,.70)*inner*.35;
   float rim=pow(1.-z,3.);
   float light=max(0.,dot(n,normalize(vec3(-.6,.8,1.2))));
   color+=pearl*pow(light,28.)*.55+pearl*rim*.43;
   color+=vec3(.70,.85,.95)*pow(max(0.,dot(n,normalize(vec3(.7,-.8,.4)))),20.)*.26;
   float veins=pow(noise(pos*95.+vec3(t)),19.)*.14;
   color+=veins*ribbon;
   color*=.68+.32*z;
   gl_FragColor=vec4(color,edge);
 }`;
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);throw Error('Orb shader unavailable');}return s;}
 let program;
 try{program=gl.createProgram();const v=shader(gl.VERTEX_SHADER,vertex),f=shader(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Orb unavailable');}catch{return;}
 gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 const u={time:gl.getUniformLocation(program,'time'),pointer:gl.getUniformLocation(program,'pointer'),accent:gl.getUniformLocation(program,'accent'),energy:gl.getUniformLocation(program,'energy')};
 const palettes={synk:[.48,.38,.72],lab:[.86,.27,.21],shift:[.20,.40,.86],pulse:[.65,.19,.48],path:[.30,.55,.43]};
 gl.uniform3fv(u.accent,palettes[document.body.dataset.site]||palettes.synk);
 let frame=0,visible=false,paused=false,last=0,clock=0,x=0,y=0,tx=0,ty=0,energy=0,targetEnergy=0,lost=false;
 function draw(now){
  frame=0;if(lost)return;
  const moving=visible&&!document.hidden&&!paused&&!reduced.matches;
  if(moving&&last)clock+=Math.min(now-last,70)/1000;
  last=now;x+=(tx-x)*.07;y+=(ty-y)*.07;energy+=(targetEnergy-energy)*.08;
  const size=Math.min(640,Math.ceil(button.clientWidth*Math.min(devicePixelRatio||1,2)));
  if(canvas.width!==size){canvas.width=canvas.height=size;gl.viewport(0,0,size,size);}
  gl.uniform1f(u.time,clock);gl.uniform2f(u.pointer,x,y);gl.uniform1f(u.energy,energy);gl.drawArrays(gl.TRIANGLES,0,6);
  if(moving)frame=requestAnimationFrame(draw);
 }
 function wake(){if(!frame&&!lost)frame=requestAnimationFrame(draw);}
 const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;last=0;wake();},{rootMargin:'60px'});observer.observe(button);
 const resize=new ResizeObserver(wake);resize.observe(button);
 button.addEventListener('pointermove',e=>{if(reduced.matches)return;const r=button.getBoundingClientRect();tx=(e.clientX-r.left)/r.width*2-1;ty=1-(e.clientY-r.top)/r.height*2;targetEnergy=.7;wake();});
 button.addEventListener('pointerleave',()=>{tx=ty=targetEnergy=0;wake();});
 document.addEventListener('synk:orb-state',e=>{targetEnergy=e.detail==='busy'?1:e.detail==='typing'?.5:0;wake();});
 motion.hidden=false;motion.addEventListener('click',()=>{paused=!paused;motion.setAttribute('aria-pressed',String(paused));motion.setAttribute('aria-label',paused?'구체 움직임 재생':'구체 움직임 멈추기');motion.querySelector('path').setAttribute('d',paused?'M9 6l9 6-9 6Z':'M9 7v10M15 7v10');last=0;wake();});
 document.addEventListener('visibilitychange',()=>{last=0;wake();});reduced.addEventListener('change',()=>{last=0;wake();});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(frame);surface.classList.remove('orb-rendered');motion.hidden=true;});
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;last=0;});
 window.addEventListener('pageshow',wake);
 surface.classList.add('orb-rendered');wake();
}

export function initOrbConversation(){
 const root=document.querySelector('.orb-help');if(!root)return;
 const launch=root.querySelector('.orb-launch'),workspace=root.querySelector('.orb-workspace'),close=root.querySelector('.orb-close');
 const panels=[root.querySelector('#questions'),root.querySelector('#contact-web')],switches=[...root.querySelectorAll('[data-orb-mode]')];
 const input=root.querySelector('#question');
 root.querySelectorAll('.suggestions button').forEach((button,index)=>{button.style.setProperty('--faq-order',index);});
 function open(mode,{focus=false,remember=false}={}){
  workspace.hidden=false;root.classList.add('is-open');root.dataset.mode=mode;launch.setAttribute('aria-expanded','true');launch.setAttribute('aria-label','질문 입력창으로 이동');close.hidden=false;
  panels.forEach(panel=>panel.hidden=panel.id!==mode);switches.forEach(button=>button.hidden=button.dataset.orbMode===mode);
  if(remember){const url=new URL(location.href);url.hash=mode==='questions'?'questions':'contact-web';history.replaceState(null,'',url);}
  if(focus){if(mode==='questions')input.focus({preventScroll:true});else{const title=root.querySelector('#enquiry-title');title.tabIndex=-1;title.focus({preventScroll:true});}root.querySelector('.orb-stage').scrollIntoView({block:'start',behavior:'instant'});}
 }
 function collapse(){workspace.hidden=true;root.classList.remove('is-open');launch.setAttribute('aria-expanded','false');launch.setAttribute('aria-label','무엇이든 물어보세요. 질문창 열기');switches.forEach(button=>button.hidden=button.dataset.orbMode==='questions');const url=new URL(location.href);url.hash='';history.replaceState(null,'',url);launch.focus({preventScroll:true});}
 function modeForHash(hash){if(['#questions','#question'].includes(hash))return 'questions';if(hash.startsWith('#contact-'))return 'contact-web';return null;}
 launch.hidden=false;launch.addEventListener('click',()=>open('questions',{focus:true,remember:true}));close.addEventListener('click',collapse);
 switches.forEach(button=>button.addEventListener('click',()=>open(button.dataset.orbMode,{focus:true,remember:true})));
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&root.classList.contains('is-open')&&!document.querySelector('dialog[open]')){e.preventDefault();collapse();}});
 document.addEventListener('synk:show-answers',()=>open('questions'));
 input.addEventListener('input',()=>document.dispatchEvent(new CustomEvent('synk:orb-state',{detail:input.value?'typing':'idle'})));
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;const url=new URL(link.href,location.href);if(url.origin===location.origin&&url.pathname===location.pathname){const mode=modeForHash(url.hash);if(mode)open(mode);} },true);
 window.addEventListener('hashchange',()=>{const mode=modeForHash(location.hash);if(mode)open(mode);});
 root.classList.add('orb-ready');workspace.hidden=true;const initial=modeForHash(location.hash);
 if(initial){
  open(initial);let interacted=false;
  root.addEventListener('pointerdown',()=>interacted=true,{once:true});root.addEventListener('keydown',()=>interacted=true,{once:true});
  const align=()=>requestAnimationFrame(()=>{if(!interacted)root.querySelector('.orb-stage').scrollIntoView({block:'start',behavior:'instant'});});
  if(document.readyState==='complete')align();else window.addEventListener('load',align,{once:true});
  root.querySelector('.orb-stage').addEventListener('transitionend',event=>{if(event.propertyName==='min-height')align();},{once:true});
 }
 mountOrb(launch);
}
