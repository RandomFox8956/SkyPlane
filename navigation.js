/* Smooth flight paths and shared airport taxi geometry. No external dependencies. */
(function(root){
  'use strict';
  const mod=a=>((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
  function curves(start,end,radius){
    const dx=end.x-start.x,dz=end.z-start.z,d=Math.hypot(dx,dz)/radius,theta=Math.atan2(dz,dx);
    const a=mod(start.yaw-Math.PI/2-theta),b=mod(end.yaw-Math.PI/2-theta);
    const sa=Math.sin(a),sb=Math.sin(b),ca=Math.cos(a),cb=Math.cos(b),cab=Math.cos(a-b),out=[];
    const add=(kind,t,p,q)=>{if([t,p,q].every(Number.isFinite))out.push({kind,length:(t+p+q)*radius,parts:[t,p,q]});};
    let p=2+d*d-2*cab+2*d*(sa-sb),v=Math.atan2(cb-ca,d+sa-sb);
    if(p>=0)add('LSL',mod(-a+v),Math.sqrt(p),mod(b-v));
    p=2+d*d-2*cab+2*d*(-sa+sb);v=Math.atan2(ca-cb,d-sa+sb);
    if(p>=0)add('RSR',mod(a-v),Math.sqrt(p),mod(-b+v));
    p=-2+d*d+2*cab+2*d*(sa+sb);
    if(p>=0){p=Math.sqrt(p);v=Math.atan2(-ca-cb,d+sa+sb)-Math.atan2(-2,p);add('LSR',mod(-a+v),p,mod(-b+v));}
    p=d*d-2+2*cab-2*d*(sa+sb);
    if(p>=0){p=Math.sqrt(p);v=Math.atan2(ca+cb,d-sa-sb)-Math.atan2(2,p);add('RSL',mod(a-v),p,mod(b-v));}
    return out.map(route=>{
      let x=start.x,z=start.z,h=start.yaw-Math.PI/2;
      const points=[{x,z,y:180,yaw:h+Math.PI/2}];
      route.parts.forEach((part,i)=>{const k=route.kind[i],n=Math.max(1,Math.ceil(part*radius/70)),step=part*radius/n;
        for(let j=0;j<n;j++){if(k==='S'){x+=Math.cos(h)*step;z+=Math.sin(h)*step;}else{const turn=k==='L'?1:-1,nh=h+turn*step/radius;x+=radius/turn*(Math.sin(nh)-Math.sin(h));z+=radius/turn*(Math.cos(h)-Math.cos(nh));h=nh;}points.push({x,z,y:180,yaw:h+Math.PI/2});}
      });
      return {...route,points,radius};
    });
  }
  function route(C,type,course,layout,homeRw,arrivalRw){
    const home=layout[0],dest=C.MISSIONS[type]?.destination&&layout[1]||home;
    const count=type==='race'?course.gates:C.MISSIONS[type].gates;
    const height=type==='race'?course.altitude:type==='training'?160:240;
    const radius=Math.max(800,type==='race'?course.radius:900),candidates=[];
    for(const departureLength of [650,1400,2200])for(const finalLength of [1800,2400])for(const r of [radius,radius*1.5,radius*2.2]){
      const start={...C.runwayToWorld(home,homeRw,0,-homeRw.half-departureLength),yaw:homeRw.rad};
      const end={...C.runwayToWorld(dest,arrivalRw,0,arrivalRw.half+finalLength),yaw:arrivalRw.rad};
      // Keep each map's race character, with tangent arcs instead of sharp waypoint corners.
      const excursion=[],shape=type==='race'?home.map.race?.shape:'arc',sign=course.direction==='right'?1:-1;
      const turns=shape==='figure8'?[sign*Math.PI*2,-sign*Math.PI*2]:shape==='loop'||shape==='climb'?[sign*Math.PI*2]:shape==='slalom'?[sign*.55,-sign*1.1,sign*1.1,-sign*.55]:[];
      let pose={...start};
      for(const turn of turns){const n=Math.ceil(Math.abs(turn)*r/70),step=turn/n;for(let i=0;i<n;i++){const next=pose.yaw+step,side=Math.sign(turn);pose={x:pose.x+r/side*(Math.cos(pose.yaw)-Math.cos(next)),z:pose.z+r/side*(Math.sin(pose.yaw)-Math.sin(next)),yaw:next};excursion.push({...pose});}}
      for(const candidate of curves(pose,end,r)){
        const pts=[{...start},...excursion.map(p=>({...p})),...candidate.points.slice(1)];
        for(let d=departureLength-70;d>=400;d-=70)pts.unshift({...C.runwayToWorld(home,homeRw,0,-homeRw.half-d),yaw:homeRw.rad});
        for(let d=finalLength-70;d>=200;d-=70)pts.push({...C.runwayToWorld(dest,arrivalRw,0,arrivalRw.half+d),yaw:arrivalRw.rad});
        const dist=[0];for(let i=1;i<pts.length;i++)dist.push(dist[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z));
        let penalty=0;
        for(let i=0;i<pts.length;i++){
          const g=pts[i],ground=C.terrainHeight(layout,g.x,g.z);
          g.y=Math.max(ground>25?ground+100:12,Math.min(height,40+dist[i]*.075,14+(dist.at(-1)-dist[i])*.055));
          penalty+=Math.max(0,g.y-height)*6;
        }
        for(let i=1;i<pts.length;i++)pts[i].y=Math.max(pts[i].y,pts[i-1].y-(dist[i]-dist[i-1])*.055);
        for(let i=pts.length-2;i>=0;i--)pts[i].y=Math.max(pts[i].y,pts[i+1].y-(dist[i+1]-dist[i])*.075);
        const excess=Math.max(0,pts[0].y-40)+Math.max(0,pts.at(-1).y-14);
        const preferred=(course.direction||'left')==='left'?'R':'L';
        candidates.push({...candidate,points:pts,score:dist.at(-1)+penalty+excess*100000+(candidate.kind[0]!==preferred?1400:0)});
      }
    }
    candidates.sort((a,b)=>a.score-b.score);const chosen=candidates[0],path=chosen.points;
    const distances=[0];for(let i=1;i<path.length;i++)distances.push(distances[i-1]+Math.hypot(path[i].x-path[i-1].x,path[i].z-path[i-1].z));
    const gates=[];
    for(let i=0;i<count;i++){const distance=distances.at(-1)*i/(count-1);let j=distances.findIndex(d=>d>=distance);if(j<1)j=1;const t=(distance-distances[j-1])/(distances[j]-distances[j-1]||1),a=path[j-1],b=path[j];gates.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,yaw:b.yaw,pathIndex:j});}
    return {gates,path,radius:chosen.radius,feasible:path[0].y<=40.1&&path.at(-1).y<=14.1,score:chosen.score};
  }
  function stand(isle){return {x:isle.x+300,z:isle.z+240,y:2,name:'A1',yaw:-Math.PI/2};}
  // Each runway has its own taxiway: a lane of its own leaving the apron, and a full-length parallel
  // taxiway on the side facing the terminal, joined to the runway at both ends. The north–south runways
  // leave the apron westward on separate lanes (z 310 and 150); the east–west runway leaves on a third
  // lane and runs up or down a spur at x 40, just west of the buildings.
  const VERTICAL_LANES=[310,150],SPUR_X=40;
  function taxiway(C,isle,rw){
    const off=rw.width/2+56,at=(lx,lz)=>C.runwayToWorld(isle,rw,lx,lz);
    // The parallel sits on whichever side of the runway faces the apron.
    const c=at(0,0),apron={x:isle.x+260,z:isle.z+240},side=(rw.cos*(apron.x-c.x)+rw.sin*(apron.z-c.z))>=0?1:-1;
    const par=lz=>at(side*off,lz),rwy=lz=>at(0,lz);
    const horizontal=Math.abs(rw.sin)>.7,verticals=C.runwaysFor(isle).filter(r=>Math.abs(r.sin)<=.7);
    const laneZ=horizontal?(rw.cz<0?-60:380):VERTICAL_LANES[Math.max(0,verticals.findIndex(r=>r.index===rw.index))%VERTICAL_LANES.length];
    const lane=[{x:apron.x,z:isle.z+laneZ}];
    if(horizontal){const p=par(0);lane.push({x:isle.x+SPUR_X,z:isle.z+laneZ},{x:isle.x+SPUR_X,z:p.z});}
    else lane.push({x:par(0).x,z:isle.z+laneZ});
    // Where a hillside crowds the far end of the runway, the far exit moves in until its taxiway is on flat ground.
    let far=-rw.half+30;const ground=p=>C.terrainHeight([isle],p.x,p.z);
    const blocked=lz=>{
      for(const d of [-60,-30,0,30,60]){   // generous: a peak's mesh reaches a little past its height model
        if(ground(at(side*(off+d),lz))>1.5)return true;                                   // the parallel taxiway
        for(let k=0;k<4;k++)if(ground(at(side*off*k/4,lz+d))>1.5)return true;             // the connector to the runway
      }
      return false;
    };
    while(far<0&&blocked(far))far+=20;
    return {apron,lane,side,far,
      hold:par(rw.half-30),entry:rwy(rw.half-30),lineup:rwy(rw.half-120),     // departure end
      farHold:par(far),exit:rwy(far)};                                        // far end, for vacating after landing
  }
  // Stand → own lane → parallel taxiway → departure end → lined up on the runway.
  function taxi(C,isle,rw){
    const t=taxiway(C,isle,rw);
    return [stand(isle),t.apron,...t.lane,t.hold,t.entry,t.lineup];
  }
  // After the landing rollout: vacate at the far end, back down the parallel and the runway's lane to the stand.
  function taxiIn(C,isle,rw){
    const t=taxiway(C,isle,rw);
    return [t.exit,t.farHold,...t.lane.slice().reverse(),t.apron,stand(isle)];
  }
  // Every stretch of taxiway pavement to draw for one runway (polylines).
  function taxiPavement(C,isle,rw){
    const t=taxiway(C,isle,rw);
    return [[stand(isle),t.apron,...t.lane],[t.lane.at(-1),t.hold],[t.farHold,t.hold],[t.hold,t.entry],[t.farHold,t.exit]];
  }
  // The island's whole taxi network as a graph: every taxiway stretch, split wherever two of them meet or
  // cross, plus each runway's centreline (for vacating after landing and backtracking). Runway travel costs
  // more than taxiway travel, and each runway's lined-up position can only be reached from its threshold
  // end, so the aircraft always arrives there pointing down the runway. Cached on the island.
  function network(C,isle){
    if(isle._taxiNet)return isle._taxiNet;
    const nodes=[],edges=[],lineups={};
    const node=p=>{for(const n of nodes)if(Math.hypot(n.x-p.x,n.z-p.z)<1.5)return n;const n={x:p.x,z:p.z,out:[]};nodes.push(n);return n;};
    const link=(a,b,runway=false)=>{if(a===b)return;const cost=Math.hypot(b.x-a.x,b.z-a.z)*(runway?2.5:1);a.out.push({to:b,cost});b.out.push({to:a,cost});edges.push({a,b,runway});};
    const rws=C.runwaysFor(isle),segs=[];
    for(const rw of rws)for(const line of taxiPavement(C,isle,rw))for(let i=1;i<line.length;i++)segs.push({a:line[i-1],b:line[i],cuts:[0,1]});
    // Cut each stretch wherever another one crosses it, joins it, or runs along it.
    const along=(s,p)=>{const dx=s.b.x-s.a.x,dz=s.b.z-s.a.z,L2=dx*dx+dz*dz||1,t=((p.x-s.a.x)*dx+(p.z-s.a.z)*dz)/L2;
      if(t>0&&t<1&&Math.hypot(s.a.x+dx*t-p.x,s.a.z+dz*t-p.z)<1.5)s.cuts.push(t);};
    for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){
      const s=segs[i],t=segs[j],rx=s.b.x-s.a.x,rz=s.b.z-s.a.z,sx=t.b.x-t.a.x,sz=t.b.z-t.a.z,den=rx*sz-rz*sx;
      if(Math.abs(den)<1e-6){along(s,t.a);along(s,t.b);along(t,s.a);along(t,s.b);continue;}
      const qx=t.a.x-s.a.x,qz=t.a.z-s.a.z,u=(qx*sz-qz*sx)/den,v=(qx*rz-qz*rx)/den,eu=1.5/Math.hypot(rx,rz),ev=1.5/Math.hypot(sx,sz);
      if(u<-eu||u>1+eu||v<-ev||v>1+ev)continue;
      s.cuts.push(Math.max(0,Math.min(1,u)));t.cuts.push(Math.max(0,Math.min(1,v)));
    }
    for(const s of segs){
      let prev=node(s.a);
      for(const c of [...new Set(s.cuts)].sort((a,b)=>a-b)){const n=node({x:s.a.x+(s.b.x-s.a.x)*c,z:s.a.z+(s.b.z-s.a.z)*c});link(prev,n);prev=n;}
    }
    for(const rw of rws){
      const t=taxiway(C,isle,rw),exit=node(t.exit),mid=node(t.lineup),entry=node(t.entry);
      link(exit,mid,true);link(mid,entry,true);
      // Lined up for takeoff: a separate one-way end point, entered only from the threshold side.
      const final={x:t.lineup.x,z:t.lineup.z,out:[]};entry.out.push({to:final,cost:Math.hypot(final.x-entry.x,final.z-entry.z)});lineups[rw.index]=final;
    }
    return isle._taxiNet={nodes,edges,lineups,stand:node(stand(isle))};
  }
  // A taxi route from wherever the aircraft is now (`from` = {x,z,yaw}) to `goal`: 'stand', or a runway to
  // line up on. It joins the network at the nearest point of the nearest taxiway or runway, preferring to
  // keep rolling the way the aircraft already points rather than turning round.
  function plan(C,isle,from,goal){
    const net=network(C,isle),target=goal==='stand'?net.stand:net.lineups[goal.index];if(!target)return null;
    const hx=Math.sin(from.yaw),hz=-Math.cos(from.yaw);
    if(goal!=='stand'){
      // Already on the centreline near the lined-up spot and pointing down the runway: just roll on to it.
      const dx=target.x-from.x,dz=target.z-from.z,side=Math.abs(dx*goal.cos+dz*goal.sin);
      if(Math.hypot(dx,dz)<40&&side<8&&Math.cos(from.yaw-goal.rad)>.94)return [{x:from.x,z:from.z},{x:target.x,z:target.z}];
    }
    let best=null;
    for(const e of net.edges){const dx=e.b.x-e.a.x,dz=e.b.z-e.a.z,L2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((from.x-e.a.x)*dx+(from.z-e.a.z)*dz)/L2)),x=e.a.x+dx*t,z=e.a.z+dz*t,d=Math.hypot(from.x-x,from.z-z);if(!best||d<best.d)best={e,x,z,d};}
    if(!best)return null;
    const start={x:best.x,z:best.z,out:[]};
    for(const end of [best.e.a,best.e.b]){const dx=end.x-start.x,dz=end.z-start.z,L=Math.hypot(dx,dz),behind=L>1&&(dx*hx+dz*hz)/L<-.3;start.out.push({to:end,cost:L*(best.e.runway?2.5:1)+(behind?250:0)});}
    const dist=new Map([[start,0]]),prev=new Map(),open=new Set([start]);
    while(open.size){
      let n=null;for(const o of open)if(!n||dist.get(o)<dist.get(n))n=o;open.delete(n);if(n===target)break;
      for(const {to,cost} of n.out){const d=dist.get(n)+cost;if(d<(dist.get(to)??Infinity)){dist.set(to,d);prev.set(to,n);open.add(to);}}
    }
    if(!prev.has(target))return null;
    const points=[];for(let n=target;n;n=prev.get(n))points.unshift({x:n.x,z:n.z});
    if(best.d>2)points.unshift({x:from.x,z:from.z});else points[0]={x:from.x,z:from.z};
    return points.filter((p,i)=>!i||Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z)>.5);
  }
  const api={curves,route,stand,taxiway,taxi,taxiIn,taxiPavement,network,plan};root.SkyNavigation=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
