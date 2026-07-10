/* =========================================================================
   brain-geometry.js — procedural anatomy of a brain (no external model).
   A welded icosphere is displaced into a two-hemisphere cerebrum with a
   longitudinal fissure, gyri/sulci folds, temporal flare, a flattened
   underside and a cerebellar texture. Smooth normals are recomputed so the
   surface can be *lit* like an organ — not read as a point cloud.
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
const ridged = (noise, x, y, z) => 1 - Math.abs(fbm(noise, x, y, z, 3));
const smoothstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/* --- the brain surface field: unit direction → world position ------------ */
function brainShape(noise, dx, dy, dz, out) {
  // gyri (low-freq lobes) + sulci (sharp ridged valleys, two octaves)
  const warp = fbm(noise, dx * 1.5 + 11, dy * 1.5 + 3, dz * 1.5 + 7);
  const sulci = (ridged(noise, dx * 3.4, dy * 3.4, dz * 3.4) - 0.5);
  const fine = (ridged(noise, dx * 6.8, dy * 6.8, dz * 6.8) - 0.5);
  // gentle silhouette (small warp) + expressive surface folds (sulci/fine)
  let r = 1.0 + warp * 0.05 + sulci * 0.11 + fine * 0.05;

  // cerebrum ellipsoid: wide (x), shorter (y), long front-back (z, front = +z)
  let px = dx * 1.02 * r;
  let py = dy * 0.82 * r;
  let pz = dz * 1.24 * r;

  // longitudinal fissure: a soft midline groove along the top
  const mid = Math.exp(-(px * px) / 0.02) * smoothstep(0.0, 0.55, py);
  py -= mid * 0.10;

  // temporal lobes: flare the lower sides forward
  const temporal = smoothstep(0.2, -0.5, py) * smoothstep(-0.9, 0.4, pz);
  px *= 1.0 + temporal * 0.12;

  // frontal fullness / occipital taper
  pz *= 1.0 + smoothstep(0.2, 1.0, dz) * 0.05 - smoothstep(-0.3, -1.0, dz) * 0.06;

  // gently flatten the underside (keep it rounded, not a dome)
  if (py < -0.52) py = -0.52 + (py + 0.52) * 0.72;

  // cerebellum: a denser-folded bulge at the posterior-inferior
  const cere = smoothstep(-0.35, -0.85, dz) * smoothstep(0.1, -0.6, dy);
  if (cere > 0.001) {
    const cf = (ridged(noise, dx * 11.0, dy * 11.0, dz * 11.0) - 0.5) * 0.06;
    py -= cere * 0.10; pz -= cere * 0.06; r += cf * cere;
    py += cf * cere;
  }

  out.set(px, py, pz);
  return out;
}

/**
 * Build the brain mesh geometry with smooth normals + per-vertex lobe id.
 * @param {number} detail icosphere subdivision (5 ≈ 10k verts, 6 ≈ 41k)
 * @param {Array<[number,number,number]>} regionPositions domain anchors
 */
export function buildBrainMesh(detail = 5, regionPositions = []) {
  const noise = makeNoise3(7);
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo = mergeVertices(geo);                       // weld → shared verts → smooth normals
  const pos = geo.attributes.position;
  const n = pos.count;

  const tmp = new THREE.Vector3();
  const localPos = new Float32Array(n * 3);       // pre-anything positions for shader region math
  for (let i = 0; i < n; i++) {
    tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    brainShape(noise, tmp.x, tmp.y, tmp.z, tmp);
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    localPos[i * 3] = tmp.x; localPos[i * 3 + 1] = tmp.y; localPos[i * 3 + 2] = tmp.z;
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  // blend computed normals slightly toward radial to calm the noise
  const nrm = geo.attributes.normal;
  for (let i = 0; i < n; i++) {
    tmp.set(localPos[i * 3], localPos[i * 3 + 1], localPos[i * 3 + 2]).normalize();
    const nx = nrm.getX(i) * 0.85 + tmp.x * 0.15;
    const ny = nrm.getY(i) * 0.85 + tmp.y * 0.15;
    const nz = nrm.getZ(i) * 0.85 + tmp.z * 0.15;
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
