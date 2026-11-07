/*
 * "스피노의 대탈출" — canvas renderer, input and loop for the hidden runner.
 * The simulation itself lives in runner-logic.js.
 */
(function (root) {
  'use strict';
  const DME = (root.DME = root.DME || {});
  const L = DME.RunnerLogic;
  const FIXED_DT = 1 / 120;
  const MAX_FRAME = 0.05; // never advance more than 50 ms per frame

  class RunnerGame {
    constructor(container, opts) {
      this.container = container;
      this.opts = opts || {};
      this.audio = this.opts.audio;
      this.pauses = new Set();
      this.raf = 0;
      this.last = 0;
      this.acc = 0;
      this.time = 0;
      this.alive = true;
      this.best = this._loadBest();
      this.sim = new L.RunnerSim({ viewWidth: 800 });
      this._build();
      this._resize();
      this._resetScene();
      this._onResize = () => this._resize();
      this._onKey = (e) => this._key(e);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('keydown', this._onKey);
      this._showPanel('ready');
      this._startLoop();
      if (this.audio) {
        this.audio.setTrack('runner');
        this.audio.setRate(1);
      }
    }

    _loadBest() {
      try {
        return Number(localStorage.getItem('dinoMathExplorer.runnerBest')) || 0;
      } catch (e) {
        return 0;
      }
    }
    _saveBest() {
      try {
        localStorage.setItem('dinoMathExplorer.runnerBest', String(this.best));
      } catch (e) {
        /* ignore */
      }
    }

    _build() {
      const c = this.container;
      c.innerHTML = `
        <div class="runner-arena">
          <canvas class="runner-canvas" tabindex="0" role="img" aria-label="스피노의 대탈출 게임 화면. 화면을 누르거나 스페이스 키, 위쪽 화살표 키를 누르면 점프해요."></canvas>
          <div class="runner-panel" data-panel="ready">
            <h2 class="runner-title">스피노의 대탈출</h2>
            <p class="runner-help">화면을 누르거나 <kbd>스페이스</kbd>·<kbd>↑</kbd> 키를 누르면 점프해요!<br>장애물을 뛰어넘어 멀리 도망가세요.</p>
            <p class="runner-start-hint">화면을 눌러서 출발!</p>
          </div>
          <div class="runner-panel" data-panel="paused" hidden>
            <h2 class="runner-title small">잠깐 쉬는 중</h2>
            <p class="runner-start-hint">화면을 누르면 다시 달려요</p>
          </div>
          <div class="runner-panel over" data-panel="over" hidden>
            <h2 class="runner-title">쾅! 부딪혔어요!</h2>
            <p class="runner-final"></p>
            <div class="runner-buttons">
              <button type="button" class="btn btn-big btn-orange" data-act="retry">다시 달리기</button>
              <button type="button" class="btn btn-big btn-teal" data-act="exit">계산기로</button>
            </div>
          </div>
        </div>`;
      this.arena = c.querySelector('.runner-arena');
      this.canvas = c.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.panels = {};
      c.querySelectorAll('.runner-panel').forEach((p) => (this.panels[p.dataset.panel] = p));
      this.arena.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        this.canvas.focus({ preventScroll: true });
        this._press();
      });
      c.querySelector('[data-act="retry"]').addEventListener('click', () => this.restart());
      c.querySelector('[data-act="exit"]').addEventListener('click', () => this.opts.onExit && this.opts.onExit());
      setTimeout(() => this.focus(), 50);
    }

    focus() {
      if (this.canvas && this.alive) this.canvas.focus({ preventScroll: true });
    }

    _showPanel(name) {
      for (const k of Object.keys(this.panels)) this.panels[k].hidden = k !== name;
    }

    _resize() {
      const r = this.arena.getBoundingClientRect();
      const cw = Math.max(200, r.width), ch = Math.max(200, r.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
      // World: at least 760 wide and 360 tall, keep aspect.
      // Portrait tablets get a slightly narrower world so sprites stay large.
      const minW = cw >= ch ? 760 : 640, minH = 360;
      if (cw / ch >= minW / minH) {
        this.scale = ch / minH;
        this.viewW = cw / this.scale;
        this.viewH = minH;
      } else {
        this.scale = cw / minW;
        this.viewW = minW;
        this.viewH = ch / this.scale;
      }
      this.dpr = dpr;
      this.groundY = this.viewH - 64;
      this.sim.viewWidth = this.viewW;
    }

    _resetScene() {
      this.meteors = [];
      this.embers = [];
      this.fleeing = [];
      this.meteorTimer = 0.3;
      this.fleeTimer = 0;
      this.shake = 0;
      this.flash = 0;
      this.overAt = 0;
      for (let i = 0; i < 5; i++) this._spawnFleeing(Math.random() * this.viewW);
      for (let i = 0; i < 30; i++) this._spawnEmber(Math.random() * this.viewW, this.groundY - Math.random() * 200);
    }

    _spawnFleeing(x) {
      this.fleeing.push({ x, kind: ['brachio', 'trex', 'stego', 'ptero'][Math.floor(Math.random() * 4)], phase: Math.random() * 6, s: 0.5 + Math.random() * 0.4, drift: 10 + Math.random() * 25 });
    }
    _spawnEmber(x, y) {
      this.embers.push({ x, y, vy: -20 - Math.random() * 50, vx: -10 - Math.random() * 20, life: 1.5 + Math.random() * 2, r: 1 + Math.random() * 2.2 });
    }

    // ---------- input ----------
    _press() {
      if (!this.alive || this.pauses.has('menu')) return;
      if (this.pauses.has('hidden-wait')) {
        this.pauses.delete('hidden-wait');
        this._showPanel(null);
        this._kick();
        return;
      }
      const s = this.sim;
      if (s.state === 'over') {
        if (performance.now() - this.overAt > 600) this.restart();
        return;
      }
      if (s.state === 'ready') {
        this._showPanel(null);
        if (this.audio) this.audio.play('roar');
      }
      if (s.jump() && this.audio) this.audio.play('jump');
    }
    _key(e) {
      if (!this.alive) return;
      if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp' || e.code === 'ArrowUp') {
        if (e.target && e.target.closest && e.target.closest('button') && this.sim.state === 'over') return;
        e.preventDefault();
        if (!e.repeat || this.sim.state === 'running') this._press();
      }
    }

    restart() {
      this.sim.reset();
      this._resetScene();
      this._showPanel(null);
      this.sim.start();
      if (this.audio) {
        this.audio.setTrack('runner');
        this.audio.setRate(1);
      }
      this.focus();
      this._kick();
    }

    // ---------- pause / resume ----------
    pause(reason) {
      this.pauses.add(reason);
      this._stopLoop();
    }
    resume(reason) {
      this.pauses.delete(reason);
      if (reason === 'hidden' && this.sim.state === 'running') {
        // Returning from the background: wait for a tap, no time jump.
        this.pauses.add('hidden-wait');
        this._showPanel('paused');
      }
      if (reason === 'menu') this.focus();
      this._kick();
    }
    get paused() {
      return this.pauses.size > 0;
    }
    _kick() {
      if (!this.paused) this._startLoop();
      else this._draw();
    }
    _startLoop() {
      if (this.raf || !this.alive || this.paused) return;
      this.last = performance.now();
      const frame = (now) => {
        this.raf = 0;
        if (!this.alive || this.paused) return;
        const dt = Math.min(MAX_FRAME, Math.max(0, (now - this.last) / 1000));
        this.last = now;
        this._update(dt);
        this._draw();
        this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);
    }
    _stopLoop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    }

    destroy() {
      this.alive = false;
      this._stopLoop();
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('keydown', this._onKey);
      if (this.audio) this.audio.setRate(1);
      this.container.innerHTML = '';
    }

    // ---------- update ----------
    _update(dt) {
      this.time += dt;
      const s = this.sim;
      const wasRunning = s.state === 'running';
      this.acc += dt;
      while (this.acc >= FIXED_DT) {
        s.step(FIXED_DT);
        this.acc -= FIXED_DT;
      }
      if (wasRunning && s.state === 'over') this._onCrash();
      const worldSpeed = s.state === 'running' ? s.speed : s.state === 'ready' ? 60 : 0;
      if (this.audio && s.state === 'running') this.audio.setRate(s.speed / L.CFG.startSpeed);

      // meteors
      this.meteorTimer -= dt;
      if (this.meteorTimer <= 0) {
        this.meteorTimer = 0.5 + Math.random() * 1.1;
        this.meteors.push({ x: this.viewW * (0.2 + Math.random() * 0.9), y: -20, vx: -180 - Math.random() * 160, vy: 220 + Math.random() * 160, r: 4 + Math.random() * 6, life: 4 });
      }
      for (const m of this.meteors) {
        m.x += m.vx * dt - worldSpeed * 0.05 * dt;
        m.y += m.vy * dt;
        m.life -= dt;
      }
      this.meteors = this.meteors.filter((m) => m.life > 0 && m.y < this.groundY - 40 && m.x > -60);

      // fleeing dinosaurs (far layer)
      for (const f of this.fleeing) {
        f.x -= (worldSpeed * 0.12 - f.drift) * dt;
        f.phase += dt * 10;
      }
      this.fleeing = this.fleeing.filter((f) => f.x > -80 && f.x < this.viewW + 200);
      this.fleeTimer -= dt;
      if (this.fleeing.length < 6 && this.fleeTimer <= 0) {
        this.fleeTimer = 1.5;
        this._spawnFleeing(this.viewW + 40);
      }

      // embers
      for (const e of this.embers) {
        e.x += (e.vx - worldSpeed * 0.4) * dt;
        e.y += e.vy * dt;
        e.life -= dt;
      }
      this.embers = this.embers.filter((e) => e.life > 0 && e.x > -10);
      while (this.embers.length < 40) this._spawnEmber(this.viewW * Math.random() + 40, this.groundY - Math.random() * 10);

      this.shake = Math.max(0, this.shake - dt);
      this.flash = Math.max(0, this.flash - dt);
    }

    _onCrash() {
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.shake = reduce ? 0 : 0.45;
      this.flash = reduce ? 0.25 : 0.5;
      this.overAt = performance.now();
      if (this.audio) {
        this.audio.play('crash');
        this.audio.setRate(1);
      }
      const score = this.sim.score;
      const isBest = score > this.best;
      if (isBest) {
        this.best = score;
        this._saveBest();
      }
      this.panels.over.querySelector('.runner-final').textContent = isBest ? `새 최고 점수 ${score}점!` : `점수 ${score}점 · 최고 ${this.best}점`;
      setTimeout(() => {
        if (this.alive && this.sim.state === 'over') {
          this._showPanel('over');
          const b = this.panels.over.querySelector('[data-act="retry"]');
          if (b) b.focus({ preventScroll: true });
        }
      }, 500);
    }

    // ---------- drawing ----------
    _draw() {
      const ctx = this.ctx;
      const s = this.sim;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const k = this.dpr * this.scale;
      let sx = 0, sy = 0;
      if (this.shake > 0) {
        sx = (Math.random() - 0.5) * 14 * this.shake;
        sy = (Math.random() - 0.5) * 14 * this.shake;
      }
      ctx.setTransform(k, 0, 0, k, sx * k, sy * k);
      this._drawSky(ctx);
      this._drawMeteors(ctx);
      this._drawFar(ctx, s.distance);
      this._drawGround(ctx, s.distance);
      for (const o of s.obstacles) this._drawObstacle(ctx, o);
      this._drawSpino(ctx, s);
      this._drawEmbers(ctx);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255,40,20,${this.flash * 0.6})`;
        ctx.fillRect(0, 0, this.viewW, this.viewH);
      }
      // Score: inside the arena, upper right, white text. (No speed shown.)
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = 4;
      // Keep clear of the app's menu button (≈84 CSS px in the corner).
      const right = this.viewW - 18 - 84 / this.scale;
      ctx.font = 'bold 30px Jua, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      ctx.fillText(`점수 ${s.score}`, right, 18);
      ctx.font = '18px Jua, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
      ctx.fillText(`최고 ${Math.max(this.best, s.score)}`, right, 54);
      ctx.shadowBlur = 0;
    }

    _drawSky(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, this.groundY);
      g.addColorStop(0, '#16040c');
      g.addColorStop(0.45, '#4a0f16');
      g.addColorStop(0.8, '#a3301a');
      g.addColorStop(1, '#f06a1e');
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, this.viewW + 40, this.groundY + 20);
      // ash clouds
      ctx.fillStyle = 'rgba(30,10,12,.55)';
      for (let i = 0; i < 6; i++) {
        const x = ((i * 190 - this.time * 8) % (this.viewW + 200) + this.viewW + 200) % (this.viewW + 200) - 100;
        ctx.beginPath();
        ctx.ellipse(x, 50 + (i % 3) * 30, 90, 22, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    _drawMeteors(ctx) {
      for (const m of this.meteors) {
        const len = 70 + m.r * 6;
        const n = Math.hypot(m.vx, m.vy);
        const tx = m.x - (m.vx / n) * len, ty = m.y - (m.vy / n) * len;
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, 'rgba(255,240,170,.95)');
        g.addColorStop(0.3, 'rgba(255,140,30,.7)');
        g.addColorStop(1, 'rgba(200,40,10,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = m.r * 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = '#fff4c2';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a3020';
        ctx.beginPath();
        ctx.arc(m.x + m.r * 0.2, m.y + m.r * 0.2, m.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    _drawFar(ctx, dist) {
      const gy = this.groundY;
      // volcanoes
      const off = (dist * 0.05) % 520;
      for (let x = -off - 200; x < this.viewW + 300; x += 520) {
        ctx.fillStyle = '#2a0d10';
        ctx.beginPath();
        ctx.moveTo(x, gy - 30);
        ctx.lineTo(x + 140, gy - 170);
        ctx.lineTo(x + 180, gy - 170);
        ctx.lineTo(x + 330, gy - 30);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ff7a1c';
        ctx.beginPath();
        ctx.moveTo(x + 140, gy - 170);
        ctx.lineTo(x + 150, gy - 140);
        ctx.lineTo(x + 160, gy - 158);
        ctx.lineTo(x + 170, gy - 136);
        ctx.lineTo(x + 180, gy - 170);
        ctx.closePath();
        ctx.fill();
      }
      // far hills
      ctx.fillStyle = '#3a1612';
      const hoff = (dist * 0.15) % 300;
      ctx.beginPath();
      ctx.moveTo(-10, gy);
      for (let x = -hoff - 300; x < this.viewW + 320; x += 300) {
        ctx.quadraticCurveTo(x + 75, gy - 70, x + 150, gy - 40);
        ctx.quadraticCurveTo(x + 225, gy - 10, x + 300, gy - 40);
      }
      ctx.lineTo(this.viewW + 10, gy);
      ctx.closePath();
      ctx.fill();
      // fleeing dinosaurs (silhouettes)
      for (const f of this.fleeing) this._drawFleeing(ctx, f, gy - 30);
    }

    _drawFleeing(ctx, f, baseY) {
      const leg = Math.sin(f.phase) * 5;
      const bob = Math.abs(Math.sin(f.phase)) * 2;
      ctx.save();
      ctx.translate(f.x, baseY - bob);
      ctx.scale(f.s, f.s);
      ctx.fillStyle = '#1b0809';
      ctx.strokeStyle = '#1b0809';
      ctx.lineCap = 'round';
      if (f.kind === 'ptero') {
        ctx.translate(0, -90 - Math.sin(f.phase * 0.5) * 8);
        const w = Math.sin(f.phase * 0.8) * 14;
        ctx.beginPath();
        ctx.moveTo(-30, -w);
        ctx.quadraticCurveTo(-10, -4, 0, 0);
        ctx.quadraticCurveTo(10, -4, 30, -w);
        ctx.quadraticCurveTo(10, 4, 0, 6);
        ctx.quadraticCurveTo(-10, 4, -30, -w);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(14, -4);
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-6, -14); ctx.lineTo(-6 + leg, 0);
        ctx.moveTo(8, -14); ctx.lineTo(8 - leg, 0);
        ctx.stroke();
        ctx.beginPath();
        if (f.kind === 'brachio') {
          ctx.ellipse(0, -22, 22, 12, 0, 0, Math.PI * 2);
          ctx.moveTo(14, -28); ctx.quadraticCurveTo(28, -50, 30, -66); ctx.lineTo(36, -64); ctx.quadraticCurveTo(32, -44, 22, -22);
          ctx.moveTo(-20, -22); ctx.quadraticCurveTo(-40, -22, -46, -14); ctx.lineTo(-18, -16);
          ctx.fill();
          ctx.beginPath(); ctx.ellipse(36, -66, 7, 5, 0, 0, Math.PI * 2);
        } else if (f.kind === 'trex') {
          ctx.ellipse(0, -26, 16, 14, -0.3, 0, Math.PI * 2);
          ctx.moveTo(10, -36); ctx.ellipse(18, -42, 12, 8, 0, 0, Math.PI * 2);
          ctx.moveTo(-12, -24); ctx.lineTo(-40, -18); ctx.lineTo(-10, -16);
        } else {
          ctx.ellipse(0, -22, 22, 13, 0, 0, Math.PI * 2);
          for (let i = -2; i <= 2; i++) { ctx.moveTo(i * 8 - 5, -32); ctx.lineTo(i * 8, -44 + Math.abs(i) * 3); ctx.lineTo(i * 8 + 5, -32); }
          ctx.moveTo(20, -22); ctx.ellipse(26, -18, 7, 5, 0, 0, Math.PI * 2);
          ctx.moveTo(-20, -22); ctx.lineTo(-42, -16); ctx.lineTo(-18, -14);
        }
        ctx.fill();
      }
      ctx.restore();
    }

    _drawGround(ctx, dist) {
      const gy = this.groundY;
      ctx.fillStyle = '#5a2f17';
      ctx.fillRect(-20, gy, this.viewW + 40, this.viewH - gy + 20);
      ctx.fillStyle = '#7b4424';
      ctx.fillRect(-20, gy, this.viewW + 40, 8);
      // scrolling texture: pebbles and glowing cracks
      const off = dist % 120;
      for (let x = -off; x < this.viewW + 120; x += 120) {
        ctx.fillStyle = '#3e1f0f';
        ctx.fillRect(x + 10, gy + 20, 26, 4);
        ctx.fillRect(x + 70, gy + 38, 18, 4);
        ctx.beginPath();
        ctx.arc(x + 50, gy + 14, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      const off2 = dist % 340;
      ctx.strokeStyle = '#ff7a1c';
      ctx.lineWidth = 2.5;
      for (let x = -off2; x < this.viewW + 340; x += 340) {
        ctx.beginPath();
        ctx.moveTo(x + 40, gy + 12);
        ctx.lineTo(x + 52, gy + 24);
        ctx.lineTo(x + 46, gy + 34);
        ctx.lineTo(x + 62, gy + 46);
        ctx.stroke();
      }
    }

    _drawEmbers(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const e of this.embers) {
        const a = Math.min(1, e.life) * (0.6 + 0.4 * Math.sin(this.time * 12 + e.x));
        ctx.fillStyle = `rgba(255,${120 + Math.floor(80 * a)},40,${a})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    _drawObstacle(ctx, o) {
      const gy = this.groundY;
      ctx.save();
      ctx.translate(o.x, gy);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const w = o.w, h = o.h;
      switch (o.type) {
        case 'tree': {
          ctx.fillStyle = '#1f130e';
          ctx.strokeStyle = '#1f130e';
          ctx.beginPath();
          ctx.moveTo(w * 0.32, 0); ctx.lineTo(w * 0.4, -h); ctx.lineTo(w * 0.6, -h); ctx.lineTo(w * 0.68, 0);
          ctx.closePath(); ctx.fill();
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(w * 0.48, -h * 0.55); ctx.lineTo(w * 0.05, -h * 0.82);
          ctx.moveTo(w * 0.52, -h * 0.7); ctx.lineTo(w * 0.95, -h * 0.95);
          ctx.moveTo(w * 0.5, -h * 0.35); ctx.lineTo(w * 0.9, -h * 0.5);
          ctx.stroke();
          ctx.strokeStyle = '#ff7a1c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(w * 0.5, -h * 0.15); ctx.lineTo(w * 0.46, -h * 0.3); ctx.lineTo(w * 0.53, -h * 0.42);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,140,40,.9)';
          ctx.beginPath(); ctx.arc(w * 0.05, -h * 0.82, 3, 0, 7); ctx.fill();
          break;
        }
        case 'rock': {
          ctx.fillStyle = '#6e5a4c';
          ctx.strokeStyle = '#2e221b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(w * 0.08, -h * 0.6); ctx.lineTo(w * 0.35, -h); ctx.lineTo(w * 0.75, -h * 0.9);
          ctx.lineTo(w, -h * 0.4); ctx.lineTo(w, 0); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.25)';
          ctx.beginPath(); ctx.moveTo(w * 0.2, -h * 0.6); ctx.lineTo(w * 0.38, -h * 0.85); ctx.stroke();
          ctx.strokeStyle = '#2e221b';
          ctx.beginPath(); ctx.moveTo(w * 0.5, -h * 0.95); ctx.lineTo(w * 0.55, -h * 0.5); ctx.lineTo(w * 0.7, -h * 0.3); ctx.stroke();
          break;
        }
        case 'skull': {
          ctx.fillStyle = '#efe4c8';
          ctx.strokeStyle = '#5b4a36';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(2, -h * 0.25);
          ctx.quadraticCurveTo(0, -h, w * 0.45, -h);
          ctx.quadraticCurveTo(w, -h * 0.95, w, -h * 0.45);
          ctx.lineTo(w, -h * 0.3);
          ctx.lineTo(w * 0.35, -h * 0.25);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          // jaw
          ctx.beginPath();
          ctx.moveTo(w * 0.3, -h * 0.18); ctx.lineTo(w * 0.95, -h * 0.2); ctx.lineTo(w * 0.85, 0); ctx.lineTo(w * 0.3, 0);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 4; i++) {
            const tx = w * 0.42 + i * w * 0.13;
            ctx.beginPath(); ctx.moveTo(tx, -h * 0.26); ctx.lineTo(tx + 3, -h * 0.12); ctx.lineTo(tx + 6, -h * 0.26); ctx.fill();
          }
          ctx.fillStyle = '#1d140e';
          ctx.beginPath(); ctx.ellipse(w * 0.42, -h * 0.62, w * 0.12, h * 0.15, 0, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.ellipse(w * 0.82, -h * 0.55, w * 0.05, h * 0.07, 0, 0, 7); ctx.fill();
          break;
        }
        case 'skeleton': {
          ctx.strokeStyle = '#efe4c8';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(2, -h * 0.25);
          ctx.quadraticCurveTo(w * 0.4, -h * 0.85, w * 0.8, -h * 0.55);
          ctx.stroke();
          ctx.lineWidth = 3.5;
          for (let i = 0; i < 4; i++) {
            const px = w * (0.25 + i * 0.13), py = -h * (0.62 + (i === 1 || i === 2 ? 0.1 : 0));
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.quadraticCurveTo(px + 8, py + h * 0.3, px + 2, 0);
            ctx.stroke();
          }
          ctx.fillStyle = '#efe4c8';
          ctx.strokeStyle = '#5b4a36';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(w * 0.86, -h * 0.55, w * 0.14, h * 0.17, 0.2, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#1d140e';
          ctx.beginPath(); ctx.arc(w * 0.88, -h * 0.6, 2.6, 0, 7); ctx.fill();
          ctx.strokeStyle = '#d8ccb0';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(w * 0.1, -h * 0.2); ctx.lineTo(0, 0); ctx.stroke();
          break;
        }
        case 'brachio': {
          // Fallen turquoise Brachiosaurus lying on its side with X eyes.
          const body = '#3cc6c0', dark = '#239c97', line = '#145452';
          ctx.lineWidth = 3;
          ctx.strokeStyle = line;
          // tail
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.moveTo(14, -10); ctx.quadraticCurveTo(2, -6, -2, 0); ctx.lineTo(18, 0); ctx.closePath();
          ctx.fill(); ctx.stroke();
          // stiff legs sticking out from the side it is lying on: two pairs
          [[14, -26, -0.55], [24, -30, -0.35], [46, -30, 0.35], [56, -26, 0.55]].forEach(([lx, ly, rot], i) => {
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(rot);
            ctx.fillStyle = i % 2 ? body : dark;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-5.5, -15, 11, 19, 5);
            else ctx.rect(-5.5, -15, 11, 19);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e9f7f2';
            ctx.beginPath(); ctx.ellipse(0, -14, 4.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          });
          // body
          ctx.fillStyle = body;
          ctx.beginPath(); ctx.ellipse(36, -17, 26, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#b4f0ea';
          ctx.beginPath(); ctx.ellipse(36, -24, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
          // neck along the ground
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.moveTo(56, -22); ctx.quadraticCurveTo(76, -16, 92, -14); ctx.lineTo(92, -4); ctx.quadraticCurveTo(74, -4, 58, -6); ctx.closePath();
          ctx.fill(); ctx.stroke();
          // head
          ctx.beginPath(); ctx.ellipse(w - 11, -11, 14, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          // big X eyes
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 3;
          const ex = w - 10, ey = -14;
          ctx.beginPath();
          ctx.moveTo(ex - 5, ey - 5); ctx.lineTo(ex + 5, ey + 5);
          ctx.moveTo(ex + 5, ey - 5); ctx.lineTo(ex - 5, ey + 5);
          ctx.stroke();
          // tongue
          ctx.fillStyle = '#ff7b8a';
          ctx.beginPath(); ctx.ellipse(w - 1, -3, 4, 2.5, 0.4, 0, 7); ctx.fill();
          break;
        }
      }
      ctx.restore();
    }

    _drawSpino(ctx, s) {
      const gy = this.groundY;
      const P = L.CFG;
      const cx = P.playerX + P.playerBox.w / 2;
      const airborne = !s.grounded;
      const over = s.state === 'over';
      const phase = s.distance / 22;
      ctx.save();
      ctx.translate(cx - 8, gy - s.y);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const bodyCol = '#3d6a58', darkCol = '#284a3d', belly = '#a7bf8c', line = '#14261f';
      const legSwing = airborne ? 0.5 : over ? 0 : Math.sin(phase);
      const drawLeg = (hipX, ang, col) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = 9;
        const kx = hipX + Math.sin(ang) * 14, ky = -24 + Math.cos(ang) * 10;
        const fx = kx + Math.sin(ang - 0.6) * 10 - 2, fy = airborne ? -6 : -2 - Math.max(0, Math.sin(ang)) * 4;
        ctx.beginPath(); ctx.moveTo(hipX, -34); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 10, fy); ctx.stroke();
      };
      drawLeg(-6, -legSwing * 0.9, darkCol);
      // tail
      ctx.fillStyle = bodyCol;
      ctx.strokeStyle = line;
      ctx.lineWidth = 3;
      const tw = Math.sin(this.time * 8) * 4;
      ctx.beginPath();
      ctx.moveTo(-20, -50);
      ctx.quadraticCurveTo(-55, -50, -82, -40 + tw);
      ctx.quadraticCurveTo(-55, -34, -18, -30);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // sail
      const sg = ctx.createLinearGradient(0, -110, 0, -50);
      sg.addColorStop(0, '#ffb02e');
      sg.addColorStop(1, '#c0281c');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(-30, -54);
      ctx.bezierCurveTo(-30, -112, 22, -118, 26, -58);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(80,10,5,.7)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const bx = -24 + i * 9;
        const top = -104 + Math.abs(i - 2.6) * 7;
        ctx.beginPath(); ctx.moveTo(bx, -56); ctx.lineTo(bx + 1, top); ctx.stroke();
      }
      // body
      ctx.fillStyle = bodyCol;
      ctx.strokeStyle = line;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, -44, 34, 19, -0.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = belly;
      ctx.beginPath(); ctx.ellipse(6, -35, 22, 8, -0.05, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = darkCol;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 10, -58); ctx.lineTo(-10 + i * 10, -48); ctx.stroke(); }
      // neck
      ctx.fillStyle = bodyCol;
      ctx.strokeStyle = line;
      ctx.beginPath();
      ctx.moveTo(22, -56); ctx.quadraticCurveTo(34, -66, 44, -70); ctx.lineTo(48, -54); ctx.quadraticCurveTo(36, -48, 26, -36);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // head with long toothy snout; jaw opens while airborne (fire)
      const open = airborne ? 7 + Math.sin(this.time * 30) * 1.5 : over ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(38, -74); ctx.quadraticCurveTo(52, -80, 62, -70); ctx.lineTo(94, -63); ctx.lineTo(94, -58 - 0); ctx.lineTo(42, -56);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(42, -54 + open * 0.2); ctx.lineTo(90, -56 + open); ctx.lineTo(88, -50 + open); ctx.lineTo(44, -46);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 7; i++) {
        const tx = 50 + i * 6;
        ctx.beginPath(); ctx.moveTo(tx, -58); ctx.lineTo(tx + 2, -53); ctx.lineTo(tx + 4, -58); ctx.fill();
        ctx.beginPath(); ctx.moveTo(tx + 1, -54 + open * (i / 7)); ctx.lineTo(tx + 3, -58 + open * (i / 7)); ctx.lineTo(tx + 5, -54 + open * (i / 7)); ctx.fill();
      }
      // angry eye and brow
      if (over) {
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(47, -71); ctx.lineTo(55, -64); ctx.moveTo(55, -71); ctx.lineTo(47, -64); ctx.stroke();
      } else {
        ctx.fillStyle = '#ffd400';
        ctx.beginPath(); ctx.arc(51, -67, 4.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(50.2, -70.5, 1.8, 7);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.moveTo(43, -76); ctx.lineTo(58, -70); ctx.stroke();
      }
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(90, -62, 1.4, 0, 7); ctx.fill();
      // arm
      ctx.strokeStyle = darkCol;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(22, -40); ctx.lineTo(30, -32); ctx.lineTo(35, -34); ctx.stroke();
      drawLeg(8, legSwing * 0.9, bodyCol);
      // fire breath while airborne (visual only)
      if (airborne && !over) this._drawFire(ctx, 92, -54 + open * 0.5);
      ctx.restore();
    }

    _drawFire(ctx, x, y) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const t = this.time;
      for (let i = 14; i >= 0; i--) {
        const d = i / 14;
        const fx = x + d * 120 + Math.sin(t * 40 + i) * 3;
        const fy = y + Math.sin(t * 25 + i * 1.7) * 5 * d - d * 6;
        const r = 4 + d * 15 + Math.sin(t * 50 + i) * 2;
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
        g.addColorStop(0, `rgba(255,250,200,${0.9 - d * 0.4})`);
        g.addColorStop(0.4, `rgba(255,190,40,${0.8 - d * 0.4})`);
        g.addColorStop(1, 'rgba(255,60,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  DME.RunnerGame = RunnerGame;
})(typeof self !== 'undefined' ? self : this);
