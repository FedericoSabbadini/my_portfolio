/* =========================================================================
   brain-scene.js — the living brain (Three.js / WebGL).
   Particle brain + dim connectome + firing synapses + bloom. Breathing,
   slow rotation, mouse parallax, per-region highlight, cinematic zoom.
   ========================================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildBrain } from './brain-geometry.js';
import { Synapses } from './synapses.js';
import gsap from 'gsap';

const VERT = /* glsl */`
  attribute float seed;
  uniform float u_time;
  uniform float u_size;
  uniform float u_pr;
  uniform vec3  u_region;
  uniform float u_regionStr;
  uniform float u_activity;
  varying float v_bright;
  varying float v_region;
  varying float v_depth;
  void main() {
    vec3 pos = position;
    float tw = 0.5 + 0.5 * sin(u_time * (1.1 + seed * 2.0) + seed * 6.2831);
    float d = distance(pos, u_region);
    float reg = smoothstep(0.8, 0.0, d) * u_regionStr;
    v_region = reg;
    v_bright = tw * (0.5 + u_activity * 0.5) + reg;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    v_depth = -mv.z;                                   // for front/back falloff
    float size = u_size * (0.6 + tw * 0.5 + reg * 1.8);
    gl_PointSize = size * u_pr * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  precision mediump float;
  uniform vec3 u_colorA;   // deep
  uniform vec3 u_colorB;   // bright
  uniform vec3 u_regionColor;
  varying float v_bright;
  varying float v_region;
  varying float v_depth;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.08, r);
    // nearer points brighter → the cloud reads as a 3D volume, not a blob
    float front = smoothstep(6.4, 2.8, v_depth);
    vec3 col = mix(u_colorA, u_colorB, clamp(v_bright, 0.0, 1.0));
    col = mix(col, u_regionColor, clamp(v_region, 0.0, 1.0));
    col *= (0.75 + 0.35 * v_bright);
    float a = soft * (0.30 + 0.35 * v_bright + 0.7 * v_region) * (0.35 + 0.65 * front);
    gl_FragColor = vec4(col, a);
  }
`;

export class BrainScene {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.reduced = !!opts.reducedMotion;
    this.mobile = !!opts.mobile;
    this.domains = opts.domains || [];
    this._frameCbs = [];
    this._running = false;
    this._interactive = true;
    this._clock = new THREE.Clock();

    // region maps
    this.regionPos = new Map();
    this.regionColor = new Map();
    for (const d of this.domains) {
      this.regionPos.set(d.id, new THREE.Vector3(...d.position));
      this.regionColor.set(d.id, new THREE.Color(d.accent));
    }

    this.pointer = new THREE.Vector2(0, 0);          // target parallax (-1..1)
    this._parallax = new THREE.Vector2(0, 0);        // smoothed
    this.activity = 0;                               // 0..1 neural activity
    this._activityTarget = 0;

