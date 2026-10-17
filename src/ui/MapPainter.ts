import {visibilityAt,sightSettings} from '../systems/Visibility';
import type {Game} from '../game/Game';
import type {Ruin} from '../world/WorldManager';
export function paintMap(canvas:HTMLCanvasElement,game:Game,known:Ruin[]){
 const ctx=canvas.getContext('2d')!,w=game.world,p=game.state.player;
 const screen=(x:number,z:number)=>({x:(x-p.x+128)*2,y:(z-p.z+128)*2});
 for(let x=0;x<512;x+=4)for(let y=0;y<512;y+=4){const wx=p.x-128+x/2,wz=p.z-128+y/2,r=w.river(wx,wz),water=w.isWater(wx,wz),height=w.height(wx,wz);
  ctx.fillStyle=water?'#387e9b':w.bridgeAt(wx,wz)?'#b58c58':height>11?'#788586':height>6?'#aab3aa':w.biome(wx,wz)==='Pinewood'?'#c4d3bf':'#e9ece0';ctx.fillRect(x,y,4,4);
 }
 let trees=0;
 for(const c of w.around(p,Math.ceil(128/w.spec.config.chunkSize)))for(const [i,tree]of c.trees.entries()){
  if(w.bridgeAt(tree.x,tree.z))continue;
  if(game.state.changes.terrain?.[`tree:${c.cx}:${c.cz}:${i}`]==='felled'||game.state.combat.charredTrees.includes(`tree:${c.cx}:${c.cz}:${i}`))continue;
  const at=screen(tree.x,tree.z);if(at.x<0||at.x>512||at.y<0||at.y>512)continue;ctx.fillStyle='#467465';ctx.beginPath();ctx.moveTo(at.x,at.y-3);ctx.lineTo(at.x-2.2,at.y+2);ctx.lineTo(at.x+2.2,at.y+2);ctx.fill();trees++;
 }
 for(const cliff of w.cliffs(p)){const at=screen(cliff.x,cliff.z);ctx.fillStyle='#51616b';ctx.beginPath();ctx.arc(at.x,at.y,cliff.radius*2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e4c577';ctx.lineWidth=2;ctx.stroke();}canvas.dataset.cliffs=String(w.cliffs(p).length);
 ctx.strokeStyle='#223e4930';ctx.lineWidth=1;for(let i=0;i<=512;i+=64){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke();}
 const marker=(x:number,z:number,color:string,label:string,shape='square')=>{const at=screen(x,z);if(at.x<0||at.x>512||at.y<0||at.y>512)return;ctx.fillStyle=color;ctx.strokeStyle='#fff5dc';ctx.lineWidth=2;ctx.beginPath();if(shape==='circle')ctx.arc(at.x,at.y,5,0,Math.PI*2);else ctx.rect(at.x-5,at.y-5,10,10);ctx.fill();ctx.stroke();ctx.font='bold 12px Oxanium,monospace';const width=ctx.measureText(label).width,tx=Math.min(506-width,Math.max(5,at.x+9)),ty=Math.max(15,at.y-8);ctx.fillStyle='#f4f2dfeb';ctx.fillRect(tx-3,ty-12,width+6,16);ctx.fillStyle='#213c47';ctx.fillText(label,tx,ty);};
 for(const r of known)marker(r.x,r.z,r.id.startsWith('village:')?'#bd8740':'#745d58',r.name);
 marker(0,0,'#294e65','HOME');
 const sight=sightSettings(game.state);if(sight.weight>0){for(let x=0;x<512;x+=4)for(let y=0;y<512;y+=4){const fog=visibilityAt(game.state,{x:p.x-128+x/2,z:p.z-128+y/2});ctx.fillStyle=`rgba(19,34,45,${Math.max(fog,sight.night*.4)})`;ctx.fillRect(x,y,4,4);}}canvas.dataset.night=String(sight.night);canvas.dataset.fog=String(sight.weight);
 marker(p.x,p.z,'#c74d38','YOU','circle');canvas.dataset.trees=String(trees);
 ctx.fillStyle='#263f48';ctx.font='bold 12px Oxanium,monospace';ctx.fillText('N',250,16);ctx.fillText('32 m',10,498);ctx.fillRect(10,502,64,2);
}
