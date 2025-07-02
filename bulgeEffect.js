// bulgeffect.js – fabric‑style bulge + pinch (FIXED outward bulge)
// Drop into your repo and load as a module in Webflow
//  <script type="module" src="https://cdn.jsdelivr.net/gh/USER/REPO/bulgeffect.js"></script>
//  <div data-bulge data-img="/path/to/image.jpg"></div>

import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';

// === CONFIG ===
const PLANE_SEGMENTS  = 32;   // mesh resolution (higher = smoother)
const SCROLL_STRENGTH = 0.003; // wheel delta → velocity scalar
const FRICTION        = 0.88; // 0‑1   (higher = snappier return)
const EASE            = 0.12; // uniform lerp smoothing

// === SHADERS ===
// Vertex shader — *new radial‑scale approach* so centre actually pushes OUT when uS>0.
const VERT = /* glsl */`
  uniform float uS;           // eased scroll strength (‑1…+1)
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;

    // Radial distance from centre, mapped so corner ≈1.0
    vec2  c = vUv - 0.5;
    float r = length(c) * 1.414;   // √2 → 1 at corners

    // Weight: 1 at centre, 0 at border (smooth fall‑off)
    float w = clamp(1.0 - r, 0.0, 1.0);

    // Scale positions about centre: bulge (uS>0) or pinch (uS<0)
    float scale = 1.0 + uS * w;
    pos.xy *= scale;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// Fragment shader — same as before; keeps texture warp synced with uS
const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uTex;
  uniform float uS;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv - 0.5;
    float d = length(uv);
    vec2 warped = uv + uv * uS * 0.6 * (1.0 - d);
    gl_FragColor = texture2D(uTex, warped + 0.5);
  }
`;

// === CLASS ===
class BulgeEffect {
  constructor(el) {
    this.el = el;
    this.imgURL = el.dataset.img;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.style.position = 'relative';
    el.appendChild(this.renderer.domElement);

    // Scene & camera
    this.scene  = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.camera.position.z = 2;

    // Geometry & material
    const geom = new THREE.PlaneGeometry(2, 2, PLANE_SEGMENTS, PLANE_SEGMENTS);
    const tex  = new THREE.TextureLoader().load(this.imgURL, () => this.render());

    this.material = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: tex }, uS: { value: 0.0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true
    });

    this.mesh = new THREE.Mesh(geom, this.material);
    this.scene.add(this.mesh);

    // Motion state
    this.vel  = 0.0; // scroll velocity accumulator
    this.curr = 0.0; // eased value sent to shader

    // Event bindings
    this.onWheel  = this.onWheel.bind(this);
    this.onResize = this.onResize.bind(this);

    window.addEventListener('wheel',   this.onWheel, { passive: true });
    window.addEventListener('resize',  this.onResize);

    this.onResize();
    this.animate();
  }

  // --- Events ---
  onResize() {
    const { width, height } = this.el.getBoundingClientRect();
    this.renderer.setSize(width, height);
  }

  onWheel(e) {
    this.vel += e.deltaY * SCROLL_STRENGTH;
    this.vel = Math.max(Math.min(this.vel, 1), -1); // clamp
  }

  // --- RAF loop ---
  animate() {
    requestAnimationFrame(() => this.animate());

    // Friction toward zero (snap‑back)
    this.vel *= FRICTION;

    // Ease uniform toward velocity
    this.curr += (this.vel - this.curr) * EASE;
    this.material.uniforms.uS.value = this.curr;

    // Only re‑render when something actually changed (micro‑optimisation)
    if (Math.abs(this.vel) < 0.0001 && Math.abs(this.curr) < 0.0001) return;
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// === INIT ===
function initBulges() {
  document.querySelectorAll('[data-bulge]').forEach(el => {
    if (!el._bulge) el._bulge = new BulgeEffect(el);
  });
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initBulges)
  : initBulges();
