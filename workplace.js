/* Physical airport work: articulated people, collision-aware journeys and world-space equipment. */

(function(root){

  'use strict';

  const A=root.SkyAirport,J=root.SkyJobs;

  const palette=['#638899','#bd765b','#6a8065','#a38bb0','#d1b96d','#476778'];

  const names=['Alex Rivers','Jamie Chen','Sam Taylor','Charlie Park','Robin Ford','Nadia Osei','Priya Nair','Owen Clarke','Maya Lindqvist','Theo Marchand','Isla Byrne','Kofi Mensah'];

  const areas=[{name:'Arrivals',x:445,z:65},{name:'Check-in',x:409,z:40},{name:'Security',x:385,z:-7},{name:'Coast Cafe',x:361,z:20},{name:'Gate A2',x:357,z:-77},{name:'Gate A3',x:382,z:-124},{name:'Information',x:388,z:59}];

  let people=[],workers=[],active=null,customer=null,objects=[],staticTerminal=null,staticCabin=null,grid=null,time=0,effects=[],aircraftLocal=null,aircraftHome=null,lastCustomer=null;

  const blocks=[];

  const desks={checkin:[410,34],security:[386,-15],engineer:[374,158],ground:[319,214],pilot:[409,-91],manager:[409,-134],atc:[352,-153]};

  // Security has no front desk: the scanner belt is the counter, with a tray stand and console beside it.
  for(const [role,[x,z]] of Object.entries(desks))if(role!=='security')blocks.push({x,z,w:role==='ground'?5:4.2,d:1.5});

  const secTray={x:388.6,z:-15.7},secConsole={x:390.6,z:-15.5};


  blocks.push({x:384.6,z:-16.4,w:5.5,d:3.8},{x:secTray.x,z:secTray.z,w:1.4,d:1.2},{x:secConsole.x,z:secConsole.z,w:1.7,d:.8},{x:406.3,z:33,w:2.6,d:4},{x:314,z:212,w:2.6,d:3.4},{x:322,z:211,w:2.6,d:3.4},{x:303,z:226,w:12,d:2.8});

  const clear=(x,z)=>A.canWalk(x,z)&&!blocks.some(b=>Math.abs(x-b.x)<b.w/2+.45&&Math.abs(z-b.z)<b.d/2+.45);

  // The control tower cab sits on top of the tower at (500, -265). Its equipment is laid out in a local
  // frame facing -z (like every desk) and then turned to face west, out over the runways.
  const TOWER={x:500,z:-265};
  const towerFloor=state=>110*(1+((state&&state.buildings&&state.buildings.radar)||0)*.04);
  const toTower=(x,z)=>[TOWER.x+z,TOWER.z-x];
  function towerTurn(m,first){for(let i=first;i<m.length;i++){const f=m[i];m[i]={...f,v:f.v.map(p=>[TOWER.x+p[2],p[1],TOWER.z-p[0]]),n:f.n&&f.n.map(n=>[n[2],n[1],-n[0]])};}}
  function towerClear(x,z){const lz=x-TOWER.x,lx=TOWER.z-z;if(Math.hypot(lx,lz)>17.5)return false;if(lz<-15.7&&Math.abs(lx)<3.6)return false;if(Math.abs(lx)<1.7&&Math.abs(lz)<1.7)return false;if(Math.abs(lx)>3.9&&Math.abs(lx)<4.8&&lz<-15.3&&lz>-16.6)return false;return true;}
  function towerSpawn(state){const [x,z]=toTower(0,-10.9);return {x,z,yaw:-Math.PI/2,pitch:-.1,tower:true,eye:towerFloor(state)+2};}

  function initGrid(){

    if(grid)return;

    const w=97,h=225,data=new Uint8Array(w*h);

    for(let z=0;z<h;z++)for(let x=0;x<w;x++)data[z*w+x]=clear(292+x*2,-188+z*2)?1:0;

    grid={w,h,data};

  }

  function nearest(x,z){

    initGrid();const {w,h,data}=grid,cx=Math.round((x-292)/2),cz=Math.round((z+188)/2);

    for(let r=0;r<15;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){

      if(r&&Math.abs(dx)!==r&&Math.abs(dz)!==r)continue;const xx=cx+dx,zz=cz+dz;

      if(xx>=0&&xx<w&&zz>=0&&zz<h&&data[zz*w+xx])return zz*w+xx;

    }return -1;

  }

  const point=id=>({x:292+id%grid.w*2,z:-188+Math.floor(id/grid.w)*2});

  function segment(a,b){const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.35);for(let i=0;i<=n;i++)if(!clear(a.x+(b.x-a.x)*i/(n||1),a.z+(b.z-a.z)*i/(n||1)))return false;return true;}

  function route(a,b){

    initGrid();const start=nearest(a.x,a.z),end=nearest(b.x,b.z);if(start<0||end<0)return [];

    const {w,h,data}=grid,prev=new Int32Array(w*h).fill(-1),queue=new Int32Array(w*h);let head=0,tail=1;queue[0]=start;prev[start]=start;

    while(head<tail&&prev[end]<0){const id=queue[head++];for(const delta of [-1,1,-w,w]){const n=id+delta;if(n<0||n>=data.length||Math.abs(n%w-id%w)>1||!data[n]||prev[n]>=0)continue;prev[n]=id;queue[tail++]=n;}}

    if(prev[end]<0)return [];

    const path=[];for(let n=end;n!==start;n=prev[n])path.push(point(n));path.push(point(start));path.reverse();

    const smooth=[];let at=a;

    for(let i=0;i<path.length;){let last=i;while(last+1<path.length&&segment(at,path[last+1]))last++;smooth.push(path[last]);at=path[last];i=last+1;}

    if(clear(b.x,b.z)&&segment(at,b))smooth.push({x:b.x,z:b.z});return smooth;

  }

  function travel(p,target){p.path=route(p,target);p.destination=target.name||'Workstation';p.target=p.path.at(-1)||{x:p.x,z:p.z};p.wait=0;}

  function reset(){

    people=[];workers=[];active=null;customer=null;

    for(let i=0;i<18;i++){const a=areas[i%areas.length],p0=point(nearest(a.x+(i%3)*2,a.z+Math.floor(i/7)*3));

      const p={id:i,name:names[i%names.length],...p0,yaw:0,phase:i*.8,speed:1.15+(i%4)*.16,path:[],wait:1+i%5,stop:i%areas.length,color:palette[i%palette.length],skin:['#bc8d6c','#e1b496','#755442'][i%3],moving:false};people.push(p);}

    for(const [i,s] of A.stations.entries()){const p0=point(nearest(s.x+3,s.z+2));workers.push({id:30+i,name:['Mina','Louis','Amara','Ben','Sofia','Noah','Eva','Hana'][i%8],role:s.role,...p0,home:p0,yaw:.6,phase:i,speed:.8,path:[],wait:4+i,color:['ground','engineer'].includes(s.role)?'#d5b950':'#274b64',skin:i%2?'#986647':'#d3a382',moving:false});}

  }

  function tick(dt){

    if(!people.length)reset();time+=dt;

    const j=active?.job;if(j&&customer?.serving&&!j.arrivedAt){j.arrivedAt=J.time();if(j.greeting)speech(j.greeting);}
    if(j&&active.role==='checkin'&&j.arrivedAt&&!j.complete&&!j.complained&&patience()<.35){j.complained=true;speech('Is this going to take much longer?');}

    for(const p of [...people,...workers]){

      p.moving=false;if(p.serving){p.yaw=Math.atan2((active?.station.x||p.x)-p.x,-((active?.station.z||p.z)-p.z));continue;}

      if(p.path.length){const t=p.path[0],d=Math.hypot(t.x-p.x,t.z-p.z);if(d<.12){p.path.shift();continue;}

        const step=Math.min(d,p.speed*dt),nx=p.x+(t.x-p.x)/d*step,nz=p.z+(t.z-p.z)/d*step;

        // Yield to the customer ahead instead of walking through one another.

        const blocked=p!==customer&&people.some(q=>q!==p&&(q===customer||q.id<p.id)&&Math.hypot(q.x-nx,q.z-nz)<.7);

        if(!blocked&&clear(nx,nz)){p.x=nx;p.z=nz;const aim=Math.atan2(t.x-p.x,-(t.z-p.z));p.yaw+=Math.atan2(Math.sin(aim-p.yaw),Math.cos(aim-p.yaw))*Math.min(1,dt*7);p.phase+=step*5;p.moving=true;p.stuck=0;}else if((p.stuck=(p.stuck||0)+dt)>3){p.path=[];p.wait=2;p.stuck=0;}

      }else if((p.wait-=dt)<=0){

        if(p===customer){if(Math.hypot(p.x-p.target.x,p.z-p.target.z)<1.4)p.serving=true;else travel(p,p.target);continue;}

        if(p.role){const target=p.atHome?{x:p.home.x+2,z:p.home.z+2}:p.home;travel(p,target);p.atHome=!p.atHome;p.wait=5+p.id%6;}

        else{p.stop=(p.stop+1+(p.id%3))%areas.length;travel(p,areas[p.stop]);p.wait=5+p.id%11;}

      }

    }

  }

  function begin(role,job){

    if(!people.length)reset();if(customer){customer.serving=false;customer.wait=0;}

    const station=A.stations.find(s=>s.role===role);active={role,job,station,hints:true};if(job)job.physical=true;customer=null;

    if(['checkin','security'].includes(role)){

      // Check-in customers step right up to the counter so you can compare them with the passport photo.
      const dest={x:station.x,z:station.z-(role==='checkin'?4.6:6),name:station.name};

      const available=people.filter(p=>p.lastService===undefined||time-p.lastService>60);const pool=available.length?available:people;

      customer=people.find(p=>p.id===job.customerId)||pool.reduce((a,p)=>Math.hypot(p.x-dest.x,p.z-dest.z)<Math.hypot(a.x-dest.x,a.z-dest.z)?p:a,pool[0]);

      if(role==='checkin'){if(job.ticketName===job.name)job.ticketName=customer.name;else if(job.ticketName===customer.name)job.ticketName=names.find(n=>n!==customer.name);job.name=customer.name;}job.customerId=customer.id;job.customerName=customer.name;travel(customer,dest);customer.wait=0;

      // Impostors: the passport photo must match the actual person standing at your desk.
      if(role==='checkin'&&!job.photo){if(job.valid&&job.sequence>=1&&Math.random()<.25){job.valid=false;job.photoMismatch=true;}const others=palette.filter(c=>c!==customer.color),skins=['#bc8d6c','#e1b496','#755442'];job.photo=job.photoMismatch?{color:others[Math.floor(Math.random()*others.length)],skin:skins.find(s=>s!==customer.skin)}:{color:customer.color,skin:customer.skin};}

      // Concealed threats: an innocent-looking item can hide a blade that only the X-ray monitor reveals.
      if(role==='security'&&!job.concealChecked){job.concealChecked=true;job.greeting=job.greeting||['Morning! Shoes on or off?','I think I packed light…','Is this the quick lane?'][Math.floor(Math.random()*3)];const safe=job.items.filter(i=>!i.hazard);if(job.sequence>=1&&safe.length>2&&Math.random()<.5){const it=safe[Math.floor(Math.random()*safe.length)],cover=J.COVERS[Math.floor(Math.random()*J.COVERS.length)];Object.assign(it,{label:cover[0],cls:cover[1],hazard:true,concealed:true,material:'mixed'});}}

    }

    return active;

  }

  function release(){lastCustomer=customer;if(customer){customer.lastService=time;if(active?.role==='checkin'&&active.job?.complete&&active.job.valid)customer.checkedBag=true;customer.serving=false;travel(customer,areas[active?.role==='checkin'?2:4]);customer.wait=8;}customer=null;}

  function end(){release();active=null;}

  const ready=()=>!customer||!!customer.serving;

  const geom=()=>root.SkyWorld.geometry;

  function label(m,x,y,z,w,text,c='#12333b',tc='#f4efd7',h=.26){m.push({v:[[x-w/2,y+h,z],[x+w/2,y+h,z],[x+w/2,y,z],[x-w/2,y,z]],c,tc,t:text});}

  // A label that always turns to face the player.
  function billboard(m,x,y,z,w,text,look,h=.24){const dx=(look?.x??x)-x,dz=(look?.z??z+1)-z,l=Math.hypot(dx,dz)||1,rx=dz/l*w/2,rz=-dx/l*w/2;m.push({v:[[x-rx,y+h,z-rz],[x+rx,y+h,z+rz],[x+rx,y,z+rz],[x-rx,y,z-rz]],c:'#12333b',tc:'#f4efd7',t:text});}

  // Floating feedback: score pop-ups, speech bubbles, sparks and confetti live in the 3D world.
  function anchor(at){const o=typeof at==='string'?objects.find(o=>o.id===at):at;if(o&&o.x!==undefined)return {x:o.x,y:(o.y??3.4)+.45,z:o.z};if(active?.inCabin)return {x:0,y:4.4,z:-3};if(active?.inTower){const [x,z]=toTower(0,-16);return {x,y:towerFloor(active.state)+3.4,z};}if(customer?.serving)return {x:customer.x,y:4.85,z:customer.z};const s=active?.station;return s?{x:s.x,y:4.6,z:s.z}:{x:0,y:4,z:0};}
  function popup(text,at){if(!text)return;effects.push({kind:'pop',text:String(text).slice(0,34),...anchor(at),t0:time,cabin:!!active?.inCabin});}
  function burst(at,count=26,colors=['#f6d365','#fda085','#9be15d','#6fc3df','#f7f3e3','#e27d9b'],speed=2.4){const p=anchor(at);for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,u=.3+Math.random()*.7;effects.push({kind:'bit',x:p.x,y:p.y-.3,z:p.z,vx:Math.cos(a)*speed*u,vy:1.2+Math.random()*speed,vz:Math.sin(a)*speed*u,c:colors[i%colors.length],t0:time,life:1.4+Math.random()*1.3,cabin:!!active?.inCabin});}}
  function speech(text,at){if(!text)return;let p=anchor(at);const who=customer||lastCustomer;if(!at&&who&&!active?.inCabin)p={x:who.x,y:4.85,z:who.z};else if(typeof at==='string'&&at.startsWith('seat'))p={...p,y:4.25};effects=effects.filter(e=>!(e.kind==='speech'&&Math.hypot(e.x-p.x,e.z-p.z)<.5));effects.push({kind:'speech',text:String(text).slice(0,44),...p,t0:time,life:4.2,cabin:!!active?.inCabin});}
  function drawEffects(m,look){
    const cabin=!!look?.cabin,{box}=geom();effects=effects.filter(e=>time-e.t0<(e.life||1.7));
    for(const e of effects){if(e.cabin!==cabin)continue;const age=time-e.t0;
      if(e.kind==='bit'){const land=(e.vy+Math.sqrt(e.vy*e.vy+19.6*Math.max(0,e.y-2.05)))/9.8,t=Math.min(age,land),y=Math.max(2.05,e.y+e.vy*t-4.9*t*t);box(m,e.x+e.vx*t,y,e.z+e.vz*t,.075,.075,.075,e.c);}
      else if(e.kind==='speech')billboard(m,e.x,e.y,e.z,Math.min(3.4,.35+e.text.length*.072),'“'+e.text+'”',look,.23);
      else billboard(m,e.x,e.y+age*.5,e.z,Math.min(3,.45+e.text.length*.1),e.text,look,.27);}
  }
  function patience(){const j=active?.job;if(!j?.arrivedAt)return 1;const span=Math.max(45000,80000-(j.sequence||0)*2500);return Math.max(0,Math.min(1,1-((j.finishedAt||J.time())-j.arrivedAt)/span));}

  function orb(m,x,y,z,rx,ry,rz,c){const rings=7,sides=12;for(let i=0;i<rings;i++)for(let n=0;n<sides;n++){const p=(a,b)=>[x+rx*Math.cos(a)*Math.sin(b),y+ry*Math.cos(b),z+rz*Math.sin(a)*Math.sin(b)];const a=n/sides*Math.PI*2,b=(n+1)/sides*Math.PI*2,v=i/rings*Math.PI,u=(i+1)/rings*Math.PI;const verts=[p(a,v),p(b,v),p(b,u),p(a,u)],normals=verts.map(q=>{const n=[(q[0]-x)/(rx*rx),(q[1]-y)/(ry*ry),(q[2]-z)/(rz*rz)],l=Math.hypot(...n)||1;return n.map(v=>v/l);});m.push({v:verts,n:normals,c});}}

  function limb(m,a,b,width,c){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz),mesh=[];geom().box(mesh,0,0,0,width,l,width,c);const up=[dx/l,dy/l,dz/l],r=Math.abs(up[1])<.95?[up[2],0,-up[0]]:[1,0,0],rl=Math.hypot(...r);r.forEach((v,i)=>r[i]=v/rl);const f=[r[1]*up[2]-r[2]*up[1],r[2]*up[0]-r[0]*up[2],r[0]*up[1]-r[1]*up[0]];for(const face of mesh)m.push({...face,v:face.v.map(p=>p.map((v,i)=>a[i]+p[0]*r[i]+p[1]*up[i]+p[2]*f[i]))});}

  function suitcase(m,x,y,z,c='#9a6650',tag=''){const {box}=geom();box(m,x,y,z,.62,.82,.34,c);for(const dx of [-.24,.24]){orb(m,x+dx,y+.03,z,.07,.07,.07,'#26333a');box(m,x+dx,y+.15,z+.18,.03,.55,.015,'#d5b293');}box(m,x,y+.85,z,.3,.055,.055,'#293c42');for(const dx of [-.14,.14])box(m,x+dx,y+.73,z,.035,.12,.035,'#bcc4bf');if(tag)label(m,x,y+.53,z+.185,.47,tag,'#f0e7cb','#29434a',.17);}

  function human(p,seated=false){

    const m=[],{box,transformed}=geom(),wave=p.moving?Math.sin(p.phase)*.5:Math.sin(time*1.6+p.id)*.025,bob=p.moving?Math.abs(Math.sin(p.phase))*.04:0;

    box(m,0,1.02+bob,0,.46,.55,.26,p.color);orb(m,0,1.79+bob,0,.20,.25,.18,p.skin);orb(m,0,1.94+bob,.015,.205,.12,.185,'#343334');box(m,-.065,1.79+bob,-.172,.028,.026,.025,'#172d35');box(m,.065,1.79+bob,-.172,.028,.026,.025,'#172d35');

    for(const s of [-1,1]){

      const hip=[s*.14,1.05,0],knee=seated?[s*.14,.75,-.4]:[s*.14,.56,Math.sin(s*wave)*.43],foot=seated?[s*.14,.26,-.4]:[s*.14,.12,-Math.sin(s*wave)*.53];

      limb(m,hip,knee,.19,'#354958');limb(m,knee,foot,.17,'#354958');box(m,foot[0],foot[1]-.09,foot[2]-.06,.19,.12,.32,'#22313a');

      const hand=p.clap?[s*(.06+Math.abs(Math.sin(time*15+p.id))*.1),1.52,-.34]:[s*.31,seated?1.05:1.0, seated?-.4:Math.sin(-s*wave)*.5-(p.serving?.22:0)];limb(m,[s*.29,1.5+bob,0],[s*.34,1.24,hand[2]*.5],.13,p.color);limb(m,[s*.34,1.24,hand[2]*.5],hand,.12,p.color);orb(m,...hand,.075,.10,.075,p.skin);

    }

    if(p.role){box(m,.13,1.38,-.14,.12,.15,.025,'#edf0d2');box(m,0,1.17,-.142,.03,.36,.01,'#d7bc6c');}

    else if(!seated&&!p.serving&&!p.checkedBag)suitcase(m,.58,.08,.35,palette[p.id%palette.length]);

    // Positive yaw keeps the model's face (-z) pointing along its walking direction (sin yaw, -cos yaw).
    return transformed(m,p.x,seated?2.35:2,p.z,p.yaw,0,0,1);

  }

  function terminal(){

    if(staticTerminal)return staticTerminal;const m=[],{box}=geom();

    // The ATC lobby holds the lift up to the control tower.
    {const [x,z]=desks.atc;box(m,x,2,z-.2,4.2,3.6,1.1,'#5d6f73');for(const s of [-1,1])box(m,x+s*.72,2,z+.36,1.4,3.1,.06,'#a9b8b6');box(m,x,5.6,z+.36,4.2,.4,.06,'#18363f');label(m,x,5.66,z+.4,3.6,'LIFT · CONTROL TOWER',undefined,undefined,.26);}
    for(const [role,[x,z]] of Object.entries(desks)){if(role==='security'||role==='atc')continue;box(m,x,2,z,role==='ground'?5:4.2,1.15,1.5,'#7a7164');box(m,x,3.15,z,4.5,.13,1.7,'#d4d7cd');box(m,x+1.3,3.3,z-.3,.1,.3,.1,'#344d56');box(m,x+1.3,3.55,z-.3,1.9,1.1,.09,'#18363f');label(m,x+1.3,4.43,z-.245,1.6,role.toUpperCase(),undefined,undefined,.17);box(m,x+1.3,3.3,z+.23,.85,.04,.27,'#344852');}

    box(m,409.1,3.28,34.2,1.15,.12,.55,'#243a42');box(m,409.1,3.4,34.2,.82,.025,.38,'#89bcc0');

    box(m,411.35,3.28,34.5,1.15,.5,.8,'#d5d8c9');box(m,411.35,3.7,34.92,.9,.055,.03,'#253d42');

    box(m,406.3,2,34,2.6,.32,2,'#a6bab5');box(m,406.3,2.32,34,2.5,.07,1.9,'#425a61');

    for(let z=31;z<35;z+=.22)box(m,406.3,2.3,z,2.2,.1,.10,'#9eaaa4');

    // Rubber curtain where checked bags leave the belt for the baggage hall.

    box(m,406.3,3.55,30.95,2.6,.2,.12,'#344852');for(let i=0;i<6;i++)box(m,405.25+i*.42,2.4,30.95,.38,1.15,.04,'#1f2b30');

    // A tray conveyor, inspection tray and scanner portal beside the security console.

    box(m,384.6,2,-16.4,5.5,1.0,3.8,'#829992');box(m,384.6,3,-16.4,5.4,.1,3.7,'#263f4b');

    for(const x of [382,387.2])box(m,x,3,-18.1,.25,1.4,1,'#96aba5');box(m,384.6,4.4,-18.1,5.45,.25,1,'#96aba5');

    // Restricted-items tray on its own stand, and the operator console with a standing control panel.
    box(m,secTray.x,2,secTray.z,1.3,1.1,1.1,'#829992');box(m,secTray.x,3.1,secTray.z,1.2,.1,1.0,'#d5b973');label(m,secTray.x,3.2,secTray.z+.51,1.1,'RESTRICTED',undefined,undefined,.15);
    box(m,secConsole.x,2,secConsole.z,1.6,1.2,.7,'#7a7164');box(m,secConsole.x,3.2,secConsole.z-.2,1.7,2.05,.08,'#18363f');label(m,secConsole.x,5.3,secConsole.z-.15,1.6,'SECURITY',undefined,undefined,.17);

    // Cabin boarding bridge and actual door to the walkable interior.

    box(m,353,2,-83,4,.12,3,'#47736d');label(m,353,4.4,-84,4,'A2 / BOARD AIRCRAFT',undefined,undefined,.48);

    // A maintenance strut and wheel rather than a flat wheel diagram.

    box(m,371,2,158,1.8,.15,2,'#b9c1b9');

    // The turnaround aircraft is parked at its service stand, clear of the runway.

    // (The aircraft itself is drawn by aircraft() so the tug can push it back.)

    // Fuel cart with tank, hose, towbar and tug.

    box(m,314,2,212,2.2,.7,3,'#dfbb54');orb(m,314,3.1,212,1,1,1.25,'#c4c9b8');for(const dx of [-1,1])for(const dz of [-1,1])orb(m,314+dx,2.35,212+dz,.2,.35,.35,'#273537');

    for(let i=0;i<8;i++)limb(m,[315+i*.45,2.2,213+Math.sin(i*.5)],[315+(i+1)*.45,2.2,213+Math.sin((i+1)*.5)],.07,'#34423d');

    box(m,322,2,211,2.4,.75,3.2,'#d2bb77');box(m,322,2.8,210.5,1.6,.9,1,'#426978');limb(m,[322,2.3,212],[323,2.3,215],.15,'#abb7ad');

    staticTerminal=m;return m;

  }

  function cabin(){

    if(staticCabin)return staticCabin;const m=[],{box,face}=geom();

    box(m,0,1.8,-5,6,.2,22,'#b9bbac');box(m,0,2,-5,1.4,.035,21,'#496b77');

    // Continuous curved pressure shell, with glazing only inside actual window cut-outs.

    for(const side of [-1,1]){

      box(m,side*3,2,-5,.15,1.45,22,'#cdd5cf');box(m,side*3,4.45,-5,.15,.55,22,'#dce0d5');

      for(let z=-15.5;z<5.5;z+=2){box(m,side*3,3.45,z,.15,1,1,'#e2e5db');const f=[];box(f,side*3,3.45,z+1,.10,1,1,'#9ccedc');f.forEach(p=>p.a=.5);m.push(...f);box(m,side*2.95,3.45,z+.51,.18,1,.08,'#f1eee0');}

      for(let i=0;i<6;i++){const a=i/6*Math.PI/2,b=(i+1)/6*Math.PI/2;face(m,[[side*3*Math.cos(a),5+1.2*Math.sin(a),-16],[side*3*Math.cos(b),5+1.2*Math.sin(b),-16],[side*3*Math.cos(b),5+1.2*Math.sin(b),6],[side*3*Math.cos(a),5+1.2*Math.sin(a),6]],'#dbe2dc');}

      box(m,side*2.2,4.8,-5,1.3,.55,20,'#bfcfc9');box(m,side*.85,5.5,-5,.07,.04,20,'#f8eed1');

    }

    box(m,0,2,-16,6,4,.15,'#426574');box(m,0,2,6,6,4,.15,'#426574');label(m,0,4.5,-15.88,3.3,'SKY PLANE / CABIN',undefined,undefined,.5);

    for(let i=0;i<12;i++){const x=i%2===0?-1.7:1.7,z=2-Math.floor(i/2)*2.5;box(m,x,2,z,.85,.52,.85,'#3d596d');box(m,x,2.5,z+.35,.92,1.15,.19,'#52788b');box(m,x,3.45,z+.36,.78,.32,.21,'#e0decb');for(const dx of [-.52,.52])box(m,x+dx,2.6,z,.10,.13,1,'#a5b5b2');}

    box(m,-1.8,2,4.8,1.7,1.7,1,'#b4c3be');label(m,-1.8,3.2,5.32,1.4,'GALLEY / INTERPHONE');box(m,1.8,2,4.8,1.6,1.5,1,'#c4c9be');label(m,1.8,3.2,5.32,1.4,'DOOR / RETURN TO A2');

    staticCabin=m;return m;

  }

  function interactable(m,id,x,y,z,labelText,action,kind='button',detail='',w=.7){

    const {box}=geom(),firstFace=m.length;objects.push({id,x,y,z,label:labelText,action,detail,width:kind==='case'?.68:w,height:kind==='case'?.9:kind==='paper'?.44:.34,depth:kind==='case'?.4:.2,cabin:!!active?.inCabin});

    if(kind==='case')suitcase(m,x,y-.5,z,'#90735c','SP / '+id.replace('bag','0'));

    else if(kind==='paper'){box(m,x,y-.16,z,w,.42,.025,'#eee9d7');label(m,x,y+.03,z+.017,w*.95,labelText,'#e9e5d7','#1f3946',.12);for(let i=0;i<22;i++)box(m,x-w*.4+i*w*.026,y-.12,z+.019,w*.012,.085,.007,'#243e48');}

    else if(!['evidence','fixture'].includes(kind)){box(m,x,y-.16,z,w,.3,.12,'#416c71');label(m,x,y-.11,z+.07,w*.96,labelText,'#173d46','#f6efd1',.21);}
    if(active?.inCabin&&z>4)for(let i=firstFace;i<m.length;i++)m[i]={...m[i],v:m[i].v.map(p=>[2*x-p[0],p[1],2*z-p[2]])};

  }

  function gauge(m,x,y,z,g,lo,hi){

    const {box}=geom();box(m,x,y,z,1.8,.11,.03,'#162f36');box(m,x-.9+(lo+hi)/200*1.8,y,z+.03,(hi-lo)/100*1.8,.12,.02,'#b4d97f');

    if(g){const phase=((J.time()-g.start)%g.period)/g.period,pos=phase<.5?phase*2:2-phase*2;box(m,x-.9+pos*1.8,y-.04,z+.05,.035,.20,.02,'#fff1c6');}

  }

  function equipment(m,look){

    objects=[];if(!active)return;const {role,job:j,station:s}=active,has=k=>j?.done.includes(k),add=(id,x,y,z,text,action,kind,detail,w)=>interactable(m,id,x,y,z,text,action,kind,detail,w);

    if(look?.tower){if(role==='atc')towerEquipment(m,look);return;}

    if(look?.cabin){

      const clapping=!!(j.demo?.doneAt&&J.time()-j.demo.doneAt<6500);

      for(let i=0;i<12;i++){const x=i%2===0?-1.7:1.7,z=2-Math.floor(i/2)*2.5,seat=j.seats[i],request=j.requests?.find(r=>r.id===i&&!r.served),pending=(seat.needsBelt||seat.needsTray)&&!seat.fixed,call=j.calls?.find(c=>c.id===i&&c.ringing&&!c.answered);

        m.push(...human({id:i,x,z,yaw:0,color:palette[i%6],skin:i%2?'#b38464':'#d5ac91',phase:i,clap:clapping},true));

        // A lit call bell above the seat, pulsing until you answer it.
        if(call){const glow=.07+Math.abs(Math.sin(time*5))*.05;orb(m,x,4.42,z+.15,glow,glow*.6,glow,'#ffb238');geom().box(m,x,4.52,z+.15,.34,.05,.34,'#f3e2b0');}

        label(m,x,3.54,z+.48,.35,`${Math.floor(i/2)+1}${i%2?'B':'A'}`,undefined,undefined,.10);

        const beltZ=z-.28;limb(m,[x-.3,3.17,beltZ],[x+.3,3.17,beltZ+(seat.needsBelt&&!seat.fixed?.35:0)],.045,pending?'#dcb858':'#25373f');

        if(seat.needsTray&&!seat.fixed)geom().box(m,x,3,z-.64,.66,.06,.5,'#c1c7ba');

        add('seat'+i,x+(x<0?.55:-.55),3.2,z,`${Math.floor(i/2)+1}${i%2?'B':'A'} ${pending?(seat.needsBelt?'Fasten belt':'Stow tray'):call?'Answer call bell':request?'Serve '+request.drink:'Secure'}`,pending?'fix:'+i:call?'attend:'+i:request?'serve:'+i:'@read','fixture',`${names[i]} · ${pending?'Please help me secure my '+(seat.needsBelt?'seat belt.':'tray table.'):call?call.line:request?'May I have '+request.drink+', please?':'Ready for departure.'}`, .65);

      }

      for(const b of j.bins){const z=1-b.id*5;geom().box(m,-2,4.8,z,1.4,b.open?.1:.4,3.8,'#d4dbcf');if(b.open)suitcase(m,-2,4.87,z,'#a57755');geom().box(m,-1.2,4.55,z,.1,.16,.36,b.open?'#d3b56b':'#718d93');add('bin'+b.id,-1.2,4.65,z,b.open?'Close overhead bin':'Bin latched','bin:'+b.id,'fixture','Pull the latch to close this overhead locker.',1.2);}

      add('water',-.6,3.4,4.12,'Collect water','drink:water','button','Take a cup to the passenger who asked for water.',1);add('juice',.6,3.4,4.12,'Collect juice','drink:juice','button','Take a cup to the passenger who asked for juice.',1);
      if(j.drink)orb(m,look.x+.4,3.3,look.z-.7,.11,.17,.11,j.drink==='water'?'#9ed3df':'#e9b355');
      if(j.complete)add('next',0,4.45,4.12,'Next cabin shift','@next','button','Start another cabin shift after the cooldown.',1.8);
      add('cabin-ready',-1.8,3.5,4.12,'Report cabin ready','release','button','Use the interphone after checking every passenger and locker.',1.4);

      add('exit',1.8,3.5,4.12,'Return to gate A2','@exit','button','',1.4);

      // Safety demonstration wall: listen to the announcement and hold up the matching prop.
      const d=j.demo;if(d){const props=[['belt',-1.95],['mask',-.65],['vest',.65],['exit',1.95]],title={belt:'Seat belt',mask:'Oxygen mask',vest:'Life vest',exit:'Exits'},{box}=geom(),pz=-15.75;
        for(const [k,px] of props){const shown=d.order.indexOf(k)<d.step,py=3.85+(shown?.12+Math.abs(Math.sin(time*3+px))*.04:0);
          if(k==='belt'){limb(m,[px-.36,py+.1,pz],[px-.06,py+.1,pz],.06,'#39505c');limb(m,[px+.06,py+.1,pz],[px+.36,py+.1,pz],.06,'#39505c');box(m,px-.02,py+.04,pz,.16,.12,.06,'#c9ccc4');}
          else if(k==='mask'){orb(m,px,py+.12,pz+.02,.13,.11,.08,'#f2c94c');limb(m,[px,py+.2,pz],[px,py+.5,pz],.025,'#dfe3da');box(m,px,py-.14,pz,.2,.14,.03,'#e6d57d');}
          else if(k==='vest'){box(m,px,py-.12,pz,.5,.45,.06,'#f0a93b');orb(m,px,py+.33,pz+.02,.12,.06,.04,'#f0a93b');limb(m,[px-.2,py,pz+.04],[px+.2,py,pz+.04],.03,'#2b3a40');}
          else{box(m,px,py-.05,pz,.7,.35,.05,'#2f9c5a');label(m,px,py+.02,pz+.03,.6,'EXIT',undefined,undefined,.2);}
          add('demo-'+k,px,3.45,pz,title[k],'demo:'+k,'button','Hold up the '+title[k].toLowerCase()+' when the announcement mentions it.',1.1);}
        if(!d.started)add('demo-start',0,2.9,pz,'Start safety demo','demoStart','button','Begin the safety announcement, then show each prop as it is mentioned.',1.8);
        label(m,0,5.1,-15.8,3.2,!d.started?'SAFETY DEMONSTRATION':d.step>=d.order.length?'DEMO COMPLETE · BRAVO!':'NOW SHOW: '+title[d.order[d.step]].toUpperCase(),undefined,undefined,.32);}

      m.push(...human({id:44,x:2.45,z:-13.2,yaw:-Math.PI/2,color:'#254c68',skin:'#97694f',role:'cabin',clap:clapping}));return;

    }

    if(role==='cabin'){if(j.complete)add('next',353,4.2,-83,'Next cabin shift','@next','button','',2);add('board',353,3.2,-83,'Board cabin','@board','button','Enter the aircraft to help passengers and prepare the cabin.',2);return;}

    const [x,z]=desks[role];

    if(role==='checkin'){

      add('passport',x-.9,3.56,z+.15,'PASSPORT / SCAN','scan','paper',has('scan')?`${j.name} | ${j.flightCode} | ${j.expired?'EXPIRED three months ago':'Valid until 2031'} | Compare the photo with the person at your desk`:'Read the passport on the document scanner.',.95);

      add('ticket',x+.15,3.45,z+.18,'BOARDING TICKET','@ticket','paper',`${j.ticketName} | ${j.ticketFlight} | Gate A2 | Seat 4A`,.95);

      if(has('scan')){label(m,x-.85,3.92,z+.15,1.0,j.name,undefined,undefined,.2);label(m,x-.85,4.14,z+.15,1.0,j.flightCode+' / '+(j.expired?'EXPIRED':'VALID'),undefined,undefined,.2);
        // Passport photo: shirt colour and skin tone must match the customer standing in front of you.
        if(j.photo){const {box}=geom(),px=x-1.55,pz=z+.2;box(m,px,3.4,pz,.38,.5,.03,'#e9e5d7');box(m,px,3.44,pz+.02,.3,.2,.02,j.photo.color);orb(m,px,3.72,pz+.035,.085,.1,.02,j.photo.skin);orb(m,px,3.8,pz+.04,.09,.05,.02,'#343334');label(m,px,3.93,pz+.02,.4,'PHOTO',undefined,undefined,.1);}}

      // Patience meter above the customer's head: finish while they're happy for a tip.
      if(customer?.serving&&!j.complete){const {box}=geom(),p=patience(),w=1.1;box(m,customer.x,4.62,customer.z,w+.06,.1,.05,'#1b2c31');box(m,customer.x-w/2+w*p/2,4.63,customer.z+.03,Math.max(.02,w*p),.08,.03,p>.6?'#8fd46a':p>.3?'#f0c14b':'#e0654f');}

      for(const b of j.bags){if(b.loaded){
        // Checked bags ride the belt through the curtain and drop into the baggage hall.
        if(!b.loadedAt)continue;const e=(J.time()-b.loadedAt)/1000,bz=34.6-Math.min(3.9,e*1.3),by=2.45-Math.max(0,e-3)*2.2;if(by>1.2)suitcase(m,406.3,by,bz,'#90735c',j.flightCode);continue;}
        if(b.weighed&&b.weighedAt){const shown=Math.round(b.weight*Math.min(1,(J.time()-b.weighedAt)/700));label(m,x-2.7-b.id*.85,3.34,z+.42,.62,shown+' KG'+(shown===b.weight&&b.weight>20?(b.tagged?' ✓':' !'):''),undefined,undefined,.18);}const bx=x-2.7-b.id*.85;add('bag'+b.id,bx,2.85,z+.2,b.loaded?'Loaded':!b.weighed?'Weigh bag':b.weight>20&&!b.tagged?'Apply excess tag':'Load onto belt',b.loaded?'@read':!b.weighed?'weigh:'+b.id:b.weight>20&&!b.tagged?'tag:'+b.id:'load:'+b.id,'case',`Case ${b.id+1} · ${b.weighed?b.weight+' kg':'Place on scale'}${b.tagged?' · EXCESS TAG ATTACHED':''}`,.65);}

      add('window',x-.65,2.85,z+.85,'Window seat','seat:4A','button','Choose seat 4A by the window.',.9);add('aisle',x+.35,2.85,z+.85,'Aisle seat','seat:4B','button','Choose seat 4B by the aisle.',.9);
      add('accept',x+1.35,3.55,z+.97,'Issue pass','accept','button','Confirm that the document and ticket match.',.9);add('refer',x+1.35,4.05,z,'Refer passenger','refer','button','Send an invalid document to the service desk.',1.5);

      if(has('decision')&&j.valid)add('printed',x+.1,3.75,z+.55,'Hand over pass','givePass','paper',`${j.name} | ${j.flightCode} | A2 | ${j.seat||'4A'} | BOARDING APPROVED`,1.3);

    }else if(role==='security'){

      const cz=secConsole.z-.08;add('scanner',secConsole.x,4.75,cz,'Run X-ray','scan','button','Scan the waiting customer’s tray.',1.5);

      // Belongings come to rest on the belt in two rows in front of you: near-row labels sit on the belt edge, far-row labels float above.
      for(const it of j.items){const row=Math.floor(it.id/4),bx=382.85+(it.id%4)*1.25,bz=row?-16.5:-15.2;if(has('scan')){

        add('item'+it.id,bx,3.32,bz,it.handled?'Secured':it.cleared?'Returned':`${it.id+1} · ${it.label}`,it.handled||it.cleared?'@read':'inspectItem:'+it.id,'evidence',it.handled?'Moved into inspection tray':`${it.label} · check item ${it.id+1} on the X-ray monitor above the scanner`,.85);

        // Items ride out of the scanner tunnel one by one after the X-ray runs.
        const slide=j.scannedAt?Math.max(0,Math.min(1,(J.time()-j.scannedAt-600-it.id*280)/650)):1;if(slide<=0&&!it.handled)continue;const ease=slide*slide*(3-2*slide);
        const px=it.handled?secTray.x-.3+(it.id%2)*.6:bx,pz=it.handled?secTray.z-.25+(it.id%3)*.25:-18.1+(bz+18.1)*ease,dy=it.handled?.1:0,col={organic:'#c99a70',metal:'#8fb0bd',mixed:'#9cb88f'}[it.material]||'#81b8bd';

        if(/bottle|fluid|spray/.test(it.cls)){orb(m,px,3.3+dy,pz,.16,.3,.16,col);geom().box(m,px,3.52+dy,pz,.11,.10,.11,'#dfd7b9');}

        else if(/knife|scissors|cutter|multitool/.test(it.cls)){limb(m,[px-.25,3.22+dy,pz-.1],[px+.25,3.42+dy,pz+.1],.09,'#b9c9c6');orb(m,px-.23,3.2+dy,pz-.1,.14,.08,.12,'#4c6f7c');if(it.cls==='scissors')limb(m,[px-.25,3.4+dy,pz],[px+.25,3.22+dy,pz],.07,'#c7d3cf');}

        else{geom().box(m,px,3.14+dy,pz,.65,it.cls==='laptop'?.05:.19,.44,col);if(it.cls==='book')geom().box(m,px+.02,3.18+dy,pz,.59,.10,.41,'#e3dfc9');}

        if(slide>=1||it.handled)label(m,bx,row?3.72:3.1,row?bz:bz+.38,1.1,it.handled?'INSPECTED':`${it.id+1} · ${it.label}`,undefined,undefined,.16);

      }}

      // X-ray monitor mounted on the scanner arch: colour shows material, shape shows what is inside.
      {const {box}=geom(),mz=-17.52,mx=384.6,shade={organic:'#e8913a',metal:'#4d8fe0',mixed:'#4fb56b'};box(m,mx,4.72,mz-.05,4.7,1.45,.06,'#0b1a1f');box(m,mx,4.66,mz-.04,4.8,.06,.1,'#44585f');
        label(m,mx,5.93,mz+.02,4.4,'X-RAY · ORANGE ORGANIC · BLUE METAL · GREEN MIXED',undefined,undefined,.16);
        if(!has('scan'))label(m,mx,5.2,mz+.02,1.6,'STANDBY',undefined,undefined,.22);
        else{const age=J.time()-j.scannedAt;if(age<1400)box(m,mx-2.3+age/1400*4.6,4.75,mz,.05,1.35,.02,'#c9fbff');
          for(const it of j.items){if(age<250+it.id*170)continue;const cx=mx-1.65+(it.id%4)*1.1,cy=5.42-Math.floor(it.id/4)*.62,c=shade[it.material]||shade.mixed,fz=mz+.01;
            if(it.concealed){box(m,cx,cy+.02,fz,.5,.3,.01,c);limb(m,[cx-.18,cy+.08,fz+.015],[cx+.18,cy+.26,fz+.015],.05,shade.metal);}
            else if(/knife|scissors|cutter|multitool/.test(it.cls)){limb(m,[cx-.25,cy+.06,fz],[cx+.25,cy+.28,fz],.06,c);orb(m,cx-.23,cy+.06,fz,.09,.06,.01,c);if(it.cls==='scissors')limb(m,[cx-.25,cy+.28,fz],[cx+.25,cy+.06,fz],.05,c);}
            else if(/bottle|fluid|spray/.test(it.cls))orb(m,cx,cy+.17,fz,it.cls==='bigbottle'?.13:.08,it.cls==='bigbottle'?.17:.12,.01,c);
            else if(it.cls==='umbrella')limb(m,[cx-.3,cy+.12,fz],[cx+.3,cy+.2,fz],.05,c);
            else box(m,cx,cy+.04,fz,it.cls==='laptop'?.52:.36,it.cls==='laptop'?.1:.24,.01,c);
            label(m,cx,cy-.15,mz+.02,.95,it.handled||it.cleared?`${it.id+1} ✓ CHECKED`:it.concealed?`${it.id+1} !! BLADE SHAPE`:`${it.id+1} ${it.material.toUpperCase()}`,undefined,undefined,.13);}}
        // Alarm beacon: flashes red while a restricted item is still on the belt.
        const threat=has('scan')&&j.items.some(i=>i.hazard&&!i.handled);orb(m,381.7,4.95,-17.6,.14,.14,.14,!has('scan')?'#4e5a5c':threat?((time*2.5)%1<.5?'#ff3b2f':'#6a2a26'):'#7ee06b');}

      add('confiscate',secTray.x,3.62,secTray.z+.62,'Restricted tray','confiscate','button','Place the selected restricted item here.',1.2);add('returnItem',secConsole.x,4.3,cz,'Return safe item','returnItem','button','Give the selected permitted item back.',1.5);
      add('clear',secConsole.x,3.85,cz,'Release bag','release','button','Only release after removing restricted items.',1.5);

    }else if(role==='ground'){

      // A placed bag is swung up through the hold door in an arc.
      for(const b of j.bags)if(b.zone&&b.loadedAt&&!j.releasedAt){const k=(J.time()-b.loadedAt)/850;if(k<1){const hx=b.zone==='fragile'?304.5:301.5,bag=[];suitcase(bag,0,-.41,0,'#90735c',b.fragile?'FRAGILE':'SP / HOLD');m.push(...geom().transformed(bag,hx,3.3+k*.4+Math.sin(k*Math.PI)*.9,229.6-k*2,0,k*2.4,0,1-k*.55));}}

      for(const b of j.bags)if(!b.zone&&j.selected!==b.id)add('bag'+b.id,x-1.9+b.id*.8,3.78,z+.3,'Case '+(b.id+1)+(b.fragile?' FRAGILE':''),'select:'+b.id,'case',`${b.weight} kg · ${j.selected===b.id?'Carrying':'Pick up this bag'}`);

      if(!j.releasedAt)add('standard',301.5,3.8,227.8,'Standard hold','zoneStandard','button','Place the carried bag in the aircraft hold.',1.6);if(!j.releasedAt)add('fragile',304.5,3.8,227.8,'Fragile hold','zoneFragile','button','Place fragile luggage in the padded compartment.',1.6);

      if(j.selected!==null){const carry=[];suitcase(carry,.65,-.5,-1.15,'#90735c',j.bags[j.selected]?.fragile?'FRAGILE':'SP / HOLD');m.push(...geom().transformed(carry,look.x,3.3,look.z,look.yaw));}

      add('chocks',309.8,2.8,229,'Remove chocks',has('chocks')?'@read':'chocks','button','Remove wheel chocks before requesting pushback.',1.5);if(!has('chocks'))geom().box(m,309,2.05,228.3,.6,.35,.6,'#dfad4c');
      if(j.selected!==null)add('putDown',x,4.6,z+.3,'Put bag back','putDown','button','Return the carried bag to the cart.',1.6);
      add('fuel',314,3.9,213,'Fuel '+(has('fuel')?'complete':j.fuelGauge?'STOP':'START'),has('fuel')?'@read':j.fuelGauge?'pumpStop':'pumpStart','button',`Stop in the ${j.fuelTarget.join('–')}% target band.`,1.6);gauge(m,314,4.4,213,j.fuelGauge,...j.fuelTarget);

      const signal=j.signalAt,now=J.time(),lit=signal&&now>=signal.ready&&now<=signal.ready+j.signalWindowMs;

      add('tug',322,3.9,212,has('tug')?'Tug connected':!signal?'Arm clearance':lit?'CONNECT NOW':now>signal.ready+j.signalWindowMs?'Rearm clearance':'Await clearance',has('tug')?'@read':signal&&now<=signal.ready+j.signalWindowMs?'tug':'armSignal','button','Load bags and finish refuelling before pushback.',1.7);

      orb(m,322,4.5,212,.15,.15,.15,lit?'#b7ef72':'#bc744d');add('release',x,5.05,z,'Signal departure ready','release','button','',2.1);

    }else if(role==='engineer'){

      add('inspect',370.15,4.45,158.8,'Inspect / SIZE '+j.spec,'inspect','button','Inspect the tyre and read the specification plate.',1.5);

      for(const o of j.options)add('spare'+o.id,x-1.25+o.id*1.15,3.6,z+.2,'Wheel '+o.size,'pick:'+o.id,'button','Choose the wheel size stamped on the damaged assembly.',1);

      add('jack',374,4.3,158.5,has('jack')?'Lower jack':'Raise jack',has('lower')?'@read':has('jack')?'lower':'jack','button','Support the aircraft before fitting the wheel; lower after torquing.',1.6);
      add('fit',371.85,4.45,158.8,'Fit replacement','replace','button','',1.5);

      for(const b of j.bolts){const bx=369.55+(b.id%2)*2.9,by=2.5+Math.floor(b.id/2)*.6;add('bolt'+b.id,bx,by,159,b.done?'Torqued':b.gauge?'TORQUE NOW':'Start bolt '+(b.id+1),b.done?'@read':b.gauge?'boltStop:'+b.id:'boltStart:'+b.id,'button','Stop the wrench in the green band.',.9);if(b.gauge)gauge(m,371,4.95,159,b.gauge,42,58);}

      add('test',x+2.1,4.5,z+.6,'Check and sign release','test','button','Inspect, replace, then torque all four wheel bolts.',2.2);

    }else if(role==='pilot'){
      if(j.selectedFlight){add('weather',407.7,5.0,z+.4,'Check weather','@weather','button','Review weather and difficulty.',1.7);add('fuelcheck',409.7,5.0,z+.4,'Aircraft / fuel','@fuelcheck','button','Review the aircraft and fuel plan.',1.8);add('dispatch',408.7,5.5,z+.4,'Board selected flight','@dispatch','button','Complete preflight, then board at gate A1.',2.4);}

      let i=0;for(const [key,mission] of Object.entries(root.SkyCore.MISSIONS)){if(active.missions?!active.missions.includes(key):key==='return'||key==='training')continue;// Three columns keep up to nine flights below the preflight buttons.
        add('flight'+key,x-1.4+(i%3)*1.4,3.6+Math.floor(i/3)*.45,z+.2,mission.title,'@flight:'+key,'button',mission.aircraft,1.3);i++;}

      // Weather radar: the sweep reveals cells that match the airport's live weather.
      {const {box}=geom(),rx=405.3,ry=4.35,wx=active.state?.settings.weather||'clear';box(m,rx,3.2,z-.12,2.1,2.4,.06,'#1b2f37');orb(m,rx,ry,z-.05,.8,.8,.02,'#0c2a22');for(const r of [.4,.78])for(let k=0;k<24;k++){const a=k/24*Math.PI*2;box(m,rx+Math.cos(a)*r,ry+Math.sin(a)*r,z-.03,.02,.02,.01,'#2f6b52');}
        const a=time*1.8;limb(m,[rx,ry,z-.02],[rx+Math.cos(a)*.76,ry+Math.sin(a)*.76,z-.02],.03,'#7cf0a0');
        const cells={storm:[[.3,.2,'#e0513a'],[.42,.02,'#f2c94c'],[-.2,-.3,'#f2c94c'],[.08,.48,'#58c26f'],[-.45,.15,'#e0513a']],overcast:[[.25,.3,'#58c26f'],[-.3,-.1,'#58c26f'],[.1,-.4,'#f2c94c']],sunset:[[-.35,.25,'#58c26f']]}[wx]||[];
        for(const [cx,cy,c] of cells){const behind=((a-Math.atan2(cy,cx))%(Math.PI*2)+Math.PI*2)%(Math.PI*2),glow=Math.max(.45,1-behind/5);orb(m,rx+cx,ry+cy,z-.02,.13*glow+.03,.1*glow+.02,.01,c);}
        label(m,rx,5.3,z,2,'WX RADAR · '+wx.toUpperCase(),undefined,undefined,.26);}

      // ATC clearance delivery: request, memorise the squawk, then read it back.
      {const ax=412.9,a=j.atc,{box}=geom(),fresh=a&&J.time()-a.issuedAt<7000;box(m,ax,2.95,z-.12,2.5,2.7,.06,'#1b2f37');label(m,ax,5.25,z,2.3,'ATC · CLEARANCE DELIVERY',undefined,undefined,.28);
        add('atc-title',ax,5.4,z,'ATC clearance','@read','evidence',a?`${a.callsign}, cleared as filed, runway ${a.runway}, climb ${a.altitude} feet${fresh?', squawk '+a.squawk:'. Squawk code: listen again with “Say again”'}.`:'Finish the weather and fuel checks, then request your clearance.',2.3);
        if(!a)add('clearance',ax,4.3,z,'Request clearance','clearance','button','Call ATC for your departure clearance. Remember the squawk code!',2.1);
        else if(!j.done.includes('readback')){label(m,ax,4.85,z,2.2,`RWY ${a.runway} · CLIMB ${a.altitude}`,undefined,undefined,.24);if(fresh)label(m,ax,4.52,z,2.2,'SQUAWK '+a.squawk,undefined,undefined,.24);
          a.options.forEach((o,i)=>add('squawk'+i,ax-.45,4.1-i*.47,z,'Squawk '+o,'readback:'+i,'button','Read back the squawk code ATC gave you.',1.4));add('sayagain',ax+.8,3.63,z,'Say again','clearance','button','Ask ATC to repeat the clearance. A first-time readback without repeats earns a bonus.',.8);}
        else label(m,ax,4.4,z,2.2,'READBACK CORRECT ✓',undefined,undefined,.28);}

    }else if(role==='atc'){

      add('tower',x,3.7,z+.45,'Take the lift to the tower','@tower','button','Ride up to the control tower cab to work the shift.',2.4);

    }else if(role==='manager'){

      add('board',x+1,3.7,z,'Review departures','@operations','button','Review airport staffing and departures.',1.8);
      add('build',x-1,3.7,z,'Expand terminal','@build:terminal','button',active.state?'Expansion cost: $'+root.SkyCore.price(active.state,'terminal'):'Expand airport capacity.',1.8);

      Object.keys(root.SkyCore.STAFF).forEach((k,i)=>add('hire'+k,x-1+(i%2)*2,4.3+Math.floor(i/2)*.5,z,'Hire '+k,'@hire:'+k,'button','Hiring cost: $'+root.SkyCore.STAFF[k].hire+'  ·  hourly wage: $'+root.SkyCore.STAFF[k].wage,1.8));

      // Live incident desk: situations arrive while you manage; every choice has a trade-off.
      {const {box}=geom(),ix=413.2,inc=j.incident,warn=inc&&(time*2)%1<.5;box(m,ix,3.35,z-.12,3.1,2.2,.06,warn?'#4a2a26':'#1b2f37');
        add('incident-title',ix,5.2,z,inc?inc.title:'No active incident','@read','evidence',inc?inc.text:j.outcome?'Last decision: '+j.outcome.text:'Stay alert. New situations will reach your desk soon.',2.8);label(m,ix,5.05,z,2.8,inc?'!! '+inc.title:'NO ACTIVE INCIDENT',undefined,undefined,.3);
        if(inc)inc.options.forEach((o,i)=>add('incident'+i,ix,4.45-i*.6,z,o.label,'incident:'+i,'button',o.detail,2.6));
        else if(j.outcome)label(m,ix,4.45,z,2.6,`LAST: ${j.outcome.cash>=0?'+':'−'}$${Math.abs(j.outcome.cash)} · REP ${j.outcome.rep>=0?'+':''}${j.outcome.rep}`,undefined,undefined,.26);}

      // Live departures board, updated by your crew's progress.
      {const {box}=geom(),bx=404.8,stages=['CHECK-IN','SECURITY','LOADING','DEPARTING'];box(m,bx,3.35,z-.12,3.2,2.2,.06,'#1b2f37');label(m,bx,5.05,z,3,'DEPARTURES',undefined,undefined,.3);
        (active.state?.departures||[]).slice(0,4).forEach((d,i)=>{label(m,bx-.75,4.6-i*.38,z,1.4,'→ '+d.destination,undefined,undefined,.25);label(m,bx+.8,4.6-i*.38,z,1.4,stages[Math.min(3,d.stage)]+' '+Math.round(Math.min(1,d.progress)*5)*20+'%',undefined,undefined,.25);});}

    }

    // Each desk has its own free spot for "Call next" so it never overlaps other controls.
    if(j?.complete){const [nx,ny,nz]=({checkin:[x+1.3,4.5,z+.08],security:[secConsole.x,3.4,secConsole.z-.08],ground:[x+1.9,4.6,z+.3],engineer:[x+2.4,3.6,z+.75]})[role]||[x+2,3.6,z+.75];add('next',nx,ny,nz,'Call next','@next','button','Your graded pay has been added to the airport. Call the next customer or start the next task.',role==='security'?1.5:1.1);}

  }

  // The turnaround aircraft at gate A1. During a ground-crew shift it waits on its stand with the baggage
  // loaders against its holds; once the crew signal ready the tug pushes it back, the loaders stay on the
  // apron, and it taxis out and takes off. Outside ground shifts it flies its own departures and arrivals.
  let departure=null,a1=null;
  const standPose={x:303,y:0,z:226,yaw:Math.PI/2,pitch:0,parked:true};
  function a1Plan(state){
    const C=root.SkyCore,T=root.SkyWorld.traffic;if(!state||!C||!T||!root.SkyNavigation)return null;
    const isle=C.homeLayout(state)[0],key=isle.map.id+':'+JSON.stringify(isle.buildings||{});if(a1?.key===key)return a1;
    const push=[];
    for(let i=0;i<=6;i++){const th=i/6*Math.PI/2;push.push({x:303-14*Math.sin(th),z:212+14*Math.cos(th),y:0,v:i===0||i===6?.3:1.6,back:i>0});}
    // Depart from whichever runway is the shortest taxi away.
    const options=C.runwaysFor(isle).map(rw=>({rw,out:T.departureRoute(isle,rw,[...push,{x:289,z:236,y:0,v:8},{x:262,z:250,y:0,v:10}])}));
    const lift=o=>(o.out.legs.find(l=>(l.b.y||0)>0)||{t0:o.out.duration}).t0,{rw,out}=options.reduce((a,o)=>lift(o)<lift(a)?o:a);
    const back=T.arrivalRoute(isle,rw,[{x:260,z:240,y:0,v:8},{x:276,z:226,y:0,v:4},{x:303,z:226,y:0,v:.3}]);
    const forward=out.legs.find(l=>!l.b.back);
    return a1={key,out,back,pushTime:forward?forward.t0:0,cycle:T.trafficCycle(out,back,100,90)};
  }
  function aircraft(m,clock,state){
    const {box,transformed}=geom(),j=active?.role==='ground'?active.job:null,now=J.time(),plan=a1Plan(state||active?.state);
    if(!aircraftLocal){aircraftLocal=root.SkyAssets?.cargo?[...root.SkyAssets.cargo]:[];}
    if(j?.releasedAt&&departure?.t0!==j.releasedAt)departure={t0:j.releasedAt};
    const planes=[];let nearStand=false;
    if(departure){const e=(now-departure.t0)/1000-1.5;
      if(plan&&e<plan.out.duration){planes.push({pose:e<0?standPose:root.SkyWorld.traffic.poseAt(plan.out,e),tug:e<plan.pushTime+.5,armed:true});nearStand=e<plan.pushTime+3;}
      else if(!plan&&e<10)planes.push({pose:standPose,tug:true,armed:true});else departure=null;}
    if(j&&!j.releasedAt){if(!nearStand)planes.push({pose:standPose,loaders:true,tug:j.done.includes('tug'),armed:!!(j.signalAt||j.done.includes('tug'))});}
    else if(!j&&!departure){const p=plan?root.SkyWorld.traffic.cyclePose(plan.cycle,clock||0,standPose):standPose;if(p)planes.push({pose:p,loaders:!!p.parked,armed:!p.parked});}
    for(const {pose,loaders,tug,armed} of planes){
      const {x,z,yaw}=pose,y=4+pose.y;
      if(pose.parked){aircraftHome=aircraftHome||transformed(aircraftLocal,303,4,226,Math.PI/2);m.push(...aircraftHome);}
      else m.push(...transformed(aircraftLocal,x,y,z,yaw,pose.pitch||0,0,1));
      const sy=Math.sin(yaw),cy=Math.cos(yaw),at=(fwd,side=0)=>[x+fwd*sy+side*cy,z-fwd*cy+side*sy];
      // Belt loaders sit against the two holds on the stand; they are apron equipment, not part of the aircraft.
      if(loaders)for(const s of [-1,1]){const [lx,lz]=at(-s*1.5,1.6),[rx,rz]=at(-s*1.5,1.85);box(m,lx,3.25,lz,2.4,1.3,.15,'#18313c');box(m,rx,3.22,rz,2.4,.06,.5,'#a1b3ac');}
      // Anti-collision beacons flash once pushback clearance is armed and while the aircraft is moving.
      const on=armed&&(time*1.6)%1<.22;for(const [fx,by] of [[0,5.9],[0,2.35]]){const [bx,bz]=at(fx);orb(m,bx,by+pose.y,bz,.13,.1,.13,on?'#ff3b2f':'#6a2a26');}
      if(tug){const [tx,tz]=at(7.3),[nx,nz]=at(5.1),t=[];box(t,0,2.05,0,1.2,.55,1.9,'#e2b93b');box(t,0,2.6,.35,.95,.5,.7,'#2c4a55');for(const dx of [-.62,.62])for(const dz of [-.6,.6])orb(t,dx,2.18,dz,.13,.18,.18,'#232a2d');m.push(...transformed(t,tx,0,tz,yaw));limb(m,[tx-(tx-nx)*.25,2.35,tz-(tz-nz)*.25],[nx,2.25,nz],.08,'#b9c3bb');
        const lamp=(time*3)%1<.5;orb(m,tx,3.25,tz,.09,.09,.09,lamp?'#ffb238':'#7a5a2a');}
    }
  }

  // Main-gear strut, scissor jack and wheel for the maintenance bay. Everything moves: the jack lifts,
  // the damaged tyre rolls away, the new one slides in, nuts spin under the wrench and the wheel spin-tests.
  function wheelAssembly(m){
    const {box,transformed}=geom(),j=active?.role==='engineer'?active.job:null,t=J.time(),has=k=>!!j?.done.includes(k),ease=(a,d)=>a?Math.max(0,Math.min(1,(t-a)/d)):0;
    const lift=.38*(ease(j?.jackAt,1200)-ease(j?.lowerAt,1200)),y=2.7+lift,z=158.35;
    box(m,371,2.2+lift,158,.28,2,.28,'#aabbbb');box(m,371,2.25+lift,158.2,.18,.18,.5,'#8d9c9c');
    const jh=.18+lift;box(m,371.75,2.15,157.75,.55,.07,.5,'#d9a93c');limb(m,[371.5,2.22,157.75],[372,2.22+jh,157.75],.05,'#e0b545');limb(m,[372,2.22,157.75],[371.5,2.22+jh,157.75],.05,'#e0b545');box(m,371.6,2.22+jh,157.75,.8,.07,.35,'#d9a93c');
    const spokes=(cx,cy,angle,c)=>{for(let i=0;i<3;i++){const a=angle+i*Math.PI*2/3;limb(m,[cx,cy,z+.27],[cx+Math.cos(a)*.52,cy+Math.sin(a)*.52,z+.27],.06,c);}};
    const gone=ease(j?.replacedAt,1400),arrive=j?.replacedAt?ease(j.replacedAt+900,900):0;
    if(j&&(!has('replace')||gone<1)){const ox=371+gone*3.6,roll=-gone*6;orb(m,ox,y-(lift?0:.07),z,.68,lift?.68:.6,.25,'#2a2e31');box(m,ox-.25,y+.28,z+.2,.3,.1,.04,'#9c5b3b');orb(m,ox,y,z+.26,.3,.3,.025,'#6f7a7c');spokes(ox,y,roll,'#57605f');}
    if(!j||has('replace')){const nx=j?373.6-arrive*2.6:371,s=j?.testAt?(t-j.testAt)/1000:0,spin=s<=0?0:s<4?-(12*s-1.5*s*s):-24;
      orb(m,nx,y,z,.68,.68,.25,'#181c1f');orb(m,nx,y,z+.26,.32,.32,.025,'#d4dde0');spokes(nx,y,spin-(1-arrive)*4,'#b3bcb8');
      if(j)for(const b of j.bolts){const px=nx+(b.id%2?.14:-.14),py=y+(Math.floor(b.id/2)?.14:-.14),nut=[];box(nut,0,-.045,0,.09,.09,.05,b.done?'#a8d46f':b.gauge?'#f0b545':'#9aa3a6');m.push(...transformed(nut,px,py,z+.3,0,0,b.gauge?time*9:b.done?.4:0));}}
  }

  // Furniture of the tower cab: the lift core, the controllers' console and the radar pedestal.
  let towerCache=null;
  function towerCab(state){
    const F=towerFloor(state);if(towerCache?.F===F)return towerCache.m;const m=[],{box}=geom();
    box(m,0,F,0,2.8,3.4,2.8,'#5d6f73');for(const s of [-1,1])box(m,s*.5,F,-1.42,.9,2.9,.05,'#a9b8b6');label(m,0,F+3.02,-1.44,2.2,'LIFT',undefined,undefined,.24);
    // A low console keeps the window clear; the displays hang from the ceiling above the sight line.
    box(m,0,F,-16.6,6.6,.8,1.1,'#3b4d55');box(m,0,F+.8,-16.55,6.8,.06,1.25,'#d4d7cd');box(m,0,F+2.4,-17.35,6.6,2.3,.08,'#18313a');
    for(const x of [-3,3])limb(m,[x,F+4.7,-17.35],[x,F+12.5,-17.35],.05,'#8d9c9c');
    for(const [x,t,w] of [[-2.35,'WIND',1.4],[0,'FLIGHT STRIPS',2.6],[2.35,'RUNWAYS',1.4]])label(m,x,F+4.4,-17.3,w,t,undefined,undefined,.2);
    box(m,-4.3,F+2.4,-17.1,1.9,2,.06,'#1b2f37');limb(m,[-4.3,F+4.4,-17.1],[-4.3,F+12.5,-17.1],.05,'#8d9c9c');label(m,-4.3,F+4.1,-17.05,1.7,'APPROACH RADAR',undefined,undefined,.2);
    for(const x of [-4.35,4.35])box(m,x,F,-15.95,.5,1.2,.5,'#344d56');
    towerTurn(m,0);towerCache={F,m};return m;
  }
  function towerEquipment(m,look){
    const C=root.SkyCore,j=active.job,state=active.state,F=towerFloor(state),first=m.length,firstObj=objects.length,{box}=geom(),add=(id,x,y,z,text,action,kind,detail,w)=>interactable(m,id,x,y,z,text,action,kind,detail,w);
    if(C&&state)j.runways=C.runwaysFor(C.homeLayout(state)[0]).map(r=>({name:r.name,deg:r.deg}));
    const best=J.bestRunway(j),pend=J.pendingOf(j),sel=J.selectedOf(j),wind=j.wind||{from:0,kt:0};
    // Wind dial: north is up; the arrow points in from the direction the wind blows from.
    {const cx=-2.35,cy=F+3.65,a=wind.from*Math.PI/180;orb(m,cx,cy,-17.28,.4,.4,.02,'#0c2a22');for(let k=0;k<12;k++){const b=k/12*Math.PI*2;box(m,cx+Math.sin(b)*.36,cy+Math.cos(b)*.36,-17.26,.03,.03,.01,'#2f6b52');}
      label(m,cx,cy+.43,-17.27,.18,'N',undefined,undefined,.1);limb(m,[cx+Math.sin(a)*.36,cy+Math.cos(a)*.36,-17.25],[cx,cy,-17.25],.05,'#f2c94c');orb(m,cx,cy,-17.25,.05,.05,.01,'#f2c94c');}
    add('wind',-2.35,F+2.85,-17.22,`WIND ${wind.from}° · ${wind.kt} KT`,'@read','button','Aircraft take off and land into the wind. Pick the runway whose number matches the wind direction.',1.4);
    // Flight strips: one per aircraft calling you. Yellow frame = selected, red = MAYDAY.
    if(!pend.length)label(m,0,F+3.7,-17.28,2.5,j.complete?'ALL TRAFFIC HANDLED':'NO TRAFFIC CALLING',undefined,undefined,.2);
    pend.slice(0,5).forEach((r,i)=>{const y=F+4.05-i*.36,left=J.finalLeft(r);if(r.emergency||sel===r)box(m,0,y-.2,-17.31,2.74,.4,.02,r.emergency&&(time*3)%1<.5?'#e0513a':sel===r?'#f2c94c':'#8a2a24');
      add('strip'+r.id,0,y,-17.22,`${r.emergency?'MAYDAY ':''}${r.callsign} · ${r.kind==='takeoff'?'DEPARTURE':'ARRIVAL '+Math.ceil(left)+'s'}`,'strip:'+r.id,'button',r.emergency?'Engine failure: clear this aircraft to land before anyone else.':r.kind==='takeoff'?'Holding short, ready for departure.':`On final approach: ${Math.ceil(left)} seconds from the runway.`,2.6);});
    // Runway buttons set the runway in use; the light shows whether other traffic occupies it.
    J.runwaysOf(j).slice(0,3).forEach((rw,i)=>{const y=F+4.05-i*.45,busy=J.occupied(j,i);
      // Red frame: occupied by other traffic. Green frame: the runway in use.
      if(busy||j.active===i)box(m,2.35,y-.21,-17.31,1.52,.42,.02,busy?((time*3)%1<.5?'#ff3b2f':'#8a2a24'):'#7ee06b');
      add('rwy'+i,2.35,y,-17.22,`RWY ${rw.name}${busy?' · BUSY':j.active===i?' · IN USE':''}`,'runway:'+i,'button',busy?`Occupied by ${j.occupancy[i].traffic}.`:'Runway clear. Click to make it the runway in use.',1.4);});
    // Approach radar: the runway in use and a blip for each arrival sliding down final.
    {const rx=-4.3,ry=F+3.3,rz=-17.03;orb(m,rx,ry,rz,.72,.72,.02,'#0c2a22');const a=time*1.6;limb(m,[rx,ry,rz+.02],[rx+Math.cos(a)*.7,ry+Math.sin(a)*.7,rz+.02],.025,'#7cf0a0');box(m,rx-.02,ry-.3,rz+.01,.04,.6,.01,'#2f6b52');
      for(const r of pend)if(r.kind==='landing'){const d=Math.min(1,(J.finalLeft(r)||0)/30);orb(m,rx,ry-.3+.3+d*.35,rz+.03,.05,.05,.01,r.emergency?'#ff3b2f':sel===r?'#f2c94c':'#58c26f');}}
    // Controls along the front of the console.
    add('clearTakeoff',-2.4,F+.97,-15.98,'Cleared for takeoff','clearTakeoff','button','Clear the selected departure onto the runway in use.',1.45);
    add('clearLand',-.8,F+.97,-15.98,'Cleared to land','clearLand','button','Clear the selected arrival to land on the runway in use.',1.45);
    add('goAround',.8,F+.97,-15.98,'Go around / hold','goAround','button','Send an arrival around (or keep a departure holding) while the runway is occupied.',1.45);
    add('listen',2.4,F+.97,-15.98,'Say again','listen','button','Ask the selected aircraft to repeat its call.',1.3);
    add('binoculars',-4.35,F+1.55,-15.66,look.zoom>1?'Lower binoculars':'Binoculars','@binoculars','button','Zoom in to watch the runways (B).',1.3);
    add('towerExit',4.35,F+1.55,-15.66,'Lift to terminal','@towerExit','button','Ride the lift back down to the terminal.',1.3);
    if(j.complete)add('next',0,F+4.72,-17.22,'Next tower shift','@next','button','Start another shift once the cooldown ends.',2.2);
    towerTurn(m,first);for(let i=firstObj;i<objects.length;i++){const o=objects[i],[x,z]=toTower(o.x,o.z);objects[i]={...o,x,z,width:o.depth,depth:o.width};}
  }
  // What the controller sees out of the window: arrivals on final, departures holding short, traffic
  // blocking a runway, and every clearance flown for real.
  const meshes={};
  function planeFaces(type){if(!meshes[type])meshes[type]=root.SkyAssets?.[type]||root.SkyAssets?.cargo||[];return meshes[type];}
  function atcTraffic(m){
    const C=root.SkyCore,T=root.SkyWorld?.traffic,j=active.job,state=active.state;if(!C||!T||!state||!j?.requests)return;
    const {transformed}=geom(),isle=C.homeLayout(state)[0],rws=C.runwaysFor(isle),now=J.time(),best=J.bestRunway(j),inUse=j.active??best;
    const at=(rw,lz,lx=0)=>C.runwayToWorld(isle,rw,lx,lz),yawOf=(a,b)=>Math.atan2(b.x-a.x,-(b.z-a.z));
    const draw=(type,p,yaw,alt=0,pitch=0)=>m.push(...transformed(planeFaces(type),p.x,5.1+alt,p.z,yaw,pitch,0,1.4));
    const finalPoint=(rw,left)=>{const lz=rw.half+300+Math.max(0,left)*55;return {...at(rw,lz),y:22+(lz-rw.half-300)*.075};};
    const holdPoint=(rw,i)=>at(rw,rw.half-100+i*45,58);
    let holding=0;
    for(const r of J.pendingOf(j)){const rw=rws[inUse]||rws[0];
      if(r.kind==='landing'){const p=finalPoint(rw,J.finalLeft(r));draw(r.aircraft,p,rw.rad,p.y,-.04);}
      else{const p=holdPoint(rw,holding++);draw(r.aircraft,p,yawOf(p,at(rw,rw.half-100,0)));}}
    (j.occupancy||[]).forEach((o,k)=>{if(!o||now>=o.until)return;const rw=rws[k];if(!rw)return;const f=Math.min(1,(now-o.from)/(o.until-o.from)),a=at(rw,rw.half*.25,-45),b=at(rw,rw.half*.25,75),p={x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f};draw('trainer',p,yawOf(a,b));});
    for(const an of j.anims||[]){const rw=rws[an.runway]||rws[0];
      if(!an.path){const lz0=rw.half-120,td=rw.half-220,stop=Math.max(-rw.half+120,td-950);
        if(an.kind==='takeoff'){const h=holdPoint(rw,0);an.path=T.journey([{...h,y:0,v:2},{...at(rw,lz0+15),y:0,v:6},{...at(rw,lz0),y:0,v:4},{...at(rw,lz0-800),y:0,v:70},{...at(rw,lz0-1700),y:90,v:78},{...at(rw,lz0-6000),y:600,v:95}]);}
        else if(an.kind==='landing'){const p=finalPoint(rw,an.left||0);an.path=T.journey([{...p,v:62},{...at(rw,rw.half+300),y:22,v:60},{...at(rw,td),y:0,v:56},{...at(rw,stop),y:0,v:10},{...at(rw,stop-20,30),y:0,v:8},{...at(rw,stop-40,75),y:0,v:8}]);}
        else{const p=finalPoint(rw,an.left||0);an.path=T.journey([{...p,v:62},{...at(rw,rw.half+150),y:Math.max(30,p.y*.6),v:66},{...at(rw,rw.half-900),y:140,v:75},{...at(rw,-rw.half-2500),y:420,v:85}]);}}
      const age=(now-an.t0)/1000;if(age>an.path.duration)continue;const q=T.poseAt(an.path,age);if(q)draw(an.aircraft,q,q.yaw,q.y,q.pitch);}
  }

  function scene(clock,look,state){

    if(!people.length)reset();const m=[];

    if(look?.tower){m.push(...towerCab(state||active?.state));aircraft(m,clock,state);if(active?.role==='atc')atcTraffic(m);}
    else if(look?.cabin)m.push(...cabin());else{m.push(...terminal());aircraft(m,clock,state);wheelAssembly(m);for(const p of [...people,...workers])if(Math.hypot(p.x-look.x,p.z-look.z)<120)m.push(...human(p));}

    equipment(m,look);drawEffects(m,look);if(active?.hints){const g=guide(look),o=objects.find(o=>g.current?.targets.includes(o.id));if(o){const pulse=.10+Math.sin(time*4)*.025;orb(m,o.x-o.width/2,o.y+o.height/2+.08,o.z+o.depth/2,pulse,pulse,pulse,'#daf692');}}if(!look?.cabin&&!look?.tower){for(const p of workers)if(Math.hypot(p.x-look.x,p.z-look.z)<14)label(m,p.x,4.25,p.z,.9,p.name+' / CREW',undefined,undefined,.17);if(customer)label(m,customer.x,4.3,customer.z,1.8,customer.name,undefined,undefined,.22);}return m;

  }

  function pick(w,ray){

    const origin=[w.x,w.eye??4,w.z],pitch=Math.atan2(Math.sin(w.pitch||0)*20,30),dir=ray||[Math.sin(w.yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(w.yaw)*Math.cos(pitch)];let best=null,closest=7;

    for(const o of objects){const center=[o.x,o.y,o.z],size=[o.width+.12,o.height+.14,o.depth+.12];let low=.1,high=closest;for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-7){if(Math.abs(origin[i]-center[i])>size[i]/2)high=-1;continue;}const a=(center[i]-size[i]/2-origin[i])/dir[i],b=(center[i]+size[i]/2-origin[i])/dir[i];low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));}const along=low;if(low<=high&&along<closest){

      if(!w.cabin&&!w.tower){let blocked=false;for(let t=.2;t<along-.5;t+=.25){const x=origin[0]+dir[0]*t,y=origin[1]+dir[1]*t,z=origin[2]+dir[2]*t;if(A.layout.boxes.some(b=>b.solid&&y>b.y&&y<b.y+b.h&&Math.abs(x-b.x)<b.w/2&&Math.abs(z-b.z)<b.d/2)){blocked=true;break;}}if(blocked)continue;}

      best=o;closest=along;

    }}return best;

  }

  function move(w,keys,dt){

    if(w.tower){w.yaw+=((keys.has('arrowright')?1:0)-(keys.has('arrowleft')?1:0))*dt*1.6;
      const f=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),s=(keys.has('d')?1:0)-(keys.has('a')?1:0),n=Math.hypot(f,s)||1,v=(keys.has('shift')?4.5:3)*dt/n;
      const nx=w.x+(Math.sin(w.yaw)*f+Math.cos(w.yaw)*s)*v,nz=w.z+(-Math.cos(w.yaw)*f+Math.sin(w.yaw)*s)*v;if(towerClear(nx,w.z))w.x=nx;if(towerClear(w.x,nz))w.z=nz;return;}
    const old={x:w.x,z:w.z};if(!w.cabin){A.step(w,keys,dt);if(!clear(w.x,w.z)){w.x=old.x;w.z=old.z;}return;}

    w.yaw+=((keys.has('arrowright')?1:0)-(keys.has('arrowleft')?1:0))*dt*1.6;

    const f=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),s=(keys.has('d')?1:0)-(keys.has('a')?1:0),n=Math.hypot(f,s)||1;

    w.x=Math.max(-.67,Math.min(.67,w.x+(Math.sin(w.yaw)*f+Math.cos(w.yaw)*s)/n*dt*3));w.z=Math.max(-14.7,Math.min(4.1,w.z+(-Math.cos(w.yaw)*f+Math.sin(w.yaw)*s)/n*dt*3));

  }

  function guide(w={}){
    if(!active)return {steps:[],current:null};
    const j=active.job,h=k=>j.done.includes(k),steps=[];
    const add=(title,detail,targets,done)=>steps.push({title,detail,targets,done:!!done});
    const r=active.role;
    if(r==='checkin'){
      add('Scan the passport','Wait for the customer, then scan their passport.',['passport'],h('scan'));
      add('Compare the ticket','Check the passport photo against the person at your desk, then both names, flight codes and the expiry.',['ticket'],h('ticket'));
      if(j.valid){const bag=j.bags.find(b=>!b.loaded);add('Process baggage','Weigh each case; tag bags over 20 kg, then load them.',bag?['bag'+bag.id]:[],!bag);add('Choose a seat','Offer a window or aisle seat.',['window','aisle'],!!j.seat);add('Print the pass','Use the boarding-pass printer.',['accept'],h('decision'));add('Hand over the pass','Click the printed pass to give it to the customer.',['printed'],j.complete);}
      else add('Refer this document','The photo, name, flight or expiry is wrong. Refer the passenger.',['refer'],j.complete);
    }else if(r==='security'){
      add('Scan the bag','Start the X-ray to reveal the contents.',['scanner'],h('scan'));
      const items=j.items.filter(i=>!i.handled&&!i.cleared);add('Inspect and sort belongings',j.inspected!==null?'Use the restricted tray for dangerous items; return permitted items.':'Select an item and check its number on the X-ray monitor above the scanner. Blades and large liquids are restricted, and an innocent-looking item can hide a blade.',j.inspected!==null?['confiscate','returnItem']:items.map(i=>'item'+i.id),!items.length);
      add('Release the cleared bag','Return the bag only after every item has been checked.',['clear'],j.complete);
    }else if(r==='ground'){
      const bag=j.bags.find(b=>!b.zone);add('Load the aircraft',j.selected!==null?'Carry this case to the correct aircraft hold. Fragile cases use the padded hold.':'Pick up a case from the cart; walk to the aircraft holds.',j.selected!==null?['standard','fragile']:bag?['bag'+bag.id]:[],!bag);
      add('Refuel','Start the pump, then stop its needle inside the green band.',['fuel'],h('fuel'));add('Remove chocks','Remove the wheel chocks at the service aircraft.',['chocks'],h('chocks'));add('Connect the tug','Arm clearance. Wait for green, then connect. Expired clearance can be rearmed.',['tug'],h('tug'));add('Signal ready','Confirm that the turnaround is complete.',['release'],j.complete);
    }else if(r==='cabin'){
      add('Board the aircraft','Use the gate A2 boarding door.',['board'],!!w.cabin);
      const seats=j.seats.filter(s=>(s.needsBelt||s.needsTray)&&!s.fixed);add('Check passengers','Walk the aisle and secure highlighted belts and trays.',seats.map(s=>'seat'+s.id),!seats.length);
      const bins=j.bins.filter(b=>b.open);add('Latch overhead lockers','Close every open overhead bin.',bins.map(b=>'bin'+b.id),!bins.length);
      const request=j.requests.find(r=>!r.served);add('Serve refreshments',request?`Passenger ${Math.floor(request.id/2)+1}${request.id%2?'B':'A'} wants ${request.drink}. Collect it at the galley and deliver it.`:'Everyone has their drink.',request?[j.drink===request.drink?'seat'+request.id:request.drink]:[],!request);
      const calls=(j.calls||[]).filter(c=>c.ringing&&!c.answered);if((j.calls||[]).some(c=>c.ringing))add('Answer call bells','A passenger pressed their call button. Walk to the lit seat and help them.',calls.map(c=>'seat'+c.id),!calls.length);
      const d=j.demo;if(d)add('Safety demonstration',!d.started?'Walk to the front of the cabin and start the safety demo.':d.step<d.order.length?`Listen to the announcement and hold up the ${J.DEMO[d.order[d.step]].name}.`:'Demonstration complete.',!d.started?['demo-start']:d.step<d.order.length?['demo-'+d.order[d.step]]:[],h('demo'));
      add('Report cabin ready','Turn toward the rear galley and use the interphone.',['cabin-ready'],j.complete);
    }else if(r==='engineer'){
      add('Inspect the tyre','Read the specification stamped on the wheel.',['inspect'],h('inspect'));add('Raise the jack','Support the aircraft before removing its wheel.',['jack'],h('jack'));add('Select the replacement','Choose the wheel matching the specification.',j.options.map(o=>'spare'+o.id),h('spare'));add('Fit the wheel','Fit your selected replacement.',['fit'],h('replace'));const cross=J.nextCrossBolt(j),bolt=cross!==null?j.bolts[cross]:j.bolts.find(b=>!b.done);add('Torque the bolts','Cross pattern: after each bolt, torque the diagonally opposite one. Stop the needle in the green band.',bolt?['bolt'+bolt.id]:[],!j.bolts.some(b=>!b.done));add('Lower the jack','Lower the aircraft after every bolt is torqued.',['jack'],h('lower'));add('Sign the release','Run the final check.',['test'],j.complete);
    }else if(r==='atc'){
      // Step-by-step coaching: every tip names the exact strip or button to use next and says why.
      const pend=J.pendingOf(j),best=J.bestRunway(j),bestName=J.runwayName(j,best),wind=j.wind,sel=J.selectedOf(j);
      add('Go up to the tower','Clock in, then take the lift beside the ATC sign up to the control tower cab.',['tower'],!!w.tower);
      const set=!!wind&&j.active===best;
      add(j.active!==null&&!set?'Wind shift: change runway':'Set the runway into the wind',wind?`Look at the WIND dial: the wind blows from ${wind.from}°. Aircraft take off and land INTO the wind, and runway numbers are compass headings (36 = 360°, 18 = 180°, 27 = 270°). So click RWY ${bestName} on the right-hand board.`:'The wind appears once you reach the tower.',wind?['rwy'+best]:[],set);
      if(set&&!j.complete){
        const next=pend.find(q=>q.emergency)||pend.slice().sort((x,y)=>(J.finalLeft(x)??99)-(J.finalLeft(y)??99))[0];
        if(!next)add('Wait for a radio call','Aircraft call you on the radio. When one does, its flight strip appears on the middle board.',[],false);
        else if(sel!==next)add(next.emergency?'MAYDAY! Select it first':'Select the flight strip',`${next.emergency?'An emergency always goes first. ':''}Click the strip “${next.callsign}” on the middle board to talk to that aircraft.${next.kind==='landing'?' Its number is how many seconds it has left on final.':''}`,['strip'+next.id],false);
        else if(J.occupied(j,best)&&next.kind==='landing')add('Runway busy: send it around',`RWY ${bestName} has a RED frame: ${j.occupancy[best].traffic} is on it. ${next.callsign} cannot land now, so press “Go around / hold”. It will fly a circuit and call again.`,['goAround'],false);
        else if(J.occupied(j,best))add('Runway busy: keep it waiting',`RWY ${bestName} has a RED frame: ${j.occupancy[best].traffic} is on it. Leave ${next.callsign} holding short and clear it once the red frame disappears.`,['rwy'+best],false);
        else if(next.kind==='takeoff')add('Clear it for takeoff',`${next.callsign} is a DEPARTURE and RWY ${bestName} is clear (green frame). Press “Cleared for takeoff”, then look out of the window to watch it go.`,['clearTakeoff'],false);
        else add('Clear it to land',`${next.callsign} is an ARRIVAL and RWY ${bestName} is clear (green frame). Press “Cleared to land” before its countdown reaches zero.`,['clearLand'],false);
      }
      add('Handle all traffic',`${j.requests.filter(q=>q.done).length} of ${j.requests.length} aircraft handled. Tip: press B for binoculars.`,[],j.complete);
    }else if(r==='manager'){
      add('Review departures','Read the live operations board.',['board'],h('operations'));add('Support a department','Hire a colleague using a department control. Prices appear when you aim.',Object.keys(root.SkyCore.STAFF).map(k=>'hire'+k),h('hire'));add('Expand the terminal','Buy capacity when your budget allows. You can return later if funds are low.',['build'],h('build'));add('Handle an incident',j.incident?'Aim at the incident desk to read the situation, then choose. Some options are gambles.':'Watch the incident desk on the right. A situation will arrive shortly.',j.incident?['incident0','incident1']:['incident-title'],h('incident'));
    }else if(r==='pilot'){
      add('Choose your flight','Select a mission on the dispatch board.',objects.filter(o=>o.id.startsWith('flight')).map(o=>o.id),!!j.selectedFlight);add('Review weather','Check the forecast and difficulty.',['weather'],h('weather'));add('Check aircraft and fuel','Review your assigned aircraft and fuel plan.',['fuelcheck'],h('fuelcheck'));add('Get ATC clearance','Request clearance at the ATC panel and memorise the squawk code.',['clearance'],h('clearance'));add('Read back the squawk','Choose the squawk code ATC gave you. “Say again” repeats it.',['atc-title'],h('readback'));add('Board at gate A1','Start the selected flight after your readback.',['dispatch'],false);
    }
    const current=j.complete?{title:'Shift complete',detail:'Your grade and pay are recorded. Start the next shift after the cooldown.',targets:['next']}:steps.find(s=>!s.done)||{title:'Desk ready',detail:'Continue managing your airport or leave the workstation.',targets:[]};
    return {steps,current,completed:steps.filter(s=>s.done).length};
  }
  root.SkyWork={reset,tick,begin,end,release,ready,scene,pick,move,route,clear,guide,towerSpawn,popup,burst,speech,patience,get active(){return active;},get customer(){return customer;},get people(){return people;},get workers(){return workers;},get objects(){return objects;}};

})(globalThis);

