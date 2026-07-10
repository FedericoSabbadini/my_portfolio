/* =========================================================================
   synapses.js — luminous pulses that travel along the connectome edges,
   like signals firing between neurons. Rendered as additive points so the
   bloom pass makes them glow.
   ========================================================================= */
import * as THREE from 'three';

export class Synapses {
  /**
   * @param {Float32Array} positions particle positions (xyz triples)
   * @param {Uint32Array}  lineIndices pairs of particle indices = edges
   * @param {number} pulseCount how many pulses travel at once
   */
  constructor(positions, lineIndices, pulseCount = 90) {
    this.positions = positions;
    this.edges = lineIndices;
    this.edgeCount = lineIndices.length / 2;
    this.n = Math.min(pulseCount, Math.max(1, this.edgeCount));

    this.edgeOf = new Int32Array(this.n);
    this.t = new Float32Array(this.n);
    this.speed = new Float32Array(this.n);

    const geo = new THREE.BufferGeometry();
    this.buf = new Float32Array(this.n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.buf, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.07,
      color: new THREE.Color(0x9fe9ff),
      map: Synapses._sprite(),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;

    for (let i = 0; i < this.n; i++) this._respawn(i);
  }

  static _sprite() {
    if (Synapses.__tex) return Synapses.__tex;
    const s = 64;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(200,240,255,0.9)');
    g.addColorStop(1, 'rgba(160,230,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); ctx.fill();
    Synapses.__tex = new THREE.CanvasTexture(cv);
    return Synapses.__tex;
  }

  _respawn(i) {
    this.edgeOf[i] = (Math.random() * this.edgeCount) | 0;
    this.t[i] = 0;
    this.speed[i] = 0.35 + Math.random() * 0.9;
  }

  update(dt, activity = 0) {
    const spd = 1 + activity * 1.6;
    for (let i = 0; i < this.n; i++) {
      this.t[i] += dt * this.speed[i] * spd;
      if (this.t[i] >= 1) this._respawn(i);
      const e = this.edgeOf[i];
      const a = this.edges[e * 2] * 3;
      const b = this.edges[e * 2 + 1] * 3;
      const tt = this.t[i];
      this.buf[i * 3] = this.positions[a] + (this.positions[b] - this.positions[a]) * tt;
      this.buf[i * 3 + 1] = this.positions[a + 1] + (this.positions[b + 1] - this.positions[a + 1]) * tt;
      this.buf[i * 3 + 2] = this.positions[a + 2] + (this.positions[b + 2] - this.positions[a + 2]) * tt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.material.opacity = 0.7 + activity * 0.3;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
