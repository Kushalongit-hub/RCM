import {createVehicle,animateVehicle,applyPaint} from '/vehicle-meshes.js';
import {VEHICLES,vehicleSpec} from '/vehicle-catalog.js';
import * as THREE from '/three.module.js';
import {getTrack} from '/track.js';
import {environmentPalette} from '/track-catalog.js';
import {ranking,paintInfo} from '/race-rules.js';
import {viewLayout,speedView} from '/controls.js';

const materials=new Map();
function material(color,extra={}){const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.83,...extra}));return materials.get(key);}
const boxGeometry=new THREE.BoxGeometry(1,1,1),sphereGeometry=new THREE.SphereGeometry(1,12,8),coneGeometry=new THREE.ConeGeometry(1,1,6),wheelGeometry=new THREE.CylinderGeometry(.57,.57,.65,18),trunkGeometry=new THREE.CylinderGeometry(.3,.55,8,6),rockGeometry=new THREE.DodecahedronGeometry(1,0);
for(const geometry of [boxGeometry,sphereGeometry,coneGeometry,wheelGeometry,trunkGeometry,rockGeometry])geometry.userData.shared=true;
function mesh(parent,geometry,mat,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(parent,color,x,y,z,sx,sy,sz){return mesh(parent,boxGeometry,material(color),x,y,z,sx,sy,sz);}
function textTexture(text,{bg='#17292c',color='#fdf4df',width=512,height=128}={}){const c=document.createElement('canvas');c.width=width;c.height=height;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,width,height);g.fillStyle=color;g.font=`900 ${height*.59}px Arial`;g.textAlign='center';g.textBaseline='middle';g.fillText(text,width/2,height*.53,width*.94);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}

