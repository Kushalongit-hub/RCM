import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {vehicleSpec} from './vehicle-catalog.js';
const palette={white:'#f2f0e9',whiteAccent:'#f2f0e9',red:'#eb2c26',black:'#202228',rubber:'#35363b',glass:'#30363b',metal:'#474b52',lamp:'#e4f7ff',tail:'#ff2e30'};
const mats=Object.fromEntries(Object.entries(palette).map(([key,color])=>[key,new THREE.MeshStandardMaterial({name:key,color,vertexColors:true,flatShading:true,roughness:key==='glass'?.3:.72,metalness:key==='metal'?.5:.06,...(key==='lamp'||key==='tail'?{emissive:color,emissiveIntensity:.7}:{})})]));
const cache=new Map();
function add(parent,geometry,mat,name){geometry.normalizeNormals();if(!geometry.attributes.color){const colors=new Float32Array(geometry.attributes.position.count*3);colors.fill(1);geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));}const m=new THREE.Mesh(geometry,mats[mat]||mat);m.name=name||mat;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
// Actual triangulated, flat-shaded panels. Reverse winding is handled explicitly for mirrored panels.
function panel(parent,points,mat='white',name='BodyPanel'){
  const pos=[];for(let i=1;i<points.length-1;i++)pos.push(...points[0],...points[i],...points[i+1]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  const colors=[];for(let i=0;i<pos.length;i+=9){const shade=.89+((Math.abs(Math.sin(pos[i]*7+pos[i+2]*13+i*.3))*100)%13)/100;for(let v=0;v<3;v++)colors.push(shade,shade,shade);}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  // Panels represent thin fabricated sheet metal; both faces are visible in wheel wells and intakes.
  const material=mats[mat].clone();material.side=THREE.DoubleSide;
  const result=add(parent,g,material,name);return result;
}
// Cross sections run rear -> front, each section [z, half-width, bottom, shoulder, crown].
function hull(parent,sections,mat='white',name='SculptedBody'){
  const rings=sections.map(([z,w,b,s,t])=>[[-w*.83,b,z],[-w,b+.06,z],[-w,s*.76+b*.24,z],[-w*.86,s,z],[-w*.54,t-.012,z],[0,t,z],[w*.54,t-.012,z],[w*.86,s,z],[w,s*.76+b*.24,z],[w,b+.06,z],[w*.83,b,z]]);
  for(let r=0;r<rings.length-1;r++)for(let j=0;j<rings[0].length;j++){const k=(j+1)%rings[0].length;panel(parent,[rings[r][j],rings[r+1][j],rings[r+1][k],rings[r][k]],mat,name);}
  panel(parent,[...rings[0]].reverse(),mat,name);panel(parent,rings.at(-1),mat,name);
}
function block(parent,mat,x,y,z,w,h,l,name){const m=add(parent,new THREE.BoxGeometry(w,h,l),mat,name);m.position.set(x,y,z);return m;}
function rod(parent,a,b,r=.035,mat='black',name='SuspensionArm'){
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);
  const m=add(parent,new THREE.CylinderGeometry(r,r,d.length(),6),mat,name);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;
}
function stripe(parent,sections,width=.22,mat='red'){
  for(let i=0;i<sections.length-1;i++){const [z0,y0]=sections[i],[z1,y1]=sections[i+1];panel(parent,[[-width,y0+.008,z0],[width,y0+.008,z0],[width,y1+.008,z1],[-width,y1+.008,z1]],mat,'RacingStripe');}
}
function wing(parent,z,y,width=3,height=.7,end=.32){
  for(const x of [-width*.32,width*.32])block(parent,'black',x,y-height*.5,z,.07,height,.2,'WingMount');
  hull(parent,[[z-.35,width*.5,y-.06,y,y+.04],[z+.35,width*.5,y-.06,y+.07,y+.09]],'black','WingAirfoil');
  for(const s of [-1,1])panel(parent,[[s*width*.5,y-end,z+.37],[s*width*.5,y+end,z+.37],[s*width*.5,y+end+.035,z-.4],[s*width*.5,y-end,z-.4]],'red','WingEndplate');
  panel(parent,[[.45,y+.09,z+.35],[.72,y+.09,z+.35],[1.12,y+.05,z-.35],[.85,y+.05,z-.35]],'whiteAccent','WingWhiteSlash');
  panel(parent,[[.75,y+.093,z+.35],[.97,y+.093,z+.35],[1.37,y+.053,z-.35],[1.15,y+.053,z-.35]],'red','WingRedSlash');
}
// Editable angular outline glyphs, modelled as geometry rather than font/image decals.
const glyphs={
  '2':[[0,1],[.67,1],[.85,.83],[.85,.64],[.25,.18],[.85,.18],[.85,0],[0,0],[0,.22],[.64,.71],[.64,.81],[0,.81]],
  '7':[[0,1],[.87,1],[.87,.8],[.31,0],[.06,0],[.62,.8],[0,.8]],
  '3':[[0,1],[.68,1],[.86,.83],[.86,.6],[.73,.51],[.86,.4],[.86,.16],[.69,0],[0,0],[0,.19],[.62,.19],[.65,.24],[.65,.39],[.57,.43],[.2,.43],[.2,.61],[.58,.61],[.65,.67],[.65,.78],[.6,.81],[0,.81]],
  '4':[[.48,1],[.72,1],[.72,.39],[.9,.39],[.9,.2],[.72,.2],[.72,0],[.5,0],[.5,.2],[0,.2],[0,.4]]
};
function number(parent,value,position,rotation=[0,0,0],size=.09){
  const g=new THREE.Group();g.name='RaceNumber';g.position.set(...position);g.rotation.set(...rotation);parent.add(g);
  const text=String(value),height=size*5;
  [...text].forEach((c,i)=>{const shape=new THREE.Shape(glyphs[c].map(([x,y])=>new THREE.Vector2((x+y*.15+i*1.04-text.length*.52)*height,(y-.5)*height)));if(c==='4'){const hole=new THREE.Path([[.23,.39],[.5,.39],[.5,.77]].map(([x,y])=>new THREE.Vector2((x+y*.15+i*1.04-text.length*.52)*height,(y-.5)*height)));shape.holes.push(hole);}const mesh=add(g,new THREE.ShapeGeometry(shape),'black','Number_'+c);mesh.material=mats.black.clone();mesh.material.side=THREE.DoubleSide;});return g;
}
function formula(body){
  hull(body,[[-2.5,.6,.22,.43,.5],[-1.1,.68,.24,.7,.85],[.5,.55,.26,.92,1.03],[1.45,.38,.24,.75,.83],[2.9,.21,.22,.36,.43]],'white','MonocoqueAndNose');
  stripe(body,[[-1.1,.85],[.5,1.03],[1.45,.83],[2.9,.43]],.13);
  // Twin vented sidepods with hollow black mouths and tapered engine-cover shoulders.
  for(const s of [-1,1]){
    const pod=new THREE.Group();pod.position.x=s*.85;body.add(pod);
    hull(pod,[[-2.05,.22,.3,.57,.69],[-1.1,.53,.29,.97,1.08],[.68,.52,.29,.93,1.02]],'white','Sidepod');
    panel(body,[[s*.66,.3,.7],[s*1.38,.3,.7],[s*1.33,.89,.7],[s*.66,.88,.7]],'black','SidepodIntake');
    panel(body,[[s*.68,.89,.72],[s*1.35,.9,.72],[s*1.35,1.03,.72],[s*.68,1.05,.72]],'white','IntakeLip');
    panel(body,[[s*1.39,.43,.55],[s*1.39,.92,.55],[s*1.39,.73,-.65],[s*.99,.5,-1.85]],'red','SidepodRedSlash');
    block(body,'black',s*1.04,.2,-.65,.75,.08,3.4,'FloorEdge');
    for(const z of [-1.6,1.65])for(const y of [.38,.69])for(const dz of [-.45,.45])rod(body,[s*.48,y,z+dz],[s*1.38,.59,z],.032);
    rod(body,[s*.57,.99,.5],[s*.94,1.22,.83],.033,'black','MirrorStalk');block(body,'red',s*1.03,1.27,.85,.42,.19,.22,'Mirror');
  }
  // Layered front wing sits around the nose, not on top of the tyres.
  for(let layer=0;layer<3;layer++){
    const z=2.35+layer*.22,y=.19+layer*.095;
    hull(body,[[z-.13,.6,y-.04,y,y+.03],[z+.15,.65,y-.04,y+.035,y+.06]],layer===1?'red':'black','FrontWingFlap');
    // Spanwise sections connect both sides of the raised centre nose.
    for(const s of [-1,1])panel(body,[[s*.32,y,z-.13],[s*1.65,y+.04,z-.13],[s*1.65,y+.09,z+.15],[s*.32,y+.04,z+.15]],layer===1?'red':'black','FrontWingOuterFlap');
  }
  for(const s of [-1,1]){panel(body,[[s*1.68,.13,2.05],[s*1.68,.8,2.18],[s*1.68,.64,3.02],[s*1.68,.1,3.05]],'red','FrontWingEndplate');panel(body,[[s*.72,.31,2.25],[s*.98,.34,2.25],[s*1.36,.42,2.95],[s*1.12,.41,2.95]],'whiteAccent','WingLivery');}
  hull(body,[[-1.9,.18,.66,1.05,1.28],[-1.05,.4,.7,1.35,1.88],[-.48,.29,.7,1.35,1.62]],'white','EngineCover');
  for(const side of [-1,1])panel(body,[[0,1.88,-1.05],[side*.33,1.35,-.48],[side*.22,1.03,-1.85]],'red','EngineRed');
  hull(body,[[-.78,.31,1.41,1.76,1.85],[-.42,.24,1.43,1.75,1.8]],'red','Airbox');
  panel(body,[[-.19,1.46,-.41],[.19,1.46,-.41],[.2,1.73,-.41],[-.2,1.73,-.41]],'black','AirIntake');
  block(body,'black',0,1.97,-.89,.69,.09,.28,'CameraPod');rod(body,[0,1.8,-.89],[0,1.97,-.89],.05);
  hull(body,[[-.35,.4,.93,1.08,1.12],[.4,.38,.93,1.08,1.12]],'black','CockpitRecess');
  block(body,'black',0,1.12,-.18,.45,.28,.29,'SeatBack');
  const haloPoints=[[-.4,1.17,-.28],[-.49,1.48,.03],[-.39,1.53,.48],[0,1.54,.63],[.39,1.53,.48],[.49,1.48,.03],[.4,1.17,-.28]];
  for(let i=0;i<haloPoints.length-1;i++)rod(body,haloPoints[i],haloPoints[i+1],.055,'black','Halo');rod(body,[0,1.54,.63],[0,1.01,.88],.045,'black','HaloFrontSupport');
  wing(body,-2.3,1.78,2.95,1.12);number(body,27,[0,.776,1.68],[-1.28,0,0],.085);
}

