'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../js/runner/runner-logic.js');
const Music = require('../../js/core/music.js');
const { AudioEngine, MAX_RATE, MIN_RATE } = require('../../js/core/audio.js');

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

// ---------------- runner ----------------
test('speed starts at 280 and grows 12 px/s per second with no cap', () => {
  assert.equal(R.speedAt(0), 280);
  assert.equal(R.speedAt(10), 400);
  assert.equal(R.speedAt(100), 1480);
  assert.ok(R.speedAt(1000) > 12000);
});

test('spawn interval strictly decreases with speed and has no fixed floor', () => {
  let prev = Infinity;
  for (let v = 280; v <= 20000; v += 20) {
    const i = R.spawnInterval(v);
    assert.ok(i > 0 && i < prev, `at ${v}`);
    prev = i;
  }
  assert.ok(R.spawnInterval(650) > R.spawnInterval(900), 'keeps shrinking after 650');
  assert.ok(R.spawnInterval(100000) < 0.02, 'approaches zero');
});

test('group sizes appear at the thresholds and widen with speed', () => {
  const sizesAt = (v) => {
    const rng = rngFrom(v);
    const c = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) c[R.pickGroupSize(v, rng) - 1]++;
    return c;
  };
  assert.deepEqual(sizesAt(300).slice(1), [0, 0, 0], 'singles only early');
  const a = sizesAt(400);
  assert.ok(a[1] > 0 && a[2] === 0 && a[3] === 0, 'pairs from ~380');
  const b = sizesAt(500);
  assert.ok(b[2] > 0 && b[3] === 0, 'triples from ~480');
  const c = sizesAt(620);
  assert.ok(c[3] > 0, 'quadruples from ~600');
  const d = sizesAt(1200);
  assert.ok(d.every((n) => n > 200), 'variety kept at high speed: ' + d);
  const wide = (x) => (x[2] + x[3]) / 4000;
  assert.ok(wide(d) > wide(c), 'wider groups become more common');
});

test('groups: separate adjacent bodies, brachio ~2x standard length', () => {
  const g = R.makeGroup(4, 1000, rngFrom(1), { forceTypes: ['brachio', 'rock', 'tree', 'skull'] });
  assert.equal(g.length, 4);
  for (let i = 1; i < g.length; i++) {
    const prev = g[i - 1];
    assert.ok(g[i].x >= prev.x + prev.w + 10, 'visible gap, no overlap');
    const hb1 = R.hitbox(prev), hb2 = R.hitbox(g[i]);
    assert.ok(hb1.x + hb1.w < hb2.x, 'distinct collision bodies');
  }
  const std = ['tree', 'rock', 'skull', 'skeleton'].map((t) => R.TYPES[t].w);
  const avg = std.reduce((a, b) => a + b) / std.length;
  assert.ok(R.TYPES.brachio.w / avg > 1.8 && R.TYPES.brachio.w / avg < 2.4);
  // brachio is still generated naturally
  const rng = rngFrom(5);
  let found = false;
  for (let i = 0; i < 300 && !found; i++) found = R.makeGroup(2, 0, rng).some((o) => o.type === 'brachio');
  assert.ok(found);
});

test('jump physics: single jump only, apex and air time', () => {
  const s = new R.RunnerSim({ rng: rngFrom(2) });
  s.nextSpawn = 1e9; // no obstacles for this test
  s.start();
  assert.equal(s.jump(), true);
  assert.equal(s.jump(), false, 'no double jump in the air');
  let apex = 0, t = 0;
  while (!s.grounded && t < 3) {
    s.step(1 / 240);
    t += 1 / 240;
    apex = Math.max(apex, s.y);
    if (t > 0.05 && t < 0.3) assert.equal(s.jump(), false);
  }
  const expectedApex = (R.CFG.jumpVelocity ** 2) / (2 * R.CFG.gravity);
  assert.ok(Math.abs(apex - expectedApex) < 4, `apex ${apex}`);
  const expectedAir = (2 * R.CFG.jumpVelocity) / R.CFG.gravity;
  // the buffered press near landing may trigger one new jump after landing
  assert.ok(Math.abs(t - expectedAir) < 0.03, `air ${t}`);
});

test('collisions: grounded player hits obstacle; airborne player clears it', () => {
  const s = new R.RunnerSim({ rng: rngFrom(3) });
  s.start();
  s.nextSpawn = 1e9;
  s.obstacles = R.makeGroup(1, R.CFG.playerX + 10, rngFrom(1), { forceTypes: ['rock'] });
  s.step(1 / 120);
  assert.equal(s.state, 'over');
  assert.equal(s.hit.type, 'rock');

  const s2 = new R.RunnerSim({ rng: rngFrom(3) });
  s2.start();
  s2.nextSpawn = 1e9;
  s2.jump();
  for (let i = 0; i < 20; i++) s2.step(1 / 120); // rise well above the rock
  s2.obstacles = R.makeGroup(1, R.CFG.playerX + 10, rngFrom(1), { forceTypes: ['rock'] });
  s2.step(1 / 120);
  assert.equal(s2.state, 'running');
});

