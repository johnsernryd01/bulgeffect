/* bulge.js – v25.1  (radial curve actually bends mesh) -----------------------
   Bug in v25: uv‑space displacement was half the scale of clip‑space coords, so
   the plane barely moved.  Fix = multiply by 2.0 so outline bends.
   Also pushed AMP to 0.50 so you’ll *see* it.
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* === FEEL CONSTANTS === */
const GRID_SEGMENTS = 100;   // smooth outline
const AMP           = 0.50;  // clip‑space displacement (0.50 ≈ 50% bow)
const LIMIT         = 0.50;  // shader uniform range
const WHEEL_GAIN    = 0.004;
const TARGET_DECAY  = 0.60;
const SMOOTH        = 0.10;
/* ====================== */

const $=(q,c=document)=>c.querySelectorAll(q);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const load=url=>new Promise((res,rej)=>new THREE.TextureLoader().setCrossOrigin('anonymous').load(url,res,undefined,rej));

/* === SHADERS === */
const vert=/* glsl */`
  uniform float uS;   // eased scroll strength
  uniform float uAmp; // amplitude in clip‑space units
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vec3 pos = position;          // plane −1…+1

    // centre‑based UV coords → radial dir
    vec2 c = uv - 0.5;
    float r = length(c) * 1.414;   // 0 @ centre, 1 @ corner
    float w = pow(clamp(1.0 - r,0.0,1.0), 2.0); // quad fall‑off

    // radial displacement – scale by 2 to convert UV units to clip‑space
    vec2 dir = (r > 1e-5) ? normalize(c) : vec2(0.0);
    pos.xy += dir * uS * uAmp * w * 2.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
  }`;

const frag=/* glsl */`uniform sampler2D uTex;uniform float uS;varying vec2 vUv;void main(){vec2 st=vUv-0.5;float d=length(st);float a=atan(st.y,st.x);float r=pow(d,1.0+uS*2.0);vec2 uv=vec2(cos(a),sin(a))*r+0.5;gl_FragColor=texture2D(uTex,uv);} `;

/* === INIT === */
async function init(el){
  const url=el.dataset.img; if(!url){console.warn('[bulge] missing data-img',el); return;}
  el.style.position=el.style.position||'relative';
  el.style.overflow='visible';

  let tex; try{tex=await load(url);}catch{el.style.background='#f88';return;}
  tex.minFilter=THREE.LinearFilter;

  const mat=new THREE.ShaderMaterial({
    uniforms:{uTex:{value:tex},uS:{value:0},uAmp:{value:AMP}},
    vertexShader:vert,fragmentShader:frag,transparent:true});

  const scene=new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2,GRID_SEGMENTS,GRID_SEGMENTS),mat));

  // widen camera frustum
  const cam=new THREE.OrthographicCamera(-1-AMP,1+AMP,1+AMP,-1-AMP,0,1);

  const ren=new THREE.WebGLRenderer({alpha:true,antialias:true}); ren.setPixelRatio(devicePixelRatio);
  const fit=()=>ren.setSize(el.clientWidth||2,el.clientHeight||2,false);
  window.addEventListener('resize',fit); fit();
  Object.assign(ren.domElement.style,{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:-1});
  el.appendChild(ren.domElement);

  let target=0, curr=0;
  window.addEventListener('wheel',e=>{target+=e.deltaY*WHEEL_GAIN; target=clamp(target,-LIMIT,LIMIT);},{passive:true});

  (function loop(){
    target*=TARGET_DECAY;
    curr  +=(target-curr)*SMOOTH;
    mat.uniforms.uS.value = curr;
    ren.render(scene,cam);
    requestAnimationFrame(loop);
  })();
}

document.addEventListener('DOMContentLoaded',()=>{$('div[data-bulge]').forEach(init)});
