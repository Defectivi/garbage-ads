import * as T from 'three';
import type {Cliff,WorldManager} from '../world/WorldManager';
import {derive,SeededRNG} from '../utils/SeededRNG';
/** Original low-poly escarpment; the entire outline stays inside its collision radius. */
export function cliffMesh(world:WorldManager,cliff:Cliff){
 const group=new T.Group(),rng=new SeededRNG(derive(world.spec.seeds.terrain,cliff.id)),sides=13,base=world.height(cliff.x,cliff.z),outline=Array.from({length:sides},()=>rng.range(.84,1));
 const levels=[0,.12,.28,.5,.72,1],radii=[1,.98,.91,.95,.82,.75],positions:number[]=[],colors:number[]=[],snow:number[]=[];
 const vertex=(layer:number,i:number):[number,number,number]=>{const index=i%sides,a=index*Math.PI*2/sides,r=cliff.radius*outline[index]*radii[layer],x=Math.cos(a)*r,z=Math.sin(a)*r;return[x,layer===0?world.height(cliff.x+x,cliff.z+z)-base-.8:cliff.height*levels[layer]+(layer===levels.length-1?Math.sin(index*2.7)*.6:Math.sin(index*3.1+layer)*.5),z];};
 const color=new T.Color();for(let layer=0;layer<levels.length-1;layer++)for(let i=0;i<sides;i++){
  const a=vertex(layer,i),b=vertex(layer,i+1),c=vertex(layer+1,i),d=vertex(layer+1,i+1);positions.push(...a,...c,...b,...b,...c,...d);color.setHex([0x65757a,0x879092,0x596c74,0x74838a,0x586e78][layer]).multiplyScalar(.88+rng.next()*.18);for(let j=0;j<6;j++)colors.push(color.r,color.g,color.b);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
 const rock=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));rock.castShadow=true;rock.receiveShadow=true;rock.name='ore-cliff';rock.userData.cliffId=cliff.id;rock.userData.height=cliff.height;group.add(rock);
 for(let i=0;i<sides;i++){const a=vertex(levels.length-1,i),b=vertex(levels.length-1,i+1);snow.push(0,cliff.height+.25,0,a[0],a[1]+.25,a[2],b[0],b[1]+.25,b[2]);}
 const capGeo=new T.BufferGeometry();capGeo.setAttribute('position',new T.Float32BufferAttribute(snow,3));capGeo.computeVertexNormals();const cap=new T.Mesh(capGeo,new T.MeshStandardMaterial({color:0xe5edf0,roughness:1,side:T.DoubleSide}));cap.name='cliff-snowcap';cap.receiveShadow=true;group.add(cap);group.position.set(cliff.x,base,cliff.z);return group;
}
