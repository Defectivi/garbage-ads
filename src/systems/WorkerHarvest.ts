import type {Point} from '../game/GameState';
import type {Node} from '../world/WorldManager';
import {distance} from '../world/WorldManager';
import {route} from './Navigation';
export const workerHarvestReach=(node:Node)=>node.kind==='boulder'?2.65:2;
/** Stand on a valid navigation cell within tool reach, never inside the resource collider. */
export function harvestRoute(from:Point,target:Point,reach:number,valid:(p:Point)=>boolean){
 const points:Point[]=[];for(let x=Math.ceil((target.x-reach)/1.5)*1.5;x<=target.x+reach;x+=1.5)for(let z=Math.ceil((target.z-reach)/1.5)*1.5;z<=target.z+reach;z+=1.5){const p={x,z};if(distance(p,target)<reach-.05&&valid(p))points.push(p);}
 points.sort((a,b)=>distance(from,a)-distance(from,b));for(const p of points.slice(0,16)){const path=route(from,p,valid);if(path.length)return path;}return[];
}