function mirrors(body,z,y,width){for(const side of [-1,1]){rod(body,[side*(width-.35),y-.15,z-.1],[side*width,y,z],.035,'black','MirrorStalk');hullAt(body,[[z-.13,.18,y-.1,y+.06,y+.1],[z+.13,.2,y-.08,y+.07,y+.1]],side*width,'red','RacingMirror');}}
function hullAt(body,sections,x,mat,name){const g=new THREE.Group();g.position.x=x;body.add(g);hull(g,sections,mat,name);return g;}
// Body profiles: z, fraction of full half-width, centreline height, shoulder height.
const designs={
  drift:{roof:1.73,front:.66,rear:-1.88,rf:-.10,rr:-1.02,cabinWidth:.84,wing:1.76,profile:[[-2.70,.88,.90,.83],[-2.1,.97,1.02,.96],[-1.58,1,1.07,1.02],[-.6,.91,1.05,.97],[.5,.90,1.02,.94],[1.66,1,.99,.98],[2.35,.96,.89,.85],[2.78,.88,.77,.75]]},
  gt3:{roof:1.58,front:.98,rear:-1.96,rf:.20,rr:-.91,cabinWidth:.83,wing:1.69,profile:[[-2.78,.87,.83,.85],[-2.14,.98,.96,.98],[-1.64,1,1.02,1.02],[-.6,.89,1.02,.94],[.7,.86,.98,.92],[1.73,1,.94,.96],[2.35,.96,.83,.85],[2.86,.86,.80,.80]]},
  stock:{roof:1.78,front:.83,rear:-2.04,rf:.02,rr:-1.10,cabinWidth:.89,wing:1.23,profile:[[-2.8,.90,.96,.91],[-2.15,.99,1.05,1.01],[-1.66,1,1.10,1.04],[-.6,.96,1.08,1.00],[.70,.96,1.02,.97],[1.72,1,1.00,.98],[2.45,.97,.93,.87],[2.87,.90,.83,.79]]},
  wedge:{roof:1.43,front:1.18,rear:-1.83,rf:.26,rr:-.85,cabinWidth:.80,wing:1.48,profile:[[-2.73,.91,.91,.89],[-2.05,1,1.06,1.01],[-1.64,1,1.07,1.03],[-.6,.85,.99,.85],[.8,.84,.86,.82],[1.68,1,.78,.91],[2.36,.92,.65,.71],[2.80,.80,.49,.59]]},
  hyper:{roof:1.51,front:1.20,rear:-1.77,rf:.24,rr:-.85,cabinWidth:.67,wing:1.67,profile:[[-2.85,.89,.90,.87],[-2.1,.99,1.08,1.02],[-1.68,1,1.10,1.03],[-.6,.78,1.03,.88],[.7,.76,.89,.80],[1.74,1,.81,.94],[2.40,.89,.62,.74],[2.90,.68,.46,.60]]},
  tourer:{roof:1.51,front:.55,rear:-2.02,rf:-.20,rr:-1.09,cabinWidth:.84,wing:1.38,profile:[[-2.75,.87,.86,.88],[-2.1,.97,1.00,.99],[-1.61,1,1.05,1.03],[-.5,.90,1.03,.95],[.55,.91,.98,.90],[1.68,1,.91,.97],[2.32,.95,.77,.82],[2.80,.84,.61,.68]]}
};
function sampleProfile(profile,z){
  let i=0;while(i<profile.length-2&&z>profile[i+1][0])i++;
  const a=profile[i],b=profile[i+1],t=THREE.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1),prev=profile[Math.max(0,i-1)],next=profile[Math.min(profile.length-1,i+2)];
  return a.map((v,j)=>j===0?z:THREE.MathUtils.clamp(.5*((2*v)+(-prev[j]+b[j])*t+(2*prev[j]-5*v+4*b[j]-next[j])*t*t+(-prev[j]+3*v-3*b[j]+next[j])*t*t*t),Math.min(v,b[j]),Math.max(v,b[j])));
}
function archCut(spec,z){
  let y=.23;const r=spec.radius+.045;
  for(const axle of spec.axles){const d=Math.abs(z-axle);if(d<r)y=Math.max(y,spec.radius+Math.sqrt(r*r-d*d));else if(d<r+.09)y=Math.max(y,THREE.MathUtils.lerp(spec.radius,.23,(d-r)/.09));}
  return y;
}
function bodySurface(spec,design,x,z){
  const [,w,h,shoulder]=sampleProfile(design.profile,z),width=w*spec.width/2,u=Math.min(1,Math.abs(x)/width),edge=Math.max(shoulder,archCut(spec,z)+.06);
  // Crown, hood crease and swollen fender are separate landmarks in each cross section.
  const y=u<.65?h-.04*(u/.65)**2:THREE.MathUtils.lerp(h-.04,edge,Math.sin((u-.65)/.35*Math.PI/2));
  return [x,y,z];
}
function paint(id,x,z){
  const a=Math.abs(x);
  if(id==='drift'&&z>.65&&z<1.98&&a<.65)return 'black';
  if(id==='tourer'&&z>.5&&z<2.22&&a<.63)return a<.18?'red':'black';
  if(id==='gt3'&&z>1.61&&z<2.28&&a<.53)return 'white';
  if(a<.18)return 'red';
  return 'white';
}
function skin(body,spec,design){
  const lo=design.profile[0][0],hi=design.profile.at(-1)[0],rows=48,us=[-1,-.92,-.78,-.65,-.45,-.18/.5/(spec.width),0,.18/.5/spec.width,.45,.65,.78,.92,1];
  for(let i=0;i<rows;i++){
    const z0=THREE.MathUtils.lerp(lo,hi,i/rows),z1=THREE.MathUtils.lerp(lo,hi,(i+1)/rows),w0=sampleProfile(design.profile,z0)[1]*spec.width/2,w1=sampleProfile(design.profile,z1)[1]*spec.width/2;
    for(let j=0;j<us.length-1;j++){
      const mid=(us[j]+us[j+1])*(w0+w1)/4,z=(z0+z1)/2;
      panel(body,[bodySurface(spec,design,us[j]*w0,z0),bodySurface(spec,design,us[j]*w1,z1),bodySurface(spec,design,us[j+1]*w1,z1),bodySurface(spec,design,us[j+1]*w0,z0)],paint(spec.id,mid,z),'ContouredBonnetAndFenders');
    }
    for(const side of [-1,1]){
      const top0=bodySurface(spec,design,side*w0,z0),top1=bodySurface(spec,design,side*w1,z1),low0=archCut(spec,z0),low1=archCut(spec,z1);
      const mid0=[side*w0*.99,THREE.MathUtils.lerp(low0,top0[1],.52),z0],mid1=[side*w1*.99,THREE.MathUtils.lerp(low1,top1[1],.52),z1];
      panel(body,[top0,top1,mid1,mid0],'white','ShoulderBeltline');
      panel(body,[mid0,mid1,[side*w1*.95,low1,z1],[side*w0*.95,low0,z0]],z0<-.5?'red':'white','ContouredLowerSide');
    }
  }
  // Conservative black undertray; the visible body above it is shaped around actual wheel openings.
  hull(body,[[lo,.75,.18,.20,.22],[0,spec.width*.39,.18,.20,.22],[hi,.75,.18,.20,.22]],'black','Undertray');
  for(const side of [-1,1])for(const axle of spec.axles){const radius=spec.radius+.045;for(let i=0;i<16;i++){
    const a=-.52+i*(Math.PI+1.04)/16,b=-.52+(i+1)*(Math.PI+1.04)/16;
    const at=(t,r,offset=0)=>{const z=axle+Math.cos(t)*r,w=sampleProfile(design.profile,z)[1]*spec.width/2;return [side*(w+.007+offset),spec.radius+Math.sin(t)*r,z];};
    panel(body,[at(a,radius),at(b,radius),at(b,radius+.045),at(a,radius+.045)],'white','FlushArchLip');
    panel(body,[at(a,radius,-.005),at(b,radius,-.005),at(b,radius,-.16),at(a,radius,-.16)],'black','WheelWellLiner');
  }}
}
function curvedCabin(body,{front,rear,rf,rr,cabinWidth:width,roof:height},base=.95){
  const stations=[[rear,.70,base+.025],[rr-.33,.91,height-.15],[rr,1,height-.025],[(rr+rf)/2,1.02,height],[rf,.98,height-.035],[rf+(front-rf)*.42,.99,base+(height-base)*.60],[front,.95,base+.025]];
  const rings=stations.map(([z,w,y])=>{const r=width*w;return [[-r,base,z],[-r*.96,y-.14,z],[-r*.82,y-.035,z],[-r*.47,y+.005,z],[0,y+.022,z],[r*.47,y+.005,z],[r*.82,y-.035,z],[r*.96,y-.14,z],[r,base,z]];});
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<8;j++){
    const z=(stations[i][0]+stations[i+1][0])/2,roof=z>=rr-.05&&z<=rf+.015;
    const red=(j===3||j===4)&&roof,mat=roof&&j>=2&&j<=5?(red?'red':'white'):'glass';
    panel(body,[rings[i][j],rings[i+1][j],rings[i+1][j+1],rings[i][j+1]],mat,'CurvedCabin');
  }
  for(const side of [-1,1]){
    rod(body,[side*width*.95,base+.02,front],[side*width*.98*.82,height-.07,rf],.033,'white','SlopedAPillar');
    rod(body,[side*width*.82,height-.06,rr],[side*width*.7,base+.03,rear],.06,'white','SweptCPillar');
    rod(body,[side*width*.82,height-.055,rf],[side*width*.82,height-.045,rr],.035,'white','CurvedRoofRail');
    rod(body,[side*width,base+.015,front],[side*width*.7,base+.015,rear],.025,'black','WindowSill');
  }
}
function recess(body,points,depth=.18){
  const back=points.map(([x,y,z])=>[x,y,z-depth]);panel(body,back,'black','RecessedIntakeBack');
  for(let i=0;i<points.length;i++){const j=(i+1)%points.length;panel(body,[points[i],points[j],back[j],back[i]],'black','IntakeInnerWall');}
}
function face(body,spec,design){
  const z=design.profile.at(-1)[0]+.025,w=spec.width/2,low=spec.id==='wedge'||spec.id==='hyper'||spec.id==='tourer',stock=spec.id==='stock',drift=spec.id==='drift';
  const centre=spec.id==='hyper'?.35:spec.id==='tourer'?.76:low?.52:.63,top=stock?.79:drift?.73:low?.57:.67;
  recess(body,[[-centre,.25,z],[centre,.25,z],[centre*.94,top,z],[-centre*.94,top,z]],.24);
  for(const side of [-1,1]){
    recess(body,[[side*.79,.25,z],[side*(w-.08),.29,z-.04],[side*(w-.10),.72,z-.09],[side*.85,.68,z]],.20);
    panel(body,[[side*(low?.29:.68),.23,z+.02],[side*(low?.47:.79),.23,z+.02],[side*.88,low?.69:.75,z-.02],[side*.74,low?.73:.78,z-.02]],'white','SculptedBumperBridge');
    panel(body,[[side*(w-.08),.25,z-.04],[side*(w+.015),.23,z-.05],[side*(w-.025),.79,z-.13],[side*(w-.10),.72,z-.09]],'white','WrappedBumperCorner');
    panel(body,[[side*.84,.25,z+.03],[side*.98,.28,z+.01],[side*(w-.12),.65,z-.05],[side*(w-.20),.69,z-.04]],'red','IntakeDiagonalBlade');
    // Project each lamp corner onto the new fender, keeping it above the body surface.
    const lamp=(x,dz,lift=.018)=>{const p=bodySurface(spec,design,side*x,z-dz);p[1]+=lift;return p;};
    panel(body,[lamp(.72,.13),lamp(w-.15,.41),lamp(w-.15,.55),lamp(.72,.26)],'black','LampHousing');
    for(let i=0;i<(spec.id==='hyper'?3:1);i++)panel(body,[lamp(.76,.17+i*.035,.029),lamp(w-.18,.44+i*.027,.029),lamp(w-.18,.47+i*.027,.029),lamp(.76,.20+i*.035,.029)],'lamp','SweptLED');

  }
  panel(body,[[-.73,top+.025,z+.005],[.73,top+.025,z+.005],[.70,design.profile.at(-1)[2]+.01,z-.08],[-.70,design.profile.at(-1)[2]+.01,z-.08]],'white','NoseBumperLip');
  if(spec.id==='hyper')panel(body,[[0,.25,z+.03],[-.19,.63,z+.02],[.19,.63,z+.02]],'white','PointedNoseKeel');
  if(drift||stock)for(let i=0;i<4;i++)block(body,'metal',0,.32+i*.095,z-.025,centre*1.8,.018,.04,'GrilleSlat');
}
function aeroFloor(body,z,width){
  hull(body,[[z-.45,width*.92,.14,.17,.19],[z+.09,width,.14,.17,.19]],'black','ProfiledSplitter');
  for(const side of [-1,1])panel(body,[[side*width,.17,z+.06],[side*width,.45,z-.34],[side*width,.17,z-.43]],'red','LowCanard');
}
function backEnd(body,spec,y=.82){
  const z=-spec.length*.47,w=spec.width*.43;
  panel(body,[[-w,.22,z],[w,.22,z],[w,y,z],[-w,y,z]],'black','RearValance');
  for(const side of [-1,1]){block(body,'tail',side*w*.68,y-.02,z-.012,w*.45,.045,.04,'TailLamp');rod(body,[side*.47,.39,z],[side*.47,.39,z-.13],.065,'metal','Exhaust');}
  for(let i=-3;i<=3;i++)panel(body,[[i*.25,.18,z-.22],[i*.25,.37,z+.18],[i*.25,.18,z+.23]],'black','DiffuserFin');
}
function sideLivery(body,spec,design){
  for(const side of [-1,1]){
    const at=(z,y,offset=.016)=>[side*(sampleProfile(design.profile,z)[1]*spec.width/2+offset),y,z];
    panel(body,[at(-.65,.28),at(-.42,.91),at(.66,.88),at(.02,.55)],'red','SideDiagonalLivery');
    panel(body,[at(-.64,.28),at(.02,.55),at(.74,.34)],'black','LowerSideSlash');
    if(['wedge','hyper','tourer','gt3'].includes(spec.id)){
      const from=spec.id==='tourer'?-.86:-1.12,to=spec.id==='tourer'?-.08:-.35;
      const pts=[at(from,.34,.022),at(from,1.0,.022),at(to,.89,.022),at(to,.40,.022)];
      panel(body,pts,'black','SideInlet');panel(body,[at(from-.08,.29,.027),at(from-.08,1.04,.027),at(from+.09,.91,.027),at(from+.09,.36,.027)],'red','IntakeSurround');
    }
    if(['drift','gt3','stock'].includes(spec.id))number(body,spec.number,at(0,.81,.022),[0,side*Math.PI/2,0],.094);
  }
}
function coupe(body,id){roadCar(body,id);}
function supercar(body,id){roadCar(body,id);}
function roadCar(body,id){
  const spec=vehicleSpec(id),d=designs[id];skin(body,spec,d);curvedCabin(body,d,id==='stock'?1.02:id==='drift'?1.0:.91);face(body,spec,d);aeroFloor(body,d.profile.at(-1)[0]+.03,spec.width/2+.025);sideLivery(body,spec,d);
  mirrors(body,d.front-.18,id==='stock'?1.24:1.13,spec.width/2-.15);
  wing(body,-spec.length*.415,d.wing,spec.width*.91,id==='stock'?.20:.60,id==='stock'?.10:.18);backEnd(body,spec);
  if(id!=='stock')for(const side of [-1,1]){
    const patch=[[side*.46,1.20],[side*.72,1.32],[side*.73,1.72],[side*.52,1.65]].map(([x,z])=>{const p=bodySurface(spec,d,x,z);p[1]+=.014;return p;});panel(body,patch,'black','SculptedHoodVent');
  }
  if(id==='gt3'){const p=bodySurface(spec,d,0,2.12);number(body,27,[p[0],p[1]+.012,p[2]],[-1.33,0,0],.095);}
  if(id==='drift')for(const side of [-1,1])for(const axle of spec.axles)for(let i=0;i<7;i++){const a=i*Math.PI/6,z=axle+Math.cos(a)*(spec.radius+.075),bolt=add(body,new THREE.SphereGeometry(.014,4,3),'metal','WidebodyRivet');bolt.position.set(side*(sampleProfile(d.profile,z)[1]*spec.width/2+.016),spec.radius+Math.sin(a)*(spec.radius+.075),z);}
  if(id==='stock'){
    for(const x of [-.43,0,.43])rod(body,[x,1.055,d.front],[x,d.roof-.045,d.rf],.020,'black','WindscreenBrace');
    number(body,42,[0,d.roof+.026,-.52],[-Math.PI/2,0,0],.12);
    for(const side of [-1,1]){for(let i=0;i<7;i++){const z=-1.05+i*.19;rod(body,[side*.86,1.05,z],[side*.72,1.65,z-.08],.013,'black','WindowNet');}for(let i=0;i<5;i++){const y=1.06+i*.13;rod(body,[side*(.86-(y-1.06)*.21),y,-1.10],[side*(.86-(y-1.06)*.21),y,.20],.013,'black','WindowNet');}}
  }
  if(id==='hyper'){
    for(const side of [-1,1]){panel(body,[[side*.55,1.44,-.80],[side*1.07,1.06,-1.83],[side*.88,.99,-1.83]],'white','FlyingButtress');panel(body,[[side*.60,1.37,-.88],[side*1.02,1.05,-1.77],[side*.75,1.0,-1.55]],'black','ButtressChannel');}
    hull(body,[[-1.12,.18,1.42,1.53,1.58],[-.70,.18,1.45,1.56,1.61]],'red','RoofScoop');
  }
}
function endurance(body){
  const spec=vehicleSpec('endurance'),d={roof:1.62,front:1.00,rear:-1.86,rf:.06,rr:-.93,cabinWidth:.59};
  hull(body,[[-2.78,.55,.19,.62,.82],[-1.7,.68,.20,.89,1.0],[-.6,.57,.21,.91,.98],[.7,.43,.20,.77,.85],[1.8,.33,.19,.48,.61],[2.89,.22,.17,.28,.37]],'white','PrototypeSpine');
  stripe(body,[[-.6,.98],[.7,.85],[1.8,.61],[2.89,.37]],.14);
  for(const side of [-1,1]){
    const pontoon=[[-2.78,.22,.83],[-2.2,.27,1.02],[-1.68,.29,1.14],[-.8,.23,.86],[.15,.17,.74],[1.1,.27,1.09],[1.72,.30,1.17],[2.42,.27,.97],[2.85,.24,.80]];
    const section=z=>{const [,w,h]=sampleProfile(pontoon,z),cut=archCut(spec,z),top=Math.max(h,cut+.09);return [[side*(1.06+w),cut,z],[side*(1.06+w),Math.max(top-.10,cut+.045),z],[side*1.06,top,z],[side*(1.06-w),top-.10,z],[side*(1.06-w),.23,z]];};
    for(let row=0;row<48;row++){const a=section(THREE.MathUtils.lerp(-2.78,2.85,row/48)),b=section(THREE.MathUtils.lerp(-2.78,2.85,(row+1)/48));for(let j=0;j<4;j++)panel(body,[a[j],b[j],b[j+1],a[j+1]],'white','SculptedPrototypePontoon');}

    for(const axle of spec.axles){for(let i=0;i<12;i++){const a=-.3+i*(Math.PI+.6)/12,b=-.3+(i+1)*(Math.PI+.6)/12,at=(t,r)=>[side*1.343,spec.radius+Math.sin(t)*r,axle+Math.cos(t)*r];panel(body,[at(a,.60),at(b,.60),at(b,.65),at(a,.65)],'white','PrototypeArch');}}
    recess(body,[[side*.85,.28,2.88],[side*1.29,.28,2.88],[side*1.29,.75,2.81],[side*.85,.80,2.81]],.14);
    for(let i=0;i<3;i++)block(body,'lamp',side*1.07,.40+i*.13,2.89,.34,.035,.025,'EnduranceLED');
    panel(body,[[side*.63,.29,.77],[side*.91,.29,.77],[side*.91,.73,.44],[side*.63,.79,.44]],'black','FlowChannel');
    panel(body,[[side*1.35,.31,-1.00],[side*1.35,.96,-1.32],[side*1.35,.69,-.08]],'red','PrototypeSideSlash');
    hullAt(body,[[-2.75,.18,.15,.18,.21],[2.85,.16,.15,.18,.21]],side*1.12,'black','PrototypeFloor');
  }
  curvedCabin(body,d,.85);hull(body,[[-.76,.20,1.56,1.69,1.73],[-.28,.19,1.57,1.68,1.72]],'red','RoofScoop');panel(body,[[-.16,1.59,-.27],[.16,1.59,-.27],[.16,1.68,-.27],[-.16,1.68,-.27]],'black','RoofIntake');
  rod(body,[0,1.72,-.62],[0,1.98,-.62],.013,'black','Antenna');wing(body,-2.38,1.81,2.63,.91,.23);aeroFloor(body,2.89,1.36);mirrors(body,.64,1.12,1.13);number(body,27,[0,.63,1.74],[-1.32,0,0],.082);backEnd(body,spec,.73);
}

