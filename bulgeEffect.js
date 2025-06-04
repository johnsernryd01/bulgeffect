/* =========================================================================
   bulgeEffect.js — wheel-driven curved bulge / pinch   (2025-06-04 v16)
   -------------------------------------------------------------------------
   ✦ Wheel ↑  → bulge  (image puffs outward)
   ✦ Wheel ↓  → pinch  (image pulls inward)

   Embed once:
     <script type="module" src="https://cdn.jsdelivr.net/gh/you/repo@SHA/bulgeEffect.js?v=16"></script>

   Use anywhere:
     <div data-effect="bulge"
          data-src="https://yourcdn.com/photo.jpg"
          style="width:100%;height:400px"></div>
========================================================================= */

/* ── tweak for feel ───────────────────────────────────────────────────── */
const WHEEL_SENS = 0.02;   // bigger  → stronger (demo strength)
const FRICTION   = 0.92;   // 0.85 = loose spring, 0.95 = slow settle
/* --------------------------------------------------------------------- */

/* shorthand helpers */
const $      = (sel, ctx = document) => ctx.querySelectorAll(sel);
const clamp  = (v, a, b) => Math.max(a, Math.min(b, v));
const loadImg = src =>
  new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => res(img);
    img.onerror = rej;
    img.src     = src;
  });
const sh = (gl, type, src) => {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw gl.getShaderInfoLog(s);
  return s;
};
const pg = (gl, vs, fs) => {
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw gl.getProgramInfoLog(p);
  return p;
};

/* ── GLSL shaders ─────────────────────────────────────────────────────── */
const VS = `#version 300 es
precision mediump float;

in  vec3 aVertexPosition;
in  vec2 aTextureCoord;

out vec2 vUV;

uniform float uAmt;           // −1 .. +1
uniform vec2  uRes;           // image resolution

float ease(float t){
  return t < 0.5
    ? 2.0 * t * t
    : -1.0 + (4.0 - 2.0 * t) * t;
}

vec3 warp(vec3 p){
  float aspect = uRes.x / uRes.y;
  vec2  v      = p.xy * vec2(aspect, 1.0);
  float d      = length(v);
  float t      = clamp(1.0 - d * 1.4, 0.0, 1.0);
  float f      = ease(t) * uAmt * 3.0;   // ★ multiplier 3.0 (extra bold)
  p.xy += p.xy * f;
  p.z  -= f;
  return p;
}

void main(){
  vec3 pos = warp(aVertexPosition);
  vUV = aTextureCoord;
  gl_Position = vec4(pos, 1.0);
}`;

const FS = `#version 300 es
precision mediump float;

in  vec2 vUV;
uniform sampler2D uTex;
out vec4 color;

void main(){
  vec2 uv = vec2(vUV.x, 1.0 - vUV.y);  // flip Y
  color   = texture(uTex, uv);
}`;

/* ── initialise one element ───────────────────────────────────────────── */
async function initBulge(el){
  const src = el.dataset.src;
  if(!src){ console.warn('[bulgeEffect] missing data-src', el); return; }

  const img = await loadImg(src);

  /* canvas */
  const cv = document.createElement('canvas');
  cv.width  = img.width;
  cv.height = img.height;
  Object.assign(cv.style,{
    position:'absolute', inset:0, width:'100%', height:'100%', zIndex:-1
  });
  el.style.position = el.style.position || 'relative';
  el.appendChild(cv);

  /* WebGL2 */
  const gl = cv.getContext('webgl2');
  if(!gl){ console.warn('[bulgeEffect] WebGL2 not supported'); return; }

  const prog = pg(gl,
    sh(gl, gl.VERTEX_SHADER,   VS),
    sh(gl, gl.FRAGMENT_SHADER, FS)
  );
  gl.useProgram(prog);

  /* quad buffer */
  const verts = new Float32Array([
    -1,-1,0,  0,0,
     1,-1,0,  1,0,
    -1, 1,0,  0,1,
     1, 1,0,  1,1,
  ]);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  const STRIDE = 5 * 4;
  const locPos = gl.getAttribLocation(prog,'aVertexPosition');
  const locUV  = gl.getAttribLocation(prog,'aTextureCoord');
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(locUV);
  gl.vertexAttribPointer(locUV,  2, gl.FLOAT, false, STRIDE, 12);

  /* texture */
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.uniform1i(gl.getUniformLocation(prog,'uTex'), 0);
  gl.uniform2f(gl.getUniformLocation(prog,'uRes'), cv.width, cv.height);
  const uAmt = gl.getUniformLocation(prog,'uAmt');

  /* wheel-controlled amount */
  let amt = 0;
  window.addEventListener('wheel', e => {
    amt += (-e.deltaY) * WHEEL_SENS;     // wheel up = negative deltaY → bulge
    amt  = clamp(amt, -1, 1);
  }, { passive:true });

  /* render loop */
  (function loop(){
    amt *= FRICTION;                     // ease back toward 0
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform1f(uAmt, amt);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(loop);
  })();
}

/* ── auto-init ─────────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  console.log('[bulgeEffect] file loaded – initializing …');
  $('div[data-effect="bulge"]').forEach(initBulge);
});
