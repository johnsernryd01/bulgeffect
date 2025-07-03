/* bulge.js – v26  (back-to-working + ultra-smooth + subtle 3D) --------------
   This is a **clean rewind to the last known-working vertical bow** (v24) but:
     • Mesh resolution cranked to 120×120 so the outline is silky-smooth.
     • Weight function switched to smoothstep() for rounder curve.
     • Added slight z-displacement so the image feels like it lifts forward
       when bulging and sinks backward when pinching (fake 3D depth).
   All other easing constants kept.
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* === FEEL CONSTANTS === */
const GRID_SEGMENTS = 120;   // verts per side (super smooth)
const AMP           = 0.35;  // 0.35 = 35 % height bow
const LIMIT         = 0.35;  // shader strength cap
const DEPTH_FACTOR  = 0.4;   // fraction of AMP applied to z displacement
const WHEEL_GAIN    = 0.004;
const TARGET_DECAY  = 0.60;
const SMOOTH        = 0.10;
/* ====================== */

const $=(q,c=document)=>c.querySelectorAll(q);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const load=url=>new Promise((res,rej)=>new THREE.TextureLoader().setCrossOrigin('anonymous').load(url,res,undefined,rej));

/* === SHADERS === */
const vert=/* glsl */`
  uniform float uS;           // eased scroll strength (−LIMIT…+LIMIT)
  uniform float uAmp;         // clip-space amplitude
  uniform float uDepth;       // z displacement multiplier
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vec3 pos = position;      // plane in −1…+1 range

    // Vertical weight: 0 at centre, 1 at edges, smoothstep for roundness
    float w = smoothstep(0.0, 1.0, abs(pos.y));

    // Bend in Y (bow) – sign keeps top & bottom symmetric
    pos.y += sign(pos.y) * uS * uAmp * w;

    // Optional X scale to preserve aspect curvature
    pos.x *= 1.0 + uS * 0.18 * w;

    // Fake 3D depth: push/pull along Z
    pos.z += uS * uAmp * uDepth * w;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }`;

// Fragment shader: untouched (image radial warp)
const frag=/* glsl */`uniform sampler2D uTex; uniform float uS; varying vec2 vUv; void main(){ vec2 st=vUv-0.5; float d=length(st); float a=atan(st.y,st.x); float r=pow(d,1.0+uS*2.0); vec2 uv=vec2(cos(a),sin(a))*r+0.5; gl_FragColor=texture2D(uTex,uv);} `;

/* === INIT === */
async function init(el){
  const url=el.dataset.img; if(!url){console.warn('[bulge] missing data-img',el);return;}

  // let overflow render
  el.style.position=el.style.position||'relative';
  el.style.overflow='visible';

  let tex; try{tex=await load(url);}catch{el.style.background='#f88';return;}
  tex.minFilter=THREE.LinearFilter;

  const mat=new THREE.ShaderMaterial({
    uniforms:{
      uTex : { value: tex },
      uS   : { value: 0   },
      uAmp : { value: AMP },
      uDepth:{ value: DEPTH_FACTOR }
    },
    vertexShader:vert,
    fragmentShader:frag,
    transparent:true
  });

  const scene=new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2,GRID_SEGMENTS,GRID_SEGMENTS),mat));

  // widen camera for overshoot
  const cam=new THREE.OrthographicCamera(-1-AMP,1+AMP,1+AMP,-1-AMP,0,2);

  const ren=new THREE.WebGLRenderer({alpha:true,antialias:true});
  ren.setPixelRatio(devicePixelRatio);
  const fit=()=>ren.setSize(el.clientWidth||2,el.clientHeight||2,false);
  window.addEventListener('resize',fit); fit();
  Object.assign(ren.domElement.style,{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:-1});
  el.appendChild(ren.domElement);

  let target=0,curr=0;
  window.addEventListener('wheel',e=>{target+=e.deltaY*WHEEL_GAIN; target=clamp(target,-LIMIT,LIMIT);},{passive:true});

  (function loop(){
    target*=TARGET_DECAY;
    curr  += (target - curr) * SMOOTH;
    mat.uniforms.uS.value = curr;
    ren.render(scene,cam);
    requestAnimationFrame(loop);
  })();
}

document.addEventListener('DOMContentLoaded',()=>{$('div[data-bulge]').forEach(init)});
