import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../server.js';
import { newCar, step, stepWorld, rescue } from '../game.js';
import { pointAt, nearest } from '../public/track.js';
import { wheelAngle, tiltToSteer, viewLayout, phoneInput, speedView, touchWheelAngle, touchWheelTurn } from '../public/controls.js';
import https from 'node:https';
import http from 'node:http';
test('touch wheel turns left/right through angle wrap and rotated portrait coordinates',()=>{
 const r={left:0,top:0,width:200,height:200};
 assert.equal(touchWheelTurn(touchWheelAngle(200,100,r),touchWheelAngle(100,200,r)),90);
 assert.equal(touchWheelTurn(touchWheelAngle(200,100,r),touchWheelAngle(100,0,r)),-90);
 assert.equal(touchWheelTurn(179,-179),2);assert.equal(touchWheelTurn(-179,179),-2);
 assert.equal(touchWheelTurn(touchWheelAngle(100,200,r,true),touchWheelAngle(0,100,r,true)),90);
 assert.equal(touchWheelTurn(touchWheelAngle(100,200,r,true),touchWheelAngle(200,100,r,true)),-90);
 const keys=new Set(['throttle','drift']);assert.equal(phoneInput(keys,-.5,true).steer,-.5);assert.ok(phoneInput(keys,-.5,true).throttle&&phoneInput(keys,-.5,true).drift);
});

