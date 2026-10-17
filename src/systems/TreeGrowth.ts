import type {Game} from '../game/Game';
import type {Point} from '../game/GameState';
export const TREE_REGROW_SECONDS=1200;
export class TreeGrowth {
 private timers:{id:string;at:number}[]=[];private cursor=0;
 constructor(private game:Game){
  const s=game.state;
  for(const [id,change]of Object.entries(s.changes.terrain??{}))if(change==='felled'&&id.startsWith('tree:')&&s.changes.treeRegrowth?.[id]===undefined)(s.changes.treeRegrowth??={})[id]=s.elapsed+TREE_REGROW_SECONDS;
  for(const id of s.combat.charredTrees)if(s.changes.treeRegrowth?.[id]===undefined)(s.changes.treeRegrowth??={})[id]=s.elapsed+TREE_REGROW_SECONDS;
  this.timers=Object.entries(s.changes.treeRegrowth??{}).map(([id,at])=>({id,at})).sort((a,b)=>a.at-b.at);
 }
 fell(id:string){const s=this.game.state;if(s.changes.treeRegrowth?.[id]!==undefined)return;(s.changes.treeRegrowth??={})[id]=s.elapsed+TREE_REGROW_SECONDS;this.timers.push({id,at:s.elapsed+TREE_REGROW_SECONDS});if(this.timers.length>1&&this.timers.at(-2)!.at>this.timers.at(-1)!.at){this.timers=this.timers.slice(this.cursor).sort((a,b)=>a.at-b.at);this.cursor=0;}}
 stumps(point:Point,radius=1){const g=this.game;return g.world.around(point,radius).flatMap(c=>c.trees.flatMap((tree,i)=>{const id=`tree:${c.cx}:${c.cz}:${i}`,at=g.state.changes.treeRegrowth?.[id];return at===undefined?[]:[{...tree,id,readyAt:at,remaining:Math.max(0,at-g.state.elapsed)}];}));}
 update(){const g=this.game,s=g.state,deadline=performance.now()+3;let count=0;
  while(this.cursor<this.timers.length&&this.timers[this.cursor].at<=s.elapsed&&count<8&&(count===0||performance.now()<deadline)){count++;
   const timer=this.timers[this.cursor++];if(s.changes.treeRegrowth?.[timer.id]!==timer.at)continue;
   const match=/^tree:(-?\d+):(-?\d+):(\d+)$/.exec(timer.id);if(!match||Math.abs(Number(match[1]))*s.world.config.chunkSize>1e6+64||Math.abs(Number(match[2]))*s.world.config.chunkSize>1e6+64)continue;
   const tree=g.world.chunk(Number(match[1]),Number(match[2])).trees[Number(match[3])];if(!tree)continue;
   // A building owns its footprint. Defer until the stump has room again.
   if(s.buildings.some(b=>g.settlement.intact(b.id)&&Math.hypot(b.x-tree.x,b.z-tree.z)<4)){const at=s.elapsed+30;s.changes.treeRegrowth![timer.id]=at;this.timers.push({id:timer.id,at});this.timers=this.timers.slice(this.cursor).sort((a,b)=>a.at-b.at);this.cursor=0;continue;}
   delete s.changes.treeRegrowth![timer.id];delete s.changes.terrain![timer.id];
   for(const id of [timer.id,`log:${timer.id}`,`charcoal:${timer.id}`])delete s.changes.nodes[id];
   s.combat.charredTrees=s.combat.charredTrees.filter(id=>id!==timer.id);s.combat.charredNodes=s.combat.charredNodes.filter(id=>id!==timer.id&&id!==`log:${timer.id}`);g.markTerrainChanged(tree);
  }
  if(this.cursor>1024){this.timers=this.timers.slice(this.cursor);this.cursor=0;}
 }
}
