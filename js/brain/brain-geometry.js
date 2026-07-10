/* =========================================================================
   brain-geometry.js — procedural brain shape (no external model).
   Two hemispheres of particles on a warped ellipsoid, folded by 3D noise,
   with a central longitudinal fissure and some interior volume. Also builds
   a sparse "connectome" of short links between nearby particles.
   ========================================================================= */

/* --- tiny deterministic 3D value noise (trilinear over a hashed lattice) -- */
function makeNoise3(seed = 1337) {
  const perm = new Uint8Array(512);
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const val = (ix, iy, iz) => {
    const h = perm[(perm[(perm[ix & 255] + iy) & 255] + iz) & 255];
    return h / 255 * 2 - 1;
  };
  return (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const u = fade(fx), v = fade(fy), w = fade(fz);
    const c000 = val(ix, iy, iz), c100 = val(ix + 1, iy, iz);
    const c010 = val(ix, iy + 1, iz), c110 = val(ix + 1, iy + 1, iz);
    const c001 = val(ix, iy, iz + 1), c101 = val(ix + 1, iy, iz + 1);
    const c011 = val(ix, iy + 1, iz + 1), c111 = val(ix + 1, iy + 1, iz + 1);
    return lerp(
      lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
      lerp(lerp(c001, c101, u), lerp(c011, c111, u), v), w);
  };
}

function fbm(noise, x, y, z) {
  let a = 0, amp = 0.5, f = 1;
  for (let o = 0; o < 4; o++) { a += amp * noise(x * f, y * f, z * f); f *= 2.03; amp *= 0.5; }
  return a;
}

/**
 * Build the brain particle field.
 * @param {number} count target surface particle count
 * @returns {{positions:Float32Array, seeds:Float32Array, count:number,
 *            lineIndices:Uint32Array, bounds:{rx,ry,rz}}}
 */
export function buildBrain(count = 6000) {
  const noise = makeNoise3(7);
  const rx = 1.05, ry = 0.82, rz = 1.4;         // ellipsoid radii (front = +z)
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const golden = Math.PI * (3 - Math.sqrt(5));

  let w = 0;
  for (let i = 0; i < count; i++) {
    // fibonacci sphere for even coverage
    let y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    let x = Math.cos(theta) * r;
    let z = Math.sin(theta) * r;

    // gyri: radial displacement from folded noise
    const fold = fbm(noise, x * 2.1, y * 2.1, z * 2.1);
    const disp = 1 + fold * 0.14;

    // shape into ellipsoid + folds
    let px = x * rx * disp;
    let py = y * ry * disp;
    let pz = z * rz * disp;

    // frontal lobes a touch fuller, temporal lobes flare outward low & front
    if (pz > 0.4) px *= 1.05;
    if (py < -0.2 && pz > -0.2) px *= 1.12;

    // central longitudinal fissure: press particles away from the x≈0 top seam
    const seam = Math.exp(-(px * px) / 0.02) * Math.max(0, py + 0.1);
    py -= seam * 0.16;

    // flatten the underside slightly (brain sits on the brain-stem)
    if (py < -0.55) py = -0.55 + (py + 0.55) * 0.5;

    positions[w * 3] = px;
    positions[w * 3 + 1] = py;
    positions[w * 3 + 2] = pz;
    seeds[w] = Math.random();
    w++;
  }

  // --- sparse connectome: link nearby particles via a spatial hash grid ---
  const cell = 0.22;
  const grid = new Map();
  const key = (a, b, c) => `${a}|${b}|${c}`;
  for (let i = 0; i < count; i++) {
    const gx = Math.floor(positions[i * 3] / cell);
    const gy = Math.floor(positions[i * 3 + 1] / cell);
    const gz = Math.floor(positions[i * 3 + 2] / cell);
    const k = key(gx, gy, gz);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  const lineIdx = [];
  const maxLinks = 2000;
  const step = Math.max(1, Math.floor(count / 900));
  for (let i = 0; i < count && lineIdx.length < maxLinks * 2; i += step) {
    const gx = Math.floor(positions[i * 3] / cell);
    const gy = Math.floor(positions[i * 3 + 1] / cell);
    const gz = Math.floor(positions[i * 3 + 2] / cell);
    let linked = 0;
    for (let dx = -1; dx <= 1 && linked < 2; dx++)
      for (let dy = -1; dy <= 1 && linked < 2; dy++)
        for (let dz = -1; dz <= 1 && linked < 2; dz++) {
          const bucket = grid.get(key(gx + dx, gy + dy, gz + dz));
          if (!bucket) continue;
          for (const j of bucket) {
            if (j <= i) continue;
            const ddx = positions[i * 3] - positions[j * 3];
            const ddy = positions[i * 3 + 1] - positions[j * 3 + 1];
            const ddz = positions[i * 3 + 2] - positions[j * 3 + 2];
            const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d2 > 0.006 && d2 < 0.05) { lineIdx.push(i, j); linked++; if (linked >= 2) break; }
          }
        }
  }

  return {
    positions, seeds, count,
    lineIndices: new Uint32Array(lineIdx),
    bounds: { rx, ry, rz },
  };
}
