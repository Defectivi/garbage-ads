import {derive} from '../utils/SeededRNG';
/** Version one: closed pronounceable syllables, with regional endings. Never uses a global RNG. */
export function villageNames(seed:number,sites:readonly {id:string;x:number;z:number}[]){
 const starts=['Vor','Drel','Mos','Thal','Yev','Kren','Val','Nor','Bel','Zar','Kel','Ost','Vel','Rav','Tor','Sel'];
 const middles=['a','e','i','o','u','va','re','ko','la','en','or','un'];
 const regions=[['nesk','vath','vorsk','rund','kren','grad'],['ren','val','drel','skar','ven','thal'],['vik','holm','lund','dal','gard','vorn']];
 const names:Record<string,string>={},used=new Set<string>();
 for(const site of [...sites].sort((a,b)=>a.id.localeCompare(b.id))){const region=Math.abs(Math.floor(site.x/256)+Math.floor(site.z/256))%regions.length;let candidate='';
  for(let attempt=0;attempt<128;attempt++){const n=derive(seed,`village-name-v1:${site.id}`,attempt),end=regions[region];candidate=starts[n%starts.length]+(n%3===0?middles[(n>>>8)%middles.length]:'')+end[(n>>>16)%end.length];if(!used.has(candidate))break;}
  // A deterministic pronounceable suffix also handles deliberately colliding/modded site sets.
  let suffix=0,unique=candidate;while(used.has(unique)){unique=candidate+'a'+(suffix++).toString(36).replace(/[0-9]/g,n=>'aeniorulst'[Number(n)]);}used.add(unique);names[site.id]=unique;
 }return names;
}
