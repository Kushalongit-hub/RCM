import {vehicleSpec} from './public/vehicle-catalog.js';
import {getTrack} from './public/track.js';
export const COLORS=['#ff7448','#64d9eb','#c5ef75','#bc9cff','#ffd36e','#fc89c8','#fff3da','#7c9cfc'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
export function newCar(id,name,index,bot=false,vehicleId='formula',race={}) {
  const track=getTrack(race.trackId),{pointAt,TRACK_LENGTH}=track;
  const p=pointAt(TRACK_LENGTH-12-Math.floor(index/2)*7,index%2 ? 3 : -3);
  return {id,name,trackId:track.id,lapTarget:race.laps??3,raceMode:race.mode||'circuit',paintId:race.paintId??0,driftScore:0,combo:1,cleanDrift:0,bestLap:null,lastLap:null,lapStart:null,vehicleId:vehicleSpec(vehicleId).id,color:COLORS[index%8],bot,human:!bot,x:p.x,y:p.y,z:p.z,yaw:p.yaw,vx:0,vz:0,vy:0,grounded:true,speed:0,steering:0,
    progress:0,distance:0,lastS:p.s,nextCheckpoint:0,lap:1,finished:false,finishTime:null,
    boost:100,drifting:false,driftSide:0,
    resetHeld:false,offroad:false,wrongWay:false,stuck:0,input:{}};
}
export function rescue(car) {
  const {pointAt}=getTrack(car.trackId);
  const p=pointAt(car.lastS);
  Object.assign(car,{x:p.x,y:p.y,z:p.z,yaw:p.yaw,vx:0,vz:0,vy:0,grounded:true,speed:0,drifting:false,stuck:0});
}
function botInput(car,elapsed) {
  const {nearest,pointAt}=getTrack(car.trackId),spec=vehicleSpec(car.vehicleId),near=nearest(car.x,car.z),target=pointAt(near.s+8+car.speed*.36);
  const err=angle(Math.atan2(target.x-car.x,target.z-car.z)-car.yaw);
  const curvature=Math.max(...[0,12,30,55].map(d=>Math.abs(pointAt(near.s+d).curvature)));
  const desired=clamp(Math.sqrt(12/(curvature+.001)),10,spec.maxSpeed+4);
  return {throttle:car.speed<desired+.6,steer:clamp(err*2.0,-1,1),brake:car.speed>desired+2.2||Math.abs(err)>1.0&&car.speed>12,boost:curvature<.0018&&Math.abs(err)<.08&&car.boost>55&&car.speed<desired};
}
export function step(car,dt,elapsed,emit=()=>{}) {
  if(car.finished)return;
  const spec=vehicleSpec(car.vehicleId),track=getTrack(car.trackId),{nearest,pointAt,ROAD_WIDTH,TRACK_LENGTH}=track,gateCount=track.gateCount;
  const input=car.bot?botInput(car,elapsed):car.input;
  if(input.reset&&!car.resetHeld)rescue(car);
  car.resetHeld=!!input.reset;car.throttle=Number(!!input.throttle);car.braking=!!input.brake;
  const near=nearest(car.x,car.z);
  car.offroad=near.distance>ROAD_WIDTH/2+.5;
  car.steering+=(clamp(input.steer||0,-1,1)-car.steering)*Math.min(1,dt*9);
  const velocity=Math.hypot(car.vx,car.vz);
  const wasDrifting=car.drifting;
  car.drifting=!!input.drift&&velocity>12&&!car.offroad&&car.grounded&&(wasDrifting||Math.abs(car.steering)>.08);
  if(car.drifting&&!wasDrifting)car.driftSide=car.steering>=0?1:-1;
  const manualBoost=!!input.boost&&car.boost>1&&!!input.throttle&&!input.brake;
  car.boost=clamp(car.boost+(manualBoost?-30:input.brake?12:4)*dt,0,100);
  car.boosting=manualBoost;
  {
    const forward=car.vx*Math.sin(car.yaw)+car.vz*Math.cos(car.yaw);
    const steer=car.drifting?car.steering*.9+car.driftSide*.25:car.steering;
    car.yaw+=steer*(car.drifting?spec.steer*1.18:spec.steer)*clamp(Math.abs(forward)/12,0,1)*(forward<0?-1:1)*dt;
    const fx=Math.sin(car.yaw),fz=Math.cos(car.yaw),rx=fz,rz=-fx;
    let longitudinal=car.vx*fx+car.vz*fz, lateral=car.vx*rx+car.vz*rz;
    const slip=clamp(car.drafting||0,0,1),max=car.offroad?17:(car.boosting?spec.maxSpeed+19:spec.maxSpeed)/Math.sqrt(1-slip*.18);
    const grade=(pointAt(near.s+2).y-pointAt(near.s-2).y)/4;
    if(Math.abs(longitudinal)>.2||input.throttle)longitudinal-=9.81*grade*Math.cos(car.yaw-near.yaw)*dt;
    if(velocity>.5)lateral-=Math.sin(near.bank)*9.81*dt;
    if(input.brake)longitudinal=longitudinal>.1?Math.max(0,longitudinal-58*Math.pow(1200/spec.mass,.15)*dt):Math.max(-11,longitudinal-16*dt);
    else if(input.throttle)longitudinal+=spec.acceleration*dt;
    longitudinal*=Math.exp(-dt*(input.throttle?.17:.8));
    if(longitudinal>max)longitudinal+=(max-longitudinal)*Math.min(1,dt*3);
    longitudinal=Math.max(-11,longitudinal);
    lateral*=Math.exp(-dt*(car.grounded?(car.drifting?spec.driftGrip:spec.grip*(1+(spec.aero||0)*(velocity/50)**2)):.35));
    car.vx=fx*longitudinal+rx*lateral;car.vz=fz*longitudinal+rz*lateral;
  }
  car.x+=car.vx*dt;car.z+=car.vz*dt;
  let updated=nearest(car.x,car.z);
  // Solid rails stop shortcuts; the verge between asphalt and rail remains driveable.
  if(updated.distance>ROAD_WIDTH/2+(track.wall??6)) {
    const sign=Math.sign(updated.offset)||1,bound=ROAD_WIDTH/2+(track.wall??6)-.2;
    car.x=updated.x+Math.cos(updated.yaw)*bound*sign;car.z=updated.z-Math.sin(updated.yaw)*bound*sign;
    const outward=car.vx*Math.cos(updated.yaw)*sign-car.vz*Math.sin(updated.yaw)*sign;
    if(outward>2&&elapsed-(car.lastImpact??-10)>.18){emit('collision',car,outward/24);car.lastImpact=elapsed;}
    if(outward>0){car.vx-=Math.cos(updated.yaw)*sign*outward*1.35;car.vz+=Math.sin(updated.yaw)*sign*outward*1.35;}
    car.vx*=.75;car.vz*=.75;car.combo=1;car.cleanDrift=0;updated=nearest(car.x,car.z);
  }
  const floor=updated.y+Math.tan(updated.bank)*updated.offset;
  if(car.grounded&&car.y-floor>.55){car.grounded=false;car.vy=7;}
  if(car.grounded)car.y=floor;
  else {car.vy-=22*dt;car.y+=car.vy*dt;if(car.y<=floor){if(car.vy<-5)emit('landing',car,Math.abs(car.vy)/25);car.y=floor;car.vy=0;car.grounded=true;}}
  car.speed=Math.hypot(car.vx,car.vz);
  car.wrongWay=Math.cos(angle(car.yaw-updated.yaw))<-.35&&car.speed>3;
  car.stuck=car.speed<3?car.stuck+dt:0;
  if(car.bot&&car.stuck>3)rescue(car);
  let delta=updated.s-car.lastS;
  if(delta>TRACK_LENGTH/2)delta-=TRACK_LENGTH;
  if(delta<-TRACK_LENGTH/2)delta+=TRACK_LENGTH;
  if(Math.abs(delta)<Math.max(12,car.speed*dt*3)&&updated.distance<ROAD_WIDTH/2+(track.wall??6)) {
    const previousS=car.lastS;
    car.distance+=delta;car.lastS=updated.s;
    // Ordered track-specific gates per lap. Reversing across the line cannot earn a lap.
    const target=(car.nextCheckpoint%gateCount)*TRACK_LENGTH/gateCount;
    const distanceToGate=(target-previousS+TRACK_LENGTH)%TRACK_LENGTH;
    if(delta>0&&distanceToGate<=delta+.001) {
      car.nextCheckpoint++;if(car.nextCheckpoint%gateCount===1)emit('lap',car,.4);
      if(car.nextCheckpoint%gateCount===1){if(car.lapStart!==null){car.lastLap=elapsed-car.lapStart;if(car.lastLap>1)car.bestLap=Math.min(car.bestLap??Infinity,car.lastLap);}car.lapStart=elapsed;}
      if(car.raceMode!=='drift'&&car.nextCheckpoint>gateCount*car.lapTarget) {car.finished=true;emit('finish',car,.7);car.finishTime=elapsed;car.speed=0;car.vx=0;car.vz=0;}
    }
    car.lap=Math.min(car.lapTarget,Math.max(1,Math.floor(Math.max(0,car.nextCheckpoint-1)/gateCount)+1));
    const nextGate=(car.nextCheckpoint%gateCount)*TRACK_LENGTH/gateCount;
    car.progress=car.nextCheckpoint*TRACK_LENGTH/gateCount-((nextGate-updated.s+TRACK_LENGTH)%TRACK_LENGTH);
  }
  if(car.raceMode==='drift'){
    const heading=Math.atan2(car.vx,car.vz),slipAngle=Math.abs(angle(heading-car.yaw));
    if(car.drifting&&!car.offroad&&car.speed>10&&slipAngle>.10&&slipAngle<1.12){car.cleanDrift+=dt;car.combo=Math.min(5,1+car.cleanDrift/4);car.driftScore+=car.speed*slipAngle*car.combo*dt*10;}
    else {car.cleanDrift=0;car.combo=1;}
  }
}
export function stepWorld(cars,dt,elapsed,emit=()=>{}){
  for(const car of cars){car.drafting=0;for(const other of cars){if(car===other||other.finished)continue;const dx=other.x-car.x,dz=other.z-car.z,along=dx*Math.sin(car.yaw)+dz*Math.cos(car.yaw),side=Math.abs(dx*Math.cos(car.yaw)-dz*Math.sin(car.yaw));if(along>5&&along<35&&side<2.2&&Math.cos(car.yaw-other.yaw)>.95)car.drafting=Math.max(car.drafting,(1-(along-5)/30)*(1-side/2.2));}}
  cars.forEach(car=>step(car,dt,elapsed,emit));
  if(cars[0]?.raceMode==='time_trial')return;
  // Four cars: oriented box SAT colliders, independent of the body mesh.
  for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
    const a=cars[i],b=cars[j];if(a.finished||b.finished||Math.abs(a.y-b.y)>2)continue;
    const sa=vehicleSpec(a.vehicleId),sb=vehicleSpec(b.vehicleId);
    const axes=c=>[{x:Math.cos(c.yaw),z:-Math.sin(c.yaw)},{x:Math.sin(c.yaw),z:Math.cos(c.yaw)}];
    const aa=axes(a),bb=axes(b),dx=b.x-a.x,dz=b.z-a.z;let overlap=Infinity,normal=null;
    for(const axis of [...aa,...bb]){
      const dot=v=>Math.abs(axis.x*v.x+axis.z*v.z);
      const radius=dot(aa[0])*sa.width*.43+dot(aa[1])*sa.length*.44+dot(bb[0])*sb.width*.43+dot(bb[1])*sb.length*.44;
      const gap=radius-Math.abs(dx*axis.x+dz*axis.z);
      if(gap<=0){normal=null;break;}
      if(gap<overlap){overlap=gap;const sign=dx*axis.x+dz*axis.z>=0?1:-1;normal={x:axis.x*sign,z:axis.z*sign};}
    }
    if(!normal)continue;a.combo=b.combo=1;a.cleanDrift=b.cleanDrift=0;
    const {x:nx,z:nz}=normal,shareA=sb.mass/(sa.mass+sb.mass),shareB=1-shareA;
    a.x-=nx*overlap*shareA;a.z-=nz*overlap*shareA;b.x+=nx*overlap*shareB;b.z+=nz*overlap*shareB;
    const impact=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
    if(impact>2&&elapsed-(a.lastImpact??-10)>.18){emit('collision',a,impact/24,{involvedIds:[a.id,b.id]});a.lastImpact=b.lastImpact=elapsed;}
    if(impact>0){a.vx-=nx*impact*1.25*shareA;a.vz-=nz*impact*1.25*shareA;b.vx+=nx*impact*1.25*shareB;b.vz+=nz*impact*1.25*shareB;}
  }
}
