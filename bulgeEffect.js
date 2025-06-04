/* ==========================================================================
   bulgeEffect.js — wheel‑driven curved bulge / pinch   (2025‑06‑04 v15)
   -------------------------------------------------------------------------
   ✦ Wheel ↑  (scroll up)   → bulge  (image puffs outward)
   ✦ Wheel ↓  (scroll down) → pinch  (image pulls inward)

   ▶ Embed once per site (Page Settings → Before </body>):
        <script type="module" src="https://cdn.jsdelivr.net/gh/you/repo@SHA/bulgeEffect.js"></script>

   ▶ Use anywhere in Webflow (give the div real size!):
        <div data-effect="bulge"
             data-src="https://yourcdn.com/photo.jpg"
             style="width:100%;height:400px"></div>

   ── Dial feel at the top: WHEEL_SENS & FRICTION
   ------------------------------------------------------------------------- */

/* ── tweak for strength & feel ─────────────────────────────────────────── */
const WHEEL_SENS = 0.005;   // typical 0.002–0.008  (demo was 0.02)
const FRICTION   = 0.92;    // 0.85 = loose spring, 0.95 = slow settle
/* ---------------------------------------------------------------------- */

/* — helpers — */
const $      = (sel, ctx=document) => ctx.querySelectorAll(sel);
const clamp  = (v, a, b) => Math.max(a, Math.min(b, v));
const loadImg = src => new Promise((res, rej) => {
  const i = new Image();
  i.crossOrigin = 'anonymous';
  i.onload  = () => res(i);
  i.onerror = rej;
  i.src     = src;
});
const sh = (gl, type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; };
const pg = (gl, vs, fs)   => { const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw gl.getProgramInfoLog(p); return p; };

/* — GLSL — */
const VS = `#version 300 es
precision mediump float;

in  vec3 aVertexPosition;
in  vec2 aTextureCoord;

out vec2 vUV;

uniform float uAmt;           // −1 ↔ +1 signed intensity
uniform vec2  uRes;           // image resolution

float ease(float t){ return t<.5 ? 2.0*t*t : -1.0+(4.0-2.0*t)*t; }

vec3 warp(vec3 p){
  float aspect = uRes.x / uRes.y;
  vec2  v      = p.xy * vec2(aspect, 1.0);
  float d      = length(v);
  float t      = clamp(1.0 - d * 1.4, 0.0, 1.0);
  float f      = ease(t) * uAmt * 1.5;   // curved push/pull
  p.xy += p.xy * f;
  p.z  -= f;                              // fake depth cue
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
  vec2 uv = vec2(vUV.x, 1.0 - vUV.y);  // flip Y so image is upright
  color   = texture(uTex, uv);
}`;

/* — main per‑element initializer — */
async function initBulge(el){
  const src = el.dataset.src;
  if(!src){ console.warn('[bulgeEffect] missing data-src', el); return; }

  const img = await loadImg(src);

  // Canvas overlay
  const cv  = document.createElement('canvas');
  cv.width  = img.width;
  cv.height = img.height;
  Object.assign(cv.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:'-1'});
  el.style.position = el.style.position || 'relative';
  el.appendChild(cv);

  // GL setup
  const gl = cv.getContext('webgl2');
  if(!gl){ console.warn('[bulgeEffect] WebGL2 not supported'); return; }

  const prog = pg(gl, sh(gl,gl.VERTEX_SHADER,VS), sh(gl,gl.FRAGMENT_SHADER,FS));
  gl.useProgram(prog);

  // Quad buffer
  const verts = new Float32Array([
    -1,-1,0, 0,0,
     1,-1,0, 1,0,
    -1, 1,0, 0,1,
     1, 1,0, 1,1,
  ]);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  const STR = 5*4;
  const locPos = gl.getAttribLocation(prog,'aVertexPosition');
  const locUV  = gl.getAttribLocation(prog,'aTextureCoord');
  gl.enableVertexAttribArray(locPos); gl.vertexAttribPointer(locPos,3,gl.FLOAT,false,STR,0);
  gl.enableVertexAttribArray(locUV ); gl.vertexAttribPointer(locUV ,2,gl.FLOAT,false,STR,12);

  // Texture
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.uniform1i(gl.getUniformLocation(prog,'uTex'), 0);
  gl.uniform2f(gl.getUniformLocation(prog,'uRes'), cv.width, cv.height);
  const uAmt = gl.getUniformLocation(prog,'uAmt');

  // Wheel‑driven state
  let amt = 0;
  window.addEventListener('wheel', e=>{
    amt += (-e.deltaY) * WHEEL_SENS;   // wheel up → bulge, down → pinch
    amt  = clamp(amt, -1, 1);
  }, { passive:true });

  // Render loop
  (function loop(){
    amt *= FRICTION;  // ease toward 0
    gl.viewport(0,0,cv.width,cv.height);
    gl.uniform1f(uAmt, amt);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(loop);
  })();
}

/* — auto‑init — */
window.addEventListener('DOMContentLoaded', () => {
  console.log('[bulgeEffect] file loaded — initialising elements…');
  $('div[data-effect="bulge"]').forEach(initBulge);
});
