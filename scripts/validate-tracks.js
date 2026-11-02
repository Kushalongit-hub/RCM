import {writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {TRACKS,getTrack} from '../public/track.js';
import {VEHICLES} from '../public/vehicle-catalog.js';
import {newCar,step,rescue} from '../game.js';
const start=performance.now(),cases=[],geometry=[];
for(const info of TRACKS){const t=getTrack(info.id);let closest=Infinity,maxGrade=0;
 for(let i=0;i<t.samples.length-1;i++){const p=t.samples[i],q=t.samples[i+1];maxGrade=Math.max(maxGrade,Math.abs(q.y-p.y)/Math.hypot(q.x-p.x,q.z-p.z));if(i%4)continue;for(let j=i+4;j<t.samples.length-1;j+=4){const along=Math.min(t.samples[j].s-p.s,t.TRACK_LENGTH-(t.samples[j].s-p.s));if(along<t.ROAD_WIDTH*3)continue;closest=Math.min(closest,Math.hypot(p.x-t.samples[j].x,p.z-t.samples[j].z));}}
 geometry.push({id:t.id,length:t.lengthMeters,width:t.ROAD_WIDTH,maxGrade:+maxGrade.toFixed(3),nonlocalClearance:+closest.toFixed(1),gates:t.gateCount});
 for(const spec of VEHICLES){const car=newCar('test','Test',0,true,spec.id,{trackId:t.id,laps:1});const limit=Math.max(150,t.TRACK_LENGTH/12+45);let steps=0;for(;steps<limit*60&&!car.finished;steps++)step(car,1/60,steps/60);const s=car.lastS;rescue(car);cases.push({trackId:t.id,vehicleId:spec.id,finished:car.finished,seconds:+(steps/60).toFixed(2),gates:car.nextCheckpoint,rescueValid:Math.abs(t.nearest(car.x,car.z).s-s)<4});}
}
await mkdir(new URL('../docs/',import.meta.url),{recursive:true});const report={wallSeconds:+((performance.now()-start)/1000).toFixed(2),tracks:TRACKS.length,newTracks:TRACKS.filter(t=>!t.legacy).length,pairings:cases.length,newPairings:cases.filter(c=>c.trackId!=='coastal').length,geometry,cases};await writeFile(new URL('../docs/track-validation.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({wallSeconds:report.wallSeconds,newTracks:report.newTracks,newPairings:report.newPairings,finished:cases.filter(c=>c.finished).length,failed:cases.filter(c=>!c.finished),close:geometry.filter(g=>g.nonlocalClearance<g.width+3)},null,2));if(cases.some(c=>!c.finished||!c.rescueValid)||geometry.some(g=>g.nonlocalClearance<g.width+3))process.exitCode=1;
