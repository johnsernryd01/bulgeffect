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

/* ─── user-tweakable constants ──────────────────────────────────────────── */
const WHEEL_SENS = 0.02;   // larger  → stronger reaction (0.002–0.005 for “normal”)
const FRICTION   = 0.90;   // how quickly it settles back to neutral (0.85–0.95)

/* ─── simple helper shortcuts ───────────────────────────────────────────── */
const $all = (sel, ctx = document) => ctx.querySelectorAll(sel);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const loadImage = src =>
  new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
/* shader helpers */
const compileShader = (gl, type, src) => {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(sh));
  return sh;
};
const linkProgram = (gl, vs, fs) => {
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog));
  return prog;
};

/* ─── GLSL shaders ──────────────────────────────────────────────────────── */
const VERT_SRC = `#version 300 es
precision mediump float;

in  vec3 aVertexPosition;
in  vec2 aTextureCoord;

out vec2 vUV;

uniform float uAmt;           // -1 (pinch) … 0 … +1 (bulge)
uniform vec2  uRes;           // image resolution

float ease(float t) {               // easeInOutQuad
  return t < 0.5
    ? 2.0 * t * t
    : -1.0 + (4.0 - 2.0 * t) * t;
}

vec3 warp(vec3 p) {
  float aspect = uRes.x / uRes.y;
  vec2  v      = p.xy * vec2(aspect, 1.0);
  float d      = length(v);               // radial distance
  float t      = clamp(1.0 - d * 1.4, 0.0, 1.0);
  float f      = ease(t) * uAmt * 1.5;    // 1.5 = visibility boost
  p.xy += p.xy * f;                       // push / pull in XY
  p.z  -= f;                              // simple depth cue
  return p;
}

void main() {
  vec3 pos = warp(aVertexPosition);
  vUV = aTextureCoord;
  gl_Position = vec4(pos, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision mediump float;

in  vec2 vUV;
uniform sampler2D uTex;
out vec4 color;

void main() {
  // manual Y-flip so images are upright on every GPU
  vec2 uv = vec2(vUV.x, 1.0 - vUV.y);
  color   = texture(uTex, uv);
}`;

/* ─── main initializer per element ─────────────────────────────────────── */
async function initBulgeDiv(div) {
  const src = div.dataset.src;
  if (!src) {
    console.warn('[bulgeEffect] missing data-src on element', div);
    return;
  }

  /* load image */
  const img = await loadImage(src);

  /* create and overlay canvas */
  const canvas = document.createElement('canvas');
  canvas.width  = img.width;
  canvas.height = img.height;
  Object.assign(canvas.style, {
    position: 'absolute',
    inset:    0,
    width:    '100%',
    height:   '100%',
    zIndex:   -1,
  });
  div.style.position = div.style.position || 'relative';
  div.appendChild(canvas);

  /* get WebGL2 context */
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    console.warn('[bulgeEffect] WebGL2 not supported');
    return;
  }

  /* compile & link shaders */
  const prog = linkProgram(
    gl,
    compileShader(gl, gl.VERTEX_SHADER,   VERT_SRC),
    compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
  );
  gl.useProgram(prog);

  /* upload quad geometry (two triangles) */
  const quad = new Float32Array([
    -1, -1, 0,  0, 0,
     1, -1, 0,  1, 0,
    -1,  1, 0,  0, 1,
     1,  1, 0,  1, 1,
  ]);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  const STRIDE = 5 * 4; // 5 floats per vertex * 4 bytes
  const locPos = gl.getAttribLocation(prog, 'aVertexPosition');
  const locUV  = gl.getAttribLocation(prog, 'aTextureCoord');
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(locUV);
  gl.vertexAttribPointer(locUV,  2, gl.FLOAT, false, STRIDE, 12);

  /* upload texture */
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);

  /* set static uniforms */
  gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);
  gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), canvas.width, canvas.height);
  const uAmt = gl.getUniformLocation(prog, 'uAmt');

  /* scroll state */
  let amount = 0;

  /* wheel event → modify amount */
  window.addEventListener(
    'wheel',
    e => {
      amount += (-e.deltaY) * WHEEL_SENS; // wheel up (deltaY < 0) → positive amount
      amount  = clamp(amount, -1, 1);
    },
    { passive: true }
  );

  /* render loop */
  function render() {
    amount *= FRICTION; // ease back
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uAmt, amount);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render();
}

/* ─── auto-initialise on DOMContentLoaded ──────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  console.log('[bulgeEffect] file loaded – initializing elements…');
  $all('[data-effect="bulge"]').forEach(initBulgeDiv);
});
