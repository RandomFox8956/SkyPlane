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
  function taxi(C,isle,rw){
    const parked=stand(isle),entry=C.runwayToWorld(isle,rw,0,rw.half+85),lineup=C.runwayToWorld(isle,rw,0,rw.half-120);
    const south=Math.max(680,...C.runwaysFor(isle).map(r=>r.cz+Math.abs(r.cos)*r.half+Math.abs(r.sin)*r.width/2+180));
    return [parked,{x:isle.x+260,z:parked.z},{x:isle.x+260,z:isle.z+south},{x:entry.x,z:isle.z+south},entry,lineup];
  }
  const api={curves,route,stand,taxi};root.SkyNavigation=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
