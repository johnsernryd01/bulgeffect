/* bulge.js – v23  (visible top‑bottom bow) ------------------------------------------------
   This tweak changes the vertex shader so **only the top & bottom edges move**
   dramatically, corners stay anchored → perfect fabric‑like sag/bow the user
   sketched.  The fragment shader & easing remain the same.

   QUICK TUNING:
     AMP      – absolute pixel‑equivalent height gain at full bulge (try 0.30)
     GRID_SEG – raise to 60 for super‑smooth curve if perf allows
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* === CONFIG (unchanged feel) === */
const GRID_SEGMENTS = 50;   // finer grid → smoother outline
const WHEEL_GAIN    = 0.004;
const LIMIT         = 0.20;
const TARGET_DECAY  = 0.60;
const SMOOTH        = 0.10;
const AMP           = 0.25;  // outward displacement in clip‑space (0.25 ≈ 25% height)
/* =============================== */

const $     = (q,c=document)=>c.querySelectorAll(q);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const load  = url=>new Promise((res,rej)=>
  new THREE.TextureLoader().setCrossOrigin('anonymous').load(url,res,undefined,rej));

/* === SHADERS === */
// Vertex shader – vertical bow (top & bottom) with corners fixed
const vert = /* glsl */`
  uniform float uS;   // scroll strength (−LIMIT…+LIMIT)
  uniform float uAmp; // amplitude
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vec3 pos = position;      // plane coords −1…+1

    // Weight strongest at |y|≈1 (top/bottom), zero at y≈0 (centre)
    float w = abs(pos.y);

    // Displace along y outward/inward
    pos.y += sign(pos.y) * uS * uAmp * w;

    // Optional slight x‑scale so bulge feels rounder (delete if unwanted)
    pos.x *= 1.0 + uS * 0.12 * w;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }`;

// Fragment shader – same as v22
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

/* === INIT (same scaffolding) === */
async function init(el){
  const url = el.dataset.img;
  if(!url){ console.warn('[bulge] missing data-img:', el); return; }

  let tex; try { tex = await load(url); } catch { el.style.background = '#f88'; return; }
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex:{value:tex}, uS:{value:0}, uAmp:{value:AMP} },
    vertexShader  : vert,
    fragmentShader: frag,
    transparent   : true
  });

  const scene = new THREE.Scene();
  const geom  = new THREE.PlaneGeometry(2, 2, GRID_SEGMENTS, GRID_SEGMENTS);
  scene.add(new THREE.Mesh(geom, mat));
  const cam   = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  const ren = new THREE.WebGLRenderer({ alpha:true, antialias:true });
  ren.setPixelRatio(devicePixelRatio);
  const fit = ()=>ren.setSize(el.clientWidth||2, el.clientHeight||2,false);
  window.addEventListener('resize', fit); fit();
  Object.assign(ren.domElement.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:-1});
  el.style.position = el.style.position || 'relative';
  el.appendChild(ren.domElement);

  let target=0, curr=0;
  window.addEventListener('wheel',e=>{ target+=e.deltaY*WHEEL_GAIN; target=clamp(target,-LIMIT,LIMIT);},{passive:true});

  (function loop(){
    target*=TARGET_DECAY;
    curr  +=(target-curr)*SMOOTH;
    mat.uniforms.uS.value = curr;
    ren.render(scene,cam);
    requestAnimationFrame(loop);
  })();
}

window.addEventListener('DOMContentLoaded',()=>{$('div[data-bulge]').forEach(init)});