test('every group is jumpable at the speed it is introduced', () => {
  const widest = (n) => {
    const ws = Object.values(R.TYPES).map((t) => t.w).sort((a, b) => b - a);
    // at most one brachio per group, then the widest standard ones
    return ws.slice(0, n).reduce((a, b) => a + b, 0) + (n - 1) * R.CFG.groupGap;
  };
  const clear = (n, v) => R.jumpDistance(v) > widest(n) + R.CFG.playerBox.w;
  assert.ok(clear(1, 280));
  assert.ok(clear(2, R.CFG.pairSpeed));
  assert.ok(clear(3, R.CFG.tripleSpeed));
  assert.ok(clear(4, R.CFG.quadSpeed));
});

test('long simulation with an auto-jumper: accelerates past 650 and spawns 1-4 groups', () => {
  const s = new R.RunnerSim({ rng: rngFrom(9), viewWidth: 900 });
  s.start();
  const dt = 1 / 120;
  let intervals = [];
  let lastSpawnT = 0, lastGroups = 0;
  for (let i = 0; i < 120 * 60; i++) {
    // invincible test driver: remove obstacles reaching the player
    const reach = s.speed * dt * 2 + 4;
    s.obstacles = s.obstacles.filter((o) => o.x > R.CFG.playerX + R.CFG.playerBox.w + reach || o.x + o.w < R.CFG.playerX - 2);
    s.step(dt);
    if (s.groups !== lastGroups) {
      intervals.push({ t: s.t, dt: s.t - lastSpawnT, speed: s.speed });
      lastSpawnT = s.t;
      lastGroups = s.groups;
    }
  }
  assert.equal(s.state, 'running');
  assert.ok(s.speed > 650 + 300, 'speed ' + s.speed);
  assert.ok(Math.abs(s.speed - R.speedAt(s.t)) < 1e-6);
  assert.ok(s.groupSizes.every((n) => n > 0), 'sizes ' + s.groupSizes);
  const early = intervals.slice(1, 6).map((x) => R.spawnInterval(x.speed));
  const late = intervals.slice(-5).map((x) => R.spawnInterval(x.speed));
  assert.ok(Math.max(...late) < Math.min(...early), 'spawn intervals keep decreasing');
});

// ---------------- music data ----------------
test('stage tracks loop in exactly 60 seconds', () => {
  for (const name of ['forest', 'canyon', 'volcano']) {
    const t = Music.getTrack(name);
    assert.ok(Math.abs(t.loopSeconds - 60) < 1e-9, `${name} ${t.loopSeconds}`);
    const notes = t.events.reduce((a, e) => a + e.length, 0);
    assert.ok(notes > 200, `${name} has content`);
  }
  for (const name of Music.TRACKS) assert.ok(Music.getTrack(name).events.some((e) => e.length));
});

// ---------------- audio engine with a fake AudioContext ----------------
function fakeParam(v) {
  return {
    value: v,
    setValueAtTime(x) { this.value = x; },
    linearRampToValueAtTime(x) { this.value = x; },
    exponentialRampToValueAtTime(x) { this.value = x; },
    setTargetAtTime() {},
    cancelScheduledValues() {},
  };
}
function fakeNode() {
  return {
    connected: true,
    connect() {},
    disconnect() { this.connected = false; },
    start() {}, stop() {},
    gain: fakeParam(1), frequency: fakeParam(440), detune: fakeParam(0), Q: fakeParam(1),
    type: 'sine', buffer: null,
  };
}
function fakeCtx(opts) {
  const listeners = [];
  const ctx = {
    state: 'suspended', currentTime: 0, sampleRate: 8000, destination: fakeNode(), created: 0,
    allowResume: opts && opts.allowResume !== undefined ? opts.allowResume : true,
    resumeDelay: 0,
    addEventListener(t, f) { listeners.push(f); },
    _set(s) { this.state = s; listeners.forEach((f) => f()); },
    resume() {
      return new Promise((res, rej) => {
        setTimeout(() => {
          if (this.allowResume) { this._set('running'); res(); } else rej(new Error('blocked'));
        }, this.resumeDelay);
      });
    },
    suspend() { this._set('suspended'); return Promise.resolve(); },
    createGain() { this.created++; return fakeNode(); },
    createOscillator() { this.created++; return fakeNode(); },
    createBiquadFilter() { this.created++; return fakeNode(); },
    createBufferSource() { this.created++; return fakeNode(); },
    createDynamicsCompressor() { return fakeNode(); },
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; },
  };
  return ctx;
}

