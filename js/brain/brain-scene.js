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
  attribute float aFold;
  uniform float uTime;
  uniform float uBreath;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying float vLobe;
  varying float vSeed;
  varying float vFold;
  void main() {
    vLocal = position;
    vLobe = aLobe;
    vSeed = aSeed;
    vFold = aFold;
    // breathing: a slow global inflate + a faint per-region flutter, damped
    // inside the sulci so the folds stay put while the mass swells.
    float breath = sin(uTime * 0.5 + position.y * 3.0 + position.x * 2.0) * 0.008
                 + sin(uTime * 0.9 + aSeed * 6.2831) * 0.0025;
    vec3 p = position + normal * breath * uBreath * (1.0 - aFold * 0.6);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uKeyDir, uKeyColor, uFillDir, uFillColor, uRimColor, uSSSColor;
  uniform vec3 uBase, uDeep, uActColor;
  uniform vec3 uRegion, uRegionColor;
  uniform float uTime, uActivity, uRegionStr, uBump, uFold;
  // knowledge regions painted on the cortex
  uniform vec3 uRegions[NREG];
  uniform vec3 uRegionCols[NREG];
  uniform float uRegionSizes[NREG];
  uniform float uHoverRegion;   // index of hovered region, or -1
  uniform float uHoverStr;      // 0..1 emphasis fade
  uniform float uPaint;         // global region-paint intensity
  varying vec3 vN, vView, vLocal, vWorld;
  varying float vLobe, vSeed, vFold;

  /* --- gradient noise (Perlin-style), for the per-pixel gyral field ------ */
  vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float gnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dot(hash33(i + vec3(0,0,0)), f - vec3(0,0,0)),
                       dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                   mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)),
                       dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
               mix(mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)),
                       dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                   mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)),
                       dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
  }
  // sulcal depth at a surface point: 0 on a gyral crest → 1 deep in a sulcus.
  // A broad, low-frequency domain warp bends the field so the sulci meander in
  // long flowing lines (cerebral gyri) rather than tight cells (brain coral).
  float sulcus(vec3 p) {
  #ifdef LITE
    vec3 w = vec3(gnoise(p * 1.7 + 21.0), gnoise(p * 1.7 + 5.0), 0.0) * 0.4;
    vec3 g = p + w;
    float a = gnoise(g * 8.5) * 0.78 + gnoise(g * 17.0 + 2.0) * 0.22;
    return 1.0 - smoothstep(0.0, 0.12, abs(a));
  #else
    // a domain warp bends the field so the sulci meander in long flowing valleys
    // (true cerebral gyri) — dense and clearly-brain, with a finer fold nested on
    // each gyrus so it reads as a real, detailed cortex up close.
    vec3 w = vec3(gnoise(p * 1.7 + 21.0), gnoise(p * 1.7 + 5.0), gnoise(p * 1.7 + 9.0)) * 0.4;
    vec3 g = p + w;
    float a = gnoise(g * 9.8) * 0.7 + gnoise(g * 19.6 + 2.0) * 0.3;
    float s = 1.0 - smoothstep(0.0, 0.10, abs(a));
    float b = gnoise(g * 31.0 + 7.0);                     // nested finer folding
    s = max(s, (1.0 - smoothstep(0.0, 0.035, abs(b))) * 0.22);
    return s;
  #endif
  }

  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(vView);

    // ---- fine gyri drawn per-pixel, sharpened with screen-space derivative
    // bump-mapping so the cortex reads crisp regardless of mesh resolution.
    float sf = sulcus(vLocal) * uFold;
    float s = max(sf, vFold * 0.85);                    // + baked macro cavities (shading only)
    vec3 dpdx = dFdx(vWorld), dpdy = dFdy(vWorld);
    // bump the normal from the SMOOTH per-pixel field only — deriving from the
    // low-res baked cavity would stair-step into blocky voxels.
    float dhx = dFdx(sf), dhy = dFdy(sf);
    vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx);
    float det = dot(dpdx, r1);
    vec3 grad = (dhx * r1 + dhy * r2) * (det < 0.0 ? -1.0 : 1.0) / max(abs(det), 1e-7);
    N = normalize(N - grad * uBump);                    // tilt normal into the sulci

    vec3 L = normalize(uKeyDir);
    vec3 F = normalize(uFillDir);
    float ndl  = dot(N, L);
    float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);              // wrapped key diffuse
    float ndf  = clamp(dot(N, F) * 0.5 + 0.5, 0.0, 1.0);        // soft cool fill
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
    // silhouette fresnel from the *base* normal so the rim halos the whole
    // form cleanly instead of tracing a bright edge onto every fold.
    vec3 Nb = normalize(vN);
    float fresB = pow(1.0 - clamp(dot(Nb, V), 0.0, 1.0), 3.0);
    // subsurface: light bleeding through the thin translucent tissue
    float sss  = pow(clamp(-ndl * 0.5 + 0.5, 0.0, 1.0), 1.6) * (0.32 + 0.68 * fresB);

    // base body: deep core → lit tissue, warmed by the key
    vec3 col = mix(uDeep, uBase, wrap);
    col += uKeyColor * pow(wrap, 1.7) * 0.30;
    col += uFillColor * ndf * 0.10;
    col += uSSSColor * sss * 0.34;

    // ambient occlusion: the deeper the sulcus, the darker (light can't reach)
    col *= 1.0 - clamp(s, 0.0, 1.0) * 0.55;
    // crest sheen: broad gyri catch a soft specular-ish bloom of the key
    float crest = smoothstep(0.55, 0.0, s);
    col += uKeyColor * pow(wrap, 4.0) * crest * 0.07;
    // a whisper of translucent life pooled along the crests
    col += uSSSColor * crest * fres * 0.05;

    // cinematic volume: let the underside fall away into shadow so the mass
    // reads as a lit sculpture, not a uniformly-glowing ball (world-space up).
    float vert = smoothstep(-0.85, 0.5, vWorld.y);
    col *= 0.62 + 0.38 * vert;

    // ---- neural activity -------------------------------------------------
    // each lobe breathes in brightness at its own slow phase (no bands); the
    // discrete "firing" is carried by the synapse sprites.
    float lobePulse = sin(uTime * 0.5 + vLobe * 17.0) * 0.5 + 0.5;
    col *= 0.94 + lobePulse * 0.08;
    // faint neural current running through the crevices when engaged
    float current = sin(vWorld.y * 9.0 - uTime * 1.6 + vSeed * 6.283) * 0.5 + 0.5;
    col += uActColor * uActivity * (0.05 * fres + 0.05 * current * s);

    // rim last so it always halos the silhouette cleanly (base-normal fresnel)
    col += uRimColor * fresB * 0.4 * (0.85 + 0.15 * lobePulse);

    // ---- knowledge regions painted on the cortex ------------------------
    // Voronoi over the region anchors: nearest anchor owns the fragment; a
    // thin illuminated line glows where two regions meet (anatomical seam).
    float b1 = 1e9, b2 = 1e9;
    vec3 regCol = vec3(0.0);
    float nearHover = 0.0;
    for (int i = 0; i < NREG; i++) {
      float d = distance(vLocal, uRegions[i]) / max(uRegionSizes[i], 0.1);
      if (d < b1) {
        b2 = b1; b1 = d; regCol = uRegionCols[i];
        nearHover = (abs(float(i) - uHoverRegion) < 0.5) ? 1.0 : 0.0;
      } else if (d < b2) { b2 = d; }
    }
    // At rest the brain is CLEAN — barely any tint, no visible zone borders.
    // Region identity emerges only on hover: the touched zone lights, the rest
    // dims, and a thin seam traces the border of the hovered region.
    col += regCol * uPaint * (0.015 + 0.24 * uHoverStr * nearHover);
    col *= mix(1.0, mix(0.34, 1.10, nearHover), uHoverStr);
    float seam = 1.0 - smoothstep(0.0, 0.018, b2 - b1);
    col += regCol * seam * uPaint * (0.30 + 0.35 * fresB) * uHoverStr * (0.35 + 0.9 * nearHover);

    // dive emphasis: local bloom at the region being entered
    float reg = smoothstep(0.9, 0.0, distance(vLocal, uRegion)) * uRegionStr;
    col += uRegionColor * reg * (0.5 + fres * 0.85);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class BrainScene {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.reduced = !!opts.reducedMotion;
    this.mobile = !!opts.mobile;
    this.regions = opts.regions || [];
    this._frameCbs = [];
    this._running = false;
    this._interactive = true;
    this._diving = false;
    this._clock = new THREE.Clock();

    this.regionPos = new Map();
    this.regionColor = new Map();
    this.regionIndex = new Map();
    this._regionVecs = [];
    this._regionCols = [];
    this._regionSizes = [];
    this.regions.forEach((d, i) => {
      const v = new THREE.Vector3(...d.position);
      const c = new THREE.Color(d.accent);
      this.regionPos.set(d.id, v);
      this.regionColor.set(d.id, c);
      this.regionIndex.set(d.id, i);
      this._regionVecs.push(v.clone());
      this._regionCols.push(c.clone());
      this._regionSizes.push(d.size || 1);
    });

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
    this.group.rotation.set(0.16, -0.5, 0);   // open on a cinematic 3/4 view
    this.scene.add(this.group);
    this._camTarget = new THREE.Vector3(0, 0, 0);
  }

  _buildBrain() {
    const detail = this.mobile ? 42 : 52;   // verts ≈ 10·detail² (fine gyri are per-pixel)
    const regionPositions = this.regions.map((d) => d.position);
    const { geometry, surface, count } = buildBrainMesh(detail, regionPositions);
    this.brainGeo = geometry; this.surface = surface;

    this.uniforms = {
      uTime: { value: 0 },
      uBreath: { value: this.reduced ? 0 : 1 },
      uActivity: { value: 0 },
      // key: warm-cool top-left; fill: cold from the lower right; rim: cyan halo
      uKeyDir: { value: new THREE.Vector3(-0.55, 0.85, 0.5).normalize() },
      uKeyColor: { value: new THREE.Color(0xbfd6f0) },
      uFillDir: { value: new THREE.Vector3(0.7, -0.35, 0.4).normalize() },
      uFillColor: { value: new THREE.Color(0x2b4a78) },
      uRimColor: { value: new THREE.Color(0x38d6ee) },
      uSSSColor: { value: new THREE.Color(0xd08a86) },
      uActColor: { value: new THREE.Color(0x8fe6ff) },
      uBase: { value: new THREE.Color(0x35597e) },
      uDeep: { value: new THREE.Color(0x060a13) },
      uRegion: { value: new THREE.Vector3(0, 0, 6) },
      uRegionStr: { value: 0 },
      uRegionColor: { value: new THREE.Color(0x22d3ee) },
      uBump: { value: this.mobile ? 0.26 : 0.30 },   // pronounced folds → clearly a brain
      uFold: { value: this.mobile ? 0.82 : 0.92 },   // fine-gyri intensity (perf lever)
      // painted knowledge regions
      uRegions: { value: this._regionVecs },
      uRegionCols: { value: this._regionCols },
      uRegionSizes: { value: this._regionSizes },
      uHoverRegion: { value: -1 },
      uHoverStr: { value: 0 },
      uPaint: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: false,
      defines: { NREG: this.regions.length, ...(this.mobile ? { LITE: 1 } : {}) },
    });
    mat.extensions = { derivatives: true };
    this.brain = new THREE.Mesh(geometry, mat);
    this.brain.frustumCulled = false;
    this.group.add(this.brain);

    // synapses ride the surface — sparse: quiet "activity", not a cloud of points
    const sg = buildSynapticGraph(surface, count, this.mobile ? 300 : 460);
    this.synapses = new Synapses(surface, sg, this.mobile ? 18 : 34);
    this.synapses.uniforms.uPr.value = this.pr;
    this.group.add(this.synapses.points);
  }

  _initBloom() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.useBloom = !this.reduced;
    if (this.useBloom) {
      // restrained: only the brightest neural sparks / seams glow softly
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.6, 0.6);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  /* ---- API -------------------------------------------------------------- */
  onFrame(cb) { this._frameCbs.push(cb); }
  setInteractive(v) { this._interactive = v; }
  setPointer(nx, ny) { this.pointer.set(nx, ny); }

  /** hover a region by id (or null): isolates its painted zone + lifts activity */
  setActiveRegion(id) {
    this._activityTarget = id ? 1 : 0;
    if (id && this.regionIndex.has(id)) {
      this.uniforms.uHoverRegion.value = this.regionIndex.get(id);
      gsap.to(this.uniforms.uHoverStr, { value: 1, duration: 0.45, ease: 'power2.out' });
    } else {
      gsap.to(this.uniforms.uHoverStr, {
        value: 0, duration: 0.5, ease: 'power2.out',
        onComplete: () => { this.uniforms.uHoverRegion.value = -1; },
      });
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
  allRegionScreen() { return this.regions.map((d) => ({ id: d.id, ...this.projectRegion(d.id) })); }

  zoomTo(id) {
    this._diving = true;
    const p = this.regionPos.get(id) || new THREE.Vector3();
    const c = this.regionColor.get(id) || new THREE.Color(0x22d3ee);
    // isolate the entered region + set its dive-glow colour
    if (this.regionIndex.has(id)) this.uniforms.uHoverRegion.value = this.regionIndex.get(id);
    this.uniforms.uRegion.value.copy(p);
    this.uniforms.uRegionColor.value.copy(c);
    const yaw = -Math.atan2(p.x, p.z + 0.001);
    const tl = gsap.timeline();
    tl.to(this.uniforms.uHoverStr, { value: 1, duration: 0.5 }, 0);
    tl.to(this.group.rotation, { y: yaw, x: p.y * 0.35, duration: 1.15, ease: 'power3.inOut' }, 0);
    tl.to(this.camera.position, { x: p.x * 0.5, y: p.y * 0.5, z: 1.75, duration: 1.25, ease: 'power3.inOut',
      onUpdate: () => { this.camera.lookAt(this._camTarget); } }, 0);
    tl.to(this.uniforms.uRegionStr, { value: 1.6, duration: 0.9 }, 0);
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
    tl.to(this.uniforms.uHoverStr, { value: 0, duration: 0.6, onComplete: () => { this.uniforms.uHoverRegion.value = -1; } }, 0);
    tl.to(this.uniforms.uActivity, { value: 0, duration: 0.8 }, 0);
    return tl.then(() => {});
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const aspect = w / h;
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);

    // frame the brain so it is never cropped: keep the roomy landscape framing,
    // but on portrait / narrow aspects pull the camera back to fit the width.
    const vHalf = Math.tan((40 * Math.PI / 180) / 2);
    const hHalf = vHalf * aspect;
    const widthFit = 1.4 / Math.max(hHalf, 1e-3);          // 1.4 = brain half-width + margin
    this.homeCamZ = Math.max(4.15, Math.min(widthFit * 1.05, 10.0));
    // apply immediately so static (reduced-motion) framing is correct too
    if (!this._diving) { this.camera.position.z = this.homeCamZ; this.camera.lookAt(this._camTarget); }
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
      // brain self-rotation + gentle lean toward pointer, held at a slight
      // downward 3/4 tilt so the top convolutions read as volume, not a disc
      this.group.rotation.y += dt * 0.05 + this._parallax.x * dt * 0.25;
      const tiltTarget = 0.16 + this._parallax.y * 0.12;
      this.group.rotation.x += (tiltTarget - this.group.rotation.x) * Math.min(1, dt * 2);
      // hand-held camera: micro breathing + parallax orbit, always framing the brain
      const bx = Math.sin(t * 0.31) * 0.03 + Math.sin(t * 0.17) * 0.018;
      const by = Math.cos(t * 0.27) * 0.024 + Math.sin(t * 0.11) * 0.014;
      this.camera.position.x = this._parallax.x * 0.5 + bx;
      this.camera.position.y = this._parallax.y * 0.32 + by + 0.02;
      this.camera.position.z = this.homeCamZ + Math.sin(t * 0.2) * 0.05;
      this.camera.lookAt(this._camTarget);
    }

    this.synapses.update(this.reduced ? dt * 0.12 : dt, this.activity);
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
