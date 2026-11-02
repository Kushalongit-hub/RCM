import {TRACKS,getTrack} from './public/track.js';
import {PAINTS,paintInfo,MODES,defaultSettings} from './public/race-rules.js';
import {VEHICLES} from './public/vehicle-catalog.js';
import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import QRCode from 'qrcode';
import {roomAudio} from './server-audio.js';
import { newCar, stepWorld } from './game.js';
import { localTLS } from './tls.js';

export function createGameServer({ port = 3000, tlsPort = null, countdownMs = 3000 } = {}) {
  const hostKey = randomBytes(24).toString('hex');
  const code = randomBytes(3).toString('hex').toUpperCase();
  const players = new Map(),sessions=new Map();
  let hostPlayerId=null,joinOrder=0,settings=defaultSettings();
  let cars = [], phase = 'lobby', started = 0, firstFinish = null, endedAt = 0;
  const addresses = Object.entries(networkInterfaces()).flatMap(([name, entries]) => entries.filter(n => n.family === 'IPv4' && !n.internal).map(n => ({ name, address: n.address }))).sort((a, b) => {
    const score = n => (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address) ? 10 : 0) + (/wi-?fi|wireless|ethernet/i.test(n.name) ? 5 : 0) - (/virtual|vethernet|vpn|tailscale|docker|wsl/i.test(n.name) ? 20 : 0);
    return score(b) - score(a);
  }).map(n => n.address);
  let secureServer = null, tlsConfig = null;
  const files = { '/': ['index.html', 'text/html'], '/controller': ['controller.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/controller.js': ['controller.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
  Object.assign(files, { '/controls.js': ['controls.js', 'text/javascript'], '/setup': ['setup.html', 'text/html'], '/track.js': ['track.js', 'text/javascript'], '/race3d.js': ['race3d.js', 'text/javascript'], '/race.css': ['race.css', 'text/css'], '/three.module.js': ['../node_modules/three/build/three.module.js', 'text/javascript'], '/three.core.js': ['../node_modules/three/build/three.core.js', 'text/javascript'] });
  files['/gp.css']=['gp.css','text/css'];
  files['/landscape.css']=['landscape.css','text/css'];
  for(const file of ['vehicle-catalog.js','vehicle-meshes.js','vehicle-preview.js','garage.js','track-catalog.js','race-rules.js','lobby-ui.js','gamepads.js','track-gallery.js'])files['/'+file]=[file,'text/javascript'];
  files['/vehicles/manifest.json']=['vehicles/manifest.json','application/json'];
  files['/lobby.css']=['lobby.css','text/css'];
  files['/tracks']=['tracks.html','text/html'];
  for(const file of ['phone-audio.js','audio-presets.js','audio-spatial.js','engine-dsp.js','engine-worklet.js','audio-page.js','audio-lab.js'])files['/'+file]=[file,'text/javascript'];
  files['/audio']=['audio.html','text/html'];files['/audio-lab']=['audio-lab.html','text/html'];
  for(const id of VEHICLES.map(v=>v.id))for(const suffix of ['loop','comparison'])files['/audio/'+id+'-'+suffix+'.wav']=['audio/'+id+'-'+suffix+'.wav','audio/wav'];
  for(const name of ['crash','shift','tire','wind','air','pop'])files['/audio/'+name+'.wav']=['audio/'+name+'.wav','audio/wav'];
  files['/audio/vehicle-sfx-LICENSE.txt']=['audio/vehicle-sfx-LICENSE.txt','text/plain'];
  files['/audio/stock-idle.wav']=['audio/stock-idle.wav','audio/wav'];
  files['/audio/ui-confirm.ogg']=['audio/ui-confirm.ogg','audio/ogg'];files['/audio/manifest.json']=['audio/manifest.json','application/json'];
  for(const t of TRACKS)files['/tracks/'+t.id+'.svg']=['tracks/'+t.id+'.svg','image/svg+xml'];
  files['/garage']=['garage.html','text/html'];
  files['/three/addons/utils/BufferGeometryUtils.js']=['../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js','text/javascript'];
  for(const id of ['formula','endurance','drift','gt3','stock','wedge','hyper','tourer']){
    files['/references/'+id+'.png']=['references/'+id+'.png','image/png'];
    files['/vehicles/'+id+'.glb']=['vehicles/'+id+'.glb','model/gltf-binary'];
  }
  const handleRequest = async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/host') {
        const hostname = new URL(`http://${req.headers.host}`).hostname;
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
        const ownOrigin = `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`;
        if (!local || !['localhost', '127.0.0.1', '[::1]'].includes(hostname) || (req.headers.origin && req.headers.origin !== ownOrigin)) { res.writeHead(403); res.end('Host access is only available on the game computer at localhost.'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });res.end(JSON.stringify({key:hostKey}));return;
      }
      if (url.pathname === '/api/connection') {
        const actualPort = server.address().port;
        const address = process.env.LAN_HOST || addresses[0] || '127.0.0.1';
        const securePort = secureServer?.address()?.port;
        const joinUrl = `${securePort ? 'https' : 'http'}://${address}:${securePort || actualPort}/controller?room=${code}`;
        const setupUrl = `http://${address}:${actualPort}/setup`;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ code, joinUrl, setupUrl, secure:!!securePort, fingerprint:tlsConfig?.fingerprint, addresses, qr: await QRCode.toDataURL(joinUrl, { margin: 1, width: 256, color: { dark: '#14201eff', light: '#ffffffff' } }), setupQr: await QRCode.toDataURL(setupUrl,{margin:1,width:200}) })); return;
      }
      if(url.pathname==='/room-rally-ca.crt'&&tlsConfig){res.writeHead(200,{'Content-Type':'application/x-x509-ca-cert','Content-Disposition':'attachment; filename="room-rally-ca.crt"'});res.end(tlsConfig.ca);return;}
      const file = files[url.pathname];
      if (!file) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
      res.end(await readFile(new URL(`./public/${file[0]}`, import.meta.url)));
    } catch { res.writeHead(500); res.end('Unable to load the game'); }
  };
  const server = http.createServer(handleRequest);
  const wss = new WebSocketServer({ noServer:true, maxPayload: 2048 });
  const upgrade=(req,socket,head)=>wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  server.on('upgrade',upgrade);
  const send = (ws,data)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
  const personalAudio=roomAudio({code,players,send,getCars:()=>cars,getPhase:()=>phase,getElapsed:()=>(Date.now()-started)/1000});
  const elapsedNow=()=>phase==='lobby'?0:phase==='results'?endedAt:(Date.now()-started)/1000;
  const raceLimit=()=>settings.mode==='drift'?120:Math.max(240,getTrack(settings.trackId).TRACK_LENGTH*settings.laps/14+60);
  const state=()=>({type:'state',phase,code,hostPlayerId,settings:{...settings},elapsed:elapsedNow(),remaining:settings.mode==='drift'?Math.max(0,120-elapsedNow()):firstFinish===null?null:Math.max(0,40-(elapsedNow()-firstFinish)),limit:raceLimit(),players:[...players.values()].sort((a,b)=>a.joinOrder-b.joinOrder).map(({id,name,color,vehicleId,paintId,ready,joinOrder,source})=>({id,name,color,vehicleId,paintId,ready,joinOrder,source,audioEnabled:personalAudio.active(id),isHost:id===hostPlayerId})),cars:cars.map(({input,...car})=>car)});
  const error=(ws,message)=>send(ws,{type:'error',message});
  function emptyRoom(){if(players.size)return;personalAudio.clear();hostPlayerId=null;settings=defaultSettings();phase='lobby';cars=[];firstFinish=null;endedAt=0;}
  function detach(id,explicit=false){const person=players.get(id);if(!person)return;players.delete(id);personalAudio.revoke(id);person.disconnectedAt=Date.now();person.ready=false;if(explicit)sessions.delete(person.token);const car=cars.find(c=>c.id===id);if(car){car.bot=true;car.input={};}if(hostPlayerId===id)hostPlayerId=[...players.values()].sort((a,b)=>a.joinOrder-b.joinOrder)[0]?.id||null;emptyRoom();}
  wss.on('connection',(ws,request)=>{
    let playerId=null,display=false;send(ws,state());
    ws.on('message',async raw=>{try{
      const msg=JSON.parse(raw);
      if(msg.type?.startsWith('audio-')){const address=process.env.LAN_HOST||addresses[0]||'127.0.0.1',securePort=secureServer?.address()?.port;await personalAudio.message(ws,msg,{playerId,display,host:`${securePort?'https':'http'}://${address}:${securePort||server.address().port}`});return;}
      if(msg.type==='host'){if(msg.key!==hostKey)return error(ws,'Open the display on the game computer at localhost.');display=true;send(ws,{type:'host-ok',display:true});return;}
      if(msg.type==='join'||msg.type==='resume'){
        if(playerId)return;
        const returning=typeof msg.resumeToken==='string'?sessions.get(msg.resumeToken):null;
        if(msg.type==='resume'&&!returning)return error(ws,'Session expired. Join the current room again.');
        if(players.size>=4)return error(ws,'Room full (four players maximum).');
        if(returning){
          if(players.has(returning.id))return error(ws,'This driver is already connected.');
          if(phase!=='lobby'&&!cars.some(c=>c.id===returning.id))return error(ws,'Join the next race from the lobby.');
          playerId=returning.id;returning.ready=false;players.set(playerId,returning);const car=cars.find(c=>c.id===playerId);if(car){car.bot=false;car.input={};car.lastInput=Date.now();}
        }else{
          if(msg.code!==code)return error(ws,'Room code does not match. Scan the QR again.');
          if(phase!=='lobby')return error(ws,'Race in progress. Join the next race from the lobby.');
          const name=typeof msg.name==='string'?msg.name.trim().slice(0,18):'';if(!name)return error(ws,'Enter a driver name.');
          const vehicleId=VEHICLES.some(v=>v.id===msg.vehicleId)?msg.vehicleId:'formula',paint=paintInfo(msg.paintId);
          playerId=randomUUID();const person={id:playerId,name,vehicleId,paintId:paint.id,color:paint.hex,ready:false,joinOrder:++joinOrder,source:['phone','keyboard','gamepad'].includes(msg.source)?msg.source:'phone',token:randomBytes(24).toString('hex')};players.set(playerId,person);sessions.set(person.token,person);
        }
        if(!hostPlayerId)hostPlayerId=playerId;const p=players.get(playerId);send(ws,{type:'joined',id:playerId,color:p.color,vehicleId:p.vehicleId,paintId:p.paintId,name:p.name,resumeToken:p.token});return;
      }
      if(msg.type==='leave'){if(playerId)detach(playerId,true);playerId=null;send(ws,{type:'left'});return;}
      if(['vehicle','paint','ready','customize'].includes(msg.type)){
        const person=players.get(playerId);if(!person)return error(ws,'Join the room first.');if(phase!=='lobby')return error(ws,'Change cars, paint and readiness in the lobby before the race.');
        if(msg.type==='ready'){if(typeof msg.ready!=='boolean')return error(ws,'Ready must be true or false.');person.ready=msg.ready;return;}
        const vehicleId=msg.vehicleId??person.vehicleId,paintId=msg.paintId??person.paintId;
        if(!VEHICLES.some(v=>v.id===vehicleId))return error(ws,'Unknown vehicle.');if(!PAINTS.some(p=>p.id===paintId))return error(ws,'Unknown paint color.');person.vehicleId=vehicleId;person.paintId=paintId;person.color=paintInfo(paintId).hex;person.ready=false;return;
      }
      if(['settings','start','reset'].includes(msg.type)){
        if(!playerId||playerId!==hostPlayerId)return error(ws,'Only the first joined player / current HOST can change settings or start races.');
        if(msg.type==='settings'){
          if(phase!=='lobby')return error(ws,'Race setup is locked until the lobby.');const value=msg.settings;if(!value||typeof value!=='object'||Array.isArray(value))return error(ws,'Invalid race settings.');
          if(Object.keys(value).some(k=>!['trackId','mode','laps'].includes(k)))return error(ws,'Unknown race setting.');const next={...settings,...value};
          if(!TRACKS.some(t=>t.id===next.trackId))return error(ws,'Unknown track.');if(!MODES.some(m=>m.id===next.mode))return error(ws,'Unsupported race mode.');if(!Number.isInteger(next.laps)||next.laps<1||next.laps>20)return error(ws,'Lap count must be an integer from 1 to 20.');settings=next;players.forEach(p=>p.ready=false);return;
        }
        if(msg.type==='reset'){phase='lobby';cars=[];firstFinish=null;players.forEach(p=>p.ready=false);return;}
        if(phase!=='lobby')return error(ws,'A race is already running. Return to the lobby first.');
        if(!players.size||[...players.values()].some(p=>!p.ready))return error(ws,'Every joined player, including the host, must be ready.');
        cars=[...players.values()].sort((a,b)=>a.joinOrder-b.joinOrder).map((p,i)=>({...newCar(p.id,p.name,i,false,p.vehicleId,{...settings,paintId:p.paintId}),color:p.color,joinOrder:p.joinOrder,source:p.source}));
        if(settings.mode==='circuit')for(let i=cars.length;i<4;i++){const bot=newCar('bot-'+i,['Miso','Turbo','Peachy','Rocket'][i%4],i,true,VEHICLES[i%VEHICLES.length].id,settings);bot.paintId=(i*3+4)%16;bot.color=paintInfo(bot.paintId).hex;cars.push(bot);}
        firstFinish=null;phase='countdown';started=Date.now()+countdownMs;return;
      }
      if(msg.type==='input'&&playerId){const car=cars.find(c=>c.id===playerId);if(car){car.lastInput=Date.now();car.input={steer:typeof msg.steer==='number'&&Number.isFinite(msg.steer)?Math.max(-1,Math.min(1,msg.steer)):0,throttle:msg.throttle===true,brake:msg.brake===true,boost:msg.boost===true,drift:msg.drift===true,reset:msg.reset===true};}}
    }catch{error(ws,'Invalid message.');}});
    ws.on('close',()=>{personalAudio.close(ws);if(playerId)detach(playerId);});
  });
  let last=Date.now();
  const tick=setInterval(()=>{
    const now=Date.now(),dt=Math.min(.1,(now-last)/1000);last=now;const elapsed=(now-started)/1000;
    for(const[token,p]of sessions)if(!players.has(p.id)&&now-(p.disconnectedAt||now)>120000)sessions.delete(token);
    if(phase==='countdown'&&elapsed>=0){phase='racing';if(cars[0])personalAudio.emit('start',cars[0],.6);}
    if(phase==='racing'){
      cars.forEach(c=>{if(!c.bot&&now-(c.lastInput||0)>500)c.input={};});let remaining=dt;while(remaining>.00001){const delta=Math.min(1/60,remaining);stepWorld(cars,delta,elapsed,personalAudio.emit);personalAudio.telemetry(delta);remaining-=delta;}
      if(firstFinish===null&&cars.some(c=>c.finished))firstFinish=elapsed;
      if((settings.mode==='drift'&&elapsed>=120)||(settings.mode!=='drift'&&cars.every(c=>c.finished))||(settings.mode==='circuit'&&firstFinish!==null&&elapsed-firstFinish>40)||elapsed>raceLimit()){phase='results';endedAt=elapsed;}
    }
    const packet=state();wss.clients.forEach(ws=>send(ws,packet));personalAudio.tick();
  },1000/30);
  server.on('close',()=>clearInterval(tick));
  return {server,wss,hostKey,code,close:()=>{clearInterval(tick);wss.clients.forEach(ws=>ws.terminate());wss.close();secureServer?.close();server.close();},listen:async()=>{
    if(tlsPort!==null){tlsConfig=await localTLS([...addresses,process.env.LAN_HOST].filter(Boolean));secureServer=https.createServer({key:tlsConfig.key,cert:tlsConfig.cert},handleRequest);secureServer.on('upgrade',upgrade);await new Promise((resolve,reject)=>{secureServer.once('error',reject);secureServer.listen(tlsPort,'0.0.0.0',resolve);});}
    return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',()=>resolve(server.address()));});
  }};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const game = createGameServer({ port: Number(process.env.PORT) || 3000, tlsPort: Number(process.env.HTTPS_PORT) || 3443 });
  const address = await game.listen();
  console.log(`\nROOM RALLY\nHost: http://localhost:${address.port}/#${game.hostKey}\nKeep this terminal running. Phones must use the same Wi-Fi.\n`);
}
