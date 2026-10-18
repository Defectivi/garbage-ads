import {derive} from '../utils/SeededRNG';
import type {Chunk,Node,Tree,WorldManager} from './WorldManager';
import type {Point} from '../game/GameState';

type Bounds={minX:number;minZ:number;maxX:number;maxZ:number};
function bounds(solids:readonly (Point&{radius:number})[]):Bounds{
  const b={minX:Infinity,minZ:Infinity,maxX:-Infinity,maxZ:-Infinity};
  for(const s of solids){b.minX=Math.min(b.minX,s.x-s.radius);b.maxX=Math.max(b.maxX,s.x+s.radius);b.minZ=Math.min(b.minZ,s.z-s.radius);b.maxZ=Math.max(b.maxZ,s.z+s.radius);}return b;
}
export function overlapsQuery(b:Bounds,p:Point,reach?:number){return reach===undefined||p.x+reach>=b.minX&&p.x-reach<=b.maxX&&p.z+reach>=b.minZ&&p.z-reach<=b.maxZ;}

/** Only seed-derived geometry is cached. Depletion, fire and buildings stay live in Game. */
export class NaturalChunkCache {
  private chunks=new WeakMap<Chunk,{
    nodes:Node[];
    large:Set<string>;
    trees:{id:string;tree:Tree;solid:Tree&{radius:number}}[];
    boulders:{node:Node;derived:boolean;solid:Node}[];
    treeBounds:Bounds;rockBounds:Bounds;
  }>();
  constructor(private world:WorldManager){}
  get(chunk:Chunk){
    let cached=this.chunks.get(chunk);if(cached)return cached;
    const world=this.world;
    const nodes=chunk.nodes.filter(n=>!world.cliffAt(n)).filter(n=>!world.bridgeAt(n.x,n.z)).filter(n=>world.spec.generationVersion<4||!world.villages().some(v=>Math.hypot(v.x-n.x,v.z-n.z)<15));
    const large=new Set(nodes.filter(n=>!n.kind&&n.resource==='stone'&&!n.id.startsWith('starter:')&&derive(world.spec.seeds.resources,n.id)%3===0).map(n=>n.id));
    const trees=chunk.trees.flatMap((tree,i)=>!world.canGrowTree(tree.x,tree.z)?[]:[{id:`tree:${chunk.cx}:${chunk.cz}:${i}`,tree,solid:{...tree,radius:.38*tree.scale}}]);
    const boulders=nodes.filter(n=>n.kind==='boulder'||large.has(n.id)).map(node=>({node,derived:large.has(node.id),solid:{...node,kind:'boulder' as const,radius:1.45}}));
    cached={nodes,large,trees,boulders,treeBounds:bounds(trees.map(t=>t.solid)),rockBounds:bounds(boulders.map(b=>b.solid))};this.chunks.set(chunk,cached);return cached;
  }
}
