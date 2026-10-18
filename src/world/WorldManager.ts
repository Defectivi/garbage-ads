import { SeededRNG, derive, noise, smooth } from '../utils/SeededRNG';
import type { WorldSpec } from '../game/GameConfig';
import type { Point } from '../game/GameState';
import type { Resource } from '../data/definitions';
export interface Node extends Point { id: string; resource: Resource; amount: number; radius: number; kind?:'tree'|'boulder'|'fragment'|'log'|'ore'; scale?:number }
export interface Tree extends Point { scale: number }
export interface Ruin extends Point { id: string; name: string; variant: number; houses: number; trader: Point; container: Point }
export interface Village extends Ruin { guardCount: number }
export const VILLAGE_SITES = [{ id: 'village:hearth', name: 'Hearthwatch', x: 40, z: 8 }, { id: 'village:quarry', name: 'Stonehaven', x: -72, z: -32 }, { id: 'village:river', name: 'Northpass', x: 132, z: 112 }];
export const DISTANT_VILLAGE_SITES = VILLAGE_SITES.map((v,i)=>({...v,x:[128,-144,192][i],z:[8,-32,176][i]}));
const EASY_VILLAGES=[{id:'village:cedar',name:'Cedar Rest',x:-256,z:192},{id:'village:pine',name:'Pinehaven',x:320,z:-160},{id:'village:ember',name:'Ember Hollow',x:-352,z:-224},{id:'village:birch',name:'Birchwatch',x:64,z:320},{id:'village:spruce',name:'Spruce Gate',x:384,z:320},{id:'village:ash',name:'Ash Crossing',x:-192,z:384}];
export interface Cliff extends Point{id:string;radius:number;height:number}
export interface Lake extends Point{id:string;rx:number;rz:number}
export interface FishingSpot extends Point { id: string; availability: number }
export interface Chunk { id: string; cx: number; cz: number; trees: Tree[]; nodes: Node[]; ruins: Ruin[]; fishing: FishingSpot[] }
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export class WorldManager {
  private cliffRegions=new Map<string,Cliff[]>();
  private lakeRegions=new Map<string,Lake[]>();
  private cliffCache=new Map<string,Cliff|undefined>();
  private lakeCache=new Map<string,Lake|undefined>();
  private cache = new Map<string, Chunk>();
  constructor(readonly spec: WorldSpec) {}
  private get villageSites(){const base=this.spec.generationVersion>=4?DISTANT_VILLAGE_SITES:VILLAGE_SITES;return this.spec.mode==='easy'?[...base,...EASY_VILLAGES]:base;}
  river(x: number, z: number) {
    const s = this.spec.seeds, row = Math.round((z - 48) / 128);
    let center = 48 + row * 128 + Math.sin(x / 31 + s.rivers * .01) * 6 + Math.sin(x / 83 + s.terrain * .01) * 10;
    if (this.spec.generationVersion >= 2) for (const v of this.villageSites) if (Math.abs(x - v.x) < 34 && Math.abs(center - v.z) < 30) center += (center > v.z ? 1 : -1) * (30 - Math.abs(center - v.z)) * smooth((34 - Math.abs(x - v.x)) / 8);
    const width = 3.4 * this.spec.config.riverDensity + noise(s.rivers, x / 38, row) * 1.8;
    return { center, width, distance: Math.abs(z - center), row, crossing: Math.abs(x - Math.round(x / 64) * 64) < 2.4 };
  }
  lakes(point:Point,radius=1):Lake[]{
    if(this.spec.generationVersion<5||this.spec.config.riverDensity===0)return[];
    const cx=Math.floor(point.x/128),cz=Math.floor(point.z/128),key=`${cx},${cz},${radius}`,cached=this.lakeRegions.get(key);if(cached)return cached.slice();const out:Lake[]=[];
    for(let x=cx-radius;x<=cx+radius;x++)for(let z=cz-radius;z<=cz+radius;z++){
      const id=`lake:${x}:${z}`;
      if(!this.lakeCache.has(id)){
        const rng=new SeededRNG(derive(this.spec.seeds.rivers,'lake',x,z)),spawn=rng.next()<.65;
        const lake={id,x:x*128+rng.range(35,100),z:z*128+rng.range(35,100),rx:rng.range(10,23),rz:rng.range(10,23)};
        const river=this.river(lake.x,lake.z),clear=distance(lake,{x:0,z:0})>65&&this.villages().every(v=>distance(v,lake)>48)&&this.nearbyRuins(Math.floor(lake.x/this.spec.config.chunkSize),Math.floor(lake.z/this.spec.config.chunkSize)).every(r=>distance(r,lake)>40)&&river.distance>river.width+lake.rz+8;
        if(this.lakeCache.size>256)this.lakeCache.delete(this.lakeCache.keys().next().value!);
        this.lakeCache.set(id,spawn&&clear?lake:undefined);
      }
      const lake=this.lakeCache.get(id);if(lake)out.push(lake);
    }if(this.lakeRegions.size>256)this.lakeRegions.delete(this.lakeRegions.keys().next().value!);this.lakeRegions.set(key,out);return out.slice();
  }
  cliffs(point:Point,radius=1):Cliff[]{
    if(this.spec.generationVersion<6)return[];
    const cx=Math.floor(point.x/128),cz=Math.floor(point.z/128),key=`${cx},${cz},${radius}`,cached=this.cliffRegions.get(key);if(cached)return cached.slice();const out:Cliff[]=[];
    for(let x=cx-radius;x<=cx+radius;x++)for(let z=cz-radius;z<=cz+radius;z++){
      const id=`cliff:${x}:${z}`;if(!this.cliffCache.has(id)){
        const rng=new SeededRNG(derive(this.spec.seeds.terrain,'cliffs',x,z)),spawn=rng.next()<.8;
        const cliff={id,x:x*128+rng.range(40,110),z:z*128+rng.range(40,110),radius:rng.range(7,11),height:rng.range(28,46)};
        const river=this.river(cliff.x,cliff.z),clear=distance(cliff,{x:0,z:0})>60&&this.villages().every(v=>distance(v,cliff)>cliff.radius+30)&&this.nearbyRuins(Math.floor(cliff.x/this.spec.config.chunkSize),Math.floor(cliff.z/this.spec.config.chunkSize)).every(r=>distance(r,cliff)>cliff.radius+25)&&(this.spec.config.riverDensity===0||river.distance>river.width+cliff.radius+10)&&this.lakes(cliff).every(l=>this.lakeDistance(cliff,l)>1.8)&&this.cliffOres(cliff).every(ore=>!this.isWater(ore.x,ore.z)&&!this.bridgeAt(ore.x,ore.z));
        if(this.cliffCache.size>256)this.cliffCache.delete(this.cliffCache.keys().next().value!);this.cliffCache.set(id,spawn&&clear?cliff:undefined);
      }const cliff=this.cliffCache.get(id);if(cliff)out.push(cliff);
    }if(this.cliffRegions.size>256)this.cliffRegions.delete(this.cliffRegions.keys().next().value!);this.cliffRegions.set(key,out);return out.slice();
  }
  cliffAt(point:Point,padding=0){return this.cliffs(point).find(c=>distance(c,point)<c.radius+padding);}
  cliffOres(cliff:Cliff):Node[]{
    return Array.from({length:9},(_,i)=>{const angle=i*Math.PI*2/9,r=cliff.radius+1.7,resource=(['gold','stone','metal'] as const)[i%3];return{id:`${cliff.id}:ore:${i}`,x:cliff.x+Math.cos(angle)*r,z:cliff.z+Math.sin(angle)*r,resource,amount:resource==='gold'?4+derive(this.spec.seeds.resources,cliff.id,i)%5:8+derive(this.spec.seeds.resources,cliff.id,i)%7,radius:.7,kind:'ore' as const};});
  }
  lakeDistance(point:Point,lake:Lake){return Math.hypot((point.x-lake.x)/lake.rx,(point.z-lake.z)/lake.rz);}
  visible(a:Point,b:Point,eye=1.5){
    const d=distance(a,b),steps=Math.min(128,Math.ceil(d/1.5)),ay=this.walkHeight(a.x,a.z)+eye,by=this.walkHeight(b.x,b.z)+eye;
    if(this.cliffs(a,Math.max(1,Math.ceil(d/128))).some(c=>{const t=Math.max(0,Math.min(1,((c.x-a.x)*(b.x-a.x)+(c.z-a.z)*(b.z-a.z))/(d*d||1))),x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;return Math.hypot(x-c.x,z-c.z)<c.radius&&this.height(c.x,c.z)+c.height>ay+(by-ay)*t;}))return false;
    for(let i=1;i<steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(this.height(x,z)>ay+(by-ay)*t)return false;}return true;
  }
  height(x: number, z: number) {
    const { terrain } = this.spec.seeds, scale = this.spec.config.worldScale;
    let raw = (noise(terrain, x / (62 * scale), z / (62 * scale)) - .4) * 8 + noise(terrain ^ 5182, x / 17, z / 17) * 1.5;
    if(this.spec.generationVersion>=5){const ridge=Math.max(0,noise(terrain^30917,x/(85*scale),z/(85*scale))-.42);raw+=ridge*38+Math.max(0,noise(terrain^51039,x/34,z/34)-.6)*12;}
    const home = smooth((Math.hypot(x, z) - 10) / 18); let base = .8 * (1 - home) + raw * home;
    if (this.spec.generationVersion >= 2) for (const v of this.villageSites) { const edge = smooth((distance(v, { x, z }) - 15) / 8); base = .8 * (1 - edge) + base * edge; }
    const r = this.river(x, z); if (this.spec.config.riverDensity === 0) return base;
    const bank = smooth((r.distance - r.width) / 9);
    let result=(-1.1 + Math.min(1, r.distance / r.width) * .8) * (1 - bank) + base * bank;
    for(const lake of this.lakes({x,z})){const d=this.lakeDistance({x,z},lake);if(d<1.6){const shore=smooth((d-1)/.6);result=(-1.1+Math.min(1,d)*.8)*(1-shore)+result*shore;}}return result;
  }
  bridgeAt(x:number,z:number){
    if(this.spec.config.riverDensity===0)return undefined;
    const bx=Math.round(x/64)*64,r=this.river(bx,z),halfWidth=2.35,halfLength=r.width+1.5;
    return Math.abs(x-bx)<=halfWidth&&Math.abs(z-r.center)<=halfLength?{x:bx,z:r.center,halfWidth,halfLength,height:.65}:undefined;
  }
  walkHeight(x:number,z:number){return this.bridgeAt(x,z)?.height??(this.isWater(x,z)?-.05:this.height(x,z));}
  isWater(x:number,z:number){if(this.bridgeAt(x,z))return false;const r=this.river(x,z);return this.spec.config.riverDensity>0&&r.distance<r.width+.2||this.lakes({x,z}).some(lake=>this.lakeDistance({x,z},lake)<1);}
  biome(x: number, z: number) { return noise(this.spec.seeds.biomes, x / 70, z / 70) > .56 ? 'Pinewood' : noise(this.spec.seeds.biomes, x / 25, z / 25) < .32 ? 'Rocky uplands' : 'Snowfields'; }
  villages(): Village[] { return this.spec.generationVersion < 2 ? [] : this.villageSites.map((v, i) => ({ ...v, variant: i, houses: 3, trader: { x: v.x - 5, z: v.z + 5 }, container: { x: v.x + 5, z: v.z + 5 }, guardCount: 3 + derive(this.spec.seeds.villages, v.id) % 3 })); }
  settlements(point: Point, radius = 1): Ruin[] { const chunks = this.around(point, radius); return [...chunks.flatMap(c => c.ruins), ...this.villages().filter(v => distance(v, point) < this.spec.config.chunkSize * (radius + 1))]; }
  ruin(rx: number, rz: number): Ruin | undefined {
    if(this.spec.mode==='easy'&&derive(this.spec.seeds.ruins,'easy-ruin',rx,rz)%20!==0)return;
    const rng = new SeededRNG(derive(this.spec.seeds.ruins, 'ruin', rx, rz));
    if ((rx !== 0 || rz !== 0) && rng.next() > this.spec.config.ruinDensity * .65 || this.spec.config.ruinDensity === 0) return;
    const x = rx * 128 + rng.range(48, 78); let z = rz * 128 + rng.range(-36, -18);
    const river = this.river(x, z); if (river.distance < river.width + 18) z = river.center - river.width - 22;
    if(this.spec.mode==='easy'&&this.villages().some(v=>distance(v,{x,z})<48))return;
    const variant = Math.floor(rng.range(0, 3));
    return { id: `ruin:${rx}:${rz}`, x, z, name: ['Pinefall Trading Post', 'Old Quarry Hamlet', 'Riverwatch Camp'][variant], variant, houses: 2 + Math.floor(rng.range(0, 3)), trader: { x: x - 5, z: z + 5 }, container: { x: x + 4, z: z + 5 } };
  }
  nearbyRuins(cx: number, cz: number) {
    const n = this.spec.config.chunkSize, rx = Math.floor(cx * n / 128), rz = Math.floor(cz * n / 128), out: Ruin[] = [];
    for (let x = rx - 1; x <= rx + 1; x++) for (let z = rz - 1; z <= rz + 1; z++) { const p = this.ruin(x, z); if (p) out.push(p); }
    return out;
  }
  chunk(cx: number, cz: number): Chunk {
    const id = `${cx},${cz}`, cached = this.cache.get(id); if (cached) return cached;
    const n = this.spec.config.chunkSize, rng = new SeededRNG(derive(this.spec.seeds.resources, 'chunk-nodes', cx, cz));
    const nodes: Node[] = [], trees: Tree[] = [], fishing: FishingSpot[] = [], ruins = this.nearbyRuins(cx, cz);
    for (let i = 0; i < Math.floor(14 * this.spec.config.resourceDensity); i++) {
      const x = cx * n + rng.range(1, n - 1), z = cz * n + rng.range(1, n - 1);
      // Coordinates depend only on the resource stream; terrain determines accessibility, not placement.
      const resource: Resource = i % 5 === 0 ? 'metal' : i % 2 ? 'wood' : 'stone';
      const amount = 5 + Math.floor(rng.range(0, 7)); if (Math.hypot(x, z) < 6) continue;
      nodes.push({ id: `node:${cx}:${cz}:${i}`, x, z, resource, amount, radius: resource === 'wood' ? .7 : .9 });
    }
    if (cx === 0 && cz === 0) nodes.push({ id: 'starter:wood', x: 3.8, z: 4, resource: 'wood', amount: 30, radius: .7 });
    if (cx === -1 && cz === 0) nodes.push({ id: 'starter:stone', x: -4, z: 3, resource: 'stone', amount: 25, radius: .9 });
    const veg = new SeededRNG(derive(this.spec.seeds.biomes, 'trees', cx, cz));
    for (let i = 0; i < 35; i++) {
      const x = cx * n + veg.range(.7, n - .7), z = cz * n + veg.range(.7, n - .7), scale = veg.range(.8, 1.5), sparse = veg.next();
      if (this.cliffAt({x,z},5)||Math.hypot(x, z) < 13 || this.isWater(x, z) || ruins.some(r => distance(r, { x, z }) < 15) || this.villages().some(v => distance(v, { x, z }) < 19) || (this.biome(x, z) !== 'Pinewood' && sparse > .35)) continue;
      trees.push({ x, z, scale });
    }
    if (this.spec.config.riverDensity > 0) {
      const x = cx * n + n * .4, r = this.river(x, cz * n + n / 2), z = r.center - r.width - 1.5;
      if (Math.floor(z / n) === cz) fishing.push({ id: `fish:${cx}:${r.row}`, x, z, availability: 8 + derive(this.spec.seeds.resources, 'fish', cx, r.row) % 16 });
    }
    const accessible=[...nodes];
    for(const cliff of this.cliffs({x:cx*n+n/2,z:cz*n+n/2}))accessible.push(...this.cliffOres(cliff).filter(node=>Math.floor(node.x/n)===cx&&Math.floor(node.z/n)===cz));
    const result = { id, cx, cz, trees:this.spec.mode==='hard'?trees.filter(t=>Math.hypot(t.x,t.z)>200):trees, nodes:this.spec.mode==='hard'?accessible.filter(t=>Math.hypot(t.x,t.z)>200):accessible, fishing:this.spec.mode==='hard'?fishing.filter(t=>Math.hypot(t.x,t.z)>200):fishing, ruins: ruins.filter(r => Math.floor(r.x / n) === cx && Math.floor(r.z / n) === cz) };
    if (this.cache.size > 128) this.cache.delete(this.cache.keys().next().value!); this.cache.set(id, result); return result;
  }
  chunkCoordinates(point:Point,radius=1){const n=this.spec.config.chunkSize,cx=Math.floor(point.x/n),cz=Math.floor(point.z/n),out:{id:string;cx:number;cz:number}[]=[];for(let x=cx-radius;x<=cx+radius;x++)for(let z=cz-radius;z<=cz+radius;z++)out.push({id:`${x},${z}`,cx:x,cz:z});return out.sort((a,b)=>Math.hypot(a.cx-cx,a.cz-cz)-Math.hypot(b.cx-cx,b.cz-cz));}
  cachedChunk(id:string){return this.cache.get(id);}
  around(point: Point, radius = 1) { const n = this.spec.config.chunkSize, cx = Math.floor(point.x / n), cz = Math.floor(point.z / n), out: Chunk[] = []; for (let x = cx - radius; x <= cx + radius; x++) for (let z = cz - radius; z <= cz + radius; z++) out.push(this.chunk(x, z)); return out; }
}
