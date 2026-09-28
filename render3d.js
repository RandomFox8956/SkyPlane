/* Offline WebGL renderer: depth-tested geometry, smooth normals, sunlight and soft shadows. */
(function(root){
  'use strict';
  const V=`#version 300 es
  in vec3 p;in vec3 n;in vec4 c;in vec2 uv;
  uniform vec3 eye,right,up,forward,focus,lr,lu,ld;
  uniform vec2 projection;uniform float nearClip,shadowRange;uniform bool shadowPass;
  out vec3 normal,world;out vec4 color;out vec2 texcoord;out vec3 shadowPos;
  void main(){vec3 d=p-eye;float z=dot(d,forward);float farClip=30000.;
    vec3 light=vec3(dot(p-focus,lr)/shadowRange,dot(p-focus,lu)/shadowRange,-dot(p-focus,ld)/3500.);
    gl_Position=shadowPass?vec4(light,1.):vec4(dot(d,right)*projection.x,dot(d,up)*projection.y,(farClip+nearClip)/(farClip-nearClip)*z-2.*farClip*nearClip/(farClip-nearClip),z);
    normal=n;world=p;color=c;texcoord=uv;shadowPos=light*.5+.5;}`;
  const F=`#version 300 es
  precision highp float;
  in vec3 normal,world,shadowPos;in vec4 color;in vec2 texcoord;
  uniform vec3 eye,ld;uniform sampler2D shadowMap,labelMap;uniform bool shadowPass,label,shadows;uniform float cloud;
  out vec4 result;
  void main(){if(shadowPass){result=vec4(1.);return;}
    vec4 base=label?texture(labelMap,texcoord):color;if(base.a<.01)discard;
    vec3 N=normalize(normal);if(!gl_FrontFacing)N=-N;float sun=max(0.,dot(N,ld));float shade=1.;
    if(shadows&&all(greaterThan(shadowPos,vec3(.002)))&&all(lessThan(shadowPos,vec3(.998)))){float occlusion=0.;float bias=max(.000006,.000024*(1.-sun));for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float depth=texture(shadowMap,shadowPos.xy+vec2(x,y)/2048.).r;occlusion+=shadowPos.z-bias>depth?1.:0.;}shade=1.-occlusion/9.*.68;}
    vec3 light=vec3(.32,.39,.46)+vec3(1.04,.94,.77)*sun*shade*(1.-cloud*.55);light+=vec3(.12,.11,.08)*max(0.,N.y);
    float shine=pow(max(0.,dot(N,normalize(ld+normalize(eye-world)))),48.)*.14*shade;
    vec3 rgb=pow(max(base.rgb,vec3(.001)),vec3(2.2))*light+shine;
    rgb=pow(clamp(rgb,vec3(0.),vec3(1.)),vec3(1./2.2));
    if(label)rgb=base.rgb;float fog=smoothstep(4500.,24000.,distance(eye,world));rgb=mix(rgb,vec3(.73,.82,.82),fog);
    result=vec4(rgb,base.a);}`;
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
  class GPU{
    constructor(){
      this.canvas=document.createElement('canvas');const gl=this.gl=this.canvas.getContext('webgl2',{alpha:true,antialias:true,preserveDrawingBuffer:false,premultipliedAlpha:false});if(!gl)throw Error('WebGL2 unavailable');
      const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
      this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,V));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,F));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
      this.uniforms={};for(const name of ['eye','right','up','forward','focus','lr','lu','ld','projection','nearClip','shadowRange','shadowPass','shadowMap','labelMap','label','shadows','cloud'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
      this.attributes=[['p',3,0],['n',3,3],['c',4,6],['uv',2,10]].map(([name,count,offset])=>[gl.getAttribLocation(this.program,name),count,offset]);
      this.dynamic=this.vertexArray();
      this.depth=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.depth);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,2048,2048,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      this.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.depth,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      this.labels=new Map();this.colors=new Map();this.groups=new Map();this.frame=0;this.data=new Float32Array(1<<18);
      this.sun=norm([-.45,.83,.32]);this.lightRight=norm(cross([0,1,0],this.sun));this.lightUp=cross(this.sun,this.lightRight);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.uniform1i(this.uniforms.shadowMap,0);gl.uniform1i(this.uniforms.labelMap,1);
    }
    // A vertex buffer with its attribute layout (12 floats per vertex: position, normal, colour, uv).
    vertexArray(){
      const gl=this.gl,vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(const [loc,count,offset] of this.attributes){if(loc<0)continue;gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,count,gl.FLOAT,false,48,offset*4);}
      gl.bindVertexArray(null);return {vao,buffer};
    }
    rgb(hex){let c=this.colors.get(hex);if(!c){const n=parseInt(hex.slice(1),16);c=[(n>>16)/255,((n>>8)&255)/255,(n&255)/255];this.colors.set(hex,c);}return c;}
    // Writes a face's triangles into `out` at float offset `at` and returns the new offset.
    pack(f,out,at){
      const p=f.v,a=p[0],b=p[1],c=p[2],ex=b[0]-a[0],ey=b[1]-a[1],ez=b[2]-a[2],fx=c[0]-a[0],fy=c[1]-a[1],fz=c[2]-a[2];
      let nx=ey*fz-ez*fy,ny=ez*fx-ex*fz,nz=ex*fy-ey*fx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
      const [r,g,bl]=this.rgb(f.c),alpha=f.a??1;
      for(let i=1;i<p.length-1;i++)for(const k of [0,i,i+1]){
        const q=p[k],n=f.n?.[k];
        out[at]=q[0];out[at+1]=q[1];out[at+2]=q[2];
        if(n){out[at+3]=n[0];out[at+4]=n[1];out[at+5]=n[2];}else{out[at+3]=nx;out[at+4]=ny;out[at+5]=nz;}
        out[at+6]=r;out[at+7]=g;out[at+8]=bl;out[at+9]=alpha;
        out[at+10]=k===1||k===2?1:0;out[at+11]=k===2||k===3?1:0;at+=12;
      }
      return at;
    }
    // Packs faces as opaque, then translucent (far to near), then text labels, recording each range in vertices.
    layout(faces,out,camera){
      const opaque=[],glass=[],labels=[];let floats=0;
      for(const f of faces){if(f.cockpit||f.v.length<3)continue;floats+=(f.v.length-2)*36;if(f.t)labels.push(f);else if(f.a<1)glass.push(f);else opaque.push(f);}
      if(camera&&glass.length>1){const d=f=>{const v=f.v[0];return (v[0]-camera[0])**2+(v[1]-camera[1])**2+(v[2]-camera[2])**2;};glass.sort((a,b)=>d(b)-d(a));}
      if(!out||out.length<floats)out=new Float32Array(Math.max(floats,out?out.length*2:0));
      let at=0;for(const f of opaque)at=this.pack(f,out,at);const opaqueCount=at/12;
      for(const f of glass)at=this.pack(f,out,at);const glassCount=at/12-opaqueCount;
      const text=labels.map(f=>{const first=at/12;at=this.pack(f,out,at);return {text:f.t,first,count:at/12-first};});
      return {data:out,floats:at,opaque:opaqueCount,glass:glassCount,labels:text};
    }
    // Static scenery (an island, the ocean, parked aircraft) is uploaded to the graphics card once and
    // redrawn from there every frame; it is released after it has gone unused for a while.
    group(faces){
      let g=this.groups.get(faces);
      if(!g){const gl=this.gl,l=this.layout(faces,null,null);g={...this.vertexArray(),...l,data:null};gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer);gl.bufferData(gl.ARRAY_BUFFER,l.data.subarray(0,l.floats),gl.STATIC_DRAW);this.groups.set(faces,g);}
      g.used=this.frame;return g;
    }
    release(){
      if(this.groups.size<8)return;
      for(const [key,g] of this.groups)if(this.frame-g.used>600){this.gl.deleteBuffer(g.buffer);this.gl.deleteVertexArray(g.vao);this.groups.delete(key);}
    }
    labelTexture(text){
      if(this.labels.has(text))return this.labels.get(text);const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#132b35';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#f0e8d5';ctx.font='600 52px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,65,980);
      const gl=this.gl,t=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.labels.set(text,t);return t;
    }
    // `faces` are rebuilt every frame (aircraft, gates, people); `view.statics` are arrays of scenery faces
    // that never change once built, so they are passed by identity and kept on the GPU.
    render(ctx,faces,view){
      const gl=this.gl,u=this.uniforms,{w,h,camera,right,up,forward,focal,quality,walking,weather,statics=[]}=view;this.frame++;
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
      gl.useProgram(this.program);
      const dyn=this.layout(faces,this.data,camera);this.data=dyn.data;
      gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.data.subarray(0,dyn.floats),gl.DYNAMIC_DRAW);
      const draws=[...statics.map(s=>this.group(s)),{...dyn,vao:this.dynamic.vao}];
      for(const [key,value] of Object.entries({eye:camera,right,up,forward,focus:[camera[0],0,camera[2]],lr:this.lightRight,lu:this.lightUp,ld:this.sun}))gl.uniform3fv(u[key],value);
      gl.uniform2f(u.projection,focal*2/w,focal*2/h);gl.uniform1f(u.nearClip,walking?.12:1);gl.uniform1f(u.shadowRange,walking?95:camera[1]<60?125:camera[1]<250?450:2200);gl.uniform1f(u.cloud,weather==='storm'?1:weather==='overcast'?.5:0);gl.uniform1i(u.label,0);gl.uniform1i(u.shadows,quality!=='low');gl.disable(gl.BLEND);gl.depthMask(true);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
      const each=fn=>{for(const d of draws){gl.bindVertexArray(d.vao);fn(d);}};
      if(quality!=='low'){gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,2048,2048);gl.clear(gl.DEPTH_BUFFER_BIT);gl.uniform1i(u.shadowPass,1);each(d=>d.opaque&&gl.drawArrays(gl.TRIANGLES,0,d.opaque));}
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.depth);gl.uniform1i(u.shadowPass,0);
      each(d=>d.opaque&&gl.drawArrays(gl.TRIANGLES,0,d.opaque));
      gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      each(d=>d.glass&&gl.drawArrays(gl.TRIANGLES,d.opaque,d.glass));
      gl.depthMask(true);gl.uniform1i(u.label,1);gl.activeTexture(gl.TEXTURE1);
      each(d=>{for(const l of d.labels){gl.bindTexture(gl.TEXTURE_2D,this.labelTexture(l.text));gl.drawArrays(gl.TRIANGLES,l.first,l.count);}});
      gl.bindVertexArray(null);
      ctx.drawImage(this.canvas,0,0);this.release();return true;
    }
  }
  root.SkyGPU={get(){if(this.failed)return null;if(!this.instance)try{this.instance=new GPU();}catch(e){this.failed=true;console.warn('Using software rendering:',e.message);}return this.instance;}};
})(globalThis);
