// bulgeffect.js – drop this in your project root and import as a module in Webflow.
// It preserves the original scroll‑responsive bulge texture distortion and now ALSO bends
// the geometry itself so the rectangle flexes like fabric.
// USAGE (Webflow):
// 1. Upload this file to GitHub (same repo) and reference via a <script type="module" src="https://cdn.rawgit.com/USERNAME/bulgeffect/main/bulgeffect.js"></script>
// 2. Wrap any image in a div with data-bulge and set data-img="yourImageURL".
//    <div class="bulge" data-bulge data-img="/assets/hero.jpg"></div>
// 3. That´s it – the effect is modular & reusable. Works with any aspect ratio.

import * as THREE from 'https://unpkg.com/three@0.163.0/build/three.module.js';

// ====== CONFIG ======
const PLANE_SEGMENTS = 32;         // 32×32 grid – enough for smooth bend
const SCROLL_STRENGTH = 0.0025;    // tune how much each scroll wheel tick affects the bulge
const EASE = 0.085;                // how quickly the uniform eases toward the target value

// ====== SHADERS ======
const VERT = /* glsl */`
  uniform float uS;                 // scroll strength (‑1…+1)
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;

    // edgeInfluence: 1.0 at center, 0.0 at far corners
    float influenceX = 1.0 - abs(uv.x - 0.5) * 2.0;
    float influenceY = 1.0 - abs(uv.y - 0.5) * 2.0;
    float factor = clamp(min(influenceX, influenceY), 0.0, 1.0);

    // scale positions based on factor & scroll uniform (fabric bulge)
    float scale = 1.0 + uS * factor;
    pos.xy *= scale;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uTex;
  uniform float uS;
  varying vec2 vUv;
  void main() {
    // radial distortion for content
    vec2 uv = vUv - 0.5;
    float dist = length(uv);
    float strength = uS * 0.6;              // match vertex strength roughly
    vec2 distorted = uv + uv * strength * (1.0 - dist);
    vec3 color = texture2D(uTex, distorted + 0.5).rgb;
    gl_FragColor = vec4(color,1.0);
  }
`;

// ====== CLASS ======
class BulgeEffect {
  constructor(container) {
    this.el = container;
    this.imgURL = container.dataset.img;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.style.position = 'relative';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.camera.position.z = 2;

    // Geometry + subdivided grid
    const geom = new THREE.PlaneGeometry(2, 2, PLANE_SEGMENTS, PLANE_SEGMENTS);
    const tex = new THREE.TextureLoader().load(this.imgURL, () => this.render());

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

    // state
    this.targetS = 0;   // scroll target
    this.currS   = 0;   // eased value

    // bindings
    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.onResize.bind(this);

    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onResize);

    this.onResize();
    this.animate();
  }

  onResize() {
    const rect = this.el.getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height);
  }

  onScroll(e) {
    // Use wheel deltaY for direction-sensitive input (normalised)
    const delta = e.deltaY || (window.scrollY - (this.lastScrollY||0));
    this.lastScrollY = window.scrollY;
    this.targetS += delta * SCROLL_STRENGTH;
    // clamp the target to reasonable bounds to avoid runaway
    this.targetS = Math.max(Math.min(this.targetS, 1), -1);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    // ease current toward target
    this.currS += (this.targetS - this.currS) * EASE;
    this.material.uniforms.uS.value = this.currS;
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// ====== INIT ======
function initBulges() {
  document.querySelectorAll('[data-bulge]').forEach(el => {
    if (!el._bulge) el._bulge = new BulgeEffect(el);
  });
}

document.addEventListener('DOMContentLoaded', initBulges);
