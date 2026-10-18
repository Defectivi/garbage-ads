import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {fireVisual,animateFire,furnaceEmbers} from './FireVisuals';
import {cliffMesh} from './CliffMesh';
import {visibilityAt} from '../systems/Visibility';
import {VisibilityFog} from './VisibilityFog';
import {nightBlend} from '../systems/DayNight';
import {furnaceAura} from './FurnaceAura';
import {weatherVisibility} from './WeatherVisibility';
import { structureMaxHP } from '../data/settlement';
import { weaponMesh } from './WeaponModels';
import type { LootPile } from '../systems/SettlementSystem';
import { SnowWeather } from './SnowWeather';
import { NPCCharacter } from './NPCCharacter';
import { characterStyle } from '../data/characters';
import * as THREE from 'three';
import type { Game } from '../game/Game';
import { BUILDINGS, CONSTRUCTION_SECONDS, type BuildingType } from '../data/definitions';
import { CombatRenderer } from './CombatRenderer';
import { PlayerCharacter } from './PlayerCharacter';
import { heatRadius, furnaceTier } from '../systems/SurvivalSystem';
import type { Chunk, Ruin } from '../world/WorldManager';

const mat = (color: number, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .92, ...extra });
export class Renderer {
  private sightFog=new VisibilityFog();private torch=new THREE.PointLight(0xffa047,0,18,1.5);
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(48, 1, .1, 220);
  readonly webgl: THREE.WebGLRenderer;
  private budgetMode:boolean|undefined;private lastShadow=-Infinity;
  yaw = .45; zoom = 34; private target = new THREE.Vector3();
  private dirtyChunks = new Set<string>(); private chunks = new Map<string, THREE.Group>(); private entities = new THREE.Group(); private markers = new THREE.Group();
  readonly playerCharacter = new PlayerCharacter(); private player = this.playerCharacter.object; private dynamic = new Map<string, THREE.Group>();
  private residents = new Map<string,NPCCharacter>();
  private preview?: THREE.Group; private ray = new THREE.Raycaster(); private sun: THREE.DirectionalLight;
  private falls:{group:THREE.Group;age:number}[]=[];
  private shaking?:{id:string;entries:{mesh:THREE.InstancedMesh;index:number;matrix:THREE.Matrix4}[]};
  private weather = new SnowWeather(); private snowfall = this.weather.points;
  private reducedMotion=matchMedia('(prefers-reduced-motion: reduce)'); private combatVisual = new CombatRenderer();
  private materials = { snow: mat(0xe4edf0), dark: mat(0x314e5b), wood: mat(0x87664b), ice: mat(0x658d9f), metal: mat(0x5a7279), gold:mat(0xd9ae4c,{metalness:.5,roughness:.45}), fire: mat(0xffa343, { emissive: 0xff781c, emissiveIntensity: 1.6 }), water: mat(0x407e9c, { roughness: .25, metalness: .25, transparent: true, opacity: .87 }) };
  private flowTime={value:0};
  constructor(private host: HTMLElement, public game: Game) {
    this.materials.water.onBeforeCompile=shader=>{
      shader.uniforms.uFlowTime=this.flowTime;
      shader.vertexShader='varying vec2 vRiver;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRiver=(modelMatrix*vec4(transformed,1.0)).xz;');
      shader.fragmentShader='uniform float uFlowTime; varying vec2 vRiver;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat wave=sin(vRiver.y*5.0+sin(vRiver.x*0.45-uFlowTime)*0.65);float breaks=0.5+0.5*sin(vRiver.x*0.7-uFlowTime*1.4+cos(vRiver.y*2.3));float foam=smoothstep(0.94,1.0,wave)*smoothstep(0.35,0.85,breaks);diffuseColor.rgb*=0.94+0.06*sin(vRiver.x*2.0-uFlowTime*3.0+vRiver.y*0.7);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.67,0.86,0.91),foam*0.25);');
    };
    try { this.webgl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch { throw new Error('Frostbound needs WebGL 2. Enable hardware acceleration or try a modern browser with WebGL support.'); }
    this.webgl.setPixelRatio(Math.min(devicePixelRatio, 1.75)); this.webgl.shadowMap.enabled = true; this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.webgl.outputColorSpace = THREE.SRGBColorSpace; this.webgl.toneMapping = THREE.ACESFilmicToneMapping; this.webgl.toneMappingExposure = 1.18;
    host.appendChild(this.webgl.domElement); this.scene.background = new THREE.Color(0xb4cbd9); this.scene.fog = new THREE.Fog(0xb4cbd9, 42, 110);
    this.scene.add(new THREE.HemisphereLight(0xd8ebff, 0x75899a, 2.2));
    this.sun = new THREE.DirectionalLight(0xfff5dd, 3); this.sun.position.set(-22, 35, 15); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024); Object.assign(this.sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 100 }); this.sun.shadow.bias = -.001; this.sun.shadow.normalBias = .04;
    this.scene.add(this.sun, this.sun.target, this.entities, this.markers, this.player, this.combatVisual.group);
    this.scene.add(this.snowfall,this.torch);
    const marker = new THREE.Mesh(new THREE.RingGeometry(.48, .6, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xc38e50, transparent: true, opacity: .65, depthTest: false, depthWrite: false })); marker.position.y = .04; marker.renderOrder = 100; this.player.add(marker);
    this.camera.position.set(20, 28, 30); this.target.set(0, 1, 0); this.resize();
  }
  private mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) { const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
  private box(group: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) { const m = this.mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z); group.add(m); return m; }
  private building(type: BuildingType | 'ruin', rotation = 0) {
    const group = new THREE.Group();
    if(type==='workshop'){
      group.name='blacksmith-workshop';const brick=mat(0x6d6660),iron=this.materials.metal;
      this.box(group,0,.15,0,5,.3,4.2,this.materials.ice);this.box(group,-1.3,1.1,-.65,1.8,2,1.8,brick);this.box(group,-1.3,1.5,.3,1.2,.8,.08,this.materials.dark);
      for(const side of [-1,1])this.box(group,-1.3+side*.7,1.5,.35,.25,1.5,.3,iron);
      this.box(group,-1.3,3.5,-.65,.85,3,.9,brick);for(let i=0;i<5;i++)this.box(group,-1.3,2.5+i*.42,-.65,.96,.12,1,this.materials.dark);
      const fire=fireVisual();fire.name='forge-fire';fire.position.set(-1.3,1.25,.45);fire.scale.set(.7,.7,.4);group.add(fire);const light=new THREE.PointLight(0xffa454,12,8,1.5);light.position.set(-1.3,1.6,1);group.add(light);
      this.box(group,1.15,.7,1,1.1,1.1,.8,this.materials.wood);this.box(group,1.15,1.35,1,1.5,.28,.55,iron);this.box(group,1.15,1.15,1,.55,.4,.4,iron);const horn=this.mesh(new THREE.ConeGeometry(.26,.85,5),iron,2,1.38,1);horn.rotation.z=-Math.PI/2;group.add(horn);
      for(const x of [-2.2,2.2])this.box(group,x,1.6,-1.5,.2,3,.2,this.materials.wood);this.box(group,.1,3,-1,4.7,.25,2.1,this.materials.snow);this.box(group,.8,1,-1,2.1,.15,.9,this.materials.wood);for(let i=0;i<3;i++)this.box(group,.2+i*.6,1.15,-1,.28,.2,.3,iron);
      group.rotation.y=rotation;return group;
    }
    if(type==='shelter'){
      for(let i=0;i<8;i++){const a=i*Math.PI/4;group.add(this.mesh(new THREE.DodecahedronGeometry(.22,0),this.materials.ice,Math.sin(a)*.75,.15,Math.cos(a)*.75));}
      for(const side of [-1,1]){const log=this.box(group,0,.18,0,1.2,.22,.22,this.materials.wood);log.rotation.y=side*.6;}
      const flame=this.mesh(new THREE.ConeGeometry(.4,1.1,7),this.materials.fire,0,.65);flame.name='camp-flame';group.add(flame);const glow=new THREE.PointLight(0xff9b45,22,12,1.5);glow.name='camp-light';glow.position.y=1;group.add(glow);group.rotation.y=rotation;return group;
    }
    if (type === 'furnace') {
      const steel = this.materials?.metal ?? mat(0x5a7279), dark = this.materials?.dark ?? mat(0x314e5b);
      group.add(this.mesh(new THREE.CylinderGeometry(.82, 1.2, 2.4, 10), steel, 0, 1.6));
      group.add(this.mesh(new THREE.CylinderGeometry(.32, .42, 2, 8), dark, 0, 3.65));
      for (const side of [-1, 1]) this.box(group, side * .7, .3, 0, .2, .6, .6, dark);
      const flame=fireVisual();flame.position.set(0,.9,.98);flame.scale.set(.8,1,.35);flame.name='flame';group.add(flame);
      const stone=mat(0x8a7a69);for(let i=0;i<10;i++){const a=i*Math.PI/5,block=this.box(group,Math.cos(a)*1.08,.35,Math.sin(a)*1.08,.65,.6,.4,stone);block.rotation.y=-a;}for(const y of [.65,2.65]){const band=this.mesh(new THREE.TorusGeometry(1.05,.08,5,12),dark,0,y,0);band.rotation.x=Math.PI/2;group.add(band);}this.box(group,1.15,1.45,0,.16,1.7,.16,steel);
      for (let i = -1; i <= 1; i++) this.box(group, i * .32, 1.2, 1.06, .07, 1.3, .08, dark);
      const light = new THREE.PointLight(0xff8d32, 30, 18, 1.6); light.position.set(0, 2, 1.3); light.name = 'warm-light'; group.add(light);
    } else {
      const wood = this.materials.wood, snow = this.materials.snow, wall = mat(type === 'storage' ? 0x6d8385 : 0x9b7953);
      this.box(group, 0, .15, 0, 4.4, .3, 3.8, mat(0x83949b));
      if (type === 'ruin') {
        this.box(group, -1.8, 1.25, 0, .3, 2.3, 3.4, wood); this.box(group, .4, 1, -1.5, 3.7, 1.9, .3, wood);
        for (let i = 0; i < 4; i++) { const b = this.box(group, .5 + i * .35, .4 + i * .05, .6, 3.5, .25, .25, wood); b.rotation.y = i * .4; }
        this.box(group, -1.8, 2.5, 0, .5, .2, 3.7, snow);
      } else {
        this.box(group, 0, 1.25, 0, 3.8, 2.4, 3.2, wall);
        for (let i = 0; i < 5; i++) this.box(group, 0, .4 + i * .43, 1.62, 3.85, .08, .07, wood);
        const roof = this.mesh(new THREE.ConeGeometry(3.1, 2, 4), snow, 0, 3.25); roof.rotation.y = Math.PI / 4; roof.scale.z = .9; group.add(roof);
        this.box(group, -.75, 1, 1.66, .85, 1.8, .09, this.materials.dark);
        this.box(group, .85, 1.45, 1.68, .8, .7, .1, mat(0xf6be6c, { emissive: 0xa35d1d, emissiveIntensity: .7 }));
        this.box(group, .85, 1.45, 1.75, .05, .8, .04, wood);
        this.box(group, 1, 3.7, -.5, .5, 1.3, .5, this.materials.metal);
      }
    }
    if(type==='city_store'){
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#bc934d';ctx.fillRect(0,0,256,64);ctx.fillStyle='#20343d';ctx.font='bold 30px Consolas,monospace';ctx.textAlign='center';ctx.fillText('CITY STORE',128,43);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sign=this.mesh(new THREE.PlaneGeometry(3.7,.92),new THREE.MeshBasicMaterial({map:texture}),0,2.5,1.82);sign.userData.ownedTexture=texture;group.add(sign);group.name='city-store';
    }
    group.rotation.y = rotation; return group;
  }
  private instance(group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, points: { x: number; y: number; z: number; sx?: number; sy?: number; sz?: number; rotation?: number; id?:string }[]) {
    if (!points.length) { geometry.dispose(); return; }
    const mesh = new THREE.InstancedMesh(geometry, material, points.length), o = new THREE.Object3D();
    points.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1); o.rotation.y = p.rotation ?? 0; o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    if(points.some(p=>p.id))mesh.userData.treeIds=points.map(p=>p.id);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.instanceMatrix.needsUpdate = true; group.add(mesh);
  }
  private chunk(data: Chunk) {
    const g = new THREE.Group(), w = this.game.world, size = w.spec.config.chunkSize, x0 = data.cx * size, z0 = data.cz * size;
    const terrain = new THREE.PlaneGeometry(size, size, 16, 16); terrain.rotateX(-Math.PI / 2); terrain.translate(x0 + size / 2, 0, z0 + size / 2);
    const pos = terrain.attributes.position, colors: number[] = [], color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), y = w.height(x, z); pos.setY(i, y); const river = w.river(x, z); color.setHex(y < .1 && river.distance < river.width + 2 ? 0x839ea9 : 0xe0ebef); color.multiplyScalar(1 - Math.max(0, y) * .007); colors.push(color.r, color.g, color.b); }
    terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrain.computeVertexNormals();
    const ground = this.mesh(terrain, mat(0xffffff, { vertexColors: true })); ground.castShadow = false; g.add(ground);
    const trees = data.trees.map((t,i)=>({...t,id:`tree:${data.cx}:${data.cz}:${i}`})).filter((t) => !w.bridgeAt(t.x,t.z)&&!this.game.state.combat.charredTrees.includes(t.id)&&this.game.state.changes.terrain?.[t.id]!=='felled').map(t => ({ ...t, y: w.height(t.x, t.z) }));
    this.instance(g, new THREE.CylinderGeometry(.16, .25, 2.2, 5), this.materials.wood, trees.map(t => ({ id:t.id, x: t.x, y: t.y + t.scale, z: t.z, sx: t.scale, sy: t.scale, sz: t.scale })));
    // Identical crowns, two material batches instead of six draw calls per chunk.
    for(const snowy of [false,true]){
      const layers=Array.from({length:3},(_,layer)=>new THREE.ConeGeometry((snowy?1.78:1.7)*(1-layer*.23),snowy?2.35:2.5,7).translate(0,(snowy?2.75:2.5)+layer*1.25,0));
      const canopy=mergeGeometries(layers)!;layers.forEach(g=>g.dispose());
      this.instance(g,canopy,snowy?this.materials.snow:this.materials.dark,trees.map(t=>({id:t.id,x:t.x,y:t.y,z:t.z,sx:t.scale,sy:t.scale,sz:t.scale})));
    }
    const stumps=data.trees.map((t,i)=>({...t,id:`tree:${data.cx}:${data.cz}:${i}`})).filter(t=>this.game.state.changes.treeRegrowth?.[t.id]!==undefined);
    this.instance(g,new THREE.CylinderGeometry(.25,.36,.55,7),this.materials.wood,stumps.map(t=>({id:t.id,x:t.x,y:w.height(t.x,t.z)+.25,z:t.z,sx:t.scale,sy:1,sz:t.scale})));
    const stumpMesh=g.children.at(-1);if(stumps.length&&stumpMesh){stumpMesh.userData.stumpIds=stumps.map(t=>t.id);delete stumpMesh.userData.treeIds;}
    const nodes = this.game.nodesInChunk(data);
    for (const resource of ['wood', 'stone', 'metal', 'gold', 'charcoal'] as const) {
      const points = nodes.filter(n => n.kind!=='tree'&&this.game.nodeResource(n) === resource && this.game.nodeRemaining(n) > 0 && !w.isWater(n.x, n.z)).map(n => ({ x: n.x, y: w.height(n.x, n.z) + (n.kind==='boulder'?1.1:.45), z: n.z, sx: n.kind==='boulder'?1.8:n.kind==='fragment'?.45:resource === 'wood' ? 1.3 : .9, sy: n.kind==='boulder'?1.6:n.kind==='fragment'?.4:resource === 'wood' ? .5 : .8, sz:n.kind==='boulder'?1.6:n.kind==='fragment'?.45:.7, rotation: n.x }));
      this.instance(g, resource === 'wood' ? new THREE.CylinderGeometry(.4, .4, 2, 7).rotateZ(Math.PI / 2) : new THREE.DodecahedronGeometry(.85, 0), resource === 'charcoal' ? this.materials.dark : this.materials[resource === 'wood' ? 'wood' : resource === 'stone' ? 'ice' : resource==='gold'?'gold':'metal'], points);
    }
    for(const cliff of w.cliffs({x:x0+size/2,z:z0+size/2}))if(Math.floor(cliff.x/size)===data.cx&&Math.floor(cliff.z/size)===data.cz){
      g.add(cliffMesh(w,cliff));
    }
    if (w.spec.config.riverDensity > 0) {
      const vertices: number[] = [];
      for (let x = x0; x < x0 + size; x += 2) {
        const a = w.river(x, z0 + size / 2), b = w.river(x + 2, z0 + size / 2);
        if (a.center + a.width < z0 || a.center - a.width > z0 + size) continue;
        const za = Math.max(z0, a.center - a.width), zb = Math.min(z0 + size, a.center + a.width), zc = Math.max(z0, b.center - b.width), zd = Math.min(z0 + size, b.center + b.width);
        vertices.push(x, .12, za, x, .12, zb, x + 2, .12, zc, x, .12, zb, x + 2, .12, zd, x + 2, .12, zc);
      }
      if (vertices.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.computeVertexNormals(); const water = this.mesh(geo, this.materials.water); water.castShadow = false; g.add(water); }
      for(const lake of w.lakes({x:x0+size/2,z:z0+size/2}))if(Math.floor(lake.x/size)===data.cx&&Math.floor(lake.z/size)===data.cz){
        const water=this.mesh(new THREE.CircleGeometry(1,64).rotateX(-Math.PI/2),this.materials.water,lake.x,.12,lake.z);water.scale.set(lake.rx,1,lake.rz);water.castShadow=false;water.name='lake-water';water.userData.lakeId=lake.id;g.add(water);
      }
      for (let x = Math.ceil(x0 / 64) * 64; x < x0 + size; x += 64) { const r = w.river(x, z0 + size / 2); if (r.center < z0 || r.center >= z0 + size) continue; this.box(g, x, .45, r.center, 4.7, .4, r.width * 2 + 3, this.materials.wood); for (const side of [-1, 1]) this.box(g, x + side * 2.3, 1.05, r.center, .12, .16, r.width * 2 + 3, this.materials.snow); }
    }
    for (const r of [...data.ruins, ...w.villages().filter(v => Math.floor(v.x / size) === data.cx && Math.floor(v.z / size) === data.cz)]) this.addRuin(g, r);
    for (const f of data.fishing) { const post = this.mesh(new THREE.CylinderGeometry(.08, .08, 1.5, 5), this.materials.wood, f.x, w.height(f.x, f.z) + .75, f.z); g.add(post); this.box(g, f.x, w.height(f.x, f.z) + 1.35, f.z, .85, .4, .12, mat(0x5a94a6)); }
    return g;
  }
  private constructionModel(type:BuildingType){
    const g=new THREE.Group();g.name='hut-construction';g.scale.x=g.scale.z=BUILDINGS[type].radius/2;g.userData.constructionHeight=type==='shelter'?.35:1;this.box(g,0,.15,0,4,.3,4,this.materials.wood);
    for(const x of [-1.8,1.8])for(const z of [-1.8,1.8])this.box(g,x,1.5,z,.18,3,.18,this.materials.wood);
    for(const z of [-1.8,1.8]){this.box(g,0,2.8,z,4,.18,.18,this.materials.wood);const brace=this.box(g,0,1.4,z,.14,4,.14,this.materials.wood);brace.rotation.z=.9;}
    return g;
  }
  private ruinedBuilding(type:BuildingType,rotation:number){
    const group=this.building('ruin',rotation);group.name=`ruined-${type}`;
    if(type==='storage'){for(let i=0;i<3;i++)this.box(group,-1+i,.45,.5,.65,.65,.7,this.materials.ice);this.box(group,0,.1,0,4.8,.25,4.3,this.materials.metal);}
    if(type==='furnace'){const shell=this.mesh(new THREE.CylinderGeometry(.7,1.15,1.1,8),this.materials.metal,0,.65);group.add(shell);const chimney=this.box(group,.5,.4,.4,.5,.5,2.6,this.materials.dark);chimney.rotation.y=.65;}
    if(type==='workshop'){
      group.name='blacksmith-workshop';const brick=mat(0x6d6660),iron=this.materials.metal;
      this.box(group,0,.15,0,5,.3,4.2,this.materials.ice);this.box(group,-1.3,1.1,-.65,1.8,2,1.8,brick);this.box(group,-1.3,1.5,.3,1.2,.8,.08,this.materials.dark);
      for(const side of [-1,1])this.box(group,-1.3+side*.7,1.5,.35,.25,1.5,.3,iron);
      this.box(group,-1.3,3.5,-.65,.85,3,.9,brick);for(let i=0;i<5;i++)this.box(group,-1.3,2.5+i*.42,-.65,.96,.12,1,this.materials.dark);
      const fire=fireVisual();fire.name='forge-fire';fire.position.set(-1.3,1.25,.45);fire.scale.set(.7,.7,.4);group.add(fire);const light=new THREE.PointLight(0xffa454,12,8,1.5);light.position.set(-1.3,1.6,1);group.add(light);
      this.box(group,1.15,.7,1,1.1,1.1,.8,this.materials.wood);this.box(group,1.15,1.35,1,1.5,.28,.55,iron);this.box(group,1.15,1.15,1,.55,.4,.4,iron);const horn=this.mesh(new THREE.ConeGeometry(.26,.85,5),iron,2,1.38,1);horn.rotation.z=-Math.PI/2;group.add(horn);
      for(const x of [-2.2,2.2])this.box(group,x,1.6,-1.5,.2,3,.2,this.materials.wood);this.box(group,.1,3,-1,4.7,.25,2.1,this.materials.snow);this.box(group,.8,1,-1,2.1,.15,.9,this.materials.wood);for(let i=0;i<3;i++)this.box(group,.2+i*.6,1.15,-1,.28,.2,.3,iron);
      group.rotation.y=rotation;return group;
    }
    if(type==='shelter'){group.scale.y=.6;for(const side of [-1,1]){const post=this.box(group,side*1.3,.6,0,.2,1.4,.2,this.materials.wood);post.rotation.z=side*.4;}}
    return group;
  }
  private structureBar(group:THREE.Group,fraction:number,damaged:boolean){
    let bar=group.getObjectByName('structure-health') as THREE.Group|undefined;
    if(!bar){bar=new THREE.Group();bar.name='structure-health';bar.position.y=5.4;const background=this.box(bar,0,0,0,3,.13,.03,this.materials.dark);background.castShadow=false;const fill=this.box(bar,0,0,.025,3,.075,.02,mat(0xe7b16c));fill.name='integrity-fill';fill.castShadow=false;group.add(bar);}
    const fill=bar.getObjectByName('integrity-fill')!;fill.scale.x=fraction;fill.position.x=-1.5+fraction*1.5;bar.quaternion.copy(group.quaternion).invert().multiply(this.camera.quaternion);bar.visible=damaged;
  }
  private lootModel(pile:LootPile){
    const g=new THREE.Group();g.name='supply-pile';g.userData.lootId=pile.id;
    const weapon=!!pile.weapon,food=pile.category==='food'||(pile.resources.meat??0)>0||(pile.resources.fish??0)>0,color=weapon?0xe1b76a:food?0xd9a37c:0x89b1ad;
    this.box(g,0,.22,0,.65,.44,.6,this.materials.wood);this.box(g,0,.45,0,.72,.07,.65,this.materials.metal);
    if(pile.weapon){const mesh=weaponMesh(pile.weapon,true);mesh.position.y=.8;mesh.rotation.z=-.65;g.add(mesh);}
    else{const bundle=this.mesh(new THREE.DodecahedronGeometry(.27,0),mat(color),0,.65);bundle.scale.set(1,.75,.65);g.add(bundle);}
    const ring=this.mesh(new THREE.RingGeometry(.52,.58,20).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false}),0,.04);ring.castShadow=false;g.add(ring);return g;
  }
  private treeModel(scale:number){
    const g=new THREE.Group();g.add(this.mesh(new THREE.CylinderGeometry(.16,.25,2.2,5),this.materials.wood,0,scale));
    g.children[0].scale.setScalar(scale);
    for(let layer=0;layer<3;layer++){const size=1-layer*.23;const leaves=this.mesh(new THREE.ConeGeometry(1.7*size,2.5,7),this.materials.dark,0,(2.5+layer*1.25)*scale),snow=this.mesh(new THREE.ConeGeometry(1.78*size,2.35,7),this.materials.snow,0,(2.75+layer*1.25)*scale);leaves.scale.setScalar(scale);snow.scale.setScalar(scale);g.add(leaves,snow);}return g;
  }
  private terrainFeedback(dt:number){
    const node=this.game.gathering?.node??[...this.game.harvestTargets.values()].find(n=>n.kind==='tree'&&this.chunks.has(`${Math.floor(n.x/this.game.world.spec.config.chunkSize)},${Math.floor(n.z/this.game.world.spec.config.chunkSize)}`)),reduced=this.reducedMotion.matches;
    if(this.shaking?.id!==node?.id){if(this.shaking)for(const e of this.shaking.entries)if(e.mesh.parent){e.mesh.setMatrixAt(e.index,e.matrix);e.mesh.instanceMatrix.needsUpdate=true;}this.shaking=undefined;}
    if(node?.kind==='tree'&&!this.shaking){const entries:{mesh:THREE.InstancedMesh;index:number;matrix:THREE.Matrix4}[]=[];for(const chunk of this.chunks.values())chunk.traverse(o=>{if(o instanceof THREE.InstancedMesh){const index=(o.userData.treeIds as string[]|undefined)?.indexOf(node.id)??-1;if(index>=0){const matrix=new THREE.Matrix4();o.getMatrixAt(index,matrix);entries.push({mesh:o,index,matrix});}}});this.shaking={id:node.id,entries};}
    if(this.shaking&&!reduced){const offset=Math.sin(this.game.state.elapsed*45)*.045;for(const e of this.shaking.entries)if(e.mesh.parent){const matrix=e.matrix.clone();matrix.elements[12]+=offset;e.mesh.setMatrixAt(e.index,matrix);e.mesh.instanceMatrix.needsUpdate=true;}}
    for(const event of this.game.terrainEvents.splice(0)){
      for(const chunk of this.chunks.values())chunk.traverse(o=>{if(o instanceof THREE.InstancedMesh){const ids=o.userData.treeIds as string[]|undefined;if(!ids)return;for(let i=0;i<ids.length;i++)if(ids[i]===event.id){o.setMatrixAt(i,new THREE.Matrix4().makeScale(0,0,0));o.instanceMatrix.needsUpdate=true;}}});
      if(!reduced&&this.chunks.has(`${Math.floor(event.x/this.game.world.spec.config.chunkSize)},${Math.floor(event.z/this.game.world.spec.config.chunkSize)}`)){if(this.falls.length>=8)this.dispose(this.falls.shift()!.group);const group=this.treeModel(event.scale);group.position.set(event.x,this.game.world.height(event.x,event.z),event.z);group.rotation.y=Math.atan2(event.x-this.game.state.player.x,event.z-this.game.state.player.z)+Math.PI/2;group.name='falling-tree';this.scene.add(group);this.falls.push({group,age:0});}
    }
    this.falls=this.falls.filter(f=>{f.age+=this.game.paused?0:dt;f.group.rotation.z=-(Math.min(1,f.age/.9)**2)*Math.PI/2;if(f.age>=1){this.dispose(f.group);return false;}return true;});
  }
  private addRuin(g: THREE.Group, r: Ruin) {
    const w = this.game.world;

    if(r.id.startsWith('village:')){
      const paths=new THREE.Group();paths.name='village-paths';paths.userData.villageId=r.id;
      const paving=mat(0x8c8978,{roughness:1});
      // Packed-snow spine, door approaches, trader lane and an entrance to the square.
      const segments=[[-9,4,9,4],[0,4,0,15],[-5,4,-5,5],[5,4,5,5],[-6,-.5,-6,4],[6,-.5,6,4],[0,-.5,3.5,-.5],[3.5,-.5,3.5,4]];
      for(const [ax,az,bx,bz]of segments){const length=Math.hypot(bx-ax,bz-az);for(let d=0;d<length;d+=.7){const t=(d+.35)/length,x=r.x+ax+(bx-ax)*t,z=r.z+az+(bz-az)*t;if(w.isWater(x,z))continue;const slab=this.box(paths,x,w.height(x,z)+.035,z,1.65,.06,.72,paving);slab.rotation.y=Math.atan2(bx-ax,bz-az);slab.receiveShadow=true;slab.castShadow=false;}}
      g.add(paths);
    }
    const chest = this.game.state.changes.containers.includes(r.id) ? this.materials.dark : this.materials.wood;
    this.box(g, r.container.x, w.height(r.container.x, r.container.z) + .5, r.container.z, 1.4, .9, 1, chest);
    this.box(g, r.trader.x, w.height(r.trader.x, r.trader.z) + 2.6, r.trader.z, .45, .45, .1, mat(0xf4cf7c, { emissive: 0xaa7524 }));
  }
  private dispose(group: THREE.Group) {
    group.traverse(o => { o.userData.ownedTexture?.dispose();if (o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Points) { if (o instanceof THREE.InstancedMesh) o.dispose(); o.geometry.dispose(); const mats = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mats) if (!Object.values(this.materials).includes(m as THREE.MeshStandardMaterial)) m.dispose(); } }); group.removeFromParent();
  }
  refreshChunks(ids:Iterable<string>=this.chunks.keys()) { for (const id of ids) if(this.chunks.has(id))this.dirtyChunks.add(id); }
  private clearChunks() { for (const g of this.chunks.values()) this.dispose(g); this.chunks.clear(); this.dirtyChunks.clear(); }
  resize() { const w = this.host.clientWidth, h = this.host.clientHeight; this.webgl.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  readonly loadStats={chunks:0,total:0,durationMs:0,maxChunkMs:0};
  renderIdle(){this.applyGraphics();this.webgl.render(this.scene,this.camera);}
  async prepareWorld(progress:(value:number,label:string)=>void){
    const start=performance.now(),world=this.game.world,radius=this.game.state.settings.renderDistance,coords=world.chunkCoordinates(this.game.state.player,radius+1),visible=new Set(world.chunkCoordinates(this.game.state.player,radius).map(c=>c.id));
    Object.assign(this.loadStats,{chunks:0,total:coords.length,durationMs:0,maxChunkMs:0});
    const paint=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    for(const [i,c]of coords.entries()){
      progress(i/coords.length*.8,`Preparing terrain / ${i+1} of ${coords.length}`);if(!world.cachedChunk(c.id)||visible.has(c.id)&&(!this.chunks.has(c.id)||this.dirtyChunks.has(c.id))||i%8===0)await paint();
      const before=performance.now(),data=world.chunk(c.cx,c.cz);
      if(visible.has(c.id)&&(!this.chunks.has(c.id)||this.dirtyChunks.has(c.id))){const group=this.chunk(data),old=this.chunks.get(c.id);if(old)this.dispose(old);this.scene.add(group);this.chunks.set(c.id,group);this.dirtyChunks.delete(c.id);}
      this.loadStats.maxChunkMs=Math.max(this.loadStats.maxChunkMs,performance.now()-before);this.loadStats.chunks=i+1;
    }
    progress(.83,'Preparing survivors and camp');this.update(0,0,false);await paint();
    const deadline=performance.now()+15000;while(!this.playerCharacter.ready||[...this.residents.values()].some(v=>!v.ready)){if(performance.now()>deadline)throw new Error('Character assets are taking too long. Please try entering again.');await paint();}
    progress(.9,'Warming graphics');this.update(0,0,false);await this.webgl.compileAsync(this.scene,this.camera);await paint();this.renderIdle();
    this.loadStats.durationMs=performance.now()-start;progress(1,'Your world is ready');await paint();
  }
  setGame(game: Game) { for(const fall of this.falls)this.dispose(fall.group);this.falls=[];this.shaking=undefined;this.game = game; this.combatVisual.clear(); this.playerCharacter.reset(); for (const visual of this.residents.values()) visual.dispose(); this.residents.clear(); this.clearChunks(); this.dispose(this.entities); this.entities = new THREE.Group(); this.scene.add(this.entities); this.dynamic.clear(); this.target.set(game.state.player.x, 1, game.state.player.z); }
  screenPoint(point: { x: number; z: number }) {
    const v = new THREE.Vector3(point.x, this.game.world.height(point.x, point.z) + 1.2, point.z).project(this.camera);
    if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) return undefined;
    const b = this.webgl.domElement.getBoundingClientRect(); return { x: b.left + (v.x + 1) * b.width / 2, y: b.top + (1 - v.y) * b.height / 2 };
  }
  workerAt(clientX:number,clientY:number){
    const bounds=this.webgl.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((clientX-bounds.x)/bounds.width*2-1,-(clientY-bounds.y)/bounds.height*2+1),this.camera);
    let chosen:string|undefined,nearest=Infinity;
    for(const w of this.game.state.workers){const visual=this.residents.get(w.id);if(!visual?.ready||!visual.object.visible||visibilityAt(this.game.state,w)>.9)continue;const hit=this.ray.intersectObject(visual.object,true)[0];if(hit&&hit.distance<nearest){chosen=w.id;nearest=hit.distance;}}
    return chosen;
  }
  stumpAt(clientX:number,clientY:number){
    const b=this.webgl.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((clientX-b.x)/b.width*2-1,-(clientY-b.y)/b.height*2+1),this.camera);
    let chosen:string|undefined,nearest=Infinity;for(const chunk of this.chunks.values())chunk.traverse(o=>{if(o instanceof THREE.InstancedMesh&&o.userData.stumpIds){const hit=this.ray.intersectObject(o)[0];if(hit&&hit.distance<nearest){const id=o.userData.stumpIds[hit.instanceId!],stump=this.game.treeGrowth.stumps(this.game.state.player).find(t=>t.id===id);if(stump&&visibilityAt(this.game.state,stump)<.9){chosen=id;nearest=hit.distance;}}}});return chosen;
  }
  structureAt(clientX:number,clientY:number){
    const bounds=this.webgl.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((clientX-bounds.x)/bounds.width*2-1,-(clientY-bounds.y)/bounds.height*2+1),this.camera);
    let chosen:string|undefined,nearest=Infinity;
    for(const [id,group] of this.dynamic){if(!group.userData.structureId||!group.visible||visibilityAt(this.game.state,{x:group.position.x,z:group.position.z})>.9)continue;
      const hit=this.ray.intersectObject(group,true).find(hit=>{for(let o:THREE.Object3D|null=hit.object;o&&o!==group;o=o.parent)if(!o.visible||['heat-ring','heat-aura','structure-health'].includes(o.name))return false;return true;});
      if(hit&&hit.distance<nearest){chosen=id;nearest=hit.distance;}
    }return chosen;
  }
  groundAt(clientX: number, clientY: number) {
    const bounds = this.webgl.domElement.getBoundingClientRect(); this.ray.setFromCamera(new THREE.Vector2((clientX - bounds.x) / bounds.width * 2 - 1, -(clientY - bounds.y) / bounds.height * 2 + 1), this.camera);
    const terrain = Array.from(this.chunks.values()).map(g => g.children[0]); const hit = this.ray.intersectObjects(terrain, false)[0]; return hit ? { x: hit.point.x, z: hit.point.z } : undefined;
  }
  showPreview(type: BuildingType | null, point?: { x: number; z: number }, rotation = 0, valid = false) {
    if (this.preview && this.preview.userData.type !== type) { this.dispose(this.preview); this.preview = undefined; }
    if (!type || !point) return;
    if (!this.preview) {
      this.preview = this.building(type); this.preview.userData.type = type;
      this.preview.traverse(o => { if (o instanceof THREE.PointLight) o.intensity = 0; if (o instanceof THREE.Mesh) { const old = o.material as THREE.MeshStandardMaterial; if (!Object.values(this.materials).includes(old)) old.dispose(); o.material = mat(0x69caad, { transparent: true, opacity: .55 }); } }); this.scene.add(this.preview);
    }
    this.preview.traverse(o => { if (o instanceof THREE.Mesh) (o.material as THREE.MeshStandardMaterial).color.setHex(valid ? 0x69caad : 0xd8776c); });
    this.preview.rotation.y = rotation; this.preview.position.set(point.x, this.game.world.height(point.x, point.z), point.z);
  }
  applyGraphics(){
    const enabled=!!this.game.state.settings.budgetMeal;if(this.budgetMode===enabled)return;this.budgetMode=enabled;
    this.webgl.setPixelRatio(Math.min(devicePixelRatio,enabled?1.25:1.75));this.sun.shadow.mapSize.set(enabled?512:1024,enabled?512:1024);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapPass?.dispose();this.sun.shadow.mapPass=null;
    this.webgl.shadowMap.autoUpdate=!enabled;this.webgl.shadowMap.needsUpdate=true;this.lastShadow=-Infinity;this.resize();
  }
  update(dt: number, time: number, moving: boolean, aiming = false) {
    this.applyGraphics();if(!this.budgetMode||time-this.lastShadow>=.1){this.webgl.shadowMap.needsUpdate=true;this.lastShadow=time;}

    const game = this.game, p = game.state.player, height = game.world.walkHeight(p.x, p.z);
    this.flowTime.value=this.reducedMotion.matches?0:game.state.elapsed;
    const storm=game.state.combat.weather.mode==='snow';this.weather.update(game.paused?0:dt,storm,p,height,this.reducedMotion.matches,!!this.budgetMode);
    const fog=this.scene.fog as THREE.Fog,intensity=this.snowfall.userData.intensity;
    const visibility=weatherVisibility(this.zoom,game.state.settings.renderDistance,intensity);fog.near=visibility.near;fog.far=visibility.far;
    const night=nightBlend(game.state);this.sun.intensity=THREE.MathUtils.lerp(3,1.7,intensity)*(1-night*.88);
    const sky=new THREE.Color(0xb4cbd9).lerp(new THREE.Color(0x152536),night);(this.scene.background as THREE.Color).copy(sky);fog.color.copy(sky);
    for(const o of this.scene.children)if(o instanceof THREE.HemisphereLight)o.intensity=2.2*(1-night*.83);
    const heldTorch=game.state.combat.weapons.some(w=>w.id===game.state.combat.equipped&&w.type==='molotov'&&w.uses>0);this.torch.intensity=heldTorch?32:0;this.torch.position.set(p.x,height+1.6,p.z);

    const target = new THREE.Vector3(p.x, height + 1.1, p.z), blend = 1 - Math.exp(-dt * 6); this.target.lerp(target, blend);
    // High orbit clears all player-buildable roofs; terrain clearance also protects hills.
    const offset = new THREE.Vector3(Math.sin(this.yaw) * this.zoom, this.zoom * .92, Math.cos(this.yaw) * this.zoom);
    this.camera.position.copy(this.target).add(offset); this.camera.position.y = Math.max(this.camera.position.y, game.world.height(this.camera.position.x, this.camera.position.z) + 9); this.camera.lookAt(this.target);
    // Move the shadow volume in texel-sized steps rather than shimmering with every footstep.
    const shadowStep = 64 / this.sun.shadow.mapSize.x;
    const sx = Math.round(p.x / shadowStep) * shadowStep, sz = Math.round(p.z / shadowStep) * shadowStep;
    this.sun.position.set(sx - 22, 35, sz + 15); this.sun.target.position.set(sx, 0, sz);
    this.playerCharacter.update(game, dt, aiming);
    this.terrainFeedback(dt);
    const needed = game.world.chunkCoordinates(p, game.state.settings.renderDistance), ids = new Set(needed.map(c => c.id));
    for (const [id, g] of this.chunks) if (!ids.has(id)) { this.dispose(g); this.chunks.delete(id); this.dirtyChunks.delete(id); }
    // One nearby mesh build per frame; warm the next ring only when no mesh is pending.
    const pending=needed.find(c=>!this.chunks.has(c.id)||this.dirtyChunks.has(c.id));
    if(pending){const replacement=this.chunk(game.world.chunk(pending.cx,pending.cz)),previous=this.chunks.get(pending.id);this.scene.add(replacement);this.chunks.set(pending.id,replacement);this.dirtyChunks.delete(pending.id);if(previous)this.dispose(previous);}
    else{const next=game.world.chunkCoordinates(p,game.state.settings.renderDistance+1).find(c=>!game.world.cachedChunk(c.id));if(next)game.world.chunk(next.cx,next.cz);}
    const entityIds = new Set<string>();
    for (const b of game.settlement.structures(p,game.state.settings.renderDistance)) {
      const integrity=game.settlement.integrity(b);if(integrity.stage==='gone'||Math.hypot(b.x-p.x,b.z-p.z)>(game.state.settings.renderDistance+1)*game.world.spec.config.chunkSize)continue;
      entityIds.add(b.id); let group = this.dynamic.get(b.id);
      if(group&&(group.userData.stage!==integrity.stage||group.userData.constructing!==!!b.construction)){this.dispose(group);this.dynamic.delete(b.id);group=undefined;}
      if(!group){group=b.construction&&integrity.stage==='intact'?this.constructionModel(b.type):integrity.stage==='ruin'?this.ruinedBuilding(b.type,b.rotation):this.building(b.type,b.rotation);group.userData.stage=integrity.stage;group.userData.constructing=!!b.construction;group.userData.structureId=b.id;this.dynamic.set(b.id,group);this.entities.add(group);}
      const max=structureMaxHP(b)*(integrity.stage==='ruin'?.25:1),occupants=Object.values(game.state.changes.refuges??{}).filter(r=>r.houseId===b.id&&r.phase==='hidden').length+(game.state.player.shelter?.houseId===b.id?1:0);
      group.userData.construction=b.construction;group.scale.y=b.construction&&integrity.stage==='intact'?(group.userData.constructionHeight??1)*(.35+.65*(1-b.construction/CONSTRUCTION_SECONDS[b.type])):1;
      group.userData.hp=integrity.hp;group.userData.occupants=occupants;this.structureBar(group,integrity.hp/max,integrity.hp<max||occupants>0);
      group.position.set(b.x, game.world.height(b.x, b.z), b.z);
      if(b.type==='shelter'&&!b.construction&&integrity.stage==='intact'){const active=(b.burnTime??15)>0;group.getObjectByName('camp-flame')!.visible=active;(group.getObjectByName('camp-light') as THREE.PointLight).intensity=active?22:0;group.userData.remaining=b.burnTime??15;}
      if (b.type === 'furnace'&&!b.construction&&integrity.stage==='intact') {
        const furnace = game.state.furnaces.find(f => f.id === b.id)!; const active = furnace.fuel + furnace.charcoal > 0;
        const tier = furnaceTier(furnace.level);
        if (group.userData.tier !== tier) { const old = group.getObjectByName('reinforcement'); if (old) this.dispose(old as THREE.Group); const upgrade = new THREE.Group(); upgrade.name = 'reinforcement';
          for (let i = 0; i < tier; i++) { this.box(upgrade, 0, 3.7 + i * .6, 0, .9, .4, .9, this.materials.metal); for (const side of [-1, 1]) this.box(upgrade, side * (1.15 + i * .1), 1.2, 0, .18, 2.4, .7, this.materials.dark); }
          group.add(upgrade); group.userData.tier = tier;
        }
        const flame = group.getObjectByName('flame')!; flame.visible = active;animateFire(flame,game.state.elapsed,this.reducedMotion.matches); flame.scale.y = this.reducedMotion.matches?1:.95 + Math.sin(game.state.elapsed * 9) * .13;
        (group.getObjectByName('warm-light') as THREE.PointLight).intensity = active ? 35 + (this.reducedMotion.matches?0:Math.sin(game.state.elapsed * 11) * 3) : 0;
        const old = group.getObjectByName('heat-ring') as THREE.Mesh | undefined, radius = heatRadius(furnace);
        if (old?.userData.radius !== radius) {
          if (old) { old.geometry.dispose(); (old.material as THREE.Material).dispose(); group.remove(old); }
          const ring = this.mesh(new THREE.RingGeometry(Math.max(.01, radius - .42), Math.max(.02, radius), 72), new THREE.MeshBasicMaterial({ color: 0xe8b97a, transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
          ring.geometry.rotateX(-Math.PI / 2); const v = ring.geometry.attributes.position;
          for(let i=0;i<v.count;i++){const x=b.x+v.getX(i)*Math.cos(b.rotation)+v.getZ(i)*Math.sin(b.rotation),z=b.z-v.getX(i)*Math.sin(b.rotation)+v.getZ(i)*Math.cos(b.rotation);v.setY(i,Math.max(game.world.walkHeight(x,z),game.world.isWater(x,z)?.12:-Infinity)-group.position.y+.12);}
          ring.name = 'heat-ring'; ring.userData.radius = radius; ring.castShadow = false; group.add(ring);
        }
        const aura=group.getObjectByName('heat-aura') as THREE.Mesh|undefined;
        if(aura?.userData.radius!==radius){if(aura)this.dispose(aura as unknown as THREE.Group);if(radius>0)group.add(furnaceAura(game,b,radius));}
        const liveAura=group.getObjectByName('heat-aura');if(liveAura)liveAura.userData.clock.value=this.reducedMotion.matches?0:game.state.elapsed;
        const embers=group.getObjectByName('heat-embers');if(embers?.userData.radius!==radius){if(embers)this.dispose(embers as THREE.Group);if(radius>0)group.add(furnaceEmbers(game,b,radius));}const liveEmbers=group.getObjectByName('heat-embers');if(liveEmbers){liveEmbers.userData.clock.value=this.reducedMotion.matches?0:game.state.elapsed;(liveEmbers as THREE.Points).geometry.setDrawRange(0,this.budgetMode?12:Infinity);}
        const ring=group.getObjectByName('heat-ring')!;ring.visible=radius>0;
      }
    }
    for(const group of this.dynamic.values()){const fire=group.getObjectByName('forge-fire');if(fire)animateFire(fire,game.state.elapsed,this.reducedMotion.matches);}
    for(const pile of game.settlement.loot(p)){
      const key=`loot:${pile.id}`;entityIds.add(key);let group=this.dynamic.get(key);if(!group){group=this.lootModel(pile);this.dynamic.set(key,group);this.entities.add(group);}group.position.set(pile.x,game.world.height(pile.x,pile.z),pile.z);
    }
    const residentIds = new Set<string>();
    for(const settlement of game.world.settlements(p,game.state.settings.renderDistance)) {
      const npc=game.npc(settlement),size=game.world.spec.config.chunkSize; if(npc.hp<=0||!this.chunks.has(`${Math.floor(settlement.trader.x/size)},${Math.floor(settlement.trader.z/size)}`))continue; residentIds.add(npc.id);
      let visual=this.residents.get(npc.id);if(!visual){visual=new NPCCharacter(characterStyle('trader',npc.id,settlement.variant).id);this.residents.set(npc.id,visual);this.entities.add(visual.object);}
      const point=game.settlement.position(npc.id,settlement.trader),refuge=game.settlement.refuge(npc.id),dx=point.x-visual.object.position.x,dz=point.z-visual.object.position.z;visual.update(point,game.world.walkHeight(point.x,point.z),Math.hypot(dx,dz)>.01?Math.atan2(dx,dz):visual.object.rotation.y,game.paused?0:dt,game.state.elapsed);visual.object.visible=visual.ready&&refuge?.phase!=='hidden';visual.object.userData.refuge=refuge?.phase;
    }
    for(const worker of game.state.workers) {
      if(worker.hp<=0||Math.hypot(worker.x-p.x,worker.z-p.z)>65)continue;residentIds.add(worker.id);let visual=this.residents.get(worker.id);
      if(!visual){visual=new NPCCharacter(characterStyle(worker.communityId?'villager':'worker',worker.id).id);this.residents.set(worker.id,visual);this.entities.add(visual.object);}
      const harvest=game.harvestTargets.get(worker.id);
      const refuge=game.settlement.refuge(worker.id),dx=worker.x-visual.object.position.x,dz=worker.z-visual.object.position.z;visual.update(worker,game.world.walkHeight(worker.x,worker.z),harvest?Math.atan2(harvest.x-worker.x,harvest.z-worker.z):Math.hypot(dx,dz)>.01?Math.atan2(dx,dz):visual.object.rotation.y,game.paused?0:dt,game.state.elapsed,null,-100,worker.state==='gathering'&&!refuge,harvest?.resource==='wood'?'axe':harvest?.resource==='stone'?'pickaxe':undefined);visual.object.visible=visual.ready&&refuge?.phase!=='hidden';visual.object.userData.refuge=refuge?.phase;
    }
    for(const [id,visual] of this.residents)if(!residentIds.has(id)){visual.dispose();this.residents.delete(id);}
    for (const [id, group] of this.dynamic) if (!entityIds.has(id)) { this.dispose(group); this.dynamic.delete(id); }
    this.combatVisual.update(game, this.camera, time, dt); this.sightFog.update(this.scene,game.state,intensity);this.webgl.render(this.scene, this.camera);
  }
}
