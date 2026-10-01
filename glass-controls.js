// The header dock is frosted glass. Where the browser can bend what lies behind an element
// (Chromium, through an SVG displacement map in backdrop-filter), the rim bends the page the way a
// thick glass edge does; elsewhere it stays plain frosted glass. The rim light follows the pointer only
// while the pointer is over the dock. Nothing moves on its own, and touch or reduced-motion users see
// the same still glass.
const NS='http://www.w3.org/2000/svg';
const bends=()=>!!navigator.userAgentData?.brands?.some(brand=>/Chromium/.test(brand.brand));

// Neutral grey means "no bend". Near the rim the glass shows what lies just outside it, pulled inward,
// strongest at the very edge and gone a band's width inside.
function rimMap(width,height,band,radius){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d'),image=context.createImageData(width,height),data=image.data;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const px=x+.5-width/2,py=y+.5-height/2,qx=Math.abs(px)-(width/2-radius),qy=Math.abs(py)-(height/2-radius);
  const ox=Math.max(qx,0),oy=Math.max(qy,0),outside=Math.hypot(ox,oy),inset=-(outside+Math.min(Math.max(qx,qy),0)-radius);
  let nx,ny;
  if(qx>0&&qy>0){nx=ox/outside;ny=oy/outside;}else if(qx>qy){nx=1;ny=0;}else{nx=0;ny=1;}
  nx*=Math.sign(px)||1;ny*=Math.sign(py)||1;
  const t=Math.max(0,Math.min(1,1-inset/band)),bend=inset<0?0:t*t,i=(y*width+x)*4;
  data[i]=128+nx*bend*127;data[i+1]=128+ny*bend*127;data[i+2]=128;data[i+3]=255;
 }
 context.putImageData(image,0,0);
 return canvas.toDataURL();
}

// The frost inside the rim fades in over a few pixels instead of starting at a hard line.
function frostMask(width,height,from,to,radius){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d'),image=context.createImageData(width,height),data=image.data;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const px=x+.5-width/2,py=y+.5-height/2,qx=Math.abs(px)-(width/2-radius),qy=Math.abs(py)-(height/2-radius);
  const inset=-(Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-radius);
  const t=Math.max(0,Math.min(1,(inset-from)/(to-from))),i=(y*width+x)*4;
  data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(t*t*(3-2*t)*255);
 }
 context.putImageData(image,0,0);
 return canvas.toDataURL();
}

// Both images depend only on the dock's size. Recent pairs are kept for the visit, so the next page (and Atlas, which
// shares this tab) uses it instead of drawing and encoding both again (2026-10-01, qa/perf-20261001).
const RIM_KEY='synk-dock-rim-v1';
function rimImages(width,height,radius){
 const size=width+'x'+height+'x'+radius;
 let kept=[];
 try{kept=JSON.parse(sessionStorage.getItem(RIM_KEY)||'[]');if(!Array.isArray(kept))kept=[];}catch{}
 const hit=kept.find(entry=>entry?.size===size&&String(entry.map).startsWith('data:image/png')&&String(entry.frost).startsWith('data:image/png'));
 if(hit)return hit;
 const made={size,map:rimMap(width,height,Math.min(14,radius*.5),radius),frost:frostMask(width,height,2,13,radius)};
 // Every page's dock has its own width (its own sections): the last eight sizes are kept.
 try{sessionStorage.setItem(RIM_KEY,JSON.stringify([made,...kept.filter(entry=>entry?.size!==size)].slice(0,8)));}catch{}
 return made;
}

