import {isolateStartingCamp} from './browser-state.mjs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});
const errors=[];mkdirSync('test-results',{recursive:true});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173');await page.locator('#enter-world').click();await page.locator('#resources').waitFor();await isolateStartingCamp(page);
  await page.evaluate(async()=>{
   const T=await import('/node_modules/.vite/deps/three.js'),{CombatRenderer}=await import('/src/rendering/CombatRenderer.ts');
   const a=window.__frostbound,g=a.game;g.paused=true;a.renderer.update=()=>{};document.getElementById('interface').style.display='none';
   g.combat.ensureEncounters();for(const actor of Object.values(g.state.combat.actors))actor.hp=0;
   g.state.combat.projectiles=[];g.state.combat.fires=[];g.state.combat.drops=[];g.state.player.x=0;g.state.player.z=12;
   const actors=Object.values(g.state.combat.actors).slice(0,3);actors.forEach((actor,i)=>{Object.assign(actor,{x:(i-1)*4,z:0,type:i===2?'arsonist':'bandit',hp:100,weapon:['bow','shotgun','molotov'][i],heading:0});g.combat.fireWeapon(actor.id,actor,{x:actor.x,z:10},actor.weapon);});
   const visual=new CombatRenderer(),scene=new T.Scene();scene.background=new T.Color(0xd6e3eb);scene.add(visual.group,new T.HemisphereLight(0xffffff,0x546e70,3));const sun=new T.DirectionalLight(0xffe5bd,3);sun.position.set(5,12,8);scene.add(sun);
   const y=g.world.walkHeight(0,0),floor=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:0xe8eff0}));floor.rotation.x=-Math.PI/2;floor.position.set(0,y-.05,4);scene.add(floor);
   const camera=new T.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);camera.position.set(innerWidth<500?17:10,y+16,innerWidth<500?29:22);camera.lookAt(0,y+1,4);
   window.projectileTest={visual,actors,game:g,scene,camera,T};visual.update(g,camera,0,1/60);
   const draw=()=>{a.renderer.webgl.render(scene,camera);requestAnimationFrame(draw);};requestAnimationFrame(draw);
  });
  await page.waitForFunction(()=>[...window.projectileTest.visual.characters.values()].every(v=>v.ready));
  const result=await page.evaluate(()=>{
   const {visual,actors,game:g,camera}=window.projectileTest;let checks=0;
   for(const fraction of [0,.2,.5,.8]){
    for(const p of g.state.combat.projectiles){p.age=p.duration*fraction;p.x=p.fromX+(p.targetX-p.fromX)*fraction;p.z=p.fromZ+(p.targetZ-p.fromZ)*fraction;}
    visual.update(g,camera,fraction,1/60);
    for(const actor of actors){const model=visual.objects.get(`actor:${actor.id}`);if(!model||model.position.x!==actor.x||model.position.z!==actor.z)throw Error('Shooter moved along projectile path');checks++;}
    for(const p of g.state.combat.projectiles){const mesh=visual.objects.get(`projectile:${p.id}`);if(!mesh||mesh.userData.projectileKind!==p.kind||mesh.getObjectByName('health'))throw Error('Projectile reused character');}
   }
   return {checks,kinds:g.state.combat.projectiles.map(p=>p.kind),distinct:new Set(g.state.combat.projectiles.map(p=>p.id)).size};
  });assert.equal(result.checks,12);assert.equal(result.distinct,7);assert.equal(result.kinds.filter(k=>k==='pellet').length,5);
  await page.screenshot({path:`test-results/projectile-attacks-${width}.png`});
  // A legacy saved shot with an enemy ID must still never alias that enemy's mesh.
  await page.evaluate(()=>{const {visual,actors,game:g,camera}=window.projectileTest;g.state.combat.projectiles[0].id=actors[0].id;visual.update(g,camera,1,1/60);if(visual.objects.get(`actor:${actors[0].id}`)===visual.objects.get(`projectile:${actors[0].id}`))throw Error('Legacy ID collision');g.state.combat.projectiles=[];visual.update(g,camera,2,1/60);if(visual.objects.size!==3||visual.characters.size!==3)throw Error('Shot cleanup removed shooter or leaked shots');visual.clear();if(visual.group.children.length||visual.characters.size)throw Error('Combat clear leaked objects');});
  if(width===1440){
   await page.evaluate(async()=>{const {ProjectileModels}=await import('/src/rendering/ProjectileModels.ts'),{T,scene,camera}=window.projectileTest;const library=new ProjectileModels();['arrow','pellet','bottle'].forEach((kind,i)=>{const mesh=library.create(kind);mesh.scale.setScalar(kind==='pellet'?5:3);mesh.position.set((i-1)*3,1.5,0);if(kind==='arrow')mesh.rotation.y=.5;scene.add(mesh);});camera.position.set(4,5,11);camera.lookAt(0,1,0);});await page.screenshot({path:'test-results/projectile-assets.png'});
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('Projectile browser checks passed: bow/shotgun/Molotov visuals, stationary shooters throughout flight, legacy ID isolation, cleanup, desktop and touch layouts.');
}finally{await browser.close();}
