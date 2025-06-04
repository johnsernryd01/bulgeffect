/* ============================================================================
   bulgeEffect.js  –  wheel-driven pinch / bulge   (2025-06-04 demo strength)
   ----------------------------------------------------------------------------
   • Embed once per site:
        <script type="module"
                src="https://cdn.jsdelivr.net/gh/yourUser/yourRepo@SHA/bulgeEffect.js"></script>

   • Use anywhere in Webflow:
        <div data-effect="bulge"
             data-src="https://yourcdn.com/photo.jpg"
             style="width:100%;height:400px"></div>

   NOTE  Webflow Designer never runs external JS; test in Preview or the
         published site.  A console log will confirm the script is active.
============================================================================ */

/* ------------------ tweak here if you want less / more ------------------- */
const WHEEL_SENS   = 0.01;   //  bigger  = stronger  (0.002-0.005 once you confirm)
const FRICTION     = 0.92;   //  closer to 1 = slower fall-back to neutral
/* ------------------------------------------------------------------------- */

/* === GLSL ================================================================= */
const VS = `#version 300 es
precision mediump float;
in  vec3 aVertexPosition;
in  vec2 aTextureCoord;
out vec2 vUV;
uniform float uAmt;   //  -1 (pinch)  ..  0  ..  +1 (bulge)
uniform vec2  uRes;
float ease(float t){return t<.5?2.*t*t:(-1.+(4.-2.*t)*t);}
vec3 warp(vec3 p){
  float aspect = uRes.x / uRes.y;
  vec2  v      = p.xy * vec2(aspect,1.0);
  float d      = length(v);
  float t      = clamp(1.0 - d*1.4, 0.0, 1.0);
  float f      = ease(t) * uAmt * 1.5;   // 1.5 = visibility boost
  p.xy += p.xy * f;
  p.z  -= f;
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
  vec2 uv = vec2(vUV.x, 1.0 - vUV.y);   // flip Y so image is upright
  color   = texture(uTex, uv);
}`;

/* === tiny helpers ======================================================== */
const qs=(s,c=document)=>c.querySelectorAll(s);
const load=src=>new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=_=>res(i);i.onerror=rej;i.src=src;});
const sh =(g,t,s)=>{const o=g.createShader(t);g.shaderSource(o,s);g.compileShader(o);if(!g.getShaderParameter(o,g.COMPILE_STATUS))throw g.getShaderInfoLog(o);return o;};
const pg =(g,v,f)=>{const p=g.createProgram();g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw g.getProgramInfoLog(p);return p;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* === main effect ========================================================= */
async function init(div){
  const src = div.dataset.src;
  if(!src){console.warn('[bulge] missing data-src');return;}

  const img = await load(src);

  /* canvas */
  const cv  = document.createElement('canvas');
  cv.width  = img.width;
  cv.height = img.height;
  Object.assign(cv.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:'-1'});
  div.style.position = div.style.position || 'relative';
  div.appendChild(cv);

  /* GL setup */
  const gl = cv.getContext('webgl2');
  if(!gl){console.warn('[bulge] WebGL2 not supported');return;}

  const prog = pg(gl, sh(gl,gl.VERTEX_SHADER,VS), sh(gl,gl.FRAGMENT_SHADER,FS));
  gl.useProgram(prog);

  /* quad geometry */
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
     -1,-1,0,   0,0,
      1,-1,0,   1,0,
     -1, 1,0,   0,1,
      1, 1,0,   1,1,
  ]), gl.STATIC_DRAW);
  const STR=5*4;
  const locP = gl.getAttribLocation(prog,'aVertexPosition');
  const locU = gl.getAttribLocation(prog,'aTextureCoord');
  gl.enableVertexAttribArray(locP); gl.vertexAttribPointer(locP,3,gl.FLOAT,false,STR,0);
  gl.enableVertexAttribArray(locU); gl.vertexAttribPointer(locU,2,gl.FLOAT,false,STR,12);

  /* texture */
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.uniform1i(gl.getUniformLocation(prog,'uTex'),0);
  gl.uniform2f(gl.getUniformLocation(prog,'uRes'), cv.width, cv.height);
  const uAmt = gl.getUniformLocation(prog,'uAmt');

  /* wheel-driven state */
  let amount = 0;
  window.addEventListener('wheel', e=>{
    amount += (-e.deltaY) * WHEEL_SENS;   // wheel up = negative deltaY → bulge
    amount  = clamp(amount, -1, 1);
  }, {passive:true});

  /* draw loop */
  function draw(){
    amount *= FRICTION;          // ease back toward 0
    gl.viewport(0,0,cv.width,cv.height);
    gl.uniform1f(uAmt, amount);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    requestAnimationFrame(draw);
  }
  draw();
}

/* === auto-init ========================================================== */
window.addEventListener('DOMContentLoaded', ()=>{
  console.log('[bulge] script is alive');      // confirm file loaded
  qs('[data-effect="bulge"]').forEach(init);
});
