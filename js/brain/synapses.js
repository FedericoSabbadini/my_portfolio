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
  uniform float uPr;
  varying float vA;
  void main() {
    vA = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPr * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */`
  precision mediump float;
  varying float vA;
  uniform vec3 uColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;
    float halo = smoothstep(0.5, 0.0, r);
    float core = smoothstep(0.16, 0.0, r);
    vec3 c = uColor + vec3(core * 0.6);
    gl_FragColor = vec4(c, (halo * 0.5 + core) * vA);
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
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));

    this.uniforms = { uPr: { value: 1 }, uColor: { value: new THREE.Color(0x8fe6ff) } };
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
    this.speed[i] = 0.5 + Math.random() * 1.1;
    this.life[i] = 0.6 + Math.random() * 0.9;      // sizes brightness
    this.arc[i] = 0.02 + Math.random() * 0.04;
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
      // soft birth→death envelope
      this.alpha[i] = Math.sin(Math.PI * t) * this.life[i] * (0.55 + activity * 0.45);
      this.size[i] = 0.03 + this.life[i] * 0.05;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
  }

  dispose() { this.points.geometry.dispose(); this.points.material.dispose(); }
}
