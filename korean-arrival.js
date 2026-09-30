(() => {
  const mode=new URLSearchParams(location.search).get('entrance');
  if(!['arrival','both'].includes(mode)||location.hash||!/^\/(?:en\/?)?$/.test(location.pathname))return;
  const entry=document.querySelector('[data-cosmic-entry]');
  const target=entry?.querySelector('[data-cosmic-planet]');
  if(!entry||!target)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const forced=matchMedia('(forced-colors: active)');
  if(reduced.matches||forced.matches||!Element.prototype.animate)return;

  let finished=false;
  let watchdog;
  const animations=[];
  const listeners=[];
  const overlay=document.createElement('div');
  overlay.className='korean-arrival-overlay';
  overlay.setAttribute('aria-hidden','true');
  const backdrop=document.createElement('div');
  backdrop.className='korean-arrival-backdrop';
  const planet=document.createElement('div');
  planet.className='korean-arrival-planet';
  overlay.append(backdrop,planet);
  entry.append(overlay);

  // A missing stylesheet must leave the normal entrance fully usable.
  if(getComputedStyle(overlay).position!=='fixed'){overlay.remove();return;}
  entry.dataset.koreanArrival='loading';

  const cleanup=()=>{
    if(finished)return;
    finished=true;
    clearTimeout(watchdog);
    observer.disconnect();
    listeners.forEach(([element,type,listener,options])=>element.removeEventListener(type,listener,options));
    animations.forEach(animation=>animation.cancel());
    delete entry.dataset.koreanArrival;
    overlay.remove();
  };
  const listen=(element,type,listener=cleanup,options)=>{
    element.addEventListener(type,listener,options);
    listeners.push([element,type,listener,options]);
  };
  const observer=new MutationObserver(()=>{
    if(document.documentElement.dataset.entryView==='company'||document.documentElement.dataset.cosmicAtlas==='active')cleanup();
  });
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-entry-view','data-cosmic-atlas']});
  listen(entry,'synk:entry-depart');
  listen(entry,'pointerdown',cleanup,{capture:true});
  listen(entry,'click',cleanup,{capture:true});
  listen(entry,'focusin');
  listen(document,'keydown',event=>{if(!['Shift','Control','Alt','Meta'].includes(event.key))cleanup();},{capture:true});
  listen(window,'wheel',cleanup,{passive:true});
  listen(window,'touchmove',cleanup,{passive:true});
  listen(window,'resize');
  listen(window,'hashchange');
  listen(window,'popstate');
  listen(window,'pagehide');
  listen(document,'synk:company-view');
  listen(reduced,'change');
  listen(forced,'change');
  watchdog=setTimeout(cleanup,5200);

  const decode=image=>image.decode?image.decode():new Promise((resolve,reject)=>{
    if(image.complete){image.naturalWidth?resolve():reject(new Error('Image unavailable'));return;}
    image.addEventListener('load',resolve,{once:true});
    image.addEventListener('error',reject,{once:true});
  });
  const animate=(element,frames,options)=>{
    if(!element)return null;
    const animation=element.animate(frames,{fill:'both',...options});
    animations.push(animation);
    return animation;
  };

  const snapshotPlanet=source=>{
    const copy=source.cloneNode(true);
    const originals=[source,...source.querySelectorAll('*')];
    const copies=[copy,...copy.querySelectorAll('*')];
    originals.forEach((node,index)=>{
      const style=getComputedStyle(node);
      for(const name of style)copies[index].style.setProperty(name,style.getPropertyValue(name));
      copies[index].style.setProperty('animation','none');
      copies[index].style.setProperty('transition','none');
      copies[index].removeAttribute('id');
      copies[index].removeAttribute('data-cosmic-planet');
      if(node.tagName==='CANVAS'){
        copies[index].width=node.width;
        copies[index].height=node.height;
        const context=copies[index].getContext('2d');
        if(context){context.imageSmoothingEnabled=false;context.drawImage(node,0,0);}
      }
    });
    Object.assign(copy.style,{position:'absolute',inset:'0',width:'100%',height:'100%',margin:'0',transform:'none',opacity:'1',visibility:'visible'});
    return copy;
  };

  // Both CSS-only suns and layered sun/moon artwork use the same arrival.
  Promise.all([...Array.from(target.querySelectorAll('img'),decode),document.fonts?.ready||Promise.resolve()]).then(()=>{
    if(finished)return;
    const rect=target.getBoundingClientRect();
    if(!rect.width||!rect.height||location.hash){cleanup();return;}
    const width=innerWidth;
    const height=innerHeight;
    const size=Math.min(1360,Math.max(width<760?490:760,Math.min(width*.9,height*1.2)));
    const initialX=(width-size)/2;
    const initialY=height*.52-size*.5;
    planet.style.width=rect.width+'px';
    planet.style.height=rect.height+'px';
    planet.append(snapshotPlanet(target));
    const move=(x,y,scale)=>`translate3d(${x}px,${y}px,0) scale(${scale})`;
    entry.dataset.koreanArrival='playing';
    const travel=animate(planet,[
      {transform:move(initialX,initialY,size/rect.width),offset:0},
      {transform:move(initialX,initialY,size/rect.width),offset:.08},
      {transform:move(rect.left,rect.top,1),offset:1}
    ],{duration:2800,easing:'cubic-bezier(.22,.72,.16,1)'});
    animate(backdrop,[{opacity:1,offset:0},{opacity:1,offset:.12},{opacity:.58,offset:.46},{opacity:0,offset:1}],{duration:2350,easing:'ease-in-out'});
    animate(entry.querySelector('.korean-architecture'),[
      {opacity:0,transform:'translate3d(0,24px,0)'},
      {opacity:1,transform:'translate3d(0,0,0)'}
    ],{delay:500,duration:1900,easing:'cubic-bezier(.22,.72,.16,1)'});
    [['.cosmic-wordmark',1450],['.cosmic-actions',1700]].forEach(([selector,delay])=>{
      animate(entry.querySelector(selector),[{opacity:0,transform:'translate3d(0,8px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{delay,duration:650,easing:'ease-out'});
    });
    travel.finished.then(cleanup,cleanup);
  }).catch(cleanup);
})();
