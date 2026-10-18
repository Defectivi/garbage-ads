import {derive,SeededRNG} from '../utils/SeededRNG';
import type {Point} from '../game/GameState';
export interface Highland extends Point {radius:number;height:number;stretch:number;angle:number}
/** Bounded seed-only regional features: broad foothills and distinct mountain masses. */
export class Highlands {
  private regions=new Map<string,Highland[]>();
  constructor(private seed:number,private scale:number){}
  features(x:number,z:number){
    const size=192*this.scale,cx=Math.floor(x/size),cz=Math.floor(z/size),key=`${cx},${cz}`;
    let list=this.regions.get(key);if(list)return list;
    list=[];for(let a=cx-1;a<=cx+1;a++)for(let b=cz-1;b<=cz+1;b++){
      const rng=new SeededRNG(derive(this.seed,'highlands',a,b));if(rng.next()>.68)continue;
      const mountain=rng.next()<.7;
      list.push({x:(a+rng.range(.25,.75))*size,z:(b+rng.range(.25,.75))*size,radius:rng.range(48,80)*this.scale,height:mountain?rng.range(32,66):rng.range(10,20),stretch:rng.range(.8,1.4),angle:rng.range(0,Math.PI)});
    }
    if(this.regions.size>=128)this.regions.delete(this.regions.keys().next().value!);this.regions.set(key,list);return list;
  }
  height(x:number,z:number){let y=0;for(const h of this.features(x,z)){const dx=x-h.x,dz=z-h.z,c=Math.cos(h.angle),s=Math.sin(h.angle),r=Math.hypot((dx*c+dz*s)/h.radius,(-dx*s+dz*c)/(h.radius*h.stretch));if(r<1)y+=h.height*Math.pow(1-r*r,1.65);}return y;}
}
