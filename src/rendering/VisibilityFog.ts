import * as T from 'three';
import type {GameState} from '../game/GameState';
import {lightSources,sightSettings} from '../systems/Visibility';
/** Player-centred fog is independent of the camera's zoom. Shared uniforms avoid material churn. */
export class VisibilityFog {
 readonly viewer={value:new T.Vector2()}; readonly weight={value:0}; readonly near={value:8}; readonly far={value:28};
 readonly lights={value:Array.from({length:8},()=>new T.Vector3(0,0,0))};
 update(scene:T.Scene,state:GameState,storm:number){
  const v=sightSettings(state,storm);this.viewer.value.set(state.player.x,state.player.z);this.weight.value=v.weight;this.near.value=v.near;this.far.value=v.far;
  const sources=lightSources(state);this.lights.value.forEach((l,i)=>l.set(sources[i]?.x??0,sources[i]?.z??0,sources[i]?.radius??0));
  scene.traverse(o=>{const m=(o as T.Mesh).material;if(m)for(const material of Array.isArray(m)?m:[m])this.install(material);});
 }
 private install(material:T.Material){
  if(material.userData.sightFog||!('fog'in material)||!material.fog)return;material.userData.sightFog=true;
  const before=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
  material.customProgramCacheKey=()=>oldKey+'|world-sight-v1';
  material.onBeforeCompile=(shader,renderer)=>{
   before.call(material,shader,renderer);Object.assign(shader.uniforms,{uSightViewer:this.viewer,uSightWeight:this.weight,uSightNear:this.near,uSightFar:this.far,uSightLights:this.lights});
   shader.vertexShader='varying vec2 vSightPosition;\n'+shader.vertexShader.replace('#include <fog_vertex>',`#include <fog_vertex>
    vec4 sightWorld=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
    sightWorld=instanceMatrix*sightWorld;
    #endif
    vSightPosition=(modelMatrix*sightWorld).xz;`);
   shader.fragmentShader='varying vec2 vSightPosition; uniform vec2 uSightViewer; uniform float uSightWeight,uSightNear,uSightFar; uniform vec3 uSightLights[8];\n'+shader.fragmentShader.replace('#include <fog_fragment>',`
    #ifdef USE_FOG
    float sightFog=smoothstep(uSightNear,uSightFar,distance(vSightPosition,uSightViewer));
    for(int i=0;i<8;i++){if(uSightLights[i].z>0.0)sightFog*=smoothstep(uSightLights[i].z*0.45,uSightLights[i].z,distance(vSightPosition,uSightLights[i].xy));}
    float normalFog=smoothstep(fogNear,fogFar,vFogDepth);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,mix(normalFog,sightFog,uSightWeight));
    #endif`);
  };material.needsUpdate=true;
 }
}
