/* Sky Plane's deterministic game rules. No browser or third-party dependencies. */
(function (root) {
  'use strict';
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const finite = (v, fallback, min = 0, max = 1e9) => Number.isFinite(v) ? clamp(v, min, max) : fallback;
  const STAFF = {
    checkin: { name: 'Check-in agents', initial: 'C', role: 'Check-in receptionist', description: 'Check documents and get passengers ready to board.', wage: 65, hire: 600, stage: 0 },
    security: { name: 'Security officers', initial: 'S', role: 'Security guard', description: 'Screen baggage and keep the terminal moving.', wage: 75, hire: 700, stage: 1 },
    ground: { name: 'Ground crew', initial: 'G', role: 'Ground crew', description: 'Load baggage, refuel aircraft, and prepare departures.', wage: 70, hire: 650, stage: 2 },
    cabin: { name: 'Cabin crew', initial: 'F', role: 'Cabin crew', description: 'Improve passenger satisfaction and ticket revenue by 6% each (up to 30%).', wage: 55, hire: 500 },
    engineer: { name: 'Aircraft engineers', initial: 'E', role: 'Aircraft engineer', description: 'Cut aircraft operating costs by 8% each (up to 40%).', wage: 80, hire: 800 },
    atc: { name: 'Air traffic controllers', initial: 'A', role: 'Air traffic controller', description: 'Clear departures for takeoff sooner: each controller speeds up the departing stage by 20% (up to 100%).', wage: 85, hire: 900, stage: 3 }
  };
  const BUILDINGS = {
    terminal: { name: 'Passenger terminal', icon: 'build', price: 5000, description: 'More seats, more smiles. Each expansion adds 12 passengers to every scheduled flight.', benefit: '+12 passengers / flight', max: 4 },
    hangar: { name: 'Aircraft hangar', icon: 'plane', price: 7000, description: 'Room for a bigger operation. Add another flight to your scheduled departure queue.', benefit: '+1 scheduled aircraft', max: 3 },
    runway: { name: 'Runway extension', icon: 'grid', price: 10000, description: 'A longer runway gives you more room to take off and land. Adds 10% to mission rewards.', benefit: '+300 m runway · +10% mission pay', max: 2 },
    radar: { name: 'Control & radar tower', icon: 'chart', price: 3500, description: 'Coordinate traffic more efficiently. Every service stage runs 15% faster per tower level.', benefit: '+15% turnaround speed', max: 3 },
    fuel: { name: 'Fuel depot', icon: 'box', price: 3000, description: 'Store fuel on the island. Lower scheduled flight operating costs by 10% per level.', benefit: '−10% flight operating costs', max: 3 },
    rescue: { name: 'Emergency station', icon: 'shield', price: 4500, description: 'Build a dedicated rescue base. Rescue missions earn 20% more per level.', benefit: '+20% emergency mission pay', max: 2 }
  };
  const MISSIONS = {
    training: { title: 'Your first solo', category: 'FLIGHT SCHOOL', description: 'Learn to taxi, take off, follow a gentle circuit, and land back on the island.', reward: 1200, duration: '5–8 MIN', icon: 'book', label: 'Guided circuit', aircraft: 'Kestrel 172', gates: 4 },
    passenger: { title: 'The island connection', category: 'PASSENGER', description: 'Carry your passengers across the water to a neighbouring island and land on its assigned runway, and taxi to the arrival gate.', reward: 2600, duration: '5–8 MIN', icon: 'users', label: 'Island hop', aircraft: 'Comet 320', gates: 5, destination: true },
    cargo: { title: 'Precious cargo', category: 'CARGO', description: 'Deliver delicate research equipment to a neighbouring island. Steep banks and hard landings damage the shipment.', reward: 3100, duration: '5–8 MIN', icon: 'box', label: 'Fragile delivery', aircraft: 'Hauler 208', gates: 5, destination: true },
    military: { title: 'Coastline patrol', category: 'MILITARY', description: 'Fly an unarmed patrol and inspect coastal waypoints. Stay within the marked surveillance corridors.', reward: 2800, duration: '6–9 MIN', icon: 'shield', label: 'Coastal reconnaissance', aircraft: 'Sentinel T6', gates: 6 },
    emergency: { title: 'A helping wing', category: 'EMERGENCY', description: 'Rush medical supplies to a neighbouring island. Prepare for reduced engine power halfway across the water.', reward: 3500, duration: '5–8 MIN', icon: 'shield', label: 'Medical delivery', aircraft: 'Rescue Caravan', gates: 5, destination: true },
    'return': { title: 'Homeward bound', category: 'RETURN FLIGHT', description: 'Fly back across the water to your own island and land on your home runway.', reward: 0, duration: '4–7 MIN', icon: 'arrow', label: 'Fly home', aircraft: 'Comet 320', gates: 5, destination: true },
    race: { title: 'Seabreeze air rally', category: 'AIR RACING', description: 'Race the clock through floating gates. Real lift, drag, and stall physics still apply. Park at the arrival gate to finish.', reward: 3000, duration: '5–9 MIN', icon: 'plane', label: 'Timed circuit', aircraft: 'Swift R3', gates: 8 }
  };
  const ROLES = {
    manager: { name: 'Airport manager', short: 'Manager', initial: 'M', description: 'Set the strategy. Build, hire, and balance the books.', icon: 'chart' },
    pilot: { name: 'Pilot', short: 'Pilot', initial: 'P', description: 'Take the controls and earn money flying missions.', icon: 'plane' },
    checkin: { name: 'Check-in receptionist', short: 'Check-in', initial: 'C', description: 'Check tickets, documents, and baggage allowances.', icon: 'users' },
    security: { name: 'Security guard', short: 'Security', initial: 'S', description: 'Inspect bags and identify restricted items.', icon: 'shield' },
    cabin: { name: 'Cabin crew', short: 'Cabin crew', initial: 'F', description: 'Prepare the cabin and look after your passengers.', icon: 'users' },
    ground: { name: 'Ground crew', short: 'Ground crew', initial: 'G', description: 'Load the right cargo and prepare aircraft safely.', icon: 'box' },
    engineer: { name: 'Aircraft engineer', short: 'Engineer', initial: 'E', description: 'Inspect aircraft and choose the right repair.', icon: 'gear' },
    atc: { name: 'Air traffic controller', short: 'ATC', initial: 'A', description: 'Clear aircraft to take off and land, and keep the runways safe.', icon: 'chart' }
  };
  const DESTINATIONS = ['Pinecrest', 'Coral Bay', 'Northhaven', 'Maple Coast', 'Cloudbridge', 'Port Willow'];
  function newDeparture(id, index = 0) {
    return { id, code: 'SP ' + (100 + id), destination: DESTINATIONS[(id - 1) % DESTINATIONS.length], stage: 0, progress: 0, wait: index * 18, passengers: 28 + (id % 3) * 4 };
  }
  function worldName(value) { return typeof value==='string' ? value.replace(/[\x00-\x1f\x7f]/g,'').replace(/\s+/g,' ').trim().slice(0,40)||'Untitled airport' : 'Seabreeze Island'; }
  const MODES = {
    business: { name: 'Airport business', short: 'Business', description: 'Run the airport, hire your crew, balance the books, and fly missions.' },
    flight: { name: 'Flight only', short: 'Flight only', description: 'A ready-to-fly airport. All missions, no budgets, wages, or management.' },
    competitive: { name: 'Competitive', short: 'Time trial', description: 'One track, one timer. Beat your record and race your own ghost.' },
    free: { name: 'Free flight', short: 'Free flight', description: 'All twenty islands in one open sky. No missions, no business — just fly.' }
  };
  const SOLO_MODES=['competitive','free'];
  const TERRAINS = {
    island: { name: 'Seabreeze Island', short: 'Island', description: 'A green island with sandy beaches and warm seas.' },
    desert: { name: 'Dunes & mesas', short: 'Desert', description: 'Red rock, golden sand, and cactus groves under a hot sky.' },
    alpine: { name: 'Alpine valley', short: 'Alpine', description: 'Pine forests and snow-capped peaks around a mountain lake.' },
    arctic: { name: 'Polar outpost', short: 'Arctic', description: 'Snowfields, icy waters, and pale northern light.' }
  };
  function worldMode(options) { if (options && Object.hasOwn(MODES, options.mode)) return options.mode; return options?.business===false ? 'flight' : 'business'; }
  function worldTerrain(value) { return Object.hasOwn(TERRAINS, value) ? value : 'island'; }
  // Maps: the runway always sits at the origin heading north (physics never changes); each map
  // arranges land, water, mountains, and its own race circuit around it. land = [cx, cz, rx, rz]
  // ellipses (the first must cover the airport), mountains = descriptors resolved in world.js.
  const ARC={shape:'arc'},COURSE={gates:8,radius:950,altitude:220,direction:'left'};
  const MAPS=[
    {id:'island-seabreeze',terrain:'island',name:'Seabreeze Island',description:'The classic: one green island, sandy coves, and a gentle circuit over the bay.',land:[[0,0,900,1350]],mountains:[{kind:'cluster',x:-3400,z:-450,n:12,sx:1300,sz:2450,r:450,h:250},{kind:'wall',x0:2500,z0:-4200,x1:4700,z1:-3450,n:6,r:650,h:700}],race:ARC,course:COURSE,boat:[-1450,-1500],cabins:[-370,300]},
    {id:'island-crescent',terrain:'island',name:'Crescent Atoll',description:'A lagoon ringed by islets. The circuit loops low over the turquoise water.',land:[[350,0,950,1500],[-1500,-2000,520,430],[-1900,-800,380,560],[-1500,500,440,380],[-700,1500,520,380]],mountains:[{kind:'peak',x:3400,z:-2600,r:900,h:520},{kind:'cluster',x:3200,z:900,n:4,sx:900,sz:1400,r:380,h:260}],race:{shape:'loop',cx:-900,cz:-700},course:{gates:9,radius:1050,altitude:160,direction:'left'},boat:[-900,-700],cabins:[-450,-1100]},
    {id:'island-peninsula',terrain:'island',name:'Longshore Peninsula',description:'A long finger of land pointing north. Slalom out along the spine and back down the coast.',land:[[250,100,950,1550],[150,-1900,560,1100],[50,-3300,420,800]],mountains:[{kind:'peak',x:50,z:-3300,r:260,h:110},{kind:'cluster',x:-3200,z:800,n:5,sx:1000,sz:1800,r:420,h:240}],race:{shape:'slalom'},course:{gates:10,radius:1000,altitude:180,direction:'left'},boat:[-1500,-2400],cabins:[-380,-200]},
    {id:'island-twin',terrain:'island',name:'Twin Harbours',description:'Two big islands and a busy strait. The figure-eight crosses the water twice every lap.',land:[[300,100,950,1500],[-2000,-1000,1000,1150]],mountains:[{kind:'peak',x:-2200,z:-1300,r:520,h:420},{kind:'cluster',x:2900,z:-2200,n:6,sx:900,sz:1600,r:400,h:300}],race:{shape:'figure8'},course:{gates:12,radius:1200,altitude:200,direction:'left'},boat:[-900,-300],cabins:[-1600,-1300]},
    {id:'island-volcano',terrain:'island',name:'Ember Peak',description:'A sleeping volcano dominates the north. The circuit climbs around its slopes.',land:[[150,100,1000,1500],[-900,-2400,1200,1000]],mountains:[{kind:'peak',x:-900,z:-2500,r:820,h:780,color:'#7c6a5a'},{kind:'peak',x:-900,z:-2500,r:300,h:900,color:'#5c4b45'},{kind:'cluster',x:3100,z:-800,n:5,sx:900,sz:2400,r:420,h:320}],race:{shape:'climb',cx:-900,cz:-2400,minR:1000},trainingDirection:'right',course:{gates:9,radius:1300,altitude:320,direction:'left'},boat:[-1700,300],cabins:[-450,700]},
    {id:'desert-dunes',terrain:'desert',name:'Dunes & Mesas',description:'Golden sand, red rock, and cactus groves. A classic circuit over the flats.',land:[[0,0,900,1350]],mountains:[{kind:'cluster',x:-3400,z:-450,n:10,sx:1300,sz:2450,r:450,h:180},{kind:'cluster',x:-3500,z:-300,n:5,sx:1800,sz:4200,r:340,mesa:true,h:150},{kind:'wall',x0:2500,z0:-4200,x1:4700,z1:-3450,n:6,r:650,h:500}],race:ARC,course:COURSE,cabins:[-370,300]},
    {id:'desert-canyon',terrain:'desert',name:'Red Canyon',description:'Sheer mesa walls line a canyon north of the field. Thread the slalom between them.',land:[[0,-400,1300,2600]],mountains:[{kind:'wall',x0:-1500,z0:-1300,x1:-1650,z1:-5200,n:8,r:360,mesa:true,h:260},{kind:'wall',x0:1500,z0:-1300,x1:1650,z1:-5200,n:8,r:360,mesa:true,h:260},{kind:'cluster',x:-3200,z:800,n:4,sx:800,sz:1800,r:400,h:220}],race:{shape:'slalom'},course:{gates:10,radius:1100,altitude:150,direction:'left'},trees:50},
    {id:'desert-oasis',terrain:'desert',name:'Palm Oasis',description:'A ring of palms around a hidden spring. Loop the oasis and race home over the sand.',land:[[200,0,1500,1700]],mountains:[{kind:'cluster',x:3400,z:-1600,n:6,sx:1000,sz:2600,r:420,mesa:true,h:200}],race:{shape:'loop',cx:-1000,cz:-1500},course:{gates:8,radius:900,altitude:170,direction:'left'},plant:'palm',trees:70,grove:[-1000,-1500,520]},
    {id:'desert-salt',terrain:'desert',name:'Salt Flats',description:'A blinding white plain with nothing to hide behind. Pure speed on the figure-eight.',land:[[0,0,2600,2900]],mountains:[{kind:'wall',x0:-4200,z0:-4000,x1:4200,z1:-4600,n:9,r:700,h:420}],race:{shape:'figure8'},course:{gates:12,radius:1200,altitude:140,direction:'left'},trees:0,landColor:['#e6e0cf','#ece7d8','#e2dccb','#e9e4d4']},
    {id:'desert-mesa',terrain:'desert',name:'Mesa Country',description:'Flat-topped rock towers everywhere. The circuit spirals up between them.',land:[[100,0,1200,1600],[-2900,-2200,1100,1100]],mountains:[{kind:'cluster',x:-3000,z:-2300,n:6,sx:900,sz:1500,r:300,mesa:true,h:300},{kind:'cluster',x:2800,z:-2400,n:5,sx:1100,sz:1800,r:360,mesa:true,h:240},{kind:'peak',x:-3400,z:1200,r:700,h:380}],race:{shape:'climb',cx:-900,cz:-1500},course:{gates:9,radius:1200,altitude:280,direction:'left'},trees:60},
    {id:'alpine-valley',terrain:'alpine',name:'Alpine Valley',description:'Pine forests and snow-capped peaks around a mountain lake.',land:[[0,0,900,1350]],mountains:[{kind:'cluster',x:-3400,z:-450,n:12,sx:1300,sz:2450,r:450,h:400},{kind:'wall',x0:2500,z0:-4200,x1:4700,z1:-3450,n:6,r:650,h:980}],race:ARC,course:COURSE,cabins:[-370,300]},
    {id:'alpine-lake',terrain:'alpine',name:'Glacier Lake',description:'The airfield sits on the eastern shore. Loop the lake beneath the far peaks.',land:[[350,0,1000,1550],[-2300,-1800,1200,900],[-2600,600,700,800]],mountains:[{kind:'wall',x0:-3400,z0:-3200,x1:-1200,z1:-3400,n:5,r:600,h:900},{kind:'peak',x:-2800,z:700,r:500,h:520},{kind:'cluster',x:3200,z:-1200,n:5,sx:900,sz:2600,r:450,h:600}],race:{shape:'loop',cx:-1000,cz:-1200},course:{gates:9,radius:1000,altitude:190,direction:'left'},boat:[-1100,-1300],cabins:[-2000,-1500]},
    {id:'alpine-ridge',terrain:'alpine',name:'Ridge Run',description:'A long north–south valley walled by ridges. Slalom up the valley floor.',land:[[0,-500,1300,3000]],mountains:[{kind:'wall',x0:-2200,z0:800,x1:-2200,z1:-5200,n:9,r:620,h:900},{kind:'wall',x0:2200,z0:800,x1:2200,z1:-5200,n:9,r:620,h:900}],race:{shape:'slalom'},course:{gates:10,radius:1100,altitude:200,direction:'right'},trees:260},
    {id:'alpine-summit',terrain:'alpine',name:'Summit Circuit',description:'Peaks on every side. The circuit spirals up towards the summit ridge.',land:[[0,-100,1100,1500],[-800,-2600,1300,1000]],mountains:[{kind:'peak',x:-800,z:-2700,r:900,h:1050},{kind:'cluster',x:-3200,z:-200,n:6,sx:900,sz:2200,r:520,h:700},{kind:'cluster',x:3000,z:-1400,n:6,sx:900,sz:2400,r:520,h:760}],race:{shape:'climb',cx:-800,cz:-2500,minR:1100},trainingDirection:'right',course:{gates:9,radius:1400,altitude:360,direction:'left'},trees:200},
    {id:'alpine-meadow',terrain:'alpine',name:'Highland Meadows',description:'Rolling meadows and scattered hamlets. A fast figure-eight over open grass.',land:[[0,0,2200,2600]],mountains:[{kind:'cluster',x:-3600,z:-2400,n:6,sx:900,sz:1800,r:600,h:520},{kind:'cluster',x:3400,z:-2600,n:6,sx:900,sz:1800,r:600,h:560},{kind:'cluster',x:0,z:-3600,n:4,sx:1600,sz:500,r:420,h:180}],race:{shape:'figure8'},course:{gates:12,radius:1250,altitude:180,direction:'left'},trees:110,cabins:[-900,-900]},
    {id:'arctic-outpost',terrain:'arctic',name:'Polar Outpost',description:'Snowfields, icy waters, and pale northern light.',land:[[0,0,900,1350]],mountains:[{kind:'cluster',x:-3400,z:-450,n:12,sx:1300,sz:2450,r:450,h:250},{kind:'wall',x0:2500,z0:-4200,x1:4700,z1:-3450,n:6,r:650,h:700}],race:ARC,course:COURSE,boat:[-1450,-1500],cabins:[-370,300]},
    {id:'arctic-fjord',terrain:'arctic',name:'Frozen Fjord',description:'A narrow inlet between sheer white cliffs. Slalom up the fjord and back.',land:[[400,0,950,1500],[-1900,-1200,700,2200]],mountains:[{kind:'wall',x0:-2100,z0:800,x1:-2100,z1:-3400,n:7,r:520,h:620},{kind:'wall',x0:1900,z0:-1400,x1:1900,z1:-3600,n:5,r:520,h:560}],race:{shape:'slalom'},course:{gates:10,radius:1000,altitude:170,direction:'left'},boat:[-800,-1600],trees:60},
    {id:'arctic-shelf',terrain:'arctic',name:'Ice Shelf',description:'An endless frozen plain. Nothing but wind, ice, and the figure-eight.',land:[[0,0,2700,3000]],mountains:[{kind:'wall',x0:-4200,z0:-4300,x1:4200,z1:-4300,n:8,r:700,h:380}],race:{shape:'figure8'},course:{gates:12,radius:1300,altitude:130,direction:'right'},trees:0},
    {id:'arctic-glacier',terrain:'arctic',name:'Glacier Bay',description:'Icebergs drift across the bay. The loop threads between them.',land:[[300,0,950,1550],[-1500,-2000,420,360],[-2100,-700,360,420],[-1300,900,380,330],[-2300,-2600,300,300]],mountains:[{kind:'peak',x:-1500,z:-2000,r:380,h:95,color:'#dfe8ee'},{kind:'peak',x:-2100,z:-700,r:320,h:90,color:'#dfe8ee'},{kind:'peak',x:-1300,z:900,r:340,h:85,color:'#dfe8ee'},{kind:'wall',x0:2600,z0:-3800,x1:4600,z1:-3000,n:5,r:700,h:600}],race:{shape:'loop',cx:-1100,cz:-900},course:{gates:9,radius:1000,altitude:150,direction:'left'},boat:[-700,-900],trees:40},
    {id:'arctic-aurora',terrain:'arctic',name:'Aurora Peak',description:'A lone mountain under violet skies. Spiral up its flank as the lights dance.',land:[[100,0,1100,1500],[-900,-2500,1200,1000]],mountains:[{kind:'peak',x:-900,z:-2600,r:950,h:900},{kind:'cluster',x:3200,z:-600,n:5,sx:900,sz:2600,r:480,h:520}],race:{shape:'climb',cx:-900,cz:-2400,minR:1150},trainingDirection:'right',course:{gates:9,radius:1300,altitude:330,direction:'left'},sky:['#4d5c86','#b1a9c6','#8d9fb0'],trees:90}
  ];
  const MAP_BY_ID={};for(const m of MAPS)MAP_BY_ID[m.id]=m;
  function mapsFor(terrain){return MAPS.filter(m=>m.terrain===terrain);}
  // Mountain descriptors are expanded once per map with a seeded generator so the renderer and the
  // collision model always agree on where every peak, hill, and mesa stands.
  function seededRandom(text){let s=2166136261;for(let i=0;i<text.length;i++){s^=text.charCodeAt(i);s=Math.imul(s,16777619)>>>0;}return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  const MOUNTAIN_CACHE={};
  function mountainsFor(map){
    if(MOUNTAIN_CACHE[map.id])return MOUNTAIN_CACHE[map.id];
    const rnd=seededRandom(map.id),out=[];
    for(const d of map.mountains||[]){
      if(d.kind==='peak')out.push({x:d.x,z:d.z,r:d.r,h:d.h,mesa:!!d.mesa,color:d.color});
      else if(d.kind==='cluster')for(let i=0;i<d.n;i++){const x=d.x+(rnd()-.5)*d.sx,z=d.z+(rnd()-.5)*d.sz,k=.7+rnd()*.6;out.push({x,z,r:d.r*k,h:d.h*(.6+rnd()*.7),mesa:!!d.mesa,color:d.color});if(!d.mesa)out.push({x,z,r:d.r*k*1.8,h:d.h*.3,hill:true});}
      else if(d.kind==='wall')for(let i=0;i<d.n;i++){const t=d.n>1?i/(d.n-1):0;out.push({x:d.x0+(d.x1-d.x0)*t,z:d.z0+(d.z1-d.z0)*t,r:d.r*(.85+rnd()*.3),h:d.h*(.75+rnd()*.5),mesa:!!d.mesa,color:d.color});}
    }
    return MOUNTAIN_CACHE[map.id]=out;
  }
  // Height of the scenery above sea level at a point: mesas are flat tables, peaks and hills are cones.
  // `where` is a map, or a layout: an array of islands { map, x, z } placed around the current runway.
  function terrainHeight(where,x,z){
    if(Array.isArray(where)){let h=0;for(const isle of where)if(Math.hypot(x-isle.x,z-isle.z)<6500)h=Math.max(h,terrainHeight(isle.map,x-isle.x,z-isle.z));return h;}
    let h=0;
    for(const m of mountainsFor(where)){
      const dx=x-m.x,dz=z-m.z;
      if(m.mesa){if(Math.abs(dx)<m.r*.8&&Math.abs(dz)<m.r*.65)h=Math.max(h,m.h-2);continue;}
      const d=Math.hypot(dx,dz),base=m.r*.9;
      if(d<base)h=Math.max(h,-7+m.h*(1-d/base));
    }
    return h;
  }
  // Layouts. The island you are standing on is always at the origin with its runway heading north.
  const EQUIPPED={terminal:2,hangar:1,runway:1,radar:1,fuel:1,rescue:1};
  function currentMap(s){ return s.trip && MAP_BY_ID[s.trip.map] || worldMap(s.world); }
  function island(map,x,z,buildings){ return { map, x, z, buildings, runwayHalf: 850 + (buildings.runway||0) * 150 }; }
  // Every island has three runways on the open western side of the field (the terminal, apron, tower,
  // hangars and parked aircraft all sit to the east): two vertical (north–south) runways and one
  // horizontal (east–west) runway. Their orientations are fixed, but their positions are generated per
  // island from a seed on the map id, so no two islands lay their runways out the same way. The generator
  // keeps every runway on dry land, clear of the buildings, and fully separated so no two pavements overlap.
  // The horizontal runway is always placed north or south of the buildings so its east–west approaches
  // never pass over them. Runway 0 (a vertical one) is the one the runway-extension building lengthens.
  const RW_SPECS=[
    { deg:0,   width:60, half:600, ext:true, dir:'vertical' },
    { deg:180, width:56, half:540, dir:'vertical' },
    { deg:270, width:52, half:500, dir:'horizontal' }
  ];
  // Standard runway designator from a heading: the tens of the magnetic bearing (north = 36).
  function runwayName(deg){let h=((deg%360)+360)%360,n=Math.round(h/10)%36;if(n===0)n=36;return String(n).padStart(2,'0');}
  // The buildings occupy this island-local box (terminal, apron, tower, hangars, parked aircraft).
  const BUILD_BOX={x0:90,x1:720,z0:-780,z1:480};
  function inBuildBox(x,z){ return x>BUILD_BOX.x0 && x<BUILD_BOX.x1 && z>BUILD_BOX.z0 && z<BUILD_BOX.z1; }
  // A runway is safe when its pavement sits west of the buildings (x ≤ 80) and on dry land inside the
  // airport "keep" zone (those bounds mirror the KEEP ellipse in world.js), and when its extended
  // departure/approach corridor stays clear of high ground and never crosses the buildings, so climb-outs
  // and finals never fly into a mountain or over the terminal.
  function runwaySafe(map,cx,cz,rad,half){
    const fx=Math.sin(rad),fz=-Math.cos(rad),rx=Math.cos(rad),rz=Math.sin(rad);
    // Pavement must sit west of the buildings and on dry land.
    for(let t=-1;t<=1.0001;t+=0.2){const x=cx+fx*half*t,z=cz+fz*half*t;
      if(x>80)return false;
      if(((x+300)/1045)**2+(z/1378)**2>=1)return false;
    }
    // The corridor (pavement plus a long approach/departure zone off each end, a little to the sides)
    // must be low ground and clear of the buildings.
    for(let d=-(half+2500);d<=half+2500;d+=140)for(const s of [-150,0,150]){
      const x=cx+fx*d+rx*s, z=cz+fz*d+rz*s;
      if(inBuildBox(x,z))return false;
      if(map&&terrainHeight(map,x,z)>30)return false;
    }
    return true;
  }
  // The runways for an island, cached on the island object (islands are rebuilt per flight).
  function runwaysFor(isle){
    if(isle._rws)return isle._rws;
    const ext=(isle.buildings&&isle.buildings.runway)||0;
    const map=isle.map||null;
    const rng=seededRandom((map?map.id:'default')+'/runways3');
    const placed=[];
    // Oriented-rectangle (SAT) overlap test so no two runway pavements ever touch. Each runway is a
    // rectangle 2*half long and `width` wide; a margin keeps a clear buffer of grass between strips.
    const overlaps=(cx,cz,rad,half,width)=>{
      const m=90, along={x:Math.sin(rad),z:-Math.cos(rad)}, across={x:Math.cos(rad),z:Math.sin(rad)};
      const ha=half+m, wa=width/2+m;
      for(const p of placed){
        const pAlong={x:Math.sin(p.rad),z:-Math.cos(p.rad)}, pAcross={x:Math.cos(p.rad),z:Math.sin(p.rad)};
        const hb=p.half+m, wb=p.width/2+m, dx=p.cx-cx, dz=p.cz-cz;
        let separated=false;
        for(const L of [along,across,pAlong,pAcross]){
          const rA=Math.abs(along.x*L.x+along.z*L.z)*ha+Math.abs(across.x*L.x+across.z*L.z)*wa;
          const rB=Math.abs(pAlong.x*L.x+pAlong.z*L.z)*hb+Math.abs(pAcross.x*L.x+pAcross.z*L.z)*wb;
          if(Math.abs(dx*L.x+dz*L.z)>rA+rB){separated=true;break;}
        }
        if(!separated)return true; // no separating axis found → the pavements overlap
      }
      return false;
    };
    // A placement fits only when its pavement clears every runway already placed.
    const fits=(cx,cz,rad,half,width)=> overlaps(cx,cz,rad,half,width) ? null
      : {cx,cz,deg:rad*180/Math.PI,rad,half,width};
    // A candidate centre for a spec: verticals sit anywhere in the western band; the horizontal sits
    // clearly north or south of the buildings so its approaches stay off them.
    const sample=(spec)=> spec.dir==='horizontal'
      ? { cx:-900+rng()*450, cz:(rng()<0.5 ? -1250+rng()*300 : 650+rng()*350) }
      : { cx:-1150+rng()*950, cz:-250+rng()*500 };
    RW_SPECS.forEach((spec)=>{
      const half=spec.ext?600+ext*150:spec.half, rad=spec.deg*Math.PI/180;
      let chosen=null;
      for(let attempt=0;attempt<900 && !chosen;attempt++){
        const {cx,cz}=sample(spec);
        if(runwaySafe(map,cx,cz,rad,half))chosen=fits(cx,cz,rad,half,spec.width);
      }
      // Fallback: scan a grid of centres (with this runway's fixed heading) for the first safe placement.
      if(!chosen){
        const xs=[-1150,-950,-750,-550,-350], zs=spec.dir==='horizontal'?[-1300,-1100,-900,700,900,1100]:[0,-200,200,-400,400,-600,600];
        outer:
        for(const cx of xs)for(const cz of zs){
          if(!runwaySafe(map,cx,cz,rad,half))continue;
          const c=fits(cx,cz,rad,half,spec.width);
          if(c){chosen=c;break outer;}
        }
      }
      // Last resort: try a set of well-separated fixed lanes, then accept the first that clears the rest.
      if(!chosen){
        const lanes=spec.dir==='horizontal'?[[-650,-1150],[-650,950],[-500,-1300]]:[[-330,0],[-800,0],[-560,-400],[-560,400]];
        for(const [cx,cz] of lanes){const c=fits(cx,cz,rad,half,spec.width);if(c){chosen=c;break;}}
        if(!chosen){const cx=spec.dir==='horizontal'?-650:(placed.length?-800:-330),cz=spec.dir==='horizontal'?-1150:0;chosen={cx,cz,deg:spec.deg,rad,half,width:spec.width};}
      }
      chosen.width=spec.width;
      placed.push(chosen);
    });
    return isle._rws=placed.map((p,i)=>({ index:i, name:runwayName(p.deg), cx:p.cx, cz:p.cz, deg:p.deg, rad:p.rad,
      width:p.width, half:p.half, cos:Math.cos(p.rad), sin:Math.sin(p.rad) }));
  }
  // Convert a point in a runway's own frame (lx across, lz along, north end negative) to world metres.
  function runwayToWorld(isle,rw,lx,lz){
    return { x: isle.x + rw.cx + rw.cos*lx - rw.sin*lz, z: isle.z + rw.cz + rw.sin*lx + rw.cos*lz };
  }
  // Which mission/mode uses which of the three runways. Training, races, return legs and the solo modes
  // use runway 0 (a vertical, extendable one); passenger and emergency use the second vertical runway;
  // cargo and military patrol use the horizontal runway.
  const RUNWAY_ASSIGN={ training:0, race:0, 'return':0, passenger:1, emergency:1, cargo:2, military:2 };
  function runwayFor(mode,type,count){
    let idx = (mode==='competitive'||mode==='free') ? 0 : (RUNWAY_ASSIGN[type]??0);
    return Math.max(0, Math.min(idx, count-1));
  }
  function homeLayout(s){ return [island(currentMap(s), 0, 0, s.trip ? EQUIPPED : s.buildings)]; }
  // Free flight: the home island at the origin, the other nineteen on two rings around it.
  function freeLayout(s){
    const home=worldMap(s.world),others=MAPS.filter(m=>m!==home),layout=[island(home,0,0,s.buildings)];
    others.forEach((m,i)=>{const inner=i<6,n=inner?6:13,k=inner?i:i-6,r=inner?15000:28000,a=k/n*Math.PI*2+(inner?.35:.1);layout.push(island(m,Math.round(Math.sin(a)*r),Math.round(-Math.cos(a)*r),EQUIPPED));});
    return layout;
  }
  // Pick where a destination flight goes: a random other island 7–9 km away, or home for a return flight.
  function pickDestination(s,type,random=Math.random){
    if(!MISSIONS[type]?.destination)return null;
    const home=worldMap(s.world),here=currentMap(s);
    if(type==='return'){ if(!s.trip)return null; return { map: home.id, dx: -s.trip.dx, dz: -s.trip.dz }; }
    const choices=MAPS.filter(m=>m!==here&&(s.world.mode==='business'||m!==home));
    const map=choices[Math.floor(random()*choices.length)],d=10500+random()*2000,b=random()*Math.PI*2;
    return { map: map.id, dx: Math.round(Math.sin(b)*d), dz: Math.round(-Math.cos(b)*d) };
  }
  function flightLayout(s,type,destination){
    if(type==='free')return freeLayout(s);
    const layout=homeLayout(s);
    if(destination&&MAP_BY_ID[destination.map])layout.push(island(MAP_BY_ID[destination.map],destination.dx,destination.dz,destination.map===s.world.map?s.buildings:EQUIPPED));
    return layout;
  }
  function worldMap(world={}){return MAP_BY_ID[world.map]||mapsFor(worldTerrain(world.terrain))[0];}
  function freshState(options={}) {
    const mode=worldMode(options), business=mode==='business', solo=SOLO_MODES.includes(mode), map=worldMap(options);
    const state={ version: 1, routeVersion:2, visualVersion:2, world:{name:worldName(options.name),tutorial:!solo&&options.tutorial!==false,business,mode,terrain:map.terrain,map:map.id}, trip:null, cash: 24000, seconds: 0, reputation: 82, passengers: 0, completed: 0, missions: 0, tasks: 0,
      revenue: 0, expenses: 0, wages: 0, capital: 0, debt: 0, role: 'manager', skin: '#f0b85a',
      buildings: { terminal: 0, hangar: 0, runway: 0, radar: 0, fuel: 0, rescue: 0 },
      staff: { checkin: 1, security: 1, ground: 1, cabin: 0, engineer: 0, atc: 0 },
      departures: [newDeparture(1), newDeparture(2, 1)], nextFlight: 3,
      ledger: [{ label: 'Founder’s starting investment', amount: 24000, time: 0 }], history: [],
      settings: { difficulty: 'easy', graphics: 'high', weather: 'clear', sound: false, touch: false, invert: false },
      course: { ...map.course },
      bestRace: 0, raceRecord: null, tutorialDone: false, milestone: false, taskReadyAt: 0, taskSequence: 0, emergencyGrant: false, lessonRead: [] };
    if(!business){state.cash=0;state.role='pilot';state.staff={checkin:0,security:0,ground:0,cabin:0,engineer:0};state.departures=[];state.ledger=[];state.buildings={terminal:2,hangar:1,runway:1,radar:1,fuel:1,rescue:1};}
    return state;
  }
  function sanitize(raw) {
    if (!raw || raw.version !== 1 || typeof raw !== 'object') throw new Error('This is not a Sky Plane save file.');
    const s = freshState(raw.world&&typeof raw.world==='object'?raw.world:{});
    ['cash','seconds','passengers','completed','missions','tasks','revenue','expenses','wages','capital','debt','nextFlight','bestRace','taskReadyAt','taskSequence'].forEach(k => s[k] = finite(raw[k], s[k], 0, k === 'seconds' ? 1e8 : 1e9));
    s.cash = finite(raw.cash, s.cash, -1e6, 1e9);
    s.reputation = finite(raw.reputation, 82, 0, 100);
    for (const k in STAFF) s.staff[k] = Math.floor(finite(raw.staff?.[k], s.staff[k], 0, 8));
    for (const k in BUILDINGS) s.buildings[k] = Math.floor(finite(raw.buildings?.[k], 0, 0, BUILDINGS[k].max));
    if (Object.hasOwn(ROLES, raw.role)) s.role = raw.role;
    if (typeof raw.skin === 'string' && /^#[0-9a-f]{6}$/i.test(raw.skin)) s.skin = raw.skin;
    const choices = { difficulty: ['easy','normal','hard'], graphics: ['low','medium','high'], weather: ['clear','overcast','storm','sunset'] };
    for (const k in choices) if (choices[k].includes(raw.settings?.[k])) s.settings[k] = raw.settings[k];
    if(raw.visualVersion!==2)s.settings.graphics='high';
    ['sound','touch','invert'].forEach(k => s.settings[k] = raw.settings?.[k] === true);
    ['tutorialDone','milestone','emergencyGrant'].forEach(k => s[k] = raw[k] === true);
    s.course.gates = Math.round(finite(raw.course?.gates, s.course.gates, 4, 12));
    s.course.radius = finite(raw.course?.radius, s.course.radius, 700, 1600);
    s.course.altitude = finite(raw.course?.altitude, s.course.altitude, 120, 420);
    s.course.direction = raw.course?.direction === 'right' ? 'right' : raw.course?.direction === 'left' ? 'left' : s.course.direction;
    // Ghost traces only exist in competitive worlds.
    s.raceRecord = raw.routeVersion===2 && s.world.mode === 'competitive' ? sanitizeRecord(raw.raceRecord) : null;
    if(raw.routeVersion!==2)s.bestRace=0;
    // A flight-only pilot may be parked on another island; business pilots always start at home.
    const t = raw.trip;
    s.trip = s.world.mode === 'flight' && t && typeof t === 'object' && Object.hasOwn(MAP_BY_ID, t.map) && t.map !== s.world.map && Number.isFinite(t.dx) && Number.isFinite(t.dz) ? { map: t.map, dx: clamp(t.dx, -1e6, 1e6), dz: clamp(t.dz, -1e6, 1e6) } : null;
    if (s.raceRecord && (!s.bestRace || s.raceRecord.time < s.bestRace)) s.bestRace = s.raceRecord.time;
    s.ledger = Array.isArray(raw.ledger) ? raw.ledger.slice(0, 50).filter(x => x && typeof x.label === 'string' && Number.isFinite(x.amount) && Number.isFinite(x.time)).map(x => ({label:x.label.slice(0,100),amount:clamp(x.amount,-1e9,1e9),time:clamp(x.time,0,1e8)})) : s.ledger;
    s.history = Array.isArray(raw.history) ? raw.history.slice(-12).map(x=>finite(x,0,0,1e7)) : [];
    s.departures = Array.isArray(raw.departures) && raw.departures.length ? raw.departures.slice(0,2+s.buildings.hangar).map((x,i) => {
      if (!x || typeof x !== 'object') return newDeparture(i+1,i);
      const d = newDeparture(Math.floor(finite(x.id,i+1,1,1e6)));
      d.stage = Math.floor(finite(x.stage,0,0,3)); d.progress = finite(x.progress,0,0,1); d.wait = finite(x.wait,0,0,60); return d;
    }) : s.departures;
    s.nextFlight = Math.max(s.nextFlight, ...s.departures.map(x=>x.id+1));
    if(!s.world.business){s.role='pilot';s.departures=[];s.staff={checkin:0,security:0,ground:0,cabin:0,engineer:0};}
    return s;
  }
  // A race record keeps a 4 Hz trace of the winning flight so a ghost aircraft can replay it.
  const GHOST_RATE = 4, GHOST_STRIDE = 6, GHOST_MAX_SAMPLES = 4 * 60 * 25;
  function sanitizeRecord(raw) {
    if (!raw || typeof raw !== 'object' || !Number.isFinite(raw.time) || raw.time <= 0 || !Array.isArray(raw.trace)) return null;
    const trace = raw.trace.slice(0, GHOST_STRIDE * GHOST_MAX_SAMPLES);
    if (trace.length < GHOST_STRIDE * 2 || trace.length % GHOST_STRIDE || !trace.every(Number.isFinite)) return null;
    const gateTimes = Array.isArray(raw.gateTimes) ? raw.gateTimes.slice(0, 40).filter(Number.isFinite).map(t => clamp(t, 0, 1e5)) : [];
    return { time: clamp(raw.time, 0.1, 1e5), trace: trace.map(n => clamp(n, -1e6, 1e6)), gateTimes };
  }
  function sampleGhost(f, trace) { if (trace.length >= GHOST_STRIDE * GHOST_MAX_SAMPLES) return; trace.push(Math.round(f.x*10)/10, Math.round(f.y*10)/10, Math.round(f.z*10)/10, Math.round(f.yaw*1000)/1000, Math.round(f.pitch*1000)/1000, Math.round(f.roll*1000)/1000); }
  function ghostAt(record, time) {
    if (!record) return null;
    const trace = record.trace, count = trace.length / GHOST_STRIDE, pos = clamp(time * GHOST_RATE, 0, count - 1);
    const i = Math.min(count - 2, Math.floor(pos)), t = clamp(pos - i, 0, 1), a = i * GHOST_STRIDE, b = a + GHOST_STRIDE;
    const mix = (k) => trace[a+k] + (trace[b+k] - trace[a+k]) * t;
    const yawDelta = Math.atan2(Math.sin(trace[b+3]-trace[a+3]), Math.cos(trace[b+3]-trace[a+3]));
    return { x: mix(0), y: mix(1), z: mix(2), yaw: trace[a+3] + yawDelta * t, pitch: mix(4), roll: mix(5), finished: time >= record.time };
  }
  function entry(s, label, amount) {
    s.ledger.unshift({ label, amount: Math.round(amount), time: s.seconds });
    s.ledger.length = Math.min(s.ledger.length, 50);
  }
  function spend(s, amount, label) {
    if (s.cash < amount) return false;
    s.cash -= amount; s.capital += amount; entry(s, label, -amount); return true;
  }
  function price(s, key) { return Math.round(BUILDINGS[key].price * (1 + s.buildings[key] * .55)); }
  function build(s, key) {
    if(s.world?.business===false)return false;
    if (!BUILDINGS[key] || s.buildings[key] >= BUILDINGS[key].max) return false;
    if (!spend(s, price(s,key), BUILDINGS[key].name + ' expansion')) return false;
    s.buildings[key]++;
    if (key === 'hangar') s.departures.push(newDeparture(s.nextFlight++, 1));
    return true;
  }
  function hire(s, key) {
    if(s.world?.business===false)return false;
    if (!STAFF[key] || s.staff[key] >= 8 || !spend(s, STAFF[key].hire, 'Hired ' + STAFF[key].name.toLowerCase())) return false;
    s.staff[key]++; return true;
  }
  function wageRate(s) { return Object.keys(STAFF).reduce((n,k)=>n+s.staff[k]*STAFF[k].wage,0); }
  const FLIGHT_DIFFICULTY={
    easy:{wind:.35,stability:.9,steering:.55,stallAngle:.38,stallSpeed:19,stallLift:.65,sink:7.5,landingRoll:.48,landingSpeed:75,runwayMargin:12,excursionGrace:3,autoRotate:true},
    normal:{wind:1,stability:.32,steering:.8,stallAngle:.30,stallSpeed:23,stallLift:.38,sink:5,landingRoll:.30,landingSpeed:65,runwayMargin:3,excursionGrace:1.8,autoRotate:false},
    hard:{wind:1.35,stability:.14,steering:1,stallAngle:.27,stallSpeed:25,stallLift:.28,sink:3.2,landingRoll:.20,landingSpeed:55,runwayMargin:0,excursionGrace:.8,autoRotate:false}
  };
  function flightDifficulty(settings){return FLIGHT_DIFFICULTY[settings?.difficulty]||FLIGHT_DIFFICULTY.normal;}
  function difficulty(s) { return ({easy:{cost:.8, gate:100, damage:.55},normal:{cost:1,gate:75,damage:1},hard:{cost:1.2,gate:55,damage:1.4}})[s.settings.difficulty]||{cost:1,gate:75,damage:1}; }

  function tickEconomy(s, dt) {
    if(s.world?.business===false){s.seconds+=dt;return [];}
    const events = []; const oldHour = Math.floor(s.seconds/60);
    s.seconds += dt;
    const cost = ((wageRate(s) + 50 + Object.values(s.buildings).reduce((a,b)=>a+b,0)*12) * difficulty(s).cost + s.debt*.01) * dt/60;
    s.cash -= cost; s.expenses += cost; s.wages += wageRate(s)*difficulty(s).cost*dt/60;
    const allocated = {checkin:0,security:0,ground:0};
    for (let i=0;i<s.departures.length;i++) {
      const d = s.departures[i];
      if (d.wait > 0) { d.wait = Math.max(0,d.wait-dt); continue; }
      if (d.stage < 3) {
        const key = ['checkin','security','ground'][d.stage];
        const capacity = Math.max(0,s.staff[key]-allocated[key]);
        if (!capacity) continue;
        allocated[key] += Math.min(2,capacity);
        d.progress += dt / 26 * Math.min(2,capacity) * (1 + s.buildings.radar*.15);
        if (d.progress >= 1) { d.stage++; d.progress=0; }
      } else {
        d.progress += dt/12 * (1 + Math.min(s.staff.atc||0,5)*.2);
        if (d.progress >= 1) {
          const pax = d.passengers + s.buildings.terminal*12;
          const revenue = Math.round(pax * 32 * ( .75 + s.reputation/400) * (1 + Math.min(s.staff.cabin,5)*.06));
          const operating = Math.round((260+pax*3)*Math.max(.3,1-s.buildings.fuel*.1-Math.min(s.staff.engineer,5)*.08)*difficulty(s).cost);
          s.cash += revenue-operating; s.revenue += revenue; s.expenses += operating; s.passengers += pax; s.completed++; s.reputation=clamp(s.reputation+.35,0,100);
          entry(s,d.code+' · '+d.destination+' ticket sales',revenue); entry(s,d.code+' · fuel & handling',-operating);
          s.history.push(revenue-operating); if(s.history.length>12)s.history.shift();
          events.push({type:'departure',flight:d,profit:revenue-operating});
          s.departures[i] = newDeparture(s.nextFlight++,0);
        }
      }
    }
    if (Math.floor(s.seconds/60) > oldHour) entry(s,'Hourly staff, facilities & loan costs',-((wageRate(s)+50+Object.values(s.buildings).reduce((a,b)=>a+b,0)*12)*difficulty(s).cost+s.debt*.01));
    if (!s.milestone && s.completed >= 5) { s.milestone=true;s.cash+=2000;entry(s,'First five departures · milestone grant',2000);events.push({type:'milestone'}); }
    return events;
  }
  function completeTask(s, role, correct, grade=1) {
    if(s.world?.business===false)return false;
    if (s.seconds < s.taskReadyAt || !STAFF[role]) return false;
    s.taskReadyAt=s.seconds+12; s.taskSequence++;
    if (!correct) { s.reputation=clamp(s.reputation-1,0,100);return true; }
    const pay=Math.round((60+grade*100)/5)*5;
    s.tasks++;s.cash+=pay;s.revenue+=pay;s.reputation=clamp(s.reputation+(.15+grade*.5),0,100);entry(s,ROLES[role].name+' · shift bonus ('+(grade>=.93?'S':grade>=.82?'A':grade>=.66?'B':grade>=.48?'C':'D')+' grade)',pay);
    const stage = STAFF[role].stage;
    const flight = s.departures.find(x=>x.stage===stage);
    // The departing stage (ATC) finishes in tickEconomy, which pays out the flight.
    if (flight) { flight.wait=0;flight.progress+=.6;if(flight.progress>=1){if(stage<3){flight.stage++;flight.progress=0;}else flight.progress=.99;} }
    return true;
  }
  const Navigation=typeof module!=='undefined'?require('./navigation.js'):root.SkyNavigation;
  function makeRoute(type,course,where=MAPS[0],homeRw=null,destRw=null){
    const layout=Array.isArray(where)?where:[island(where,0,0,EQUIPPED)],home=layout[0],rws=runwaysFor(home);
    homeRw=homeRw||rws[0];const dest=MISSIONS[type]?.destination&&layout[1];
    destRw=destRw||(dest?runwaysFor(dest)[0]:rws[(homeRw.index+1)%rws.length]);
    return Navigation.route(api,type,course,layout,homeRw,destRw).gates;
  }
  function startTaxi(f){
    if(!f.onGround||f.speed>10||f.crashed||f.completed)return false;
    if(!f.airborne){f.taxiPath=Navigation.taxi(api,f.islands[f.departureIsland||0],runwaysFor(f.islands[f.departureIsland||0])[f.homeRunway]);f.phase='taxi-out';}
    else if(f.landed&&f.gate>=f.gates.length){const isle=f.islands[f.finish],rw=runwaysFor(isle)[f.finishRunway];f.taxiPath=Navigation.taxi(api,isle,rw).slice().reverse();f.phase='taxi-in';}
    else return false;
    f.taxiIndex=0;f.taxiAssist=true;f.throttle=0;return true;
  }
  function newFlight(type, s, destination=null) {
    const islands=flightLayout(s,type,destination),free=type==='free';
    const home=islands[0], homeRws=runwaysFor(home);
    let homeIdx=runwayFor(s.world.mode,type,homeRws.length), homeRw=homeRws[homeIdx];
    const dest=destination?islands[1]:null;
    let destRw=dest ? runwaysFor(dest)[Math.min(homeIdx,runwaysFor(dest).length-1)] : homeRws[(homeIdx+1)%homeRws.length];
    let route=free?{gates:[],path:[],feasible:true}:Navigation.route(api,type,s.course,islands,homeRw,destRw);
    if(!route.feasible){
      const arrivals=dest?runwaysFor(dest):homeRws;
      const departures=[homeRw,...homeRws.filter(r=>r!==homeRw)];
      search:for(const departure of departures)for(const arrival of arrivals){
        if(!dest&&departure.index===arrival.index)continue;
        const candidate=Navigation.route(api,type,s.course,islands,departure,arrival);
        if(candidate.feasible||candidate.score<route.score){route=candidate;homeRw=departure;homeIdx=departure.index;destRw=arrival;}
        if(candidate.feasible)break search;
      }
    }
    const finishIdx=destRw.index;
    const spawn=Navigation.stand(home),arrivalStand=Navigation.stand(dest||home);

    return { type,map:home.map.id,islands,destination:free?null:destination,finish:destination?1:0,x:spawn.x,y:2,z:spawn.z, vx:0,vy:0,vz:0, yaw:spawn.yaw,pitch:0,roll:0,phase:'parked',arrivalStand,taxiAssist:false,navPath:route.path,navIndex:0,
      throttle:0,flaps:0,gear:true,fuel:100,health:100,cargo:100,speed:0,airSpeed:0,verticalSpeed:0,
      gates:route.gates,gate:0,gateTimes:[],time:0,airborne:false,onGround:true,stall:false,
      engineFailure:false,landed:false,crashed:false,completed:false,gateRadius:difficulty(s).gate,
      maxAltitude:0, hardLanding:0, runwayHalf:homeRw.half, homeRunway:homeIdx, finishRunway:finishIdx,
      runwayName:homeRw.name, finishRunwayName:(destRw||homeRw).name, lastGateDistance:Infinity, refuelled:false };
  }
  // Which runway is under the aircraft: { island, runway } indices, or { island:-1, runway:-1 }.
  // Where runways cross, the strip whose centreline the aircraft is closest to wins, so a mission is
  // judged against the runway it is actually tracking rather than whichever one is listed first.
  function runwayAt(f,margin=0){
    let bestIsle=-1,bestRw=-1,bestLat=Infinity;
    for(let i=0;i<f.islands.length;i++){
      const isle=f.islands[i];
      for(const rw of runwaysFor(isle)){
        const dx=f.x-(isle.x+rw.cx),dz=f.z-(isle.z+rw.cz);
        const lx=rw.cos*dx+rw.sin*dz, lz=-rw.sin*dx+rw.cos*dz;
        if(Math.abs(lx)<rw.width/2+margin && Math.abs(lz)<rw.half+margin && Math.abs(lx)<bestLat){ bestLat=Math.abs(lx); bestIsle=i; bestRw=rw.index; }
      }
    }
    return { island:bestIsle, runway:bestRw };
  }
  function stepFlight(f, controls, dt, settings) {
    if (f.crashed || f.completed) return [];
    const events=[]; f.time+=dt;const tuning=flightDifficulty(settings);
    const p0={x:f.x,y:f.y,z:f.z,yaw:f.yaw,pitch:f.pitch,roll:f.roll};
    if(f.taxiAssist){
      if(controls.brake||controls.throttle||controls.rudder||controls.roll){f.taxiAssist=false;f.vx=f.vz=f.speed=f.airSpeed=0;return events;}
      const target=f.taxiPath[f.taxiIndex],dx=target.x-f.x,dz=target.z-f.z,d=Math.hypot(dx,dz),step=Math.min(d,10*dt);
      let moved=false;
      if(d>.01){const desired=Math.atan2(dx,-dz),delta=Math.atan2(Math.sin(desired-f.yaw),Math.cos(desired-f.yaw));f.yaw+=clamp(delta,-.65*dt,.65*dt);if(Math.abs(delta)<.15){f.x+=dx/d*step;f.z+=dz/d*step;moved=true;}}
      f.speed=f.airSpeed=moved?10:0;f.vx=f.vz=f.vy=f.verticalSpeed=0;f.y=2;f.pitch=f.roll=0;
      if(root.SkyWorld?.sceneryCollision(f,p0)){f.taxiAssist=false;f.crashed=true;events.push({type:'crash',reason:'Taxi path obstructed. Keep clear of scenery.'});return events;}
      if(d<.5){f.taxiIndex++;if(f.taxiIndex>=f.taxiPath.length){f.taxiAssist=false;f.speed=f.airSpeed=0;if(f.phase==='taxi-out'){f.phase='takeoff';f.yaw=runwaysFor(f.islands[f.departureIsland||0])[f.homeRunway].rad;}else if(f.type==='free'){f.phase='parked';f.airborne=f.landed=false;f.departureIsland=f.finish;f.homeRunway=f.finishRunway;f.runwayName=f.finishRunwayName;}else{f.phase='arrived';f.completed=true;events.push({type:'complete'});}}}
      return events;
    }
    const windStrength=(settings.weather==='storm'?12:settings.weather==='overcast'?4:0)*tuning.wind;
    const windX=windStrength*(.6+Math.sin(f.time*.17)*.4);
    const windZ=windStrength*Math.cos(f.time*.13)*.3;
    const relX=f.vx-windX,relZ=f.vz-windZ;
    const speed=Math.hypot(relX,relZ);f.airSpeed=speed;
    f.throttle=clamp(f.throttle+(controls.throttle||0)*dt*.26,0,1);
    const authority=clamp(speed/28,.2,1.3);
    const pitchInput=(controls.pitch||0)*(settings.invert?-1:1);
    const pitchRate = pitchInput*.29*authority - f.pitch*.12 - (f.stall?.13:0);
    f.pitch=clamp(f.pitch+pitchRate*dt,-.5,.48);
    f.roll=clamp(f.roll+((controls.roll||0)*.65*authority-f.roll*tuning.stability)*dt,-1.05,1.05);
    if (f.onGround) f.roll*=Math.exp(-5*dt);
    const turn=f.onGround?(controls.rudder||controls.roll||0)*clamp(speed/40,0,.7)*tuning.steering:Math.tan(f.roll)*9.81/Math.max(speed,22)+(controls.rudder||0)*.13;
    f.yaw+=turn*dt;
    if(tuning.autoRotate&&f.onGround&&runwayAt(f).island>=0&&speed>32&&!pitchInput)f.pitch+=clamp(.14-f.pitch,-.15*dt,.15*dt);
    const pathAngle=Math.atan2(f.vy,Math.max(speed,8));
    const aoa=f.pitch-pathAngle;
    f.stall=!f.onGround&&(aoa>tuning.stallAngle||speed<tuning.stallSpeed);
    const cl=clamp(.35+4.1*aoa+f.flaps*.24,-.8,1.7)*(f.stall?tuning.stallLift:1);
    const density=1.225*Math.exp(-f.y/9000),mass=1250,area=16.2;
    const lift=.5*density*speed*speed*area*cl;
    const drag=.5*density*speed*speed*area*(.033+.049*cl*cl+(f.gear?.016:0)+f.flaps*.018);
    const thrust=f.fuel>0?f.throttle*(f.engineFailure?2450:4200)*Math.max(.45,1-speed/150):0;
    const accel=(thrust*Math.cos(f.pitch)-drag)/mass-(f.onGround?.6:0);
    let groundSpeed=Math.max(0,Math.hypot(f.vx,f.vz)+accel*dt-(controls.brake&&f.onGround?7*dt:0));
    // Gate and taxiway acceleration is a taxi operation, not a runway excursion.
    const groundRunway=runwayAt(f,tuning.runwayMargin);
    if(f.onGround&&!f.airborne&&groundRunway.island>=0&&groundSpeed>18)f.takeoffRoll=true;
    if(f.onGround&&!f.airborne&&!f.takeoffRoll&&groundRunway.island<0){groundSpeed=Math.min(groundSpeed,10);if(groundSpeed>.1)f.phase='taxi-out';}
    const forwardX=Math.sin(f.yaw),forwardZ=-Math.cos(f.yaw);
    // Sideslip decays gradually in the air; the wheels track the runway on the ground.
    const desiredX=forwardX*groundSpeed+(f.onGround?0:windX*.16),desiredZ=forwardZ*groundSpeed+(f.onGround?0:windZ*.16);
    const align=1-Math.exp(-(f.onGround?12:2.2)*dt);
    f.vx+=(desiredX-f.vx)*align;f.vz+=(desiredZ-f.vz)*align;
    // Smooth the direction, not the acceleration; otherwise thrust depends on frame rate.
    const alignedSpeed=Math.hypot(f.vx,f.vz);
    if(alignedSpeed>0){f.vx=f.vx/alignedSpeed*groundSpeed;f.vz=f.vz/alignedSpeed*groundSpeed;}
    const ay=lift*Math.cos(f.roll)/mass+thrust*Math.sin(f.pitch)/mass-9.81;
    f.vy+=ay*dt;
    if (settings.weather==='storm'&&!f.onGround) { f.vy+=Math.sin(f.time*3.7)*dt*1.8*tuning.wind;f.roll+=Math.sin(f.time*2.2)*dt*.04*tuning.wind; }
    f.x+=f.vx*dt;f.z+=f.vz*dt;f.y+=f.vy*dt;
    f.speed=Math.hypot(f.vx,f.vz);f.verticalSpeed=f.vy;f.maxAltitude=Math.max(f.maxAltitude,f.y);
    f.fuel=Math.max(0,f.fuel-dt*(.007+f.throttle*.031));
    if(f.y>4||f.y>2.25&&f.vy>.1){f.airborne=true;f.onGround=false;f.phase='airborne';}
    if(f.navPath?.length){while(f.navIndex<Math.min(f.gates[f.gate]?.pathIndex||f.navPath.length-1,f.navPath.length-1)&&Math.hypot(f.x-f.navPath[f.navIndex].x,f.z-f.navPath[f.navIndex].z)<220)f.navIndex++;}
    if(f.y<=2){
      const at=runwayAt(f,tuning.runwayMargin),runway=at.island>=0;
      const hard=Math.abs(f.vy);
      if(f.airborne&&!f.onGround){
        f.hardLanding=hard;
        if(!runway||!f.gear||hard>tuning.sink||Math.abs(f.roll)>tuning.landingRoll||f.speed>tuning.landingSpeed){f.crashed=true;events.push({type:'crash',phase:'landing',reason:!runway?'You touched down away from the runway.':!f.gear?'The landing gear was still retracted.':hard>tuning.sink?'The descent was too fast at touchdown.':Math.abs(f.roll)>tuning.landingRoll?'The wings were not level at touchdown.':'The approach speed was too high.'});}
        else {if(f.type==='free'){f.finish=at.island;f.finishRunway=at.runway;f.finishRunwayName=runwaysFor(f.islands[at.island])[at.runway].name;f.arrivalStand=Navigation.stand(f.islands[at.island]);}f.landed=at.island===f.finish&&at.runway===f.finishRunway;f.phase='landing';f.health-=Math.max(0,hard-2)*12;f.cargo-=Math.max(0,hard-1.5)*10;events.push({type:'touchdown',island:at.island,runway:at.runway});}
      }
      // Free flight: any runway is a fuel stop — touch down, roll, and take off again.
      if(f.type==='free'&&runway&&f.fuel<99.5){f.fuel=100;f.refuelled=true;events.push({type:'refuel',island:at.island,runway:at.runway});}
      f.y=2;f.vy=Math.max(0,f.vy);f.onGround=true;f.pitch=Math.max(0,f.pitch);
      if(!f.airborne&&at.island===(f.departureIsland||0)&&at.runway===f.homeRunway)f.phase='takeoff';
      f.offRunwayTime=f.takeoffRoll&&!runway&&f.speed>20?(f.offRunwayTime||0)+dt:0;
      if(f.offRunwayTime>tuning.excursionGrace){f.crashed=true;events.push({type:'crash',phase:'takeoff',reason:'The takeoff roll continued outside the runway.'});}
      if(!runway&&f.speed<12)f.takeoffRoll=false;
    }
    // Sweep against the same static meshes used to draw every island, before rewards/gates.
    if(!f.crashed&&root.SkyWorld?.sceneryCollision(f,p0)){
      f.crashed=true;events.push({type:'crash',reason:'You hit scenery. Keep the fuselage and wings clear of buildings, trees, and parked aircraft.'});
      f.verticalSpeed=f.onGround?0:f.vy;return events;
    }
    if(f.type==='cargo'&&!f.onGround){f.cargo=Math.max(0,f.cargo-Math.max(0,Math.abs(f.roll)-.62)*dt*2.5-Math.max(0,Math.abs(ay)-5)*dt*.12);}
    const gate=f.gates[f.gate];
    if(gate&&f.airborne){
      // Swept segment test keeps small gates reliable even at high speed or low frame rates.
      const dx=f.x-p0.x,dy=f.y-p0.y,dz=f.z-p0.z;
      const t=clamp(((gate.x-p0.x)*dx+(gate.y-p0.y)*dy+(gate.z-p0.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);
      const distance=Math.hypot(p0.x+dx*t-gate.x,p0.y+dy*t-gate.y,p0.z+dz*t-gate.z);
      f.lastGateDistance=Math.hypot(f.x-gate.x,f.y-gate.y,f.z-gate.z);
      if(distance<f.gateRadius){f.navIndex=Math.max(f.navIndex||0,gate.pathIndex||0);f.gate++;f.gateTimes.push(f.time);events.push({type:'gate'});if(f.type==='emergency'&&f.gate===(f.destination?2:Math.floor(f.gates.length/2))){f.engineFailure=true;events.push({type:'engine'});}}
    }
    if(f.type!=='free'&&f.gate>=f.gates.length&&f.onGround&&f.airborne&&f.speed<5&&!f.crashed){if(f.landed&&Math.hypot(f.x-f.arrivalStand.x,f.z-f.arrivalStand.z)<9&&f.throttle<.05&&controls.brake){f.phase='arrived';f.completed=true;events.push({type:'complete'});}}
    if(f.y>2000) {f.pitch=Math.min(f.pitch,-.05);events.push({type:'ceiling'});}
    // Scenery is solid: mountains, hills, and mesas end the flight on contact.
    const ground=terrainHeight(f.islands||MAP_BY_ID[f.map]||MAPS[0],f.x,f.z);if(!f.onGround&&!f.crashed&&ground>3&&f.y<ground+2.5){f.crashed=true;events.push({type:'crash',reason:'You flew into the terrain. Watch the scenery and keep clear of the high ground.'});}
    f.verticalSpeed=f.onGround?0:f.vy;
    return events;
  }
  function rewardFlight(s,f,trace) {
    if(!f.completed||f.rewardPaid)return 0;
    f.rewardPaid=true;f.newRecord=false;
    const quality=f.type==='cargo'?Math.max(.25,f.cargo/100):Math.max(.5,f.health/100);
    const amount=Math.round(MISSIONS[f.type].reward*quality*(1+s.buildings.runway*.1)*(f.type==='emergency'?1+s.buildings.rescue*.2:1));
    s.missions++;s.reputation=clamp(s.reputation+2,0,100);
    if(s.world?.business!==false){s.cash+=amount;s.revenue+=amount;entry(s,MISSIONS[f.type].title+' · mission reward',amount);}
    if(f.type==='training')s.tutorialDone=true;
    if(f.destination&&s.world.mode==='flight'){const dx=(s.trip?.dx||0)+f.destination.dx,dz=(s.trip?.dz||0)+f.destination.dz;s.trip=f.destination.map===s.world.map?null:{map:f.destination.map,dx,dz};}
    if(f.type==='race'&&(!s.bestRace||f.time<s.bestRace)){s.bestRace=f.time;f.newRecord=true;if(Array.isArray(trace))s.raceRecord=sanitizeRecord({time:f.time,trace,gateTimes:f.gateTimes})||s.raceRecord;}
    return s.world?.business===false?0:amount;
  }
  const api={STAFF,BUILDINGS,MISSIONS,ROLES,DESTINATIONS,MODES,SOLO_MODES,TERRAINS,MAPS,EQUIPPED,GHOST_RATE,clamp,worldName,worldMode,worldTerrain,worldMap,currentMap,mapsFor,mountainsFor,terrainHeight,homeLayout,freeLayout,flightLayout,pickDestination,runwayAt,runwaysFor,runwayToWorld,runwayFor,startTaxi,freshState,sanitize,sanitizeRecord,sampleGhost,ghostAt,entry,spend,price,build,hire,wageRate,FLIGHT_DIFFICULTY,flightDifficulty,difficulty,tickEconomy,completeTask,makeRoute,newFlight,stepFlight,rewardFlight};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SkyCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
