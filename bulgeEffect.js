// bulgeffect.js – scroll‑responsive fabric‑like bulge & pinch (updated)
// Drop into your repo and load as a module in Webflow.
// USAGE (unchanged):
//   <div data-bulge data-img="/path/to/image.jpg"></div>
//   <script type="module" src="https://cdn.rawgit.com/USER/bulgeffect/main/bulgeffect.js"></script>
//   That’s it.

import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';

// ====== TUNABLE CONSTANTS ======
const PLANE_SEGMENTS   = 32;   // mesh resolution (X & Y)
const SCROLL_STRENGTH  = 0.003; // how much each wheel delta affects velocity
const FRICTION         = 0.88; // decay applied every frame (snaps back when idle)
const EASE             = 0.12; // smoothing for the shader uniform

// ====== SHADERS ======
// Vertex shader – warps the rectangle itself so the OUTLINE flexes.
// Positive uS ⇒ bulge outward. Negative uS ⇒ pinch inward.
const VERT = /* glsl */`
  uniform float uS;           // current scroll strength (-1…+1)
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;

    // Centered UV (‑0.5…+0.5) – defines radial direction
    vec2 c = vUv - 0.5;
    float r = length(c) * 1.414;      // √2≈1.414 maps corner to ~1.0

    // Bulge amount tapers to 0.0 at the edges; strongest in centre
    float amt = uS * (1.0 - r);

    // Radial displacement: push/pull along vec2 c direction
    pos.xy += c * amt;

    // OPTIONAL slight Z push for parallax depth (comment if not desired)
    // pos.z += abs(uS) * (1.0 - r) * 0.15;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// Fragment shader – retains original image‑space distortion so the texture ALSO warps.
const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uTex;
  uniform float uS;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv - 0.5;
    float d = length(uv);
    float strength = uS * 0.6;
    vec2 distorted = uv + uv * strength * (1.0 - d);
    vec3 color = texture2D(uTex, distorted + 0.5).rgb;
    gl_FragColor = vec4(color, 1.0);
  }
`;

// ====== CLASS ======
class BulgeEffect {
  constructor(el) {
    this.el = el;
    this.imgURL = el.dataset.img;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.style.position = 'relative';
    el.appendChild(this.renderer.domElement);

    // Scene / Camera
    this.scene  = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.camera.position.z = 2;

    // Geometry & material
    const geom = new THREE.PlaneGeometry(2, 2, PLANE_SEGMENTS, PLANE_SEGMENTS);
    const tex  = new THREE.TextureLoader().load(this.imgURL, () => this.render());

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: tex },
        uS:   { value: 0.0 }
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true
    });

    this.mesh = new THREE.Mesh(geom, this.material);
    this.scene.add(this.mesh);

    // Motion state
    this.vel  = 0.0; // scroll velocity
    this.curr = 0.0; // eased uniform value

    // Bindings
    this.onWheel  = this.onWheel.bind(this);
    this.onResize = this.onResize.bind(this);

    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('resize', this.onResize);

    this.onResize();
    this.animate();
  }

  // ---- Events ----
  onResize() {
    const { width, height } = this.el.getBoundingClientRect();
    this.renderer.setSize(width, height);
  }

  onWheel(e) {
    this.vel += e.deltaY * SCROLL_STRENGTH;
    // Clamp velocity to reasonable bounds
    this.vel = Math.max(Math.min(this.vel, 1), -1);
  }

  // ---- RAF ----
  animate() {
    requestAnimationFrame(() => this.animate());

    // Apply friction so effect snaps back when not scrolling
    this.vel *= FRICTION;

    // Ease shader uniform toward current velocity
    this.curr += (this.vel - this.curr) * EASE;
    this.material.uniforms.uS.value = this.curr;

    // Don't waste GPU if negligible movement
    if (Math.abs(this.curr) < 0.0001 && Math.abs(this.vel) < 0.0001) return;

    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// ====== INIT ======
function initBulgeEffects() {
  document.querySelectorAll('[data-bulge]').forEach(el => {
    if (!el._bulge) el._bulge = new BulgeEffect(el);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBulgeEffects);
} else {
  initBulgeEffects();
}
