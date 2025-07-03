/* bulge.js – v24  (overflow‑visible + camera margin = no clipping) --------------
   – Sets the Webflow wrapper to `overflow:visible` so nothing gets cropped.
   – Enlarges orthographic frustum by AMP so vertices that leave ±1 range
     are still drawn.  Uses same AMP constant (now 0.25 default).
   – Keeps previous exaggerated values commented for easy swap.
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* === TWEAKABLE === */
const GRID_SEGMENTS = 50;   // resolution of the mesh (y * x)
const AMP           = 0.25; // 0.25 = 25 % height bow  (try 0.6 for huge)
const WHEEL_GAIN    = 0.004;
const LIMIT         = 0.25; // uniform range matches AMP nicely
const TARGET_DECAY  = 0.60;
const SMOOTH        = 0.10;
/* ================= */

const $=(q,c=document)=>c.querySelectorAll(q);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const load=url=>new Promise((res,rej)=>new THREE.TextureLoader().setCrossOrigin('anonymous').load(url,res,undefined,rej));

/* === SHADERS === */
const vert=/* glsl */`
  uniform float uS;   // eased scroll strength
  uniform float uAmp; // amplitude
  varying vec2 vUv;
  void main(){
    vUv=uv;
    vec3 p=position;
    float w=abs(p.y);                // weight strongest at edges
    p.y+=sign(p.y)*uS*uAmp*w;        // vertical bow
    p.x*=1.0+uS*0.15*w;              // slight horizontal spread
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
  }`;

const frag=/* glsl */`uniform sampler2D uTex;uniform float uS;varying vec2 vUv;void main(){vec2 st=vUv-0.5;float d=length(st);float a=atan(st.y,st.x);float r=pow(d,1.0+uS*2.0);vec2 uv=vec2(cos(a),sin(a))*r+0.5;gl_FragColor=texture2D(uTex,uv);} `;

/* === INIT === */
async function init(el){
  const url=el.dataset.img||''; if(!url){console.warn('[bulge] missing data-img',el);return;}

  // Ensure wrapper lets overflow show
  el.style.position=el.style.position||'relative';
  el.style.overflow='visible';

  let tex; try{tex=await load(url);}catch{el.style.background='#f88';return;}
  tex.minFilter=THREE.LinearFilter;

  const mat=new THREE.ShaderMaterial({
    uniforms:{uTex:{value:tex},uS:{value:0},uAmp:{value:AMP}},
    vertexShader:vert,fragmentShader:frag,transparent:true});

  const scene=new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2,GRID_SEGMENTS,GRID_SEGMENTS),mat));

  // Expand frustum by AMP so displaced verts stay in view
  const cam=new THREE.OrthographicCamera(-1-AMP,1+AMP,1+AMP,-1-AMP,0,1);

  const ren=new THREE.WebGLRenderer({alpha:true,antialias:true}); ren.setPixelRatio(devicePixelRatio);
  const fit=()=>ren.setSize(el.clientWidth||2,el.clientHeight||2,false);
  window.addEventListener('resize',fit); fit();
  Object.assign(ren.domElement.style,{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:-1});
  el.appendChild(ren.domElement);

  let tgt=0,curr=0;
  window.addEventListener('wheel',e=>{tgt+=e.deltaY*WHEEL_GAIN; tgt=clamp(tgt,-LIMIT,LIMIT);},{passive:true});

  (function loop(){
    tgt*=TARGET_DECAY;
    curr+=(tgt-curr)*SMOOTH;
    mat.uniforms.uS.value=curr;
    ren.render(scene,cam);
    requestAnimationFrame(loop);
  })();
}

document.addEventListener('DOMContentLoaded',()=>{$('div[data-bulge]').forEach(init)});
