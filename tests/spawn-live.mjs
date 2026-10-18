import {chromium} from '@playwright/test';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||(existsSync(edge)?edge:undefined)});
mkdirSync('test-results',{recursive:true});
try{
 const cases=process.env.COMPARE_BASELINE_URL?[['baseline',process.env.COMPARE_BASELINE_URL],['optimized','http://localhost:5173']]:[['current','http://localhost:5173']];
 for(const [label,url]of cases){
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.addInitScript(()=>{
   const perf=window.__spawnPerf={frames:[],active:false,expiry:null,start:null},raf=requestAnimationFrame.bind(window);let timestamp,last;
   window.requestAnimationFrame=callback=>raf(t=>{timestamp=t;callback(t);});
   const observe=new MutationObserver(()=>{
    if(!document.getElementById('resources'))return;
    const safe=!!document.querySelector('.effect-spawn');
    if(perf.start===null&&safe){perf.start=performance.now();perf.active=true;}
    if(perf.active&&!safe){perf.expiry=performance.now();observe.disconnect();}
   });
   observe.observe(document,{childList:true,subtree:true});
   for(const proto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype])for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
    const draw=proto[name];if(!draw)continue;
    proto[name]=function(...args){if(perf.active&&timestamp!==last){last=timestamp;perf.frames.push(performance.now());}return draw.apply(this,args);};
   }
  });
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto(url);await page.locator('#seed').fill('42');await page.locator('#new-world').click();await page.locator('#resources').waitFor({timeout:90000});
  await page.waitForFunction(()=>window.__spawnPerf.expiry!==null,null,{timeout:120000});await page.waitForTimeout(4500);
  const result=await page.evaluate(()=>{
   const p=window.__spawnPerf;p.active=false;
   const end=performance.now();
   const summary=(frames,start,end)=>{const deltas=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);return{renders:frames.length,windowMs:end-start,fps:frames.length*1000/(end-start),medianMs:deltas[Math.floor(deltas.length*.5)]??null,p95Ms:deltas[Math.floor(deltas.length*.95)]??null,worstMs:deltas.at(-1)??null};};
   const gaps=p.frames.slice(1).map((t,i)=>({end:t,ms:t-p.frames[i]}));
   return{environment:'Headless Edge, 1280x800, 4x DevTools CPU throttle, seed42, normal graphics. Actual draws grouped by RAF callback; FPS = rendered callbacks / observation seconds. World and simulation run normally; UI-only production-compatible hooks.',protectionWallMs:p.expiry-p.start,protected:summary(p.frames.filter(t=>t>=p.start&&t<p.expiry-500),p.start,p.expiry-500),postExpiry:summary(p.frames.filter(t=>t>=p.expiry),p.expiry,end),transitionWorstGapMs:Math.max(0,...gaps.filter(g=>g.end>=p.expiry-500&&g.end<=end).map(g=>g.ms)),dead:!!document.getElementById('recover'),frames:p.frames};
  });
  writeFileSync(`test-results/spawn-live-${label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({label,...result,frames:undefined}));
  assert(result.protected.renders>1);assert(result.postExpiry.renders>0);assert(!result.dead);assert.deepEqual(errors,[]);
  await page.screenshot({path:`test-results/spawn-live-${label}.png`});await page.close();
 }
}finally{await browser.close();}
