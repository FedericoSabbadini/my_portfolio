/* =========================================================================
   brain-scene.js — the living brain.
   A displaced anatomical mesh lit like an organ (wrapped diffuse + fake
   subsurface + fresnel rim), with regional neural activity, organic synapse
   firing, a cinematic hand-held camera and a restrained bloom.
   ========================================================================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildBrainMesh, buildSynapticGraph } from './brain-geometry.js';
import { Synapses } from './synapses.js';
import gsap from 'gsap';

const VERT = /* glsl */`
  attribute float aLobe;
  attribute float aSeed;
  uniform float uTime;
  uniform float uBreath;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vLocal;
  varying float vLobe;
  varying float vSeed;
  void main() {
    vLocal = position;
    vLobe = aLobe;
    vSeed = aSeed;
    float b = sin(uTime * 0.5 + position.y * 3.0 + position.x * 2.0) * 0.008
            + sin(uTime * 0.9 + aSeed * 6.2831) * 0.003;
    vec3 p = position + normal * b * uBreath;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uKeyDir, uKeyColor, uRimColor, uSSSColor, uBase, uDeep, uActColor;
  uniform vec3 uRegion, uRegionColor;
  uniform float uTime, uActivity, uRegionStr;
  varying vec3 vN, vView, vLocal;
  varying float vLobe, vSeed;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(vView);
    vec3 L = normalize(uKeyDir);
    float ndl = dot(N, L);
    float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
    float sss  = pow(clamp(-ndl * 0.5 + 0.5, 0.0, 1.0), 1.6) * (0.35 + 0.65 * fres);

    vec3 col = mix(uDeep, uBase, wrap);
    col += uKeyColor * pow(wrap, 1.6) * 0.30;
    col += uSSSColor * sss * 0.30;
    col += uRimColor * fres * 0.52;

    // deepen sulci: darken cavities the key light can't reach
    col *= 0.80 + 0.20 * smoothstep(0.12, 0.9, wrap);

    // painted longitudinal fissure → reads clearly as two hemispheres
    float fissure = smoothstep(0.09, 0.0, abs(vLocal.x)) * smoothstep(-0.05, 0.45, vLocal.y);
    col *= 1.0 - fissure * 0.34;

    // neural activity — restrained & organic: each lobe breathes in
    // brightness at its own slow phase. No bands. The discrete "firing"
    // is carried entirely by the synapse sprites.
    float lobePulse = sin(uTime * 0.5 + vLobe * 17.0) * 0.5 + 0.5;
    col *= 0.93 + lobePulse * 0.09;
    col += uActColor * uActivity * 0.06 * fres;                       // gentle rim warm-up when engaged

    // hovered region: local glow that also lifts the rim
    float reg = smoothstep(0.85, 0.0, distance(vLocal, uRegion)) * uRegionStr;
    col += uRegionColor * reg * (0.45 + fres * 0.8);

    gl_FragColor = vec4(col, 1.0);
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
    this._diving = false;
    this._clock = new THREE.Clock();

    this.regionPos = new Map();
    this.regionColor = new Map();
    for (const d of this.domains) {
      this.regionPos.set(d.id, new THREE.Vector3(...d.position));
      this.regionColor.set(d.id, new THREE.Color(d.accent));
    }

    this.pointer = new THREE.Vector2(0, 0);
    this._parallax = new THREE.Vector2(0, 0);
    this.activity = 0; this._activityTarget = 0;
    this._fps = 60; this._quality = 1;

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
      canvas: this.canvas, antialias: !this.mobile, alpha: true, powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.pr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.renderer.setPixelRatio(this.pr);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.homeCamZ = 4.15;
    this.camera.position.set(0, 0, this.homeCamZ);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._camTarget = new THREE.Vector3(0, 0, 0);
  }

  _buildBrain() {
    const detail = this.mobile ? 5 : 7;
    const regionPositions = this.domains.map((d) => d.position);
    const { geometry, surface, count } = buildBrainMesh(detail, regionPositions);
    this.brainGeo = geometry; this.surface = surface;

    this.uniforms = {
      uTime: { value: 0 },
      uBreath: { value: this.reduced ? 0 : 1 },
      uActivity: { value: 0 },
      uKeyDir: { value: new THREE.Vector3(-0.5, 0.8, 0.6).normalize() },
      uKeyColor: { value: new THREE.Color(0x9fc4e8) },
      uRimColor: { value: new THREE.Color(0x37d4ee) },
      uSSSColor: { value: new THREE.Color(0xc78a86) },
      uActColor: { value: new THREE.Color(0x8fe6ff) },
      uBase: { value: new THREE.Color(0x2c4a68) },
      uDeep: { value: new THREE.Color(0x050912) },
      uRegion: { value: new THREE.Vector3(0, 0, 6) },
      uRegionStr: { value: 0 },
      uRegionColor: { value: new THREE.Color(0x22d3ee) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: false,
    });
    this.brain = new THREE.Mesh(geometry, mat);
    this.brain.frustumCulled = false;
    this.group.add(this.brain);

    // synapses ride the surface
    const sg = buildSynapticGraph(surface, count, this.mobile ? 360 : 560);
    this.synapses = new Synapses(surface, sg, this.mobile ? 40 : 78);
    this.synapses.uniforms.uPr.value = this.pr;
    this.group.add(this.synapses.points);
  }

  _initBloom() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.useBloom = !this.reduced;
    if (this.useBloom) {
      // restrained: only the brightest neural sparks / rim glow softly
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.6, 0.55);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  /* ---- API -------------------------------------------------------------- */
  onFrame(cb) { this._frameCbs.push(cb); }
  setInteractive(v) { this._interactive = v; }
  setPointer(nx, ny) { this.pointer.set(nx, ny); }

  setActiveRegion(id) {
    this._activityTarget = id ? 1 : 0;
    if (id && this.regionPos.has(id)) {
      const p = this.regionPos.get(id);
      gsap.to(this.uniforms.uRegion.value, { x: p.x, y: p.y, z: p.z, duration: 0.5, ease: 'power2.out' });
      gsap.to(this.uniforms.uRegionStr, { value: 1, duration: 0.5, ease: 'power2.out' });
      const c = this.regionColor.get(id);
      gsap.to(this.uniforms.uRegionColor.value, { r: c.r, g: c.g, b: c.b, duration: 0.4 });
    } else {
      gsap.to(this.uniforms.uRegionStr, { value: 0, duration: 0.6, ease: 'power2.out' });
    }
  }

  projectRegion(id) {
    if (!this.regionPos.has(id)) return null;
    this.group.updateWorldMatrix(true, false);
    const v = this.regionPos.get(id).clone().applyMatrix4(this.group.matrixWorld);
    const worldNormal = v.clone().normalize();
    const toCam = this.camera.position.clone().sub(v).normalize();
    const facing = worldNormal.dot(toCam) > -0.1;
    v.project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width,
      y: (-v.y * 0.5 + 0.5) * rect.height,
      visible: v.z < 1 && facing, depth: v.z,
    };
  }
  allRegionScreen() { return this.domains.map((d) => ({ id: d.id, ...this.projectRegion(d.id) })); }

  zoomTo(id) {
    this._diving = true;
    const p = this.regionPos.get(id) || new THREE.Vector3();
    const yaw = -Math.atan2(p.x, p.z + 0.001);
    const tl = gsap.timeline();
    tl.to(this.group.rotation, { y: yaw, x: p.y * 0.35, duration: 1.15, ease: 'power3.inOut' }, 0);
    tl.to(this.camera.position, { x: p.x * 0.5, y: p.y * 0.5, z: 1.75, duration: 1.25, ease: 'power3.inOut',
      onUpdate: () => { this.camera.lookAt(this._camTarget); } }, 0);
    tl.to(this.uniforms.uRegionStr, { value: 1.8, duration: 0.9 }, 0);
    tl.to(this.uniforms.uActivity, { value: 1.4, duration: 0.9 }, 0);
    setTimeout(() => { this.canvas.style.opacity = '0'; }, 620);
    return tl.then(() => {});
  }

  reset() {
    this._diving = false;
    this.canvas.style.opacity = '1';
    const tl = gsap.timeline();
    tl.to(this.camera.position, { z: this.homeCamZ, x: 0, y: 0, duration: 1.1, ease: 'power3.inOut' }, 0);
    tl.to(this.uniforms.uRegionStr, { value: 0, duration: 0.6 }, 0);
    tl.to(this.uniforms.uActivity, { value: 0, duration: 0.8 }, 0);
    return tl.then(() => {});
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
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
    this.uniforms.uTime.value = t;

    this._adaptQuality(dt);

    this.activity += (this._activityTarget - this.activity) * Math.min(1, dt * 3.5);
    if (!this._diving) this.uniforms.uActivity.value = this.activity;

    const px = this._interactive ? this.pointer.x : 0;
    const py = this._interactive ? this.pointer.y : 0;
    // spring toward pointer (inertia)
    this._parallax.x += (px - this._parallax.x) * Math.min(1, dt * 2.6);
    this._parallax.y += (py - this._parallax.y) * Math.min(1, dt * 2.6);

    if (!this.reduced && !this._diving) {
      // brain self-rotation + gentle lean toward pointer
      this.group.rotation.y += dt * 0.05 + this._parallax.x * dt * 0.25;
      this.group.rotation.x += (this._parallax.y * 0.12 - this.group.rotation.x) * Math.min(1, dt * 2);
      // hand-held camera: micro breathing + parallax orbit, always framing the brain
      const bx = Math.sin(t * 0.31) * 0.03 + Math.sin(t * 0.17) * 0.018;
      const by = Math.cos(t * 0.27) * 0.024 + Math.sin(t * 0.11) * 0.014;
      this.camera.position.x = this._parallax.x * 0.5 + bx;
      this.camera.position.y = this._parallax.y * 0.32 + by + 0.02;
      this.camera.position.z = this.homeCamZ + Math.sin(t * 0.2) * 0.05;
      this.camera.lookAt(this._camTarget);
    }

    this.synapses.update(dt, this.activity);
    for (const cb of this._frameCbs) cb();
    this.composer.render();
  }

  _adaptQuality(dt) {
    const fps = 1 / Math.max(dt, 0.0001);
    this._fps += (fps - this._fps) * 0.05;
    if (this._fps < 42 && this._quality > 0.66) {
      this._quality = 0.66; this.renderer.setPixelRatio(this.pr * 0.75);
    } else if (this._fps < 30 && this._quality > 0.5) {
      this._quality = 0.5; this.renderer.setPixelRatio(this.pr * 0.6);
      if (this.bloom) this.bloom.enabled = false;
    }
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    this.brain.geometry.dispose(); this.brain.material.dispose();
    this.synapses.dispose();
    this.composer.dispose?.();
    this.renderer.dispose();
  }
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}
