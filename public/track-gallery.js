import {TRACKS,getTrack} from '/track.js';
import {Race3D} from '/race3d.js';
const choice=document.getElementById('track-choice'),race=new Race3D(document.getElementById('track'),document.getElementById('view-hud'));
for(const t of TRACKS){choice.add(new Option(t.name+' · '+t.category,t.id));const button=document.createElement('button'),img=document.createElement('img');img.src='/tracks/'+t.id+'.svg';img.alt=t.name;button.append(img);button.onclick=()=>{choice.value=t.id;update();window.scrollTo({top:0,behavior:'smooth'});};document.querySelector('.atlas').append(button);}
function update(){const t=getTrack(choice.value);document.getElementById('metadata').textContent=`${t.name} · ${t.category} · ${t.environment} · ${Math.round(t.TRACK_LENGTH)} m · ${t.ROAD_WIDTH} m · ${t.difficulty}`;race.setState({phase:'lobby',settings:{trackId:t.id,mode:'circuit',laps:3},players:[],cars:[],elapsed:0});}choice.onchange=update;choice.value='f1-01';update();
