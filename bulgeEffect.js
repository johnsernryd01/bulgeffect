/* bulgeEffect.js  –  demo strength ========================== */
console.log('[bulge] file loaded at', Date.now());

const WHEEL_SENS = 0.02;   //  MASSIVE so you can’t miss it
const FRICTION   = 0.90;   //  fall-back speed

const VS=`#version 300 es
precision mediump float;
in vec3 aVertexPosition; in vec2 aTextureCoord;
out vec2 vUV;
uniform float uAmt; uniform vec2 uRes;
float ease(float t){return t<.5?2.*t*t:(-1.+(4.-2.*t)*t);}
vec3 warp(vec3 p){
  float a=uRes.x/uRes.y; vec2 v=p.xy*vec2(a,1.);
  float d=length(v); float f=ease(clamp(1.-d*1.4,0.,1.))*uAmt*1.5;
  p.xy+=p.xy*f; p.z-=f; return p;
}
void main(){vec3 pos=warp(aVertexPosition);vUV=aTextureCoord;gl_Position=vec4(pos,1.);}`;
const FS=`#version 300 es
precision mediump float; in vec2 vUV; uniform sampler2D uTex; out vec4 color;
void main(){color=texture(uTex,vec2(vUV.x,1.-vUV.y));}`;

const qs=(s,c=document)=>c.querySelectorAll(s);
const load=s=>new Promise((r,e)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=_=>r(i);i.onerror=e;i.src=s;});
const sh =(g,t,s)=>{const o=g.createShader(t);g.shaderSource(o,s);g.compileShader(o);if(!g.getShaderParameter(o,35713))throw g.getShaderInfoLog(o);return o;};
const pg =(g,v,f)=>{const p=g.createProgram();g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);if(!g.getProgramParameter(p,35714))throw g.getProgramInfoLog(p);return p;};

async function init(el){
  const img=await load(el.dataset.src||''); if(!img)return;
  const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
  Object.assign(cv.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:'-1'});
  el.style.position=el.style.position||'relative'; el.appendChild(cv);

  const gl=cv.getContext('webgl2'); if(!gl)return;
  const pr=pg(gl,sh(gl,35633,VS),sh(gl,35632,FS)); gl.useProgram(pr);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,0,0,0,1,-1,0,1,0,-1,1,0,0,1,1,1,0,1,1]),gl.STATIC_DRAW);
  const STR=5*4; let p=0;[...'ab'].forEach((_,i)=>{gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,i?2:3,5126,false,STR,i?12:0);});
  gl.texParameteri(gl.TEXTURE_2D,10241,9987);gl.texParameteri(gl.TEXTURE_2D,10240,9729);
  gl.texImage2D(gl.TEXTURE_2D,0,6408,6408,5121,img);gl.generateMipmap(gl.TEXTURE_2D);
  gl.uniform1i(gl.getUniformLocation(pr,'uTex'),0);
  gl.uniform2f(gl.getUniformLocation(pr,'uRes'),cv.width,cv.height);
  const uAmt=gl.getUniformLocation(pr,'uAmt');

  let amt=0; window.addEventListener('wheel',e=>{amt+=(-e.deltaY)*WHEEL_SENS;}, {passive:true});
  (function draw(){amt*=FRICTION;gl.viewport(0,0,cv.width,cv.height);gl.uniform1f(uAmt,Math.max(-1,Math.min(1,amt)));gl.drawArrays(5,0,4);requestAnimationFrame(draw);}());
}

window.addEventListener('DOMContentLoaded',()=>qs('[data-effect="bulge"]').forEach(init));
/* ========================================================== */
