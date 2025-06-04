/* bulge.js  – v18  (smooth geometry bulge / pinch)
   ------------------------------------------------
   • Uses a 64×64 subdivided plane and vertex displacement
   • Far smoother than UV warping
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* feel */
const WHEEL     = 0.001;   // wheel delta → strength (smaller = calmer)
const LIMIT     = 0.35;    // max |strength|
const RETURN    = 0.12;    // ease back to 0

/* helpers */
const $       = (q,c=document)=>c.querySelectorAll(q);
const clamp   = (v,a,b)=>Math.max(a,Math.min(b,v));
const loadTex = url=>new Promise((ok,err)=>new THREE.TextureLoader()
  .setCrossOrigin('anonymous').load(url,ok,undefined,err));

/* vertex—displace along normal for bulge, inset for pinch */
const VERT = `
uniform float uS;
varying vec2  vUv;
void main(){
  vUv = uv;
  vec3 p  = position;
  float d = length(p.xy);           // radial distance
  float f = (1.0 - d) * uS;         // bias toward centre
  p.xy  += p.xy * f;                // scale XY
  p.z   -= f;                       // depth cue
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.);
}`;

/* fragment—just sample texture (no UV warp) */
const FRAG = `
uniform sampler2D uTex;
varying vec2 vUv;
void main(){ gl_FragColor = texture2D(uTex, vUv); }`;

const PLANE = new THREE.PlaneGeometry(2,2,64,64); // 64×64 segments

async function init(el){
  const url = el.dataset.img;
  if(!url){ console.warn('[bulge] missing data-img'); return; }

  /* load texture */
  let tex;
  try{ tex = await loadTex(url); }
  catch{ el.style.background='#f88'; return; }
  tex.minFilter   = THREE.LinearFilter;
  tex.anisotropy  = new THREE.WebGLRenderer().capabilities.getMaxAnisotropy();

  /* shader material */
  const mat = new THREE.ShaderMaterial({
    uniforms:{ uTex:{value:tex}, uS:{value:0} },
    vertexShader:VERT, fragmentShader:FRAG
  });

  /* scene */
  const scene = new THREE.Scene();
  const cam   = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  scene.add(new THREE.Mesh(PLANE, mat));

  /* renderer */
  const ren = new THREE.WebGLRenderer({alpha:true,antialias:true});
  ren.setPixelRatio(devicePixelRatio);
  const fit = ()=>ren.setSize(el.clientWidth||2, el.clientHeight||2, false);
  window.addEventListener('resize',fit); fit();
  Object.assign(ren.domElement.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:-1});
  el.style.position = el.style.position||'relative';
  el.appendChild(ren.domElement);

  /* wheel-driven signed strength */
  let s=0;
  window.addEventListener('wheel',e=>{
    s = clamp((-e.deltaY)*WHEEL, -LIMIT, LIMIT);
  },{passive:true});

  (function loop(){
    mat.uniforms.uS.value += (s - mat.uniforms.uS.value) * RETURN;
    ren.render(scene,cam);
    requestAnimationFrame(loop);
  })();
}

window.addEventListener('DOMContentLoaded',()=>$('div[data-bulge]').forEach(init));
