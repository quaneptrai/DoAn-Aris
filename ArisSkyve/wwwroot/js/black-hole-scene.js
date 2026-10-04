/* Black Hole UI — no dependencies. Generated cinematic plate + animated WebGL light. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.customElements || customElements.get('black-hole-scene')) return;

  const vertex = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * .5 + .5;
      gl_Position = vec4(aPosition, 0., 1.);
    }
  `;

  const fragment = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uPlate;
    uniform vec2 uResolution;
    uniform float uAspect;
    uniform float uTime;
    uniform float uMotion;
    uniform float uGlow;
    uniform float uScale;
    uniform vec2 uPointer;
    uniform float uInteraction;
    const float TAU = 6.28318530718;

    vec3 plate(vec2 uv) {
      return texture2D(uPlate, clamp(uv, vec2(.001), vec2(.999))).rgb;
    }
    float luminance(vec3 c) { return dot(c, vec3(.2126,.7152,.0722)); }

    void main() {
      // The actual shadow in this artwork is offset slightly from the image center.
      // Recenter the *shadow*, not merely the rectangular image, on the viewport.
      vec2 focal = vec2(.486, .531);
      float screenAspect = uResolution.x / uResolution.y;
      vec2 uv = (vUv - .5) / uScale;
      if (screenAspect < uAspect) uv.x *= screenAspect / uAspect;
      else uv.y *= uAspect / screenAspect;
      uv += focal;
      vec2 q = (uv - focal) * vec2(uAspect, 1.);
      float r = length(q);
      float angle = atan(q.y, q.x);
      float phase = TAU * uTime / 14.; /* faster orbital read */

      // Separate the foreground disk from the lensed arcs. Nothing is rotated
      // as a flat rectangular image, and the black shadow remains stable.
      float diskLine = q.y + .066 - .009 * q.x;
      float disk = exp(-pow(diskLine / .081, 2.));
      float wideDisk = exp(-pow(diskLine / .135, 2.));
      float arc = smoothstep(.251, .278, r) * (1. - smoothstep(.47,.58,r));
      arc *= 1. - disk * .86;
      float shadow = 1. - smoothstep(.248,.269,r);
      float mask = max(disk * .90, arc);
      mask *= 1. - shadow * (1. - wideDisk);
      vec3 original = plate(uv);
      float lit = smoothstep(.023,.42,luminance(original));

      // A periodic, spatially varying advection field: 24 second seamless loop.
      float ribbons = sin(angle * 9. + r * 97. - phase)
                    + .40 * sin(angle * 19. - r * 143. + phase * 2.);
      vec2 tangent = vec2(-q.y, q.x) / max(r,.001);
      vec2 arcFlow = tangent * (.0048 * sin(phase + r * 43.) + .0024 * sin(phase * 2. + angle * 4.));
      arcFlow += q / max(r,.001) * .00026 * ribbons;
      vec2 diskFlow = vec2(
          .0068 * sin(phase + q.y * 117. + q.x * 3.)
          + .0032 * sin(phase * 2. - q.x * 11. + q.y * 53.)
          + .0045 * cos(phase * 1.5 + q.x * 8.),
          .0024 * sin(q.x * 36. - phase * 2. + q.y * 74.)
          + .0018 * cos(phase + q.y * 42.)
        );
        /* orbital swirl around shadow */
        diskFlow += tangent * (.0055 * sin(phase * 1.2 + r * 18.) + .0025 * cos(phase * 2.1));
      vec2 flow = (arcFlow * arc + diskFlow * disk) / vec2(uAspect, 1.);
      flow *= uMotion * (.15 + .85 * lit) * mask;
      vec3 color = plate(uv + flow);

      // Traveling illumination is confined to hot filaments, not the background.
      float arcWave = sin(angle * 5. - phase + r * 83.) * .038
                    + sin(angle * 13. + phase * 2. - r * 61.) * .018;
      float diskWave = sin(q.x * 19. - phase * 2. + q.y * 87.) * .047
                     + sin(q.x * 37. + phase * 3. + q.y * 152.) * .022;
      float wave = (arcWave * arc + diskWave * disk) * lit * uMotion;
      color *= 1. + wave;

      // Keep the black shadow stable while light on the lensing ring follows
      // the pointer. This adds depth without rotating the source plate.
      vec2 pointerDirection = normalize(vec2(uPointer.x * uAspect, -uPointer.y) + vec2(.0001));
      vec2 radialDirection = normalize(q + vec2(.0001));
      float pointerArc = pow(max(0., dot(pointerDirection, radialDirection)), 7.);
      pointerArc *= arc * lit * uInteraction;
      color += vec3(1., .58, .25) * pointerArc * .085;

      // Minute warm glints follow the existing disk structure.
      float filaments = pow(max(0., sin(q.x * 101. + q.y * 419.
                         + sin(q.x * 27.) * 2. - phase * 2.)), 14.);
      float glints = filaments * disk * lit * .019 * uMotion;
      color += vec3(1., .63, .31) * glints;

      // Tiny, local light spread only. The plate already contains cinematic bloom.
      vec2 px = 1. / vec2(1672., 941.);
      vec3 spread = plate(uv + flow + px * vec2(2.,0.))
                  + plate(uv + flow - px * vec2(2.,0.))
                  + plate(uv + flow + px * vec2(0.,2.))
                  + plate(uv + flow - px * vec2(0.,2.));
      spread *= .25;
      color += max(spread - .67, 0.) * .055 * uGlow * mask;
      color *= 1. + (uGlow - 1.) * .23 * lit;

      // Fade only if an extreme aspect ratio shows the outside of the artwork.
      float edge = smoothstep(0.,.02,uv.x) * (1.-smoothstep(.98,1.,uv.x))
                 * smoothstep(0.,.02,uv.y) * (1.-smoothstep(.98,1.,uv.y));
      gl_FragColor = vec4(color * edge, 1.);
    }
  `;

  class BlackHoleScene extends HTMLElement {
    static get observedAttributes() { return ['src','speed','motion','glow','scale','paused']; }
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `
        <style>
          :host{display:block;position:relative;width:100%;height:100%;min-height:1px;background:#030303;overflow:hidden;isolation:isolate;contain:layout paint}
          canvas,img{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
          img{object-fit:cover;object-position:48.6% 46.9%}
          canvas{opacity:0} canvas.ready{opacity:1}
          :host([hidden]){display:none}
        </style>
        <img alt="Hố đen lớn giữa màn hình, đĩa bồi tụ màu vàng trắng và các cung sáng bao quanh." draggable="false">
        <canvas role="img" aria-label="Hố đen điện ảnh với các dải sáng chuyển động nhẹ"></canvas>`;
      this.canvas = this.shadowRoot.querySelector('canvas');
      this.fallback = this.shadowRoot.querySelector('img');
      this.ready = false;
      this._time = 0;
      this._last = 0;
      this._raf = 0;
      this._manual = false;
      this._loadId = 0;
      this._pointerX = 0;
      this._pointerY = 0;
      this._interaction = 0;
      this._tick = this._tick.bind(this);
      this._onVisibility = () => {
        this._last = 0;
        if (document.hidden) this._cancel(); else this._start();
      };
      this._onLost = e => {
        e.preventDefault();
        this._cancel();
        this.ready = false;
        this.canvas.classList.remove('ready');
      };
      this._onRestored = () => { this._init(); this._load(); };
    }
    connectedCallback() {
      this._active = true;
      this.canvas.addEventListener('webglcontextlost', this._onLost);
      this.canvas.addEventListener('webglcontextrestored', this._onRestored);
      document.addEventListener('visibilitychange', this._onVisibility);
      this._observer = new ResizeObserver(() => this._resize());
      this._observer.observe(this);
      try { this._init(); this._load(); }
      catch (error) { this._fail(error); }
    }
    disconnectedCallback() {
      this._active = false;
      this._loadId++;
      this._cancel();
      this._observer?.disconnect();
      document.removeEventListener('visibilitychange', this._onVisibility);
      this.canvas.removeEventListener('webglcontextlost', this._onLost);
      this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
      const gl = this.gl;
      if (gl) {
        gl.deleteTexture(this.texture);
        gl.deleteBuffer(this.buffer);
        gl.deleteProgram(this.program);
      }
      this.ready = false;
      this.canvas.classList.remove('ready');
    }
    attributeChangedCallback(name, oldValue, value) {
      if (oldValue === value || !this._active) return;
      if (name === 'src') { this._load(); return; }
      if (name === 'paused') {
        this._last = 0;
        if (this.paused) this._cancel(); else this._start();
      }
      if (this.ready) this.renderAt(this._time);
    }
    _number(name, fallback, min, max) {
      if (!this.hasAttribute(name)) return fallback;
      const n = Number(this.getAttribute(name));
      return Number.isFinite(n) ? Math.min(max,Math.max(min,n)) : fallback;
    }
    _init() {
      const gl = this.canvas.getContext('webgl', {
        alpha:false, antialias:true, depth:false, stencil:false,
        preserveDrawingBuffer:true, powerPreference:'high-performance'
      });
      if (!gl) throw new Error('WebGL unavailable; displaying the still artwork.');
      this.gl = gl;
      function shader(type,source) {
        const s = gl.createShader(type);
        gl.shaderSource(s,source); gl.compileShader(s);
        if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) {
          const message = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(message);
        }
        return s;
      }
      const vs=shader(gl.VERTEX_SHADER,vertex), fs=shader(gl.FRAGMENT_SHADER,fragment);
      this.program=gl.createProgram();
      gl.attachShader(this.program,vs); gl.attachShader(this.program,fs);
      gl.linkProgram(this.program); gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
      gl.useProgram(this.program);
      this.buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]),gl.STATIC_DRAW);
      const position=gl.getAttribLocation(this.program,'aPosition');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      this.uniforms={};
      for(const name of ['uPlate','uResolution','uAspect','uTime','uMotion','uGlow','uScale','uPointer','uInteraction']) this.uniforms[name]=gl.getUniformLocation(this.program,name);
      this.texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      this._resize();
    }
    _load() {
      const src=this.getAttribute('src');
      if (!src) return;
      this.fallback.src=src;
      if (!this.gl) return;
      const token=++this._loadId;
      const image=new Image(); image.crossOrigin='anonymous';
      image.onload=()=>{
        if (!this._active || token!==this._loadId) return;
        try {
          const gl=this.gl;
          gl.bindTexture(gl.TEXTURE_2D,this.texture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
          this._aspect=image.naturalWidth/image.naturalHeight;
          this.ready=true;
          this.renderAt(this._time);
          this.canvas.classList.add('ready');
          this.dispatchEvent(new CustomEvent('scene-ready',{bubbles:true,detail:{width:image.naturalWidth,height:image.naturalHeight,renderer:'webgl-hybrid'}}));
          this._start();
        } catch(error) { this._fail(error); }
      };
      image.onerror=()=>this._fail(new Error('Could not load the scene image.'));
      image.src=src;
    }
    _fail(error) {
      this._cancel(); this.ready=false;
      this.canvas.classList.remove('ready');
      const src=this.getAttribute('src'); if(src) this.fallback.src=src;
      this.dispatchEvent(new CustomEvent('scene-error',{bubbles:true,detail:{message:error.message}}));
    }
    _resize() {
      const rect=this.getBoundingClientRect();
      const ratio=window.devicePixelRatio || 1;
      const w=Math.max(1,Math.round(rect.width*ratio)), h=Math.max(1,Math.round(rect.height*ratio));
      if(this.canvas.width!==w || this.canvas.height!==h) {this.canvas.width=w;this.canvas.height=h;}
      if(this.gl) this.gl.viewport(0,0,w,h);
      if(this.ready) this.renderAt(this._time);
    }
    renderAt(seconds) {
      if(!this.ready) return;
      const gl=this.gl, u=this.uniforms;
      gl.useProgram(this.program);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.uniform1i(u.uPlate,0);
      gl.uniform2f(u.uResolution,this.canvas.width,this.canvas.height);
      gl.uniform1f(u.uAspect,this._aspect);
      gl.uniform1f(u.uTime,seconds);
      gl.uniform1f(u.uMotion,this._number('motion',1,0,3));
      gl.uniform1f(u.uGlow,this._number('glow',1,0,3));
      gl.uniform1f(u.uScale,this._number('scale',1,0.5,2));
      gl.uniform2f(u.uPointer,this._pointerX,this._pointerY);
      gl.uniform1f(u.uInteraction,this._interaction);
      gl.drawArrays(gl.TRIANGLES,0,6);
    }
    _tick(now) {
      this._raf=0;
      if(!this.ready || this.paused || document.hidden || this._manual || !this._active) return;
      if(this._last) this._time+=(now-this._last)/1000*this._number('speed',1,0,4);
      this._last=now;
      this.renderAt(this._time);
      this._raf=requestAnimationFrame(this._tick);
    }
    _cancel() { cancelAnimationFrame(this._raf); this._raf=0; this._last=0; }
    _start() {
      if(this.ready && !this.paused && !document.hidden && !this._manual && !this._raf && this._active) this._raf=requestAnimationFrame(this._tick);
    }
    get paused() { return this.hasAttribute('paused'); }
    pause() { this.setAttribute('paused',''); }
    play() { this._manual=false; this.removeAttribute('paused'); this._start(); }
    seek(seconds) { this._manual=true; this._cancel(); this._time=Math.max(0,Number(seconds)||0); this.renderAt(this._time); }
    setPointer(x, y, strength = 1) {
      this._pointerX=Math.max(-1,Math.min(1,Number(x)||0));
      this._pointerY=Math.max(-1,Math.min(1,Number(y)||0));
      this._interaction=Math.max(0,Math.min(1,Number(strength)||0));
      this.renderAt(this._time);
    }
    get currentTime() { return this._time; }
    get renderer() { return this.ready?'webgl-hybrid':'still-fallback'; }
  }
  customElements.define('black-hole-scene',BlackHoleScene);
})();
