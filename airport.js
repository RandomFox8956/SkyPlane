/* The terminal's visible geometry and pedestrian collision share one plan. */
(function(root){
  'use strict';
  const stations=[
    {role:'checkin',name:'Check-in desks',x:410,z:37},
    {role:'security',name:'Security screening',x:386,z:-12},
    {role:'cabin',name:'Gate A2 · Cabin preparation',x:353,z:-80},
    {role:'pilot',name:'Flight operations',x:409,z:-88},
    {role:'manager',name:'Airport management',x:409,z:-130},
    {role:'engineer',name:'Maintenance workshop',x:376,z:162},
    {role:'ground',name:'Gate A1 · Ground services',x:319,z:218},
    {role:'atc',name:'Air traffic control',x:352,z:-150}
  ];
  function plan(){
    const boxes=[],signs=[];
    const box=(x,y,z,w,h,d,c,solid=true,alpha=1)=>boxes.push({x,y,z,w,h,d,c,solid,alpha});
    const sign=(x,y,z,w,text)=>signs.push({x,y,z,w,text});
    const wall=(x,z,w,d,h=12)=>box(x,2,z,w,h,d,'#d7dfd8');
    const glass=(x,z,w,d)=>{box(x,2,z,w,1.2,d,'#506a67');box(x,3.2,z,w,8.8,d,'#8fb9b3',true,.22);box(x,12,z,w,2,d,'#e0e4d7');};
    // A continuous floor, open entrances, clerestory glazing and layered projecting roof.
    box(384,1.8,-35,94,.2,264,'#d9d4c3',false);
    box(384,14,-35,101,1,270,'#e5e5d6',false);
    box(384,15,-35,91,.7,262,'#688780',false);
    wall(384,-167,94,1);wall(338,-35,1,264,1.2);
    for(let z=-154;z<88;z+=22){glass(338,z,1,21);box(338,2,z-11,1.8,12,1.5,'#426b65');}
    glass(431,-61,1,212);glass(431,88,1,16); // east entrance z45..80 stays open
    wall(350,97,24,1);wall(405,97,52,1); // south staff entrance x362..379
    box(447,1.7,62,32,.3,44,'#c4c8bc',false);box(446,11,62,34,1,46,'#466f69',false);
    for(const z of [42,83])box(460,2,z,1,9,1,'#dfe4dc');
    // A broad central concourse with open doorways into north-side offices.
    wall(394,-113,1,106);wall(412,-110,37,1);wall(412,-151,37,1);
    // Door gaps in office partitions: replace long office wall with short piers.
    boxes.pop(); // rear office uses the terminal's north wall instead
    boxes.splice(boxes.findIndex(b=>b.x===394&&b.z===-113),1);
    for(const [z,d] of [[-157,18],[-110,22],[-64,17]])wall(394,z,1,d);
    // Check-in island, baggage belt, self-service kiosks and queue stanchions.
    for(const z of [29,47,65]){box(417,2,z,12,1.35,5,'#46746e');box(417,3.35,z,13,.15,5.5,'#e4d6b3');box(417,3.5,z-1,2,1.2,.3,'#203b3a');}
    box(424,2,43,3,.65,66,'#414e4b');
    for(const z of [27,45,63])for(const x of [399,405]){box(x,2,z,.22,1.1,.22,'#71857e');box(x+3,3,z,6,.07,.08,'#a89c65',false);}
    for(const z of [62,72]){box(349,2,z,2,1.8,2,'#456860');box(349,3.8,z,2,.8,.3,'#94c7c4');}
    // Security lanes: open centre for walking; scanner, conveyor and arch at either side.
    for(const x of [364,408]){box(x,2,-12,8,1.1,12,'#5c716c');box(x,3.1,-15,8,3.5,5,'#6d918a');box(x,3.5,-12.4,5,2.2,.1,'#182f32');}
    for(const x of [376,394])box(x,2,-18,.5,4,.5,'#587b74');box(385,6,-18,18,.6,1,'#587b74');
    // Gate lounges, cafe, information point and a washroom with an open doorway.
    for(const z of [-42,-66,-104,-132])for(const x of [350,371]){
      box(x,2,z,10,.65,3,'#345b58');box(x,2.65,z+1.3,10,1.25,.35,'#547c72');
      for(const dx of [-4,4])box(x+dx,2,z,.4,.7,2,'#243f3d');
    }
    box(352,2,4,17,1.3,5,'#9c8062');box(350,3.3,4,4,1.6,2,'#50615a');
    for(const z of [18,34]){box(354,2,z,.5,1.1,.5,'#586a5c');box(354,3.1,z,5,.2,5,'#cfb988');}
    wall(415,10,32,1,7);wall(399,1,1,17,7);box(422,2,1,5,1.1,4,'#e3e8dc');
    for(const z of [-91,-134]){box(419,2,z,12,1.2,6,'#9c896a');box(419,3.2,z,3,1.4,.3,'#294b49');box(414,2,z-5,3,1.7,3,'#527570');}
    box(350,2,-87,13,1.2,3,'#648f83');
    // Covered service court, a genuinely open workshop, tool benches and baggage equipment.
    box(368,1.7,157,64,.3,116,'#b5beb1',false);
    wall(395,156,1,76,8);wall(363,194,65,1,8);wall(339,156,1,76,8);
    box(367,10,156,62,1,81,'#d6d9c7',false);box(384,2,165,12,1.3,28,'#697e70');
    for(let z=154;z<179;z+=7)box(384,3.3,z,2,.4,3,'#d7b76f');
    box(329,2,220,7,1.2,5,'#a7976e');box(331,3.2,220,2,1,.3,'#244e47');
    for(const z of [205,216]){box(348,2,z,7,1,4,'#748273');box(348,3,z,5,2,3,'#bfa36a');}
    // Signs face the concourse, so they can be read on foot and from outside.
    sign(384,9,94,63,'SEABREEZE / DEPARTURES');sign(384,8,20,62,'CHECK-IN   |   SECURITY / GATES');
    sign(384,8,-23,60,'A2  A3  /  DEPARTURE LOUNGE');sign(414,6,-69,27,'FLIGHT OPERATIONS');
    sign(414,6,-115,27,'AIRPORT MANAGER');sign(349,6,-78,19,'GATE A2');sign(352,6,9,21,'COAST CAFE');
    sign(415,5,12,23,'WASHROOMS');sign(368,8,119,46,'MAINTENANCE / STAFF');sign(319,6,232,28,'A1 / GROUND SERVICES');sign(352,6,-142,26,'AIR TRAFFIC CONTROL');
    for(const s of stations)sign(s.x,4.7,s.z+3,Math.min(18,s.name.length*.8),s.role.toUpperCase());
    // Bollards, planting and an exterior roofline give the terminal a distinct silhouette.
    for(const z of [-130,-65,10,92]){box(435,2,z,5,1.2,5,'#8b967d');box(435,3.2,z,4,3,4,'#73965f');}
    for(let z=-155;z<95;z+=25)box(435,14,z,13,.4,1.8,'#b4bba3',false);
    return {boxes,signs,stations};
  }
  const layout=plan();
  if(root.SkyAssets){layout.boxes=root.SkyAssets.colliders;layout.signs=[];}
  function canWalk(x,z){
    if(x<290||x>485||z< -190||z>265)return false;
    return !layout.boxes.some(b=>b.solid&&b.y<4&&b.y+b.h>2.4&&Math.abs(x-b.x)<b.w/2+.65&&Math.abs(z-b.z)<b.d/2+.65);
  }
  function step(w,keys,dt){
    w.yaw+=((keys.has('arrowright')?1:0)-(keys.has('arrowleft')?1:0))*dt*1.6;
    const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),side=(keys.has('d')?1:0)-(keys.has('a')?1:0);
    const length=Math.hypot(forward,side)||1,speed=keys.has('shift')?13:7;
    const dx=(Math.sin(w.yaw)*forward+Math.cos(w.yaw)*side)/length*speed*dt,dz=(-Math.cos(w.yaw)*forward+Math.sin(w.yaw)*side)/length*speed*dt;
    // Substeps also protect collision when the browser resumes after a delayed frame.
    const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));
    for(let i=0;i<n;i++){if(canWalk(w.x+dx/n,w.z))w.x+=dx/n;if(canWalk(w.x,w.z+dz/n))w.z+=dz/n;}
  }
  const api={layout,stations,canWalk,step};root.SkyAirport=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
