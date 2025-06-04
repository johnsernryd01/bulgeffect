/* bulgeThree.js – v3  (extra debug + CORS note) */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

const MAX_STRENGTH = 0.40;
const WHEEL_FACTOR = 0.0006;
const RETURN_SPEED = 0.10;

/* helpers */
const $ = (q,c=document)=>c.querySelectorAll(q);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const loadTex=url=>new Promise((res,rej)=>{
  new THREE.TextureLoader()
    .setCrossOrigin('anonymous')
    .load(url,tex=>{ console.log('[bulge] Loaded OK', url); res(tex); },
                undefined,err=>{ console.warn('[bulge] Texture load FAILED', url); rej(err); });
});

const FRAG = `
uniform sampler2D uTex;
uniform float     uStrength;
varying vec2 vUv;
void main(){
  vec2 st      = vUv - 0.5;
  float dist   = length(st);
  float theta  = atan(st.y,st.x);
  float radius = pow(dist, 1.0 + uStrength*2.0);
  vec2 uv      = vec2(cos(theta),sin(theta))*radius + 0.5;
  gl_FragColor = texture2D(uTex, uv);
}`;

const PLANE = new THREE.PlaneGeometry(2,2);

async function initBulge(el){
  const url = el.dataset.img;
  if(!url){ console.warn('[bulge] missing data-img'); return; }

  let tex;
  try{ tex = await loadTex(url); }
  catch(e){ el.style.background='pink'; return; }   // visual error marker

  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.ShaderMaterial({
    uniforms:{uTex:{value:tex},uStrength:{value:0}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.);}',
    fragmentShader:FRAG
  });

  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(PLANE, mat));
  const cam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

  const ren = new THREE.WebGLRenderer({alpha:true,antialias:true});
  ren.setPixelRatio(window.devicePixelRatio);
  const fit = ()=>ren.setSize(el.clientWidth||2, el.clientHeight||2, false);
  window.addEventListener('resize',fit); fit();

  Object.assign(ren.domElement.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:-1});
  el.style.position=el.style.position||'relative';
  el.appendChild(ren.domElement);

  let tgt=0;
  window.addEventListener('wheel',e=>{
    tgt += (-e.deltaY)*WHEEL_FACTOR;
    tgt  = clamp(tgt, -MAX_STRENGTH, MAX_STRENGTH);
  },{passive:true});

  (function loop(){
    mat.uniforms.uStrength.value += (tgt - mat.uniforms.uStrength.value)*RETURN_SPEED;
    ren.render(scene, cam);
    requestAnimationFrame(loop);
  })();
}

window.addEventListener('DOMContentLoaded',()=>$('div[data-bulge]').forEach(initBulge));
