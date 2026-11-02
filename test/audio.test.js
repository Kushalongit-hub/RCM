import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {ENGINE_PRESETS,audioTelemetry} from '../public/audio-presets.js';import {EngineVoice} from '../public/engine-dsp.js';import {perspective,attenuation,EventWindow} from '../public/audio-spatial.js';import {roomAudio} from '../server-audio.js';import {newCar,stepWorld} from '../game.js';
import {vehicleSpec} from '../public/vehicle-catalog.js';
test('Stock 42 uses pack recordings with bounded RPM playback and shift cut',async()=>{
 const pcm=async name=>{const b=await readFile('public/audio/'+name+'.wav');return Float32Array.from({length:(b.length-44)/2},(_,i)=>b.readInt16LE(44+i*2)/32768);};
 const bank={idle:await pcm('stock-idle'),mid:await pcm('stock-loop'),rate:24000};
 for(const rate of [24000,48000]){
  const voice=new EngineVoice('stock',rate,bank);let power=0,cut=0;
  for(let i=0;i<rate;i++){const v=voice.sample(10000,1);assert.ok(Number.isFinite(v)&&Math.abs(v)<.43);if(i>rate/2)power+=v*v;}
  for(let i=0;i<rate;i++){const v=voice.sample(10000,1,0,0,true);if(i>rate/2)cut+=v*v;}
  assert.ok(power>.001&&cut<power*.15);assert.ok(voice.samplePositions.every(p=>p>0));
 }
 assert.equal(new EngineVoice('gt3',24000,bank).samples,null);assert.equal(new EngineVoice('formula',24000,bank).samples,null);
});
test('phone fallback loops wrap without a large amplitude discontinuity',async()=>{
 for(const id of Object.keys(ENGINE_PRESETS)){
  const b=await readFile('public/audio/'+id+'-loop.wav');
  assert.ok(Math.abs(b.readInt16LE(44)-b.readInt16LE(b.length-2))/32768<.06,id+' loop seam');
 }
});
test('every car climbs its gearbox, drops RPM on upshift, lifts and downshifts back to idle',()=>{
 for(const p of Object.values(ENGINE_PRESETS)){
  const car={vehicleId:p.id,speed:0,vx:0,vz:0,yaw:0,throttle:0},top=vehicleSpec(p.id).maxSpeed,seen=new Set(),events=[];let drops=0,downshifts=0;
  for(let frame=0;frame<420;frame++){
   const t=frame/30;car.speed=t<1?0:t<7?top*(t-1)/6:t<9?top*(1-(t-7)*.15):t<11?top*.7*(11-t)/2:0;car.vz=car.speed;car.throttle=t>=1&&t<7?1:0;
   const oldGear=car.gear,oldRPM=car.rpm;audioTelemetry(car,1/30,(kind)=>events.push(kind));seen.add(car.gear);
   if(oldGear>0&&car.gear>oldGear){assert.ok(car.rpm<oldRPM,p.id+' upshift RPM drop');assert.ok(car.shiftCut);drops++;}
   if(car.gear>0&&car.gear<oldGear)downshifts++;
   assert.ok(car.rpm>=p.idle&&car.rpm<=p.redline,p.id+' RPM bounds');
   if(t>7&&t<9)assert.equal(car.load,0);
  }
  assert.equal(seen.size,p.gears+1);assert.equal(drops,p.gears-1);assert.ok(downshifts>=p.gears-2);assert.equal(car.gear,0);assert.ok(Math.abs(car.rpm-p.idle)<1);
  if(p.turbo)assert.ok(events.includes('blowoff'));if(p.id==='drift')assert.ok(events.includes('crackle'));
 }
});
test('all engines open under load and soften on lift and gear cut at both playback rates',()=>{
 for(const rate of [24000,48000])for(const p of Object.values(ENGINE_PRESETS)){
  const voice=new EngineVoice(p.id,rate);
  const rms=(load,cut=false)=>{let energy=0;for(let i=0;i<rate/2;i++){const s=voice.sample(p.redline*.6,load,0,0,cut);assert.ok(Number.isFinite(s)&&Math.abs(s)<.43);if(i>=rate/4)energy+=s*s;}return Math.sqrt(energy/(rate/4));};
  const coast=rms(0),power=rms(1),shift=rms(1,true),lift=rms(0);
  assert.ok(power>coast*1.5,p.id+' load must open the exhaust');
  assert.ok(shift<power*.4,p.id+' shift must cut combustion');
  assert.ok(lift<power*.75,p.id+' lift must soften the exhaust');
 }
});
test('eight presets produce distinct finite bounded audio at idle, load, redline and lift',()=>{const hashes=new Set();for(const p of Object.values(ENGINE_PRESETS)){const voice=new EngineVoice(p.id,24000),samples=[];for(const load of [0,1,.2])for(let i=0;i<6000;i++){const value=voice.sample(load===0?p.idle:p.redline,load,.2,40);assert.ok(Number.isFinite(value)&&Math.abs(value)<.43);samples.push(value);}hashes.add(createHash('sha256').update(new Float32Array(samples)).digest('hex'));assert.ok(p.cylinders>=4);assert.ok(p.shift>0);}assert.equal(hashes.size,8);});
test('distance, perspective, Doppler and event identity use world space',()=>{const a={id:'a',x:0,y:0,z:0,vx:0,vz:0,yaw:0},b={...a,id:'b',x:8,vx:-20};assert.equal(perspective(a,a).gain,1);assert.ok(attenuation(8)>attenuation(25));assert.ok(attenuation(25)>attenuation(59));assert.equal(attenuation(60),0);assert.equal(attenuation(80),0);assert.ok(perspective(a,b).pan>.9);assert.ok(perspective(a,b).doppler>1&&perspective(a,b).doppler<=1.1);const events=new EventWindow();assert.ok(events.accept({id:'one',time:1000},1050));assert.equal(events.accept({id:'one',time:1000},1060),false);assert.equal(events.accept({id:'old',time:0},2000),false);});
test('all synthesized assets have valid PCM headers, no clipping/DC, and manifest hashes',async()=>{const manifest=JSON.parse(await readFile('public/audio/manifest.json'));assert.equal(manifest.filter(a=>a.vehicleId&&a.file.endsWith('-loop.wav')).length,8);for(const asset of manifest){const b=await readFile('public/audio/'+asset.file);assert.equal(createHash('sha256').update(b).digest('hex'),asset.sha256);assert.equal(asset.license,asset.vehicleId==='stock'?'CC-BY-4.0':'CC0-1.0');if(!asset.file.endsWith('.wav'))continue;assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt32LE(40),b.length-44);let sum=0,peak=0;for(let i=44;i<b.length;i+=2){const v=b.readInt16LE(i)/32768;sum+=v;peak=Math.max(peak,Math.abs(v));}assert.ok(peak<.73&&peak>.005);assert.ok(Math.abs(sum/((b.length-44)/2))<.001);}});
test('pairing stays bound to a player, replaces explicitly, expires on leave, and never adds a racer',async()=>{const players=new Map([['p1',{name:'One'}],['p2',{name:'Two'}],['p3',{name:'Three'}],['p4',{name:'Four'}]]),messages=new Map(),send=(ws,m)=>{if(!messages.has(ws))messages.set(ws,[]);messages.get(ws).push(m);},cars=['p1','p2','p3','p4'].map((id,i)=>({...newCar(id,id,i),x:[0,8,80,25][i],y:0,z:0,rpm:5000,gear:2,engineOn:true})),audio=roomAudio({code:'test',players,send,getCars:()=>cars,getPhase:()=> 'racing'});
 const auth={playerId:'p1',display:false,host:'http://localhost:3000'};await audio.message('owner',{type:'audio-pair',playerId:'p2'},auth);assert.match(messages.get('owner').at(-1).message,/own joined driver/);await audio.message('owner',{type:'audio-pair'},auth);const link=messages.get('owner').at(-1);const token=new URL(link.url).searchParams.get('token');assert.ok(token.length>=40);await audio.message('phone',{type:'audio-bind',token},{});assert.equal(messages.get('phone').at(-1).playerId,'p1');assert.equal(players.size,4);
 await audio.message('other',{type:'audio-bind',token},{});assert.match(messages.get('other').at(-1).message,/another device/);await audio.message('other',{type:'audio-bind',token,replace:true},{});assert.equal(messages.get('phone').at(-1).type,'audio-replaced');audio.emit('collision',cars[0],.8);audio.tick();const frame=messages.get('other').at(-1);assert.equal(frame.listenerId,'p1');assert.deepEqual(frame.emitters.map(c=>c.id),['p1','p2','p4']);assert.equal(frame.events.length,1);assert.ok(!JSON.stringify(frame).includes(token));audio.tick();assert.equal(messages.get('other').at(-1).events.length,0);audio.revoke('p1');await audio.message('bad',{type:'audio-bind',token,replace:true},{});assert.match(messages.get('bad').at(-1).message,/expired/);audio.clear();});
test('gear/RPM telemetry follows real speed and input without changing physics',()=>{const car=newCar('p','P',0),before={x:car.x,y:car.y,z:car.z,vx:car.vx,vz:car.vz};car.throttle=1;audioTelemetry(car,.1);assert.deepEqual({x:car.x,y:car.y,z:car.z,vx:car.vx,vz:car.vz},before);const events=[];car.speed=30;audioTelemetry(car,.1,(...args)=>events.push(args));assert.ok(car.rpm>0&&car.gear>1);assert.equal(events[0][0],'shift');car.finished=true;audioTelemetry(car,.1);assert.equal(car.engineOn,false);});
