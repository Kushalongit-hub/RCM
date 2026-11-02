import {pointAt} from '../public/track.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VEHICLES,vehicleSpec} from '../public/vehicle-catalog.js';
import {createVehicle,animateVehicle,triangleCount} from '../public/vehicle-meshes.js';
import {newCar,step,stepWorld} from '../game.js';

test('eight distinct editable models have valid geometry, GLB imports and independent wheel rigs',async()=>{
  const signatures=new Set();
  for(const spec of VEHICLES){
    const root=createVehicle(spec.id),second=createVehicle(spec.id);assert.equal(root.userData.vehicleId,spec.id);
    assert.equal(root.userData.wheels.length,4);assert.ok(root.getObjectByName('CollisionGeometry'));assert.ok(root.getObjectByName('CameraAnchor'));assert.ok(root.getObjectByName('CenterOfMassReference'));
    assert.ok(triangleCount(root)>3000&&triangleCount(root)<8000);const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());assert.ok(size.x>2&&size.x<4&&size.z>5&&size.z<7&&size.y>1&&size.y<3);
    const body=root.userData.body;signatures.add(triangleCount(body)+':'+size.y.toFixed(3));
    root.traverse(m=>{if(!m.isMesh)return;for(const attr of ['position','normal','color'])assert.ok(m.geometry.attributes[attr]);for(const n of m.geometry.attributes.position.array)assert.ok(Number.isFinite(n));const normal=m.geometry.attributes.normal;for(let i=0;i<normal.count;i++)assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<.001);});
    animateVehicle(root,.75,12,.1);for(const wheel of root.userData.wheels){assert.equal(wheel.pivot.rotation.y,wheel.front?.315:0);assert.ok(wheel.spin.rotation.x>0);assert.ok(Math.abs(second.getObjectByName(wheel.pivot.name).rotation.y)<1e-12);assert.ok(Math.abs(second.getObjectByName(wheel.spin.name).rotation.x)<1e-12);assert.equal(wheel.pivot.position.y,wheel.radius);}
    const bytes=await readFile(new URL('../public/vehicles/'+spec.id+'.glb',import.meta.url));assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');assert.ok(gltf.scene.getObjectByName('VisualBody'));assert.equal(gltf.scene.getObjectByName('FrontLeftWheelPivot').position.z,spec.axles[0]);assert.ok(gltf.scene.getObjectByName('CollisionGeometry'));
  }
  assert.equal(signatures.size,8);assert.equal(vehicleSpec('__proto__').id,'formula');
});
test('each vehicle drives, brakes, and AI completes the circuit using its own tuning',()=>{
  for(const spec of VEHICLES){
    const human=newCar('test','Test',0,false,spec.id);human.input={throttle:true};for(let i=0;i<90;i++)step(human,1/60,i/60);assert.ok(human.speed>10);human.input={brake:true};for(let i=0;i<120;i++)step(human,1/60,2+i/60);assert.ok(human.vx*Math.sin(human.yaw)+human.vz*Math.cos(human.yaw)<0);
    const bot=newCar('bot','Test',0,true,spec.id);for(let i=0;i<60*200&&!bot.finished;i++)step(bot,1/60,i/60);assert.ok(bot.finished,spec.id+' bot must finish');assert.ok(Number.isFinite(bot.finishTime));
  }
});
test('oriented colliders use length and mass, including nose-to-tail contact',()=>{
  const a=newCar('a','A',0,false,'formula'),b=newCar('b','B',0,false,'stock');const p=pointAt(120),fx=Math.sin(p.yaw),fz=Math.cos(p.yaw);Object.assign(a,{x:p.x,z:p.z,y:p.y,yaw:p.yaw,vx:0,vz:0});Object.assign(b,{x:p.x+fx*3,z:p.z+fz*3,y:p.y,yaw:p.yaw,vx:0,vz:0});stepWorld([a,b],0,0);assert.ok((b.x-a.x)*fx+(b.z-a.z)*fz>5);assert.ok(Math.hypot(a.x-p.x,a.z-p.z)>Math.hypot(b.x-p.x-fx*3,b.z-p.z-fz*3),'lighter car moves farther');
});

test('reference proportions stay long and low with restrained enclosed-car roof heights',()=>{
  for(const spec of VEHICLES){const root=createVehicle(spec.id),size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());assert.ok(size.y/size.z<.36,spec.id+' silhouette must stay low');if(spec.id==='formula')continue;assert.ok(size.x/size.z<.50,spec.id+' silhouette must stay longer than twice its width');const glass=root.userData.body.children.find(m=>m.isMesh&&m.material.name==='glass');assert.ok(glass);const box=new THREE.Box3().setFromObject(glass);assert.ok(box.max.y<1.83,spec.id+' roof must not become a boxy tall cabin');}
});
