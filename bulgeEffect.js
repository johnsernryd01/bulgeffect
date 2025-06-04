/* bulge.js  – v20  (slow, no-bounce, Awwwards style – direction reversed)
   -----------------------------------------------------------------------
   wheel ↓ → bulge  |  wheel ↑ → pinch
   Smooth exponential ease-in and glide-out.
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* ===== feel constants =================================================== */
const WHEEL_GAIN   = 0.004;  // wheel delta → target change  (positive ΔY bulges)
const LIMIT        = 0.20;   // max absolute strength
const TARGET_DECAY = 0.60;   // how fast target fades toward 0  (0.60 = slow)
const SMOOTH       = 0.10;   // how fast curr eases toward target (0.02–0.10)
/* ========================================================================= */

const $     = (q,c=document)=>c.querySelectorAll(q);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const load  = url=>new Promise((res,rej)=>
  new THREE.TextureLoader().setCrossOrigin('anonymous')
    .load(url,res,undefined,rej));

/* fragment shader (unchanged) */
const frag = `
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

const PLANE = new THREE.PlaneGeometry(2, 2);

async function init(el){
  const url = el.dataset.img;
  if(!url){ console.warn('[bulge] missing data-img:', el); return; }

  let tex;
  try { tex = await load(url); }
  catch { el.style.background = '#f88'; return; }   // pink block = load fail
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex:{value:tex},  uS:{value:0} },
    vertexShader  : 'varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position,1.);}',
    fragmentShader: frag
  });

  /* Scene setup */
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(PLANE, mat));
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
    target += ( e.deltaY) * WHEEL_GAIN;      // <-- note the positive sign
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
