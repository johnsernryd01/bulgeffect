/* bulge.js – v23‑XL (exaggerated test build) ---------------------------------
   MASSIVE bulge / pinch so it’s un‑missable.  Dialled up constants:
     LIMIT  → 0.60   (3× stronger uniform range)
     AMP    → 0.60   (~60 % height bow)
     x‑scale factor doubled so edge curvature is obvious.
   Roll this only for testing – you’ll probably dial it back later.
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* === FEEL CONSTANTS === */
const GRID_SEGMENTS = 60;    // finer grid = smooth curve even at huge bulge
const WHEEL_GAIN    = 0.004; // keep same – LIMIT is bigger anyway
const LIMIT         = 0.60;  //   ↑ increased from 0.20
const TARGET_DECAY  = 0.60;
const SMOOTH        = 0.10;
const AMP           = 0.60;  //   ↑ increased from 0.25 (0.60 ≈ 60% of height)
/* ====================== */

const $=(q,c=document)=>c.querySelectorAll(q);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const load=url=>new Promise((res,rej)=>new THREE.TextureLoader().setCrossOrigin('anonymous').load(url,res,undefined,rej));

/* === SHADERS === */
const vert=/* glsl */`
  uniform float uS;
  uniform float uAmp;
  varying vec2 vUv;
  void main(){
    vUv=uv;
    vec3 pos=position;
    float w=abs(pos.y);
    pos.y+=sign(pos.y)*uS*uAmp*w;
    pos.x*=1.0+uS*0.25*w;   // stronger lateral swell (was 0.12)
    gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);
  }`;

const frag=/* glsl */`
  uniform sampler2D uTex; uniform float uS; varying vec2 vUv;
  void main(){
    vec2 st=vUv-0.5; float d=length(st); float a=atan(st.y,st.x);
    float r=pow(d,1.0+uS*2.0);
    vec2 uv=vec2(cos(a),sin(a))*r+0.5;
    gl_FragColor=texture2D(uTex,uv);
  }`;

/* === INIT === */
async function init(el){
  const url=el.dataset.img; if(!url){console.warn('[bulge] missing data-img:',el);return;}
  let tex; try{tex=await load(url);}catch{el.style.background='#f88';return;}
  tex.minFilter=THREE.LinearFilter;

  const mat=new THREE.ShaderMaterial({
    uniforms:{uTex:{value:tex},uS:{value:0},uAmp:{value:AMP}},
    vertexShader:vert,fragmentShader:frag,transparent:true});

  const scene=new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2,GRID_SEGMENTS,GRID_SEGMENTS),mat));
  const cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  const ren=new THREE.WebGLRenderer({alpha:true,antialias:true});
  ren.setPixelRatio(devicePixelRatio);
  const fit=()=>ren.setSize(el.clientWidth||2,el.clientHeight||2,false);
  window.addEventListener('resize',fit); fit();
  Object.assign(ren.domElement.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:-1});
  el.style.position=el.style.position||'relative'; el.appendChild(ren.domElement);

  let target=0,curr=0;
  window.addEventListener('wheel',e=>{target+=e.deltaY*WHEEL_GAIN;target=clamp(target,-LIMIT,LIMIT);},{passive:true});

  (function loop(){
    target*=TARGET_DECAY; curr+=(target-curr)*SMOOTH; mat.uniforms.uS.value=curr;
    ren.render(scene,cam); requestAnimationFrame(loop);
  })();
}

window.addEventListener('DOMContentLoaded',()=>{$('div[data-bulge]').forEach(init)});
