/* =========================================================================
   bulgeThree.js — Three.js r155  |  wheel-driven curved bulge / pinch
   -------------------------------------------------------------------------
   1) Put one <script type="module" src="…/bulgeThree.js?v=2"></script>
   2) Add divs like:
        <div data-bulge
             data-img="https://yourcdn.com/photo.jpg"
             data-strength="0.15"
             style="width:100%;height:400px"></div>
============================================================================ */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155/build/three.module.js';

/* — tweak here — */
const MAX_STRENGTH = 0.40;   // absolute safety cap
const WHEEL_FACTOR = 0.0006; // deltaY → strength
const RETURN_SPEED = 0.10;   // lerp back to 0

/* helpers */
const $ = (sel, ctx = document) => ctx.querySelectorAll(sel);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const loadTex = url =>
  new Promise((res, rej) =>
    new THREE.TextureLoader().load(url, res, undefined, rej)
  );

/* fragment shader (signed bulge/pinch) */
const FRAG = `
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

/* shared plane geometry */
const PLANE = new THREE.PlaneGeometry(2, 2);

async function initBulge(el) {
  const imgURL   = el.dataset.img;
  const localMax = clamp(parseFloat(el.dataset.strength || '0.15'), 0, MAX_STRENGTH);
  if (!imgURL) { console.warn('[bulge] missing data-img:', el); return; }

  /* load texture */
  const tex = await loadTex(imgURL);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  /* material with shader */
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTex:      { value: tex },
      uStrength: { value: 0   }
    },
    vertexShader  : 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.);}',
    fragmentShader: FRAG
  });

  /* scene setup */
  const scene = new THREE.Scene();
  const cam   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(PLANE, mat));

  /* renderer */
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  const resize = () => {
    renderer.setSize(el.clientWidth, el.clientHeight, false);
  };
  window.addEventListener('resize', resize);
  resize();

  /* mount canvas */
  Object.assign(renderer.domElement.style, {
    position: 'absolute',
    inset:    0,
    width:    '100%',
    height:   '100%',
    zIndex:   -1
  });
  el.style.position = el.style.position || 'relative';
  el.appendChild(renderer.domElement);

  /* wheel-driven signed amount */
  let target = 0;
  window.addEventListener('wheel', e => {
    target += (-e.deltaY) * WHEEL_FACTOR;
    target  = clamp(target, -localMax, localMax);
  }, { passive: true });

  /* RAF loop */
  const tick = () => {
    mat.uniforms.uStrength.value += (target - mat.uniforms.uStrength.value) * RETURN_SPEED;
    renderer.render(scene, cam);
    requestAnimationFrame(tick);
  };
  tick();
}

/* auto-init */
window.addEventListener('DOMContentLoaded', () => {
  $('div[data-bulge]').forEach(initBulge);
});
