/** Gameplay runs at 60 simulation steps/second independently of how often WebGL renders. */
export class SimulationClock{
 private remainder=0;
 advance(seconds:number,step:(dt:number)=>void,paused=false){if(paused){this.remainder=0;return;}this.remainder+=Math.max(0,Math.min(.25,seconds));let count=0;while(this.remainder>=1/60-1e-10&&count<15){this.remainder=Math.max(0,this.remainder-1/60);step(1/60);count++;}}
 reset(){this.remainder=0;}
}
export class RenderTiming{
 private scheduled:number|undefined;private samples:number[]=[];private published=0;
 fps:number|null=null;frameMs:number|null=null;renderCpuMs=0;
 due(now:number,budget:boolean){if(this.scheduled===undefined||!budget){this.scheduled=now;return true;}const interval=1000/30,elapsed=now-this.scheduled;if(elapsed<interval-.2)return false;this.scheduled=now-Math.max(0,elapsed-interval)%interval;return true;}
 record(now:number,cpuMs=0){this.samples.push(now);while(this.samples.length>240||this.samples.length>1&&this.samples[0]<now-2000)this.samples.shift();this.renderCpuMs=cpuMs;if(this.samples.length<2){this.fps=this.frameMs=null;}if(now-this.published>=500&&this.samples.length>1){const span=this.samples.at(-1)!-this.samples[0];this.fps=span>0?(this.samples.length-1)*1000/span:null;this.frameMs=span/(this.samples.length-1);this.published=now;}}
 reset(){this.scheduled=undefined;this.samples=[];this.fps=this.frameMs=null;this.published=0;}
}
