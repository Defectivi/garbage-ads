import type {Point} from '../game/GameState';
/** Canvas uses object-fit:contain; clicks in its letterbox are not world locations. */
export function mapCoordinate(client:Point,bounds:{left:number;top:number;width:number;height:number},center:Point):Point|undefined{
 const size=Math.min(bounds.width,bounds.height),left=bounds.left+(bounds.width-size)/2,top=bounds.top+(bounds.height-size)/2;
 if(size<=0||client.x<left||client.x>left+size||client.z<top||client.z>top+size)return;
 return{x:center.x-128+(client.x-left)/size*256,z:center.z-128+(client.z-top)/size*256};
}
