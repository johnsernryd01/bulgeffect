/* bulge.js – v26-final  (smooth vertical bow + subtle 3-D depth)
   ----------------------------------------------------------------
   • wheel ↓  → outward bow (bulge) – rectangle lifts toward camera
   • wheel ↑  → inward cave (pinch) – rectangle sinks away
   • No clipping in either direction (near/far planes widened)
*/

/* ===== import three.js (ESM) ===== */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* ===== FEEL CONSTANTS (tweak here) ============================== */
const GRID_SEGMENTS = 120;   // mesh resolution (verts per side)
const AMP           = 0.35;  // 35 % of height bulge/pinch
const LIMIT         = 0.35;  // uniform clamp (match AMP)
const DEPTH_FACTOR  = 0.25;  // 0 = flat, 1 = deep parallax
const WHEEL_GAIN    = 0.01; // wheel delta scalar
const TARGET_DECAY  = 0.60;  // how quickly target glides back
const SMOOTH        = 0.18;  // easing current → target
/* =============================================================== */

const $     = (q,c=document)=>c.querySelectorAll(q);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const load  = url=>new Promise((res,rej)=>
  new THREE.TextureLoader().setCrossOrigin('anonymous')
    .load(url,res,undefined,rej));

/* ===== GLSL SHADERS ============================================ */
const vert = /* glsl */`
  uniform float uS;        // eased scroll strength (−LIMIT…+LIMIT)
  uniform float uAmp;      // amplitude in clip-space units
  uniform float uDepth;    // Z-parallax multiplier
  varying vec2 vUv;

  void main () {
    vUv = uv;
    vec3 pos = position;               // plane vertices (−1…+1)

    /* vertical weight: 0 at centre, 1 at edges (smoothstep for roundness) */
    float w = smoothstep(0.0, 1.0, abs(pos.y));

    /* bend in Y */
    pos.y += sign(pos.y) * uS * uAmp * w;

    /* optional horizontal spread */
    pos.x *= 1.0 + uS * 0.18 * w;

    /* depth parallax: bulge → toward camera (−Z), pinch → away (+Z) */
    pos.z += -uS * uAmp * uDepth * w;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const frag = /* glsl */`
  uniform sampler2D uTex;
  uniform float     uS;
  varying vec2 vUv;

  void main () {
    vec2 st = vUv - 0.5;
    float d = length(st);
    float a = atan(st.y, st.x);
    float r = pow(d, 1.0 + uS * 2.0);          // image warp matches bow
    vec2 uv = vec2(cos(a), sin(a)) * r + 0.5;
    gl_FragColor = texture2D(uTex, uv);
  }
`;
/* =============================================================== */

async function init (el) {
  const url = el.dataset.img;
  if (!url) { console.warn('[bulge] missing data-img:', el); return; }

  /* allow mesh to spill outside wrapper */
  el.style.position = el.style.position || 'relative';
  el.style.overflow = 'visible';

  /* load texture */
  let tex;
  try { tex = await load(url); }
  catch { el.style.background = '#f88'; return; }   // pink block if load fails
  tex.minFilter = THREE.LinearFilter;

  /* material */
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTex  : { value: tex },
      uS    : { value: 0   },
      uAmp  : { value: AMP },
      uDepth: { value: DEPTH_FACTOR }
    },
    vertexShader   : vert,
    fragmentShader : frag,
    transparent    : true
  });

  /* scene / mesh */
  const scene = new THREE.Scene();
  const plane = new THREE.PlaneGeometry(2, 2, GRID_SEGMENTS, GRID_SEGMENTS);
  scene.add(new THREE.Mesh(plane, mat));

  /* camera – widen frustum & depth so nothing clips */
  const cam = new THREE.OrthographicCamera(
    -1 - AMP, 1 + AMP, 1 + AMP, -1 - AMP,
    -AMP * 2,  AMP * 2 + 2           // near, far
  );

  /* renderer */
  const ren = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  ren.setPixelRatio(devicePixelRatio);
  const fit = () => ren.setSize(el.clientWidth || 2, el.clientHeight || 2, false);
  window.addEventListener('resize', fit);
  fit();

  Object.assign(ren.domElement.style, {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: -1
  });
  el.appendChild(ren.domElement);

  /* easing state */
  let target = 0;
  let curr   = 0;

  window.addEventListener('wheel', e => {
    target += e.deltaY * WHEEL_GAIN;        // deltaY > 0 → bulge
    target  = clamp(target, -LIMIT, LIMIT);
  }, { passive: true });

  /* RAF loop */
  (function loop () {
    target *= TARGET_DECAY;          // glide target toward 0
    curr   += (target - curr) * SMOOTH;
    mat.uniforms.uS.value = curr;
    ren.render(scene, cam);
    requestAnimationFrame(loop);
  })();
}

/* auto-init on every <div data-bulge data-img="..."> */
document.addEventListener('DOMContentLoaded', () => {
  $('div[data-bulge]').forEach(init);
});
