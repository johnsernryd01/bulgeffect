/* bulge.js – v26-tuned  (strong outer bow, original inner warp)
   ---------------------------------------------------------------
   • AMP (0.45)   → aggressive bend
   • TEX_FACTOR   → mild image distortion (1.0 ≈ old look)
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* ===== FEEL CONSTANTS ========================================= */
const GRID_SEGMENTS = 120;    // outline smoothness
const AMP           = 0.45;   // outer bow strength      ← crank here
const LIMIT         = 0.45;   // keep ≈ AMP
const DEPTH_FACTOR  = 0.25;   // 3-D pop
const TEX_FACTOR    = 1.0;    // inner warp strength     ← lower = subtler
const WHEEL_GAIN    = 0.004;
const TARGET_DECAY  = 0.60;
const SMOOTH        = 0.10;
/* =============================================================== */

const $=(q,c=document)=>c.querySelectorAll(q);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const load=url=>new Promise((res,rej)=>new THREE.TextureLoader().setCrossOrigin('anonymous').load(url,res,undefined,rej));

/* ===== SHADERS ================================================= */
const vert = /* glsl */`
uniform float uS;
uniform float uAmp;
uniform float uDepth;
varying vec2 vUv;
void main () {
  vUv = uv;
  vec3 pos = position;
  float w = smoothstep(0.0, 1.0, abs(pos.y));
  pos.y += sign(pos.y) * uS * uAmp * w;          // stronger outer bend
  pos.x *= 1.0 + uS * 0.18 * w;
  pos.z += -uS * uAmp * uDepth * w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
}`;

/* independent TEX_FACTOR for subtle image warp */
const frag = /* glsl */`
uniform sampler2D uTex;
uniform float     uS;
uniform float     uTexFac;
varying vec2 vUv;
void main () {
  vec2 st = vUv - 0.5;
  float d = length(st);
  float a = atan(st.y, st.x);
  float r = pow(d, 1.0 + uS * uTexFac);        // milder or wilder
  vec2 uv = vec2(cos(a), sin(a)) * r + 0.5;
  gl_FragColor = texture2D(uTex, uv);
}`;
/* =============================================================== */

async function init(el){
  const url = el.dataset.img;
  if(!url){ console.warn('[bulge] missing data-img:', el); return; }

  el.style.position = el.style.position || 'relative';
  el.style.overflow = 'visible';

  let tex; try{ tex = await load(url); } catch{ el.style.background='#f88'; return; }
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.ShaderMaterial({
    uniforms:{
      uTex   : { value: tex },
      uS     : { value: 0 },
      uAmp   : { value: AMP },
      uDepth : { value: DEPTH_FACTOR },
      uTexFac: { value: TEX_FACTOR }
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true
  });

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2,GRID_SEGMENTS,GRID_SEGMENTS), mat));

  const cam = new THREE.OrthographicCamera(-1-AMP, 1+AMP, 1+AMP, -1-AMP, -AMP*2, AMP*2+2);

  const ren = new THREE.WebGLRenderer({ alpha:true, antialias:true });
  ren.setPixelRatio(devicePixelRatio);
  const fit = ()=>ren.setSize(el.clientWidth||2, el.clientHeight||2, false);
  window.addEventListener('resize', fit); fit();

  Object.assign(ren.domElement.style, { position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:-1 });
  el.appendChild(ren.domElement);

  let target = 0, curr = 0;
  window.addEventListener('wheel', e=>{
    target += e.deltaY * WHEEL_GAIN;
    target  = clamp(target, -LIMIT, LIMIT);
  }, { passive:true });

  (function loop(){
    target *= TARGET_DECAY;
    curr   += (target - curr) * SMOOTH;
    mat.uniforms.uS.value = curr;
    ren.render(scene, cam);
    requestAnimationFrame(loop);
  })();
}

/* auto-init */
document.addEventListener('DOMContentLoaded', ()=>{ $('div[data-bulge]').forEach(init); });
