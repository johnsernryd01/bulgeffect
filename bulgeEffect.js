/* bulge.js – v22  (FIX: AMP uniform declared; canvas bulge finally compiles)
   ---------------------------------------------------------------------------
   wheel ↓ (deltaY > 0)  →  bulge OUT
   wheel ↑ (deltaY < 0)  →  pinch IN
   Keeps original easing feel; adds mesh bending.
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* === CONFIG === */
const GRID_SEGMENTS  = 40;   // plane subdivision for smooth outline
const WHEEL_GAIN     = 0.004;
const LIMIT          = 0.20;
const TARGET_DECAY   = 0.60;
const SMOOTH         = 0.10;
const AMP            = 0.15; // max outward displacement (clip‑space units)
/* =============== */

const $     = (q,c=document)=>c.querySelectorAll(q);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const load  = url=>new Promise((res,rej)=>
  new THREE.TextureLoader().setCrossOrigin('anonymous').load(url,res,undefined,rej));

/* === SHADERS === */
// Vertex shader – now uses uniform uAmp (passed from JS)
const vert = /* glsl */`
  uniform float uS;   // eased scroll strength (−LIMIT…+LIMIT)
  uniform float uAmp; // amplitude of displacement
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vec3 pos = position;
    vec2 c = uv - 0.5;
    float r = length(c);
    float w = clamp(1.0 - r * 1.414, 0.0, 1.0);
    vec2 dir = (r > 1e-5) ? normalize(c) : vec2(0.0);
    pos.xy += dir * uS * uAmp * w;
    gl_Position = vec4(pos, 1.0);
  }`;

// Fragment shader (unchanged image warp)
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

/* === INIT === */
async function init(el){
  const url = el.dataset.img;
  if(!url){ console.warn('[bulge] missing data-img:', el); return; }

  let tex;
  try { tex = await load(url); }
  catch { el.style.background = '#f88'; return; }
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTex : { value: tex },
      uS   : { value: 0 },
      uAmp : { value: AMP }
    },
    vertexShader  : vert,
    fragmentShader: frag,
    transparent   : true
  });

  /* Scene */
  const scene = new THREE.Scene();
  const geom  = new THREE.PlaneGeometry(2, 2, GRID_SEGMENTS, GRID_SEGMENTS);
  scene.add(new THREE.Mesh(geom, mat));
  const cam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  /* Renderer */
  const ren = new THREE.WebGLRenderer({ alpha:true, antialias:true });
  ren.setPixelRatio(devicePixelRatio);
  const fit = () => ren.setSize(el.clientWidth||2, el.clientHeight||2, false);
  window.addEventListener('resize', fit);
  fit();
  Object.assign(ren.domElement.style,{ position:'absolute', inset:0, width:'100%', height:'100%', zIndex:-1 });
  el.style.position = el.style.position || 'relative';
  el.appendChild(ren.domElement);

  /* Easing state */
  let target = 0;
  let curr   = 0;

  window.addEventListener('wheel', e=>{
    target += e.deltaY * WHEEL_GAIN;
    target  = clamp(target, -LIMIT, LIMIT);
  }, { passive:true });

  /* RAF */
  (function loop(){
    target *= TARGET_DECAY;
    curr   += (target - curr) * SMOOTH;
    mat.uniforms.uS.value = curr;
    ren.render(scene, cam);
    requestAnimationFrame(loop);
  })();
}

/* auto-init */
window.addEventListener('DOMContentLoaded', () => {
  $('div[data-bulge]').forEach(init);
});
