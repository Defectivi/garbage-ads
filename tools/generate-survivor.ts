import { mkdirSync,writeFileSync } from 'node:fs';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { CHARACTER_STYLES } from '../src/data/characters';
import { createBearAsset } from '../src/rendering/BearAsset';
import { createSurvivorAsset } from '../src/rendering/SurvivorAsset';
class LocalFileReader {
 result: ArrayBuffer|null=null; onloadend: (()=>void)|null=null;
 readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}
}
Object.assign(globalThis,{FileReader:LocalFileReader});
const asset=createSurvivorAsset();
const result=await new GLTFExporter().parseAsync(asset.scene,{binary:true,animations:asset.animations,onlyVisible:false});
mkdirSync('public/models',{recursive:true});writeFileSync('public/models/wayfarer.glb',Buffer.from(result as ArrayBuffer));
console.log(`Original Wayfarer GLB generated: ${(result as ArrayBuffer).byteLength} bytes, ${asset.animations.length} animation clips.`);

for(const style of CHARACTER_STYLES) {
 const variant=createSurvivorAsset(style);const glb=await new GLTFExporter().parseAsync(variant.scene,{binary:true,animations:variant.animations});
 writeFileSync(`public/models/${style.id}.glb`,Buffer.from(glb as ArrayBuffer));
}
for(const name of ['bear-ivory','bear-frost']) {const asset=createBearAsset(name);const glb=await new GLTFExporter().parseAsync(asset.scene,{binary:true,animations:asset.animations});writeFileSync(`public/models/${name}.glb`,Buffer.from(glb as ArrayBuffer));}
console.log('Prepared 14 humanoid NPC appearances and 2 rigged polar bear models.');
