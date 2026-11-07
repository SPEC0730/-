/*
 * Spinosaurus runner simulation (no DOM, no canvas).
 * Difficulty has NO gameplay caps: speed grows linearly forever and the
 * spawn interval keeps shrinking toward zero without a fixed minimum.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.DME = root.DME || {}).RunnerLogic = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CFG = {
    startSpeed: 280, // world px / s
    accel: 12, // px / s per second
    gravity: 2600, // px / s^2
    jumpVelocity: 900, // px / s
    jumpBuffer: 0.1, // s: a press just before landing jumps on landing
    playerX: 110, // left edge of the player's hitbox (world px)
    playerBox: { w: 58, h: 54 }, // forgiving hitbox
    groupGap: 14, // visible gap between adjacent obstacles in a group
    baseInterval: 1.55, // s at start speed
    intervalExponent: 0.9,
    pairSpeed: 380,
    tripleSpeed: 480,
    quadSpeed: 600,
  };

  // Standard obstacles are ~40-60 px; the fallen Brachiosaurus is ~2x.
  const TYPES = {
    tree: { w: 40, h: 72, inset: 6 },
    rock: { w: 50, h: 38, inset: 5 },
    skull: { w: 44, h: 36, inset: 5 },
    skeleton: { w: 60, h: 44, inset: 6 },
    brachio: { w: 108, h: 42, inset: 6 },
  };
  const STANDARD = ['tree', 'rock', 'skull', 'skeleton'];

  function speedAt(t) {
    return CFG.startSpeed + CFG.accel * Math.max(0, t);
  }

  /** Strictly decreasing in speed, approaches 0, no floor. */
  function spawnInterval(speed) {
    return CFG.baseInterval * Math.pow(CFG.startSpeed / Math.max(1, speed), CFG.intervalExponent);
  }

  /** Relative weights for group sizes 1..4. Wider groups grow more common. */
  function groupWeights(speed) {
    const w = [1, 0, 0, 0];
    if (speed >= CFG.pairSpeed) w[1] = Math.min(1.3, 0.45 + (speed - CFG.pairSpeed) / 160);
    if (speed >= CFG.tripleSpeed) w[2] = Math.min(1.4, 0.35 + (speed - CFG.tripleSpeed) / 170);
    if (speed >= CFG.quadSpeed) w[3] = Math.min(1.6, 0.3 + (speed - CFG.quadSpeed) / 200);
    // Singles become rarer but never vanish (variety).
    if (speed >= CFG.pairSpeed) w[0] = Math.max(0.35, 1 - (speed - CFG.pairSpeed) / 500);
    return w;
  }

  function pickGroupSize(speed, rng) {
    const w = groupWeights(speed);
    const total = w.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < 4; i++) if ((r -= w[i]) < 0) return i + 1;
    return 1;
  }

  /** Create `size` adjacent obstacles starting at world x; each has its own hitbox. */
  function makeGroup(size, x, rng, opts) {
    opts = opts || {};
    const out = [];
    let cursor = x;
    let usedBrachio = false;
    for (let i = 0; i < size; i++) {
      let type;
      if (opts.forceTypes) type = opts.forceTypes[i];
      else if (!usedBrachio && rng() < 0.16) type = 'brachio';
      else type = STANDARD[Math.floor(rng() * STANDARD.length)];
      if (type === 'brachio') usedBrachio = true;
      const T = TYPES[type];
      out.push({
        type,
        x: cursor,
        w: T.w,
        h: T.h,
        inset: T.inset,
        seed: Math.floor(rng() * 1e6),
      });
      cursor += T.w + CFG.groupGap;
    }
    return out;
  }

  function hitbox(o) {
    return { x: o.x + o.inset, y: 0, w: o.w - o.inset * 2, h: o.h - o.inset };
  }

  /** Player and obstacle boxes in "height above ground" coordinates. */
  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /** Horizontal distance covered during one full jump at a speed. */
  function jumpDistance(speed) {
    return speed * ((2 * CFG.jumpVelocity) / CFG.gravity);
  }

  class RunnerSim {
    constructor(opts) {
      opts = opts || {};
      this.rng = opts.rng || Math.random;
      this.viewWidth = opts.viewWidth || 800;
      this.reset();
    }
    reset() {
      this.state = 'ready'; // ready | running | over
      this.t = 0;
      this.speed = CFG.startSpeed;
      this.distance = 0;
      this.y = 0;
      this.vy = 0;
      this.grounded = true;
      this.bufferedJump = 0;
      this.obstacles = [];
      this.groups = 0;
      this.groupSizes = [0, 0, 0, 0];
      this.nextSpawn = 1.1; // first obstacle after a short calm moment
      this.hit = null;
      this.jumps = 0;
    }
    get score() {
      return Math.floor(this.distance / 25);
    }
    start() {
      if (this.state === 'ready') this.state = 'running';
    }
    /** Returns true if a jump actually started. No double jumps. */
    jump() {
      if (this.state === 'ready') this.start();
      if (this.state !== 'running') return false;
      if (this.grounded) {
        this.vy = CFG.jumpVelocity;
        this.grounded = false;
        this.bufferedJump = 0;
        this.jumps++;
        return true;
      }
      this.bufferedJump = CFG.jumpBuffer;
      return false;
    }
    playerBox() {
      return { x: CFG.playerX, y: this.y, w: CFG.playerBox.w, h: CFG.playerBox.h };
    }
    spawn() {
      const size = pickGroupSize(this.speed, this.rng);
      const group = makeGroup(size, this.viewWidth + 40, this.rng);
      group.forEach((o) => (o.group = this.groups));
      this.obstacles.push(...group);
      this.groups++;
      this.groupSizes[size - 1]++;
      const last = group[group.length - 1];
      const width = last.x + last.w - group[0].x;
      // Next group: speed-dependent interval measured from this group's end.
      const jitter = 0.85 + this.rng() * 0.3;
      this.nextSpawn = spawnInterval(this.speed) * jitter + width / this.speed;
      return group;
    }
    step(dt) {
      if (this.state !== 'running') return;
      this.t += dt;
      this.speed = speedAt(this.t);
      const dx = this.speed * dt;
      this.distance += dx;

      // Player physics
      if (!this.grounded) {
        this.vy -= CFG.gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.grounded = true;
          if (this.bufferedJump > 0) this.jump();
        }
      }
      if (this.bufferedJump > 0) this.bufferedJump = Math.max(0, this.bufferedJump - dt);

      // Obstacles
      for (const o of this.obstacles) o.x -= dx;
      this.obstacles = this.obstacles.filter((o) => o.x + o.w > -60);
      this.nextSpawn -= dt;
      if (this.nextSpawn <= 0) this.spawn();

      // Collisions: every obstacle has its own body.
      const p = this.playerBox();
      for (const o of this.obstacles) {
        if (overlaps(p, hitbox(o))) {
          this.state = 'over';
          this.hit = o;
          break;
        }
      }
    }
  }

  return {
    CFG,
    TYPES,
    speedAt,
    spawnInterval,
    groupWeights,
    pickGroupSize,
    makeGroup,
    hitbox,
    overlaps,
    jumpDistance,
    RunnerSim,
  };
});
