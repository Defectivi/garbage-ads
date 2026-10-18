import type {GameState,Point} from '../game/GameState';
import type {Game} from '../game/Game';
import {distance} from '../world/WorldManager';
export interface MapMarker extends Point{id:string;label:string}
export interface MapPath{id:string;label:string;points:Point[]}
export interface MapJournal{version:1;nextId:number;markers:MapMarker[];paths:MapPath[];explored:string[]}
export const chartKey=(p:Point)=>`${Math.floor(p.x/16)},${Math.floor(p.z/16)}`;
export function journal(s:GameState):MapJournal{return s.journal??(s.journal={version:1,nextId:1,markers:[],paths:[],explored:[]});}
export function charted(s:GameState,p:Point){return !!s.journal?.explored.includes(chartKey(p));}
export function noteLabel(value:unknown){if(typeof value!=='string')throw new Error('Enter a text label.');const label=value.trim().normalize('NFC');if(!label||label.length>64||/[\u0000-\u001f\u007f]/.test(label))throw new Error('Use a label of 1-64 printable characters.');return label;}
export function mapPoint(p:Point){if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||Math.abs(p.x)>1e6||Math.abs(p.z)>1e6)throw new Error('Map coordinates must be within +/-1,000,000.');return{x:p.x,z:p.z};}
export class MapNotes{
 private explored:Set<string>;private clock=0;
 constructor(private game:Game){const missing=!game.state.journal,j=journal(game.state);this.explored=new Set(j.explored);if(missing){for(const id of game.state.discovered){let point:Point|undefined=id==='home'?{x:0,z:0}:game.world.villages().find(v=>v.id===id);if(id.startsWith('ruin:')){const[,x,z]=id.split(':');point=game.world.ruin(Number(x),Number(z));}if(point){const key=chartKey(point);if(!this.explored.has(key)){this.explored.add(key);j.explored.push(key);}}}}this.explore(0,true);}
 explore(dt:number,force=false){if(!force&&(this.clock-=dt)>0)return;this.clock=.5;const p=this.game.state.player,j=journal(this.game.state);for(let x=Math.floor(p.x/16)-2;x<=Math.floor(p.x/16)+2;x++)for(let z=Math.floor(p.z/16)-2;z<=Math.floor(p.z/16)+2;z++){const point={x:x*16+8,z:z*16+8},key=`${x},${z}`;if(this.explored.size>=50000)return;if(!this.explored.has(key)&&distance(point,p)<=24&&this.game.world.visible(p,point)){this.explored.add(key);j.explored.push(key);}}}
 marker(label:string,p:Point,id?:string){const j=journal(this.game.state),text=noteLabel(label),point=mapPoint(p);if(!charted(this.game.state,point))throw new Error('Explore this location before marking it.');const existing=id?j.markers.find(m=>m.id===id):undefined;if(id&&!existing)throw new Error('Unknown marker.');if(existing){Object.assign(existing,point,{label:text});return existing;}if(j.markers.length>=200)throw new Error('Marker limit reached (200).');if(j.nextId>=1e9)throw new Error('Map note ID limit reached.');const m={id:`note:${j.nextId++}`,label:text,...point};j.markers.push(m);return m;}
 path(label:string,points:Point[],id?:string){const j=journal(this.game.state),text=noteLabel(label);if(points.length<2||points.length>128)throw new Error('Routes need 2-128 waypoints.');const copy=points.map(mapPoint);if(copy.some(p=>!charted(this.game.state,p)))throw new Error('Route waypoints must be explored.');const old=id?j.paths.find(p=>p.id===id):undefined;if(id&&!old)throw new Error('Unknown route.');if(old){old.label=text;old.points=copy;return old;}if(j.paths.length>=50)throw new Error('Route limit reached (50).');if(j.nextId>=1e9)throw new Error('Map note ID limit reached.');const route={id:`note:${j.nextId++}`,label:text,points:copy};j.paths.push(route);return route;}
 delete(id:string){const j=journal(this.game.state);j.markers=j.markers.filter(m=>m.id!==id);j.paths=j.paths.filter(p=>p.id!==id);}
}

/** Clip before sampling so an imported million-metre route cannot monopolize map painting. */
export function visibleRouteSegments(state:GameState,points:Point[],center:Point){
 const known=new Set(state.journal?.explored??[]),segments:[Point,Point][]=[];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z;let low=0,high=1,valid=true;
  for(const [p,q]of [[-dx,a.x-center.x+128],[dx,center.x+128-a.x],[-dz,a.z-center.z+128],[dz,center.z+128-a.z]]){if(p===0){if(q<0){valid=false;break;}}else{const r=q/p;if(p<0)low=Math.max(low,r);else high=Math.min(high,r);if(low>high){valid=false;break;}}}if(!valid)continue;
  const start={x:a.x+dx*low,z:a.z+dz*low},end={x:a.x+dx*high,z:a.z+dz*high},steps=Math.max(1,Math.ceil(Math.hypot(end.x-start.x,end.z-start.z)/4));
  for(let j=0;j<steps;j++){const from={x:start.x+(end.x-start.x)*j/steps,z:start.z+(end.z-start.z)*j/steps},to={x:start.x+(end.x-start.x)*(j+1)/steps,z:start.z+(end.z-start.z)*(j+1)/steps};if(known.has(chartKey(from))&&known.has(chartKey(to)))segments.push([from,to]);}
 }return segments;
}
