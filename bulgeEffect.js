// bulgeffect.js – v3 (radial displacement fix)
// Fabric‑style bulge now visibly pushes OUT; pinch still pulls in.

import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';

// ===== CONFIG =====
const PLANE_SEGMENTS  = 40;    // finer grid for smoother curve
const SCROLL_STRENGTH = 0.003; // wheel delta multiplier
const FRICTION        = 0.88;  // snap‑back rate
const EASE            = 0.12;  // uniform easing
const AMPLITUDE       = 0.25;  // max outward offset in clip‑space units (0‑1)

// ===== SHADERS =====
// Vertex shader – true radial displacement. Centre stays, everything else moves
// along its own outward normal so the outline visibly bows.
const VERT = /* glsl */`
  uniform float uS;           // eased velocity (−1 … +1)
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;      // plane vertex −1…+1 after modelViewMatrix

    // UV centre‑based coords (−.5…+.5)
    vec2 c = vUv - 0.5;
    float r = length(c);

    // Weight fades to 0 at ~corner radius .707 (half‑diagonal)
    float w = clamp(1.0 - r * 1.42, 0.0, 1.0); // corners get 0, centre 1
    vec2 dir = normalize(c + 1e-6);           // outward unit vector

    // Radial offset – positive uS pushes out, negative pulls in
    pos.xy += dir * uS * w * AMPLITUDE;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// Fragment shader – same radial warp for texture for consistency
const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uTex;
  uniform float uS;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv - 0.5;
    float d = length(uv);
    vec2 warped = uv + uv * uS * 0.55 * (1.0 - d);
    gl_FragColor = texture2D(uTex, warped + 0.5);
  }
`;

// ===== CLASS =====
class BulgeEffect {
  constructor(el) {
    this.el = el;
    this.imgURL = el.dataset.img;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.style.position = 'relative';
    el.appendChild(this.renderer.domElement);

    // Scene & camera (slightly larger frustum for overshoot)
    this.scene  = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1.2, 1.2, 1.2, -1.2, 0, 10);
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
    this.vel  = 0.0;
    this.curr = 0.0;

    // Event bindings
    window.addEventListener('wheel',  e => this.onWheel(e), { passive: true });
    window.addEventListener('resize', () => this.onResize());

    this.onResize();
    this.animate();
  }

  // --- Handlers ---
  onResize() {
    const { width, height } = this.el.getBoundingClientRect();
    this.renderer.setSize(width, height);
  }

  onWheel(e) {
    this.vel += e.deltaY * SCROLL_STRENGTH;
    this.vel = Math.max(Math.min(this.vel, 1), -1);
  }

  // --- RAF loop ---
  animate() {
    requestAnimationFrame(() => this.animate());

    // Decay velocity → snap back
    this.vel *= FRICTION;

    // Ease toward current velocity
    this.curr += (this.vel - this.curr) * EASE;
    this.material.uniforms.uS.value = this.curr;

    // Redraw when active
    if (Math.abs(this.vel) > 0.0001 || Math.abs(this.curr) > 0.0001) {
      this.render();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// ===== INIT =====
function initBulgeEffects() {
  document.querySelectorAll('[data-bulge]').forEach(el => {
    if (!el._bulge) el._bulge = new BulgeEffect(el);
  });
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initBulgeEffects)
  : initBulgeEffects();
