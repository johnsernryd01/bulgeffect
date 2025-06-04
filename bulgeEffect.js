/* bulge.js  – v18 (ease-in / spring-out)
   --------------------------------------
   wheel ↑ → bulge   • wheel ↓ → pinch
   distortion eases into the target, then springs smoothly back to 0.
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* ===== feel constants =================================================== */
const WHEEL      = 0.05;   // wheel delta → target strength
const LIMIT      = 0.35;     // absolute clamp |strength|
const RISE_SPEED = 0.10;     // 0.1–0.3  “ease-out” toward new target
const SPRING     = 0.10;     // spring stiffness back to 0
const DAMP       = 0.85;     // damping (closer 1 = slower, <0.75 over-damped)
/* ========================================================================= */

const $      = (q,c=document)=>c.querySelectorAll(q);
const clamp  = (v,a,b)=>Math.max(a,Math.min(b,v));
const load   = url => new Promise((res,rej)=>new THREE.TextureLoader()
  .setCrossOrigin('anonymous').load(url,res,undefined,rej));

const frag = `
uniform sampler2D uTex;
uniform float     uS;
varying vec2 vUv;
void main(){
  vec2 st  = vUv - 0.5;
  float d  = length(st);
  float ang= atan(st.y,st.x);
  float rad= pow(d, 1.0 + uS * 2.0);
  vec2  uv = vec2(cos(ang), sin(ang)) * rad + 0.5;
  gl_FragColor = texture2D(uTex, uv);
}`;

const PLANE = new THREE.PlaneGeometry(2,2);

async function init(el){
  const url = el.dataset.img;
  if(!url){ console.warn('[bulge] missing data-img'); return; }

  let tex; try{ tex = await load(url); }catch{ el.style.background='#f88'; return; }
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
  const fit = ()=>ren.setSize(el.clientWidth||2, el.clientHeight||2, false);
  window.addEventListener('resize',fit); fit();

  Object.assign(ren.domElement.style,{
    position:'absolute', inset:0, width:'100%', height:'100%', zIndex:-1
  });
  el.style.position = el.style.position||'relative';
  el.appendChild(ren.domElement);

  /* easing state */
  let target = 0;     // immediate goal set by wheel
  let curr   = 0;     // actual uniform value
  let vel    = 0;     // velocity for spring

  window.addEventListener('wheel', e=>{
    target += (-e.deltaY) * WHEEL;
    target  = clamp(target, -LIMIT, LIMIT);
  }, {passive:true});

  /* RAF */
  (function loop(){
    /* ease-out toward target (rise) */
    curr += (target - curr) * RISE_SPEED;

    /* when wheel stops target→0, spring pulls curr back smoothly */
    vel  += -curr * SPRING;
    vel  *= DAMP;
    curr += vel;

    mat.uniforms.uS.value = curr;
    ren.render(scene, cam);
    requestAnimationFrame(loop);
  })();
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-bulge]').forEach(init);
});
