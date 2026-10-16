import type { Point } from '../game/GameState';

interface DamageNumber {element:HTMLElement;point:Point;born:number;slot:number}
export class DamageEffects {
  private active:DamageNumber[]=[];
  private reduced=matchMedia('(prefers-reduced-motion: reduce)');
  private layer=document.createElement('div');
  private sequence=0;
  constructor(private project:(point:Point)=>{x:number;y:number}|undefined){this.layer.className='damage-effects';this.layer.setAttribute('aria-hidden','true');document.body.appendChild(this.layer);}
  spawn(event:Point&{amount:number;targetId:string;bleed:boolean},now:number){
    if(event.amount<=0||!this.project(event))return;
    if(this.active.length>=32)this.active.shift()!.element.remove();
    const element=document.createElement('b');element.className=`damage-number${event.targetId==='player'?' incoming':''}${event.bleed?' bleed':''}`;element.dataset.target=event.targetId;
    element.textContent=`-${Number(event.amount.toFixed(2))}`;this.layer.appendChild(element);this.active.push({element,point:{x:event.x,z:event.z},born:now,slot:this.sequence++%3});
  }
  update(now:number){this.active=this.active.filter(number=>{
    const age=now-number.born,point=this.project(number.point),duration=this.reduced.matches?600:1000;
    if(!point||age>=duration){number.element.remove();return false;}
    number.element.style.transform=`translate(${point.x+(number.slot-1)*15}px,${point.y-45-(this.reduced.matches?0:age*.045)}px) translate(-50%,-50%)`;
    number.element.style.opacity=String(Math.min(1,(duration-age)/220));return true;
  });}
  clear(){for(const number of this.active)number.element.remove();this.active=[];}
}
