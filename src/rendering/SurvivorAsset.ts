import type { SurvivorStyle } from '../data/characters';
import * as T from 'three';

/** Original Wayfarer asset. Tailored contour meshes, vertex colours, one skinned draw call.
 * Coordinates are metres; feet at y=0, forward +Z. No external model or textures. */
export function createSurvivorAsset(style?: SurvivorStyle) {
  const root = new T.Group(); root.name = 'Wayfarer';
  const bones: T.Bone[] = [], names: Record<string, number> = {}, positions: T.Vector3[] = [];
  const bone = (name: string, parent: string | null, x: number, y: number, z: number) => {
    const b = new T.Bone(); b.name = name; names[name] = bones.length;
    const world = new T.Vector3(x,y,z); positions.push(world); bones.push(b);
    b.position.copy(world); if (parent) { b.position.sub(positions[names[parent]]); bones[names[parent]].add(b); } else root.add(b);
  };
  bone('Hips',null,0,1,0); bone('Spine','Hips',0,1.2,0); bone('Chest','Spine',0,1.49,0);
  bone('Neck','Chest',0,1.72,0); bone('Head','Neck',0,1.89,0);
  for(const [s,x] of [['L',-1],['R',1]] as const) {
    bone(`Arm${s}`,'Chest',x*.34,1.57,0); bone(`Elbow${s}`,`Arm${s}`,x*.43,1.21,.035); bone(`Hand${s}`,`Elbow${s}`,x*.45,.91,.08);
    bone(`Thigh${s}`,'Hips',x*.16,.98,0); bone(`Knee${s}`,`Thigh${s}`,x*.16,.56,0); bone(`Foot${s}`,`Knee${s}`,x*.16,.15,.02);
  }
  const p:number[]=[], c:number[]=[], si:number[]=[], sw:number[]=[], indices:number[]=[];
  // Each section is a hand-authored garment cross-section: y, half-width, half-depth, centre-x, centre-z.
  type Ring = [number,number,number,number?,number?];
  const vertex=(x:number,y:number,z:number,color:T.Color,a:string,b=a,blend=0) => {
    p.push(x,y,z); c.push(color.r,color.g,color.b); si.push(names[a],names[b],0,0); sw.push(1-blend,blend,0,0);
    return p.length/3-1;
  };
  const loft=(rings:Ring[],color:number,a:string,b=a,blendAt?: (y:number)=>number,n=12) => {
    const start=p.length/3, col=new T.Color(color);
    for(const [y,rx,rz,x=0,z=0] of rings) for(let i=0;i<n;i++) {
      const angle=i/n*Math.PI*2; vertex(x+Math.sin(angle)*rx,y,z+Math.cos(angle)*rz,col,a,b,blendAt?.(y)??0);
    }
    for(let r=0;r<rings.length-1;r++) for(let i=0;i<n;i++) { const j=(i+1)%n,u=start+r*n+i,v=start+r*n+j; indices.push(u,v,u+n,v,v+n,u+n); }
    for(const r of [0,rings.length-1]) { const [y,,,x=0,z=0]=rings[r], mid=vertex(x,y,z,col,a,b,blendAt?.(y)??0); for(let i=0;i<n;i++) { const u=start+r*n+i,v=start+r*n+(i+1)%n; if(r===0)indices.push(mid,v,u);else indices.push(mid,u,v); } }
  };
  const patch=(points:number[][],color:number,a:string) => { const start=p.length/3,col=new T.Color(color); for(const v of points)vertex(v[0],v[1],v[2],col,a); for(let i=1;i<points.length-1;i++)indices.push(start,start+i,start+i+1); };
  const clamp=(v:number)=>T.MathUtils.clamp(v,0,1);
  // Shaped insulated coat: flared hem, fitted waist, broad articulated shoulders, raised collar.
  loft([[.88,.28,.205],[.92,.31,.225],[1.05,.29,.225],[1.2,.275,.225],[1.4,.31,.23],[1.52,.35,.22],[1.61,.28,.19],[1.66,.16,.15]],(style?.coat ?? 0xb96c38),'Spine','Chest',y=>clamp((y-1.18)/.34));
  loft([[1.48,.334,.232],[1.54,.35,.225],[1.62,.28,.195],[1.665,.16,.153]],(style?.yoke ?? 0x334b59),'Chest');
  loft([[1.63,.15,.147],[1.73,.16,.16],[1.755,.135,.138]],0xddd1b4,'Neck');
  // Covered face, skin at temples/bridge, snug knit cap. Human proportions rather than a sphere head.
  loft([[1.76,.10,.105,0,.02],[1.8,.13,.125,0,.025],[1.9,.145,.14,0,.015],[2,.137,.13,0,0],[2.045,.10,.10]],(style?.skin ?? 0xc99f7a),'Head');
  loft([[1.77,.103,.11,0,.025],[1.83,.135,.135,0,.025],[1.885,.146,.143,0,.02]],0x526b6d,'Head');
  loft([[1.995,.145,.14],[2.04,.15,.145],[2.12,.125,.125],[2.155,.06,.07],[2.16,.008,.015]],(style?.hat ?? 0x263b49),'Head');
  loft([[1.98,.15,.145],[2.015,.154,.15],[2.04,.15,.145]],0x49616c,'Head');
  for(const x of [-1,1]) {
    patch([[x*.018,1.9,.162],[x*.13,1.91,.12],[x*.132,1.965,.12],[x*.015,1.972,.16]],0x162d39,'Head');
    patch([[x*.032,1.915,.166],[x*.118,1.922,.137],[x*.116,1.951,.137],[x*.03,1.957,.165]],0x98c5cf,'Head');
  }
  patch([[-.018,1.9,.16],[.018,1.9,.16],[0,1.925,.196]],0xd3ad88,'Head');
  // Zipper, chest pocket, shaped cargo pockets and narrow sewn straps.
  patch([[-.012,.94,.228],[.012,.94,.228],[.012,1.47,.237],[-.012,1.47,.237]],0x263c46,'Spine');
  for(const side of [-1,1]) {
    const x=side*.175;
    patch([[x-.07,1.04,.218],[x+.07,1.04,.218],[x+.075,1.22,.228],[x-.065,1.23,.228]],0x94522e,'Spine');
    patch([[x-.067,1.2,.233],[x+.075,1.19,.233],[x+.075,1.23,.234],[x-.067,1.24,.234]],0xd38a49,'Spine');
    patch([[side*.19,1.09,.24],[side*.23,1.09,.24],[side*.25,1.5,.217],[side*.21,1.53,.217]],0x344a47,'Chest');
  }
  patch([[.08,1.37,.239],[.22,1.37,.225],[.22,1.43,.229],[.08,1.43,.241]],0xe0c290,'Chest');
  // Arm sleeves and gloves: smooth joint weights around the elbows, tailored cuffs.
  for(const [s,sign] of [['L',-1],['R',1]] as const) {
    const x=(v:number)=>sign*v;
    loft([[.96,.095,.105,x(.45),.07],[1.07,.12,.13,x(.445),.05],[1.21,.13,.14,x(.43),.035],[1.39,.145,.155,x(.395),.01],[1.54,.17,.17,x(.34),0],[1.6,.12,.13,x(.32),0]],(style?.coat ?? 0xb96c38),`Arm${s}`,`Elbow${s}`,y=>clamp((1.32-y)/.22));
    loft([[.93,.10,.108,x(.45),.075],[1,.107,.115,x(.45),.07]],0x324b56,`Elbow${s}`);
    loft([[.8,.06,.075,x(.46),.11],[.84,.085,.09,x(.46),.105],[.93,.09,.095,x(.45),.08],[.96,.075,.08,x(.45),.075]],0x293c43,`Hand${s}`);
    // Thumb rests toward palm, rather than mitten-shaped sticks.
    loft([[.84,.035,.045,x(.39),.15],[.9,.043,.048,x(.39),.16],[.94,.025,.03,x(.4),.13]],0x354b4c,`Hand${s}`,`Hand${s}`,undefined,8);
    loft([[.22,.12,.12,x(.16),0],[.37,.125,.13,x(.16),0],[.56,.13,.14,x(.16),0],[.76,.15,.155,x(.16),0],[.98,.155,.17,x(.16),0],[1.04,.135,.14,x(.16),0]],(style?.trousers ?? 0x354b54),`Thigh${s}`,`Knee${s}`,y=>clamp((.66-y)/.20));
    loft([[.045,.13,.205,x(.16),.08],[.07,.142,.22,x(.16),.09],[.14,.14,.21,x(.16),.09],[.23,.116,.15,x(.16),.035],[.32,.12,.13,x(.16),0]],0x25363e,`Foot${s}`);
    loft([[.02,.135,.21,x(.16),.085],[.06,.145,.224,x(.16),.09],[.075,.14,.218,x(.16),.09]],0x192a32,`Foot${s}`);
    loft([[.265,.123,.135,x(.16),0],[.31,.125,.137,x(.16),0]],0x9a9c8b,`Knee${s}`);
  }
  if(style?.gear==='satchel') {
    loft([[.91,.1,.065,.32,-.04],[.98,.15,.09,.32,-.035],[1.2,.145,.09,.32,-.03],[1.25,.09,.06,.32,-.03]],style.pack,'Spine');
    patch([[-.25,1.52,.22],[-.22,1.54,.23],[.29,1.02,.2],[.27,.99,.2]],0x503d2f,'Chest');
  } else {
    loft([[1,.19,.10,0,-.29],[1.08,.245,.15,0,-.31],[1.4,.25,.16,0,-.31],[1.52,.22,.15,0,-.30],[1.58,.16,.10,0,-.28]],style?.pack ?? 0x53695c,'Chest');
    loft([[1.44,.254,.164,0,-.31],[1.54,.23,.16,0,-.31],[1.6,.17,.11,0,-.29]],0x708474,'Chest');
    loft([[.96,.2,.11,0,-.29],[1.035,.23,.135,0,-.3]],0x2e4645,'Spine');
  }
  if(style?.headwear==='hood') {
    const color=style.coat;
    // Open-front cloth shell, including a contrasting fur rim; the face stays visible.
    for(let i=0;i<12;i++) {
      const a=Math.PI/3+i*Math.PI*4/3/12,b=Math.PI/3+(i+1)*Math.PI*4/3/12;
      patch([[Math.sin(a)*.19,1.8,Math.cos(a)*.18],[Math.sin(b)*.19,1.8,Math.cos(b)*.18],[Math.sin(b)*.17,2.1,Math.cos(b)*.16],[Math.sin(a)*.17,2.1,Math.cos(a)*.16]],color,'Head');
    }
  }
  if(style?.headwear==='cap')patch([[-.155,2.015,.10],[.155,2.015,.10],[.14,2.005,.24],[-.14,2.005,.24]],style.hat,'Head');
  if(style?.gear==='tools') {
    loft([[1.11,.025,.028,.32,-.34],[1.65,.025,.028,.32,-.34]],0x8a6541,'Chest');
    patch([[.25,1.63,-.37],[.4,1.63,-.37],[.47,1.75,-.37],[.25,1.77,-.37]],0x8da0a2,'Chest');
  }
  if(style?.gear==='fuel')for(const x of [-.15,.15]){
    loft([[1.06,.09,.09,x,-.47],[1.12,.105,.1,x,-.47],[1.49,.105,.1,x,-.47],[1.54,.055,.055,x,-.47]],0x667343,'Chest');
    loft([[1.5,.035,.035,x,-.47],[1.58,.035,.035,x,-.47]],0xb39a61,'Chest');
  }
  if(style?.id.startsWith('guard')) {
    patch([[-.22,1.3,.237],[.22,1.3,.237],[.23,1.46,.242],[-.23,1.46,.242]],0x314652,'Chest');
    patch([[-.03,1.36,.246],[.03,1.36,.246],[.03,1.42,.246],[-.03,1.42,.246]],0xe2c48a,'Chest');
  }
  const geometry=new T.BufferGeometry(); geometry.setAttribute('position',new T.Float32BufferAttribute(p,3)); geometry.setAttribute('color',new T.Float32BufferAttribute(c,3));
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new T.SkinnedMesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:.02,side:T.DoubleSide}));mesh.name='Wayfarer_clothing';mesh.castShadow=true;mesh.receiveShadow=true;
  root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));mesh.frustumCulled=false;
  if(style){root.name=style.id;root.scale.set(style.width,style.height,style.width);root.userData.style=style.id;}
  const animations=survivorAnimations(); root.animations=animations;return { scene:root,animations };
}

