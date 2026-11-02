export const VEHICLES=[
  {id:'formula',name:'Formula 27',category:'Open-wheel formula',number:27,axles:[1.782,-1.728],track:1.22,radius:.70,rearRadius:.78,tireWidth:.60,length:6.3,width:3.16,mass:800,centerOfMass:.38,maxSpeed:47,acceleration:31,grip:11,steer:1.48,driftGrip:1.8},
  {id:'endurance',name:'Endurance 27',category:'Le Mans prototype',number:27,axles:[1.72,-1.68],track:1.08,radius:0.56,tireWidth:0.43,length:5.9,width:2.7,mass:1050,centerOfMass:.44,maxSpeed:46,acceleration:29,grip:10.6,steer:1.40,driftGrip:2.2},
  {id:'drift',name:'Sideways 34',category:'Widebody drift coupe',number:34,axles:[1.66,-1.58],track:1.08,radius:0.56,tireWidth:0.41,length:5.6,width:2.66,mass:1220,centerOfMass:.57,maxSpeed:41,acceleration:30,grip:8.8,steer:1.57,driftGrip:1.25},
  {id:'gt3',name:'Apex 27',category:'GT3 race car',number:27,axles:[1.73,-1.64],track:1.09,radius:0.56,tireWidth:0.43,length:5.8,width:2.7,mass:1300,centerOfMass:.49,maxSpeed:44,acceleration:28,grip:10.8,steer:1.45,driftGrip:2},
  {id:'stock',name:'Stock 42',category:'Stock car',number:42,axles:[1.72,-1.66],track:1.08,radius:0.57,tireWidth:0.4,length:5.8,width:2.64,mass:1550,centerOfMass:.62,maxSpeed:43,acceleration:26,grip:9,steer:1.32,driftGrip:1.9},
  {id:'wedge',name:'Vektor',category:'Angular wedge supercar',number:6,axles:[1.68,-1.64],track:1.08,radius:0.56,tireWidth:0.43,length:5.7,width:2.68,mass:1190,centerOfMass:.43,maxSpeed:46,acceleration:30,grip:10,steer:1.43,driftGrip:1.9},
  {id:'hyper',name:'Stratos',category:'Mid-engine hypercar',number:7,axles:[1.74,-1.68],track:1.1,radius:0.58,tireWidth:0.46,length:5.9,width:2.74,mass:1150,centerOfMass:.42,maxSpeed:48,acceleration:30,grip:10.7,steer:1.42,driftGrip:2.1},
  {id:'tourer',name:'Grand Tourer',category:'Front-engine GT supercar',number:8,axles:[1.68,-1.61],track:1.08,radius:0.56,tireWidth:0.43,length:5.7,width:2.68,mass:1420,centerOfMass:.51,maxSpeed:45,acceleration:28,grip:10,steer:1.42,driftGrip:2}
].map(v=>({...v,aero:({formula:.40,endurance:.30,drift:.04,gt3:.20,stock:.07,wedge:.13,hyper:.25,tourer:.12})[v.id]}));
export const vehicleSpec=id=>VEHICLES.find(v=>v.id===id)||VEHICLES[0];
