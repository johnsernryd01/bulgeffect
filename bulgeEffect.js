/* ============================================================================
   bulgeThree.js  –  Three.js-powered bulge / pinch on scroll direction
   Inspired by Codrops article (June 2023)
   ---------------------------------------------------------------------------
   • wheel ↑ / scroll up    → bulge   (convex)
   • wheel ↓ / scroll down  → pinch   (concave)
============================================================================ */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* settings – tweak feel here */
const MAX_STRENGTH  = 0.4;   // safety clamp
const WHEEL_FACTOR  = 0.0006;  // wheel delta → strength
const RETURN_SPEED  = 0.1;   // lerp speed back to 0 each frame

/* tiny utils */
const $ = (q, c=document) => c.querySelectorAll(q);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const loadTex = url => new Promise((res, rej)=>{
  new THREE.TextureLoader().load(url,res,undefined,rej);
});

/* fragment shader – signed bulge/pinch field */
const frag = `
uniform sampler2D uTex;
uniform float     uStrength;
varying vec2 vUv;
void main(){
  vec2 st      = vUv - 0.5;
  float dist   = length(st);
  float theta  = atan(st.y, st.x);
  float radius = pow(dist, 1.0 + uStrength * 2.0);
  vec2 uv      = vec2(cos(theta), sin(theta)) * radius + 0.5;
  gl_FragColor = texture2D(uTex, uv);
}`;

/* simple plane geometry */
const plane = new THREE.PlaneBufferGeometry(2,2,1,1);

async function initBulgeDiv(div){
  const imgURL   = div.dataset.img;
  const maxLocal = parseFloat(div.dataset.strength || '0.15');
  const strength = clamp(maxLocal, 0, MAX_STRENGTH);

  const tex  = await loadTex(imgURL);
  tex.minFilter = THREE.LinearFilter;

  const mat  = new THREE.ShaderMaterial({
    uniforms : { uTex:{value:tex}, uStrength:{value:0} },
    vertexShader  : 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);} ',
    fragmentShader: frag
  });

  const mesh = new THREE.Mesh(plane, mat);

  /* scene */
  const scene  = new THREE.Scene();
  const cam    = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  scene.add(mesh);

  /* renderer */
  const ren = new THREE.WebGLRenderer({alpha:true,antialias:true});
  ren.setPixelRatio(window.devicePixelRatio);
  const resize = ()=>{
    const w = div.clientWidth;
    const h = div.clientHeight;
    ren.setSize(w,h,false);
  };
  window.addEventListener('resize', resize);
  resize();

  /* insert canvas */
  ren.domElement.style.position='absolute';
  ren.domElement.style.inset='0';
  ren.domElement.style.zIndex='-1';
  div.style.position='relative';
  div.appendChild(ren.domElement);

  /* wheel-controlled signed amount */
  let target = 0;
  window.addEventListener('wheel', e=>{
    target += (-e.deltaY) * WHEEL_FACTOR;
    target  = clamp(target, -strength, strength);
  }, {passive:true});

  /* RAF */
  const tick = ()=>{
    /* smooth return */
    mat.uniforms.uStrength.value += (target - mat.uniforms.uStrength.value) * RETURN_SPEED;
    ren.render(scene, cam);
    requestAnimationFrame(tick);
  };
  tick();
}

/* auto-init */
window.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('[data-bulge]').forEach(initBulgeDiv);
});
