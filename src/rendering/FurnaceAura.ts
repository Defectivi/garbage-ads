import * as T from 'three';
import type {Game} from '../game/Game';
import type {Point} from '../game/GameState';
/** Terrain-following warmth haze; material fog keeps whiteouts authoritative. */
export function furnaceAura(game:Game,point:Point & {rotation?:number},radius:number){
 const geometry=new T.PlaneGeometry(radius*2,radius*2,Math.min(64,Math.max(16,Math.ceil(radius/2))),Math.min(64,Math.max(16,Math.ceil(radius/2)))).rotateX(-Math.PI/2),vertices=geometry.attributes.position,base=game.world.height(point.x,point.z);
 for(let i=0;i<vertices.count;i++){const angle=point.rotation??0,lx=vertices.getX(i),lz=vertices.getZ(i),x=point.x+lx*Math.cos(angle)+lz*Math.sin(angle),z=point.z-lx*Math.sin(angle)+lz*Math.cos(angle);vertices.setY(i,Math.max(game.world.walkHeight(x,z),game.world.isWater(x,z)?.12:-Infinity)-base+.1);}
 const material=new T.MeshBasicMaterial({color:0xffa03c,transparent:true,opacity:.18,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),clock={value:0};
 material.onBeforeCompile=shader=>{
  shader.uniforms.uHeatTime=clock;shader.uniforms.uHeatRadius={value:radius};
  shader.vertexShader='varying vec2 vHeat; uniform float uHeatRadius;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHeat=position.xz/uHeatRadius;');
  shader.fragmentShader='varying vec2 vHeat; uniform float uHeatTime;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float d=length(vHeat);if(d>1.0)discard;
    float flow=sin(vHeat.x*18.0+sin(vHeat.y*11.0+uHeatTime*1.3)*2.0-uHeatTime*2.0);
    float flame=sin(d*25.0-uHeatTime*3.0+sin(atan(vHeat.y,vHeat.x)*7.0)*1.5);
    float wisps=smoothstep(0.2,0.95,flow)*smoothstep(-0.4,1.0,flame);
    diffuseColor.rgb=mix(vec3(1.0,0.55,0.12),vec3(1.0,0.22,0.035),wisps);
    diffuseColor.a=(0.075+wisps*0.13+smoothstep(0.65,1.0,d)*0.10)*(1.0-smoothstep(0.97,1.0,d));`);
 };
 const mesh=new T.Mesh(geometry,material);mesh.name='heat-aura';mesh.userData.radius=radius;mesh.userData.clock=clock;mesh.castShadow=false;return mesh;
}
