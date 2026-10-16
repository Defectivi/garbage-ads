import type { SettlementEvent } from '../game/PresentationEvents';
import type { Resource } from '../data/definitions';
import type { Point } from '../game/GameState';
import { itemIcon, uiIcon } from './Icons';

interface Flight { icon: HTMLElement; resource: Resource; point: Point; born: number; start?: { x: number; y: number }; mode?: 'spend'|'receipt'; anchor?: string }
/** Presentation only: this class has no reference to inventories or transactions. */
export class CollectionEffects {
  private flights: Flight[] = [];
  private pops = new Map<HTMLElement, Animation>();
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  readonly layer = document.createElement('div');
  constructor(private root: HTMLElement, private project: (point: Point) => { x: number; y: number } | undefined) {
    this.layer.className = 'collection-effects'; this.layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.layer);
  }
  private counter(resource: Resource) { return this.root.querySelector<HTMLElement>(`[data-resource="${resource}"]`); }
  private pop(resource: Resource) {
    const target = this.counter(resource)?.querySelector<HTMLElement>('b'); if (!target || this.reduced.matches) return;
    this.pops.get(target)?.cancel();
    const animation = target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)', color: '#ffe5a9', offset: .35 }, { transform: 'scale(1)' }], { duration: 230, easing: 'ease-out' });
    this.pops.set(target, animation); animation.onfinish = () => { if (this.pops.get(target) === animation) this.pops.delete(target); };
  }
  spawn(resource: Resource, point: Point, now = performance.now()) {
    if (!this.counter(resource) || this.reduced.matches || !this.project(point)) return;
    if (this.flights.length >= 12) this.flights.shift()!.icon.remove();
    const icon = document.createElement('span'); icon.className = 'collection-flight'; icon.dataset.resource = resource;
    icon.innerHTML = itemIcon(resource); this.layer.appendChild(icon);
    this.flights.push({ icon, resource, point: { ...point }, born: now });
    this.update(now);
  }
  spawnAction(event: SettlementEvent, now=performance.now()) {
    if(this.reduced.matches||!this.project(event))return;
    for(const cost of event.costs.flatMap(c=>c.stock>0&&c.stock<c.amount?[{...c,amount:c.stock},{...c,amount:c.amount-c.stock,stock:0}]:[c])) {
      const source=cost.stock>0?this.root.querySelector<HTMLElement>('#inventory'):this.counter(cost.resource);if(!source)continue;
      if(this.flights.length>=12)this.flights.shift()!.icon.remove();
      const box=source.getBoundingClientRect(),icon=document.createElement('span');icon.className='collection-flight spend-flight';icon.dataset.kind=event.kind;
      icon.innerHTML=itemIcon(cost.resource)+`<small>-${cost.amount}${cost.stock>0?' / stores':''}</small>`;this.layer.appendChild(icon);
      this.flights.push({icon,resource:cost.resource,point:{x:event.x,z:event.z},born:now,start:{x:box.x+box.width/2,y:box.y+box.height/2},mode:'spend'});
      if(cost.stock<cost.amount)this.pop(cost.resource);
    }
    if(this.flights.length>=12)this.flights.shift()!.icon.remove();
    const icon=document.createElement('span');icon.className='collection-flight settlement-receipt';icon.dataset.kind=event.kind;
    icon.innerHTML=uiIcon(event.kind==='build'?'build':'flame');const text=document.createElement('b');text.textContent=event.label;icon.appendChild(text);icon.style.opacity='0';this.layer.appendChild(icon);
    this.flights.push({icon,resource:'wood',point:{x:event.x,z:event.z},born:now+420,mode:'receipt',anchor:event.kind==='build'?'#build':'#fuel'});
    this.update(now);
  }
  update(now: number) {
    this.flights = this.flights.filter(flight => {
      const target = flight.anchor ? this.root.querySelector<HTMLElement>(flight.anchor) : this.counter(flight.resource), elapsed = now - flight.born;
      if(elapsed<0)return true;
      if (!target || this.reduced.matches) { flight.icon.remove(); return false; }
      if (elapsed >= 950) { flight.icon.remove(); if(flight.mode==='receipt'&&target){const animation=target.animate([{filter:'brightness(1)'},{filter:'brightness(1.7)'},{filter:'brightness(1)'}],{duration:320});this.pops.set(target,animation);animation.onfinish=()=>this.pops.delete(target);} else if(!flight.mode)this.pop(flight.resource); return false; }
      const source = this.project(flight.point); if (!source) { flight.icon.remove(); return false; }
      const box = target.getBoundingClientRect(), end = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      let x: number, y: number, scale = 1, opacity = 1;
      if(flight.mode==='spend') { const t=Math.min(1,elapsed/950),e=t*t*(3-2*t),a=flight.start!;x=a.x+(source.x-a.x)*e+Math.sin(Math.PI*t)*60;y=a.y+(source.y-a.y)*e-Math.sin(Math.PI*t)*55;scale=1-.6*t*t;opacity=1-Math.max(0,(t-.85)/.15); }
      else if (elapsed < 220) { const t = elapsed / 220; x = source.x; y = source.y - 38 * (1 - (1 - t) ** 2); scale = .65 + .35 * Math.min(1, t * 3); }
      else {
        flight.start ??= { x: source.x, y: source.y - 38 };
        const t = Math.min(1, (elapsed - 220) / 730), eased = t * t * (3 - 2 * t), a = flight.start;
        const control = { x: a.x + (end.x - a.x) * .35 + Math.min(100, Math.abs(end.x - a.x) * .2), y: Math.min(a.y, end.y) - 85 };
        x = (1 - eased) ** 2 * a.x + 2 * (1 - eased) * eased * control.x + eased ** 2 * end.x;
        y = (1 - eased) ** 2 * a.y + 2 * (1 - eased) * eased * control.y + eased ** 2 * end.y;
        scale = 1 - .7 * t ** 3; opacity = 1 - Math.max(0, (t - .8) / .2);
      }
      flight.icon.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${scale})`;
      flight.icon.style.opacity = String(opacity); return true;
    });
  }
  clear() { for (const f of this.flights) f.icon.remove(); this.flights = []; for (const a of this.pops.values()) a.cancel(); this.pops.clear(); }
  dispose() { this.clear(); this.layer.remove(); }
}
