// Adult pedestrians and terrace guests share nine instanced batches. Their
// authored activities are anchored to cityscape's real seats and pavements.
export function buildCityLife(THREE, {anchors = [], groundHeight, pathX, surfaceHeightAt = null} = {}) {
  if (!THREE || typeof groundHeight !== 'function' || typeof pathX !== 'function') throw new TypeError('City life needs THREE, groundHeight and pathX.');
  if (!Array.isArray(anchors)) throw new TypeError('City activity anchors must be an array.');
  const group = new THREE.Group(); group.name = 'coastal-city-life';
  const actors = [], clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  function seed(text) { let n=2166136261; for(const c of text) n=Math.imul(n^c.charCodeAt(0),16777619); return (n>>>0)/4294967296; }
  function add(anchor,position,index) {
    if (![position.x,position.y,position.z].every(Number.isFinite)) throw new TypeError('City actors require finite world coordinates.');
    if (pathX(position.z)-position.x<9.8) throw new RangeError('City actors must remain behind the protected road shoulder.');
    const id=`${anchor.id}:${index}`, r=seed(id), height=1.66+seed(id+'height')*.22;
    actors.push({id,kind:anchor.kind,anchor,position:{...position},r,phase:r*Math.PI*2,height,scale:height/1.78,
      skirt:seed(id+'skirt')>.72,coat:seed(id+'coat')>.62,phaseOffset:seed(id+'offset')*21,
      skin:Math.floor(seed(id+'skin')*5),outfit:Math.floor(seed(id+'outfit')*7),hair:Math.floor(seed(id+'hair')*4)});
  }
  for(const anchor of anchors) {
    if (anchor.kind==='table') (anchor.guests||[]).forEach((p,i)=>add(anchor,p,i));
    else if (anchor.kind==='party'||anchor.kind==='cheer') (anchor.positions||anchor.spots||[]).forEach((p,i)=>add(anchor,p,i));
    else if (anchor.kind==='walk'&&anchor.start&&anchor.end) {
      if (![anchor.end.x,anchor.end.y,anchor.end.z].every(Number.isFinite)||pathX(anchor.end.z)-anchor.end.x<9.8) throw new RangeError('Pedestrian destination is outside the pavement.');
      add(anchor,anchor.start,0);
    }
  }
  const shirtColors=[0xe9e6db,0x314a63,0x6b8276,0xb48975,0x774956,0x8b959c,0xc6b8a1];
  const trouserColors=[0x36404c,0x242c38,0x716b61,0x575b60,0x273c45,0x474250,0x626154];
  const skinColors=[0xd9ab89,0xa87355,0x76503c,0xe6be9e,0xba8869], hairColors=[0x28201d,0x48352b,0x635447,0x252a30];
  const colors=new Map(); const color=n=>{if(!colors.has(n))colors.set(n,new THREE.Color(n));return colors.get(n);};
  const solid=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.77,metalness:.025});
  const drink=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.28,metalness:.16});
  const contact=new THREE.MeshBasicMaterial({color:0x152b2d,transparent:true,opacity:.13,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  function tailoredBody() {
    // Waist, ribs, shoulders and neckline form an adult clothed silhouette.
    const rings=[[0,.145,.095],[.10,.16,.10],[.35,.217,.105],[.445,.232,.10],[.49,.105,.082]],pos=[],idx=[];
    for(const [y,w,d] of rings)for(let j=0;j<8;j++){const a=j*Math.PI/4;pos.push(Math.cos(a)*w,y,Math.sin(a)*d);}
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8;idx.push(a,b,a+8,b,b+8,a+8);}
    for(let j=1;j<7;j++){idx.push(0,j+1,j);idx.push(32,32+j,33+j);}
    for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
  }
  const geometry={
    torso:tailoredBody(),
    limb:new THREE.CylinderGeometry(1,.84,1,8,1,false),
    sphere:new THREE.SphereGeometry(1,10,7),
    hair:new THREE.SphereGeometry(1,10,5,0,Math.PI*2,0,Math.PI*.58),
    shoe:new THREE.BoxGeometry(1,1,1),
    skirt:new THREE.CylinderGeometry(.145,.235,.38,10,1,false),
    cup:new THREE.CylinderGeometry(.035,.027,.105,8,1,false),
    liquid:new THREE.CircleGeometry(.031,8),
    shadow:new THREE.CircleGeometry(1,12),
  };
  const buckets={};
  for(const [key,g] of Object.entries(geometry)) {
    const perActor={torso:1,limb:15,sphere:15,hair:1,shoe:7,skirt:1,cup:1,liquid:1,shadow:1}[key];
    const mesh=new THREE.InstancedMesh(g,key==='shadow'?contact:['cup','liquid'].includes(key)?drink:solid,Math.max(1,actors.length*perActor));
    mesh.name=`city-life-${key}`;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=key!=='shadow';mesh.count=0;
    buckets[key]={mesh,count:0,triangles:(g.index?.count||g.attributes.position.count)/3};group.add(mesh);
  }
  const object=new THREE.Object3D(),aVector=new THREE.Vector3(),bVector=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0),up=new THREE.Vector3(),limbRotation=new THREE.Quaternion();
  const yawRotation=new THREE.Quaternion(),partRotation=new THREE.Quaternion(),localEuler=new THREE.Euler();
  const sphere=new THREE.Sphere(new THREE.Vector3(),1.8),frustum=new THREE.Frustum(),projection=new THREE.Matrix4();
  let theme='coast',clock=0,lastTime=null,lastInput={},disposed=false;
  const stats={actors:actors.length,visibleActors:0,animatedActors:0,drawCalls:0,shadowDrawCalls:0,visibleTriangles:0,storedTriangles:Object.values(buckets).reduce((n,b)=>n+b.triangles,0),quality:'high',theme,time:0};
  const poses=[]; group.userData.stats=stats;group.userData.actors=actors.map(a=>({id:a.id,kind:a.kind,height:a.height}));group.userData.poseSnapshots=poses;
  // Snapshot joints are world coordinates, permitting direct pose/seat/road QA
  // without adding a debug interface or altering any game state.
  function meshPart(key,position,scale,tint,rotation=null) {
    const bucket=buckets[key]; object.position.set(...position);object.scale.set(...scale);
    if(rotation?.isQuaternion)object.quaternion.copy(rotation);else object.rotation.set(...(rotation||[0,0,0]));
    object.updateMatrix();bucket.mesh.setMatrixAt(bucket.count,object.matrix);
    if(key!=='shadow')bucket.mesh.setColorAt(bucket.count,color(tint));bucket.count++;
  }
  function placement(actor,t) {
    const p=actor.position;
    let x=p.x,y=p.y,z=p.z,yaw=p.yaw??actor.anchor.yaw??0,walk=0;
    const localTime=t+actor.phaseOffset;
    if(actor.kind==='walk') {
      const {start,end}=actor.anchor,length=Math.hypot(end.x-start.x,end.z-start.z);
      // A cosine round trip must last pi * distance / peak speed; a fixed
      // short period makes a 43m pavement look like a sprinting conveyor.
      const duration=Math.max(length*Math.PI/1.45,actor.anchor.duration||0,8),angle=localTime/duration*Math.PI*2;
      const progress=(1-Math.cos(angle))*.5;
      x=start.x+(end.x-start.x)*progress;z=start.z+(end.z-start.z)*progress;
      if(Number.isFinite(actor.anchor.roadRelativeOffset))x=pathX(z)+actor.anchor.roadRelativeOffset;
      x=Math.min(x,pathX(z)-10.3);
      const pavement=typeof surfaceHeightAt==='function'?surfaceHeightAt(x,z):NaN;
      y=Number.isFinite(pavement)?pavement:groundHeight(x,z)+.045;
      // Smooth out the turnaround rather than teleporting to the path start.
      const direction=Math.sin(angle);walk=clamp(Math.abs(direction)*1.8,0,1);
      yaw=Math.atan2(end.x-start.x,end.z-start.z)+(direction<0?Math.PI:0);
    }
    return {x,y,z,yaw,walk};
  }
  function drawActor(actor,t,playerS,playerX,animated,celebrating) {
    const p=actor.position, seated=actor.kind==='table',s=actor.scale;
    let {x,y,z,yaw,walk}=placement(actor,t);
    const localTime=t+actor.phaseOffset;
    const distance=Math.hypot(x-playerX,z-playerS),near=clamp(((celebrating?60:48)-distance)/20,0,1);
    if(actor.kind==='cheer')yaw=Math.atan2(playerX-x,playerS-z);
    const party=actor.kind==='party',beat=localTime*(1.55+actor.r*.40),stride=localTime*(4.5+actor.r*.7);
    const dance=party&&actor.r>.5?(1+Math.sin(beat))*.018:0;
    const sway=party?-dance:Math.sin(stride*2)*.014*walk;
    const seatHeight=Number.isFinite(p.seatHeight)?p.seatHeight:.57;
    const pelvisY=seated?(seatHeight+.10)/s:.925+sway;
    const hipZ=seated?-.075:0;
    const hipL=[-.092,pelvisY,hipZ],hipR=[.092,pelvisY,hipZ];
    const stepL=Math.sin(stride)*.22*walk,stepR=-stepL;
    const kneeL=seated?[-.105,.505/s,.36/s]:[-.095,.49+Math.max(0,stepL)*.19-dance*.45,stepL*.64+dance];
    const kneeR=seated?[.105,.505/s,.36/s]:[.095,.49+Math.max(0,stepR)*.19-dance*.45,stepR*.64+dance*.3];
    const ankleL=seated?[-.108,.08/s,.43/s]:[-.098,.08+Math.max(0,stepL)*.24,stepL];
    const ankleR=seated?[.108,.08/s,.43/s]:[.098,.08+Math.max(0,stepR)*.24,stepR];
    const shoulderY=pelvisY+.435,neckY=pelvisY+.55,headY=pelvisY+.70;
    const breathe=Math.sin(localTime*1.3)*.004;
    const shoulderL=[-.211,shoulderY,hipZ],shoulderR=[.211,shoulderY,hipZ];
    let elbowL=[-.245,shoulderY-.275,hipZ-stepR*.6],elbowR=[.245,shoulderY-.275,hipZ-stepL*.6];
    let handL=[-.24,shoulderY-.52,hipZ-stepR],handR=[.24,shoulderY-.52,hipZ-stepL];
    let drinkHand=null,drinkSip=0;
    if(seated||party) {
      const sip=seated?Math.pow(Math.max(0,Math.sin(localTime*.48+actor.phase)),5):Math.pow(Math.max(0,Math.sin(localTime*.32+actor.phase)),8)*.75;
      drinkSip=sip;
      elbowR=[.255,shoulderY-.20+sip*.08,hipZ+.17];
      handR=[.135,shoulderY-.14+sip*.30,hipZ+.255-sip*.07];drinkHand=handR;
      elbowL=[-.265,shoulderY-.24,hipZ+.13];
      handL=[-.18,shoulderY-.31+Math.sin(localTime*1.15+actor.phase)*.035,hipZ+.31];
      if(party){elbowL[1]+=.09+Math.sin(beat)*.06;handL[0]-=.06;handL[1]+=.07+Math.sin(beat+.3)*.08;}
    } else if(actor.kind==='cheer'&&near>.01||actor.kind==='walk'&&near>.85&&actor.r>.48) {
      if(actor.r>.42) {
        // Wave towards the passing car, with a relaxed bent elbow.
        elbowR=[.32,shoulderY+.13*near,hipZ+.02];handR=[.33+Math.sin(localTime*3.6+actor.phase)*.085,shoulderY+.38*near,hipZ+.06];
      } else {
        const clap=.06+Math.abs(Math.sin(localTime*3+actor.phase))*.08;
        elbowL=[-.27,shoulderY-.13,hipZ+.14];elbowR=[.27,shoulderY-.13,hipZ+.14];
        handL=[-clap,shoulderY-.04,hipZ+.34];handR=[clap,shoulderY-.04,hipZ+.34];
      }
    }
    const cos=Math.cos(yaw),sin=Math.sin(yaw);
    yawRotation.setFromAxisAngle(axis,yaw);
    const world=q=>[x+s*(cos*q[0]+sin*q[2]),y+s*q[1],z+s*(-sin*q[0]+cos*q[2])];
    function part(key,position,scale,tint,rot=[0,0,0]) {
      partRotation.setFromEuler(localEuler.set(...rot)).premultiply(yawRotation);
      meshPart(key,world(position),scale.map(v=>v*s),tint,partRotation);
    }
    function limb(from,to,r,tint,depth=1) {
      aVector.set(...world(from));bVector.set(...world(to));up.subVectors(bVector,aVector);const length=up.length();
      limbRotation.setFromUnitVectors(axis,up.normalize());
      meshPart('limb',aVector.add(bVector).multiplyScalar(.5).toArray(),[r*s,length,r*s*depth],tint,limbRotation);
    }
    const shirt=shirtColors[actor.outfit],trousers=trouserColors[actor.outfit],skin=skinColors[actor.skin],hair=hairColors[actor.hair];
    part('torso',[0,pelvisY+breathe,hipZ],[1,1,1],shirt);
    part('sphere',[0,pelvisY+.018,hipZ],[.153,.093,.10],trousers);
    for(const [hip,knee,ankle] of [[hipL,kneeL,ankleL],[hipR,kneeR,ankleR]]) {
      limb(hip,knee,.093,trousers,1.05);limb(knee,ankle,.067,actor.skirt?skin:trousers);
      part('sphere',knee,[.078,.075,.078],actor.skirt?skin:trousers);
      part('shoe',[ankle[0],ankle[1]-.03,ankle[2]+.065],[.123,.10,.25],actor.outfit%3===0?0xd7d2c6:0x282c30);
    }
    if(actor.skirt&&!seated)part('skirt',[0,pelvisY-.125,hipZ],[1,1,1],trousers);
    for(const [shoulder,elbow,hand] of [[shoulderL,elbowL,handL],[shoulderR,elbowR,handR]]) {
      limb(shoulder,elbow,.072,shirt);part('sphere',shoulder,[.073,.074,.074],shirt);
      limb(elbow,hand,.045,actor.coat?shirt:skin);part('sphere',hand,[.037,.068,.028],skin);
      if(actor.coat){const cuff=elbow.map((n,i)=>n*.08+hand[i]*.92);part('sphere',cuff,[.047,.026,.045],0xe5dfd3);}
    }
    limb([0,pelvisY+.49,hipZ],[0,neckY+.04,hipZ],.052,skin);
    part('sphere',[0,headY,hipZ+.006],[.091,.125,.095],skin);
    part('hair',[0,headY+.033,hipZ-.007],[.098,.115,.102],hair);
    // Small nose and ears clarify the face direction without cartoon eyes.
    part('sphere',[0,headY-.005,hipZ+.095],[.018,.025,.027],skin);
    part('sphere',[-.093,headY-.01,hipZ],[.014,.027,.018],skin);
    part('sphere',[.093,headY-.01,hipZ],[.014,.027,.018],skin);
    if(actor.coat) {
      part('shoe',[-.063,pelvisY+.354,hipZ+.105],[.043,.21,.018],shirtColors[(actor.outfit+1)%7],[0,0,-.21]);
      part('shoe',[.063,pelvisY+.354,hipZ+.105],[.043,.21,.018],shirtColors[(actor.outfit+1)%7],[0,0,.21]);
    }
    if(drinkHand) {
      const cupPosition=[drinkHand[0],drinkHand[1]+.046,drinkHand[2]+.026];
      const tilt=-drinkSip*.55;
      part('cup',cupPosition,[1,1,1],actor.r>.5?0xd7c3a3:0xe8dfce,[tilt,0,0]);
      part('liquid',[cupPosition[0],cupPosition[1]+.053*Math.cos(tilt),cupPosition[2]+.053*Math.sin(tilt)],[1,1,1],actor.r>.5?0x805433:0xb09867,[-Math.PI*.5+tilt,0,0]);
    }
    meshPart('shadow',[x,y+.012,z],[seated?.36:.28,seated?.43:.18,1],0,[ -Math.PI*.5,0,yaw]);
    poses.push({id:actor.id,kind:actor.kind,position:{x,y,z},yaw,height:actor.height,seated,seatHeight,animated,
      joints:{hipLeft:world(hipL),hipRight:world(hipR),kneeLeft:world(kneeL),kneeRight:world(kneeR),ankleLeft:world(ankleL),ankleRight:world(ankleR),handLeft:world(handL),handRight:world(handR),head:world([0,headY,hipZ])}});
  }
  function update(input={}) {
    if(disposed)return stats;
    const {time=0,playerS=75,playerX=pathX(playerS),quality='high',camera=null,motion=true,paused=false,celebrating=false}=input;lastInput=input;
    const previousClock=clock;
    if(Number.isFinite(time)){if(lastTime!==null&&!paused&&motion)clock+=clamp(time-lastTime,0,.15);lastTime=time;}
    const q=['high','balanced','low'].includes(quality)?quality:'balanced';
    stats.quality=q;stats.theme=theme;stats.time=clock;stats.visibleActors=0;stats.animatedActors=0;stats.visibleTriangles=0;stats.drawCalls=0;poses.length=0;
    for(const b of Object.values(buckets))b.count=0;
    if(camera){camera.updateMatrixWorld();projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);}
    const distance=q==='high'?260:q==='balanced'?200:140;
    if(group.visible)for(const actor of actors) {
      const current=placement(actor,actor.frozenTime??0),offset=current.z-playerS;
      if(offset < -28 || offset>distance)continue;
      if(Number.isFinite(actor.anchor.blockS)&&(Math.abs(actor.anchor.blockS-playerS)>=distance||actor.anchor.blockS-playerS<=-125))continue;
      // Keep both seated partners on lower tiers; reduce distant pedestrians.
      if(q==='low'&&offset>75&&actor.kind==='walk')continue;
      sphere.center.set(current.x,current.y+1,current.z);
      if(camera&&!frustum.intersectsSphere(sphere))continue;
      const animated=motion&&!paused&&Math.abs(offset)<(q==='low'?65:110);
      // Distant people remain in a stable, individual pose; near motion updates
      // every render, so no 12/18 fps skeletal stepping is exposed up close.
      if(actor.frozenTime===undefined)actor.frozenTime=0;
      if(animated)actor.frozenTime+=clock-previousClock;
      if(!actor.reactionTarget||motion&&!paused)actor.reactionTarget={playerS,playerX,celebrating};
      drawActor(actor,actor.frozenTime,actor.reactionTarget.playerS,actor.reactionTarget.playerX,animated,actor.reactionTarget.celebrating);
      stats.visibleActors++;if(animated)stats.animatedActors++;
    }
    for(const b of Object.values(buckets)) {
      b.mesh.count=b.count;b.mesh.visible=b.count>0;b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;
      if(b.count){stats.drawCalls++;stats.visibleTriangles+=b.triangles*b.count;}
    }
    return stats;
  }
  function setTheme(next) {theme=['coast','sunset','bloom'].includes(next)?next:'coast';group.visible=theme!=='bloom';update(lastInput);}
  function dispose() {
    if(disposed)return;disposed=true;
    for(const b of Object.values(buckets)){b.mesh.dispose?.();b.mesh.geometry.dispose();}
    solid.dispose();drink.dispose();contact.dispose();group.clear();poses.length=0;stats.visibleActors=0;stats.drawCalls=0;stats.visibleTriangles=0;
  }
  update();return {group,setTheme,update,stats,dispose};
}
