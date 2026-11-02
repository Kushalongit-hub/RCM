import {VEHICLES,vehicleSpec} from '/vehicle-catalog.js';
import {lobbyPanel} from '/lobby-ui.js';
import {PersonalAudio} from '/phone-audio.js';
import {wheelAngle,tiltToSteer,phoneInput,touchWheelAngle,touchWheelTurn} from '/controls.js';
const $=id=>document.getElementById(id);
$('code').value=new URLSearchParams(location.search).get('room')||'';
$('name').value=localStorage.getItem('rally-name')||'';
for(const id of ['join-vehicle','wheel-vehicle']){for(const v of VEHICLES){const option=document.createElement('option');option.value=v.id;option.textContent=v.name+' · '+v.category;$(id).append(option);}$(id).value=vehicleSpec(localStorage.getItem('rally-vehicle')).id;}
$('join-vehicle').onchange=()=>localStorage.setItem('rally-vehicle',$('join-vehicle').value);
$('wheel-vehicle').onchange=()=>{releaseAll();localStorage.setItem('rally-vehicle',$('wheel-vehicle').value);if(joined&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'vehicle',vehicleId:$('wheel-vehicle').value}));};
let ws,id,joined=false,phase='lobby',gyroEnabled=false,gyroReady=false,lastSensor=0,rawAngle=null,center=0,steer=0,calibration=null,driftLatched=false;
const pressed=new Set(),pointersByButton=new Map();
const mode=()=>$('steering-mode').value;
const assembly=document.querySelector('.formula-assembly'),wheelCenter=document.querySelector('.wheel-center'),functions=document.querySelector('.wheel-functions');
const chassis=document.querySelector('.wheel-chassis'),brake=document.querySelector('[data-control="brake"]'),throttle=document.querySelector('[data-control="throttle"]');
const originalPlaces=[chassis,brake,wheelCenter,throttle,functions].map(node=>{const anchor=document.createComment('wheel layout');node.before(anchor);return {node,anchor};});
const touchDeck=document.createElement('div');touchDeck.className='touch-deck hidden';
touchDeck.innerHTML='<div class="touch-pedals"></div><div class="touch-wheel-column"><div class="touch-wheel-zone" role="slider" tabindex="0" aria-label="F1 touch steering wheel" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><div class="touch-wheel-rotator"></div><span class="wheel-turn-hint">↶ DRAG TO STEER ↷</span></div></div>';
assembly.append(touchDeck);
const wheelZone=touchDeck.querySelector('.touch-wheel-zone'),rotator=touchDeck.querySelector('.touch-wheel-rotator');
let wheelPointer=null,wheelPrevious=0,wheelDegrees=0;
function touchLayout(){
 const touch=mode()==='touch';document.body.classList.toggle('touch-wheel-mode',touch);touchDeck.classList.toggle('hidden',!touch);
 if(touch){touchDeck.querySelector('.touch-pedals').append(brake,throttle);rotator.append(chassis,wheelCenter);touchDeck.querySelector('.touch-wheel-column').append(functions);}
 else for(const {node,anchor}of originalPlaces)anchor.after(node);
 $('touch-steering').classList.add('hidden');
}
function centerTouchWheel(){wheelPointer=null;wheelDegrees=0;$('touch-steer').value=0;rotator.style.transform='rotate(0deg)';wheelZone.setAttribute('aria-valuenow','0');}
function setTouchWheel(degrees){wheelDegrees=Math.max(-100,Math.min(100,degrees));$('touch-steer').value=wheelDegrees/100;sendInput();}
wheelZone.addEventListener('pointerdown',event=>{if(mode()!=='touch'||wheelPointer!==null)return;event.preventDefault();wheelPointer=event.pointerId;wheelPrevious=touchWheelAngle(event.clientX,event.clientY,wheelZone.getBoundingClientRect(),document.body.classList.contains('landscape-fallback'));wheelZone.setPointerCapture(event.pointerId);});
wheelZone.addEventListener('pointermove',event=>{if(event.pointerId!==wheelPointer)return;event.preventDefault();const next=touchWheelAngle(event.clientX,event.clientY,wheelZone.getBoundingClientRect(),document.body.classList.contains('landscape-fallback'));setTouchWheel(wheelDegrees+touchWheelTurn(wheelPrevious,next));wheelPrevious=next;});
const releaseWheel=event=>{if(event.pointerId!==wheelPointer)return;centerTouchWheel();sendInput();};
for(const type of ['pointerup','pointercancel','lostpointercapture'])wheelZone.addEventListener(type,releaseWheel);
wheelZone.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();setTouchWheel(event.key==='Home'?0:event.key==='End'?100:wheelDegrees+(event.key==='ArrowRight'?10:-10));});
const screenAngle=()=>(window.screen.orientation?.angle??window.orientation??0)+(document.body.classList.contains('landscape-fallback')?90:0);
function fitLandscape(){
  if(!joined)return;
  const width=document.documentElement.clientWidth,height=document.documentElement.clientHeight;
  const sideways=height>width,changed=document.body.classList.contains('landscape-fallback')!==sideways;
  document.body.classList.toggle('landscape-fallback',sideways);
  document.body.style.setProperty('--controller-width',`${Math.max(width,height)}px`);
  document.body.style.setProperty('--controller-height',`${Math.min(width,height)}px`);
  document.body.style.setProperty('--portrait-width',`${width}px`);
  if(changed){releaseAll();if(gyroEnabled&&mode()==='gyro')beginCalibration();}
}
async function enterLandscape(){
  releaseAll();
  try{if(!document.fullscreenElement){const root=document.documentElement;if(root.requestFullscreen)await root.requestFullscreen();else root.webkitRequestFullscreen?.();}}catch{/* The sideways layout also works without fullscreen. */}
  try{await window.screen.orientation?.lock?.('landscape');}catch{/* Unsupported orientation locks use the sideways layout. */}
  fitLandscape();
}
window.addEventListener('resize',fitLandscape);document.addEventListener('fullscreenchange',fitLandscape);
$('landscape').onclick=enterLandscape;
function releaseAll(){pressed.clear();driftLatched=false;steer=0;centerTouchWheel();pointersByButton.forEach(p=>p.clear());document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));sendInput();}
function status(text){$('gyro-status').textContent=text;}
function setReady(ready){gyroReady=ready;$('calibrate').disabled=!gyroEnabled;document.querySelectorAll('[data-control="throttle"],[data-control="brake"]').forEach(b=>b.disabled=false);}
function sendInput(){
  if(ws?.readyState!==WebSocket.OPEN||!joined)return;
  const valid=mode()==='touch'||gyroReady&&performance.now()-lastSensor<600;
  const keySteer=(pressed.has('right')?1:0)-(pressed.has('left')?1:0);
  const target=valid?(keySteer||(mode()==='touch'?Number($('touch-steer').value):tiltToSteer(rawAngle,center,Number($('sensitivity').value),$('invert').checked))):0;
  steer+=(target-steer)*.4;
  if(mode()==='touch'){
    const angle=steer*100,radians=angle*Math.PI/180;
    const turnedHeight=Math.abs(Math.sin(radians))*rotator.offsetWidth+Math.abs(Math.cos(radians))*rotator.offsetHeight;
    const scale=Math.min(1,wheelZone.clientHeight*.88/Math.max(1,turnedHeight));
    rotator.style.transform=`rotate(${angle}deg) scale(${scale})`;
  }
  wheelZone.setAttribute('aria-valuenow',String(Math.round(steer*100)));
  $('steering-marker').style.left=`calc(${50+steer*46}% - 3px)`;
  $('throttle-meter').style.width=pressed.has('throttle')?'100%':'0';$('brake-meter').style.width=pressed.has('brake')?'100%':'0';
  ws.send(JSON.stringify(phoneInput(pressed,Math.abs(steer)<.005?0:steer,valid,driftLatched)));
}
function beginCalibration(){if(!gyroEnabled)return;releaseAll();setReady(false);calibration={until:performance.now()+650,sin:0,cos:0,count:0};status('Hold still… centering your steering wheel.');}
function orientation(event){
  if(!gyroEnabled||mode()!=='gyro'||document.hidden)return;
  const value=wheelAngle(event.beta,event.gamma,screenAngle());if(value===null)return;
  rawAngle=value;lastSensor=performance.now();
  if(calibration){calibration.sin+=Math.sin(value*Math.PI/180);calibration.cos+=Math.cos(value*Math.PI/180);calibration.count++;if(performance.now()>=calibration.until&&calibration.count>=3){center=Math.atan2(calibration.sin,calibration.cos)*180/Math.PI;calibration=null;setReady(true);status('Gyro ready. Turn the phone left/right like a steering wheel.');}}
}
async function enableGyro(){
  $('steering-mode').value='gyro';$('touch-steering').classList.add('hidden');
  touchLayout();
  releaseAll();setReady(false);
  if(!window.isSecureContext){status('Pedals are ready. Gyro steering needs HTTPS; open Gyro setup, or choose Touch fallback.');return;}
  if(!window.DeviceOrientationEvent){status('This browser has no orientation sensor API. Use a phone browser with motion sensors, or select Touch fallback.');return;}
  try{
    if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted'){status('Motion permission was denied. Allow Motion & Orientation for this site, then enable gyro again.');return;}
    gyroEnabled=true;$('enable-gyro').textContent='Re-enable gyro';beginCalibration();
    setTimeout(()=>{if(!gyroReady&&calibration)status('No usable sensor readings yet. Check motion permissions, use Safari/Chrome on your phone, and tap Center wheel.');},3500);
  }catch{status('Motion access could not start. Check browser sensor permissions and use a trusted HTTPS connection.');}
}
window.addEventListener('deviceorientation',orientation);
function rotated(){fitLandscape();if(gyroEnabled&&mode()==='gyro')beginCalibration();}
window.screen.orientation?.addEventListener('change',rotated);window.addEventListener('orientationchange',rotated);
$('enable-gyro').onclick=enableGyro;$('calibrate').onclick=beginCalibration;
$('steering-mode').onchange=()=>{releaseAll();calibration=null;touchLayout();if(mode()==='gyro'){setReady(false);if(gyroEnabled)beginCalibration();else status('Pedals are ready. Enable gyro to steer, or choose Touch wheel.');}else{setReady(false);status('Hold a pedal on the left. Drag the F1 wheel to steer; release to center.');}};
touchLayout();
$('sensitivity').oninput=()=>{$('range-value').textContent=`${$('sensitivity').value}°`;};
$('touch-steer').onpointerup=$('touch-steer').onpointercancel=()=>{$('touch-steer').value=0;};
$('drift-mode').onchange=()=>{driftLatched=false;pressed.delete('drift');document.querySelector('[data-control="drift"]').classList.remove('pressed');$('drift-behavior-label').textContent=$('drift-mode').value.toUpperCase();sendInput();};
function connect(){
  ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);
  ws.onopen=()=>{$('connection').textContent='CONNECTED';const token=sessionStorage.getItem('rally-phone-'+location.port);if(token)ws.send(JSON.stringify({type:'resume',resumeToken:token}));};
  ws.onclose=()=>{personal.silence();setTimeout(connect,1500);joined=false;releaseAll();$('connection').textContent='OFFLINE';$('phone-note').textContent='Disconnected. Reload and rejoin from the lobby.';$('error').textContent='Connection lost. Reload to reconnect.';};
  ws.onmessage=event=>{
    const msg=JSON.parse(event.data);
    if(msg.type==='audio-pair'){panel.pair(msg);return;}if(msg.type.startsWith('audio-')){personal.receive(msg);return;}if(msg.type==='left'){releaseAll();joined=false;id=null;sessionStorage.removeItem('rally-phone-'+location.port);document.body.classList.remove('controller-active','landscape-fallback');$('controls').classList.add('hidden');$('join-form').classList.remove('hidden');return;}
    if(msg.type==='error'){if(msg.message.startsWith('Session expired'))sessionStorage.removeItem('rally-phone-'+location.port);panel.message(msg.message);$('error').textContent=msg.message;if(joined)status(msg.message);return;}
    if(msg.type==='joined'){joined=true;id=msg.id;sessionStorage.setItem('rally-phone-'+location.port,msg.resumeToken);$('name').value=msg.name;if(personal.enabled){personal.seq=-1;sendRoom({type:'audio-enable'});}document.activeElement?.blur();document.body.classList.add('controller-active');$('join-form').classList.add('hidden');$('controls').classList.remove('hidden');fitLandscape();$('driver-name').textContent=$('name').value;$('driver-name').style.color=msg.color;localStorage.setItem('rally-name',$('name').value);setReady(false);if(mode()==='touch')status('Hold a pedal on the left. Drag the F1 wheel to steer; release to center.');else if(!window.isSecureContext)status('Pedals are ready. Gyro steering needs HTTPS; open Gyro setup, or choose Touch wheel.');}
    if(msg.type==='state'&&joined){panel.update(msg);
      if(msg.phase!==phase){if(msg.phase==='countdown')closeSettings();if(msg.phase==='lobby'||msg.phase==='results')releaseAll();phase=msg.phase;}
      $('status').textContent=msg.phase==='lobby'?'Waiting for lights.':msg.phase==='countdown'?`Lights out in ${Math.max(1,Math.ceil(-msg.elapsed))}…`:msg.phase==='results'?'Race complete!':'Push, push!';
      const player=msg.players.find(p=>p.id===id);if(player)$('wheel-vehicle').value=player.vehicleId;$('wheel-vehicle').disabled=msg.phase!=='lobby';
      const car=msg.cars.find(c=>c.id===id);
      if(car){$('driver-name').textContent=`P${msg.cars.indexOf(car)+1} · ${$('name').value}`;$('boost-value').textContent=`${Math.round(car.boost)}%`;$('lap').textContent=car.finished?'FINISHED ✓':`LAP ${car.lap} / ${msg.settings.laps}`;
        const longitudinal=car.vx*Math.sin(car.yaw)+car.vz*Math.cos(car.yaw);
        const gear=longitudinal<-1?'R':car.speed<.5?'N':car.gear||1;
        $('telemetry-gear').textContent=gear;$('telemetry-speed').textContent=Math.round(car.speed*3.6);$('ers-meter').style.width=`${car.boost}%`;
        $('telemetry-rpm').textContent=car.speed<.5?'IDLE':`${Math.round(car.rpm||0)} RPM`;
        const ranking=[...msg.cars].sort((a,b)=>a.finished&&b.finished?a.finishTime-b.finishTime:a.finished?-1:b.finished?1:b.progress-a.progress);
        $('dash-position').textContent=`P${ranking.findIndex(c=>c.id===id)+1} / ${msg.cars.length}`;
        document.querySelectorAll('#rpm-leds i').forEach((led,i)=>led.classList.toggle('on',car.speed>.5&&i/14<(car.speed%7)/7));
        document.querySelector('.drift-button').classList.toggle('sliding',car.drifting);
        if(car.wrongWay)$('status').textContent='↶ Wrong way!';if(car.finished)$('status').textContent='Chequered flag!';
      }else{$('boost-value').textContent='100%';$('lap').textContent='LAP 1 / '+msg.settings.laps;$('telemetry-gear').textContent='N';$('telemetry-speed').textContent='0';$('telemetry-rpm').textContent='IDLE';$('dash-position').textContent='P—';$('ers-meter').style.width='100%';document.querySelectorAll('#rpm-leds i').forEach(led=>led.classList.remove('on'));document.querySelector('.drift-button').classList.remove('sliding');}
    }
  };
}
connect();
$('join-form').onsubmit=event=>{event.preventDefault();$('error').textContent='';if(ws.readyState!==WebSocket.OPEN){$('error').textContent='Server offline. Reload to reconnect.';return;}ws.send(JSON.stringify({type:'join',code:$('code').value.trim().toUpperCase(),name:$('name').value,vehicleId:$('join-vehicle').value}));};
document.querySelectorAll('[data-control]').forEach(button=>{
  const pointers=new Set();pointersByButton.set(button,pointers);
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);pointers.add(event.pointerId);if(button.dataset.control==='drift'&&$('drift-mode').value==='toggle'){driftLatched=!driftLatched;button.classList.toggle('pressed',driftLatched);}else{pressed.add(button.dataset.control);button.classList.add('pressed');}sendInput();});
  const release=event=>{pointers.delete(event.pointerId);if(!pointers.size){pressed.delete(button.dataset.control);if(button.dataset.control!=='drift'||!driftLatched)button.classList.remove('pressed');sendInput();}};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);button.oncontextmenu=event=>event.preventDefault();
});
const keys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'throttle',ArrowDown:'brake',' ':'boost',Shift:'drift',b:'boost',r:'reset',a:'left',d:'right',w:'throttle',s:'brake'};
window.addEventListener('keydown',e=>{if(!joined||!keys[e.key])return;e.preventDefault();pressed.add(keys[e.key]);sendInput();});window.addEventListener('keyup',e=>{if(!keys[e.key])return;pressed.delete(keys[e.key]);sendInput();});
window.addEventListener('blur',releaseAll);document.addEventListener('visibilitychange',()=>{releaseAll();if(!document.hidden&&gyroEnabled&&mode()==='gyro')beginCalibration();});
setInterval(()=>{if(gyroReady&&performance.now()-lastSensor>600){setReady(false);releaseAll();status('Motion readings stopped. Tap Center wheel to resume safely.');}sendInput();},50);
fetch('/api/connection').then(r=>r.json()).then(c=>{$('secure-help').href=c.setupUrl;}).catch(()=>{});

function sendRoom(msg){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg));}const panel=lobbyPanel(document.querySelector('.wheel-settings'),sendRoom,()=>id);const personal=new PersonalAudio(document.querySelector('.wheel-settings'),sendRoom);

const wheelSettings=document.querySelector('.wheel-settings');
function closeSettings(){releaseAll();wheelSettings.open=false;}
const settingsToolbar=document.createElement('div');settingsToolbar.className='settings-toolbar';const backToController=document.createElement('button');backToController.type='button';backToController.textContent='← Back to controller';backToController.onclick=closeSettings;settingsToolbar.append(backToController);wheelSettings.querySelector('summary').after(settingsToolbar);
wheelSettings.addEventListener('toggle',releaseAll);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&wheelSettings.open){event.preventDefault();closeSettings();}});
const lobbyButton=document.createElement('button');lobbyButton.className='secondary';lobbyButton.textContent='Lobby / Ready';lobbyButton.onclick=()=>{releaseAll();wheelSettings.scrollTop=0;wheelSettings.open=true;};document.querySelector('.sensor-bar').append(lobbyButton);
