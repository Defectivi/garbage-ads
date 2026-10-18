import type { Point } from './GameState';

export const meleeDuration=(weapon:string)=>weapon==='punch'?.45:(weapon==='wooden_sword'||weapon==='stone_sword')?.55:weapon==='machete'?.6:.65;
export function meleePath(weapon:string,progress:number){
  const t=Math.max(0,Math.min(1,progress));
  if(weapon==='punch')return {x:.22,y:1.4,z:.2+Math.sin(Math.PI*t)*.45,dx:0,dy:0,dz:1,length:.15};
  if(weapon==='spear')return {x:.28,y:1.13,z:.12+Math.sin(Math.PI*t*t*(3-2*t))*.48,dx:0,dy:.04,dz:1,length:1.48};
  // Raise beside the shoulder, cut diagonally down and forward, then recover.
  // The renderer and collision sweep sample this same blade axis.
  const ease=(n:number)=>{const v=Math.max(0,Math.min(1,n));return v*v*(3-2*v);};
  const wind=ease(t/.24),cut=ease((t-.24)/.43),rest=ease((t-.78)/.22);
  const x=.32+.05*wind-.5*cut+.5*rest,y=1.16+.53*wind-.67*cut+.14*rest,z=.32+.03*wind+.19*cut-.19*rest;
  return {x,y,z,dx:.25+.2*wind-.95*cut+.75*rest,dy:-.85+1.8*wind-1.65*cut-.15*rest,dz:.4-.65*wind+1.1*cut-.45*rest,length:weapon==='machete'?.8:.82};
}
export function bladeSegment(origin:Point,heading:number,weapon:string,progress:number){
  const pose=meleePath(weapon,progress),sin=Math.sin(heading),cos=Math.cos(heading);
  const a={x:origin.x+pose.x*cos+pose.z*sin,z:origin.z-pose.x*sin+pose.z*cos};
  const length=pose.length/Math.hypot(pose.dx,pose.dy,pose.dz);
  return {a,b:{x:a.x+(pose.dx*cos+pose.dz*sin)*length,z:a.z+(-pose.dx*sin+pose.dz*cos)*length}};
}
export function segmentDistance(point:Point,a:Point,b:Point){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(point.x-a.x-dx*t,point.z-a.z-dz*t);}

export function projectileHeight(kind:string,t:number,fromHeight:number,toHeight:number){return fromHeight+1.3+(toHeight+(kind==='bottle'?.1:1.3)-fromHeight-1.3)*t+(kind==='bottle'?Math.sin(Math.PI*t)*3:0);}

export function segmentSegmentDistance(a:Point,b:Point,c:Point,d:Point){
  const rx=b.x-a.x,rz=b.z-a.z,sx=d.x-c.x,sz=d.z-c.z,den=rx*sz-rz*sx;
  if(Math.abs(den)>1e-9){const t=((c.x-a.x)*sz-(c.z-a.z)*sx)/den,u=((c.x-a.x)*rz-(c.z-a.z)*rx)/den;if(t>=0&&t<=1&&u>=0&&u<=1)return 0;}
  return Math.min(segmentDistance(a,c,d),segmentDistance(b,c,d),segmentDistance(c,a,b),segmentDistance(d,a,b));
}
