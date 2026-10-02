// Small authored boats for the coastal route. Static parts are merged by
// material; each vessel moves as one rigid body and all wakes share one draw.
export function createCoastalBoats(THREE,{pathX,groundHeight}={}) {
  if(!THREE||typeof pathX!=='function'||typeof groundHeight!=='function')throw new TypeError('Coastal boats need the real road and sea floor.');
  const group=new THREE.Group();group.name='coastal-yachts-and-cruisers';
  const waterY=-2.2,boats=[],ownedGeometry=[],poses=[];
  const materials={
    hull:new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.36,metalness:.09}),
    timber:new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.74,metalness:0}),
    glass:new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.17,metalness:.34}),
    rail:new THREE.MeshStandardMaterial({color:0xd1d9dc,vertexColors:true,roughness:.28,metalness:.78}),
  };
  const matrix=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),point=new THREE.Vector3(),normal=new THREE.Vector3();
  const transform=new THREE.Object3D(),axis=new THREE.Vector3(0,1,0),colour=new THREE.Color();
  function model(kind) {
    const buckets=Object.fromEntries(Object.keys(materials).map(key=>[key,{position:[],normal:[],color:[]}])) ;
    function part(key,geometry,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0],tint=0xffffff) {
      transform.position.set(...position);transform.scale.set(...scale);
      if(rotation.isQuaternion)transform.quaternion.copy(rotation);else transform.rotation.set(...rotation);
      transform.updateMatrix();matrix.copy(transform.matrix);normalMatrix.getNormalMatrix(matrix);
      const flat=geometry.index?geometry.toNonIndexed():geometry,b=buckets[key];colour.set(tint);
      const p=flat.attributes.position,n=flat.attributes.normal;
      for(let i=0;i<p.count;i++){
        point.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();
        b.position.push(point.x,point.y,point.z);b.normal.push(normal.x,normal.y,normal.z);b.color.push(colour.r,colour.g,colour.b);
      }
      if(flat!==geometry)flat.dispose();geometry.dispose();
    }
    const box=(key,x,y,z,w,h,d,tint=0xffffff,rotation=[0,0,0])=>part(key,new THREE.BoxGeometry(w,h,d),[x,y,z],[1,1,1],rotation,tint);
    function tube(key,a,b,r=.027,tint=0xffffff,sides=5){
      const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),direction=bv.clone().sub(av),length=direction.length();
      part(key,new THREE.CylinderGeometry(r,r,length,sides,1,false),av.add(bv).multiplyScalar(.5).toArray(),[1,1,1],new THREE.Quaternion().setFromUnitVectors(axis,direction.normalize()),tint);
    }
    const length=kind==='sail'?9:10.5,width=kind==='sail'?1.42:1.7;
    const stations=[[-.5,.55],[-.43,.79],[-.28,.97],[-.08,1],[.12,.96],[.29,.80],[.41,.51],[.48,.19],[.5,.025]];
    const shell=[],deck=[],stripe=[];
    function hullPoint(station,angle){const [z,w]=stations[station],flare=.50+Math.pow(Math.abs(z)*2,3)*.24;return [Math.cos(angle)*width*w,flare-Math.sin(angle)*(.91-Math.max(0,z)*.42),z*length];}
    const tri=(out,a,b,c)=>out.push(...a,...b,...c);
    for(let i=0;i<stations.length-1;i++){
      for(let j=0;j<10;j++){
        const a=hullPoint(i,j/10*Math.PI),b=hullPoint(i+1,j/10*Math.PI),c=hullPoint(i,(j+1)/10*Math.PI),d=hullPoint(i+1,(j+1)/10*Math.PI);
        tri(shell,a,c,b);tri(shell,b,c,d);
      }
      const l=hullPoint(i,Math.PI),r=hullPoint(i,0),ln=hullPoint(i+1,Math.PI),rn=hullPoint(i+1,0);
      tri(deck,l,ln,r);tri(deck,r,ln,rn);
      for(const side of [-1,1]){
        const a=hullPoint(i,side<0?Math.PI:0),b=hullPoint(i+1,side<0?Math.PI:0),c=[a[0]*1.001,a[1]-.13,a[2]],d=[b[0]*1.001,b[1]-.13,b[2]];
        a[0]*=1.001;b[0]*=1.001;
        if(side>0){tri(stripe,a,b,c);tri(stripe,b,d,c);}else{tri(stripe,a,c,b);tri(stripe,b,c,d);}
      }
    }
    const custom=(data,key,tint)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();part(key,g,[0,0,0],[1,1,1],[0,0,0],tint);};
    custom(shell,'hull',0xf7f1dc);custom(deck,'timber',0x9e744b);custom(stripe,'glass',0x233e4b);
    // A closed transom keeps the stern from exposing the one-sided hull.
    box('hull',0,.11,-length*.499,width*1.10,.84,.065,0xeee7d7);
    // Thin deck joints and cockpit upholstery share existing material batches.
    for(let i=-3;i<=3;i++)box('timber',i*.22,.535,-1.1,.018,.013,3.4,0x674c35);
    box('glass',0,.56,-1.75,width*1.20,.07,2.12,0x26383d);
    for(const side of [-1,1])box('hull',side*width*.64,.70,-1.75,.34,.23,2.10,0xe4dbca);
    box('hull',0,.7,-2.83,width*1.18,.23,.33,0xe4dbca);
    // Smooth side windows, angled windscreen and thin flybridge roof.
    const cabinZ=kind==='sail'?.72:.08,cabinH=kind==='sail'?.64:1.27,cabinD=kind==='sail'?2.80:3.46;
    box('hull',0,.74,cabinZ,width*1.15,.35,cabinD,0xf5eedc);
    for(const side of [-1,1]){
      box('glass',side*width*.578,.90+cabinH*.28,cabinZ,width*.015,cabinH*.64,cabinD*.85,0x1a3543);
      box('rail',side*width*.59,.89+cabinH*.55,cabinZ,.029,.034,cabinD*.95,0xd1d7d3);
    }
    box('glass',0,.91+cabinH*.23,cabinZ+cabinD*.43,width*1.13,cabinH*.64,.04,0x223e49,[-.24,0,0]);
    box('hull',0,.98+cabinH*.53,cabinZ,width*1.25,.10,cabinD*1.02,0xf6f1df);
    // Railings follow the real curved sheer, with short vertical stanchions.
    for(const side of [-1,1]){
      let previous=null;
      for(const i of [0,1,2,3,4,5,6,7]){
        const p=hullPoint(i,side<0?Math.PI:0),rail=[p[0]*.97,p[1]+.50,p[2]];
        tube('rail',[rail[0],p[1],rail[2]],rail,.023);
        if(previous)tube('rail',previous,rail,.018);
        previous=rail;
      }
    }
    // Mooring cleats, stern swim step and dark fenders make scale readable.
    box('timber',0,.12,-length*.54,width*.86,.10,.56,0xa9865e);
    for(const z of [-length*.38,length*.29])for(const side of [-1,1]){
      box('rail',side*width*.76,.64,z,.20,.045,.05);
      part('glass',new THREE.CapsuleGeometry(.105,.40,2,6),[side*width*1.015,.19,z],[1,1,1],[0,0,side*.1],0x2c424a);
    }
    if(kind==='sail'){
      tube('rail',[0,.79,.48],[0,8.15,.48],.056,0xe1e2d7,7);
      tube('rail',[0,1.75,.48],[0,1.71,-3.13],.042,0xd4d8d2,6);
      tube('rail',[0,8.07,.48],[0,.86,length*.47],.012,0xb6c2c6,3);
      for(const side of [-1,1])tube('rail',[0,7.90,.48],[side*width*.90,.76,-.10],.012,0xb6c2c6,3);
      // Cloth is a curved triangular mesh, not a flat billboard. Its head,
      // luff and foot remain tied to the mast/boom while the belly catches light.
      function sail(head,foot,clew,tint){
        const data=[];const at=(u,v)=>{
          const a=new THREE.Vector3(...foot).lerp(new THREE.Vector3(...head),v),b=new THREE.Vector3(...clew).lerp(new THREE.Vector3(...head),v);
          const p=a.lerp(b,u);p.x+=Math.sin(u*Math.PI)*Math.sin((.18+v*.82)*Math.PI)*.47*(1-v);return p.toArray();
        };
        for(let row=0;row<8;row++)for(let col=0;col<6;col++){
          const u=col/6,v=row/8,a=at(u,v),b=at((col+1)/6,v),c=at(u,(row+1)/8),d=at((col+1)/6,(row+1)/8);
          tri(data,a,b,c);tri(data,b,d,c);tri(data,c,b,a);tri(data,c,d,b);
        }
        custom(data,'hull',tint);
      }
      sail([0,7.93,.48],[0,1.87,.48],[0,1.78,-3.12],0xfff5d9);
      sail([0,7.40,.54],[0,1.00,4.15],[0,1.45,.90],0xe4e8e2);
      box('timber',0,.86,-2.03,.10,.08,.59,0x926c46);
    }else{
      for(const side of [-1,1])tube('rail',[side*.74,1.58,-1.52],[side*.74,2.76,-1.42],.04,0xdde1d9,6);
      box('hull',0,2.77,-1.25,2.00,.10,1.4,0xeee8d8);
      part('hull',new THREE.CylinderGeometry(.28,.34,.16,12),[0,2.91,-1.28],[1,1,1],[0,0,0],0xe7e8dd);
      tube('rail',[.30,2.84,-1.18],[.30,3.62,-1.23],.012,0xdbdfd4,4);
      for(const side of [-1,1])part('glass',new THREE.CylinderGeometry(.27,.25,.53,8),[side*.41,-.06,-5.26],[1,1,1],[Math.PI/2,0,0],0x263b42);
    }
    const root=new THREE.Group();let triangles=0;
    for(const [key,b] of Object.entries(buckets)){
      const g=new THREE.BufferGeometry();for(const name of ['position','normal','color'])g.setAttribute(name,new THREE.Float32BufferAttribute(b[name],3));g.computeBoundingSphere();ownedGeometry.push(g);
      const mesh=new THREE.Mesh(g,materials[key]);mesh.name=`${kind}-boat-${key}`;mesh.castShadow=false;mesh.receiveShadow=false;root.add(mesh);triangles+=g.attributes.position.count/3;
    }
    return {root,triangles,length,width};
  }
  const specs=[{kind:'sail',s:240,offset:100,yaw:.72},{kind:'cruise',s:590,offset:133,yaw:-.62},{kind:'sail',s:1120,offset:122,yaw:1.03},{kind:'cruise',s:1820,offset:106,yaw:.39}];
  for(let id=0;id<specs.length;id++){
    const spec=specs[id],boat=model(spec.kind),x=pathX(spec.s)+spec.offset;
    // The small bounded drift must remain above submerged terrain throughout.
    for(const dx of [-12,0,12])for(const dz of [-15,0,15])if(groundHeight(x+dx,spec.s+dz)>waterY-1.0)throw new RangeError('A coastal boat would intersect dry ground.');
    Object.assign(boat,spec,{id,baseX:x,clock:0,phase:id*1.73,visible:false});
    boat.root.name=`coastal-${spec.kind}-${id+1}`;boat.root.position.set(x,waterY,spec.s);boat.root.rotation.y=spec.yaw;group.add(boat.root);boats.push(boat);
  }
  const wakeGeometry=new THREE.BufferGeometry();
  wakeGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,0,.5,0,0,-.5,0,-1,.5,0,-1],3));
  wakeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));wakeGeometry.setIndex([0,2,1,1,2,3]);
  wakeGeometry.setAttribute('wakeTime',new THREE.InstancedBufferAttribute(new Float32Array(4),1).setUsage(THREE.DynamicDrawUsage));ownedGeometry.push(wakeGeometry);
  const wakeMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`attribute float wakeTime;varying vec2 vUv;varying float vTime;void main(){vUv=uv;vTime=wakeTime;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;varying float vTime;void main(){
      float spread=.055+vUv.y*.38,d=abs(vUv.x-.5);
      float side=1.-smoothstep(.012,.052,abs(d-spread));
      float center=(1.-smoothstep(.02,.21,d))*.30;
      float ripple=.65+.35*sin(vUv.y*48.-vTime*1.3+sin(vUv.x*18.));
      float alpha=(side+center)*ripple*pow(1.-vUv.y,1.8)*smoothstep(0.,.09,vUv.y)*.15;
      gl_FragColor=vec4(.78,.82,.77,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>}`});
  const wakes=new THREE.InstancedMesh(wakeGeometry,wakeMaterial,4);wakes.name='coastal-boat-wakes';wakes.frustumCulled=false;wakes.castShadow=false;wakes.count=0;wakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(wakes);
  const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),sphere=new THREE.Sphere(new THREE.Vector3(),11);
  const stats={boats:4,sailboats:2,cruisers:2,visibleBoats:0,animatedBoats:0,visibleTriangles:0,storedTriangles:boats.reduce((s,b)=>s+b.triangles,0)+2,drawCalls:0,shadowDrawCalls:0,wakeDrawCalls:0,quality:'high'};
  group.userData.stats=stats;group.userData.poseSnapshots=poses;group.userData.boats=boats.map(({id,kind,s,offset,yaw,length,width,baseX})=>({id,kind,s,offset,yaw,length,width,x:baseX,z:s}));
  let lastTime=null,disposed=false;
  function update({dt,time=0,playerS=75,quality='high',camera=null,paused=false,motion=true}={}){
    if(disposed)return stats;
    const delta=Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:lastTime===null?0:time-lastTime));if(Number.isFinite(time))lastTime=time;
    const low=quality==='low',range=low?460:quality==='balanced'?630:830;
    if(camera){camera.updateMatrixWorld();projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);}
    stats.visibleBoats=stats.animatedBoats=stats.visibleTriangles=stats.drawCalls=stats.wakeDrawCalls=0;stats.quality=quality;wakes.count=0;poses.length=0;
    for(const boat of boats){
      const offset=boat.s-playerS;
      sphere.center.copy(boat.root.position);sphere.center.y+=3;
      const visible=group.visible&&offset>-(low?95:150)&&offset<range&&(!camera||frustum.intersectsSphere(sphere));
      boat.visible=visible;boat.root.visible=visible;
      const animated=visible&&!paused&&motion;
      if(animated){
        boat.clock+=delta;const t=boat.clock,p=boat.phase,drift=Math.sin(t*.021)*4.2;
        boat.root.position.set(boat.baseX+Math.sin(boat.yaw)*drift,waterY+Math.sin(t*.75+p)*.10,boat.s+Math.cos(boat.yaw)*drift);
        boat.root.rotation.set(Math.sin(t*.48+p)*.009,boat.yaw+Math.sin(t*.08)*.009,Math.sin(t*.63+p)*.015);
        stats.animatedBoats++;
      }
      if(visible){
        stats.visibleBoats++;stats.visibleTriangles+=boat.triangles;stats.drawCalls+=boat.root.children.length;
        if(!low){
          transform.position.copy(boat.root.position);transform.position.y=waterY+.036;
          transform.rotation.set(0,boat.root.rotation.y,0);transform.scale.set(boat.width*2.0,1,boat.kind==='sail'?10:13);
          transform.translateZ(-boat.length*.5);transform.updateMatrix();wakes.setMatrixAt(wakes.count,transform.matrix);wakeGeometry.attributes.wakeTime.setX(wakes.count,boat.clock+boat.phase);wakes.count++;
        }
      }
      poses.push({id:boat.id,kind:boat.kind,visible,animated,time:boat.clock,position:boat.root.position.toArray(),rotation:boat.root.rotation.toArray().slice(0,3)});
    }
    wakes.visible=wakes.count>0;if(wakes.count){wakes.instanceMatrix.needsUpdate=true;wakeGeometry.attributes.wakeTime.needsUpdate=true;stats.visibleTriangles+=wakes.count*2;stats.wakeDrawCalls=1;stats.drawCalls++;}
    return stats;
  }
  function dispose(){if(disposed)return;disposed=true;for(const g of ownedGeometry)g.dispose();for(const m of Object.values(materials))m.dispose();wakeMaterial.dispose();wakes.dispose();group.clear();poses.length=0;stats.visibleBoats=stats.animatedBoats=stats.visibleTriangles=stats.drawCalls=stats.wakeDrawCalls=0;}
  update();return {group,update,stats,dispose};
}