test('gyro steering handles both landscape orientations, centering, dead zone and inversion',()=>{
  assert.ok(wheelAngle(20,-70,90)>20);assert.ok(wheelAngle(-20,-70,90)<-20);
  assert.ok(wheelAngle(-20,70,270)>20);assert.ok(wheelAngle(20,70,270)<-20);
  assert.ok(Math.abs(wheelAngle(0,-70,90))<.001);assert.ok(wheelAngle(70,20,0)>0);assert.equal(wheelAngle(0,0,0),null);
  assert.equal(wheelAngle(null,0,90),null);assert.equal(tiltToSteer(NaN),0);
  assert.equal(tiltToSteer(21,20),0);assert.equal(tiltToSteer(52,20,32),-1);assert.equal(tiltToSteer(-12,20,32),1);
  assert.equal(tiltToSteer(52,20,32,true),1);assert.ok(Math.abs(tiltToSteer(-179,179))<.05);
});
test('phone pedals work before gyro calibration, and P2 input moves only P2',()=>{
  const p1=newCar('p1','One',0),p2=newCar('p2','Two',1),keys=new Set(['throttle']);
  p2.input=phoneInput(keys,.8,false);assert.equal(p2.input.throttle,true);assert.equal(p2.input.steer,0);
  for(let i=0;i<45;i++)stepWorld([p1,p2],1/60,i/60);
  assert.ok(p2.speed>5);assert.equal(p1.speed,0);
  keys.clear();keys.add('brake');assert.equal(phoneInput(keys,1,false).brake,true);
  assert.equal(phoneInput(keys,NaN,true).steer,0);assert.equal(phoneInput(keys,.8,true).steer,.8);
  keys.clear();assert.equal(phoneInput(keys,0,false).throttle,false);
});
test('speed cues grow with real speed, remain bounded, and preserve narrow split views',()=>{
  const stopped=speedView(0),fast=speedView(47),boost=speedView(66,true),narrow=speedView(47,false,true);
  assert.equal(stopped.streaks,0);assert.ok(fast.fov>stopped.fov+10);assert.ok(fast.lift<stopped.lift);assert.ok(fast.lookAhead>stopped.lookAhead);assert.ok(fast.streaks>0);
  assert.ok(boost.fov>fast.fov&&boost.fov<=85);assert.ok(narrow.fov>fast.fov&&narrow.fov<90);assert.equal(speedView(1000).streaks,.22);
});
test('up to four player viewports cover the screen exactly without overlapping',()=>{
  for(const count of [1,2,3,4]){const views=viewLayout(count,1001,701);assert.equal(views.length,count);assert.equal(views.reduce((area,v)=>area+v.w*v.h,0),1001*701);
    for(let i=0;i<views.length;i++)for(let j=i+1;j<views.length;j++){const a=views[i],b=views[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}}
  assert.equal(viewLayout(8,1000,600).length,4);
  assert.deepEqual(viewLayout(4,1000,600),[{x:0,y:0,w:500,h:300},{x:500,y:0,w:500,h:300},{x:0,y:300,w:500,h:300},{x:500,y:300,w:500,h:300}]);
});

test('free steering changes heading; no throttle means no automatic movement', () => {
  const car=newCar('one','One',0),x=car.x,z=car.z,yaw=car.yaw;
  for(let i=0;i<60;i++)step(car,1/60,i/60);
  assert.equal(car.x,x);assert.equal(car.z,z);assert.equal(car.nextCheckpoint,0);
  car.input={throttle:true,steer:.7};
  for(let i=0;i<90;i++)step(car,1/60,i/60);
  assert.ok(Math.abs(car.yaw-yaw)>.5);assert.ok(Math.hypot(car.x-x,car.z-z)>8);
  car.input={throttle:true,boost:true};for(let i=0;i<120;i++)step(car,1/60,i/60);
  assert.ok(car.boost>0&&car.boost<50);car.input={};for(let i=0;i<60;i++)step(car,1/60,i/60);assert.ok(car.boost>40&&car.boost<=100);
});

test('drift changes handling without awarding a power-up; rescue preserves checkpoint credit',()=>{
  const car=newCar('one','One',0),p=pointAt(20);Object.assign(car,{x:p.x,z:p.z,y:p.y,yaw:p.yaw,lastS:p.s,vx:Math.sin(p.yaw)*30,vz:Math.cos(p.yaw)*30,speed:30});
  car.input={throttle:true,steer:.25,drift:true};
  for(let i=0;i<55;i++)step(car,1/60,i/60);
  assert.equal(car.drifting,true);
  car.input.drift=false;step(car,1/60,1);assert.equal(car.boosting,false);assert.equal('turbo' in car,false);assert.equal('driftCharge' in car,false);
  const checkpoint=car.nextCheckpoint;car.x+=100;rescue(car);assert.equal(car.nextCheckpoint,checkpoint);assert.ok(nearest(car.x,car.z).distance<.1);assert.equal(car.speed,0);
});

test('brake overrides the forward pedal, then holding brake engages reverse',()=>{
  const car=newCar('a','A',0),p=pointAt(20);Object.assign(car,{x:p.x,y:p.y,z:p.z,yaw:p.yaw,lastS:p.s,vx:Math.sin(p.yaw)*12,vz:Math.cos(p.yaw)*12,speed:12});car.input={throttle:true,brake:true};
  for(let i=0;i<120;i++)step(car,1/60,i/60);
  assert.ok(car.vx*Math.sin(car.yaw)+car.vz*Math.cos(car.yaw)<-5);
  const centered=newCar('c','C',0);centered.vx=Math.sin(centered.yaw)*25;centered.vz=Math.cos(centered.yaw)*25;centered.input={drift:true,throttle:true,steer:0};step(centered,1/60,0);assert.equal(centered.drifting,false);
});

test('bots physically navigate all three laps; reverse crossings earn no lap credit',()=>{
  const car=newCar('bot','Bot',0,true);
  for(let i=0;i<60*180&&!car.finished;i++)step(car,1/60,i/60);
  assert.equal(car.finished,true);assert.equal(car.nextCheckpoint,25);assert.equal(car.lap,3);assert.ok(car.finishTime>30);
  const reverse=newCar('reverse','Reverse',0);const p=pointAt(1);Object.assign(reverse,{x:p.x,z:p.z,y:p.y,lastS:p.s,yaw:p.yaw+Math.PI,vx:-Math.sin(p.yaw)*15,vz:-Math.cos(p.yaw)*15});
  for(let i=0;i<60;i++)step(reverse,1/60,i/60);
  assert.equal(reverse.nextCheckpoint,0);assert.equal(reverse.lap,1);
});

test('ERS is driver controlled, regenerates under braking, and cars have no item state',()=>{
  const car=newCar('a','A',0);car.boost=50;car.input={throttle:true,boost:true};
  for(let i=0;i<60;i++)stepWorld([car],1/60,i/60);assert.ok(car.boost<25);assert.equal(car.boosting,true);
  car.input={brake:true};const energy=car.boost;for(let i=0;i<60;i++)stepWorld([car],1/60,i/60);assert.ok(car.boost>=energy+11.9);assert.equal(car.boosting,false);
  for(const key of ['item','shield','turbo','driftCharge','itemCooldown'])assert.equal(key in car,false);
});

test('kart collision separates overlapping bodies and keeps the simulation finite',()=>{
  const a=newCar('a','A',0),b=newCar('b','B',0);
  stepWorld([a,b],1/60,0);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=2.49);
  for(const c of [a,b])for(const key of ['x','y','z','yaw','speed'])assert.ok(Number.isFinite(c[key]));
});

