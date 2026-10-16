import * as T from 'three';
/** Original grip-centred harvesting tools, owned by each worker visual. */
export function workerTool(kind:'axe'|'pickaxe'){
 const group=new T.Group();group.name='worker-tool';group.userData.tool=kind;
 const wood=new T.MeshStandardMaterial({color:0x9b7045,roughness:.9}),steel=new T.MeshStandardMaterial({color:0x9caeb3,roughness:.55,metalness:.35});
 const handle=new T.Mesh(new T.CylinderGeometry(.027,.035,.78,6),wood);handle.position.y=.2;group.add(handle);
 if(kind==='axe'){const head=new T.Mesh(new T.BoxGeometry(.32,.19,.075),steel);head.position.set(.1,.55,0);group.add(head);const edge=new T.Mesh(new T.ConeGeometry(.12,.19,3),steel);edge.rotation.z=-Math.PI/2;edge.position.set(.29,.55,0);group.add(edge);}
 else{const curve=new T.CatmullRomCurve3([new T.Vector3(-.36,.44,0),new T.Vector3(-.16,.57,0),new T.Vector3(.13,.57,0),new T.Vector3(.37,.43,0)]);group.add(new T.Mesh(new T.TubeGeometry(curve,12,.035,5,false),steel));}
 group.rotation.z=-.3;group.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=true;});return group;
}
