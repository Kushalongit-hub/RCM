import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ENGINE_PRESETS,audioTelemetry} from '../public/audio-presets.js';
import {vehicleSpec} from '../public/vehicle-catalog.js';
import {EngineVoice} from '../public/engine-dsp.js';
const dir=new URL('../public/audio/',import.meta.url);await mkdir(dir,{recursive:true});const rate=24000,manifest=[];
const packCredit={source:'Vehicle SFX Free by heyheythere; resampled to mono 24 kHz PCM, DC removed and peak limited',url:'https://heyheythere.itch.io/vehicle-sfx-free',license:'CC-BY-4.0',creator:'heyheythere'};
async function packPCM(name){
 const b=await readFile(new URL('../assets/vehicle-sfx/'+name+'.wav',import.meta.url));let offset=12;
 while(b.toString('ascii',offset,offset+4)!=='data')offset+=8+b.readUInt32LE(offset+4)+(b.readUInt32LE(offset+4)%2);
 const data=Float64Array.from({length:b.readUInt32LE(offset+4)/2},(_,i)=>b.readInt16LE(offset+8+i*2)/32768),mean=data.reduce((a,b)=>a+b,0)/data.length;
 const peak=data.reduce((a,v)=>Math.max(a,Math.abs(v-mean)),0),gain=Math.min(1,.7/Math.max(.001,peak));return data.map(v=>(v-mean)*gain);
}
const stockSamples={idle:await packPCM('stock-idle'),mid:await packPCM('stock-loop'),rate};
await wav('stock-idle',stockSamples.idle,{...packCredit,vehicleId:'stock',kind:'recorded idle loop'});
async function wav(name,data,meta={}){let mean=data.reduce((a,b)=>a+b,0)/data.length;data=data.map(v=>v-mean);const peak=data.reduce((peak,v)=>Math.max(peak,Math.abs(v)),0),gain=Math.min(1,.72/Math.max(.001,peak));const b=Buffer.alloc(44+data.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(data.length*2,40);for(let i=0;i<data.length;i++)b.writeInt16LE(Math.round(data[i]*gain*32767),44+i*2);await writeFile(new URL(name+'.wav',dir),b);manifest.push({file:name+'.wav',...meta,sampleRate:rate,peak:peak*gain,sha256:createHash('sha256').update(b).digest('hex'),source:'Original DSP: scripts/build-audio.js + public/engine-dsp.js',license:'CC0-1.0',...meta});}
for(const p of Object.values(ENGINE_PRESETS)){
 if(p.id==='stock')await wav('stock-loop',stockSamples.mid,{...packCredit,vehicleId:p.id,baseRPM:p.baseRPM});
 else {
 const voice=new EngineVoice(p.id,rate);
 for(let i=0;i<rate/2;i++)voice.sample(p.baseRPM,.65);
 const loop=Float64Array.from({length:rate*2},()=>voice.sample(p.baseRPM,.65));
 // Overlap the tail into the head, then remove that tail so the seam is adjacent.
 const fade=1200;for(let i=0;i<fade;i++){const f=i/fade;loop[i]=loop[i]*f+loop[loop.length-fade+i]*(1-f);}await wav(p.id+'-loop',loop.subarray(0,loop.length-fade),{vehicleId:p.id,baseRPM:p.baseRPM});
 }
 const sweep=new EngineVoice(p.id,rate,p.id==='stock'?stockSamples:null),car={vehicleId:p.id,speed:0,vx:0,vz:0,yaw:0,throttle:0},top=vehicleSpec(p.id).maxSpeed;
 // Exercise the same RPM/gear telemetry as a race, including every up/downshift.
 await wav(p.id+'-comparison',Float64Array.from({length:rate*12},(_,i)=>{
  const t=i/rate;
  if(i%(rate/30)===0){car.speed=t<1?0:t<7?top*(t-1)/6:t<9?top*(1-(t-7)*.15):t<11?top*.7*(11-t)/2:0;car.vz=car.speed;car.throttle=t>=1&&t<7?1:0;audioTelemetry(car,1/30);}
  return sweep.sample(car.rpm,car.load,0,car.speed,car.shiftCut)*Math.min(1,t/.02,(12-t)/.03);
 }),{...(p.id==='stock'?packCredit:{}),vehicleId:p.id,kind:'12s: idle, full acceleration through gears, throttle lift, braking/downshifts, idle'});
}
let seed=42;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
for(const name of ['crash','shift','tire','wind','air','pop']){let low=0;await wav(name,Float64Array.from({length:rate},(_,i)=>{const t=i/rate,n=noise();low+=.08*(n-low);const env=Math.min(1,t/.004)*Math.exp(-t*(name==='crash'?8:name==='shift'?42:name==='air'?12:name==='pop'?22:0));return (name==='crash'?low*.9+Math.sin(t*2*Math.PI*70)*.3:name==='shift'?n*.2+Math.sin(t*2*Math.PI*240)*.2:name==='air'?(n-low)*.35:name==='pop'?low*.35+Math.sin(t*2*Math.PI*95)*.25:name==='tire'?Math.sin(t*2*Math.PI*1100)*.12+n*.1:low*.4)*env*Math.min(1,(1-t)/.02);}),{kind:'shared effect'});}
try{const b=await readFile(new URL('ui-confirm.ogg',dir));manifest.push({file:'ui-confirm.ogg',source:'Kenney Interface Sounds / Audio/confirmation_001.ogg',url:'https://kenney.nl/assets/interface-sounds',license:'CC0-1.0',creator:'Kenney',sha256:createHash('sha256').update(b).digest('hex')});}catch{}
await writeFile(new URL('manifest.json',dir),JSON.stringify(manifest,null,2));console.log(`Built ${manifest.length} audio assets`);
