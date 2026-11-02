// Orientation is projected into screen coordinates, so either landscape direction works.
export function wheelAngle(beta,gamma,screenAngle=0){
  if(!Number.isFinite(beta)||!Number.isFinite(gamma))return null;
  const a=screenAngle*Math.PI/180,b=beta*Math.PI/180,g=gamma*Math.PI/180;
  // Gravity projected onto the screen avoids the Euler-angle jumps near upright.
  const gx=-Math.cos(b)*Math.sin(g),gy=Math.sin(b);
  const x=gx*Math.cos(a)-gy*Math.sin(a),y=gx*Math.sin(a)+gy*Math.cos(a);
  if(Math.hypot(x,y)<.15)return null; // A flat phone has no usable wheel reference.
  return Math.atan2(-x,y)*180/Math.PI;
}
export function tiltToSteer(value,center=0,range=30,invert=false){
  if(!Number.isFinite(value)||!Number.isFinite(center))return 0;
  const delta=((value-center+540)%360)-180;
  const magnitude=Math.max(0,Math.abs(delta)-2)/Math.max(8,range-2);
  if(magnitude===0)return 0;
  // Phone wheel roll and the car's yaw use opposite sign conventions.
  return Math.sign(delta)*Math.min(1,Math.pow(magnitude,1.25))*(invert?1:-1);
}
// CSS portrait fallback rotates the whole controller clockwise by 90 degrees.
export function touchWheelAngle(x,y,rect,rotated=false){
 const dx=x-(rect.left+rect.width/2),dy=y-(rect.top+rect.height/2);
 return Math.atan2(rotated?-dx:dy,rotated?dy:dx)*180/Math.PI;
}
export function touchWheelTurn(previous,next){return ((next-previous+540)%360)-180;}
// Pedals are explicit touch inputs and must not depend on motion permission or calibration.
export function phoneInput(pressed,steer,steeringAvailable,driftLatched=false){
  return {type:'input',steer:steeringAvailable&&Number.isFinite(steer)?Math.max(-1,Math.min(1,steer)):0,
    throttle:pressed.has('throttle'),brake:pressed.has('brake'),drift:pressed.has('drift')||driftLatched,boost:pressed.has('boost'),reset:pressed.has('reset')};
}
export function speedView(speed,boosting=false,narrow=false,high=false){
  const pace=Math.max(0,Math.min(1,((Number.isFinite(speed)?Math.abs(speed):0)-8)/44));
  return {fov:(narrow?74:64)+(narrow?9:16)*pace+(boosting?5:0),back:(narrow?12:high?14:9)-pace*.6,
    lift:(narrow?4.7:high?7:3.6)-pace*(high?.4:.9),lookAhead:9+pace*5,streaks:Math.max(0,Math.min(.22,(speed-22)/160))};
}
export function viewLayout(count,width,height){
  count=Math.min(4,Math.max(0,count));
  if(!count)return [];
  if(count===1)return [{x:0,y:0,w:width,h:height}];
  if(count===2)return [0,1].map(i=>({x:0,y:Math.floor(i*height/2),w:width,h:Math.floor((i+1)*height/2)-Math.floor(i*height/2)}));
  if(count===3)return [0,1,2].map(i=>({x:Math.floor(i*width/3),y:0,w:Math.floor((i+1)*width/3)-Math.floor(i*width/3),h:height}));
  return Array.from({length:count},(_,i)=>({x:Math.floor(i%2*width/2),y:Math.floor(Math.floor(i/2)*height/2),w:Math.floor((i%2+1)*width/2)-Math.floor(i%2*width/2),h:Math.floor((Math.floor(i/2)+1)*height/2)-Math.floor(Math.floor(i/2)*height/2)}));
}
