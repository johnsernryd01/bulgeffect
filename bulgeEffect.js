/* bulge.js  – v19 (slow, no-bounce, Awwwards style)
   --------------------------------------------------
   wheel ↑ → bulge  |  wheel ↓ → pinch
   Eases in/out with simple exponential decay.
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* ===== feel constants =================================================== */
const WHEEL_GAIN = 0.004;   // wheel delta → target change
const LIMIT      = 0.2;     // max absolute strength
const TARGET_DECAY = 0.70;   // 0.90 → keep 90 % per frame  (fade to 0)
const SMOOTH       = 0.05;   // how fast curr chases target (0.02–0.08)
/* ========================================================================= */

const $      = (q,c=document)=>c.querySelectorAll(q);
const clamp  = (v,a,b)=>Math.max(a,Math.min(b,v));
const load   = url=>new Promise((res,rej)=>new THREE.TextureLoader()
  .setCrossOrigin('anonymous').load(url,res,undefined,rej));

const frag = `
uniform sampler2D uTex;
uniform float     uS;
varying vec2 vUv;
void main(){
  vec2 st  = vUv - 0.5;
  float d  = length(st);
  float a  = atan(st.y,st.x);
  float r  = pow(d, 1.0 + uS * 2.0);
  vec2 uv  = vec2(cos(a), sin(a)) * r + 0.5;
  gl_FragColor = texture2D(uTex, uv);
}`;

const PLANE = new THREE.PlaneGeometry(2,2);

async function init(el){
  const url = el.dataset.img;
  if(!url){ console.warn('[bulge] missing data-img'); return; }

  let tex; try { tex = await load(url); }
  catch { el.style.background='#f88'; return; }
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.ShaderMaterial({
    uniforms:{uTex:{value:tex},uS:{value:0}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.);}',
    fragmentShader:frag
  });

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(PLANE, mat));
  const cam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  const ren = new THREE.WebGLRenderer({alpha:true, antialias:true});
  ren.setPixelRatio(devicePixelRatio);
  const fit=()=>ren.setSize(el.clientWidth||2, el.clientHeight||2, false);
  window.addEventListener('resize',fit); fit();

  Object.assign(ren.domElement.style,{
    position:'absolute', inset:0, width:'100%', height:'100%', zIndex:-1
  });
  el.style.position = el.style.position || 'relative';
  el.appendChild(ren.domElement);

  /* easing state */
  let target = 0;   // quickly nudged by wheel
  let curr   = 0;   // smooth uniform we send to shader

  window.addEventListener('wheel', e=>{
    target += (-e.deltaY) * WHEEL_GAIN;
    target  = clamp(target, -LIMIT, LIMIT);
  }, { passive:true });

  (function loop(){
    target *= TARGET_DECAY;                       // fade toward 0
    curr   += (target - curr) * SMOOTH;           // ease-out to target
    mat.uniforms.uS.value = curr;
    ren.render(scene, cam);
    requestAnimationFrame(loop);
  })();
}

window.addEventListener('DOMContentLoaded', () => {
  $('div[data-bulge]').forEach(init);
});