type Pose=Record<string,number[][]>;
export function survivorAnimations() {
  const clips:T.AnimationClip[]=[];
  const clip=(name:string,duration:number,poses:Pose,hips?:number[])=>{
    const tracks:T.KeyframeTrack[]=[];
    for(const [bone,frames] of Object.entries(poses)) {
      const values:number[]=[];for(const [x=0,y=0,z=0] of frames){const q=new T.Quaternion().setFromEuler(new T.Euler(x,y,z));values.push(q.x,q.y,q.z,q.w);}
      tracks.push(new T.QuaternionKeyframeTrack(`${bone}.quaternion`,frames.map((_,i)=>duration*i/(frames.length-1)),values));
    }
    if(hips)tracks.push(new T.VectorKeyframeTrack('Hips.position',hips.map((_,i)=>duration*i/(hips.length-1)),hips.flatMap(y=>[0,y,0])));
    clips.push(new T.AnimationClip(name,duration,tracks));
  };
  const rest={ThighL:[[0,0,0],[0,0,0]],ThighR:[[0,0,0],[0,0,0]],KneeL:[[0,0,0],[0,0,0]],KneeR:[[0,0,0],[0,0,0]],FootL:[[0,0,0],[0,0,0]],FootR:[[0,0,0],[0,0,0]]};
  clip('idle',3,rest,[1,1.008,1]);
  for(const [name,duration,a] of [['walk',.9,.5],['sprint',.58,.85]] as const){clip(name,duration,{
    ThighL:[[0,0,0],[a,0,0],[0,0,0],[-a,0,0],[0,0,0]],ThighR:[[0,0,0],[-a,0,0],[0,0,0],[a,0,0],[0,0,0]],
    KneeL:[[0,0,0],[a*.2,0,0],[a,0,0],[0,0,0],[0,0,0]],KneeR:[[a,0,0],[0,0,0],[0,0,0],[a*.2,0,0],[a,0,0]],
    FootL:[[0,0,0],[-.15,0,0],[.1,0,0],[.15,0,0],[0,0,0]],FootR:[[.1,0,0],[.15,0,0],[0,0,0],[-.15,0,0],[.1,0,0]]
  },[1,1.025,1,1.025,1]);}
  clip('arms_idle',3,{Chest:[[.01,0,0],[.025,.015,0],[.01,0,0]],ArmL:[[0,0,.06],[.025,0,.075],[0,0,.06]],ArmR:[[0,0,-.06],[-.025,0,-.075],[0,0,-.06]],ElbowL:[[-.12,0,0],[-.14,0,0],[-.12,0,0]],ElbowR:[[-.12,0,0],[-.14,0,0],[-.12,0,0]],HandL:[[0,0,0],[0,0,0]],HandR:[[0,0,0],[0,0,0]],Head:[[0,-.025,0],[0,.025,0],[0,-.025,0]]});
  for(const [name,d,a] of [['arms_walk',.9,.4],['arms_sprint',.58,.65]] as const)clip(name,d,{
    Chest:[[(name==='arms_sprint'?.16:.05),0,0],[(name==='arms_sprint'?.16:.05),.05,0],[(name==='arms_sprint'?.16:.05),0,0],[(name==='arms_sprint'?.16:.05),-.05,0],[(name==='arms_sprint'?.16:.05),0,0]],ArmL:[[0,0,.07],[-a,0,.07],[0,0,.07],[a,0,.07],[0,0,.07]],ArmR:[[0,0,-.07],[a,0,-.07],[0,0,-.07],[-a,0,-.07],[0,0,-.07]],ElbowL:[[-.25,0,0],[-.4,0,0],[-.25,0,0]],ElbowR:[[-.25,0,0],[-.4,0,0],[-.25,0,0]],HandL:[[0,0,0],[0,0,0]],HandR:[[0,0,0],[0,0,0]]});
  const swing=(name:string,reach:number,duration:number)=>clip(name,duration,{Chest:[[0,-.25,0],[.08,.35,0],[0,0,0]],ArmR:[[-1.8,-.2,-.25],[reach,.2,-.2],[0,0,-.06]],ElbowR:[[-.7,0,0],[-.15,0,0],[-.12,0,0]],ArmL:[[-.3,0,.1],[-.5,0,.1],[0,0,.06]],HandR:[[.3,0,0],[.8,0,0],[0,0,0]]});
  swing('gather',-.2,.65);swing('wooden_sword',-.45,.55);swing('machete',-.2,.6);
  clip('punch',.45,{Chest:[[0,-.2,0],[0,.25,0],[0,0,0]],ArmR:[[-.6,0,-.1],[-1.5,0,-.1],[0,0,-.06]],ElbowR:[[-1.1,0,0],[-.05,0,0],[-.12,0,0]],HandR:[[0,0,0],[0,0,0],[0,0,0]]});
  clip('spear',.65,{Chest:[[0,-.2,0],[.12,.2,0],[0,0,0]],ArmR:[[-.5,0,-.3],[-1.4,0,-.1],[0,0,-.06]],ElbowR:[[-1,0,0],[0,0,0],[-.12,0,0]],HandR:[[1.2,0,0],[1.4,0,0],[0,0,0]]});
  clip('bow',.8,{Chest:[[0,.25,0],[0,.25,0],[0,0,0]],ArmL:[[-1.35,0,-.3],[-1.35,0,-.3],[0,0,.06]],ElbowL:[[-.1,0,0],[-.1,0,0],[-.12,0,0]],HandL:[[1.45,0,0],[1.45,0,0],[0,0,0]],ArmR:[[-1.2,0,.2],[-1.2,0,.2],[0,0,-.06]],ElbowR:[[-1.2,0,-.4],[-.4,0,-.2],[-.12,0,0]],HandR:[[1.5,0,0],[1.5,0,0],[0,0,0]]});
  clip('shotgun',.65,{Chest:[[0,0,0],[-.08,0,0],[0,0,0]],ArmR:[[-1.15,0,.15],[-1.35,0,.15],[0,0,-.06]],ElbowR:[[-.5,0,0],[-.5,0,0],[-.12,0,0]],HandR:[[1.65,0,0],[1.85,0,0],[0,0,0]],ArmL:[[-1.4,0,-.6],[-1.5,0,-.6],[0,0,.06]],ElbowL:[[-.25,0,0],[-.25,0,0],[-.12,0,0]],HandL:[[1.65,0,0],[1.75,0,0],[0,0,0]]});
  clip('molotov',.85,{Chest:[[0,-.4,0],[.15,.3,0],[0,0,0]],ArmR:[[-2.6,0,-.2],[-.8,0,0],[0,0,-.06]],ElbowR:[[-1,0,0],[-.1,0,0],[-.12,0,0]],HandR:[[.2,0,0],[.7,0,0],[0,0,0]]});
  clip('hurt',.3,{Chest:[[0,0,0],[-.2,0,.12],[0,0,0]],Head:[[0,0,0],[.1,0,-.1],[0,0,0]]});
  clip('death',.9,{Hips:[[0,0,0],[.2,0,.4],[0,0,1.4]],Chest:[[0,0,0],[.3,0,.15],[.1,0,0]],ArmL:[[0,0,.1],[-.7,0,.4],[-.2,0,.1]],ArmR:[[0,0,-.1],[-.7,0,-.4],[-.2,0,-.1]]},[1,.65,.22]);
  return clips;
}
