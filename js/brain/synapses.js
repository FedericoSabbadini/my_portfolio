/* =========================================================================
   synapses.js — biologically-plausible neural firing.
   Pulses are BORN at a surface point, PROPAGATE along a short synaptic edge
   (arcing just above the cortex), FADE with a soft envelope, then either
   BRANCH to a neighbour (chaining) or DISAPPEAR and RE-EMERGE elsewhere.
   Rendered as additive sprites that occlude behind the brain mesh.
   ========================================================================= */
import * as THREE from 'three';

const VERT = /* glsl */`
  attribute float aAlpha;
  attribute float aSize;
  attribute float aWarm;
  uniform float uPr;
  varying float vA;
  varying float vWarm;
  void main() {
    vA = aAlpha;
    vWarm = aWarm;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPr * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */`
  precision mediump float;
  varying float vA;
  varying float vWarm;
  uniform vec3 uColor;
  uniform vec3 uHot;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;
    // soft outer halo + a tight incandescent core that whites out at the peak
    float halo = smoothstep(0.5, 0.0, r);
    float core = smoothstep(0.20, 0.0, r);
    float spark = smoothstep(0.06, 0.0, r);
    vec3 tint = mix(uColor, uHot, vWarm);
    vec3 c = tint * halo + tint * core * 1.2 + vec3(spark) * (0.5 + 0.5 * vA);
    float a = (halo * 0.32 + core * 0.8 + spark) * vA;
    gl_FragColor = vec4(c, a);
  }
`;

export class Synapses {
  /**
   * @param {Float32Array} surface flat xyz of all mesh verts
   * @param {{idx:number[], adj:number[][]}} sg synaptic graph (local indices)
   * @param {number} n number of simultaneous pulses
   */
  constructor(surface, sg, n = 70) {
    this.surface = surface;
    this.idx = sg.idx;
    this.adj = sg.adj;
    this.n = n;

    this.from = new Int32Array(n);   // local index
    this.to = new Int32Array(n);
    this.t = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.life = new Float32Array(n);
    this.arc = new Float32Array(n);

    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3);
    this.alpha = new Float32Array(n);
    this.size = new Float32Array(n);
    this.warm = new Float32Array(n);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aWarm', new THREE.BufferAttribute(this.warm, 1));

    this.uniforms = {
      uPr: { value: 1 },
      uColor: { value: new THREE.Color(0x7fe0ff) },
      uHot: { value: new THREE.Color(0xecfbff) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;

    for (let i = 0; i < n; i++) this._spawn(i, (Math.random() * this.idx.length) | 0);
  }

  _spawn(i, li) {
    const neighbours = this.adj[li];
    if (!neighbours || !neighbours.length) { this._spawn(i, (Math.random() * this.idx.length) | 0); return; }
    this.from[i] = li;
    this.to[i] = neighbours[(Math.random() * neighbours.length) | 0];
    this.t[i] = 0;
    this.speed[i] = 0.55 + Math.random() * 1.2;
    this.life[i] = 0.55 + Math.random() * 0.9;      // sizes brightness
    this.arc[i] = 0.02 + Math.random() * 0.05;
    this.warm[i] = Math.random() < 0.3 ? 0.6 + Math.random() * 0.4 : Math.random() * 0.3;
  }

  update(dt, activity = 0) {
    const spd = 1 + activity * 1.4;
    const s = this.surface;
    for (let i = 0; i < this.n; i++) {
      this.t[i] += dt * this.speed[i] * spd;
      if (this.t[i] >= 1) {
        // branch (chain onward) or re-emerge elsewhere
        if (Math.random() < 0.55) this._spawn(i, this.to[i]);
        else this._spawn(i, (Math.random() * this.idx.length) | 0);
      }
      const t = this.t[i];
      const a = this.idx[this.from[i]] * 3;
      const b = this.idx[this.to[i]] * 3;
      let x = s[a] + (s[b] - s[a]) * t;
      let y = s[a + 1] + (s[b + 1] - s[a + 1]) * t;
      let z = s[a + 2] + (s[b + 2] - s[a + 2]) * t;
      // arc outward along the surface normal (≈ position direction)
      const len = Math.hypot(x, y, z) || 1;
      const lift = this.arc[i] * Math.sin(Math.PI * t);
      x += (x / len) * lift; y += (y / len) * lift; z += (z / len) * lift;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      // action-potential envelope: a quick bright flash after birth that
      // tapers away — front-loaded so it reads as a spark, not a blob.
      const env = Math.pow(Math.sin(Math.PI * t), 1.6);
      const flash = Math.exp(-t * 3.0) * 0.5;             // ignition burst
      this.alpha[i] = Math.min(1, (env + flash)) * this.life[i] * (0.5 + activity * 0.5);
      this.size[i] = 0.05 + this.life[i] * 0.07 + flash * 0.05;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aWarm.needsUpdate = true;
  }

  dispose() { this.points.geometry.dispose(); this.points.material.dispose(); }
}
