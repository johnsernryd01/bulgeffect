// bulgeEffect.js  — wheel-based pinching/bulging
// -------------------------------------------------------------
// <script type="module" src="…/bulgeEffect.js?v=10"></script>
// <div data-effect="bulge" data-src="/images/photo.jpg"></div>
// -------------------------------------------------------------

// --- GLSL -----------------------------------------------------
const VS = `#version 300 es
precision mediump float;
in  vec3 aVertexPosition;
in  vec2 aTextureCoord;
out vec2 vUV;
uniform float uAmt;           // −1 .. +1 (pinch .. bulge)
uniform vec2  uRes;
float ease(float t){return t<.5?2.*t*t:(-1.+(4.-2.*t)*t);}
vec3 warp(vec3 p){
  float aspect=uRes.x/uRes.y;
  vec2  v=p.xy*vec2(aspect,1.0);
  float d=length(v);
  float t=clamp(1.0-d*1.4,0.,1.);
  float f=ease(t)*uAmt*1.5;
  p.xy+=p.xy*f;
  p.z -=f;
  return p;
}
void main(){
  vec3 pos=warp(aVertexPosition);
  vUV = aTextureCoord;
  gl_Position=vec4(pos,1.);
}`;

const FS = `#version 300 es
precision mediump float;
in  vec2 vUV;
uniform sampler2D uTex;
out vec4 color;
void main(){
  vec2 uv=vec2(vUV.x,1.-vUV.y);
  color = texture(uTex,uv);
}`;

// --- tiny helpers --------------------------------------------
const qs=(s,c=document)=>c.querySelectorAll(s);
const load=i=>new Promise((r,e)=>{const m=new Image();m.crossOrigin='anonymous';m.onload=_=>r(m);m.onerror=e;m.src=i;});
const sh =(g,t,s)=>{const o=g.createShader(t);g.shaderSource(o,s);g.compileShader(o);if(!g.getShaderParameter(o,g.COMPILE_STATUS))throw g.getShaderInfoLog(o);return o;};
const pg =(g,v,f)=>{const p=g.createProgram();g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw g.getProgramInfoLog(p);return p;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// --- main -----------------------------------------------------
async function init(div){
  const src=div.dataset.src;if(!src)return console.warn('[bulge] missing data-src');
  const img=await load(src);

  const cv=document.createElement('canvas');
  cv.width=img.width;cv.height=img.height;
  Object.assign(cv.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:'-1'});
  div.style.position=div.style.position||'relative';
  div.appendChild(cv);

  const gl=cv.getContext('webgl2');if(!gl)return;
  const prog=pg(gl,sh(gl,35633,VS),sh(gl,35632,FS)); // 35633=VERTEX, 35632=FRAG
  gl.useProgram(prog);

  // quad
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,0,0,0, 1,-1,0,1,0, -1,1,0,0,1, 1,1,0,1,1]),gl.STATIC_DRAW);
  const STR=5*4;
  const posL=gl.getAttribLocation(prog,'aVertexPosition');
  const uvL =gl.getAttribLocation(prog,'aTextureCoord');
  gl.enableVertexAttribArray(posL);gl.vertexAttribPointer(posL,3,gl.FLOAT,false,STR,0);
  gl.enableVertexAttribArray(uvL );gl.vertexAttribPointer(uvL ,2,gl.FLOAT,false,STR,12);

  // texture
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.uniform1i(gl.getUniformLocation(prog,'uTex'),0);
  gl.uniform2f(gl.getUniformLocation(prog,'uRes'),cv.width,cv.height);
  const uAmt=gl.getUniformLocation(prog,'uAmt');

  // state
  let amt=0;

  // wheel listener (positive deltaY → pinch / negative → bulge)
  window.addEventListener('wheel',e=>{
    amt+=(-e.deltaY)*0.0005; // tune sensitivity here
    amt=clamp(amt,-1,1);
  },{passive:true});

  // animate
  function draw(){
    amt*=0.92; // ease back to 0
    gl.viewport(0,0,cv.width,cv.height);
    gl.uniform1f(uAmt,amt);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    requestAnimationFrame(draw);
  }
  draw();
}

window.addEventListener('DOMContentLoaded',()=>qs('[data-effect="bulge"]').forEach(init));