test('LAN joining, host authorization, input validation and disconnect takeover', async () => {
  const game = createGameServer({ port: 0 });
  const { port } = await game.listen();
  const sockets = [];
  const connect = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`); const messages = []; sockets.push(ws);
    ws.on('message', data => messages.push(JSON.parse(data)));
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    return { ws, messages, send: data => ws.send(JSON.stringify(data)) };
  };
  const waitFor = async (client, predicate) => {
    const end = Date.now() + 5000;
    while (Date.now() < end) { const msg = client.messages.find(predicate); if (msg) return msg; await new Promise(resolve => setTimeout(resolve, 20)); }
    throw Error('Timed out waiting for state');
  };
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/connection`);
    const config = await response.json(); assert.equal(config.code, game.code); assert.match(config.qr, /^data:image\/png;base64,/); assert.ok(!JSON.stringify(config).includes(game.hostKey));
    assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/../server.js`)).status, 404);
    const display = await connect(), phone = await connect();
    phone.send({ type: 'join', code: 'BAD', name: 'Alice' });
    await waitFor(phone, m => m.type === 'error');
    phone.send({ type: 'join', code: game.code, name: 'Alice',vehicleId:'drift' });
    const joined = await waitFor(phone, m => m.type === 'joined');
    assert.equal(joined.vehicleId,'drift');
    phone.send({type:'vehicle',vehicleId:'tourer'});await waitFor(phone,m=>m.type==='state'&&m.players.some(p=>p.id===joined.id&&p.vehicleId==='tourer'));
    phone.send({type:'vehicle',vehicleId:'missing'});await waitFor(phone,m=>m.type==='error'&&m.message==='Unknown vehicle.');
    for(let i=0;i<3;i++){const extra=await connect();extra.send({type:'join',code:game.code,name:`Extra ${i}`});await waitFor(extra,m=>m.type==='joined');}
    const fifth=await connect();fifth.send({type:'join',code:game.code,name:'Fifth'});const full=await waitFor(fifth,m=>m.type==='error');assert.match(full.message,/four players maximum/);
    phone.send({ type: 'start' });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(phone.messages.filter(m => m.type === 'state').at(-1).phase, 'lobby');
    display.send({ type: 'host', key: game.hostKey }); await waitFor(display, m => m.type === 'host-ok');
    display.send({type:'start'});await waitFor(display,m=>m.type==='error'&&m.message.includes('Only the first'));
    for(const socket of sockets)if(socket!==display.ws&&socket!==fifth.ws&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'ready',ready:true}));
    const anotherHost=await connect();anotherHost.send({type:'host',key:game.hostKey});await waitFor(anotherHost,m=>m.type==='host-ok');
    // Opening another host tab must not revoke the original Start button.
    phone.send({ type: 'start' }); await waitFor(phone, m => m.type === 'state' && m.phase === 'countdown');
    phone.send({type:'vehicle',vehicleId:'formula'});await waitFor(phone,m=>m.type==='error'&&m.message.includes('Change cars'));
    phone.send({ type: 'input', throttle: true, steer: 'bad' });
    phone.send({ type: 'input', throttle: true, steer: 999 });
    const racing = await waitFor(phone, m => m.type === 'state' && m.phase === 'racing' && m.cars.some(c => c.id === joined.id));
    assert.equal(racing.cars.find(c=>c.id===joined.id).vehicleId,'tourer');
    assert.equal(racing.cars.length, 4); assert.ok(racing.cars.every(c => Number.isFinite(c.x)&&Number.isFinite(c.yaw)));
    assert.equal('world' in racing,false);assert.ok(racing.cars.every(c=>!('item' in c)&&!('turbo' in c)&&!('shield' in c)));
    phone.messages.length = 0;
    phone.send({ type: 'input', throttle: true, steer: 999 });
    const moving = await waitFor(phone, m => m.type === 'state' && m.cars.some(c => c.id === joined.id && c.speed > 0));
    assert.ok(Math.abs(moving.cars.find(c => c.id === joined.id).steering)<=1);
    phone.ws.close(); const takeover=await waitFor(display, m => m.type === 'state' && m.phase === 'racing' && m.cars.find(c => c.id === joined.id)?.bot);assert.equal(takeover.cars.find(c=>c.id===joined.id).human,true);
    display.messages.length=0;
    sockets[2].send(JSON.stringify({type:'reset'}));await waitFor(display,m=>m.type==='state'&&m.phase==='lobby'&&m.cars.length===0);
  } finally { sockets.forEach(ws => ws.terminate()); game.close(); }
});

test('localhost host recovery works without a token; LAN hostnames and cross-origin requests cannot retrieve it',async()=>{
  const game=createGameServer({port:0});
  try{const {port}=await game.listen(),base=`http://127.0.0.1:${port}`;
    const response=await fetch(`${base}/api/host`);assert.equal(response.status,200);assert.equal((await response.json()).key,game.hostKey);
    const nonLocalHost=await new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port,path:'/api/host',headers:{Host:`192.168.0.106:${port}`}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});assert.equal(nonLocalHost,403);
    assert.equal((await fetch(`${base}/api/host`,{headers:{origin:'https://unrelated.example'}})).status,403);
  }finally{game.close();}
});

test('secure LAN controller uses a valid locally signed certificate and shares the game room',async()=>{
  const game=createGameServer({port:0,tlsPort:0});let socket;
  try{const {port}=await game.listen();const c=await(await fetch(`http://127.0.0.1:${port}/api/connection`)).json();assert.equal(c.secure,true);assert.match(c.joinUrl,/^https:/);
    const ca=await(await fetch(`http://127.0.0.1:${port}/room-rally-ca.crt`)).text();const securePort=new URL(c.joinUrl).port;
    const status=await new Promise((resolve,reject)=>{https.get({hostname:'127.0.0.1',port:securePort,path:'/controller',ca},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});assert.equal(status,200);
    socket=new WebSocket(`wss://127.0.0.1:${securePort}`,{ca});const state=await new Promise((resolve,reject)=>{socket.once('message',data=>resolve(JSON.parse(data)));socket.once('error',reject);});assert.equal(state.code,game.code);
    assert.equal((await fetch(`http://127.0.0.1:${port}/.local-certs/ca-key.pem`)).status,404);
  }finally{socket?.terminate();game.close();}
});
