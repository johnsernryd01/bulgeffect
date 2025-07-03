/* bulge.js – v25  (smooth radial curve + stronger amplitude) --------------------
   – Radial quadratic fall‑off makes the outline perfectly round—no jagged
     flat bits on the edges.
   – AMP + LIMIT bumped so the bulge/pinch is obvious.
   – GRID_SEGMENTS raised for a crisp curved outline.

   ⚠️  After you’re happy with magnitude, just dial AMP / LIMIT back.
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* === FEEL CONSTANTS === */
const GRID_SEGMENTS = 100;   // smooth outline (perf still fine)
const AMP           = 0.40;  // 0.40 = 40 % outward bow
const LIMIT         = 0.40;  // uniform range (match AMP for 1‑to‑1)
const WHEEL_GAIN    = 0.004;
const TARGET_DECAY  = 0.60;
const SMOOTH        = 0.10;
/* ====================== */

const $=(q,c=document)=>c.querySelectorAll(q);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const load=url=>new Promise((res,rej)=>new THREE.TextureLoader().setCrossOrigin('anonymous').load(url,res,undefined,rej));

/* === SHADERS === */
// Radial, quadratic weight for perfect circular bow
const vert=/* glsl */`
  uniform float uS;   // eased scroll strength (−LIMIT…+LIMIT)
  uniform float uAmp; // amplitude
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vec3 pos = position;              // plane: −1…+1
    vec2 c   = uv - 0.5;              // centre‑based coords (−.5…+.5)
    float r  = length(c) * 1.414;     // 0 at centre, 1 at corner (√2)
    float w  = pow( clamp(1.0 - r, 0.0, 1.0), 2.0 ); // quadratic fall‑off

    // Outward direction; avoids NaN at centre
    vec2 dir = (r > 1e-5) ? normalize(c) : vec2(0.0);

    // Displace radially
    pos.xy += dir * uS * uAmp * w;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }`;

// Fragment shader – same content warp for consistency
const frag=/* glsl */`uniform sampler2D uTex; uniform float uS; varying vec2 vUv; void main(){ vec2 st=vUv-0.5; float d=length(st); float a=atan(st.y,st.x); float r=pow(d,1.0+uS*2.0); vec2 uv=vec2(cos(a),sin(a))*r+0.5; gl_FragColor=texture2D(uTex,uv);} `;

/* === INIT === */
async function init(el){
  const url=el.dataset.img; if(!url){console.warn('[bulge] missing data-img:',el);return;}

  // ensure wrapper allows overflow
  el.style.position=el.style.position||'relative';
  el.style.overflow='visible';

  let tex; try{tex=await load(url);}catch{el.style.background='#f88';return;}
  tex.minFilter=THREE.LinearFilter;

  const mat=new THREE.ShaderMaterial({
    uniforms:{uTex:{value:tex},uS:{value:0},uAmp:{value:AMP}},
    vertexShader:vert,fragmentShader:frag,transparent:true});

  const scene=new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2,GRID_SEGMENTS,GRID_SEGMENTS),mat));

  // widen frustum by AMP to keep displaced vertices visible
  const cam=new THREE.OrthographicCamera(-1-AMP,1+AMP,1+AMP,-1-AMP,0,1);

  const ren=new THREE.WebGLRenderer({alpha:true,antialias:true}); ren.setPixelRatio(devicePixelRatio);
  const fit=()=>ren.setSize(el.clientWidth||2,el.clientHeight||2,false);
  window.addEventListener('resize',fit); fit();
  Object.assign(ren.domElement.style,{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:-1});
  el.appendChild(ren.domElement);

  /* easing state */
  let target=0, curr=0;
  window.addEventListener('wheel',e=>{ target+=e.deltaY*WHEEL_GAIN; target=clamp(target,-LIMIT,LIMIT); },{passive:true});

  (function loop(){
    target*=TARGET_DECAY;
    curr  += (target-curr)*SMOOTH;
    mat.uniforms.uS.value = curr;
    ren.render(scene,cam);
    requestAnimationFrame(loop);
  })();
}

document.addEventListener('DOMContentLoaded',()=>{$('div[data-bulge]').forEach(init)});