test('audio: blocked autoplay waits, gesture unlock starts the CURRENT track', async () => {
  const ctx = fakeCtx({ allowResume: false });
  const a = new AudioEngine({ ctxFactory: () => ctx });
  a.setTrack('theme');
  assert.equal(await a.unlock(), false);
  assert.equal(a.seq, null);
  ctx.allowResume = true;
  ctx.resumeDelay = 20;
  const p = a.unlock();
  a.setTrack('forest'); // user navigated while the unlock was pending
  await p;
  assert.equal(a.seq.name, 'forest', 'delayed unlock never restarts an old track');
  a.seq.stop();
});

test('audio: switching tracks never overlaps; same track is continuous', async () => {
  const ctx = fakeCtx();
  const a = new AudioEngine({ ctxFactory: () => ctx });
  a.setTrack('theme');
  await a.unlock();
  const first = a.seq;
  a.setTrack('canyon');
  assert.equal(first.stopped, true);
  assert.equal(a.seq.name, 'canyon');
  const canyon = a.seq;
  a.setTrack('canyon'); // map -> question: same stage music continues
  assert.equal(a.seq, canyon);
  assert.equal(canyon.stopped, false);
  a.setTrack('volcano');
  assert.equal(canyon.stopped, true);
  a.seq.stop();
});

test('audio: music and sfx settings are independent', async () => {
  const ctx = fakeCtx();
  const a = new AudioEngine({ ctxFactory: () => ctx, music: false });
  a.setTrack('theme');
  await a.unlock();
  assert.equal(a.seq, null, 'music off');
  assert.equal(a.play('correct'), true, 'sfx still on');
  a.setSfxEnabled(false);
  assert.equal(a.play('tap'), false);
  a.setMusicEnabled(true);
  assert.equal(a.seq.name, 'theme');
  a.setMusicEnabled(false);
  assert.equal(a.seq, null);
});

test('audio: overlapping effects do not cancel each other', async () => {
  const ctx = fakeCtx();
  const a = new AudioEngine({ ctxFactory: () => ctx, music: false });
  await a.unlock();
  const before = ctx.created;
  assert.equal(a.play('correct'), true);
  const mid = ctx.created;
  assert.equal(a.play('tap'), true);
  assert.equal(a.play('crunch'), true);
  assert.equal(a.play('key'), true);
  assert.ok(mid > before && ctx.created > mid, 'each effect gets its own nodes');
  assert.equal(a.sfxCount, 4);
});

test('audio: playback rate validation never throws and clamps', async () => {
  const ctx = fakeCtx();
  const a = new AudioEngine({ ctxFactory: () => ctx });
  a.setTrack('runner');
  await a.unlock();
  for (const bad of [NaN, Infinity, -Infinity, -2, 0, 'abc', undefined, null, {}]) {
    assert.doesNotThrow(() => a.setRate(bad));
    assert.equal(a.rate, 1);
  }
  a.setRate(1.5);
  assert.equal(a.seq.rate, 1.5);
  a.setRate(50);
  assert.equal(a.rate, MAX_RATE);
  a.setRate(0.1);
  assert.equal(a.rate, MIN_RATE);
  a.setTrack('theme');
  assert.equal(a.rate, 1, 'rate resets when the track changes');
  a.seq.stop();
});

test('audio: faster rate schedules more steps; backgrounding pauses and skips', async () => {
  const ctx = fakeCtx();
  const a = new AudioEngine({ ctxFactory: () => ctx });
  a.setTrack('runner');
  await a.unlock();
  const seq = a.seq;
  seq.pause();
  const run = (rate, secs) => {
    seq.rate = rate;
    seq.step = 0;
    seq.nextTime = ctx.currentTime;
    const startStep = 0;
    let steps = 0;
    const end = ctx.currentTime + secs;
    while (ctx.currentTime < end) {
      const s0 = seq.step;
      seq.tick();
      steps += (seq.step - s0 + seq.track.totalSteps) % seq.track.totalSteps;
      ctx.currentTime += 0.025;
    }
    return steps + startStep;
  };
  const n1 = run(1, 2);
  const n2 = run(2, 2);
  assert.ok(n2 > n1 * 1.8 && n2 < n1 * 2.2, `${n1} vs ${n2}`);
  // hidden: suspend + pause; long gap; visible: resumes without a burst
  a.onHidden();
  assert.equal(seq.timer, null);
  ctx.currentTime += 30;
  await a.onVisible();
  const before = seq.scheduledCount;
  seq.tick();
  const burst = seq.scheduledCount - before;
  assert.ok(burst < 60, 'no burst of missed notes: ' + burst);
  assert.ok(seq.nextTime > ctx.currentTime - 0.01);
  seq.stop();
});
