import { derive } from '../utils/SeededRNG';
export interface SurvivorStyle {
  id: string; label: string; coat: number; yoke: number; hat: number; trousers: number; pack: number; skin: number;
  headwear: 'beanie' | 'hood' | 'cap'; gear: 'pack' | 'satchel' | 'tools' | 'fuel'; width: number; height: number;
}
const style=(id:string,label:string,coat:number,yoke:number,hat:number,pack:number,headwear:SurvivorStyle['headwear'],gear:SurvivorStyle['gear'],skin=0xc99f7a,width=1,height=1):SurvivorStyle=>({id,label,coat,yoke,hat,pack,headwear,gear,skin,width,height,trousers:0x354b54});
export const CHARACTER_STYLES = [
  style('trader-mara','Mara / timber merchant',0x8f6652,0x304c4c,0x304445,0x73563e,'beanie','satchel',0xbd8b66,.97,.97),
  style('trader-ivo','Ivo / quarry salvager',0x666e79,0x374451,0x785e47,0x485948,'cap','tools',0x93684c,1.09,1.03),
  style('trader-nell','Nell / river merchant',0x487a83,0x293f51,0x84969c,0x665b49,'hood','satchel',0xd5b496,.95,1),
  style('worker-copper','Copper / woodcutter',0xb47b3b,0x475142,0x4e6356,0x665336,'beanie','tools',0x987458,1.04,.99),
  style('worker-slate','Slate / builder',0x677b82,0x33464c,0xa89470,0x6b7253,'cap','tools',0xc9a37e,.99,1.04),
  style('villager-moss','Moss / resident',0x677a58,0x354d4d,0xb1a17d,0x626b4f,'hood','pack',0x805d49,.96,.96),
  style('villager-plum','Plum / resident',0x836878,0x3d4d5b,0x465c6a,0x6f6551,'beanie','satchel',0xc19a76,1.03,1),
  style('guard-watch','Watch / village guard',0x486c80,0x293f50,0x263a4b,0x465c58,'cap','pack',0xb08868,1.07,1.04),
  style('guard-warden','Warden / village guard',0x607d7c,0x334857,0x314750,0x4e6457,'hood','pack',0x8b644b,1.03,1.02),
  style('bandit-ash','Ash / raider',0x565b58,0x302f31,0x3f4141,0x554c3b,'hood','satchel',0xb78f6d,1.02,1),
  style('bandit-rust','Rust / raider',0x805d43,0x3f4544,0x65594a,0x454d43,'beanie','pack',0x805e47,1.06,1.03),
  style('bandit-frost','Frost / raider',0x64727e,0x3b424d,0x414a54,0x655b4d,'hood','satchel',0xc4a480,.97,1.02),
  style('arsonist-ember','Ember / fire raider',0xa45435,0x343a39,0x4c4138,0x6e703f,'hood','fuel',0xa67b58,1.03,.98),
  style('arsonist-cinder','Cinder / fire raider',0x8e6948,0x414243,0x66584b,0x716749,'cap','fuel',0xc09a74,.98,1.03)
];
export type CharacterRole='trader'|'worker'|'villager'|'guard'|'bandit'|'arsonist';
export function characterStyle(role:CharacterRole,identity:string,variant=0) {
  const pool=CHARACTER_STYLES.filter(s=>s.id.startsWith(role+'-'));
  let hash=0;for(const c of identity)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
  return role==='trader'?pool[variant%pool.length]:pool[hash%pool.length];
}

export function bearAppearance(identity:string):'bear-ivory'|'bear-frost' {
  return derive(0,identity)%2===0?'bear-ivory':'bear-frost';
}
