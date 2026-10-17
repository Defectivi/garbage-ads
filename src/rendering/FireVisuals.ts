import * as T from 'three';
import type {Game} from '../game/Game';
import type {Point} from '../game/GameState';
export function fireVisual(){
 const group=new T.Group();for(let i=0;i<4;i++){const flame=new T.Mesh(new T.ConeGeometry(.32-i*.045,1.15-i*.12,7),new T.MeshBasicMaterial({color:[0xf17624,0xffa333,0xffc65e,0xffe6a3][i],transparent:true,opacity:.88,depthWrite:false}));flame.position.set((i%2?1:-1)*.09,.4+i*.03,0);flame.userData.phase=i;flame.castShadow=false;group.add(flame);}return group;
}
export function animateFire(group:T.Object3D,time:number,reduced:boolean){for(const flame of group.children){const phase=flame.userData.phase??0;flame.scale.set(1,reduced?1:1+Math.sin(time*7+phase*1.8)*.22,1);flame.rotation.z=reduced?0:Math.sin(time*4+phase)*.13;}}
export function furnaceEmbers(game:Game,point:Point&{rotation?:number},radius:number){
 const count=Math.min(48,Math.ceil(radius*1.2)),positions:number[]=[],phase:number[]=[];
 for(let i=0;i<count;i++){const angle=i*2.399963,r=radius*Math.sqrt((i+.5)/count)*.92,x=Math.cos(angle)*r,z=Math.sin(angle)*r;const a=point.rotation??0;positions.push(x,game.world.height(point.x+x*Math.cos(a)+z*Math.sin(a),point.z-x*Math.sin(a)+z*Math.cos(a))-game.world.height(point.x,point.z)+.15,z);phase.push((i*.618)%1);}
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(16,16,1,16,16,15);gradient.addColorStop(0,'#fff6cc');gradient.addColorStop(.25,'#ffc261');gradient.addColorStop(.6,'#ed5c2277');gradient.addColorStop(1,'#ed5c2200');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);const texture=new T.CanvasTexture(canvas);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('aPhase',new T.Float32BufferAttribute(phase,1));const clock={value:0};
 const material=new T.PointsMaterial({color:0xffd489,size:.38,map:texture,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending});material.onBeforeCompile=shader=>{shader.uniforms.uEmberTime=clock;shader.vertexShader='uniform float uEmberTime;attribute float aPhase;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=mod(uEmberTime*.65+aPhase*3.,3.);transformed.x+=sin(uEmberTime+aPhase*12.)*.2;');};
 const points=new T.Points(geometry,material);points.name='heat-embers';points.userData.radius=radius;points.userData.clock=clock;points.userData.ownedTexture=texture;points.frustumCulled=false;return points;
}