    this._initRenderer();
    this._initScene();
    this._buildBrain();
    this._initBloom();
    this._onResize = this.resize.bind(this);
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop(); else if (this._wantRun) this.start();
    });
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: !this.mobile, alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.pr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.renderer.setPixelRatio(this.pr);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0, 4.3);
    this.group = new THREE.Group();       // holds the brain; rotates + breathes
    this.scene.add(this.group);
    this.homeCamZ = 4.3;
  }

  _buildBrain() {
    const count = this.mobile ? 3000 : 5200;
    const brain = buildBrain(count);
    this.brainData = brain;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(brain.positions, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(brain.seeds, 1));

    this.uniforms = {
      u_time: { value: 0 },
      u_size: { value: this.mobile ? 1.9 : 2.1 },
      u_pr: { value: this.pr },
      u_region: { value: new THREE.Vector3(0, 0, 5) },  // off-brain = no highlight
      u_regionStr: { value: 0 },
      u_activity: { value: 0 },
      u_colorA: { value: new THREE.Color(0x12233f) },
      u_colorB: { value: new THREE.Color(0x6fd8ff) },
      u_regionColor: { value: new THREE.Color(0x22d3ee) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    // connectome
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(brain.positions, 3));
    lineGeo.setIndex(new THREE.BufferAttribute(brain.lineIndices, 1));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x2f6bd6, transparent: true, opacity: this.mobile ? 0.05 : 0.08,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.lines = new THREE.LineSegments(lineGeo, lineMat);
    this.lines.frustumCulled = false;
    this.group.add(this.lines);

    // synapses
    this.synapses = new Synapses(brain.positions, brain.lineIndices, this.mobile ? 45 : 90);
    this.group.add(this.synapses.points);
  }

  _initBloom() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.useBloom = !this.mobile && !this.reduced;
    if (this.useBloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.5, 0.32);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  /* ---- public API ------------------------------------------------------- */
  onFrame(cb) { this._frameCbs.push(cb); }
  setInteractive(v) { this._interactive = v; }
  setPointer(nx, ny) { this.pointer.set(nx, ny); }

  setActiveRegion(id) {
    this._activityTarget = id ? 1 : 0.0;
    if (id && this.regionPos.has(id)) {
      const p = this.regionPos.get(id);
      gsap.to(this.uniforms.u_region.value, { x: p.x, y: p.y, z: p.z, duration: 0.5, ease: 'power2.out' });
      gsap.to(this.uniforms.u_regionStr, { value: 1, duration: 0.5, ease: 'power2.out' });
      const c = this.regionColor.get(id);
      gsap.to(this.uniforms.u_regionColor.value, { r: c.r, g: c.g, b: c.b, duration: 0.4 });
    } else {
      gsap.to(this.uniforms.u_regionStr, { value: 0, duration: 0.6, ease: 'power2.out' });
    }
  }

  /** project a region's local anchor to CSS screen coords */
  projectRegion(id) {
    if (!this.regionPos.has(id)) return null;
    const v = this.regionPos.get(id).clone();
    this.group.updateWorldMatrix(true, false);
    v.applyMatrix4(this.group.matrixWorld);
    const camDir = v.clone().sub(this.camera.position).normalize();
    v.project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    const x = (v.x * 0.5 + 0.5) * rect.width;
    const y = (-v.y * 0.5 + 0.5) * rect.height;
    // facing test: is the anchor on the near side of the brain?
    const worldNormal = this.regionPos.get(id).clone().applyMatrix4(this.group.matrixWorld).normalize();
    const toCam = this.camera.position.clone().normalize();
    const facing = worldNormal.dot(toCam) > -0.15;
    return { x, y, visible: v.z < 1 && facing, depth: v.z };
  }

  allRegionScreen() { return this.domains.map((d) => ({ id: d.id, ...this.projectRegion(d.id) })); }

  /** cinematic dive into a region */
  zoomTo(id) {
    this._diving = true;
    const p = this.regionPos.get(id) || new THREE.Vector3();
    const tl = gsap.timeline();
    tl.to(this.group.rotation, { y: -Math.atan2(p.x, p.z) , x: p.y * 0.3, duration: 1.0, ease: 'power3.inOut' }, 0);
    tl.to(this.camera.position, { z: 2.0, x: p.x * 0.4, y: p.y * 0.4, duration: 1.1, ease: 'power3.inOut',
      onUpdate: () => this.camera.updateProjectionMatrix() }, 0);
    tl.to(this.uniforms.u_regionStr, { value: 1.6, duration: 0.8 }, 0);
    setTimeout(() => { this.canvas.style.opacity = '0'; }, 550);  // CSS transition handles the fade
    return tl.then(() => {});
  }

  reset() {
    this._diving = false;
    this.canvas.style.opacity = '1';                 // CSS transition fades it back in
    const tl = gsap.timeline();
    tl.to(this.camera.position, { z: this.homeCamZ, x: 0, y: 0, duration: 1.0, ease: 'power3.inOut',
      onUpdate: () => this.camera.updateProjectionMatrix() }, 0);
    tl.to(this.uniforms.u_regionStr, { value: 0, duration: 0.6 }, 0);
    return tl.then(() => {});
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);
  }

  start() { this._wantRun = true; if (this._running) return; this._running = true; this._clock.start(); this._loop(); }
  stop() { this._running = false; }

  _loop() {
    if (!this._running) return;
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this._clock.getDelta(), 0.05);
    const t = this._clock.elapsedTime;
    this.uniforms.u_time.value = t;

    // smooth activity + parallax
    this.activity += (this._activityTarget - this.activity) * Math.min(1, dt * 4);
    this.uniforms.u_activity.value = this.activity;
    const px = this._interactive ? this.pointer.x : 0;
    const py = this._interactive ? this.pointer.y : 0;
    this._parallax.x += (px - this._parallax.x) * Math.min(1, dt * 3);
    this._parallax.y += (py - this._parallax.y) * Math.min(1, dt * 3);

    if (!this.reduced && !this._diving) {
      // slow auto-rotation + lean toward pointer
      this.group.rotation.y += dt * 0.12 + this._parallax.x * dt * 0.4;
      this.group.rotation.x += (this._parallax.y * 0.18 + Math.sin(t * 0.4) * 0.03 - this.group.rotation.x) * Math.min(1, dt * 2);
      // breathing
      const breathe = 1 + Math.sin(t * 0.9) * 0.012;
      this.group.scale.setScalar(breathe);
      this.group.position.y = Math.sin(t * 0.6) * 0.02;
      // camera micro-parallax
      this.camera.position.x += (this._parallax.x * 0.25 - this.camera.position.x) * Math.min(1, dt * 2) * (this._diving ? 0 : 1);
    }

    this.synapses.update(dt, this.activity);
    for (const cb of this._frameCbs) cb();
    this.composer.render();
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this.points.geometry.dispose(); this.points.material.dispose();
    this.lines.geometry.dispose(); this.lines.material.dispose();
    this.synapses.dispose();
    this.composer.dispose?.();
    this.renderer.dispose();
  }
}

/* Feature test used by main.js to decide brain vs. accessible index */
export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
