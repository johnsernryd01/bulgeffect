// bulgeEffect.js  — 2025‑06‑04 (v2)
// -----------------------------------------------------------------------------
// Pure‑vanilla, reusable WebGL bulge distortion that stays **off** until you scoll.
// No upside‑down texture bugs. Copy once, reuse everywhere.
// -----------------------------------------------------------------------------
// Embed once per site (GitHub + jsDelivr example):
// <script type="module" src="https://cdn.jsdelivr.net/gh/you/repo@SHA/bulgeEffect.js"></script>
//
// Webflow usage (duplicate freely):
// <div data-effect="bulge"
//      data-src="/images/photo.jpg"
//      data-scroll="1"               <!-- optional multiplier; default 1 -->
//      style="width:100%;height:400px"></div>
// -----------------------------------------------------------------------------

// ===== GLSL ==============================================================
const VS = `#version 300 es
precision mediump float;

in  vec3 aVertexPosition;
in  vec2 aTextureCoord;

out vec2 vUV;
out vec3 vPos;

uniform float uAmount;   // 0‑1 scroll‑driven
uniform vec2  uRes;      // image resolution

float ease(float t){return t<.5?2.*t*t:(-1.+(4.-2.*t)*t);} // simple easeInOut

vec3 bulge(vec3 p){
  float aspect = uRes.x/uRes.y;
  vec2  v      = p.xy*vec2(aspect,1.0);
  float d      = length(v);            // distance from centre
  float t      = clamp(1.0-d*1.4,0.0,1.0);
  float b      = ease(t)*uAmount*1.2;  // scale *1.2 for visibility
  p.xy += p.xy * b;                    // push xy outwards
  p.z  -= b;                           // fake depth (for lighting)
  return p;
}

void main(){
  vec3 pos = bulge(aVertexPosition);
  vPos = normalize(pos);
  vUV  = aTextureCoord;
  gl_Position = vec4(pos,1.0);
}`;

const FS = `#version 300 es
precision mediump float;

in  vec2 vUV;
in  vec3 vPos;

uniform sampler2D uTex;

out vec4 color;

float rand(vec2 co){return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);} // dither

void main(){
  // manual vertical flip so texture is upright on every GPU
  vec2 uv = vec2(vUV.x,1.0-vUV.y);
  vec4 c  = texture(uTex,uv);

  // subtle rim light for depth perception
  vec3 L  = normalize(vec3(0.25,0.4,1.0));
  float d = max(dot(vPos,L),0.0);
  c.rgb  += (d*0.4 - 0.2);

  c.rgb  += (rand(gl_FragCoord.xy)-0.5)/255.0; // micro‑grain
  color   = c;
}`;

// ===== Helpers ===========================================================
const qs   = (sel,ctx=document)=>ctx.querySelectorAll(sel);
const load = src=>new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=_=>res(i);i.onerror=rej;i.src=src;});
const sh   = (gl,t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o;};
const prog = (gl,v,f)=>{const p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw gl.getProgramInfoLog(p);return p;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// ===== Main loader =======================================================
async function init(el){
  const src   = el.dataset.src;
  if(!src){console.warn('[bulgeEffect] missing data-src');return;}
  const multi = parseFloat(el.dataset.scroll||'1');

  const img   = await load(src);
  const cvs   = document.createElement('canvas');
  cvs.width   = img.width;
  cvs.height  = img.height;
  Object.assign(cvs.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:'-1'});
  el.style.position = el.style.position||'relative';
  el.appendChild(cvs);

  const gl = cvs.getContext('webgl2');
  if(!gl){console.warn('[bulgeEffect] WebGL2 not supported');return;}

  // compile
  const p = prog(gl, sh(gl,gl.VERTEX_SHADER,VS), sh(gl,gl.FRAGMENT_SHADER,FS));
  gl.useProgram(p);

  // quad geometry (2 triangles)
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
    -1,-1,0, 0,0,
     1,-1,0, 1,0,
    -1, 1,0, 0,1,
     1, 1,0, 1,1,
  ]),gl.STATIC_DRAW);
  const STRIDE = 5*4;
  const posLoc = gl.getAttribLocation(p,'aVertexPosition');
  const uvLoc  = gl.getAttribLocation(p,'aTextureCoord');
  gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,STRIDE,0);
  gl.enableVertexAttribArray(uvLoc);  gl.vertexAttribPointer(uvLoc,2,gl.FLOAT,false,STRIDE,12);

  // texture
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);

  // uniforms
  const uTex = gl.getUniformLocation(p,'uTex');
  const uAmt = gl.getUniformLocation(p,'uAmount');
  const uRes = gl.getUniformLocation(p,'uRes');
  gl.uniform1i(uTex,0);
  gl.uniform2f(uRes,cvs.width,cvs.height);

  // render loop — only scroll drives amount
  function draw(){
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const frac      = clamp(window.scrollY / maxScroll, 0, 1);
    const amt       = clamp(frac * multi, 0, 1);

    gl.viewport(0,0,cvs.width,cvs.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uAmt, amt);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }

  // run continuously for smooth updates
  function loop(){draw();requestAnimationFrame(loop);} loop();
}

// ===== Auto‑init =========================================================
window.addEventListener('DOMContentLoaded',()=>{
  qs('[data-effect="bulge"]').forEach(init);
});