function wheel(root,spec,x,z,index){
  const front=z>0,r=front?spec.radius:(spec.rearRadius||spec.radius),side=Math.sign(x),w=spec.tireWidth;
  const pivot=new THREE.Group();pivot.name=(front?'Front':'Rear')+(x<0?'Left':'Right')+'WheelPivot';pivot.position.set(x,r,z);root.add(pivot);
  const spin=new THREE.Group();spin.name=pivot.name.replace('Pivot','Mesh');pivot.add(spin);
  const tire=add(spin,new THREE.LatheGeometry([[r*.78,-w/2],[r*.95,-w*.43],[r,-w*.28],[r,w*.28],[r*.95,w*.43],[r*.78,w/2]].map(([x,y])=>new THREE.Vector2(x,y)),16),'rubber','FacetedTire');tire.rotation.z=Math.PI/2;
  for(const sign of [-1,1]){
    const disc=add(spin,new THREE.CylinderGeometry(r*.80,r*.80,.025,16),'black','RimBarrel');disc.rotation.z=Math.PI/2;disc.position.x=sign*(w/2+.007);
    const ring=add(spin,new THREE.TorusGeometry(r*.86,.04,4,16),'red','RedRimRing');ring.rotation.y=Math.PI/2;ring.position.x=sign*(w/2+.025);
    const hub=add(spin,new THREE.CylinderGeometry(r*.13,r*.13,.06,8),'red','CentreLock');hub.rotation.z=Math.PI/2;hub.position.x=sign*(w/2+.035);
    for(let i=0;i<8;i++){const a=i*Math.PI/4,spoke=block(spin,'metal',sign*(w/2+.028),Math.sin(a)*r*.39,Math.cos(a)*r*.39,.04,.065,r*.56,'RimSpoke');spoke.rotation.x=-a;}
  }
  mergeBody(spin);
  return {pivot,spin,front,radius:r};
}
function mergeBody(body){
  body.updateWorldMatrix(true,true);const inverse=body.matrixWorld.clone().invert(),groups=new Map();
  body.traverse(m=>{if(!m.isMesh)return;const key=m.material.name+':'+m.material.side;let entry=groups.get(key);if(!entry){entry={material:m.material,geometries:[]};groups.set(key,entry);}const geo=m.geometry.clone();geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,m.matrixWorld));entry.geometries.push(geo.toNonIndexed?geo.index?geo.toNonIndexed():geo:geo);});
  body.clear();for(const [key,{material,geometries}]of groups){const geometry=mergeGeometries(geometries.map(g=>{g.deleteAttribute('uv');return g;}));add(body,geometry,material,key);geometries.forEach(g=>g.dispose());}
}
export function createVehicle(id='formula',paintColor='#FFFFFF'){
  const spec=vehicleSpec(id);id=spec.id;
  if(!cache.has(id)){
    const root=new THREE.Group();root.name='VehicleRoot_'+id;root.userData.vehicleId=id;
    const body=new THREE.Group();body.name='VisualBody';root.add(body);
    if(id==='formula'){formula(body);body.scale.set(.88,1,1.08);}else if(id==='endurance')endurance(body);else if(['drift','gt3','stock'].includes(id))coupe(body,id);else supercar(body,id);
    const wheels=[];for(const x of [-spec.track,spec.track])for(const z of spec.axles)wheels.push(wheel(root,spec,x,z));
    mergeBody(body);
    const collider=new THREE.Object3D();collider.name='CollisionGeometry';collider.userData={shape:'oriented-box',halfExtents:[spec.width*.43,.8,spec.length*.44],center:[0,.8,0]};root.add(collider);
    for(const [name,p]of Object.entries({CenterOfMassReference:[0,spec.centerOfMass,-.1],CameraAnchor:[0,3.6,-9],EffectsAnchors:[0,.5,-spec.length/2]})){const anchor=new THREE.Object3D();anchor.name=name;anchor.position.set(...p);root.add(anchor);}
    root.userData.spec=spec;cache.set(id,root);
  }
  const root=cache.get(id).clone(true);root.userData.body=root.getObjectByName('VisualBody');root.userData.wheels=[];
  for(const x of [-spec.track,spec.track])for(const z of spec.axles){const front=z>0,pivot=root.getObjectByName((front?'Front':'Rear')+(x<0?'Left':'Right')+'WheelPivot');root.userData.wheels.push({pivot,spin:pivot.children[0],front,radius:front?spec.radius:(spec.rearRadius||spec.radius)});}
  applyPaint(root,paintColor);return root;
}
export function applyPaint(root,color){
  if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))color='#FFFFFF';color=color.toUpperCase();if(root.userData.paintColor===color)return;
  root.traverse(m=>{if(!m.isMesh||m.material.name!=='white')return;if(!m.userData.ownPaint){m.material=m.material.clone();m.userData.ownPaint=true;}m.material.color.set(color);});root.userData.paintColor=color;
}
export function animateVehicle(root,steering,speed,dt){
  for(const w of root.userData.wheels){w.pivot.rotation.y=w.front?steering*.42:0;w.spin.rotation.x+=speed*dt/w.radius;}
}
export function triangleCount(root){let count=0;root.traverse(m=>{if(m.isMesh)count+=(m.geometry.index?.count||m.geometry.attributes.position.count)/3;});return count;}
