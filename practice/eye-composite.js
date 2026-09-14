/** Eye registration from LoomSceneRenderer.load, with a local felt collar,
 * high-resolution source art and a boundary-matched color field. The field changes
 * color offset, not texture detail. Alpha/outside-mask bytes stay with the base.
 */
export function composeEyeOnly(base, closed, manifest) {
  const width=base.naturalWidth, height=base.naturalHeight;
  const original=document.createElement('canvas');original.width=width;original.height=height;
  const ctx=original.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(base,0,0);
  const open=ctx.getImageData(0,0,width,height);
  const finished=new ImageData(new Uint8ClampedArray(open.data),width,height);
  const registered=document.createElement('canvas');registered.width=width;registered.height=height;
  const sourceContext=registered.getContext('2d',{willReadFrequently:true});
  const ratio=width/manifest.coordinateSpace;
  const affected=new Uint8Array(width*height);
  for (const {target,offset,scale=1} of manifest.masks) {
    sourceContext.clearRect(0,0,width,height);
    sourceContext.drawImage(closed,offset[0]*ratio,offset[1]*ratio,width*scale,height*scale);
    const source=sourceContext.getImageData(0,0,width,height).data;
    const [left,top,w,h]=target.map(value=>value*ratio);
    const x0=Math.floor(left)-1,y0=Math.floor(top)-1;
    const bw=Math.ceil(w)+3,bh=Math.ceil(h)+3;
    const inside=new Uint8Array(bw*bh),boundary=new Uint8Array(bw*bh);
    const field=new Float32Array(bw*bh*3);
    const centerX=left+w/2,centerY=top+h/2;
    for(let y=0;y<bh;y++)for(let x=0;x<bw;x++) {
      const px=x+x0,py=y+y0;
      inside[y*bw+x]=Math.pow((px+.5-centerX)/(w/2),2)+Math.pow((py+.5-centerY)/(h/2),2)<1?1:0;
    }
    const average=[0,0,0];let edgeCount=0;
    for(let y=1;y<bh-1;y++)for(let x=1;x<bw-1;x++) {
      const q=y*bw+x;if(!inside[q])continue;
      if(!inside[q-1]||!inside[q+1]||!inside[q-bw]||!inside[q+bw]) {
        boundary[q]=1;edgeCount++;
        const p=((y+y0)*width+x+x0)*4;
        for(let channel=0;channel<3;channel++) {
          field[q*3+channel]=open.data[p+channel]-source[p+channel];
          average[channel]+=field[q*3+channel];
        }
      }
    }
    for(let q=0;q<inside.length;q++)if(inside[q]&&!boundary[q])for(let channel=0;channel<3;channel++)field[q*3+channel]=average[channel]/edgeCount;
    // Solve the smooth offset once when assets load; frames only show cached pixels.
    for(let iteration=0;iteration<240;iteration++) {
      let maxChange=0;
      for(let y=1;y<bh-1;y++)for(let x=1;x<bw-1;x++) {
        const q=y*bw+x;if(!inside[q]||boundary[q])continue;
        for(let channel=0;channel<3;channel++) {
          const i=q*3+channel;
          const next=(field[i-3]+field[i+3]+field[i-bw*3]+field[i+bw*3])*.25;
          const delta=(next-field[i])*1.7;field[i]+=delta;maxChange=Math.max(maxChange,Math.abs(delta));
        }
      }
      if(maxChange<.01)break;
    }
    for(let y=1;y<bh-1;y++)for(let x=1;x<bw-1;x++) {
      const q=y*bw+x;if(!inside[q])continue;
      const pixel=(y+y0)*width+x+x0,p=pixel*4;affected[pixel]=1;
      if(boundary[q])continue;
      for(let channel=0;channel<3;channel++)finished.data[p+channel]=source[p+channel]+field[q*3+channel];
    }
  }
  let outsideChanges=0,alphaChanges=0,changedPixels=0;
  for(let pixel=0;pixel<affected.length;pixel++) {
    const p=pixel*4;
    if(open.data[p+3]!==finished.data[p+3])alphaChanges++;
    if(open.data[p]!==finished.data[p]||open.data[p+1]!==finished.data[p+1]||open.data[p+2]!==finished.data[p+2]){
      changedPixels++;if(!affected[pixel])outsideChanges++;
    }
  }
  if(outsideChanges||alphaChanges)throw new Error('Eye-only pixel boundary was not preserved.');
  return {open,closed:finished,audit:{width,height,outsideChanges,alphaChanges,changedPixels,mode:'high-resolution eye registration and boundary color matching'}};
}
