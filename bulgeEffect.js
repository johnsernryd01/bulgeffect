// bulgeEffect.js — updated to only distort on scroll and confirm scroll reads

import { mat4 } from 'https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/esm/index.js';

const vertexShaderSource = `#version 300 es
precision mediump float;
in vec3 aVertexPosition;
in vec2 aTextureCoord;

out vec2 vTextureCoord;
out vec3 vVertexPosition;
out float zPos;

uniform sampler2D uTexture;
uniform float uAmount;
uniform vec2 uResolution;

float ease(int easingFunc, float t) {
    return t < 0.5 ? 2.0 * t * t : -1.0 + (4.0 - 2.0 * t) * t;
}

float bezier(float t) {
    return ease(3, t);
}

mat2 rot(float a) {
    return mat2(cos(a), -sin(a), sin(a), cos(a));
}

vec3 bulge(vec3 pos) {
    vec2 aspectRatio = vec2(uResolution.x/uResolution.y, 1.);
    vec2 mousePosAdjusted = vec2(0.);
    mat2 rotation = rot(0.4995 * 2. * 3.14159);

    float dist = distance(pos.xy * aspectRatio * rotation, mousePosAdjusted * aspectRatio * rotation);
    float t = max(0., 1. - dist/1.4280);
    float bulge = bezier(t) * (uAmount - 0.5);
    bulge = min(1., bulge);
    pos.xy += bulge * pos.xy;
    pos.z -= bulge;
    return pos;
}

void main() {
    vec3 pos = bulge(aVertexPosition);
    vec3 pos_dx = bulge(aVertexPosition + vec3(0.01, 0.0, 0.0));
    vec3 pos_dy = bulge(aVertexPosition + vec3(0.0, 0.01, 0.0));
    vec3 dx = pos_dx - pos;
    vec3 dy = pos_dy - pos;
    vec3 normal = normalize(cross(dx, dy));

    vVertexPosition = normal;
    zPos = pos.z;
    gl_Position = vec4(pos, 1.0);
    vTextureCoord = aTextureCoord;
}`;

const fragmentShaderSource = `#version 300 es
precision mediump float;
in vec2 vTextureCoord;
in vec3 vVertexPosition;
in float zPos;

uniform sampler2D uTexture;

out vec4 fragColor;

float random(vec2 seed) {
    return fract(sin(dot(seed.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = vec2(vTextureCoord.x, 1.0 - vTextureCoord.y); // Manual vertical flip
    vec4 color = texture(uTexture, uv);
    float intensity = 0.375;
    float rad = 0.5 * -2. * 3.14159;
    vec2 rotatedLightPosition = vec2(cos(rad), sin(rad));
    vec3 lightPosition = vec3(vec2(0.5) * rotatedLightPosition * 2., 1.0);
    float diff = max(dot(normalize(vVertexPosition), lightPosition), 0.0);

    color.rgb += (diff * intensity - intensity);
    float dither = (random(gl_FragCoord.xy) - 0.5) / 255.0;
    color.rgb += dither;
    fragColor = color;
}`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(gl, vShader, fShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  return program;
}

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

async function initBulgeEffect(canvas, imageUrl, scrollSensitivity = 0.25) {
  const gl = canvas.getContext('webgl2');
  if (!gl) return;

  const vShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = createProgram(gl, vShader, fShader);
  gl.useProgram(program);

  const img = await loadImage(imageUrl);
  canvas.width = img.width;
  canvas.height = img.height;

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);

  const posLoc = gl.getAttribLocation(program, 'aVertexPosition');
  const uvLoc = gl.getAttribLocation(program, 'aTextureCoord');

  const verts = new Float32Array([
    -1, -1, 0, 0, 0,
     1, -1, 0, 1, 0,
    -1,  1, 0, 0, 1,
     1,  1, 0, 1, 1,
  ]);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 20, 12);

  const uTexture = gl.getUniformLocation(program, 'uTexture');
  const uAmount = gl.getUniformLocation(program, 'uAmount');
  const uResolution = gl.getUniformLocation(program, 'uResolution');

  function render() {
    const scrollY = window.scrollY;
    const amount = Math.min(1.0, scrollY * scrollSensitivity * 0.01);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1i(uTexture, 0);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uAmount, amount);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  window.addEventListener('scroll', () => {
    requestAnimationFrame(render);
  });

  render();
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-effect="bulge"]').forEach(el => {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = -1;
    el.style.position = 'relative';
    el.appendChild(canvas);

    const src = el.dataset.src;
    const scrollFactor = parseFloat(el.dataset.scroll || '0.25');
    initBulgeEffect(canvas, src, scrollFactor);
  });
});
