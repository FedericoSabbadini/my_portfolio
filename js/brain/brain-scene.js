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
    return 1.0 - smoothstep(0.0, 0.11, abs(a));
  #else
    vec3 w = vec3(gnoise(p * 1.7 + 21.0), gnoise(p * 1.7 + 5.0), gnoise(p * 1.7 + 9.0)) * 0.42;
    vec3 g = p + w;
    // primary sulci — flowing valleys (gyri), pronounced enough to read as a brain
    float a = gnoise(g * 9.6) * 0.7 + gnoise(g * 19.2 + 2.0) * 0.3;
    float s = 1.0 - smoothstep(0.0, 0.09, abs(a));
    // a second tier of still-finer folding nested on the gyri
    float b = gnoise(g * 30.0 + 7.0);
    s = max(s, (1.0 - smoothstep(0.0, 0.032, abs(b))) * 0.24);
    return s;
  #endif
  }

  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(vView);

    // ---- fine gyri drawn per-pixel, sharpened with screen-space derivative
    // bump-mapping so the cortex reads crisp regardless of mesh resolution.
    float sf = sulcus(vLocal) * uFold;
    float s = max(sf, vFold * 0.85);                    // + baked macro cavities
    vec3 dpdx = dFdx(vWorld), dpdy = dFdy(vWorld);
    float dhx = dFdx(s), dhy = dFdy(s);
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
    col += uKeyColor * pow(wrap, 1.7) * 0.32;
    col += uFillColor * ndf * 0.10;
    col += uSSSColor * sss * 0.36;

    // ambient occlusion: the deeper the sulcus, the darker (light can't reach)
    col *= 1.0 - clamp(s, 0.0, 1.0) * 0.60;
    // crest sheen: broad gyri catch a soft specular-ish bloom of the key
    float crest = smoothstep(0.55, 0.0, s);
    col += uKeyColor * pow(wrap, 4.0) * crest * 0.08;
    // a whisper of translucent life pooled along the crests
    col += uSSSColor * crest * fres * 0.05;

    // cinematic volume: let the underside fall away into shadow so the mass
    // reads as a lit sculpture, not a uniformly-glowing ball (world-space up).
    float vert = smoothstep(-0.85, 0.5, vWorld.y);
    col *= 0.60 + 0.40 * vert;
    col += uFillColor * 0.05; // faint ambient so no facet reads pure black

    // ---- neural activity -------------------------------------------------
    // each lobe breathes in brightness at its own slow phase (no bands); the
    // discrete "firing" is carried by the synapse sprites.
    float lobePulse = sin(uTime * 0.5 + vLobe * 17.0) * 0.5 + 0.5;
    col *= 0.94 + lobePulse * 0.08;
    // faint neural current running through the crevices when engaged
    float current = sin(vWorld.y * 9.0 - uTime * 1.6 + vSeed * 6.283) * 0.5 + 0.5;
    col += uActColor * uActivity * (0.05 * fres + 0.05 * current * s);

    // rim last so it always halos the silhouette cleanly (base-normal fresnel)
    col += uRimColor * fresB * 0.42 * (0.85 + 0.15 * lobePulse);

    // hovered region: local glow that also lifts the rim
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
    // On phones, 1.5× left the dense per-pixel gyri looking soft/aliased; 2× is
    // noticeably crisper and the adaptive-quality loop still scales it back if
    // the framerate drops.
    this.pr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.renderer.setPixelRatio(this.pr);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this._syncMode();
    this.homeCamZ = 4.0;                 // updated dynamically in resize()
    this.camZTarget = this.homeCamZ;
    this.camera.position.set(0, 0, this.homeCamZ);

    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';
    // rotation is driven by rot → rotTarget with an idle/target mode machine so
    // hovering a region turns the brain to face it, then it eases back to idle.
    this.idlePitch = 0.14;
    this.rot = { x: this.idlePitch, y: -0.5 };       // open on a cinematic 3/4 view
    this.rotTarget = { x: this.idlePitch, y: -0.5 };
    this.mode = 'idle';                  // 'idle' | 'target'
    this._holdUntil = 0;
    this._pendingIdle = false;
    this.group.rotation.set(this.rot.x, this.rot.y, 0);
    this.scene.add(this.group);
    this._camTarget = new THREE.Vector3(0, 0, 0);
  }

  /** live layout flags: stacked (mobile full-bleed) vs side (desktop) */
  _syncMode() {
    const W = window.innerWidth || 1280, H = window.innerHeight || 800;
    this.vw = W; this.vh = H;
    this.touch = ('ontouchstart' in window) && W <= 1024;
    this.stacked = this.touch || W <= 820;
    // On mobile the brain is a full-bleed backdrop with a content sheet over the
    // lower third — lift the framing so the brain sits in the upper portion,
    // clear of the sheet. (negative target.y → origin renders above centre)
    if (this._camTarget) this._camTarget.y = this.stacked ? -0.62 : 0;
  }

  _buildBrain() {
    const detail = this.mobile ? 32 : 52;
    const regionPositions = this.domains.map((d) => d.position);
    const { geometry, surface, count } = buildBrainMesh(detail, regionPositions);
    this.brainGeo = geometry; this.surface = surface;

    this.uniforms = {
      uTime: { value: 0 },
      uBreath: { value: this.reduced ? 0 : 1 },
      uActivity: { value: 0 },
      // key: warm-cool top-left; fill: cold from the lower right; rim: cyan halo
      uKeyDir: { value: new THREE.Vector3(-0.55, 0.85, 0.5).normalize() },
      uKeyColor: { value: new THREE.Color(0xc7dbf2) },
      uFillDir: { value: new THREE.Vector3(0.7, -0.35, 0.4).normalize() },
      uFillColor: { value: new THREE.Color(0x2b4a78) },
      uRimColor: { value: new THREE.Color(0x38d6ee) },
      uSSSColor: { value: new THREE.Color(0xd98f88) },
      uActColor: { value: new THREE.Color(0x8fe6ff) },
      uBase: { value: new THREE.Color(0x3a6088) },
      uDeep: { value: new THREE.Color(0x05080f) },
      uRegion: { value: new THREE.Vector3(0, 0, 6) },
      uRegionStr: { value: 0 },
      uRegionColor: { value: new THREE.Color(0x22d3ee) },
      uBump: { value: this.mobile ? 0.18 : 0.44 },
      uFold: { value: this.mobile ? 0.48 : 1.05 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: false,
      defines: this.mobile ? { LITE: 1 } : {},
    });
    mat.extensions = { derivatives: true };
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

  /* rotation target (yaw/pitch) that brings a region to face the camera */
  _regionYawPitch(p) {
    const rxz = Math.hypot(p.x, p.z) || 1e-4;
    const yaw = -Math.atan2(p.x, p.z);
    const pitch = Math.atan2(p.y, rxz) + 0.10; // small downward bias so top folds read
    return { x: pitch, y: yaw };
  }
  _nearestYaw(target, current) {
    let d = target - current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return current + d;
  }

  /** turn the brain to face a region and light it up (hover / focus) */
  faceRegion(id) {
    if (!this.regionPos.has(id)) return;
    const p = this.regionPos.get(id);
    const yp = this._regionYawPitch(p);
    this.rotTarget.x = yp.x;
    this.rotTarget.y = this._nearestYaw(yp.y, this.rot.y);
    this.mode = 'target';
    this._pendingIdle = false;
    this._activityTarget = 1;
    gsap.to(this.uniforms.uRegion.value, { x: p.x, y: p.y, z: p.z, duration: 0.5, ease: 'power2.out' });
    gsap.to(this.uniforms.uRegionStr, { value: 1, duration: 0.5, ease: 'power2.out' });
    const c = this.regionColor.get(id);
    gsap.to(this.uniforms.uRegionColor.value, { r: c.r, g: c.g, b: c.b, duration: 0.4 });
  }

  /** release a focused region: hold briefly, then ease back to idle rotation */
  releaseFocus(hold = 1.1) {
    this._holdUntil = (this._clock ? this._clock.elapsedTime : 0) + hold;
    this._pendingIdle = true;
    this._activityTarget = 0;
    gsap.to(this.uniforms.uRegionStr, { value: 0, duration: 0.6, ease: 'power2.out' });
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

  /** dive: turn to the region, plunge the camera through the cortex with a
      lens-warp + synaptic surge + bloom flash, fade out — then navigate. */
  zoomTo(id) {
    this._diving = true;
    const p = this.regionPos.get(id) || new THREE.Vector3();
    const c = this.regionColor.get(id) || new THREE.Color(0x22d3ee);
    const yp = this._regionYawPitch(p);
    // sync the rot-machine so there is no snap if the dive is interrupted
    this.rotTarget.x = yp.x; this.rotTarget.y = this._nearestYaw(yp.y, this.rot.y);

    // recolour the region glow to the target accent as we commit to the dive
    gsap.to(this.uniforms.uRegionColor.value, { r: c.r, g: c.g, b: c.b, duration: 0.3 });
    gsap.to(this.uniforms.uRegion.value, { x: p.x, y: p.y, z: p.z, duration: 0.5, ease: 'power2.out' });

    const tl = gsap.timeline();
    // turn to face the region
    tl.to(this.rot, { x: yp.x, y: this.rotTarget.y, duration: 1.0, ease: 'power2.inOut',
      onUpdate: () => { this.group.rotation.set(this.rot.x, this.rot.y, 0); } }, 0);
    // rush the camera *through* the cortex toward the region anchor
    tl.to(this.camera.position, { x: p.x * 0.62, y: p.y * 0.62, z: 1.28, duration: 1.1, ease: 'power3.in',
      onUpdate: () => { this.camera.lookAt(this._camTarget); } }, 0);
    // dolly the lens wider as we plunge — the tunnel / warp feel
    tl.to(this.camera, { fov: 60, duration: 1.1, ease: 'power2.in',
      onUpdate: () => { this.camera.updateProjectionMatrix(); } }, 0);
    // the region blooms open and the whole cortex fires
    tl.to(this.uniforms.uRegionStr, { value: 2.6, duration: 0.8, ease: 'power2.in' }, 0);
    tl.to(this.uniforms.uActivity, { value: 1.9, duration: 0.7, ease: 'power2.in' }, 0);
    tl.to(this.uniforms.uBreath, { value: 2.2, duration: 0.5, ease: 'power2.out' }, 0);
    if (this.bloom) tl.to(this.bloom, { strength: 1.4, radius: 0.85, duration: 0.7, ease: 'power2.in' }, 0);
    setTimeout(() => { this.canvas.style.opacity = '0'; }, 600);
    return tl.then(() => {});
  }

  reset() {
    this._diving = false;
    this.canvas.style.opacity = '1';
    // resume the idle machine from wherever the dive left the brain (no snap);
    // the render loop eases the camera/activity back — no gsap here so the two
    // don't fight over camera.position each frame.
    this.rot.x = this.group.rotation.x; this.rot.y = this.group.rotation.y;
    this.rotTarget.x = this.rot.x; this.rotTarget.y = this.rot.y;
    this.mode = 'idle'; this._pendingIdle = false; this._activityTarget = 0;
    this.camZTarget = this.homeCamZ;
    // undo everything the dive pushed (lens dolly, bloom flash, breath surge);
    // the brain fades back in from opacity 0 so these snaps are unseen.
    this.camera.fov = 40; this.camera.updateProjectionMatrix();
    if (this.bloom) { this.bloom.strength = 0.42; this.bloom.radius = 0.6; }
    this.uniforms.uBreath.value = this.reduced ? 0 : 1;
    gsap.to(this.uniforms.uRegionStr, { value: 0, duration: 0.6, ease: 'power2.out' });
  }

  resize() {
    this._syncMode();
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    // When the home view is hidden (a region catalog is up) the canvas measures
    // 0×0. Resizing to that ratio squashes the brain the next time it shows, so
    // skip until it has real dimensions again.
    if (w < 2 || h < 2) return;
    const aspect = w / Math.max(h, 1);
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(w, h);

    const vHalf = Math.tan((40 * Math.PI / 180) / 2);
    const hHalf = vHalf * aspect;
    if (this.stacked) {
      // Mobile = full-bleed backdrop: size the brain to the viewport HEIGHT so
      // it stays large and commanding (sides may bleed off-canvas — that reads
      // as depth, not a bug). The framing is lifted in _syncMode so the lower
      // sheet never covers it.
      const radius = 1.95;                       // world half-extent to frame
      const fit = radius / Math.max(vHalf, 1e-3);
      this.homeCamZ = Math.max(3.4, Math.min(fit, 8.5));
    } else {
      // Desktop = fit to width so the brain sits beside the left panel.
      const widthFit = 1.42 / Math.max(hHalf, 1e-3);
      this.homeCamZ = Math.max(3.9, Math.min(widthFit * 1.04, 9.5));
    }
    if (this.mode !== 'target' && !this._diving) this.camZTarget = this.homeCamZ;
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

    // resume idle rotation once the post-hover hold window has elapsed
    if (this._pendingIdle && t >= this._holdUntil) {
      this._pendingIdle = false; this.mode = 'idle'; this._activityTarget = 0;
    }

    this.activity += (this._activityTarget - this.activity) * Math.min(1, dt * 3.5);
    if (!this._diving) this.uniforms.uActivity.value = this.activity;

    const px = this._interactive ? this.pointer.x : 0;
    const py = this._interactive ? this.pointer.y : 0;
    // spring toward pointer (inertia)
    this._parallax.x += (px - this._parallax.x) * Math.min(1, dt * 2.6);
    this._parallax.y += (py - this._parallax.y) * Math.min(1, dt * 2.6);

    // ---- rotation (gsap drives it during a dive) ----
    if (!this._diving) {
      if (this.mode === 'target') {
        const k = this.reduced ? 1 : Math.min(1, dt * 4.5);
        this.rot.x += (this.rotTarget.x - this.rot.x) * k;
        this.rot.y += (this.rotTarget.y - this.rot.y) * k;
      } else {
        // idle: gentle auto-rotation + a lean toward the pointer, pitch to idle
        if (!this.reduced) this.rot.y += dt * 0.05 + this._parallax.x * dt * 0.25;
        const tiltTarget = this.idlePitch + this._parallax.y * 0.12;
        this.rot.x += (tiltTarget - this.rot.x) * Math.min(1, dt * 2);
        this.rotTarget.x = this.rot.x; this.rotTarget.y = this.rot.y;
      }
      this.group.rotation.set(this.rot.x, this.rot.y, 0);
    }

    // ---- camera (gsap drives it during a dive) ----
    if (!this._diving) {
      this.camZTarget = this.camZTarget || this.homeCamZ;
      if (!this.reduced && this.mode !== 'target') {
        const bx = Math.sin(t * 0.31) * 0.03 + Math.sin(t * 0.17) * 0.018;
        const by = Math.cos(t * 0.27) * 0.024 + Math.sin(t * 0.11) * 0.014;
        this.camera.position.x += (this._parallax.x * 0.5 + bx - this.camera.position.x) * Math.min(1, dt * 3);
        this.camera.position.y += (this._parallax.y * 0.32 + by + 0.02 - this.camera.position.y) * Math.min(1, dt * 3);
      } else {
        this.camera.position.x += (0 - this.camera.position.x) * Math.min(1, dt * 3);
        this.camera.position.y += (0.02 - this.camera.position.y) * Math.min(1, dt * 3);
      }
      this.camera.position.z += (this.camZTarget - this.camera.position.z) * Math.min(1, dt * 3.2);
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
