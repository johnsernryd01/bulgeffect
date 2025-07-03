// bulgeffect.js – v3.1  (GLSL compile‑safe, visible OUTWARD bulge)
// – Removed vec2/float mixup that blanked the canvas
// – Added safe normalize() guard
// – Slightly smaller AMPLITUDE so mesh stays in view
// Usage identical: <div data-bulge data-img="..."></div>

import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';

// === CONFIG ===
const PLANE_SEGMENTS  = 40;     // grid density for outline smoothness
const SCROLL_STRENGTH = 0.003;  // wheel delta multiplier
const FRICTION        = 0.88;   // snap‑back speed (0–1)
const EASE            = 0.12;   // uniform smoothing
const AMPLITUDE       = 0.20;   // max radial offset in clip‑space units

// === SHADERS ===
const VERT = /* glsl */`
  uniform float uS;           // eased scroll velocity (−1…+1)
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;

    // Radial coords centred at 0,0  (range −0.5 … +0.5)
    vec2 c = vUv - 0.5;
    float r = length(c);

    // Weight fades to 0 at corners (√0.5 ≈ 0.707). Scale r so r=1 at corner.
    float w = clamp(1.0 - r * 1.414, 0.0, 1.0);

    // Outward direction; safe normalise (returns 0,0 when r=0)
    vec2 dir = (r > 0.00001) ? normalize(c) : vec2(0.0);

    // Apply radial displacement
    pos.xy += dir * uS * w * AMPLITUDE;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uTex;
  uniform float uS;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv - 0.5;
    float d = length(uv);
    vec2 warped = uv + uv * uS * 0.5 * (1.0 - d);
    gl_FragColor = texture2D(uTex, warped + 0.5);
  }
`;

// === CLASS ===
class BulgeEffect {
  constructor(el) {
    this.el     = el;
    this.imgURL = el.dataset.img;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.style.position = 'relative';
    el.appendChild(this.renderer.domElement);

    // Scene & camera
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
    this.vel  = 0.0; // raw velocity
    this.curr = 0.0; // eased uniform value

    // Events
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

    this.vel *= FRICTION;                       // decay toward 0
    this.curr += (this.vel - this.curr) * EASE; // ease
    this.material.uniforms.uS.value = this.curr;

    if (Math.abs(this.vel) > 0.0001 || Math.abs(this.curr) > 0.0001) this.render();
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

// === INIT ===
function initBulgeEffects() {
  document.querySelectorAll('[data-bulge]').forEach(el => {
    if (!el._bulge) el._bulge = new BulgeEffect(el);
  });
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initBulgeEffects)
  : initBulgeEffects();
