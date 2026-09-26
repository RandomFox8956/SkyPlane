/* In-game workstation activities. Each job is a real skill check, not a click-through checklist:
   mistakes and time both count, and every shift is randomised and gets harder as you go. */
(function(root){
  'use strict';
  const wall=()=>typeof performance!=='undefined'?performance.now():Date.now();
  let pausedAt=null,pausedTotal=0;
  const now=()=> (pausedAt??wall())-pausedTotal;
  function setPaused(value){if(value&&pausedAt===null)pausedAt=wall();else if(!value&&pausedAt!==null){pausedTotal+=wall()-pausedAt;pausedAt=null;}}
  const names={checkin:'Passenger services',security:'Security screening',ground:'Aircraft turnaround',cabin:'Cabin preparation',engineer:'Aircraft maintenance',atc:'Air traffic control'};
  const NAMES=['Alex Rivers','Jamie Chen','Sam Taylor','Charlie Park','Robin Ford','Nadia Osei','Priya Nair','Owen Clarke','Maya Lindqvist','Theo Marchand','Isla Byrne','Kofi Mensah'];
  const SAFE_ITEMS=[['Paperback book','book'],['Water bottle · 90 ml','bottle'],['Folded clothing','clothes'],['Laptop','laptop'],['Umbrella','umbrella'],['Camera','camera'],['Sunglasses case','case']];
  const HAZARD_ITEMS=[['Kitchen scissors','scissors'],['Pocket knife','knife'],['Lighter fuel canister','fluid'],['Aerosol spray can','spray'],['Water bottle · 500 ml','bigbottle'],['Multi-tool','multitool'],['Box cutter','cutter']];
  const PAR={checkin:24000,security:17000,ground:22000,cabin:22000,engineer:24000,atc:20000};
  // Air traffic control: who is using each runway when a request arrives.
  const TRAFFIC=['a Comet 320 rolling out','a Hauler 208 backtracking','a Kestrel 172 crossing','a Rescue Caravan vacating','a fuel bowser crossing','a runway inspection truck'];
  // Runways as the tower sees them; the workplace fills in the island's real names and headings.
  const DEFAULT_RUNWAYS=[{name:'36',deg:0},{name:'18',deg:180},{name:'27',deg:270}];
  const runwaysOf=j=>j.runways&&j.runways.length?j.runways:DEFAULT_RUNWAYS;
  const runwayName=(j,i)=>(runwaysOf(j)[i]||{}).name||'ABC'[i];
  const headwind=(j,i)=>Math.cos((j.wind.from-runwaysOf(j)[i].deg)*Math.PI/180);
  const bestRunway=j=>{if(!j.wind)return 0;let best=0;runwaysOf(j).forEach((_,i)=>{if(headwind(j,i)>headwind(j,best))best=i;});return best;};
  function setWind(j,k){const rw=runwaysOf(j)[k]||runwaysOf(j)[0];j.wind={from:Math.round(((rw.deg+(Math.random()*50-25))%360+360)%360/10)*10||360,kt:8+Math.floor(Math.random()*15)};}
  const occupied=(j,i)=>{const o=j.occupancy&&j.occupancy[i];return !!o&&now()<o.until;};
  const pendingOf=j=>(j.requests||[]).filter(r=>r.arrived&&!r.done);
  const selectedOf=j=>{const p=pendingOf(j);return p.find(r=>r.id===j.selected)||(p.length===1?p[0]:null);};
  const finalLeft=r=>r.kind==='landing'&&r.deadline?Math.max(0,(r.deadline-now())/1000):null;
  const requestLine=(j,r)=>r.emergency?`Mayday, mayday, mayday, tower, ${r.callsign}, engine failure, request immediate landing.`:r.kind==='takeoff'?`Tower, ${r.callsign}, holding short, ready for departure.`:`Tower, ${r.callsign}, on final, request landing.`;
  const MATERIAL={book:'organic',bottle:'organic',clothes:'organic',laptop:'metal',umbrella:'mixed',camera:'metal',case:'mixed',scissors:'metal',knife:'metal',fluid:'organic',spray:'mixed',bigbottle:'organic',multitool:'metal',cutter:'metal'};
  const COVERS=[['Toiletry bag','toiletry'],['Hairdryer','hairdryer'],['Shoe box','shoebox']];
  const GREETINGS=['Morning! Off to see my sister.','Hi! Is the flight on time?','Hello — first time flying!','Hey. Long week, going home.','Hiya! Window seat, if you have one?'];
  const SECURITY_LINES=['Oh no, not my favourite one…','Sorry! I totally forgot that was in there.','Fair enough, rules are rules.','Seriously? It was a gift!'];
  const CALLS=['Could I get a blanket? It is a bit chilly.','Will I make my connection at the next airport?','My son is nervous about flying. Could you say hello?','Could you help me reach my bag? I need my medication.','Is it normal for the wing to wobble like that?'];
  const DEMO={belt:{name:'seat belt',line:'Fasten your seat belt by inserting the metal tip into the buckle, then pull the strap tight.'},mask:{name:'oxygen mask',line:'If cabin pressure drops, oxygen masks will drop from above. Pull the mask toward you and place it over your nose and mouth.'},vest:{name:'life vest',line:'Your life vest is under your seat. Slip it over your head, fasten the straps, and only inflate it as you leave the aircraft.'},exit:{name:'emergency exits',line:'Please take a moment to locate your nearest exit. Remember, it may be behind you.'}};
  // Manager incidents: every choice has a real trade-off, and some are gambles.
  const INCIDENTS=[
    {title:'STORM GROUNDS A FLIGHT',text:'Thunderstorms grounded a departure. Forty passengers are stranded in the terminal.',options:[{label:'Book hotels · $450',detail:'Pay for hotel rooms. Expensive, but passengers will remember the kindness.',cash:-450,rep:4,result:'Passengers are posting thank-you messages about your airport.'},{label:'Free snacks · $80',detail:'Hand out snacks and water. Cheap, but some passengers will grumble online.',cash:-80,rep:-1,result:'A few angry reviews appeared, but the budget is safe.'}]},
    {title:'BAGGAGE BELT JAMMED',text:'The check-in belt has jammed and the queue is growing.',options:[{label:'Call contractor · $300',detail:'A guaranteed fix within minutes.',cash:-300,rep:1,result:'The contractor fixed it quickly. Queue cleared.'},{label:'Crew repair · gamble',detail:'Your crew tries to fix it. 60% chance it works for free; 40% it snaps and costs $500.',gamble:{chance:.6,win:{cash:0,rep:2,text:'Your crew fixed the belt for free! The team is proud.'},lose:{cash:-500,rep:-2,text:'The belt snapped. An emergency contractor charged a premium.'}}}]},
    {title:'INFLUENCER AT CHECK-IN',text:'A travel influencer with three million followers is filming your terminal.',options:[{label:'VIP tour · $200',detail:'Lounge access and a tour. 70% chance of a glowing video worth $1,200 in bookings.',cash:-200,gamble:{chance:.7,win:{cash:1200,rep:5,text:'The video went viral! Bookings are pouring in.'},lose:{cash:0,rep:-1,text:'The video barely mentioned your airport.'}}},{label:'Treat like anyone',detail:'Fair and free. A small reputation boost for professionalism.',cash:0,rep:1,result:'Staff treated everyone equally. Quietly professional.'}]},
    {title:'FUEL PRICE SPIKE',text:'Fuel suppliers warn prices may jump tomorrow. Prepay now to lock in today’s rate?',options:[{label:'Prepay · gamble',detail:'Spend $500 now. 65% chance prices rise and you save $1,100; otherwise they fall and the money is gone.',cash:-500,gamble:{chance:.65,win:{cash:1100,rep:0,text:'Prices spiked! Your prepaid fuel saved a fortune.'},lose:{cash:0,rep:0,text:'Prices fell. The prepayment was wasted.'}}},{label:'Wait and see',detail:'No spending, no risk.',cash:0,rep:0,result:'You kept your cash safe.'}]},
    {title:'LOST CHILD AT GATE A3',text:'A seven-year-old has lost their parents near gate A3.',options:[{label:'Terminal lockdown',detail:'Pause boarding and search every area. Costs $250 in delays but finds them fast.',cash:-250,rep:5,result:'Reunited in four minutes. The family is in tears of joy.'},{label:'Tannoy announcement',detail:'Free, but takes longer. 50% chance the parents hear it quickly.',gamble:{chance:.5,win:{cash:0,rep:3,text:'The parents heard the announcement immediately. Reunited!'},lose:{cash:0,rep:-3,text:'It took 40 minutes. The family filed a complaint.'}}}]},
    {title:'RUNWAY BIRD STRIKE RISK',text:'A flock of gulls is circling the runway threshold.',options:[{label:'Hire falconer · $180',detail:'A trained falcon clears the birds safely.',cash:-180,rep:2,result:'The falcon cleared the runway. Pilots loved the show.'},{label:'Keep operating',detail:'Free. 80% chance nothing happens; 20% chance of an engine inspection costing $900.',gamble:{chance:.8,win:{cash:0,rep:0,text:'The gulls moved on by themselves.'},lose:{cash:-900,rep:-3,text:'Bird strike! An aircraft needs a full engine inspection.'}}}]}
  ];
  const seatName=i=>`${Math.floor(i/2)+1}${i%2?'B':'A'}`;
  const pickOne=a=>a[Math.floor(Math.random()*a.length)];
  const tutorials={
    checkin:{title:'How to work check-in',steps:[
      'Scan the passport to reveal the travel document.',
      'Compare its name and flight code against the boarding ticket shown beside it — look closely for a different spelling or a different flight number.',
      'Weigh every bag. Any bag over 20 kg needs an excess-baggage tag before it can be loaded.',
      'Load each bag once it’s weighed (and tagged, if it needed one).',
      'If the document matches the ticket and isn’t expired, Accept the passenger. If anything is wrong, Refer them to the service desk instead.'
    ],note:'A wrong accept/refer, a skipped step, or a wrongly-tagged bag all count as mistakes — they lower your grade and your pay.'},
    security:{title:'How to work security screening',steps:[
      'Press “Run X-ray scanner” to reveal everything on the belt.',
      'Click only the genuinely dangerous items — knives, lighters, large liquids, spray cans, multi-tools, box cutters — to pull them into the restricted tray.',
      'Leave safe items alone (books, laptops, small water bottles, clothing, cameras, umbrellas). Pulling a safe item is a false alarm and counts against you.',
      'Once every hazard is handled, click “Release cleared bag.” Releasing with a hazard still on the belt also counts as a mistake.'
    ],note:'More hazards get mixed in as you gain experience — read every item before you decide.'},
    ground:{title:'How to work aircraft turnaround',steps:[
      'Click a bag on the cart to select it, then click “Standard hold” or “Fragile hold” to place it. Bags marked ◈ belong in the fragile hold.',
      'Click “Start pump”, watch the needle sweep the gauge, then click “Stop pump” the instant it’s inside the highlighted target band. Over- or under-filling means doing it again.',
      'Click “Arm clearance”, wait for the light, then click “Connect now!” as soon as it appears — too early or too late both fail.',
      'Once every bag is sorted, fuel is on target and the tug is connected, click “Signal ready for departure.”'
    ],note:'The fuel target band and the pushback timing window both get tighter as you gain experience.'},
    cabin:{title:'How to work cabin preparation',steps:[
      'Walk the rows: some seats are highlighted because they need a belt fastened or a tray stowed. The rest are already fine.',
      'Click each highlighted seat to fix it, and close every open overhead bin.',
      'Once everything is secure, click “Report cabin ready.” Anything still open when you report counts as a mistake.'
    ],note:'Which seats need attention is different every shift, and more of them need it as you gain experience.'},
    atc:{title:'How to work air traffic control',steps:[
      'WIND (left board): the dial shows where the wind blows from. Runway numbers are compass headings: 36 = north (360°), 18 = south (180°), 27 = west (270°). Click the runway on the right board whose number is closest to the wind, e.g. wind 350° → RWY 36.',
      'FLIGHT STRIPS (middle board): each aircraft that calls you gets a strip. Click a strip to talk to that aircraft. ARRIVAL strips count down the seconds it has left on final.',
      'RUNWAY FRAMES (right board): green = the runway in use is clear, red = another aircraft is on it.',
      'BUTTONS (desk): departures get “Cleared for takeoff”, arrivals get “Cleared to land”. If the runway is red, press “Go around / hold” for an arrival, or just wait for a departure.',
      'A red flashing MAYDAY strip always goes first. Follow the tutorial panel: it tells you the exact strip or button to use next, and “Show me where” points at it. Press B for binoculars.'
    ],note:'Mistakes: clearing onto a red runway, using the wrong runway, ignoring a MAYDAY or letting an arrival run out of time. Your first shift is gentle: no blocked runways.'},
    engineer:{title:'How to work aircraft maintenance',steps:[
      'Click “Inspect tyre” to confirm the damage.',
      'Check the spec plate size, then pick the matching replacement wheel from the parts trolley — the other sizes are decoys.',
      'Click “Fit replacement wheel.”',
      'For each of the four bolts: click “Start torque”, watch the needle sweep, then click “Torque now!” the instant it’s inside the target band. Too early under-torques it, too late over-torques it — either way you’ll need to redo that bolt.',
      'Once all four bolts are torqued, click “Run check & sign release.”'
    ],note:'The torque needle sweeps faster with every shift, so the timing window gets tighter.'}
  };
  function shuffle(a){const r=a.slice();for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}
  // Mirrors the CSS `gauge-sweep` keyframes (0%→100% over the first half of
  // animation-duration, then back down), so the visible needle and the logical
  // position the game checks on a click are always the same value.
  function sweepPos(g,t=now()){const period=g.period,half=period/2,phase=((t-g.start)%period+period)%period;return phase<half?phase/half*100:(period-phase)/half*100;}
  function scoreOf(j){
    const elapsed=now()-(j.startedAt||now()),par=(PAR[j.role]||20000)*(j.physical?(j.role==='cabin'?7:j.role==='ground'?5:3):1);
    const timeScore=Math.max(0,Math.min(1,1-((elapsed-par)/(par*1.5))));
    const mistakePenalty=Math.min(1,(j.mistakes||0)*.16);
    // Perfect timing earns back a little of what slow play costs.
    return Math.min(1,Math.max(.25,(1-mistakePenalty)*.7+timeScore*.3+Math.min(.1,(j.perfects||0)*.025)));
  }
  function gradeLetter(score){return score>=.93?'S':score>=.82?'A':score>=.66?'B':score>=.48?'C':'D';}

  function create(role,sequence=0){
    const base={role,sequence,done:[],mistakes:0,feedback:'',complete:false,startedAt:now(),seat:null,drink:null,inspected:null,events:[],streak:0,bestStreak:0,perfects:0};
    if(role==='checkin'){
      const bagCount=1+Math.min(2,Math.floor(sequence/3));
      const rate=Math.min(.62,.18+sequence*.035);
      const problem=Math.random()<rate?['expired','name','flight'][Math.floor(Math.random()*3)]:null;
      const name=NAMES[sequence%NAMES.length];
      const ticketName=problem==='name'?NAMES[(sequence+3+Math.floor(Math.random()*4))%NAMES.length]:name;
      const flightCode='SP '+(200+sequence%70);
      const ticketFlight=problem==='flight'?'SP '+(300+(sequence*7)%70):flightCode;
      const bags=Array.from({length:bagCount},(_,i)=>({id:i,weight:12+Math.floor(Math.random()*22),weighed:false,tagged:false,loaded:false}));
      return {...base,name,ticketName,flightCode,ticketFlight,expired:problem==='expired',valid:!problem,bags,decided:false,greeting:pickOne(GREETINGS)};
    }
    if(role==='security'){
      const hazardCount=1+Math.min(2,Math.floor(sequence/3)),totalItems=5+Math.min(3,Math.floor(sequence/2));
      const hazards=shuffle(HAZARD_ITEMS).slice(0,hazardCount).map(h=>({label:h[0],cls:h[1],hazard:true,handled:false}));
      const safes=shuffle(SAFE_ITEMS).slice(0,Math.max(2,totalItems-hazardCount)).map(s=>({label:s[0],cls:s[1],hazard:false,handled:false}));
      const items=shuffle([...hazards,...safes]).map((it,i)=>({...it,id:i,material:MATERIAL[it.cls]||'mixed'}));
      return {...base,items};
    }
    if(role==='ground'){
      const bagCount=3+Math.min(2,Math.floor(sequence/3));
      const bags=Array.from({length:bagCount},(_,i)=>({id:i,fragile:Math.random()<.4,weight:8+Math.floor(Math.random()*30),zone:null}));
      const width=Math.max(6,16-sequence*1.1),lo=Math.round(76+Math.random()*(94-width-76));
      return {...base,bags,selected:null,fuel:0,fuelTarget:[lo,lo+Math.round(width)],fuelGauge:null,signalAt:null,signalWindowMs:Math.max(260,520-sequence*18)};
    }
    if(role==='cabin'){
      const seats=Array.from({length:12},(_,i)=>({id:i,needsBelt:false,needsTray:false,fixed:false}));
      let remaining=3+Math.min(3,Math.floor(sequence/2));
      for(const id of shuffle(seats.map(s=>s.id))){if(remaining<=0)break;const s=seats[id];s[Math.random()<.5?'needsBelt':'needsTray']=true;remaining--;}
      const binCount=1+Math.min(2,Math.floor(sequence/4));
      const bins=Array.from({length:3},(_,i)=>({id:i,open:i<binCount}));
      const order=shuffle(seats.map(s=>s.id)),requests=order.slice(0,2).map(id=>({id,drink:Math.random()<.5?'water':'juice',served:false}));
      // Call bells ring after boarding; the safety demonstration is performed at the front of the cabin.
      const lines=shuffle(CALLS),calls=order.slice(2,2+1+Math.min(1,Math.floor(sequence/2))).map((id,i)=>({id,after:12000+i*22000,line:lines[i],ringing:false,answered:false}));
      return {...base,seats,bins,requests,calls,demo:{order:shuffle(Object.keys(DEMO)),step:0,started:false,promptAt:null}};
    }
    if(role==='engineer'){
      const spec=8+Math.floor(Math.random()*3);
      const sizes=shuffle([...new Set([spec,spec+1,spec-1,spec+2])]).slice(0,3);
      if(!sizes.includes(spec))sizes[0]=spec;
      const options=shuffle(sizes).map((size,i)=>({id:i,size}));
      const boltSpeed=Math.max(650,1250-sequence*35);
      return {...base,spec,options,tool:null,bolts:[0,1,2,3].map(i=>({id:i,gauge:null,done:false})),boltSpeed,lastBolt:null};
    }
    if(role==='atc'){
      // Aircraft call in one after another; arrivals burn their final-approach time while they wait.
      const count=3+Math.min(3,Math.floor(sequence/2)),types=['jet','cargo','trainer'];
      const requests=Array.from({length:count},(_,i)=>({id:i,callsign:'Sky Plane '+(300+Math.floor(Math.random()*600)),kind:Math.random()<.5?'takeoff':'landing',arriveAfter:i===0?4000:4000+i*Math.max(7000,15000-sequence*1000)+Math.random()*3000,final:Math.max(22000,45000-sequence*2500),aircraft:types[Math.floor(Math.random()*3)],emergency:false,done:false}));
      if(sequence>=1&&count>2&&Math.random()<.5)Object.assign(requests[1+Math.floor(Math.random()*(count-1))],{emergency:true,kind:'landing',aircraft:'cargo',final:24000});
      return {...base,requests,selected:null,active:null,wind:null,windPick:Math.floor(Math.random()*3),windShift:sequence>=2&&Math.random()<.55,occupancy:[null,null,null],blockRate:sequence===0?0:Math.min(.5,.15+sequence*.05),anims:[]};
    }
    if(role==='manager')return {...base,incident:null,nextIncidentAt:now()+3000,handled:0,lastIncident:null,outcome:null};
    if(role==='pilot')return {...base,atc:null,readbackTries:0};
    return base;
  }

  // Neutral actions pick something up or start a gauge; they neither build nor break a streak.
  const NEUTRAL=/^(listen$|strip:|pumpStart|boltStart:|armSignal|putDown|select:|drink:|inspectItem:|demoStart|clearance|seat:)/;
  function act(j,action,dt=0){
    if(j.complete)return false;
    if(!Array.isArray(j.events))j.events=[];
    const before=j.mistakes||0,complete=step(j,action,dt);
    if((j.mistakes||0)>before){j.streak=0;j.events.push({type:'bad',text:'MISTAKE'});}
    else if(!NEUTRAL.test(action)){j.streak=(j.streak||0)+1;j.bestStreak=Math.max(j.bestStreak||0,j.streak);j.events.push({type:'ok',text:j.streak>=3?'STREAK ×'+j.streak:''});}
    if(complete)j.events.push({type:'complete',text:gradeLetter(scoreOf(j))});
    if(j.events.length>40)j.events.splice(0,j.events.length-40);
    return complete;
  }
  // Time-driven events: cabin call bells and manager incidents arrive while you work.
  function tick(j){
    if(!j||j.complete)return;if(!Array.isArray(j.events))j.events=[];const t=now();
    if(j.role==='cabin'&&j.physical&&j.boardedAt&&j.calls)for(const c of j.calls)if(!c.ringing&&t>=j.boardedAt+c.after){c.ringing=true;c.rangAt=t;j.events.push({type:'bell',text:'CALL BELL · '+seatName(c.id),at:'seat'+c.id});}
    if(j.role==='atc'){
      // Traffic starts calling once the controller reaches the tower cab.
      if(j.physical&&!j.towerAt)return;
      if(!j.wind)setWind(j,j.windPick);
      for(const r of j.requests){
        if(!r.arrived&&t>=j.startedAt+r.arriveAfter){r.arrived=true;r.arrivedAt=t;if(r.kind==='landing')r.deadline=t+r.final;
          j.events.push({type:'say',text:requestLine(j,r),at:'strip'+r.id});if(r.emergency)j.events.push({type:'alarm',text:'MAYDAY · '+r.callsign,at:'strip'+r.id});
          // Other traffic sometimes blocks the runway in use just as someone calls you.
          const k=j.active??bestRunway(j);if(!r.emergency&&!j.occupancy[k]&&Math.random()<j.blockRate){j.occupancy[k]={from:t,until:t+8000+Math.random()*7000,traffic:pickOne(TRAFFIC)};j.events.push({type:'alert',text:'RWY '+runwayName(j,k)+' OCCUPIED',at:'rwy'+k});}}
        // An arrival that never hears a landing clearance has to go around by itself.
        if(r.arrived&&!r.done&&r.kind==='landing'&&t>=r.deadline){j.mistakes=(j.mistakes||0)+1;j.streak=0;j.feedback=`${r.callsign} had to go around: no landing clearance in time.`;
          j.anims.push({kind:'goaround',t0:t,request:r.id,runway:j.active??bestRunway(j),aircraft:r.aircraft,left:0});r.deadline=t+r.final;j.events.push({type:'bad',text:'GO AROUND',at:'strip'+r.id});}
      }
      for(let k=0;k<3;k++)if(j.occupancy[k]&&t>=j.occupancy[k].until)j.occupancy[k]=null;
      // Halfway through some shifts the wind swings round and another runway has the headwind.
      if(j.windShift&&!j.shifted&&j.requests.filter(r=>r.done).length>=Math.floor(j.requests.length/2)){j.shifted=true;const was=bestRunway(j);let k=was;for(let n=0;n<10&&k===was;n++){setWind(j,Math.floor(Math.random()*3));k=bestRunway(j);}
        j.events.push({type:'alarm',text:'WIND SHIFT · '+j.wind.from+'°',at:'wind'},{type:'say',text:`All stations, wind now ${j.wind.from} degrees, ${j.wind.kt} knots.`});}
    }
    if(j.role==='manager'&&!j.incident&&t>=j.nextIncidentAt){const pool=INCIDENTS.filter(i=>i.title!==j.lastIncident);j.incident=pickOne(pool);j.lastIncident=j.incident.title;j.events.push({type:'alert',text:'NEW INCIDENT',at:'incident-title'});}
  }
  function step(j,action,dt=0){
    const has=k=>j.done.includes(k),mark=k=>{if(!has(k))j.done.push(k);};
    const need=(cond,msg)=>{if(!cond){j.feedback=msg;j.mistakes=(j.mistakes||0)+1;}return cond;};
    const emit=(type,text,at)=>j.events.push({type,text,at}),perfect=(text,at)=>{j.perfects=(j.perfects||0)+1;emit('perfect',text,at);};
    j.feedback='';
    if(j.role==='checkin'){
      if(action.startsWith('seat:')){j.seat=action.slice(5);mark('seat');}
      else if(action==='givePass'){if(need(has('decision'),'Print the boarding pass first.'))j.complete=true;}
      else if(action==='scan')mark('scan');
      else if(action.startsWith('weigh:')){
        if(!need(has('scan'),'Scan the passport before handling baggage.'))return false;
        const b=j.bags.find(x=>x.id===+action.slice(6));if(b&&!b.weighed){b.weighed=true;b.weighedAt=now();}
      }else if(action.startsWith('tag:')){
        const b=j.bags.find(x=>x.id===+action.slice(4));
        if(!need(b&&b.weighed,'Weigh this bag first.'))return false;
        if(b.weight>20)b.tagged=true;else need(false,'This bag is under 20 kg — it doesn’t need an excess tag.');
      }else if(action.startsWith('load:')){
        const b=j.bags.find(x=>x.id===+action.slice(5));
        if(!need(b&&b.weighed,'Weigh this bag before sending it onto the belt.'))return false;
        if(b.weight>20&&!b.tagged){need(false,'Tag the excess-baggage bag before loading it.');return false;}
        if(!b.loaded){b.loaded=true;b.loadedAt=now();}
      }else if(action==='accept'){
        if(!need(has('scan'),'Scan the document before deciding.'))return false;
        if(!need(j.bags.every(b=>b.loaded),'Load every bag onto the belt first.'))return false;
        if(!need(!j.physical||!!j.seat,'Choose a window or aisle seat on the desk first.'))return false;
        if(j.valid){mark('decision');if(!j.physical)j.complete=true;else j.feedback='Boarding pass printed. Hand it to your customer.';}else need(false,j.photoMismatch?'The passport photo does not match the person at your desk. Refer them to the service desk.':j.expired?'This passport has expired. Refer the passenger to the service desk.':'The name or flight does not match. Refer the passenger to the service desk.');
      }else if(action==='refer'){
        if(!need(has('scan'),'Scan the document first.'))return false;
        if(!j.valid){mark('decision');j.complete=true;}else need(false,'This passenger checks out — don’t turn away a valid traveller.');
      }
    }else if(j.role==='security'){
      if(action==='scan'){if(!has('scan')){j.scannedAt=now();if(j.physical)emit('alarm','CHECK THE MONITOR','scanner');}mark('scan');}
      else if(action.startsWith('inspectItem:')){if(need(has('scan'),'Run the X-ray first.'))j.inspected=+action.split(':')[1];}
      else if(action==='confiscate'||action==='returnItem'){const it=j.items.find(i=>i.id===j.inspected);if(!need(!!it,'Pick an item from the tray first.'))return false;if(action==='confiscate'){it.handled=true;if(!it.hazard)need(false,'That item is permitted. Return safe belongings to the passenger.');else emit('speech',it.concealed?'I… have no idea how that got in there.':pickOne(SECURITY_LINES));}else if(it.hazard){need(false,'That item is restricted. Put it in the inspection tray.');return false;}else it.cleared=true;j.inspected=null;}
      else if(action.startsWith('remove:')){
        if(!need(has('scan'),'Run the X-ray scanner first.'))return false;
        const it=j.items.find(x=>x.id===+action.slice(7));if(!it||it.handled)return false;
        it.handled=true;if(!it.hazard)need(false,`${it.label} is safe to fly — that’s a false alarm.`);
      }else if(action==='release'){
        if(!need(has('scan'),'Scan the bag before releasing it.'))return false;
        const missed=j.items.filter(it=>it.hazard&&!it.handled||j.physical&&!it.hazard&&!it.cleared&&!it.handled);
        if(missed.length){j.mistakes+=missed.length;j.feedback=`You missed ${missed.length} unchecked item${missed.length>1?'s':''} — inspect the remaining belongings.`;return false;}
        mark('release');j.complete=true;
      }
    }else if(j.role==='ground'){
      if(action==='chocks')mark('chocks');
      else if(action==='putDown')j.selected=null;
      else if(action.startsWith('select:')){if(need(j.selected===null,'Place the carried bag in a hold, or put it down first.'))j.selected=+action.slice(7);}
      else if(action==='zoneFragile'||action==='zoneStandard'){
        if(!need(j.selected!==null&&j.selected!==undefined,'Select a bag from the cart first.'))return false;
        const b=j.bags.find(x=>x.id===j.selected),wantFragile=action==='zoneFragile';
        if(!b)return false;
        if(b.fragile!==wantFragile)need(false,b.fragile?'That case is marked fragile — use the fragile hold.':'That’s a standard bag — save the fragile hold for delicate items.');
        else{b.zone=wantFragile?'fragile':'standard';b.loadedAt=now();}
        j.selected=null;
      }else if(action==='pumpStart'){if(!j.fuelGauge)j.fuelGauge={start:now(),period:j.physical?Math.max(3500,6000-j.sequence*90):Math.max(850,1600-j.sequence*35)};}
      else if(action==='pumpStop'){
        if(!need(!!j.fuelGauge,'Start the pump first.'))return false;
        const pos=sweepPos(j.fuelGauge),[lo,hi]=j.fuelTarget;
        if(pos>=lo&&pos<=hi){j.fuel=100;mark('fuel');if(Math.abs(pos-(lo+hi)/2)<=(hi-lo)*.2)perfect('PERFECT FILL','fuel');}else need(false,pos<lo?'Stopped short — top up again.':'Overfilled — ease off sooner next time.');
        j.fuelGauge=null;
      }else if(action==='armSignal'){if(need(has('fuel')&&j.bags.every(b=>b.zone)&&(!j.physical||has('chocks')),'Load every bag, finish fuelling and remove the wheel chocks first.')){j.signalWindowMs=j.physical?1400:j.signalWindowMs;j.signalAt={ready:now()+1000+Math.random()*1000,fired:false};}}
      else if(action==='tug'){
        if(!need(j.bags.every(b=>b.zone),'Load every bag into a hold first.'))return false;
        if(!need(has('fuel'),'Finish refuelling before connecting the tug.'))return false;
        if(!need(!!j.signalAt,'Arm pushback clearance and wait for the green light.'))return false;
        const t=now();
        if(t<j.signalAt.ready){need(false,'Too early — wait for the green light.');j.signalAt=null;return false;}
        if(t>j.signalAt.ready+j.signalWindowMs){need(false,'Too slow — the clearance window closed. Arm it again.');j.signalAt=null;return false;}
        mark('tug');if(t-j.signalAt.ready<=Math.min(450,j.signalWindowMs*.35))perfect('LIGHTNING REFLEXES','tug');
      }else if(action==='release'){if(need(has('tug'),'Connect the tug after clearance.')){mark('release');j.releasedAt=now();j.complete=true;}}
    }else if(j.role==='cabin'){
      if(action.startsWith('attend:')){const c=(j.calls||[]).find(c=>c.id===+action.split(':')[1]&&c.ringing&&!c.answered);if(!c)return false;c.answered=true;if(now()-c.rangAt<9000)perfect('SPEEDY SERVICE','seat'+c.id);j.feedback='Thank you, that really helps.';emit('speech','Thank you so much!','seat'+c.id);}
      else if(action==='demoStart'){const d=j.demo;if(d&&!d.started){d.started=true;d.promptAt=now();emit('say','Ladies and gentlemen, please direct your attention to the cabin crew for our safety demonstration. '+DEMO[d.order[0]].line);}}
      else if(action.startsWith('demo:')){
        const d=j.demo;if(!d)return false;if(!need(d.started,'Start the safety demonstration at the front of the cabin first.'))return false;if(d.step>=d.order.length)return false;
        const want=d.order[d.step];if(!need(action.slice(5)===want,`The announcement is about the ${DEMO[want].name}. Show that prop.`))return false;
        if(now()-d.promptAt<4500)perfect('PERFECT TIMING','demo-'+want);d.step++;d.promptAt=now();
        if(d.step<d.order.length)emit('say',DEMO[d.order[d.step]].line);else{mark('demo');d.doneAt=now();emit('say','Thank you for your attention. Please sit back, relax and enjoy the flight.');emit('applause','BRAVO!','demo-'+want);}
      }
      else if(action.startsWith('drink:')){j.drink=action.slice(6);j.feedback='Carrying '+j.drink+'. Walk to the passenger with that request.';}
      else if(action.startsWith('serve:')){const r=j.requests.find(r=>r.id===+action.split(':')[1]);if(r&&need(j.drink===r.drink,'This passenger asked for '+r.drink+'. Collect it from the galley.')){r.served=true;j.drink=null;j.feedback='Thank you! That is just what I wanted.';}}
      else if(action.startsWith('fix:')){
        const s=j.seats.find(x=>x.id===+action.slice(4));if(!s||s.fixed)return false;
        if(s.needsBelt||s.needsTray)s.fixed=true;else need(false,'That seat was already secure.');
      }else if(action.startsWith('bin:')){
        const b=j.bins.find(x=>x.id===+action.slice(4));if(!b)return false;
        if(b.open)b.open=false;else need(false,'That bin is already closed.');
      }else if(action==='release'){
        const pending=j.seats.filter(s=>(s.needsBelt||s.needsTray)&&!s.fixed).length+j.bins.filter(b=>b.open).length+(j.physical?j.requests.filter(r=>!r.served).length+(j.calls||[]).filter(c=>c.ringing&&!c.answered).length+(j.demo&&!has('demo')?1:0):0);
        if(pending){j.mistakes+=pending;j.feedback=`${pending} item${pending>1?'s':''} still need attention before doors close.`;return false;}
        mark('release');j.complete=true;
      }
    }else if(j.role==='engineer'){
      if(action==='jack'){if(need(has('inspect'),'Inspect the wheel first.')){mark('jack');j.jackAt=j.jackAt||now();}}
      else if(action==='lower'){if(need(j.bolts.every(b=>b.done),'Torque every bolt before lowering the jack.')){mark('lower');j.lowerAt=j.lowerAt||now();}}
      else if(action==='inspect')mark('inspect');
      else if(action.startsWith('pick:')){
        if(!need(has('inspect'),'Inspect the damaged wheel before selecting a replacement.'))return false;
        const opt=j.options.find(o=>o.id===+action.slice(5));
        if(opt&&opt.size===j.spec){j.tool='wheel';mark('spare');}else need(false,'Wrong size — check the spec plate again.');
      }else if(action==='replace'){if(need(j.tool==='wheel'&&(!j.physical||has('jack')),'Raise the jack and select the correctly sized wheel.')){mark('replace');j.replacedAt=j.replacedAt||now();}}
      else if(action.startsWith('boltStart:')){
        const b=j.bolts.find(x=>x.id===+action.slice(10));
        // Real wheels are torqued in a cross pattern: after one bolt, do the diagonally opposite one.
        const cross=nextCrossBolt(j);if(j.physical&&b&&!b.done&&!b.gauge&&has('replace')&&cross!==null&&b.id!==cross){need(false,`Cross pattern! Torque bolt ${cross+1} next — it is diagonally opposite bolt ${j.lastBolt+1}.`);return false;}
        if(need(has('replace'),'Fit the replacement wheel before torquing the bolts.')&&b&&!b.done&&!b.gauge)b.gauge={start:now(),period:j.physical?Math.max(3500,6000-j.sequence*90):j.boltSpeed};
      }else if(action.startsWith('boltStop:')){
        const b=j.bolts.find(x=>x.id===+action.slice(9));if(!b||!b.gauge)return false;
        const pos=sweepPos(b.gauge);
        if(pos>=42&&pos<=58){b.done=true;j.lastBolt=b.id;mark('bolt'+b.id);if(Math.abs(pos-50)<=3.2)perfect('PERFECT TORQUE','bolt'+b.id);}else need(false,pos<42?'Under-torqued — try again.':'Over-torqued — ease off next time.');
        b.gauge=null;
      }else if(action==='test'){if(need(j.bolts.every(b=>b.done)&&(!j.physical||has('lower')),'Torque all four bolts and lower the jack before the functional check.')){mark('test');j.testAt=now();j.complete=true;}}
    }else if(j.role==='atc'){
      const t=now(),pending=pendingOf(j),r=selectedOf(j),best=bestRunway(j),mayday=pending.find(x=>x.emergency);
      if(action.startsWith('strip:')){const x=pending.find(x=>x.id===+action.slice(6));if(x){j.selected=x.id;j.feedback=`${x.callsign}: ${x.emergency?'MAYDAY, engine failure':x.kind==='takeoff'?'holding short, ready for departure':'on final, '+Math.ceil(finalLeft(x))+' s from the runway'}.`;}return false;}
      if(action.startsWith('runway:')){const k=+action.slice(7);
        if(!need(k===best,`The wind is from ${j.wind.from}° at ${j.wind.kt} kt. Aircraft take off and land into the wind: use runway ${runwayName(j,best)}.`))return false;
        const changed=j.active!==k;j.active=k;mark('runway');if(changed)emit('say',`All stations, runway ${runwayName(j,k)} in use.`,'rwy'+k);return false;}
      if(action==='listen'){const x=r||pending[0];if(x)emit('say',requestLine(j,x),'strip'+x.id);return false;}
      if(!need(!!r,pending.length?'Select a flight strip first.':'No aircraft are calling you right now.'))return false;
      const rw='runway '+runwayName(j,j.active??best);
      if(action==='clearTakeoff'||action==='clearLand'){
        if(!need(action===(r.kind==='takeoff'?'clearTakeoff':'clearLand'),r.kind==='takeoff'?`${r.callsign} wants to depart, not land.`:`${r.callsign} is on final approach: it needs a landing clearance.`))return false;
        if(!need(j.active!==null,'Set the active runway into the wind first.'))return false;
        if(!need(j.active===best,`The wind is now from ${j.wind.from}°. Change to runway ${runwayName(j,best)} before clearing anyone.`))return false;
        if(!need(!mayday||mayday===r,`MAYDAY! ${mayday&&mayday.callsign} has priority. Clear the emergency first.`))return false;
        if(occupied(j,j.active)){need(false,`${rw} is occupied by ${j.occupancy[j.active].traffic}! ${r.kind==='takeoff'?'Keep them holding short':'Send them around'}.`);emit('alarm','RUNWAY INCURSION','rwy'+j.active);return false;}
        r.done=true;j.selected=null;j.anims.push({kind:r.kind,t0:t,request:r.id,runway:j.active,aircraft:r.aircraft,left:finalLeft(r)});
        emit('say',`${r.callsign}, wind ${j.wind.from} at ${j.wind.kt}, ${rw}, ${r.kind==='takeoff'?'cleared for takeoff':'cleared to land'}.`,'strip'+r.id);
        if(r.emergency)perfect('MAYDAY HANDLED','strip'+r.id);else if(t-r.arrivedAt<7000)perfect('SMOOTH CLEARANCE','strip'+r.id);
        if(j.requests.every(x=>x.done)){mark('traffic');j.complete=true;}
      }else if(action==='goAround'){
        if(r.kind==='takeoff'){j.feedback=`${r.callsign} is holding short of ${rw}.`;emit('say',`${r.callsign}, hold short ${rw}.`,'strip'+r.id);return false;}
        if(!need(occupied(j,j.active??best),`${rw} is clear. Clear ${r.callsign} to land instead of sending it around.`))return false;
        j.anims.push({kind:'goaround',t0:t,request:r.id,runway:j.active??best,aircraft:r.aircraft,left:finalLeft(r)});r.deadline=t+r.final;j.selected=null;
        emit('say',`${r.callsign}, go around, ${rw} is occupied. Fly the published missed approach.`,'strip'+r.id);
      }
    }else if(j.role==='manager'){
      if(action.startsWith('incident:')){
        const inc=j.incident,o=inc&&inc.options[+action.split(':')[1]];if(!o)return false;
        let cash=o.cash||0,rep=o.rep||0,text=o.result||'Decision made.',won=null;
        if(o.gamble){won=Math.random()<o.gamble.chance;const r=won?o.gamble.win:o.gamble.lose;cash+=r.cash;rep+=r.rep;text=r.text;}
        j.outcome={cash,rep,text,title:inc.title,won};j.incident=null;j.handled++;j.nextIncidentAt=now()+20000;mark('incident');j.feedback=text;
        emit(won===false?'gamble-lose':won?'gamble-win':'decision',text,'incident-title');
      }
    }else if(j.role==='pilot'){
      if(action==='clearance'){
        if(!need(has('weather')&&has('fuelcheck'),'Finish the weather and fuel checks before calling ATC.'))return false;
        if(!j.atc){const digit=()=>1+Math.floor(Math.random()*7),squawk=[digit(),digit(),digit(),digit()].join(''),runway=pickOne(['09','27','18','36']),altitude=pickOne([3000,4000,5000,6000]);
          const alter=(i,d)=>squawk.slice(0,i)+(((+squawk[i]+d-1)%7)+1)+squawk.slice(i+1);
          j.atc={squawk,runway,altitude,options:shuffle([squawk,alter(3,1),alter(1,3)]),callsign:'Sky Plane '+(200+j.sequence%70)};}else j.atcRepeats=(j.atcRepeats||0)+1;
        j.atc.issuedAt=now();
        const a=j.atc,spell=t=>String(t).split('').join(' ');mark('clearance');j.feedback=`ATC: ${a.callsign}, cleared as filed, runway ${a.runway}, climb ${a.altitude} feet, squawk ${a.squawk}.`;
        emit('say',`${a.callsign.replace(/\d+/,n=>spell(n))}, cleared as filed. Runway ${spell(a.runway)}. Climb and maintain ${a.altitude} feet. Squawk ${spell(a.squawk)}.`);
      }else if(action.startsWith('readback:')){
        const a=j.atc;if(!need(!!a,'Request your clearance from ATC first.'))return false;j.readbackTries++;
        if(!need(a.options[+action.split(':')[1]]===a.squawk,'ATC: “Negative. Say again your squawk code.”'))return false;
        mark('readback');if(j.readbackTries===1&&!j.atcRepeats)perfect('READBACK CORRECT','atc-title');j.feedback='ATC: “Readback correct. Contact tower when ready.”';emit('say','Readback correct. Contact tower when ready for departure.');
      }
    }
    return j.complete;
  }
  function nextCrossBolt(j){const done=j.bolts.filter(b=>b.done).length;if(done%2===0||j.lastBolt===null)return null;const opposite=3-j.lastBolt;return j.bolts[opposite]&&!j.bolts[opposite].done?opposite:null;}

  function gaugeEl(g,cls='gauge-needle'){
    if(!g)return '';
    const elapsed=now()-g.start;
    return `<div class="gauge-track"><div class="gauge-band" style="left:${g.lo??0}%;width:${(g.hi??100)-(g.lo??0)}%"></div><div class="${cls}" style="animation-duration:${g.period}ms;animation-delay:${-elapsed}ms"></div></div>`;
  }
  function view(j){
    const has=k=>j.done.includes(k);
    const button=(a,t,cls='')=>`<button class="job-control ${has(a)?'done':''} ${cls}" data-job-action="${a}">${has(a)?'✓ ':''}${t}</button>`;
    let body='',subtitle='';
    if(j.role==='checkin'){
      subtitle='Compare the document to the ticket, weigh every bag, then accept or refer the passenger.';
      body=`<div class="job-desk"><div class="travel-document"><span class="job-kicker">TRAVEL DOCUMENT</span>${has('scan')?`<h2>${j.name}</h2><p>Flight on document: <b>${j.flightCode}</b></p><p>${j.expired?'<span class="job-alert">EXPIRES · 3 months ago</span>':'Valid to 2031'}</p>`:'<p>Place document on scanner</p>'}${button('scan','Scan passport')}</div>
      <div class="travel-document"><span class="job-kicker">BOARDING TICKET</span><h2>${j.ticketName}</h2><p>Flight on ticket: <b>${j.ticketFlight}</b></p><p class="help-note">Check the name and flight code match the document exactly.</p></div>
      <div class="baggage-zone"><span class="job-kicker">BAGGAGE · ${j.bags.filter(b=>b.loaded).length}/${j.bags.length} loaded</span>${j.bags.map(b=>`<div class="bag-row ${b.loaded?'done':''}"><span>Bag ${b.id+1} · ${b.weighed?b.weight+' KG':'? KG'}${b.tagged?' · TAGGED':''}</span><span class="button-row">${button('weigh:'+b.id,'Weigh')}${b.weighed&&b.weight>20?button('tag:'+b.id,'Tag'):''}${button('load:'+b.id,'Load')}</span></div>`).join('')}</div>
      <div class="boarding-printer"><span class="job-kicker">DECISION</span>${button('accept','Accept & issue pass','primary')}${button('refer','Refer to service desk')}</div></div>`;
    }else if(j.role==='security'){
      subtitle='Watch the belt, pull every restricted item, and release the bag once it’s clear.';
      body=`<div class="scanner-work"><div class="scanner-header"><span>XRAY / LANE 02</span><span>${has('scan')?`${j.items.filter(x=>x.hazard).length} restricted item${j.items.filter(x=>x.hazard).length===1?'':'s'} on this belt`:'STANDBY'}</span></div><div class="xray-monitor ${has('scan')?'scanned':''}">${has('scan')?`<div class="xray-belt">${j.items.map(it=>`<button class="xray-item ${it.cls} ${it.handled?(it.handled==='missed'?'missed':'processed'):''}" data-job-action="remove:${it.id}" ${it.handled?'disabled':''}>${it.label}</button>`).join('')}</div>`:'<div class="scan-line"></div><p>Bag ready at the conveyor</p>'}</div><div class="scanner-actions">${button('scan','Run X-ray scanner','primary')}${button('release','Release cleared bag','primary')}</div></div>`;
    }else if(j.role==='ground'){
      subtitle='Sort every bag into the right hold, hit the fuel target, then time the pushback signal.';
      body=`<div class="turnaround-grid"><section><span class="job-kicker">BAGGAGE CART · ${j.bags.filter(x=>x.zone).length}/${j.bags.length} sorted</span><div class="luggage-cart">${j.bags.map(b=>`<button class="bag-chip ${b.zone?'done':''} ${j.selected===b.id?'selected':''}" data-job-action="select:${b.id}" ${b.zone?'disabled':''}>Bag ${b.id+1}${b.fragile?' ◈':''}<small>${b.weight} kg</small></button>`).join('')}</div><div class="cargo-zones"><button class="job-control" data-job-action="zoneStandard">Standard hold</button><button class="job-control" data-job-action="zoneFragile">Fragile hold ◈</button></div></section>
      <section class="fuel-station"><span class="job-kicker">FUEL SERVICE · target ${j.fuelTarget[0]}–${j.fuelTarget[1]}%</span>${has('fuel')?'<p class="job-hud-status success">✓ Fuel on target</p>':j.fuelGauge?gaugeEl(Object.assign({lo:j.fuelTarget[0],hi:j.fuelTarget[1]},j.fuelGauge)):'<p>Start the pump, then stop it on target.</p>'}${button(j.fuelGauge?'pumpStop':'pumpStart',j.fuelGauge?'Stop pump':'Start pump','primary')}</section>
      <section class="tug-station"><span class="job-kicker">PUSHBACK CLEARANCE</span>${has('tug')?'<p class="job-hud-status success">✓ Tug connected</p>':j.signalAt?'<p class="signal-armed">Wait for green…</p>':'<p>Arm clearance, then connect on the green light.</p>'}${j.signalAt?button('tug','Connect now!','primary'):button('armSignal','Arm clearance')}${button('release','Signal ready for departure','primary')}</section></div>`;
    }else if(j.role==='cabin'){
      {const pending=j.seats.filter(s=>(s.needsBelt||s.needsTray)&&!s.fixed).length+j.bins.filter(b=>b.open).length+(j.physical?j.requests.filter(r=>!r.served).length:0);
      subtitle=`Find every unsecured belt or tray (${pending} item${pending===1?'':'s'} left) and close the open bins before doors close.`;}
      body=`<div class="cabin-inspection"><div class="overhead-row">${j.bins.map(b=>`<button class="overhead-bin ${b.open?'':'secured'}" data-job-action="bin:${b.id}">${b.open?'Close bin '+(b.id+1):'Bin '+(b.id+1)+' closed'}</button>`).join('')}</div><div class="cabin-seats">${j.seats.map(s=>{const issue=s.needsBelt||s.needsTray;const label=issue&&!s.fixed?(s.needsBelt?'Fasten belt':'Stow tray'):'✓';return `<button class="cabin-seat ${s.fixed||!issue?'ok':'flag'}" data-job-action="fix:${s.id}"><span>${Math.floor(s.id/4)+1}${'ABCD'[s.id%4]}</span><i>${label}</i></button>`;}).join('')}</div>${button('release','Report cabin ready','primary')}</div>`;
    }else if(j.role==='atc'){
      subtitle='Work from the control tower: set the runway into the wind, then clear each aircraft when its runway is free.';
      body=`<div class="scanner-work"><div class="scanner-header"><span>TOWER</span><span>${j.wind?'WIND '+j.wind.from+'° '+j.wind.kt+' KT':''}</span></div><p>Take the lift to the control tower to work this shift.</p></div>`;
    }else if(j.role==='engineer'){
      subtitle='Pick the correctly sized wheel, fit it, then torque all four bolts to spec.';
      body=`<div class="maintenance-bay"><div class="parts-trolley"><span class="job-kicker">SPEC PLATE · size ${j.spec}</span>${button('inspect','Inspect tyre')}<div class="wheel-options">${has('inspect')?j.options.map(o=>`<button class="job-control ${j.tool==='wheel'&&o.size===j.spec?'done':''}" data-job-action="pick:${o.id}">Wheel · size ${o.size}</button>`).join(''):'<p>Inspect first</p>'}</div></div>
      <div class="wheel-assembly"><button class="main-wheel ${has('replace')?'repaired':''}" data-job-action="replace" aria-label="Fit replacement wheel"><span>${has('replace')?'NEW TYRE':'DAMAGED TYRE'}</span></button><div class="wheel-bolts">${j.bolts.map(b=>`<div class="bolt-slot"><span>Bolt ${b.id+1} ${b.done?'✓':''}</span>${b.done?'':(b.gauge?gaugeEl(Object.assign({lo:42,hi:58},b.gauge)):'')}${b.done?'':button(b.gauge?'boltStop:'+b.id:'boltStart:'+b.id,b.gauge?'Torque now!':'Start torque')}</div>`).join('')}</div></div>
      <div class="maintenance-record"><span class="job-kicker">RELEASE RECORD</span>${button('test','Run check & sign release','primary')}</div></div>`;
    }
    const score=scoreOf(j),grade=gradeLetter(score);
    return `<div class="job-simulation" data-role="${j.role}"><div class="job-simulation-heading"><div><span class="job-kicker">LIVE WORKSTATION / ${String(j.sequence+1).padStart(3,'0')}</span><h1>${names[j.role]}</h1><p>${subtitle}</p></div><div class="job-live">GRADE ${grade} · ${j.mistakes||0} mistake${j.mistakes===1?'':'s'}</div></div>${body}<div class="job-feedback ${j.complete?'success':''}" role="status">${j.complete?`✓ Job complete · grade ${grade} · Your airport has been updated.`:j.feedback||'Work the equipment carefully — speed and accuracy both pay.'}</div></div>`;
  }
  const api={create,act,tick,view,names,scoreOf,gradeLetter,tutorials,time:now,setPaused,nextCrossBolt,seatName,DEMO,COVERS,occupied,runwayName,bestRunway,pendingOf,selectedOf,finalLeft,runwaysOf};root.SkyJobs=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
