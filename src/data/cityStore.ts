import type {Resource} from './definitions';
import type {WeaponType} from './weapons';
export interface CityOffer {id:string;name:string;gold:number;weapon?:WeaponType;resource?:Resource;amount?:number}
export const CITY_OFFERS:CityOffer[]=[
 {id:'wooden_sword',name:'Wooden sword',gold:1,weapon:'wooden_sword'}, {id:'bow',name:'Bow',gold:1,weapon:'bow'},
 {id:'fish3',name:'3 fish',gold:1,resource:'fish',amount:3},{id:'wood3',name:'3 wood',gold:1,resource:'wood',amount:3},{id:'stone2',name:'2 stone',gold:1,resource:'stone',amount:2},
 {id:'stone_sword',name:'Stone sword',gold:3,weapon:'stone_sword'}, {id:'fish10',name:'10 fish',gold:3,resource:'fish',amount:10},{id:'wood10',name:'10 wood',gold:3,resource:'wood',amount:10}
];
