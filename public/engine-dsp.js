import {enginePreset} from './audio-presets.js';
const TAU=2*Math.PI;
// Shared deterministic DSP for the worklet and reproducible offline WAV rendering.
export class EngineVoice{
 constructor(id,rate=48000,samples=null){this.p=enginePreset(id);this.rate=rate;this.samples=id==='stock'?samples:null;this.samplePositions=[0,0];this.cycle=0;this.exhaust=0;this.exhaust2=0;this.dc=0;this.t=0;this.rpm=this.p.idle;this.load=0;this.seed=127;this.noise=0;this.boost=0;this.phases=[0,0,0,0];this.smoothSlip=0;this.cut=1;this.engineGain=1;
 this.pulse=0;this.pulseMean=0;this.firingPosition=0;this.jitter=0;this.ring1=0;this.ring2=0;
 this.pulseDecay=Math.exp(-1/(rate*(.0013+this.p.rough*.002)));
 const damping=Math.exp(-1/(rate*.009));
 this.ringA=2*damping*Math.cos(TAU*(160+this.p.resonance*.22)/rate);this.ringB=damping*damping;this.ringGain=1-damping;
 this.dcPole=1-Math.exp(-TAU*18/rate);this.meanPole=1-Math.exp(-TAU*35/rate);
 this.slew=1-Math.exp(-1/(rate*.014));this.loadSlew=1-Math.exp(-1/(rate*.025));
 }
 sample(rpm,load=0,slip=0,speed=0,cut=false,engineGain=1){const p=this.p;this.smoothSlip+=(slip-this.smoothSlip)*this.loadSlew;slip=this.smoothSlip;this.cut+=((cut?.22:1)-this.cut)*this.slew;this.engineGain+=(engineGain-this.engineGain)*this.loadSlew;this.rpm+=(rpm-this.rpm)*this.slew;this.load+=(load-this.load)*this.loadSlew;this.boost+=(this.load-this.boost)*(this.loadSlew*.13);this.t+=1/this.rate;
 this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;const n=this.seed/2147483648-1;this.noise+=.10*(n-this.noise);
 // A continuous 720-degree cycle keeps the crank/bank undertones phase coherent.
 this.cycle=(this.cycle+this.rpm*(1+this.jitter)/120/this.rate)%1;
 const firingPosition=(this.cycle*p.cylinders)%1;
 if(firingPosition<this.firingPosition){
  // Each ignition has slightly different pressure/timing; idle is less even.
  this.pulse+=.8+n*(.08+p.rough*.12)+p.rough*.12*Math.sin(TAU*this.cycle);
  this.jitter=n*(.0015+p.rough*.008)*(1-.7*this.load);
 }
 this.firingPosition=firingPosition;this.pulse*=this.pulseDecay;
 this.pulseMean+=(this.pulse-this.pulseMean)*this.meanPole;
 const pressure=this.pulse-this.pulseMean;
 const ring=this.ringA*this.ring1-this.ringB*this.ring2+pressure*this.ringGain;
 this.ring2=this.ring1;this.ring1=ring;
 const crank=TAU*this.cycle*2, firing=TAU*this.cycle*p.cylinders;
 let v=0;for(let h=1;h<=p.harmonics.length;h++)if(this.rpm/120*p.cylinders*h<this.rate*.45)v+=p.harmonics[h-1]*Math.sin(firing*h+p.rough*Math.sin(crank));
 this.phases[0]=(this.phases[0]+p.resonance*(.9+.2*this.rpm/p.redline)/this.rate)%1;this.phases[1]=(this.phases[1]+(1900+this.boost*1700)/this.rate)%1;this.phases[2]=(this.phases[2]+(1200+this.rpm*.23)/this.rate)%1;this.phases[3]=(this.phases[3]+(220+speed*32)/this.rate)%1;
 const resonance=Math.sin(TAU*this.phases[0]);
 const body=Math.sin(crank)+.45*Math.sin(crank*2+.3)+p.rough*.35*Math.sin(TAU*this.cycle);
 // Load opens the exhaust: rounded low-frequency combustion at idle/lift,
 // richer harmonics under power. Saturation adds body before two-pole muffling.
 const intake=(n-this.noise)*this.pulse*(.025+.10*this.load);
 const combustion=pressure*(1.1+1.3*this.load)+ring*.32+v*(.06+.15*this.load)+body*(.10+.10*this.load)+intake;
 const cutoff=Math.min(this.rate*.2,380+p.resonance*.35+this.load*(500+p.resonance*.35));
 const pole=1-Math.exp(-TAU*cutoff/this.rate);
 this.exhaust+=(Math.tanh(combustion*(1.2+this.load)) -this.exhaust)*pole;
 this.exhaust2+=(this.exhaust-this.exhaust2)*pole;
 this.dc+=(this.exhaust2-this.dc)*this.dcPole;
 v=(this.exhaust2-this.dc)*.85+resonance*this.noise*.04;
 v+=p.turbo*this.boost*.055*(Math.sin(TAU*this.phases[1])*.65+this.noise*.35);v+=p.hybrid*.035*Math.sin(TAU*this.phases[2]);v+=p.whine*.035*Math.sin(TAU*this.phases[3]);
 if(p.id==='stock')v+=.12*Math.sin(crank)*(1+.3*Math.sin(TAU*this.cycle));
 if(p.id==='drift'&&this.rpm>p.redline*.94)v*=Math.sin(TAU*this.t*18)>0?.25:1;
 if(this.samples){
  const blend=Math.max(0,Math.min(1,(this.rpm-p.idle)/(p.redline-p.idle)/.4));v=0;
  for(let layer=0;layer<2;layer++){
   const data=layer?this.samples.mid:this.samples.idle,pos=this.samplePositions[layer],index=Math.floor(pos),fraction=pos-index;
   const value=data[index]*(1-fraction)+data[(index+1)%data.length]*fraction;
   v+=value*(layer?Math.sqrt(blend):Math.sqrt(1-blend));
   this.samplePositions[layer]=(pos+this.rpm/(layer?8000:p.idle)*this.samples.rate/this.rate)%data.length;
  }
  v*=.6+.45*this.load;
 }
 v*=this.cut*this.engineGain;v+=slip*.16*(Math.sin(TAU*this.t*1100)*.55+this.noise*.45);v+=this.noise*Math.min(1,speed/75)*.08;
 return Math.tanh(v*.95)*.42;
 }
}
