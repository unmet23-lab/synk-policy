(() => {
  const root=document.documentElement;
  if(!root.hasAttribute('data-atlas-arrival'))return;
  const overlay=document.querySelector('.atlas-arrival');
  const canvas=document.querySelector('#constellation');
  const cleanup=()=>{root.removeAttribute('data-atlas-arrival');overlay?.remove();};
  if(!overlay||!canvas||matchMedia('(prefers-reduced-motion: reduce)').matches||matchMedia('(forced-colors: active)').matches){cleanup();return;}
  let started=false;
  const reveal=()=>{
    if(started)return;
    started=true;
    const rect=canvas.getBoundingClientRect();
    const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
    const radius=rect.width<520?clamp(rect.width*.125,39,50):clamp(Math.min(rect.width,rect.height)*.132,68,92);
    const size=radius*2;
    const x=rect.left+rect.width*.5-radius;
    const y=rect.top+rect.height*.493-radius;
    const initialX=parseFloat(root.style.getPropertyValue('--arrival-x'))||x;
    const initialY=parseFloat(root.style.getPropertyValue('--arrival-y'))||y;
    const initialSize=parseFloat(root.style.getPropertyValue('--arrival-size'))||size;
    overlay.style.setProperty('--arrival-dx',`${x-initialX}px`);
    overlay.style.setProperty('--arrival-dy',`${y-initialY}px`);
    overlay.style.setProperty('--arrival-scale',String(size/initialSize));
    root.dataset.atlasArrival='revealing';
    setTimeout(cleanup,480);
  };
  const revealWhenReady=()=>{
    if(started)return;
    let rendered=false;
    try{rendered=(window.atlasPreview?.getSummary?.()?.frames||0)>=2;}catch{}
    if(rendered&&document.fonts.status==='loaded')requestAnimationFrame(reveal);
    else requestAnimationFrame(revealWhenReady);
  };
  requestAnimationFrame(revealWhenReady);
  setTimeout(reveal,1500);
})();
