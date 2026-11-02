import {trackInfo,TRACKS} from './track-catalog.js';
export {TRACKS};
export const LAPS=3;
const mod=(n,m)=>(n%m+m)%m,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const spline=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
const cache=new Map();
export function getTrack(id='coastal'){
 const data=trackInfo(id);if(cache.has(data.id))return cache.get(data.id);
 const control=data.points.map(([x,z,y],i)=>[x,y??(6+(data.elevation||0)*(1+Math.sin(i/controlLength(data)*Math.PI*2))*.5),z]);
 const dense=Array.from({length:control.length*40+1},(_,i)=>{const u=i/(control.length*40)*control.length,k=Math.floor(u),t=u-k;const p=[0,1,2].map(axis=>spline(...[-1,0,1,2].map(j=>control[mod(k+j,control.length)][axis]),t));return{x:p[0],y:p[1],z:p[2],s:0};});
 let length=0;dense.forEach((p,i)=>{if(i)length+=Math.hypot(p.x-dense[i-1].x,p.z-dense[i-1].z);p.s=length;});
 const count=Math.max(320,Math.ceil(length/3)),samples=[];let k=0;
 for(let i=0;i<=count;i++){const s=i/count*length;while(k<dense.length-2&&dense[k+1].s<s)k++;const a=dense[k],b=dense[k+1],t=(s-a.s)/(b.s-a.s);samples.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,s});}
 for(let i=0;i<samples.length;i++){const prev=samples[mod(i-1,count)],next=samples[(i+1)%count],p=samples[i];p.yaw=Math.atan2(next.x-prev.x,next.z-prev.z);}
 for(let i=0;i<samples.length;i++){const p=samples[i],a=samples[mod(i-3,count)],b=samples[(i+3)%count],curvature=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))/Math.max(1,6*length/count);p.curvature=curvature;p.bank=-(data.bank||0)*Math.tanh(curvature*180);if(data.offCamber&&p.s/length>data.offCamber[0]&&p.s/length<data.offCamber[1])p.bank*=1-1.5*Math.sin(Math.PI*(p.s/length-data.offCamber[0])/(data.offCamber[1]-data.offCamber[0]))**2;}
 const bounds={minX:Math.min(...samples.map(p=>p.x)),maxX:Math.max(...samples.map(p=>p.x)),minZ:Math.min(...samples.map(p=>p.z)),maxZ:Math.max(...samples.map(p=>p.z))};
 const grid=new Map(),cell=40;
 for(let i=0;i<count;i++){const a=samples[i],b=samples[i+1];for(let gx=Math.floor(Math.min(a.x,b.x)/cell);gx<=Math.floor(Math.max(a.x,b.x)/cell);gx++)for(let gz=Math.floor(Math.min(a.z,b.z)/cell);gz<=Math.floor(Math.max(a.z,b.z)/cell);gz++){const key=gx+':'+gz;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);}}
 function pointAt(s,offset=0){s=mod(s,length);const i=Math.min(count-1,Math.floor(s/length*count)),a=samples[i],b=samples[i+1],t=(s-a.s)/(b.s-a.s),yaw=Math.atan2(b.x-a.x,b.z-a.z),bank=a.bank+(b.bank-a.bank)*t;return{x:a.x+(b.x-a.x)*t+Math.cos(yaw)*offset,y:a.y+(b.y-a.y)*t+Math.tan(bank)*offset,z:a.z+(b.z-a.z)*t-Math.sin(yaw)*offset,yaw,bank,curvature:a.curvature+(b.curvature-a.curvature)*t,s};}
 function nearest(x,z){let best={distance:Infinity};const gx=Math.floor(x/cell),gz=Math.floor(z/cell),indices=new Set();for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++)for(const i of grid.get((gx+ix)+':'+(gz+iz))||[])indices.add(i);const candidates=indices.size?indices:samples.slice(0,-1).keys();
  const assess=i=>{const a=samples[i],b=samples[i+1],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),px=a.x+dx*t,pz=a.z+dz*t,distance=Math.hypot(x-px,z-pz);if(distance<best.distance){const yaw=Math.atan2(dx,dz);best={x:px,y:a.y+(b.y-a.y)*t,z:pz,s:a.s+(b.s-a.s)*t,yaw,bank:a.bank+(b.bank-a.bank)*t,curvature:a.curvature,distance,offset:(x-px)*Math.cos(yaw)-(z-pz)*Math.sin(yaw)};}};for(const i of candidates)assess(i);if(indices.size&&best.distance>cell)for(let i=0;i<count;i++)if(!indices.has(i))assess(i);
  return best;
 }
 function groundHeight(x,z){const p=nearest(x,z);if(data.bridge&&p.s/length>data.bridge[0]-.015&&p.s/length<data.bridge[1]+.015&&p.distance<data.width/2+25)return p.y-12;if(p.distance<data.width/2+7)return p.y+Math.tan(p.bank)*p.offset-.20;const inland=4+(p.y-4)*Math.exp(-Math.max(0,p.distance-10)/42);if(data.environment==='coast'){const cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2,r=Math.hypot((x-cx)/((bounds.maxX-bounds.minX)*.64),(z-cz)/((bounds.maxZ-bounds.minZ)*.64));return Math.max(-7,inland-Math.max(0,r-.85)*70)-.2;}return inland-.3;}
 const track={...data,samples,pointAt,nearest,groundHeight,bounds,ROAD_WIDTH:data.width,TRACK_LENGTH:length,gateCount:data.legacy?8:Math.max(16,Math.ceil(length/110)),lengthMeters:Math.round(length)};cache.set(data.id,track);return track;
}
function controlLength(data){return data.points.length;}
const original=getTrack();
export const samples=original.samples,TRACK_LENGTH=original.TRACK_LENGTH,ROAD_WIDTH=original.ROAD_WIDTH;
export const pointAt=original.pointAt,nearest=original.nearest,groundHeight=original.groundHeight;
