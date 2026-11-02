import {vehicleSpec} from './vehicle-catalog.js';
// Original stylized configurations. Gearbox telemetry is audio-only and never changes handling.
const make=(id,cylinders,idle,redline,gears,shift,harmonics,resonance,rough,turbo=0,hybrid=0,whine=0)=>({id,cylinders,idle,redline,gears,shift,harmonics,resonance,rough,turbo,hybrid,whine,baseRPM:6000});
export const ENGINE_PRESETS={
 formula:make('formula',6,3200,15000,8,.055,[.28,.58,.42,.25,.19,.12],1900,.08,.25,.38,.18),
 endurance:make('endurance',8,1600,9500,7,.085,[.55,.30,.48,.12,.22,.08],1100,.16,.34,0,.24),
 drift:make('drift',4,1100,8200,6,.15,[.75,.24,.52,.34,.18,.15],670,.58,.42,0,.10),
 gt3:make('gt3',6,1500,8500,6,.095,[.42,.62,.18,.35,.13,.12],1350,.14,0,0,.42),
 stock:make('stock',8,900,9000,5,.22,[1,.38,.35,.18,.14,.10],310,.42),
 wedge:make('wedge',12,1100,8000,5,.32,[.68,.17,.33,.10,.14,.06],960,.10),
 hyper:make('hyper',8,1200,9200,7,.045,[.52,.45,.12,.37,.08,.18],1600,.23,.55,.18,.12),
 tourer:make('tourer',8,750,7000,8,.18,[1,.22,.16,.08,.06,.03],260,.12)
};
export function enginePreset(id){return ENGINE_PRESETS[id]||ENGINE_PRESETS.formula;}
export function audioTelemetry(car,dt,emit=()=>{}){
 const p=enginePreset(car.vehicleId),speed=Math.abs(car.speed),throttle=car.finished?0:Number(car.throttle||0),top=vehicleSpec(p.id).maxSpeed;
 const forward=car.vx*Math.sin(car.yaw)+car.vz*Math.cos(car.yaw);let gear=forward<-.8?-1:speed<.5?0:Math.min(p.gears,1+Math.floor(speed/(top/p.gears)));
 const previous=car.gear??gear;if(gear!==previous){car.shiftUntil=(car.audioClock||0)+p.shift;emit('shift',car,.3,{from:previous,to:gear});}
 car.audioClock=(car.audioClock||0)+dt;car.gear=gear;car.shiftCut=car.audioClock<(car.shiftUntil||0);
 if((car.previousThrottle||0)>.5&&throttle<.1&&speed>10&&car.audioClock-(car.lastLiftCue??-10)>.2){if(p.turbo)emit('blowoff',car,.28);if(p.id==='drift')emit('crackle',car,.22);car.lastLiftCue=car.audioClock;}car.previousThrottle=throttle;
 const ratio=top/p.gears,fraction=Math.max(0,Math.min(1,speed/ratio-(Math.max(1,gear)-1))),rolling=p.idle+(p.redline-p.idle)*(gear===1?fraction*.98:.50+.48*fraction),free=p.idle+throttle*(p.redline-p.idle)*.92;
 const target=gear===0?free:rolling;car.rpm=(car.rpm??p.idle)+(target-(car.rpm??p.idle))*Math.min(1,dt*(p.id==='tourer'?7:16));car.load=throttle*(car.boosting?1:.8);car.engineOn=!car.finished;
 car.slip=Math.min(1,Math.abs(Math.atan2(Math.sin(Math.atan2(car.vx,car.vz)-car.yaw),Math.cos(Math.atan2(car.vx,car.vz)-car.yaw)))*speed/18);
}
