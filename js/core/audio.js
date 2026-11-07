/*
 * Web Audio engine: synthesized instruments, a look-ahead music sequencer and
 * sound effects. Reliability rules:
 *  - one music sequencer at a time; switching fades the old one out on its
 *    own gain node so tracks never overlap
 *  - every async resume continuation starts only the CURRENT desired track,
 *    so a delayed unlock can never restart an old track
 *  - effects use independent nodes, so button sounds never cut off the
 *    correct-answer or chewing sounds
 *  - setRate() validates and clamps; an unsupported value never throws
 *  - backgrounding suspends; returning resumes (or waits for a gesture)
 */
(function (root, factory) {
  const mod = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.DME = root.DME || {}).Audio = mod;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const MusicLib = (typeof module === 'object' && module.exports) ? require('./music.js') : root.DME.Music;

  const MIN_RATE = 0.5;
  const MAX_RATE = 2.4;
  const LOOKAHEAD = 0.15;
  const TICK_MS = 25;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- instrument voices ----------
  function env(g, t, a, peak, d, sustain, rel, end) {
    const p = g.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setTargetAtTime(peak * sustain, t + a, d);
    p.setTargetAtTime(0.0001, end, rel);
  }
  function osc(ctx, type, freq, t, stopAt) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(stopAt);
    return o;
  }
  function noiseBuffer(ctx) {
    if (ctx.__dmeNoise) return ctx.__dmeNoise;
    const len = Math.floor(ctx.sampleRate * 1.0);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    ctx.__dmeNoise = b;
    return b;
  }
  function noise(ctx, t, dur) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    return src;
  }
  function filter(ctx, type, freq, q) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q) f.Q.value = q;
    return f;
  }

  const VOICES = {
    lead(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const lp = filter(ctx, 'lowpass', 2600);
      const o = osc(ctx, 'square', f, t, t + dur + 0.4);
      const o2 = osc(ctx, 'triangle', f * 2, t, t + dur + 0.4);
      const g2 = ctx.createGain();
      g2.gain.value = 0.3;
      o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(out);
      env(g, t, 0.01, v, 0.15, 0.6, 0.08, t + dur);
    },
    flute(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const o = osc(ctx, 'sine', f, t, t + dur + 0.6);
      const lfo = osc(ctx, 'sine', 5, t, t + dur + 0.6);
      const lg = ctx.createGain();
      lg.gain.value = f * 0.006;
      lfo.connect(lg); lg.connect(o.frequency);
      const o2 = osc(ctx, 'triangle', f, t, t + dur + 0.6);
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
      env(g, t, 0.06, v, 0.3, 0.8, 0.15, t + dur);
    },
    marimba(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const o = osc(ctx, 'sine', f, t, t + 0.6);
      const o2 = osc(ctx, 'sine', f * 4, t, t + 0.15);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.25, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.55);
    },
    pluck(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const o = osc(ctx, 'triangle', f, t, t + 0.35);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3);
    },
    pizz(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const lp = filter(ctx, 'lowpass', 900);
      const o = osc(ctx, 'triangle', f, t, t + 0.3);
      o.connect(lp); lp.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.25);
    },
    bell(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const o = osc(ctx, 'sine', f, t, t + 1.4);
      const o2 = osc(ctx, 'sine', f * 2.76, t, t + 0.8);
      const g2 = ctx.createGain();
      g2.gain.value = 0.3;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 1.3);
    },
    pad(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const lp = filter(ctx, 'lowpass', 1000);
      const o = osc(ctx, 'sawtooth', f, t, t + dur + 1);
      const o2 = osc(ctx, 'sawtooth', f, t, t + dur + 1);
      o2.detune.value = 9;
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
      env(g, t, Math.min(0.5, dur * 0.3), v, 0.5, 0.85, 0.35, t + dur);
    },
    bass(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const lp = filter(ctx, 'lowpass', 700);
      const o = osc(ctx, 'square', f, t, t + dur + 0.3);
      o.connect(lp); lp.connect(g); g.connect(out);
      env(g, t, 0.01, v, 0.1, 0.5, 0.05, t + dur);
    },
    softbass(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const o = osc(ctx, 'triangle', f, t, t + dur + 0.6);
      o.connect(g); g.connect(out);
      env(g, t, 0.05, v, 0.6, 0.6, 0.2, t + dur);
    },
    sawbass(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const lp = filter(ctx, 'lowpass', 520, 4);
      const o = osc(ctx, 'sawtooth', f, t, t + dur + 0.2);
      o.connect(lp); lp.connect(g); g.connect(out);
      env(g, t, 0.005, v, 0.06, 0.4, 0.03, t + dur * 0.9);
    },
    brass(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const lp = filter(ctx, 'lowpass', 500);
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.linearRampToValueAtTime(1900, t + 0.12);
      lp.frequency.setTargetAtTime(1100, t + 0.12, 0.3);
      const o = osc(ctx, 'sawtooth', f, t, t + dur + 0.4);
      o.connect(lp); lp.connect(g); g.connect(out);
      env(g, t, 0.05, v, 0.3, 0.75, 0.12, t + dur);
    },
    kick(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      o.start(t); o.stop(t + 0.35);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    },
    snare(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const n = noise(ctx, t, 0.2);
      const hp = filter(ctx, 'highpass', 1400);
      n.connect(hp); hp.connect(g); g.connect(out);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      const tg = ctx.createGain();
      const o = osc(ctx, 'triangle', 190, t, t + 0.1);
      o.connect(tg); tg.connect(out);
      tg.gain.setValueAtTime(v * 0.6, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    },
    hat(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const n = noise(ctx, t, 0.06);
      const hp = filter(ctx, 'highpass', 7500);
      n.connect(hp); hp.connect(g); g.connect(out);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    },
    shaker(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const n = noise(ctx, t, 0.1);
      const bp = filter(ctx, 'bandpass', 6000, 1.5);
      n.connect(bp); bp.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    },
    wood(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const o = osc(ctx, 'sine', 1150, t, t + 0.08);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    },
    tom(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(115, t);
      o.frequency.exponentialRampToValueAtTime(62, t + 0.3);
      o.start(t); o.stop(t + 0.5);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    },
    rumble(ctx, out, t, f, dur, v) {
      const g = ctx.createGain();
      const n = noise(ctx, t, 1.0);
      const lp = filter(ctx, 'lowpass', 140);
      n.connect(lp); lp.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.0);
    },
    chirp(ctx, out, t, f, dur, v) {
      [0, 0.12].forEach((d) => {
        const g = ctx.createGain();
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(2600, t + d);
        o.frequency.exponentialRampToValueAtTime(3900, t + d + 0.07);
        o.start(t + d); o.stop(t + d + 0.1);
        o.connect(g); g.connect(out);
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.linearRampToValueAtTime(v, t + d + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.08);
      });
    },
  };

  // ---------- sound effects ----------
  function tone(ctx, out, type, f0, f1, t, dur, vol) {
    const g = ctx.createGain();
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.start(t);
    o.stop(t + dur + 0.05);
    o.connect(g);
    g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  }
  function burst(ctx, out, t, dur, freq, q, vol, type) {
    const g = ctx.createGain();
    const n = noise(ctx, t, dur);
    const f = filter(ctx, type || 'bandpass', freq, q || 1);
    n.connect(f); f.connect(g); g.connect(out);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  }

  const SFX = {
    tap(ctx, out, t) { tone(ctx, out, 'sine', 700, 760, t, 0.06, 0.25); },
    key(ctx, out, t) { tone(ctx, out, 'triangle', 880, 860, t, 0.05, 0.28); },
    pickup(ctx, out, t) {
      tone(ctx, out, 'sine', 420, 980, t, 0.11, 0.35);
      tone(ctx, out, 'triangle', 1300, 1500, t + 0.05, 0.06, 0.12);
    },
    drop(ctx, out, t) { tone(ctx, out, 'sine', 760, 360, t, 0.1, 0.32); },
    snap(ctx, out, t) {
      tone(ctx, out, 'triangle', 990, 990, t, 0.05, 0.3);
      tone(ctx, out, 'triangle', 1480, 1480, t + 0.05, 0.08, 0.3);
    },
    equals(ctx, out, t) {
      tone(ctx, out, 'sine', 784, 784, t, 0.12, 0.3);
      tone(ctx, out, 'sine', 1175, 1175, t + 0.08, 0.2, 0.3);
    },
    // "띠로링": prominent cheerful ascending arpeggio with sparkle
    correct(ctx, out, t) {
      const notes = [1047, 1319, 1568, 2093];
      notes.forEach((f, i) => {
        tone(ctx, out, 'square', f, f, t + i * 0.09, 0.22, 0.13);
        tone(ctx, out, 'sine', f, f, t + i * 0.09, 0.45, 0.4);
      });
      tone(ctx, out, 'sine', 2637, 2637, t + 0.38, 0.6, 0.22);
      tone(ctx, out, 'sine', 3136, 3136, t + 0.45, 0.5, 0.12);
    },
    // "삐빅": two short buzzy beeps
    wrong(ctx, out, t) {
      tone(ctx, out, 'square', 820, 800, t, 0.12, 0.22);
      tone(ctx, out, 'square', 560, 540, t + 0.16, 0.2, 0.22);
    },
    crunch(ctx, out, t) {
      for (let i = 0; i < 5; i++) {
        burst(ctx, out, t + i * 0.12, 0.07, 1400 + Math.random() * 1800, 1.2, 0.7);
        tone(ctx, out, 'sine', 160, 90, t + i * 0.12, 0.06, 0.25);
      }
    },
    gulp(ctx, out, t) { tone(ctx, out, 'sine', 300, 120, t, 0.18, 0.35); },
    clear(ctx, out, t) {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(ctx, out, 'triangle', f, f, t + i * 0.11, 0.5, 0.3));
      [523, 659, 784].forEach((f) => tone(ctx, out, 'sine', f * 2, f * 2, t + 0.6, 1.0, 0.18));
    },
    crack(ctx, out, t) {
      burst(ctx, out, t, 0.12, 3000, 0.7, 0.8, 'highpass');
      tone(ctx, out, 'square', 2200, 400, t, 0.05, 0.12);
      burst(ctx, out, t + 0.18, 0.1, 2500, 0.7, 0.6, 'highpass');
    },
    shatter(ctx, out, t) {
      burst(ctx, out, t, 0.5, 4000, 0.5, 0.9, 'highpass');
      tone(ctx, out, 'sine', 120, 40, t, 0.4, 0.5);
      for (let i = 0; i < 8; i++) tone(ctx, out, 'sine', 2500 + Math.random() * 3000, null, t + 0.05 + i * 0.04, 0.08, 0.06);
    },
    jump(ctx, out, t) { tone(ctx, out, 'square', 260, 620, t, 0.14, 0.12); },
    roar(ctx, out, t) {
      burst(ctx, out, t, 0.35, 500, 1.5, 0.5);
      tone(ctx, out, 'sawtooth', 140, 90, t, 0.35, 0.15);
    },
    crash(ctx, out, t) {
      burst(ctx, out, t, 0.6, 600, 0.6, 0.9, 'lowpass');
      tone(ctx, out, 'sine', 110, 35, t, 0.5, 0.6);
      tone(ctx, out, 'square', 440, 110, t + 0.05, 0.4, 0.12);
    },
    whoosh(ctx, out, t) { burst(ctx, out, t, 0.25, 1200, 0.8, 0.25); },
  };

  // ---------- sequencer ----------
  class Sequencer {
    constructor(engine, name) {
      this.engine = engine;
      this.ctx = engine.ctx;
      this.name = name;
      this.track = MusicLib.getTrack(name);
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.0001;
      this.gain.connect(engine.musicBus);
      this.step = 0;
      this.rate = 1;
      this.timer = null;
      this.stopped = false;
      this.scheduledCount = 0;
    }
    start() {
      const t = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(0.0001, t);
      this.gain.gain.linearRampToValueAtTime(1, t + 0.35);
      this.resume();
    }
    resume() {
      if (this.stopped) return;
      this.nextTime = this.ctx.currentTime + 0.06;
      if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
      this.tick();
    }
    pause() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }
    tick() {
      if (this.stopped || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      // After throttling/backgrounding skip missed steps instead of bursting.
      if (this.nextTime < now - 0.05) this.nextTime = now + 0.03;
      const stepDur = this.track.stepSeconds / this.rate;
      while (this.nextTime < now + LOOKAHEAD) {
        const evs = this.track.events[this.step];
        for (const e of evs) {
          const voice = VOICES[e.i];
          if (voice) {
            try {
              voice(this.ctx, this.gain, this.nextTime, mtof(e.m), e.d * stepDur, e.v);
              this.scheduledCount++;
            } catch (err) {
              /* a failed voice must never stop the music loop */
            }
          }
        }
        this.nextTime += stepDur;
        this.step = (this.step + 1) % this.track.totalSteps;
      }
    }
    stop(fade) {
      if (this.stopped) return;
      this.stopped = true;
      this.pause();
      const t = this.ctx.currentTime;
      const g = this.gain;
      try {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value || 0.0001, t);
        g.gain.linearRampToValueAtTime(0.0001, t + (fade || 0.3));
      } catch (e) {
        /* ignore */
      }
      setTimeout(() => {
        try {
          g.disconnect();
        } catch (e) {
          /* ignore */
        }
      }, (fade || 0.3) * 1000 + 250);
    }
  }

  class AudioEngine {
    constructor(opts) {
      opts = opts || {};
      this.ctxFactory = opts.ctxFactory || defaultFactory;
      this.ctx = null;
      this.musicEnabled = opts.music !== false;
      this.sfxEnabled = opts.sfx !== false;
      this.desired = null; // name of the track that SHOULD play
      this.seq = null; // active sequencer
      this.rate = 1;
      this.hidden = false;
      this.unlockToken = 0;
      this.sfxCount = 0;
    }
    ensureContext() {
      if (this.ctx) return this.ctx;
      try {
        this.ctx = this.ctxFactory();
      } catch (e) {
        this.ctx = null;
      }
      if (!this.ctx) return null;
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      let tail = this.master;
      if (c.createDynamicsCompressor) {
        try {
          const comp = c.createDynamicsCompressor();
          this.master.connect(comp);
          tail = comp;
        } catch (e) {
          /* optional */
        }
      }
      tail.connect(c.destination);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);
      if (c.addEventListener) c.addEventListener('statechange', () => this._onState());
      else c.onstatechange = () => this._onState();
      return c;
    }
    get running() {
      return !!this.ctx && this.ctx.state === 'running';
    }
    /** Try to start audio (autoplay attempt or user gesture). */
    unlock() {
      const c = this.ensureContext();
      if (!c) return Promise.resolve(false);
      const token = ++this.unlockToken;
      if (c.state === 'running') {
        this._sync();
        return Promise.resolve(true);
      }
      if (this.hidden) return Promise.resolve(false);
      let p;
      try {
        p = c.resume();
      } catch (e) {
        p = null;
      }
      try {
        // A silent buffer helps iOS Safari unlock output on the gesture.
        const b = c.createBuffer(1, 1, c.sampleRate || 44100);
        const s = c.createBufferSource();
        s.buffer = b;
        s.connect(c.destination);
        s.start(0);
      } catch (e) {
        /* ignore */
      }
      return Promise.resolve(p).then(
        () => {
          // Only the latest request may act, and it plays the CURRENT desire.
          if (token === this.unlockToken) this._sync();
          return this.running;
        },
        () => false
      );
    }
    _onState() {
      if (this.running && !this.hidden) this._sync();
      else if (this.seq) this.seq.pause();
    }
    /** Make reality match `desired` (single source of truth). */
    _sync() {
      if (!this.running || this.hidden) return;
      const want = this.musicEnabled ? this.desired : null;
      if (this.seq && (this.seq.name !== want || this.seq.stopped)) {
        this.seq.stop(0.35);
        this.seq = null;
      }
      if (want && !this.seq) {
        this.seq = new Sequencer(this, want);
        this.seq.rate = this.rate;
        this.seq.start();
      } else if (this.seq && !this.seq.timer) this.seq.resume();
    }
    setTrack(name) {
      if (name !== this.desired) {
        this.desired = name;
        this.rate = 1;
      }
      this._sync();
    }
    stopMusic() {
      this.desired = null;
      this._sync();
    }
    setMusicEnabled(on) {
      this.musicEnabled = !!on;
      if (!on && this.seq) {
        this.seq.stop(0.2);
        this.seq = null;
      }
      this._sync();
    }
    setSfxEnabled(on) {
      this.sfxEnabled = !!on;
    }
    /** Music playback rate (tempo). Invalid values are ignored safely. */
    setRate(r) {
      const n = Number(r);
      if (!Number.isFinite(n) || n <= 0) return this.rate;
      const clamped = Math.min(MAX_RATE, Math.max(MIN_RATE, n));
      if (Math.abs(clamped - this.rate) < 0.005) return this.rate;
      this.rate = clamped;
      if (this.seq) this.seq.rate = clamped;
      return this.rate;
    }
    play(name) {
      if (!this.sfxEnabled || !this.running || this.hidden) return false;
      const fx = SFX[name];
      if (!fx) return false;
      try {
        fx(this.ctx, this.sfxBus, this.ctx.currentTime + 0.005);
        this.sfxCount++;
        return true;
      } catch (e) {
        return false;
      }
    }
    onHidden() {
      this.hidden = true;
      if (this.seq) this.seq.pause();
      if (this.ctx && this.ctx.state === 'running') {
        try {
          const p = this.ctx.suspend();
          if (p && p.catch) p.catch(() => {});
        } catch (e) {
          /* ignore */
        }
      }
    }
    onVisible() {
      this.hidden = false;
      return this.unlock();
    }
  }

  function defaultFactory() {
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      return new AC({ latencyHint: 'interactive' });
    } catch (e) {
      return new AC();
    }
  }

  return { AudioEngine, Sequencer, SFX, VOICES, MIN_RATE, MAX_RATE };
});
