import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||(existsSync(edge)?edge:undefined)});
mkdirSync('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto('http://localhost:5173');await page.locator('#seed').fill('42');await page.locator('#new-world').click();await page.locator('#resources').waitFor();
 await page.evaluate(()=>{window.__frostbound.game.paused=true;});
 await page.waitForFunction(()=>window.__frostbound.renderer.playerCharacter.ready&&window.__frostbound.renderer.chunks.size===25);
 // Keep rendering out of the simulation measurements; separately measure the first actor render.
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(150);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 if(process.env.PROFILE_CPU){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
 const result=await page.evaluate(()=>{
  const a=window.__frostbound,g=a.game,s=g.state;g.paused=false;s.spawnProtection.remaining=.3;
  let solidCalls=0,solidMs=0,spawnMs=0;
  const solids=g.solids.bind(g),encounters=g.combat.ensureEncounters.bind(g.combat);
  g.solids=(p,reach)=>{const t=performance.now();solidCalls++;const r=solids(p,reach);solidMs+=performance.now()-t;return r;};
  g.combat.ensureEncounters=()=>{const t=performance.now();encounters();spawnMs+=performance.now()-t;};
  const samples=[];let firstActorRenderMs=null;
  for(let i=0;i<80;i++){
   solidCalls=solidMs=spawnMs=0;const before=Object.keys(s.combat.actors).length,t=performance.now();g.update(1/60);
   samples.push({step:i,protected:(s.spawnProtection?.remaining??0)>0,ms:performance.now()-t,solidCalls,solidMs,spawnMs,actors:Object.keys(s.combat.actors).length});
   if(!before&&Object.keys(s.combat.actors).length){const t=performance.now();a.renderer.update(1/60,s.elapsed,false);firstActorRenderMs=performance.now()-t;}
  }
  g.paused=true;g.solids=solids;g.combat.ensureEncounters=encounters;
  const summary=protectedZone=>{const slice=samples.filter(s=>s.protected===protectedZone),sort=slice.map(s=>s.ms).sort((a,b)=>a-b);return{steps:slice.length,median:sort[Math.floor(sort.length*.5)],p95:sort[Math.floor(sort.length*.95)],worst:sort.at(-1),solidCalls:slice.reduce((n,s)=>n+s.solidCalls,0)/slice.length,solidMs:slice.reduce((n,s)=>n+s.solidMs,0)/slice.length};};
  return{protected:summary(true),unprotected:summary(false),firstActorRenderMs,samples,actors:Object.values(s.combat.actors).map(a=>({id:a.id,type:a.type,hp:a.hp,x:a.x,z:a.z})),encounters:[...s.combat.encounters]};
 });
 assert(result.protected.steps>0&&result.unprotected.steps>0);assert(result.actors.length>0);assert.deepEqual(errors,[]);
 if(process.env.PROFILE_CPU){const {profile}=await cdp.send('Profiler.stop');writeFileSync('test-results/spawn.cpu-profile.json',JSON.stringify(profile));console.log(JSON.stringify(profile.nodes.toSorted((a,b)=>(b.hitCount??0)-(a.hitCount??0)).slice(0,18).map(n=>({hits:n.hitCount,name:n.callFrame.functionName,url:n.callFrame.url,line:n.callFrame.lineNumber}))));}
 const label=process.env.PERFORMANCE_LABEL||'current';writeFileSync(`test-results/spawn-performance-${label}.json`,JSON.stringify({environment:'Headless Edge, seed42, 1280x800, 4x DevTools CPU throttle. Fixed 1/60 simulation steps around protection expiry; gameplay render sampled separately. Not an FPS benchmark.',...result},null,2));
 console.log(JSON.stringify({label,protected:result.protected,unprotected:result.unprotected,firstActorRenderMs:result.firstActorRenderMs,actors:result.actors.length}));
}finally{await browser.close();}
