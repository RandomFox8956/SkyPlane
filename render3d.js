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
      this.canvas=document.createElement('canvas');const gl=this.gl=this.canvas.getContext('webgl2',{alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:false});if(!gl)throw Error('WebGL2 unavailable');
      const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
      this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,V));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,F));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
      this.uniforms={};for(const name of ['eye','right','up','forward','focus','lr','lu','ld','projection','nearClip','shadowRange','shadowPass','shadowMap','labelMap','label','shadows','cloud'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
      this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);for(const [name,count,offset] of [['p',3,0],['n',3,3],['c',4,6],['uv',2,10]]){const loc=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,count,gl.FLOAT,false,48,offset*4);}
      this.depth=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.depth);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,2048,2048,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      this.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.depth,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      this.faceCache=new WeakMap();this.labels=new Map();this.data=new Float32Array(1200000);this.sun=norm([-.45,.83,.32]);this.lightRight=norm(cross([0,1,0],this.sun));this.lightUp=cross(this.sun,this.lightRight);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.uniform1i(this.uniforms.shadowMap,0);gl.uniform1i(this.uniforms.labelMap,1);
    }
    packed(f){
      if(this.faceCache.has(f))return this.faceCache.get(f);
      const p=f.v,normal=norm(cross(p[1].map((v,i)=>v-p[0][i]),p[2].map((v,i)=>v-p[0][i]))),hex=parseInt(f.c.slice(1),16),color=[(hex>>16)/255,((hex>>8)&255)/255,(hex&255)/255,f.a??1],data=[];
      for(let i=1;i<p.length-1;i++)for(const k of [0,i,i+1])data.push(...p[k],...(f.n?.[k]||normal),...color,...([[0,0],[1,0],[1,1],[0,1]][k]||[0,0]));
      const result=new Float32Array(data);this.faceCache.set(f,result);return result;
    }
    labelTexture(text){
      if(this.labels.has(text))return this.labels.get(text);const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#132b35';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#f0e8d5';ctx.font='600 52px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,65,980);
      const gl=this.gl,t=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.labels.set(text,t);return t;
    }
    render(ctx,faces,view){
      const gl=this.gl,u=this.uniforms,{w,h,camera,right,up,forward,focal,quality,walking,weather}=view;this.canvas.width=w;this.canvas.height=h;
      const opaque=[],glass=[],labels=[];for(const f of faces){if(f.cockpit||f.v.length<3)continue;if(f.t)labels.push(f);else if(f.a<1)glass.push(f);else opaque.push(f);}
      glass.sort((a,b)=>Math.hypot(...b.v[0].map((v,i)=>v-camera[i]))-Math.hypot(...a.v[0].map((v,i)=>v-camera[i])));
      let size=0;for(const f of [...opaque,...glass])size+=this.packed(f).length;if(this.data.length<size)this.data=new Float32Array(size*2);let cursor=0;for(const f of opaque){const p=this.packed(f);this.data.set(p,cursor);cursor+=p.length;}const opaqueCount=cursor/12;for(const f of glass){const p=this.packed(f);this.data.set(p,cursor);cursor+=p.length;}
      gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.data.subarray(0,cursor),gl.DYNAMIC_DRAW);
      for(const [key,value] of Object.entries({eye:camera,right,up,forward,focus:[camera[0],0,camera[2]],lr:this.lightRight,lu:this.lightUp,ld:this.sun}))gl.uniform3fv(u[key],value);
      gl.uniform2f(u.projection,focal*2/w,focal*2/h);gl.uniform1f(u.nearClip,walking?.12:1);gl.uniform1f(u.shadowRange,walking?95:camera[1]<60?125:camera[1]<250?450:2200);gl.uniform1f(u.cloud,weather==='storm'?1:weather==='overcast'?.5:0);gl.uniform1i(u.label,0);gl.uniform1i(u.shadows,quality!=='low');gl.disable(gl.BLEND);gl.depthMask(true);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
      if(quality!=='low'){gl.bindFramebuffer(gl.FRAMEBUFFER,this.fbo);gl.viewport(0,0,2048,2048);gl.clear(gl.DEPTH_BUFFER_BIT);gl.uniform1i(u.shadowPass,1);gl.drawArrays(gl.TRIANGLES,0,opaqueCount);}
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.depth);gl.uniform1i(u.shadowPass,0);gl.drawArrays(gl.TRIANGLES,0,opaqueCount);
      gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,opaqueCount,cursor/12-opaqueCount);gl.depthMask(true);gl.uniform1i(u.label,1);
      for(const f of labels){const texture=this.labelTexture(f.t);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,texture);gl.bufferData(gl.ARRAY_BUFFER,this.packed(f),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,this.packed(f).length/12);}
      ctx.drawImage(this.canvas,0,0);return true;
    }
  }
  root.SkyGPU={get(){if(this.failed)return null;if(!this.instance)try{this.instance=new GPU();}catch(e){this.failed=true;console.warn('Using software rendering:',e.message);}return this.instance;}};
})(globalThis);