export class Race3D {
  constructor(canvas,hud){
    this.track=getTrack();this.canvas=canvas;this.hud=hud;this.state={phase:'lobby',cars:[],elapsed:0};this.models=new Map();this.cameras=new Map();this.hudNodes=new Map();this.lastTime=0;this.cameraMode=0;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor('#9cccca');
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.shadowMap.autoUpdate=false;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog('#b1c5d1',220,1000);
    this.hemisphere=new THREE.HemisphereLight('#e5f4ff','#566f43',2.5);this.scene.add(this.hemisphere);
    const sun=this.sun=new THREE.DirectionalLight('#ffddb0',3);sun.position.set(-140,210,50);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-260;sun.shadow.camera.right=260;sun.shadow.camera.top=260;sun.shadow.camera.bottom=-260;sun.shadow.camera.far=650;sun.shadow.normalBias=.08;sun.shadow.bias=-.0003;this.scene.add(sun);
    this.world=new THREE.Group();this.scene.add(this.world);this.buildWorld();this.lobbyCamera=new THREE.PerspectiveCamera(55,1,.2,2500);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.resize();
    this.frame=this.frame.bind(this);requestAnimationFrame(this.frame);
  }
  resize(){const r=this.canvas.parentElement.getBoundingClientRect();this.width=Math.max(1,Math.floor(r.width));this.height=Math.max(1,Math.floor(r.height));this.renderer.setSize(this.width,this.height,false);}
  rebuildWorld(trackId){
    for(const model of this.models.values())model.removeFromParent();this.models.clear();this.cameras.clear();this.hudNodes.clear();this.hud.replaceChildren();
    const geometries=new Set(),textures=new Set();this.world.traverse(m=>{if(m.isMesh){if(!m.geometry.userData.shared)geometries.add(m.geometry);if(m.material.map)textures.add(m.material.map);}});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());this.world.removeFromParent();
    this.track=getTrack(trackId);this.world=new THREE.Group();this.scene.add(this.world);this.buildWorld();
  }
  buildWorld(){
    const t=this.track,palette=environmentPalette[t.environment]||environmentPalette.coast;
    this.scene.background=new THREE.Color(palette.sky);this.scene.fog=new THREE.Fog(palette.sky,t.night?220:400,Math.max(1800,t.TRACK_LENGTH));this.hemisphere.intensity=t.night?1.25:2.5;this.sun.intensity=t.night?.5:3;
    if(t.legacy){this.buildCoastal();return;}
    const {ROAD_WIDTH,TRACK_LENGTH,pointAt,nearest,groundHeight,bounds}=t,w=bounds.maxX-bounds.minX,d=bounds.maxZ-bounds.minZ,cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2;
    const extent=Math.max(w,d)+600;this.sun.shadow.camera.left=-extent/2;this.sun.shadow.camera.right=extent/2;this.sun.shadow.camera.top=extent/2;this.sun.shadow.camera.bottom=-extent/2;this.sun.shadow.camera.far=extent*2;this.sun.shadow.camera.updateProjectionMatrix();
    const sky=mesh(this.world,new THREE.SphereGeometry(extent*2,24,16),new THREE.MeshBasicMaterial({color:palette.sky,side:THREE.BackSide,fog:false,depthWrite:false}),cx,0,cz);sky.castShadow=false;
    if(t.environment==='coast'||t.bridge){const water=mesh(this.world,new THREE.PlaneGeometry(extent*4,extent*4),material(t.environment==='coast'?'#368fa8':'#4e8a98',{metalness:.12,roughness:.4}),cx,-1,cz);water.rotation.x=-Math.PI/2;water.castShadow=false;}
    const terrain=new THREE.PlaneGeometry(w+450,d+450,90,90);terrain.rotateX(-Math.PI/2);terrain.translate(cx,0,cz);const colors=[],positions=terrain.attributes.position;
    for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,groundHeight(x,z));const color=new THREE.Color(palette.ground).multiplyScalar(.91+(i%7)*.025);colors.push(color.r,color.g,color.b);}terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();mesh(this.world,terrain,material('#ffffff',{vertexColors:true,flatShading:true}),0,0,0).castShadow=false;
    const margin=t.wall??6;this.ribbon(-ROAD_WIDTH/2-margin+.3,ROAD_WIDTH/2+margin-.3,palette.verge,.015);this.ribbon(-ROAD_WIDTH/2,ROAD_WIDTH/2,t.environment==='dock'?'#2b343d':'#30373e',.07);
    this.ribbon(-ROAD_WIDTH/2,-ROAD_WIDTH/2+.65,palette.accent,.10,true);this.ribbon(ROAD_WIDTH/2-.65,ROAD_WIDTH/2,palette.accent,.10,true);this.rail(-1);this.rail(1);
    for(const offset of [-ROAD_WIDTH/2+1,ROAD_WIDTH/2-1])this.ribbon(offset-.055,offset+.055,'#eef1e9',.12);
    if(t.category==='Stock'||t.environment==='runway'||t.environment==='expressway')for(let s=20;s<TRACK_LENGTH;s+=32){const p=pointAt(s);const stripe=new THREE.Group();stripe.position.set(p.x,p.y+.12,p.z);stripe.rotation.set(0,p.yaw,p.bank);this.world.add(stripe);for(const x of [-ROAD_WIDTH/6,ROAD_WIDTH/6])box(stripe,'#efefdf',x,0,0,.12,.025,10);}
    const start=pointAt(0),gantry=new THREE.Group();gantry.position.set(start.x,start.y,start.z);gantry.rotation.y=start.yaw;this.world.add(gantry);
    for(const side of [-1,1])box(gantry,'#253442',side*(ROAD_WIDTH/2+2),4.4,0,.7,8.8,.7);
    mesh(gantry,new THREE.BoxGeometry(ROAD_WIDTH+5,1.7,1),new THREE.MeshStandardMaterial({map:textTexture(t.name.toUpperCase(),{bg:'#18212e',color:'#f4f4ec'}),roughness:.6}),0,8.4,0);
    this.startLightMaterial=new THREE.MeshStandardMaterial({color:'#cf293c',emissive:'#a51a2d'});
    for(let i=0;i<5;i++){box(gantry,'#151b24',(i-2)*1.4,6.4,0,1.1,1,.5);mesh(gantry,sphereGeometry,this.startLightMaterial,(i-2)*1.4,6.4,-.33,.3,.3,.12);}
    for(let row=0;row<2;row++)for(let col=0;col<Math.floor(ROAD_WIDTH);col++){const p=pointAt(row-.5,col-ROAD_WIDTH/2+.5);const check=box(this.world,(col+row)%2?'#e8ede3':'#141e27',p.x,p.y+.14,p.z,.95,.03,.95);check.rotation.set(0,p.yaw,p.bank);}
    for(let i=0;i<4;i++){const p=pointAt(TRACK_LENGTH-12-Math.floor(i/2)*7,i%2?3:-3),grid=new THREE.Group();grid.position.set(p.x,p.y+.13,p.z);grid.rotation.set(0,p.yaw,p.bank);this.world.add(grid);for(const x of [-1.7,1.7])box(grid,'#ecf0e7',x,0,0,.08,.02,5);box(grid,'#ecf0e7',0,0,2.5,3.4,.02,.08);}
    let seed=[...t.id].reduce((n,c)=>n*31+c.charCodeAt(0),51)>>>0;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const safe=(s,offset,radius=5)=>{const p=pointAt(s,offset);return nearest(p.x,p.z).distance>ROAD_WIDTH/2+margin+radius&&groundHeight(p.x,p.z)>0?p:null;};
    // Reusable environment kits are placed outside the full road and barrier corridor.
    const isCity=['city','glass','expressway'].includes(t.environment),forest=['forest','mountain','alpine','valley','park'].includes(t.environment);
    for(let i=0;i<(isCity?60:forest?100:55);i++){
      const s=rand()*TRACK_LENGTH,offset=(rand()<.5?-1:1)*(ROAD_WIDTH/2+22+rand()*65),p=safe(s,offset,isCity?9:5);if(!p)continue;const y=groundHeight(p.x,p.z);
      if(isCity){const h=14+rand()*65,building=new THREE.Group();building.position.set(p.x,y,p.z);building.rotation.y=p.yaw;this.world.add(building);box(building,t.environment==='glass'?'#749bab':rand()>.5?'#78848e':'#536475',0,h/2,0,10,h,12);box(building,'#344b5a',0,h+.5,0,11,1,13);for(let f=4;f<h;f+=6)box(building,t.night?'#74bfd2':'#a0c3d0',0,f,6.03,8,1.7,.06);}
      else if(forest){if(t.environment==='park'&&i%3===0){this.palm(p.x,y,p.z,.65+rand()*.5,rand()*6.28);continue;}const tree=new THREE.Group();tree.position.set(p.x,y,p.z);this.world.add(tree);box(tree,'#6b5743',0,2,0,.5,4,.5);for(let layer=0;layer<3;layer++)mesh(tree,coneGeometry,material(i%2?'#315e4e':'#437653',{flatShading:true}),0,4+layer*1.7,0,3.1-layer*.45,4,3.1-layer*.45);}
      else if(t.environment==='dock'){const g=new THREE.Group();g.position.set(p.x,y,p.z);g.rotation.y=p.yaw;this.world.add(g);for(let stack=0;stack<1+i%3;stack++)box(g,['#a45447','#298c9c','#b89b4a'][i%3],0,1.4+stack*2.8,0,5,2.8,11);}
      else if(['desert','canyon'].includes(t.environment)){const rock=mesh(this.world,rockGeometry,material(t.environment==='desert'?'#c49766':'#a57858',{flatShading:true}),p.x,y+4,p.z,4+i%5,5+i%7,4+i%4);rock.rotation.y=i*.4;}
      else if(t.environment==='runway'){const g=new THREE.Group();g.position.set(p.x,y,p.z);g.rotation.y=p.yaw;this.world.add(g);box(g,'#b7bdba',0,4,0,16,8,20);mesh(g,coneGeometry,material('#6c7c83'),0,9,0,13,4,15).rotation.y=Math.PI/4;}
    }
    const grandstands=t.category==='Stock'?10:3;
    for(let i=0;i<grandstands;i++){const p=safe(TRACK_LENGTH*(.04+i/grandstands),ROAD_WIDTH/2+21,8);if(!p)continue;const stand=new THREE.Group();stand.position.set(p.x,groundHeight(p.x,p.z),p.z);stand.rotation.y=p.yaw;this.world.add(stand);for(let row=0;row<4;row++){box(stand,'#788792',row*1.2,row*.8,0,1.3,.3,24);for(let col=0;col<14;col++){box(stand,col%3?'#31495c':palette.accent,row*1.2,row*.8+.5,col*1.55-10,.7,.6,.65);mesh(stand,sphereGeometry,material('#c5ae96'),row*1.2,row*.8+1,col*1.55-10,.18,.2,.18);}}box(stand,'#b7c4cb',2,6,0,9,.25,27);for(const z of [-12,12])box(stand,'#485b69',5,3,z,.3,6,.3);}
    for(let i=0;i<6;i++){const p=safe(15+i*12,-ROAD_WIDTH/2-24,8);if(!p)continue;const g=new THREE.Group();g.position.set(p.x,groundHeight(p.x,p.z),p.z);g.rotation.y=p.yaw;this.world.add(g);box(g,'#c9ced0',0,2.3,0,11,4.6,9);box(g,'#1c2a37',5.53,1.9,0,.06,3.4,7.8);box(g,palette.accent,5.57,4.05,0,.07,.5,8.5);box(g,'#3b4d59',0,4.8,0,12,.35,10);}
    for(const [from,to]of t.tunnels||[])for(let s=from*TRACK_LENGTH;s<=to*TRACK_LENGTH;s+=12){const p=pointAt(s),g=new THREE.Group();g.position.set(p.x,p.y,p.z);g.rotation.y=p.yaw;this.world.add(g);const half=ROAD_WIDTH/2+1.3;for(const side of [-1,1])box(g,'#4b5a65',side*half,4,0,.6,8,12.8);box(g,'#566774',0,8,0,half*2+.6,.5,12.8);box(g,'#a4e7ea',0,7.65,0,1,.12,5);}
    if(t.bridge){for(let s=t.bridge[0]*TRACK_LENGTH;s<t.bridge[1]*TRACK_LENGTH;s+=16){const p=pointAt(s),g=new THREE.Group();g.position.set(p.x,p.y-.4,p.z);g.rotation.y=p.yaw;this.world.add(g);box(g,'#707f89',0,-.1,0,ROAD_WIDTH+.6,.6,17);for(const side of [-1,1])box(g,'#7f8d94',side*(ROAD_WIDTH/2-1),-5,0,1,10,1);}}
    if(t.environment==='dock'){for(const s of [.14,.49,.78]){const p=safe(s*TRACK_LENGTH,ROAD_WIDTH/2+40,12);if(!p)continue;const g=new THREE.Group();g.position.set(p.x,groundHeight(p.x,p.z),p.z);g.rotation.y=p.yaw;this.world.add(g);for(const x of [-8,8])box(g,'#d2ab4b',x,13,0,.8,26,.8);box(g,'#d2ab4b',0,26,0,24,1,1);box(g,'#414e5d',0,20,0,.1,12,.1);}}
    for(let i=0;i<15;i++){const a=i*2.399,r=extent*.65,p={x:cx+Math.cos(a)*r,z:cz+Math.sin(a)*r};const h=['mountain','alpine','canyon'].includes(t.environment)?100+i%4*35:40+i%3*20;mesh(this.world,coneGeometry,material(t.environment==='canyon'?'#ae8062':'#788e91',{flatShading:true}),p.x,h*.30,p.z,70,h,70).castShadow=false;if(t.environment==='alpine')mesh(this.world,coneGeometry,material('#e8e9e2',{flatShading:true}),p.x,h*.70,p.z,24,h*.35,24).castShadow=false;}
    if(t.night)for(let s=20;s<TRACK_LENGTH;s+=40){const p=pointAt(s,ROAD_WIDTH/2+3);box(this.world,'#526573',p.x,p.y+4,p.z,.2,8,.2);box(this.world,'#9ce9fa',p.x,p.y+8,p.z,2,.14,1);}
    this.batchStatic();this.addDefaultPreviews();
  }
  addDefaultPreviews(){const t=this.track;for(let i=0;i<4;i++){const p=t.pointAt(t.TRACK_LENGTH-12-Math.floor(i/2)*7,i%2?3:-3),model=createVehicle(VEHICLES[i].id);model.position.set(p.x,p.y,p.z);model.rotation.y=p.yaw;this.scene.add(model);this.models.set('preview-'+i,model);}}
  buildCoastal(){
    const {samples,pointAt,nearest,groundHeight,TRACK_LENGTH,ROAD_WIDTH}=this.track;
    const skyCanvas=document.createElement('canvas');skyCanvas.width=2;skyCanvas.height=256;const g=skyCanvas.getContext('2d');const grad=g.createLinearGradient(0,0,0,256);grad.addColorStop(0,'#3277bc');grad.addColorStop(.5,'#8bb8db');grad.addColorStop(.65,'#dbe7ec');grad.addColorStop(1,'#8caec3');g.fillStyle=grad;g.fillRect(0,0,2,256);
    const sky=new THREE.Mesh(new THREE.SphereGeometry(1800,24,16),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(skyCanvas),side:THREE.BackSide,fog:false,depthWrite:false}));this.world.add(sky);
    mesh(this.world,sphereGeometry,new THREE.MeshBasicMaterial({color:'#fff1be',fog:false}),-550,240,-900,70,70,70);
    const water=mesh(this.world,new THREE.PlaneGeometry(4000,4000),material('#469eb3',{metalness:.15,roughness:.35}),0,-1,0);water.rotation.x=-Math.PI/2;water.castShadow=false;
    const terrain=new THREE.PlaneGeometry(640,600,110,100);terrain.rotateX(-Math.PI/2);terrain.translate(-30,0,-20);const colors=[];const attr=terrain.attributes.position;
    for(let i=0;i<attr.count;i++){const x=attr.getX(i),z=attr.getZ(i),y=groundHeight(x,z);attr.setY(i,y);const c=new THREE.Color(y<1.7?'#e5cf98':y<3?'#9eb56e':(i%7===0?'#8eae69':'#80a360'));colors.push(c.r,c.g,c.b);}
    terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();mesh(this.world,terrain,material('#ffffff',{vertexColors:true,flatShading:true}),0,0,0).castShadow=false;
    this.ribbon(-ROAD_WIDTH/2-5.6,ROAD_WIDTH/2+5.6,'#4b8068',.015);
    this.ribbon(-ROAD_WIDTH/2,ROAD_WIDTH/2,'#30363e',.07);
    this.ribbon(-ROAD_WIDTH/2,-ROAD_WIDTH/2+.85,'#d72d36',.1,true);this.ribbon(ROAD_WIDTH/2-.85,ROAD_WIDTH/2,'#d72d36',.1,true);
    this.ribbon(-ROAD_WIDTH/2+1.05,-ROAD_WIDTH/2+1.2,'#f3f4ec',.11);this.ribbon(ROAD_WIDTH/2-1.2,ROAD_WIDTH/2-1.05,'#f3f4ec',.11);
    this.rail(-1);this.rail(1);
    let seed=529;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<70;i++){const x=rand()*500-275,z=rand()*450-245,n=nearest(x,z);if(n.distance<32||groundHeight(x,z)<2)continue;this.palm(x,groundHeight(x,z),z,.65+rand()*.8,rand()*6.28);}
    for(let i=0;i<23;i++){const a=i*2.399,r=450+(i%4)*70;const m=mesh(this.world,coneGeometry,material(i%2?'#6c9d9e':'#769f99',{flatShading:true}),Math.cos(a)*r-30,20,Math.sin(a)*r-20,70+i%3*22,100+i%4*32,65+i%3*20);m.castShadow=false;}
    for(let i=0;i<18;i++){const p=pointAt(i/18*TRACK_LENGTH,i%2?24:-25);const rock=mesh(this.world,rockGeometry,material('#b7a883',{flatShading:true}),p.x,groundHeight(p.x,p.z)+1,p.z,2+i%3,2,2.5);rock.rotation.set(i,.5*i,0);}
    const start=pointAt(0);const arch=new THREE.Group();arch.position.set(start.x,start.y,start.z);arch.rotation.y=start.yaw;this.world.add(arch);
    for(const x of [-12,12]){box(arch,'#303844',x,4,0,.8,8,.8);box(arch,'#e02d35',x,1.5,0,1.2,3,1.2);}
    mesh(arch,new THREE.BoxGeometry(25,2.2,1),new THREE.MeshStandardMaterial({map:textTexture('ROOM RALLY  /  GRAND PRIX',{bg:'#141a23',color:'#f2f2f2'}),roughness:.5}),0,8,0);
    this.startLightMaterial=material('#cd2636',{emissive:'#a81828',emissiveIntensity:.8});
    for(let i=0;i<5;i++){box(arch,'#10151c',-3+i*1.5,5.9,0,1.1,1.4,.6);mesh(arch,sphereGeometry,this.startLightMaterial,-3+i*1.5,5.9,-.38,.36,.36,.13);}
    for(let row=0;row<2;row++)for(let col=0;col<20;col++)box(arch,(row+col)%2?'#f8f1da':'#25343e',-9.5+col,.15,row-.5,1,.03,1);
    for(let s=80;s<TRACK_LENGTH;s+=110){const p=pointAt(s,-14);const group=new THREE.Group();group.position.set(p.x,p.y,p.z);group.rotation.y=p.yaw;this.world.add(group);box(group,'#c2c9ce',0,1.5,0,.22,3,.22);mesh(group,new THREE.BoxGeometry(4,1.7,.2),new THREE.MeshStandardMaterial({map:textTexture('100',{bg:'#f4f4ef',color:'#19222c'})}),0,3.1,0);}
    this.buildPaddock();
    this.batchStatic();
    for(let i=0;i<4;i++){const p=pointAt(TRACK_LENGTH-12-Math.floor(i/2)*7,i%2?3:-3);const model=createVehicle(VEHICLES[i].id);model.position.set(p.x,p.y,p.z);model.rotation.y=p.yaw;this.world.add(model);this.models.set(`preview-${i}`,model);}
  }
  ribbon(left,right,color,height,striped=false){
    const {samples}=this.track;
    const pos=[],colors=[],indices=[];
    samples.forEach((p,i)=>{const next=samples[(i+1)%samples.length],prev=samples[Math.max(0,i-1)];const yaw=i===samples.length-1?Math.atan2(p.x-prev.x,p.z-prev.z):Math.atan2(next.x-p.x,next.z-p.z);const c=new THREE.Color(striped&&Math.floor(p.s/4)%2?'#f4e8ce':color);for(const d of [left,right]){pos.push(p.x+Math.cos(yaw)*d,p.y+Math.tan(p.bank||0)*d+height,p.z-Math.sin(yaw)*d);colors.push(c.r,c.g,c.b);}if(i<samples.length-1){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}});
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(this.world,geo,material('#ffffff',{vertexColors:true,side:THREE.DoubleSide}),0,0,0).castShadow=false;
  }
  batchStatic(){
    this.world.updateMatrixWorld(true);const groups=new Map();
    this.world.traverse(m=>{if(!m.isMesh||Array.isArray(m.material))return;const key=`${m.geometry.uuid}:${m.material.uuid}:${m.castShadow}:${m.receiveShadow}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);});
    for(const parts of groups.values())if(parts.length>2){const batch=new THREE.InstancedMesh(parts[0].geometry,parts[0].material,parts.length);parts.forEach((part,i)=>{batch.setMatrixAt(i,part.matrixWorld);part.removeFromParent();});batch.castShadow=parts[0].castShadow;batch.receiveShadow=parts[0].receiveShadow;this.world.add(batch);}
  }
  buildPaddock(){
    const {pointAt,TRACK_LENGTH}=this.track;
    for(let i=0;i<8;i++){const p=pointAt(12+i*8,-25);const garage=new THREE.Group();garage.position.set(p.x,p.y,p.z);garage.rotation.y=p.yaw;this.world.add(garage);box(garage,'#d8dce0',0,2.3,0,10,4.6,7.6);box(garage,'#141b25',5.02,1.9,0,.08,3.4,6.3);box(garage,['#df303a','#24acaf','#e5b641','#5482ca'][i%4],5.1,3.85,0,.14,.45,7.3);box(garage,'#2e3844',0,4.8,0,11,.35,8);box(garage,'#a5c6d0',0,5.8,0,9,1.8,6.7);box(garage,'#212a36',0,6.8,0,10,.3,8);}
    for(const s of [30,100,390,760]){const p=pointAt(s,28);const stand=new THREE.Group();stand.position.set(p.x,p.y,p.z);stand.rotation.y=p.yaw;this.world.add(stand);
      for(let row=0;row<6;row++){box(stand,'#75808b',row*1.1,row*.7,0,1.2,.3,32);for(let col=0;col<22;col++){box(stand,(col+row)%4?'#273744':'#bd3440',row*1.1,row*.7+.45,col*1.4-14.7,.65,.65,.6);mesh(stand,sphereGeometry,material((col+row)%3?'#c0aa92':'#ece0c4'),row*1.1,row*.7+.98,col*1.4-14.7,.2,.22,.2);}}
      for(const z of [-16,16])box(stand,'#364653',7,4,z,.3,8,.3);const roof=box(stand,'#c3c8ce',3,8.2,0,11,.28,35);roof.rotation.z=.06;
    }
    const p=pointAt(60,-40),tower=new THREE.Group();tower.position.set(p.x,p.y,p.z);tower.rotation.y=p.yaw;this.world.add(tower);box(tower,'#c8ccd1',0,9,0,6,18,6);box(tower,'#2d4759',0,18,0,9,4,9);box(tower,'#313944',0,20.5,0,10,.6,10);
    for(let i=0;i<8;i++){const p=pointAt(TRACK_LENGTH-12-Math.floor(i/2)*7,i%2?3:-3);const grid=new THREE.Group();grid.position.set(p.x,p.y+.15,p.z);grid.rotation.y=p.yaw;this.world.add(grid);box(grid,'#ebefec',-1.5,0,0,.12,.025,4);box(grid,'#ebefec',1.5,0,0,.12,.025,4);box(grid,'#ebefec',0,0,2,3,.025,.12);}
  }
  rail(side){const {samples,pointAt,ROAD_WIDTH,TRACK_LENGTH}=this.track;const pos=[],indices=[];samples.forEach((p,i)=>{const pt=pointAt(p.s,side*(ROAD_WIDTH/2+(this.track.wall??6)));pos.push(pt.x,pt.y+.15,pt.z,pt.x,pt.y+1.2,pt.z);if(i<samples.length-1){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}});const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(this.world,geo,material('#c2c6c9',{side:THREE.DoubleSide,metalness:.45,roughness:.45}),0,0,0);const fence=geo.clone();fence.translate(0,1.2,0);mesh(this.world,fence,material('#687982',{side:THREE.DoubleSide,wireframe:true,transparent:true,opacity:.45}),0,0,0).castShadow=false;for(let s=0;s<TRACK_LENGTH;s+=12){const p=pointAt(s,side*(ROAD_WIDTH/2+6));box(this.world,'#677784',p.x,p.y+1.3,p.z,.18,2.6,.18);}}
  palm(x,y,z,size,yaw){const group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(size);group.rotation.y=yaw;this.world.add(group);mesh(group,trunkGeometry,material('#a9855b'),0,4,0);for(let i=0;i<5;i++){const leaf=mesh(group,coneGeometry,material(i%2?'#477f56':'#598e57',{flatShading:true}),Math.sin(i*1.257)*2,8,Math.cos(i*1.257)*2,1.4,5,.35);leaf.rotation.set(Math.PI/2,0,-i*1.257);}mesh(group,sphereGeometry,material('#5f7550'),0,8,0,1,1,1);}
  setState(state){if((state.settings?.trackId||'coastal')!==this.track.id)this.rebuildWorld(state.settings?.trackId);this.state=state;}
  cameraFor(id){if(!this.cameras.has(id))this.cameras.set(id,new THREE.PerspectiveCamera(65,1,.15,2400));return this.cameras.get(id);}
  updateModels(dt,time){
    const {nearest,pointAt}=this.track,lobby=this.state.phase==='lobby';
    this.previewCars=(this.state.players||[]).map((p,i)=>{const q=pointAt(this.track.TRACK_LENGTH-12-Math.floor(i/2)*7,i%2?3:-3);return {...p,x:q.x,y:q.y,z:q.z,yaw:q.yaw,human:true,speed:0,steering:0,vx:0,vz:0,boost:100,lap:1};});const cars=lobby?this.previewCars:this.state.cars;
    this.startLightMaterial.color.set(this.state.phase==='countdown'?'#ff2538':'#25191f');this.startLightMaterial.emissive.set(this.state.phase==='countdown'?'#e51428':'#000000');
    for(const [id,model] of this.models){model.visible=id.startsWith('preview-')?lobby&&!this.previewCars.length:cars.some(c=>c.id===id);}
    for(const car of cars){let model=this.models.get(car.id);if(model&&model.userData.vehicleId!==car.vehicleId){model.removeFromParent();this.models.delete(car.id);model=null;}if(!model){model=createVehicle(car.vehicleId);model.position.set(car.x,car.y,car.z);model.rotation.y=car.yaw;this.models.set(car.id,model);this.scene.add(model);}model.visible=true;applyPaint(model,car.color||paintInfo(car.paintId).hex);
      const alpha=1-Math.exp(-dt*18);model.position.lerp(new THREE.Vector3(car.x,car.y+.12,car.z),alpha);model.rotation.y+=Math.atan2(Math.sin(car.yaw-model.rotation.y),Math.cos(car.yaw-model.rotation.y))*alpha;
      const p=nearest(car.x,car.z),ahead=pointAt(p.s+2);model.rotation.x=(ahead.y-p.y)/2*Math.cos(car.yaw-p.yaw);model.rotation.z=p.bank*Math.cos(car.yaw-p.yaw);model.userData.body.rotation.z=-car.steering*car.speed*.002*vehicleSpec(car.vehicleId).centerOfMass;const forward=car.vx*Math.sin(car.yaw)+car.vz*Math.cos(car.yaw);animateVehicle(model,car.steering,forward,dt);

    }
  }
  frame(ms){
    const dt=Math.min(.05,(ms-this.lastTime)/1000||.016),time=ms/1000;this.lastTime=ms;
    this.updateModels(dt,time);this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,this.width,this.height);this.renderer.clear();this.renderer.setScissorTest(true);this.renderer.shadowMap.needsUpdate=true;
    const lobby=this.state.phase==='lobby';
    const humans=(lobby?this.previewCars:this.state.cars).filter(c=>c.human).slice(0,4);
    const views=humans.length?humans:lobby?[]:[this.state.cars.find(c=>!c.finished)||this.state.cars[0]].filter(Boolean);
    this.hud.style.display=views.length?'block':'none';
    if(!views.length){const p=this.track.pointAt(this.track.TRACK_LENGTH-12);this.lobbyCamera.position.set(p.x-55+Math.sin(time*.08)*12,p.y+33,p.z-38);this.lobbyCamera.lookAt(p.x+12,p.y+1,p.z-5);this.renderView(this.lobbyCamera,0,0,this.width,this.height);}
    else {
      const layout=viewLayout(views.length,this.width,this.height);
      const ids=new Set();
      views.forEach((car,i)=>{ids.add(car.id);const {x,y,w,h}=layout[i];const camera=this.cameraFor(car.id),model=this.models.get(car.id),yaw=model?.rotation.y??car.yaw,pos=model?.position||new THREE.Vector3(car.x,car.y,car.z);const {back,lift,fov,lookAhead}=speedView(car.speed,car.boosting,views.length===3,this.cameraMode===1);
        const desired=new THREE.Vector3(pos.x-Math.sin(yaw)*back,pos.y+lift,pos.z-Math.cos(yaw)*back);
        if(!camera.userData.ready){camera.position.copy(desired);camera.userData.ready=true;}else camera.position.lerp(desired,1-Math.exp(-dt*7));
        camera.lookAt(pos.x+Math.sin(yaw)*lookAhead,pos.y+.8,pos.z+Math.cos(yaw)*lookAhead);camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*5));
        // Nearby cars can surround the chase camera on the grid; hide only bodies clipping that camera.
        const occluders=[];for(const [id,other] of this.models)if(id!==car.id&&other.visible&&Math.hypot(other.position.x-camera.position.x,other.position.z-camera.position.z)<5&&Math.abs(other.position.y+1-camera.position.y)<4){other.visible=false;occluders.push(other);}
        this.renderView(camera,x,this.height-y-h,w,h);occluders.forEach(other=>other.visible=true);this.renderHud(car,i,x,y,w,h,views.length);
      });
      for(const [id,node] of this.hudNodes)if(!ids.has(id)){node.remove();this.hudNodes.delete(id);}
    }
    this.renderer.setScissorTest(false);requestAnimationFrame(this.frame);
  }
  renderView(camera,x,y,w,h){camera.aspect=w/h;camera.updateProjectionMatrix();this.renderer.setViewport(x,y,w,h);this.renderer.setScissor(x,y,w,h);this.renderer.render(this.scene,camera);this.renderer.shadowMap.needsUpdate=false;}
  renderHud(car,index,x,y,w,h,count){
    let node=this.hudNodes.get(car.id);if(!node){node=document.createElement('div');node.className='viewport-hud';node.innerHTML='<div class="view-top"><span class="driver-label"></span><span class="lap-label"></span></div><div class="wrong-way"></div><div class="view-bottom"><div class="speed"><b></b><small> KM/H</small><div class="nitro"><i></i></div></div><div class="driving-status"></div></div>';this.hud.append(node);this.hudNodes.set(car.id,node);}
    Object.assign(node.style,{left:`${x}px`,top:`${y}px`,width:`${w}px`,height:`${h}px`,border:count>1?'1px solid #f8eed546':'none'});node.classList.toggle('compact',count>2);
    const sorted=ranking(this.state.phase==='lobby'?this.previewCars:this.state.cars,this.state.settings?.mode),rank=sorted.findIndex(c=>c.id===car.id)+1;
    node.dataset.player=String(index+1);node.classList.toggle('narrow',count===3);
    node.querySelector('.driver-label').textContent='P'+(index+1)+' · '+car.name+' · '+vehicleSpec(car.vehicleId).name+' | POS '+rank+(car.bot?' · AI':'');node.querySelector('.driver-label').style.borderColor=car.color;
    node.querySelector('.lap-label').textContent=this.state.phase==='lobby'?(car.ready?'READY':'LOBBY'):this.state.settings?.mode==='drift'?Math.floor(car.driftScore||0)+' PTS · ×'+(car.combo||1).toFixed(1):car.finished?'FINISHED ✓':'LAP '+car.lap+' / '+(this.state.settings?.laps||3);

    if(!node.querySelector('.speed-streaks')){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','speed-streaks');svg.setAttribute('viewBox','0 0 1000 600');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');for(const d of ['M160 210 L0 100','M130 280 L0 250','M170 380 L0 460','M240 450 L70 600','M840 210 L1000 100','M870 280 L1000 250','M830 380 L1000 460','M760 450 L930 600']){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);}node.prepend(svg);}
    node.querySelector('.speed-streaks').style.opacity=this.state.phase==='racing'?speedView(car.speed).streaks:0;
    node.querySelector('.speed b').textContent=Math.round(car.speed*3.6);node.querySelector('.nitro i').style.width=`${car.boost}%`;
    node.querySelector('.wrong-way').textContent=car.wrongWay?'↶ WRONG WAY':car.offroad?'OFF ROAD':'';
    node.querySelector('.driving-status').textContent=car.drifting?'DRIFT ACTIVE':car.boosting?'ERS DEPLOYING':car.drafting>.2?'SLIPSTREAM':car.bestLap?'BEST '+car.bestLap.toFixed(2)+'s':'';
  }
}
