// bulgeEffect.js  — 2025‑06‑04 (v3)
// -----------------------------------------------------------------------------
// WebGL bulge distortion that matches Unicorn‑Studio feel:
//   • Starts at a gentle bulge (default 0.25) so it’s visible right away
//   • Strength grows as you scroll (data-scroll multiplier)
//   • No unwanted darkening – optional rim light is toned down
//   • Manual UV flip – never upside‑down
// -----------------------------------------------------------------------------
// Embed once (jsDelivr):
// <script type="module" src="https://cdn.jsdelivr.net/gh/you/repo@SHA/bulgeEffect.js"></script>
// -----------------------------------------------------------------------------
// Usage:
// <div data-effect="bulge"
//      data-src="/images/photo.jpg"
//      data-scroll="1"      <!-- strength multiplier, default 1  -->
//      data-min="0.25"      <!-- starting bulge,   default 0.25 -->
//      style="width:100%;height:400px"></div>
// -----------------------------------------------------------------------------

// ===== GLSL ==============================================================
const VS = `#version 300 es
precision mediump float;

in  vec3 aVertexPosition;
in  vec2 aTextureCoord;

out vec2 vUV;
out vec3 vPos;

uniform float uAmount;   // 0‑1 scroll‑driven (plus base offset)
uniform vec2  uRes;      // image resolution

float ease(float t){return t<.5?2.*t*t:(-1.+(4.-2.*t)*t);} // easeInOutQuad

vec3 bulge(vec3 p){
  float aspect = uRes.x/uRes.y;
  vec2  v      = p.xy*vec2(aspect,1.0);
  float d      = length(v);
  float t      = clamp(1.0-d*1.4,0.0,1.0);
  float b      = ease(t)*uAmount*1.5;   // *1.5 for stronger warp like Unicorn
  p.xy += p.xy * b;
  p.z  -= b;
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
  vec2 uv = vec2(vUV.x,1.0-vUV.y);
  vec4 c  = texture(uTex,uv);

  // toned‑down rim light to avoid dark look
  vec3 L  = normalize(vec3(0.25,0.4,1.0));
  float d = max(dot(vPos,L),0.0);
  c.rgb  += (d*0.25 - 0.125);  // half previous intensity

  // subtle lift so image isn't dark at rest
  c.rgb *= 1.05;

  c.rgb  += (rand(gl_FragCoord.xy)-0.5)/255.0;
  color   = c;
}`;

// ===== Helpers ===========================================================
const qs   = (s,c=document)=>c.querySelectorAll(s);
const load = src=>new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=_=>res(i);i.onerror=rej;i.src=src;});
const sh   = (g,t,s)=>{const o=g.createShader(t);g.shaderSource(o,s);g.compileShader(o);if(!g.getShaderParameter(o,g.COMPILE_STATUS))throw g.getShaderInfoLog(o);return o;};
const prog = (g,v,f)=>{const p=g.createProgram();g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw g.getProgramInfoLog(p);return p;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// ===== Main loader =======================================================
async function init(el){
  const src    = el.dataset.src;
  if(!src){console.warn('[bulgeEffect] missing data-src');return;}
  const multi  = parseFloat(el.dataset.scroll||'1');
  const minAmt = parseFloat(el.dataset.min  ||'0.25'); // base bulge

  const img = await load(src);
  const cvs = document.createElement('canvas');
  cvs.width = img.width; cvs.height = img.height;
  Object.assign(cvs.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:'-1'});
  el.style.position = el.style.position||'relative';
  el.appendChild(cvs);

  const gl = cvs.getContext('webgl2'); if(!gl){console.warn('[bulgeEffect] WebGL2 not supported');return;}

  // compile shaders
  const p = prog(gl, sh(gl,gl.VERTEX_SHADER,VS), sh(gl,gl.FRAGMENT_SHADER,FS));
  gl.useProgram(p);

  // geometry (fullscreen quad)
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
    -1,-1,0, 0,0,
     1,-1,0, 1,0,
    -1, 1,0, 0,1,
     1, 1,0, 1,1,
  ]),gl.STATIC_DRAW);
  const stride=5*4;
  const posL=gl.getAttribLocation(p,'aVertexPosition');
  const uvL =gl.getAttribLocation(p,'aTextureCoord');
  gl.enableVertexAttribArray(posL); gl.vertexAttribPointer(posL,3,gl.FLOAT,false,stride,0);
  gl.enableVertexAttribArray(uvL ); gl.vertexAttribPointer(uvL ,2,gl.FLOAT,false,stride,12);

  // texture setup
  const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);

  // uniforms
  gl.uniform1i(gl.getUniformLocation(p,'uTex'),0);
  gl.uniform2f(gl.getUniformLocation(p,'uRes'),cvs.width,cvs.height);
  const uAmt=gl.getUniformLocation(p,'uAmount');

  function draw(){
    const maxScroll=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
    const frac=clamp(window.scrollY/maxScroll,0,1);
    const amt = clamp(minAmt + frac*multi*(1-minAmt),0,1); // base + growth

    gl.viewport(0,0,cvs.width,cvs.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uAmt,amt);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  (function loop(){draw();requestAnimationFrame(loop);})();
}

// ===== Auto‑init =========================================================
window.addEventListener('DOMContentLoaded',()=>qs('[data-effect="bulge"]').forEach(init));
