/* =========================================================================
   brain-geometry.js — procedural anatomy of a brain (no external model).

   A welded icosphere is displaced into a two-hemisphere cerebrum. The
   surface is carved by a *domain-warped groove network*: the zero-set of a
   meandering noise field becomes the sulci (the dark valleys), leaving broad
   rounded gyri between them — the single feature that makes a brain read as a
   brain. A deep longitudinal fissure splits the hemispheres; the posterior-
   inferior lobe is packed with finer folds to suggest a cerebellum.

   Per vertex we also bake `aFold` — a 0‥1 sulcal-depth value the shader uses
   for ambient occlusion in the crevices and a sheen on the crests.
   ========================================================================= */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* --- deterministic 3D value noise (trilinear over a hashed lattice) ------ */
function makeNoise3(seed = 1337) {
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const val = (ix, iy, iz) => (perm[(perm[(perm[ix & 255] + iy) & 255] + iz) & 255] / 255) * 2 - 1;
  return (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const u = fade(fx), v = fade(fy), w = fade(fz);
    const c000 = val(ix, iy, iz), c100 = val(ix + 1, iy, iz);
    const c010 = val(ix, iy + 1, iz), c110 = val(ix + 1, iy + 1, iz);
    const c001 = val(ix, iy, iz + 1), c101 = val(ix + 1, iy, iz + 1);
    const c011 = val(ix, iy + 1, iz + 1), c111 = val(ix + 1, iy + 1, iz + 1);
    return lerp(lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
      lerp(lerp(c001, c101, u), lerp(c011, c111, u), v), w);
  };
}
function fbm(noise, x, y, z, oct = 4) {
  let a = 0, amp = 0.5, f = 1;
  for (let o = 0; o < oct; o++) { a += amp * noise(x * f, y * f, z * f); f *= 2.02; amp *= 0.5; }
  return a;
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

/* --- the brain surface field: unit direction → world position + macro fold
   The fine gyri are drawn per-pixel in the shader; here we only sculpt the
   MACRO anatomy — hemispheres, the deep longitudinal fissure, temporal flare,
   flattened base and the cerebellar bulge — plus a large-scale groove hint
   that seeds ambient occlusion. `out` gets the position; a 0‥1 macro-cavity
   value is returned (deep fissure / cerebellar band) for baking. ----------- */
function brainShape(noise, dx, dy, dz, out) {
  // broad silhouette warp — keeps the outline organically bumpy, not egg-clean
  const lobe = fbm(noise, dx * 1.4 + 11, dy * 1.4 + 3, dz * 1.4 + 7, 3);

  // large-scale gyral hint (the fine folding is per-pixel in the shader)
  const wx = fbm(noise, dx * 2.4 + 21.3, dy * 2.4 + 5.1, dz * 2.4 + 9.7, 2) * 0.3;
  const wy = fbm(noise, dx * 2.4 + 5.4, dy * 2.4 + 13.2, dz * 2.4 + 2.9, 2) * 0.3;
  const gx = dx + wx, gy = dy + wy, gz = dz + wx;
  const n0 = fbm(noise, gx * 4.2, gy * 4.2, gz * 4.2, 3);
  let cavity = (1 - smoothstep(0.0, 0.13, Math.abs(n0))) * 0.5;   // shallow macro grooves

  let r = 1.0 + lobe * 0.06 - cavity * 0.06;

  // cerebrum ellipsoid: wide (x), shorter (y), long front-back (z, front = +z)
  let px = dx * 1.02 * r;
  let py = dy * 0.82 * r;
  let pz = dz * 1.26 * r;

  // longitudinal fissure: a deep central groove down the top → two hemispheres
  const midline = Math.exp(-(px * px) / 0.010) * smoothstep(-0.15, 0.5, py);
  py -= midline * 0.21;
  cavity = Math.max(cavity, midline);

  // temporal lobes: flare the lower sides forward (a defining brain feature)
  const temporal = smoothstep(0.2, -0.5, py) * smoothstep(-0.9, 0.4, pz);
  px *= 1.0 + temporal * 0.15;

  // frontal fullness / occipital taper
  pz *= 1.0 + smoothstep(0.2, 1.0, dz) * 0.05 - smoothstep(-0.3, -1.0, dz) * 0.06;

  // gently flatten the underside (rounded, not a dome)
  if (py < -0.52) py = -0.52 + (py + 0.52) * 0.72;

  // cerebellum: a bulge at the posterior-inferior, offset below, with a cleft
  const cere = smoothstep(-0.32, -0.82, dz) * smoothstep(0.12, -0.6, dy);
  if (cere > 0.001) {
    py -= cere * 0.15; pz -= cere * 0.06;
    const cleft = Math.exp(-(px * px) / 0.02);
    cavity = Math.max(cavity, cere * cleft * 0.9);
  }

  out.set(px, py, pz);
  return Math.min(1, cavity);
}

/**
 * Build the brain mesh geometry with smooth normals + per-vertex lobe id
 * and a macro-cavity value. Fine gyri are added per-pixel in the shader.
 * @param {number} detail icosphere subdivision (verts ≈ 10·detail² + 2)
 * @param {Array<[number,number,number]>} regionPositions domain anchors
 */
export function buildBrainMesh(detail = 32, regionPositions = []) {
  const noise = makeNoise3(7);
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo = mergeVertices(geo);                       // weld → shared verts → smooth normals
  const pos = geo.attributes.position;
  const n = pos.count;

  const tmp = new THREE.Vector3();
  const localPos = new Float32Array(n * 3);       // pre-anything positions for shader region math
  const aFold = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    aFold[i] = brainShape(noise, tmp.x, tmp.y, tmp.z, tmp);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    localPos[i * 3] = tmp.x; localPos[i * 3 + 1] = tmp.y; localPos[i * 3 + 2] = tmp.z;
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // blend computed normals a touch toward radial to calm silhouette shimmer,
  // but keep them crisp enough that the grooves still catch the light.
  const nrm = geo.attributes.normal;
  for (let i = 0; i < n; i++) {
    tmp.set(localPos[i * 3], localPos[i * 3 + 1], localPos[i * 3 + 2]).normalize();
    const nx = nrm.getX(i) * 0.9 + tmp.x * 0.1;
    const ny = nrm.getY(i) * 0.9 + tmp.y * 0.1;
    const nz = nrm.getZ(i) * 0.9 + tmp.z * 0.1;
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(i, nx / l, ny / l, nz / l);
  }
  nrm.needsUpdate = true;

  // per-vertex lobe id + activity seed
  const aLobe = new Float32Array(n);
  const aSeed = new Float32Array(n);
  const R = regionPositions.length || 1;
  for (let i = 0; i < n; i++) {
    let best = 0, bestD = Infinity;
    for (let k = 0; k < regionPositions.length; k++) {
      const r = regionPositions[k];
      const d = (localPos[i * 3] - r[0]) ** 2 + (localPos[i * 3 + 1] - r[1]) ** 2 + (localPos[i * 3 + 2] - r[2]) ** 2;
      if (d < bestD) { bestD = d; best = k; }
    }
    aLobe[i] = best / R;
    aSeed[i] = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  }
  geo.setAttribute('aLobe', new THREE.BufferAttribute(aLobe, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  geo.setAttribute('aFold', new THREE.BufferAttribute(aFold, 1));

  return { geometry: geo, surface: localPos, count: n };
}

/**
 * Pick a spread-out subset of surface vertices to seed synapse firing.
 * Returns indices into the surface array and a proximity adjacency list.
 */
export function buildSynapticGraph(surface, count, sampleTarget = 520) {
  const step = Math.max(1, Math.floor(count / sampleTarget));
  const idx = [];
  for (let i = 0; i < count; i += step) idx.push(i);

  // spatial hash for neighbours
  const cell = 0.26;
  const grid = new Map();
  const key = (a, b, c) => `${a}|${b}|${c}`;
  const gx = (v) => Math.floor(v / cell);
  idx.forEach((i, li) => {
    const k = key(gx(surface[i * 3]), gx(surface[i * 3 + 1]), gx(surface[i * 3 + 2]));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(li);
  });
  const adj = idx.map(() => []);
  idx.forEach((i, li) => {
    const cx = gx(surface[i * 3]), cy = gx(surface[i * 3 + 1]), cz = gx(surface[i * 3 + 2]);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const bucket = grid.get(key(cx + a, cy + b, cz + c));
      if (!bucket) continue;
      for (const lj of bucket) {
        if (lj === li) continue;
        const j = idx[lj];
        const d2 = (surface[i * 3] - surface[j * 3]) ** 2 + (surface[i * 3 + 1] - surface[j * 3 + 1]) ** 2 + (surface[i * 3 + 2] - surface[j * 3 + 2]) ** 2;
        if (d2 < 0.09 && adj[li].length < 5) adj[li].push(lj);
      }
    }
  });
  return { idx, adj };
}
