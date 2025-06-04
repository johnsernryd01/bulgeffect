/* bulge.js  – “active-only” version  (v17)
   Shows bulge / pinch **during** wheel events, quickly resets when idle.
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* feel */
const WHEEL  = 0.009;  // wheel delta → strength
const LIMIT  = 0.85;    // max |strength|
const DECAY  = 0.01;     // 0.5 → halve per frame  (larger = faster snap)

/* helpers */
const $=(q,c=document)=>c.querySelectorAll(q);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const load=(u)=>new Promise((res,rej)=>new THREE.TextureLoader()
  .setCrossOrigin('anonymous').load(u,res,undefined,rej));

/* shader */
const frag = `
uniform sampler2D uTex;
uniform float     uS;
varying vec2 vUv;
void main(){
  vec2 st  = vUv - 0.5;
  float d  = length(st);
  float t  = atan(st.y,st.x);
  float r  = pow(d, 1.0 + uS*2.0);
  vec2 uv  = vec2(cos(t),sin(t))*r + 0.5;
  gl_FragColor = texture2D(uTex, uv);
}`;

const PLANE = new THREE.PlaneGeometry(2,2);

async function init(el){
  const url = el.dataset.img;
  if(!url){ console.warn('[bulge] missing data-img'); return; }

  let tex;
  try{ tex = await load(url); }catch{ el.style.background='#f88'; return; }
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.ShaderMaterial({
    uniforms:{uTex:{value:tex},uS:{value:0}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.);}',
    fragmentShader:frag
  });

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(PLANE, mat));
  const cam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  const ren = new THREE.WebGLRenderer({alpha:true,antialias:true});
  ren.setPixelRatio(devicePixelRatio);
  const fit=()=>ren.setSize(el.clientWidth||2,el.clientHeight||2,false);
  window.addEventListener('resize',fit); fit();

  Object.assign(ren.domElement.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:-1});
  el.style.position=el.style.position||'relative';
  el.appendChild(ren.domElement);

  /* pulse strength */
  let s = 0;
  window.addEventListener('wheel',e=>{
    s = clamp((-e.deltaY)*WHEEL, -LIMIT, LIMIT);   // fresh pulse each tick
  },{passive:true});

  (function loop(){
    mat.uniforms.uS.value = s;
    s *= DECAY;                     // quick fade when idle
    ren.render(scene, cam);
    requestAnimationFrame(loop);
  })();
}

window.addEventListener('DOMContentLoaded',()=>$('div[data-bulge]').forEach(init));
