import type { Point } from './GameState';

export const meleeDuration=(weapon:string)=>weapon==='wooden_sword'?.55:weapon==='machete'?.6:.65;
export function meleePath(weapon:string,progress:number){
  const t=Math.max(0,Math.min(1,progress)),u=Math.max(0,Math.min(1,(t-.12)/.6)),sweep=u*u*(3-2*u);
  if(weapon==='spear')return {x:.28,y:1.13,z:.12+Math.sin(Math.PI*t*t*(3-2*t))*.48,dx:0,dy:.04,dz:1,length:1.48};
  const angle=1.25-sweep*2.65;
  return {x:Math.sin(angle)*.48,y:1.15+Math.sin(sweep*Math.PI)*.06,z:.22+Math.cos(angle)*.3,dx:Math.sin(angle),dy:-.12,dz:Math.cos(angle),length:weapon==='machete'?.8:.82};
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
