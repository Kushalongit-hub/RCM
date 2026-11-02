import {EngineVoice} from './engine-dsp.js';
class RacingMixer extends AudioWorkletProcessor{
 constructor(){super();this.voices=new Map();this.targets=[];this.frames=0;this.master=.5;this.port.onmessage=({data})=>{if(data.samples){this.samples=data.samples;this.voices.clear();return;}const next=data.voices||[];const ids=new Set(next.map(t=>t.id));this.targets=[...next,...this.targets.filter(t=>!ids.has(t.id)&&this.voices.get(t.id)?.gain>.0001).map(t=>({...t,gain:0}))].slice(0,8);this.frames=0;this.master=data.master??.5;};}
 process(inputs,outputs){const out=outputs[0];if(!out?.[0])return true;const left=out[0],right=out[1]||left;const alive=new Set(this.targets.map(t=>t.id));for(const[id,v]of this.voices)if(!alive.has(id)&&v.gain<.0001)this.voices.delete(id);
 for(let i=0;i<left.length;i++){let l=0,r=0;for(const target of this.targets){let v=this.voices.get(target.id);if(!v||v.voice.p.id!==target.vehicleId){v={voice:new EngineVoice(target.vehicleId,sampleRate,this.samples),gain:0,pan:0};this.voices.set(target.id,v);}const fresh=this.frames<sampleRate*.6;v.gain+=((fresh?target.gain:0)-v.gain)*.002;v.pan+=((target.pan||0)-v.pan)*.0015;const s=v.voice.sample(target.rpm*target.doppler,target.load,target.slip,target.speed,target.cut,target.engineGain??1)*v.gain; l+=s*Math.sqrt((1-v.pan)*.5);r+=s*Math.sqrt((1+v.pan)*.5);}
 left[i]=Math.tanh(l)*this.master;if(right!==left)right[i]=Math.tanh(r)*this.master;this.frames++;}return true;
 }
}
registerProcessor('racing-mixer',RacingMixer);
