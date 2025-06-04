/*  bulgeEffect.js  – scroll-direction edition  (2025-06-04 v5)
   ------------------------------------------------------------------
   Embed once per site:
   <script type="module"
           src="https://cdn.jsdelivr.net/gh/you/repo@SHA/bulgeEffect.js"></script>

   Webflow usage (duplicate freely):
   <div data-effect="bulge"
        data-src="/images/photo.jpg"
        data-sens="0.004"          <!-- optional; default 0.003 -->
        style="width:100%;height:400px"></div>
   ------------------------------------------------------------------ */

const VS = `#version 300 es
precision mediump float;
in  vec3 aVertexPosition;
in  vec2 aTextureCoord;
out vec2 vUV;
uniform float uAmt;         // −1 → pinch  |  +1 → bulge
uniform vec2  uRes;
float ease(float t){return t<.5?2.*t*t:(-1.+(4.-2.*t)*t);}
vec3 warp(vec3 p){
  float asp = uRes.x/uRes.y;
  vec2  v   = p.xy*vec2(asp,1.);
  float d   = length(v);
  float f   = ease(clamp(1.-d*1.4,0.,1.)) * uAmt * 1.4;
  p.xy += p.xy * f;
  p.z  -= f;
  return p;
}
void main(){
  vUV = aTextureCoord;
  gl_Position = vec4(warp(aVertexPosition),1.);
}`;

const FS = `#version 300 es
precision mediump float;
in  vec2 vUV;
uniform sampler2D uTex;
out vec4 color;
void main(){
  vec2 uv = vec2(vUV.x,1.-vUV.y);   // flip once, forever :)
  color   = texture(uTex,uv);
}`;

const Q   =(s,c=document)=>c.querySelectorAll(s);
const load=s=>new Promise((r,j)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=_=>r(i);i.onerror=j;i.src=s;});
const sh  =(g,t,s)=>{const o=g.createShader(t);g.shaderSource(o,s);g.compileShader(o);if(!g.getShaderParameter(o,g.COMPILE_STATUS))throw g.getShaderInfoLog(o);return o;};
const pg  =(g,v,f)=>{const p=g.createProgram();g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw g.getProgramInfoLog(p);return p;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

async function init(el){
  const src  = el.dataset.src;   if(!src) {console.warn('[bulge] missing data-src');return;}
  const sens = parseFloat(el.dataset.sens||'0.003');   // wheel-to-amount
  const img  = await load(src);
  const cvs  = Object.assign(document.createElement('canvas'),{width:img.width,height:img.height});
  Object.assign(cvs.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:'-1'});
  el.style.position = el.style.position||'relative';
  el.appendChild(cvs);

  const gl = cvs.getContext('webgl2'); if(!gl){console.warn('[bulge] WebGL2 unavailable');return;}
  const prog = pg(gl, sh(gl,gl.VERTEX_SHADER,VS), sh(gl,gl.FRAGMENT_SHADER,FS));
  gl.useProgram(prog);

  // geometry
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
    -1,-1,0, 0,0,   1,-1,0, 1,0,
    -1, 1,0, 0,1,   1, 1,0, 1,1,
  ]),gl.STATIC_DRAW);
  const stride=5*4;
  const posLoc=gl.getAttribLocation(prog,'aVertexPosition');
  const uvLoc =gl.getAttribLocation(prog,'aTextureCoord');
  gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,stride,0);
  gl.enableVertexAttribArray(uvLoc ); gl.vertexAttribPointer(uvLoc ,2,gl.FLOAT,false,stride,12);

  // texture
  const tex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);

  // uniforms
  gl.uniform1i(gl.getUniformLocation(prog,'uTex'),0);
  gl.uniform2f(gl.getUniformLocation(prog,'uRes'),cvs.width,cvs.height);
  const uAmt=gl.getUniformLocation(prog,'uAmt');

  let amt = 0;
  window.addEventListener('wheel',e=>{
    amt += -e.deltaY * sens;        // wheel up (negative deltaY) → +amt (bulge)
    amt  = clamp(amt,-1,1);
  },{passive:true});

  function draw(){
    amt *= 0.92;                    // friction so it eases back
    gl.viewport(0,0,cvs.width,cvs.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uAmt,amt);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    requestAnimationFrame(draw);
  }
  draw();
}

window.addEventListener('DOMContentLoaded',()=>Q('[data-effect="bulge"]').forEach(init));
