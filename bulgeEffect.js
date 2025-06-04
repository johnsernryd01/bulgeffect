// bulgeEffect.js  — 2025‑06‑04 (v4)
// -----------------------------------------------------------------------------
// Scroll‑direction reactive version
//   • Scroll **up**   → bulge  (image puffs out)
//   • Scroll **down** → pinch  (image sucks in)
// -----------------------------------------------------------------------------
// Embed once per site (via jsDelivr / GitHub):
// <script type="module" src="https://cdn.jsdelivr.net/gh/you/repo@SHA/bulgeEffect.js"></script>
// -----------------------------------------------------------------------------
// Usage (duplicate freely in Webflow):
// <div data-effect="bulge"
//      data-src="/images/photo.jpg"
//      data-sens="0.004"     <!-- optional scroll‑to‑amount factor (default 0.003) -->
//      style="width:100%;height:400px"></div>
// -----------------------------------------------------------------------------

// ===== GLSL ==============================================================
const VS = `#version 300 es
precision mediump float;

in  vec3 aVertexPosition;
in  vec2 aTextureCoord;

out vec2 vUV;

uniform float uAmount;   // −1 (pinch) → 0 → +1 (bulge)
uniform vec2  uRes;      // image resolution

float ease(float t){return t<.5?2.*t*t:(-1.+(4.-2.*t)*t);} // easeInOutQuad

vec3 bulge(vec3 p){
  float aspect = uRes.x/uRes.y;
  vec2  v      = p.xy*vec2(aspect,1.0);
  float d      = length(v);
  float t      = clamp(1.0-d*1.4,0.0,1.0);
  float b      = ease(t)*uAmount*1.5; // signed: +bulge / −pinch
  p.xy += p.xy * b;
  p.z  -= b;
  return p;
}

void main(){
  vec3 pos = bulge(aVertexPosition);
  vUV = aTextureCoord;
  gl_Position = vec4(pos,1.0);
}`;

const FS = `#version 300 es
precision mediump float;

in  vec2 vUV;

uniform sampler2D uTex;

out vec4 color;

void main(){
  vec2 uv = vec2(vUV.x,1.0-vUV.y); // manual flip
  color   = texture(uTex,uv);
}`;

// ===== Helpers ===========================================================
const qs   =(s,c=document)=>c.querySelectorAll(s);
const load =src=>new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=_=>res(i);i.onerror=rej;i.src=src;});
const sh   =(g,t,s)=>{const o=g.createShader(t);g.shaderSource(o,s);g.compileShader(o);if(!g.getShaderParameter(o,g.COMPILE_STATUS))throw g.getShaderInfoLog(o);return o;};
const prog =(g,v,f)=>{const p=g.createProgram();g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw g.getProgramInfoLog(p);return p;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// ===== Main loader =======================================================
async function init(el){
  const src   = el.dataset.src;
  if(!src){console.warn('[bulgeEffect] missing data-src');return;}
  const sens  = parseFloat(el.dataset.sens||'0.003'); // scroll delta → amount scale

  const img   = await load(src);
  const cvs   = document.createElement('canvas');
  cvs.width   = img.width;
  cvs.height  = img.height;
  Object.assign(cvs.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:'-1'});
  el.style.position = el.style.position||'relative';
  el.appendChild(cvs);

  const gl = cvs.getContext('webgl2'); if(!gl){console.warn('[bulgeEffect] WebGL2 not supported');return;}

  const p   = prog(gl, sh(gl,gl.VERTEX_SHADER,VS), sh(gl,gl.FRAGMENT_SHADER,FS));
  gl.useProgram(p);

  // geometry (quad)
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

  // texture
  const tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.uniform1i(gl.getUniformLocation(p,'uTex'),0);
  gl.uniform2f(gl.getUniformLocation(p,'uRes'),cvs.width,cvs.height);
  const uAmt=gl.getUniformLocation(p,'uAmount');

  let lastY   = window.scrollY;
  let amount  = 0.0;

  function draw(){
    // compute scroll direction delta
    const curY   = window.scrollY;
    const delta  = (lastY - curY); // positive when scrolling up
    lastY        = curY;

    // integrate with damping for smoothness
    amount += delta * sens;
    amount *= 0.9; // friction
    amount  = clamp(amount,-1,1);

    gl.viewport(0,0,cvs.width,cvs.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uAmt,amount);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  (function loop(){draw();requestAnimationFrame(loop);})();
}

// ===== Auto‑init =========================================================
window.addEventListener('DOMContentLoaded',()=>qs('[data-effect="bulge"]').forEach(init));
