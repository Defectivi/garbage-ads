import * as T from 'three';

/** Original continuous contour quadruped; shared by the two bear appearances. */
export function createBearAsset(variant='bear-ivory') {
  const scene=new T.Group();scene.name=variant;
  const bones:T.Bone[]=[],ids:Record<string,number>={},world:T.Vector3[]=[];
  const bone=(name:string,parent:string|null,x:number,y:number,z:number)=>{const b=new T.Bone();b.name=name;ids[name]=bones.length;b.position.set(x,y,z);world.push(b.position.clone());bones.push(b);if(parent){b.position.sub(world[ids[parent]]);bones[ids[parent]].add(b);}else scene.add(b);};
  bone('Body',null,0,1,0);bone('BearHead','Body',0,1.4,1.05);
  for(const [name,x,z] of [['FL',-.46,.75],['FR',.46,.75],['BL',-.46,-.85],['BR',.46,-.85]] as const){bone(name,'Body',x,.95,z);bone(name+'Paw',name,x,.32,z);}
  const p:number[]=[],c:number[]=[],skin:number[]=[],weights:number[]=[],index:number[]=[];
  const col=new T.Color(variant==='bear-frost'?0xcbd7d7:0xe3dfca),dark=new T.Color(0x263c45);
  const v=(x:number,y:number,z:number,color:T.Color,bone:string)=>{p.push(x,y,z);c.push(color.r,color.g,color.b);skin.push(ids[bone],0,0,0);weights.push(1,0,0,0);return p.length/3-1;};
  const tube=(rings:number[][],axis:'y'|'z',color:T.Color,bone:string,n=14)=>{
    const first=p.length/3;
    for(const [at,r1,r2,a=0,b=0]of rings)for(let i=0;i<n;i++){const t=i/n*Math.PI*2;if(axis==='z')v(a+Math.sin(t)*r1,b+Math.cos(t)*r2,at,color,bone);else v(a+Math.sin(t)*r1,at,b+Math.cos(t)*r2,color,bone);}
    for(let r=0;r<rings.length-1;r++)for(let i=0;i<n;i++){const a=first+r*n+i,b=first+r*n+(i+1)%n;index.push(a,b,a+n,b,b+n,a+n);}
    for(const r of [0,rings.length-1]){const [at,,,a=0,b=0]=rings[r],center=axis==='z'?v(a,b,at,color,bone):v(a,at,b,color,bone);for(let i=0;i<n;i++)index.push(center,first+r*n+i,first+r*n+(i+1)%n);}
  };
  const patch=(points:number[][],color:T.Color,bone:string)=>{const start=p.length/3;for(const point of points)v(point[0],point[1],point[2],color,bone);for(let i=1;i<points.length-1;i++)index.push(start,start+i,start+i+1);};
  // Broad shoulder hump, long torso and tapered rump, rather than intersecting spheres.
  tube([[-1.36,.16,.2,0,1],[-1.2,.42,.5,0,1.02],[-.75,.58,.59,0,1.05],[0,.61,.62,0,1.08],[.55,.65,.69,0,1.18],[.95,.46,.5,0,1.27],[1.15,.29,.31,0,1.36]],'z',col,'Body');
  tube([[.87,.25,.28,0,1.43],[1.08,.34,.34,0,1.49],[1.35,.32,.29,0,1.47],[1.58,.22,.18,0,1.4],[1.84,.14,.115,0,1.36]],'z',col,'BearHead');
  tube([[1.79,.14,.10,0,1.37],[1.87,.125,.095,0,1.37]],'z',dark,'BearHead',10);
  for(const x of [-.24,.24])tube([[1.67,.10,.08,x,1.04],[1.82,.12,.09,x,1.04],[1.89,.06,.05,x,1.04]],'y',col,'BearHead',10);
  for(const sign of [-1,1])patch([[sign*.28,1.52,1.37],[sign*.255,1.57,1.4],[sign*.23,1.54,1.43],[sign*.25,1.51,1.41]],dark,'BearHead');
  for(const [name,x,z]of [['FL',-.46,.75],['FR',.46,.75],['BL',-.46,-.85],['BR',.46,-.85]] as const){
    tube([[.29,.17,.18,x,z],[.48,.175,.19,x,z],[.78,.21,.23,x,z],[1.12,.25,.26,x,z]],'y',col,name);
    tube([[.045,.20,.29,x,z+.09],[.12,.22,.31,x,z+.09],[.26,.18,.24,x,z+.04],[.35,.16,.18,x,z]],'y',col,name+'Paw');
    for(const offset of [-.1,0,.1])patch([[x+offset-.016,.055,z+.38],[x+offset+.016,.055,z+.38],[x+offset,.11,z+.43]],dark,name+'Paw');
  }
  if(variant==='bear-frost')patch([[.29,1.5,1.36],[.30,1.61,1.3],[.28,1.64,1.29],[.27,1.51,1.37]],new T.Color(0x9b8b80),'BearHead');
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('color',new T.Float32BufferAttribute(c,3));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skin,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.setIndex(index);geometry.computeVertexNormals();
  const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));mesh.name='Bear_fur';scene.add(mesh);scene.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
  const rotation=(name:string,values:number[],duration:number)=>new T.QuaternionKeyframeTrack(name+'.quaternion',values.map((_,i)=>i*duration/(values.length-1)),values.flatMap(x=>new T.Quaternion().setFromEuler(new T.Euler(x,0,0)).toArray()));
  const animations=[new T.AnimationClip('idle',3,[rotation('BearHead',[0,.035,0],3)]),new T.AnimationClip('walk',1.1,[rotation('FL',[.4,0,-.4,0,.4],1.1),rotation('BR',[.4,0,-.4,0,.4],1.1),rotation('FR',[-.4,0,.4,0,-.4],1.1),rotation('BL',[-.4,0,.4,0,-.4],1.1)]),new T.AnimationClip('attack',.65,[rotation('BearHead',[0,-.2,.3,0],.65),rotation('FL',[0,-.9,.3,0],.65)]),new T.AnimationClip('hurt',.3,[rotation('BearHead',[0,-.18,0],.3)])];
  scene.animations=animations;return {scene,animations};
}