// One pass: the page bent at the rim (displacement map), blurred inside it (Gaussian blur kept where the
// feathered frost mask is opaque), the frost laid over the bent rim.
function mountRim(dock){
 const svg=document.createElementNS(NS,'svg');
 svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
 svg.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
 svg.innerHTML='<filter id="synk-dock-rim" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'
  +'<feImage x="0" y="0" preserveAspectRatio="none" result="map"/>'
  +'<feDisplacementMap in="SourceGraphic" in2="map" scale="26" xChannelSelector="R" yChannelSelector="G" result="bent"/>'
  +'<feGaussianBlur in="SourceGraphic" stdDeviation="14" edgeMode="duplicate" result="blurred"/>'
  +'<feImage x="0" y="0" preserveAspectRatio="none" result="mask"/>'
  +'<feComposite in="blurred" in2="mask" operator="in" result="frost"/>'
  +'<feComposite in="frost" in2="bent" operator="over"/></filter>';
 document.body.append(svg);
 const [map,mask]=svg.querySelectorAll('feImage');
 let size='',on=false;
 const update=()=>{
  if(!on)return;
  const rect=dock.getBoundingClientRect(),width=Math.round(rect.width),height=Math.round(rect.height);
  // The dock is a capsule, or a rounded panel while its list is open.
  const radius=Math.min(parseFloat(getComputedStyle(dock).borderTopLeftRadius)||height/2,height/2,width/2);
  if(!width||!height||size===width+'x'+height+'x'+radius)return;
  size=width+'x'+height+'x'+radius;
  const images=rimImages(width,height,radius),frost=images.frost;
  for(const image of [map,mask]){image.setAttribute('width',width);image.setAttribute('height',height);}
  map.setAttribute('href',images.map);mask.setAttribute('href',frost);
  dock.style.setProperty('--dock-rim','url(#synk-dock-rim)');dock.style.setProperty('--dock-frost','url('+frost+')');dock.classList.add('has-rim');
 };
 new ResizeObserver(update).observe(dock);
 return {
  // Measured in the next frame, with that frame's layout, rather than right now while the page may still be
  // loading (a forced layout of the whole page, qa/perf-20261001). The ResizeObserver covers every later change.
  on(){if(on)return;on=true;size='';requestAnimationFrame(update);},
  off(){on=false;dock.classList.remove('has-rim');dock.style.removeProperty('--dock-rim');dock.style.removeProperty('--dock-frost');}
 };
}

export function initGlassControls(){
 const dock=document.querySelector('.site-header-wrap .header.bar');if(!dock)return;
 const fine=matchMedia('(hover: hover) and (pointer: fine)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const clear=matchMedia('(prefers-reduced-transparency: reduce)'),forced=matchMedia('(forced-colors: active)');
 // The colour under the dock follows its width.
 const wrap=dock.closest('.site-header-wrap');
 new ResizeObserver(()=>wrap?.style.setProperty('--dock-width',Math.round(dock.getBoundingClientRect().width)+'px')).observe(dock);
 if(bends()){
  // Plain glass while the system asks for less transparency or paints its own colours, bent glass again after.
  const rim=mountRim(dock),sync=()=>clear.matches||forced.matches?rim.off():rim.on();
  clear.addEventListener?.('change',sync);forced.addEventListener?.('change',sync);
  sync();
 }
 let frame=0,point=null;
 const reset=()=>{cancelAnimationFrame(frame);frame=0;point=null;dock.style.removeProperty('--glass-x');dock.style.removeProperty('--glass-y');};
 dock.addEventListener('pointermove',event=>{
  if(!fine.matches||reduced.matches||event.pointerType==='touch')return;
  point={x:event.clientX,y:event.clientY};
  if(frame)return;
  frame=requestAnimationFrame(()=>{
   frame=0;if(!point)return;
   const rect=dock.getBoundingClientRect();
   dock.style.setProperty('--glass-x',Math.max(4,Math.min(96,(point.x-rect.left)/rect.width*100)).toFixed(1)+'%');
   dock.style.setProperty('--glass-y',Math.max(0,Math.min(100,(point.y-rect.top)/rect.height*100)).toFixed(1)+'%');
  });
 },{passive:true});
 dock.addEventListener('pointerleave',reset);
 window.addEventListener('blur',reset);
 reduced.addEventListener('change',reset);
}
