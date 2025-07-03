/* bulge.js – v26a  (smooth vertical bow + subtle 3-D depth)
   ----------------------------------------------------------------
   wheel ↓  →  outward bow (bulge) – top & bottom lift toward camera
   wheel ↑  →  inward cave (pinch) – top & bottom sink away
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* ======= FEEL CONSTANTS ========================================= */
const GRID_SEGMENTS = 120;   // mesh resolution (verts per side)
const AMP           = 0.35;  // 0.35 ≈ 35 % of height bow
const LIMIT         = 0.35;  // shader uniform clamp (match AMP 1-to-1)
const DEPTH_FACTOR  = 0.4;   // 0 = flat, 1 = deep parallax
const WHEEL_GAIN    = 0.004; // wheel delta scalar
const TARGET_DECAY  = 0.60;  // target → 0 decay per frame
const SMOOTH        = 0.10;  // ease current toward target
/* =============================================================== */

const $     = (q,c=document)=>c.querySelectorAll(q);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const load  = url=>new Promise((res,rej)=>
  new THREE.TextureLoader().setCrossOrigin('anonymous')
    .load(url,res,undefined,rej));

/* -------- GLSL SHADERS ----------------------------------------- */
const vert = /* glsl */`
  uniform float uS;        // eased scroll strength
  uniform float uAmp;      // amplitude in clip-space units
  uniform float uDepth;    // depth multiplier
  varying vec2 vUv;

  void main () {
    vUv = uv;
    vec3 pos = position;               // Plane vertices in −1…+1

    /* Weight strongest at edges, 0 at centre (smoothstep for roundness) */
    float w = smoothstep(0.0, 1.0, abs(pos.y));

    /* Vertical bow (top & bottom) */
    pos.y += sign(pos.y) * uS * uAmp * w;

    /* Optional horizontal spread keeps curve looking circular */
    pos.x *= 1.0 + uS * 0.18 * w;

    /* SUBTLE DEPTH: bulge lifts toward camera, pinch sinks away */
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
/* --------------------------------------------------------------- */

async function init (el) {
  const url = el.dataset.img;
  if (!url) { console.warn('[bulge] missing data-img:', el); return; }

  /* allow mesh to spill outside wrapper */
  el.style.position = el.style.position || 'relative';
  el.style.overflow = 'visible';

  /* texture */
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

  /* camera – widen by AMP so displaced verts stay in view */
  const cam = new THREE.OrthographicCamera(
    -1 - AMP, 1 + AMP, 1 + AMP, -1 - AMP, 0, 2
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
    target *= TARGET_DECAY;          // glide back toward 0
    curr   += (target - curr) * SMOOTH;
    mat.uniforms.uS.value = curr;
    ren.render(scene, cam);
    requestAnimationFrame(loop);
  })();
}

/* auto-init on div[data-bulge] */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('div[data-bulge]').forEach(init);
});
