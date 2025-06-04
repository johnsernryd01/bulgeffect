/* ============================================================================
   bulgeEffect.js ─ wheel-driven pinch / bulge  (demo strength, 2025-06-04)
   ----------------------------------------------------------------------------
   • Wheel ↑  (scroll up)   → bulge  (image puffs outward)
   • Wheel ↓  (scroll down) → pinch  (image sucks inward)
   • Add `<div data-effect="bulge" data-src="https://…/photo.jpg"></div>`
     anywhere on the page.  Give the div a visible width/height.
   • Uses pure WebGL2 — no external libs required.
   • WHEEL_SENS is cranked high (0.02) so you’ll *definitely* see motion.
     Dial it down once you’ve confirmed it works.
============================================================================ */

/* bulgeEffect.js  – v14  (obvious zoom)  */
console.log('[bulge] file loaded', Date.now());

const WHEEL_SENS = 0.02;  // very strong
const FRICTION   = 0.9;

const VS = `#version 300 es
precision mediump float;
in  vec3 aVertexPosition;
in  vec2 aTextureCoord;
out vec2 vUV;
uniform float uAmt;
vec3 warp(vec3 p){
  float k = 1.0 + uAmt * 2.0; //  -1 ⇒  -1,  +1 ⇒ +3
  p.xy *= k;
  return p;
}
void main(){
  vec3 pos = warp(aVertexPosition);
  vUV = aTextureCoord;
  gl_Position = vec4(pos,1.0);
}`;

const FS = `#version 300 es
precision mediump float;
in  vec2 vUV;
uniform sampler2D uTex;
out vec4 color;
void main(){
  vec2 uv = vec2(vUV.x, 1.0 - vUV.y);
  color   = texture(uTex, uv);
}`;

const $ = (q, c=document)=>c.querySelectorAll(q);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const imgLoad = src => new Promise((r,e)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=_=>r(i);i.onerror=e;i.src=src;});

async function init(el){
  const img = await imgLoad(el.dataset.src||'');
  const cv  = Object.assign(document.createElement('canvas'),{width:img.width,height:img.height});
  Object.assign(cv.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:'-1'});
  el.style.position = el.style.position||'relative'; el.appendChild(cv);
  const gl = cv.getContext('webgl2'); if(!gl) return console.warn('No WebGL2');
  const sh = (t,s)=>{const h=gl.createShader(t);gl.shaderSource(h,s);gl.compileShader(h);return h;};
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER,VS));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER,FS));
  gl.linkProgram(pr); gl.useProgram(pr);
  const quad = new Float32Array([-1,-1,0,0,0, 1,-1,0,1,0, -1,1,0,0,1, 1,1,0,1,1]);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  const STR=5*4;
  [gl.getAttribLocation(pr,'aVertexPosition'), gl.getAttribLocation(pr,'aTextureCoord')]
    .forEach((loc,i)=>{gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,i?2:3,gl.FLOAT,false,STR,i?12:0);});
  const tex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.uniform1i(gl.getUniformLocation(pr,'uTex'),0);
  const uAmt=gl.getUniformLocation(pr,'uAmt');

  let amt=0;
  window.addEventListener('wheel',e=>{
    console.log('[bulge] wheel deltaY', e.deltaY);          // << debug
    amt += (-e.deltaY) * WHEEL_SENS;
    amt  = clamp(amt,-1,1);
  },{passive:true});

  const draw=()=>{amt*=FRICTION; gl.viewport(0,0,cv.width,cv.height); gl.uniform1f(uAmt,amt); gl.drawArrays(gl.TRIANGLE_STRIP,0,4); requestAnimationFrame(draw);};
  draw();
}

window.addEventListener('DOMContentLoaded', ()=>{console.log('[bulge] init'); $('div[data-effect="bulge"]').forEach(init);});
