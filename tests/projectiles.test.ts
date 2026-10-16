import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Game} from '../src/game/Game';
import {simulationState as newState} from './fixtures/state';
import {worldSpec} from '../src/game/GameConfig';
import {WEAPON_IDS} from '../src/data/weapons';
import {ProjectileModels,molotovMesh} from '../src/rendering/ProjectileModels';

test('full enemy and player objects cannot overwrite projectile identity or leak actor fields',()=>{
 const g=new Game(newState(worldSpec(42)));g.combat.ensureEncounters();const enemy=Object.values(g.state.combat.actors).find(a=>a.weapon)!;
 const before={x:enemy.x,z:enemy.z};
 for(const owner of [enemy,g.state.player])for(const weapon of WEAPON_IDS){
  const offset=g.state.combat.projectiles.length;g.combat.fireWeapon(owner===enemy?enemy.id:'player',owner,{x:owner.x+10,z:owner.z},weapon);
  const shots=g.state.combat.projectiles.slice(offset);assert(shots.length>0);
  for(const shot of shots){assert.notEqual(shot.id,enemy.id);assert.equal(shot.ownerId,owner===enemy?enemy.id:'player');assert.equal(shot.x,owner.x);assert.equal(shot.z,owner.z);assert(!('hp' in shot));assert(!('groupId' in shot));}
 }
 assert.equal(new Set(g.state.combat.projectiles.map(p=>p.id)).size,g.state.combat.projectiles.length);
 assert.deepEqual({x:enemy.x,z:enemy.z},before);
});

test('projectile assets have separate arrowhead/fletching, pellet/tracer and textured lit bottle',()=>{
 const assets=new ProjectileModels(),arrow=assets.create('arrow'),pellet=assets.create('pellet'),bottle=assets.create('bottle');
 assert(arrow.getObjectByName('steel-arrowhead'));assert.equal(arrow.children.filter(c=>c.name==='fletching').length,3);assert(pellet.getObjectByName('shot-pellet'));assert(pellet.getObjectByName('shot-tracer'));assert(bottle.getObjectByName('cloth-wick'));assert(bottle.getObjectByName('lit-wick'));
 const texture=((bottle.getObjectByName('textured-glass') as T.Mesh).material as T.MeshStandardMaterial).map!;assert(texture.isDataTexture);assert.equal(texture.image.width,64);
 const hand=molotovMesh();assert.equal(((hand.getObjectByName('textured-glass') as T.Mesh).material as T.MeshStandardMaterial).map,texture);
 const clone=assets.create('arrow');assert.notEqual(clone,arrow);assert.equal((clone.children[0] as T.Mesh).geometry,(arrow.children[0] as T.Mesh).geometry);assert(!clone.getObjectByProperty('type','SkinnedMesh'));
 for(const asset of [arrow,pellet,bottle,assets.create('swing')]){const bounds=new T.Box3().setFromObject(asset);assert(!bounds.isEmpty());for(const v of [...bounds.min.toArray(),...bounds.max.toArray()])assert(Number.isFinite(v));}
});
