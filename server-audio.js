import {randomBytes} from 'node:crypto';
import QRCode from 'qrcode';
import {audioTelemetry} from './public/audio-presets.js';
export function roomAudio({code,players,send,getCars,getPhase,getElapsed=()=>0}){
 const tokens=new Map(),endpoints=new Map();let seq=0,eventSeq=0,events=[];
 function revoke(id){for(const[token,pair]of tokens)if(pair.id===id)tokens.delete(token);const ws=endpoints.get(id);if(ws)send(ws,{type:'audio-revoked',message:'Your driver left or disconnected. Pair a new audio link after reconnecting.'});endpoints.delete(id);}
 function identity(id){const p=players.get(id),ordered=[...players.entries()].sort((a,b)=>(a[1].joinOrder||0)-(b[1].joinOrder||0)).map(([id])=>id),raceIndex=getPhase()!=='lobby'?getCars().filter(c=>c.human).findIndex(c=>c.id===id):-1;return p?{id,name:p.name,playerNumber:raceIndex>=0?raceIndex+1:ordered.indexOf(id)+1,vehicleId:p.vehicleId,color:p.color}:null;}
 function activate(id,ws){const old=endpoints.get(id);if(old&&old!==ws)send(old,{type:'audio-replaced'});endpoints.set(id,ws);send(ws,{type:'audio-bound',playerId:id,name:players.get(id)?.name,listener:identity(id)});}
 function emit(kind,car,intensity=1,extra={}){events.push({id:code+':'+(++eventSeq),kind,emitterId:car.id,x:car.x,y:car.y,z:car.z,intensity:Math.min(1,Math.max(.05,intensity)),radius:60,time:Date.now(),...extra});if(events.length>64)events.shift();}
 return {active:id=>endpoints.has(id),revoke,clear(){for(const id of endpoints.keys())revoke(id);tokens.clear();events=[];},close(ws){for(const[id,socket]of endpoints)if(socket===ws)endpoints.delete(id);},emit,telemetry(dt){for(const c of getCars())audioTelemetry(c,dt,emit);},
 async message(ws,msg,{playerId,display,host}){
 if(msg.type==='audio-pair'){
 const id=msg.playerId||playerId;if(!players.has(id)||(!display&&id!==playerId))return send(ws,{type:'error',message:'You can only pair audio for your own joined driver.'});
 for(const[token,pair]of tokens)if(pair.id===id)tokens.delete(token);const token=randomBytes(24).toString('hex');tokens.set(token,{id,expires:Date.now()+300000});const url=`${host}/audio?token=${token}`;send(ws,{type:'audio-pair',playerId:id,url,qr:await QRCode.toDataURL(url,{width:220,margin:1}),expires:Date.now()+300000});return true;
 }
 if(msg.type==='audio-enable'){if(!players.has(playerId))return send(ws,{type:'error',message:'Join a driver or use a personal audio pairing link.'});activate(playerId,ws);return true;}
 if(msg.type==='audio-bind'){
 const pair=tokens.get(msg.token);if(!pair||pair.expires<Date.now()||!players.has(pair.id))return send(ws,{type:'error',message:'Audio link expired. Generate a new one from your driver’s lobby.'});
 if(endpoints.has(pair.id)&&endpoints.get(pair.id)!==ws&&!msg.replace)return send(ws,{type:'error',message:'Audio is active on another device. Tap Enable & replace to move it here.'});activate(pair.id,ws);return true;
 }return false;
 },tick(){seq++;const time=Date.now();for(const[token,pair]of tokens)if(pair.expires<time)tokens.delete(token);for(const[id,ws]of endpoints){const listener=getCars().find(c=>c.id===id);const cars=listener?getCars().filter(c=>c.id===id||Math.hypot(c.x-listener.x,c.y-listener.y,c.z-listener.z)<60):[];send(ws,{type:'audio-frame',version:1,seq,time,phase:getPhase(),elapsed:getElapsed(),listenerId:id,listenerName:players.get(id)?.name,listener:identity(id),emitters:cars.map(c=>({id:c.id,vehicleId:c.vehicleId,x:c.x,y:c.y,z:c.z,yaw:c.yaw,vx:c.vx,vz:c.vz,speed:c.speed,rpm:c.rpm,gear:c.gear,load:c.load,slip:c.slip,shiftCut:c.shiftCut,engineOn:c.engineOn})),events:listener?events.filter(e=>time-e.time<1200&&Math.hypot(e.x-listener.x,e.y-listener.y,e.z-listener.z)<e.radius):[]});}events=[];}
 };
}
