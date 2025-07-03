/* bulge.js – v21  (adds fabric‑style canvas bend on top of original pinch/bulge)
   ---------------------------------------------------------------------------
   wheel ↓ (deltaY > 0)  →  **bulge OUT**
   wheel ↑ (deltaY < 0)  →  **pinch IN**
   Keeps original easing constants & feel, but now the rectangle itself flexes.
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* ===== feel constants (unchanged) ====================================== */
const WHEEL_GAIN   = 0.004;  // wheel delta → target change  (positive ΔY bulges)
const LIMIT        = 0.20;   // max absolute strength sent to shader
const TARGET_DECAY = 0.60;   // how fast target fades toward 0  (0.60 = slow)
const SMOOTH       = 0.10;   // how fast curr eases toward target (0.02–0.10)
/* ====================================================================== */

// geometry resolution for smooth outline bend
const GRID_SEGMENTS = 40;    // 40×40 plane grid
// how far (in clip‑space units) the rectangle may expand at max bulge
const AMP = 0.15;            // keep ≤0.18 so it stays inside −1…+1 clip range

const $     = (q,c=document)=>c.querySelectorAll(q);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const load  = url=>new Promise((res,rej)=>
  new THREE.TextureLoader().setCrossOrigin('anonymous')
    .load(url,res,undefined,rej));

/* =====================  SHADERS  ======================================= */
// Vertex shader – NEW: bends the mesh outline radially so the whole
// rectangle balloons or caves in depending on scroll direction.
const vert = /* glsl */`
  uniform float uS;          // eased scroll strength (−LIMIT…+LIMIT)
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vec3 pos = position;            // −1…+1 square plane

    // Centre‑based coords (−0.5…+0.5) so (0,0) = centre
    vec2 c = uv - 0.5;
    float r = length(c);

    // Weight: 1 at centre, 0 at corners (√2 ≈ 1.414 gives corners -> 0)
    float w = clamp(1.0 - r * 1.414, 0.0, 1.0);

    // Safe outward dir (avoid div0 at centre)
    vec2 dir = (r > 0.00001) ? normalize(c) : vec2(0.0);

    // Radial displacement.  uS>0 → bulge; uS<0 → pinch.
    pos.xy += dir * uS * AMP * w;

    gl_Position = vec4(pos, 1.0);
  }`;

// Fragment shader – unchanged from v20 (still does nice radial power warp)
const frag = /* glsl */`
  uniform sampler2D uTex;
  uniform float     uS;
  varying vec2 vUv;
  void main(){
    vec2 st  = vUv - 0.5;
    float d  = length(st);
    float a  = atan(st.y, st.x);
    float r  = pow(d, 1.0 + uS * 2.0);
    vec2 uv  = vec2(cos(a), sin(a)) * r + 0.5;
    gl_FragColor = texture2D(uTex, uv);
  }`;

/* =====================  INIT  ========================================= */
async function init(el){
  const url = el.dataset.img;
  if(!url){ console.warn('[bulge] missing data-img:', el); return; }

  let tex;
  try { tex = await load(url); }
  catch { el.style.background = '#f88'; return; }   // pink block if load fail
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex:{value:tex},  uS:{value:0} },
    vertexShader  : vert,
    fragmentShader: frag,
    transparent   : true
  });

  /* Scene setup */
  const scene = new THREE.Scene();
  const geom  = new THREE.PlaneGeometry(2, 2, GRID_SEGMENTS, GRID_SEGMENTS);
  scene.add(new THREE.Mesh(geom, mat));
  const cam   = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  /* Renderer */
  const ren = new THREE.WebGLRenderer({ alpha:true, antialias:true });
  ren.setPixelRatio(devicePixelRatio);
  const fit = () => ren.setSize(el.clientWidth||2, el.clientHeight||2, false);
  window.addEventListener('resize', fit);
  fit();

  Object.assign(ren.domElement.style, {
    position:'absolute', inset:0, width:'100%', height:'100%', zIndex:-1
  });
  el.style.position = el.style.position || 'relative';
  el.appendChild(ren.domElement);

  /* easing state */
  let target = 0;   // nudged by wheel
  let curr   = 0;   // value sent to shader

  /* wheel handler – reversed sign (deltaY > 0 → bulge) */
  window.addEventListener('wheel', e=>{
    target += ( e.deltaY) * WHEEL_GAIN;   // positive sign kept
    target  = clamp(target, -LIMIT, LIMIT);
  }, { passive:true });

  /* RAF loop */
  (function loop(){
    target *= TARGET_DECAY;                  // fade target toward 0
    curr   += (target - curr) * SMOOTH;      // ease current to target
    mat.uniforms.uS.value = curr;
    ren.render(scene, cam);
    requestAnimationFrame(loop);
  })();
}

/* auto-init */
window.addEventListener('DOMContentLoaded', () => {
  $('div[data-bulge]').forEach(init);
});
