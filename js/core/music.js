/*
 * Original music, composed procedurally from fixed chord progressions and a
 * seeded motif generator (deterministic: the same tune every time).
 * Output is pure data: per-16th-step event lists consumed by the audio
 * sequencer. Loop lengths:
 *   theme   120 BPM x 16 bars = 32 s   (cheerful adventure)
 *   forest   80 BPM x 20 bars = 60 s   (peaceful)
 *   canyon   96 BPM x 24 bars = 60 s   (curious exploration)
 *   volcano 120 BPM x 30 bars = 60 s   (mildly tense)
 *   runner  168 BPM x 16 bars        (urgent fast beat)
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.DME = root.DME || {}).Music = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const QUAL = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], sus: [0, 5, 7], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10] };

  function chord(name) {
    const m = /^([A-G][b#]?)(m7|m|dim|sus|7)?$/.exec(name);
    const root = PC[m[1]];
    const q = m[2] === 'm' ? 'min' : m[2] || 'maj';
    return { root, pcs: QUAL[q].map((x) => (root + x) % 12), name };
  }

  function rngFrom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function scaleNotes(pcs, low, high) {
    const out = [];
    for (let m = low; m <= high; m++) if (pcs.includes(((m % 12) + 12) % 12)) out.push(m);
    return out;
  }
  function nearestIndex(list, midi) {
    let best = 0;
    for (let i = 1; i < list.length; i++) if (Math.abs(list[i] - midi) < Math.abs(list[best] - midi)) best = i;
    return best;
  }
  function nearestChordTone(midi, pcs, low, high) {
    let best = null;
    for (let d = 0; d <= 12; d++) {
      for (const c of [midi - d, midi + d]) {
        if (c >= low && c <= high && pcs.includes(((c % 12) + 12) % 12)) return c;
      }
    }
    return best === null ? midi : best;
  }
  function voiceChord(ch, low) {
    // Close voicing at or above `low`
    const out = [];
    let base = low;
    for (const pc of ch.pcs.slice(0, 3)) {
      let m = base;
      while (((m % 12) + 12) % 12 !== pc) m++;
      out.push(m);
      base = m + 1;
    }
    return out;
  }

  class Score {
    constructor(bpm, bars) {
      this.bpm = bpm;
      this.bars = bars;
      this.totalSteps = bars * 16;
      this.events = Array.from({ length: this.totalSteps }, () => []);
    }
    add(step, i, m, d, v) {
      if (step < 0 || step >= this.totalSteps) return;
      this.events[step].push({ i, m, d, v });
    }
    get stepSeconds() {
      return 60 / this.bpm / 4;
    }
    get loopSeconds() {
      return this.totalSteps * this.stepSeconds;
    }
  }

  /**
   * Motif-based melody. plan: one letter per 2 bars, e.g. "ABAC".
   * Repeated letters reuse rhythm and contour, adapted to the chords.
   */
  function writeMelody(score, opts) {
    const g = rngFrom(opts.seed);
    const scale = scaleNotes(opts.scale, opts.low, opts.high);
    const motifs = {};
    let cur = opts.start;
    for (let seg = 0; seg < opts.plan.length; seg++) {
      const L = opts.plan[seg];
      if (L === '-') continue; // rest segment
      if (!motifs[L]) {
        const rhythm = opts.rhythms[Math.floor(g() * opts.rhythms.length)];
        const moves = rhythm.map(() => opts.moves[Math.floor(g() * opts.moves.length)]);
        motifs[L] = { rhythm, moves };
      }
      const { rhythm, moves } = motifs[L];
      rhythm.forEach(([off, dur], k) => {
        const step = seg * 32 + off + (opts.offsetSteps || 0);
        const bar = Math.min(opts.chords.length - 1, Math.floor(step / 16));
        const ch = opts.chords[bar];
        let idx = Math.max(0, Math.min(scale.length - 1, nearestIndex(scale, cur) + moves[k]));
        let note = scale[idx];
        const strong = off % 8 === 0;
        const last = k === rhythm.length - 1 && seg % 2 === 1;
        if (strong || last) note = nearestChordTone(note, last ? [ch.root] : ch.pcs, opts.low, opts.high);
        score.add(step, opts.inst, note, dur, opts.vel * (strong ? 1 : 0.85));
        cur = note;
      });
    }
  }

  function bassLine(score, chords, pattern, inst, vel, octaveBase) {
    chords.forEach((ch, bar) => {
      const root = octaveBase + ((ch.root - (octaveBase % 12) + 12) % 12);
      const fifth = root + 7;
      pattern.forEach(([off, kind, dur]) => {
        const m = kind === 'r' ? root : kind === 'f' ? fifth : kind === 'o' ? root + 12 : kind === 'l' ? root - 5 : root;
        score.add(bar * 16 + off, inst, m, dur, vel);
      });
    });
  }

  function drums(score, bars, map, fromBar, toBar) {
    for (let bar = fromBar || 0; bar < (toBar || bars); bar++) {
      for (const [inst, steps, vel] of map) steps.forEach((s) => score.add(bar * 16 + s, inst, 0, 1, vel));
    }
  }

  // ---------------- Tracks ----------------
  function theme() {
    const s = new Score(120, 16);
    const chords = ['C', 'G', 'Am', 'F', 'C', 'F', 'G', 'C', 'Am', 'F', 'C', 'G', 'F', 'G', 'C', 'C'].map(chord);
    bassLine(s, chords, [[0, 'r', 3], [3, 'f', 2], [6, 'o', 2], [8, 'r', 3], [11, 'f', 2], [14, 'o', 2]], 'bass', 0.32, 36);
    chords.forEach((ch, bar) => {
      const v = voiceChord(ch, 60);
      [2, 6, 10, 14].forEach((o) => v.forEach((m) => s.add(bar * 16 + o, 'pluck', m, 1, 0.09)));
    });
    writeMelody(s, {
      seed: 11, inst: 'lead', vel: 0.2, low: 67, high: 86, start: 72, plan: 'ABACABAD', chords,
      scale: [0, 2, 4, 5, 7, 9, 11],
      moves: [1, 1, 2, -1, -1, -2, 0, 3, -3],
      rhythms: [
        [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4], [16, 6], [24, 2], [26, 2], [28, 4]],
        [[0, 3], [3, 1], [4, 2], [6, 2], [8, 4], [12, 4], [16, 2], [18, 2], [20, 2], [22, 2], [24, 8]],
        [[0, 4], [4, 2], [6, 2], [8, 6], [16, 2], [18, 2], [20, 4], [24, 4], [28, 4]],
      ],
    });
    // Sparkle bells every 4 bars
    for (let bar = 0; bar < 16; bar += 4) s.add(bar * 16, 'bell', 84 + (chords[bar].root % 12 === 0 ? 0 : 0), 8, 0.08);
    drums(s, 16, [['kick', [0, 8, 10], 0.5], ['snare', [4, 12], 0.22], ['hat', [0, 2, 4, 6, 8, 10, 12, 14], 0.06]]);
    return s;
  }

  function forest() {
    const s = new Score(80, 20);
    const names = ['F', 'Am', 'Bb', 'F', 'Dm', 'Bb', 'C', 'C', 'F', 'Am', 'Bb', 'F', 'Gm', 'Bb', 'C', 'F', 'Bb', 'C', 'F', 'F'];
    const chords = names.map(chord);
    chords.forEach((ch, bar) => {
      voiceChord(ch, 53).forEach((m) => s.add(bar * 16, 'pad', m, 16, 0.06));
      s.add(bar * 16, 'softbass', 41 + ((ch.root - 5 + 12) % 12), 12, 0.22);
      // gentle marimba arpeggio, up then down
      const v = voiceChord(ch, 65);
      const arp = [v[0], v[1], v[2], v[0] + 12, v[2], v[1]];
      [0, 2, 4, 6, 8, 10, 12, 14].forEach((o, k) => s.add(bar * 16 + o, 'marimba', arp[k % arp.length], 2, 0.1));
    });
    writeMelody(s, {
      seed: 23, inst: 'flute', vel: 0.16, low: 69, high: 86, start: 77, plan: 'A-BAC-BD-E', chords,
      scale: [5, 7, 9, 10, 0, 2, 4],
      moves: [1, -1, 2, -2, 0, 1, -1],
      rhythms: [
        [[0, 6], [6, 2], [8, 8], [16, 4], [20, 4], [24, 8]],
        [[0, 4], [4, 4], [8, 4], [12, 4], [16, 12]],
        [[0, 8], [8, 4], [12, 4], [16, 6], [22, 2], [24, 8]],
      ],
    });
    // birds chirp now and then
    [3, 7, 9, 13, 17, 19].forEach((bar, k) => s.add(bar * 16 + (k % 2 ? 6 : 10), 'chirp', 96, 1, 0.05));
    drums(s, 20, [['shaker', [4, 12], 0.035]], 4, 18);
    return s;
  }

  function canyon() {
    const s = new Score(96, 24);
    const names = ['Dm', 'G', 'Dm', 'G', 'F', 'Em', 'Dm', 'A', 'Dm', 'G', 'Dm', 'G', 'C', 'Am', 'Em', 'A', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'Dm', 'A'];
    const chords = names.map(chord);
    bassLine(s, chords, [[0, 'r', 2], [4, 'f', 2], [8, 'o', 2], [12, 'f', 2]], 'pizz', 0.28, 38);
    chords.forEach((ch, bar) => {
      const v = voiceChord(ch, 62);
      [3, 11].forEach((o) => v.forEach((m) => s.add(bar * 16 + o, 'pluck', m, 1, 0.06)));
    });
    writeMelody(s, {
      seed: 37, inst: 'marimba', vel: 0.2, low: 69, high: 88, start: 74, plan: 'AB-CAB-DEF-G',
      chords, scale: [2, 4, 5, 7, 9, 11, 0],
      moves: [1, 2, -1, 3, -2, 1, 0, -1],
      rhythms: [
        [[0, 2], [3, 1], [4, 2], [8, 2], [10, 2], [12, 4], [20, 2], [22, 2], [24, 4]],
        [[0, 1], [2, 1], [4, 2], [6, 2], [8, 4], [16, 2], [19, 1], [20, 4], [26, 6]],
      ],
    });
    for (let bar = 0; bar < 24; bar += 2) s.add(bar * 16 + 14, 'bell', 86, 4, 0.04);
    drums(s, 24, [['wood', [2, 7, 10, 14], 0.07], ['shaker', [0, 4, 8, 12], 0.03]]);
    return s;
  }

  function volcano() {
    const s = new Score(120, 30);
    const names = ['Am', 'Am', 'F', 'E', 'Am', 'Am', 'Dm', 'E', 'F', 'G', 'Am', 'E', 'Am', 'Dm', 'F', 'E',
      'Am', 'Am', 'F', 'E', 'Dm', 'Dm', 'Am', 'E', 'F', 'G', 'E', 'E', 'Am', 'Am'];
    const chords = names.map(chord);
    bassLine(s, chords, [[0, 'r', 1], [2, 'r', 1], [4, 'o', 1], [6, 'r', 1], [8, 'r', 1], [10, 'r', 1], [12, 'o', 1], [14, 'f', 1]], 'sawbass', 0.2, 33);
    chords.forEach((ch, bar) => {
      voiceChord(ch, 57).forEach((m) => s.add(bar * 16, 'pad', m, 16, 0.045));
    });
    writeMelody(s, {
      seed: 59, inst: 'brass', vel: 0.13, low: 64, high: 81, start: 69, plan: '-AB-AC-DE-AB-F-',
      chords, scale: [9, 11, 0, 2, 4, 5, 8],
      moves: [1, -1, 0, 2, -2, 1],
      rhythms: [
        [[0, 6], [6, 2], [8, 8], [16, 6], [22, 2], [24, 8]],
        [[0, 4], [4, 4], [8, 8], [16, 8], [24, 8]],
      ],
    });
    drums(s, 30, [['tom', [0, 6, 8], 0.3], ['hat', [4, 12], 0.04]]);
    [0, 8, 16, 24].forEach((bar) => s.add(bar * 16, 'rumble', 0, 16, 0.12));
    return s;
  }

  function runner() {
    const s = new Score(168, 16);
    const names = ['Em', 'C', 'D', 'B', 'Em', 'C', 'D', 'B', 'C', 'D', 'Em', 'Em', 'C', 'D', 'B', 'B'];
    const chords = names.map(chord);
    bassLine(s, chords, [[0, 'r', 1], [2, 'o', 1], [4, 'r', 1], [6, 'o', 1], [8, 'r', 1], [10, 'o', 1], [12, 'r', 1], [14, 'o', 1]], 'sawbass', 0.24, 28);
    chords.forEach((ch, bar) => {
      const v = voiceChord(ch, 64);
      const arp = [v[0], v[1], v[2], v[1]];
      for (let k = 0; k < 16; k++) s.add(bar * 16 + k, 'pluck', arp[k % 4] + (k >= 8 ? 12 : 0), 1, 0.06);
    });
    writeMelody(s, {
      seed: 71, inst: 'lead', vel: 0.15, low: 64, high: 83, start: 71, plan: 'AABAAABC',
      chords, scale: [4, 6, 7, 9, 11, 0, 2, 3],
      moves: [1, -1, 2, -2, 0],
      rhythms: [
        [[0, 2], [2, 2], [4, 2], [6, 2], [8, 4], [12, 4], [16, 2], [18, 2], [20, 4], [24, 8]],
        [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2], [16, 8], [24, 4], [28, 4]],
      ],
    });
    drums(s, 16, [['kick', [0, 4, 8, 12], 0.55], ['snare', [4, 12], 0.26], ['hat', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 0.035]]);
    return s;
  }

  const BUILDERS = { theme, forest, canyon, volcano, runner };
  const cache = {};
  function getTrack(name) {
    if (!BUILDERS[name]) throw new Error('unknown track ' + name);
    return cache[name] || (cache[name] = BUILDERS[name]());
  }

  return { getTrack, TRACKS: Object.keys(BUILDERS), chord, Score };
});
