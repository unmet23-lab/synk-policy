// The photographic coast scan is reduced offline; all placements share its
// two geometries and one material, with no extra lighting or shadow pass.
export function createCoastalRocks(THREE,{source,pathX,groundHeight}){
  const near=source.getObjectByName('coastal-rock-near'),far=source.getObjectByName('coastal-rock-far');
  if(!near?.isMesh||!far?.isMesh)throw new TypeError('Coastal scan needs both prepared levels of detail.');
  const group=new THREE.Group();group.name='photographic-coastal-rock-shelves';
  const highGeometry=near.geometry.clone(),lowGeometry=far.geometry.clone();
  highGeometry.computeBoundingBox();const centre=highGeometry.boundingBox.getCenter(new THREE.Vector3());
  for(const geometry of [highGeometry,lowGeometry]){geometry.translate(-centre.x,0,-centre.z);geometry.computeBoundingSphere();}
  const material=near.material.clone();material.envMapIntensity=.65;material.side=THREE.FrontSide;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vCoastalHeight;').replace('#include <project_vertex>','vCoastalHeight=(modelMatrix*vec4(transformed,1.)).y;\n#include <project_vertex>');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCoastalHeight;').replace('#include <color_fragment>','#include <color_fragment>\nfloat dryCoast=smoothstep(-2.1,-.7,vCoastalHeight);diffuseColor.rgb*=mix(vec3(.53,.62,.62),vec3(1.),dryCoast);').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=mix(.54,1.,smoothstep(-2.1,-.7,vCoastalHeight));');
  };material.customProgramCacheKey=()=> 'scanned-coast-wet-v6';
  const specs=[{s:172,scale:.8,yaw:.21},{s:438,scale:1,yaw:-.16},{s:895,scale:.85,yaw:.46},{s:1375,scale:.95,yaw:-.24},{s:1980,scale:.8,yaw:.3}];
  const meshes=specs.map(({s,scale,yaw})=>{
    const mesh=new THREE.Mesh(lowGeometry,material);mesh.name='coast-scan-'+s;
    mesh.position.set(pathX(s)+groundHeight.shoreOffset(s)+29,-2.75,s);mesh.scale.set(.9*scale,2.5*scale,.68*scale);mesh.rotation.y=yaw;mesh.receiveShadow=true;
    mesh.userData.s=s;mesh.updateMatrixWorld(true);group.add(mesh);return mesh;
  });
  const highTriangles=highGeometry.index.count/3,lowTriangles=lowGeometry.index.count/3;
  const stats={version:6,placements:meshes.length,nearTriangles:highTriangles,farTriangles:lowTriangles,visible:0,triangles:0,drawCalls:0,shadowDrawCalls:0};
  const frustum=new THREE.Frustum(),matrix=new THREE.Matrix4();
  function update({playerS=75,quality='high',camera}={}){
    if(camera){camera.updateMatrixWorld();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));}
    stats.visible=stats.triangles=0;
    for(const mesh of meshes){const distance=Math.abs(mesh.userData.s-playerS);mesh.geometry=quality!=='low'&&distance<(quality==='high'?180:105)?highGeometry:lowGeometry;
      mesh.visible=distance<(quality==='low'?440:760)&&(!camera||frustum.intersectsObject(mesh));if(mesh.visible){stats.visible++;stats.triangles+=mesh.geometry.index.count/3;}}
    stats.drawCalls=stats.visible;
  }
  function dispose(){highGeometry.dispose();lowGeometry.dispose();material.dispose();}
  return {group,stats,update,dispose};
}
