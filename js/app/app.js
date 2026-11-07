/*
 * App controller: screens, menu, settings, cover, stage cards, maps,
 * standalone calculator (with the secret code), runner hand-off, global
 * feedback overlays and audio lifecycle.
 */
(function (root) {
  'use strict';
  const DME = (root.DME = root.DME || {});
  const { Art, Play, Storage, CalcUI } = DME;

  const STAGES = [
    { id: 1, title: '울창한 숲', track: 'forest', desc: '나무가 가득한 숲에서 기호를 찾아요' },
    { id: 2, title: '바위 협곡', track: 'canyon', desc: '계산기로 바위 협곡의 문제를 풀어요' },
    { id: 3, title: '용암 화산', track: 'volcano', desc: '생활 속 이야기 문제를 계산해요' },
  ];
  const reducedMotion = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (sel, r) => (r || document).querySelector(sel);
  const $$ = (sel, r) => Array.from((r || document).querySelectorAll(sel));

  class App {
    constructor() {
      this.store = new Storage.Store(safeLocalStorage());
      this.audio = new DME.Audio.AudioEngine({ music: this.store.settings.music, sfx: this.store.settings.sfx });
      DME.audio = this.audio;
      this.screen = null;
      this.currentStage = 1;
      this.menuOpen = false;
      this.runner = null;
      this.play = new Play.PlayController(this, $('#screen-play'));
      this.applySettings();
      this.buildCover();
      this.buildStageCards();
      this.buildMenu();
      this.buildCalc();
      this.bindGlobal();
      this.show('cover');
      this.tryAutoplay();
    }

    // ---------- audio lifecycle ----------
    tryAutoplay() {
      this.audio.unlock().then((ok) => {
        if (!ok && this.store.settings.music) $('#sound-hint').hidden = false;
      });
      const unlock = () => {
        $('#sound-hint').hidden = true;
        if (!this.audio.running) this.audio.unlock();
      };
      // Gestures keep (re)unlocking: needed after iOS interruptions too.
      ['pointerdown', 'touchend', 'keydown', 'click'].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));
      document.addEventListener('visibilitychange', () => this.onVisibility());
      root.addEventListener('pagehide', () => this.onHidden());
      root.addEventListener('pageshow', () => this.onVisibility());
    }
    onVisibility() {
      if (document.visibilityState === 'hidden') this.onHidden();
      else {
        this.audio.onVisible();
        if (this.runner) this.runner.resume('hidden');
      }
    }
    onHidden() {
      this.audio.onHidden();
      if (this.runner) this.runner.pause('hidden');
    }
    trackFor(name) {
      if (name === 'map' || name === 'play') return STAGES[this.currentStage - 1].track;
      if (name === 'runner') return 'runner';
      return 'theme';
    }

    // ---------- settings ----------
    applySettings() {
      const s = this.store.settings;
      document.body.classList.toggle('no-desc', !s.desc);
      document.body.classList.toggle('no-hints', !s.hints);
      this.audio.setSfxEnabled(s.sfx);
      this.audio.setMusicEnabled(s.music);
      $$('.m-toggle').forEach((b) => {
        const on = !!s[b.dataset.setting];
        b.setAttribute('aria-pressed', String(on));
        b.querySelector('.t-state').textContent = on ? '켜짐' : '꺼짐';
      });
      if (this.screen === 'play') this.play.applyHints();
    }
    toggleSetting(name) {
      this.store.setSetting(name, !this.store.settings[name]);
      this.applySettings();
      this.audio.play('tap');
    }

    // ---------- screens ----------
    show(name) {
      if (this.screen === 'runner' && name !== 'runner' && this.runner) {
        this.runner.destroy();
        this.runner = null;
      }
      if (this.screen === 'play' && name !== 'play') this.play.leave();
      $$('.screen').forEach((s) => (s.hidden = s.id !== 'screen-' + name));
      this.screen = name;
      document.body.dataset.screen = name;
      document.body.dataset.stage = this.currentStage;
      this.hideCelebrate();
      $('#clear-modal').hidden = true;
      this.audio.setTrack(this.trackFor(name));
      this.updateMenuState();
    }
    showStages(focusStage) {
      this.show('stages');
      this.refreshStageCards();
      if (focusStage) this.scrollToCard(focusStage - 1, false);
    }
    showMap(stage, focusLevel) {
      const fromPlay = this.screen === 'play' && this.currentStage === stage ? this.play.level : null;
      this.currentStage = stage;
      this.buildMap(stage);
      this.show('map');
      this.layoutMap();
      // Scroll only once visible (hidden elements cannot scroll).
      const lv = focusLevel !== undefined ? focusLevel : fromPlay;
      const sc = $('.map-scroll');
      const btn = lv !== null && lv !== undefined ? $(`.level-btn[data-level="${lv}"]`) : null;
      sc.scrollLeft = btn ? Math.max(0, btn.offsetLeft - sc.clientWidth / 2) : 0;
    }
    startLevel(stage, level) {
      this.currentStage = stage;
      this.show('play');
      this.play.start(stage, level);
    }

    // ---------- cover ----------
    buildCover() {
      $('.cover-bg').innerHTML = Art.grassland();
      $('.cover-dinos').innerHTML = ['brachio', 'stego', 'tyranno']
        .map((k, i) => `<div class="cover-dino d-${k} dino walk" style="--i:${i}">${Art.dino(k)}</div>`)
        .join('');
      $('#btn-start').addEventListener('click', () => {
        this.audio.unlock();
        this.audio.play('tap');
        this.showStages();
      });
    }

    // ---------- stage cards ----------
    buildStageCards() {
      const wrap = $('.stage-cards');
      wrap.innerHTML = STAGES.map(
        (st) => `<button type="button" class="stage-card s${st.id}" data-stage="${st.id}" aria-label="${st.id}스테이지 ${st.title}">
          <span class="card-head"><span class="card-num">${st.id}스테이지</span><span class="card-name">${st.title}</span></span>
          <span class="card-art">${Art.stageCardArt(st.id)}</span>
          <span class="card-progress desc"><span class="card-progress-text"></span><span class="bar"><span class="fill"></span></span><span class="card-sub">${st.desc}</span></span>
        </button>`
      ).join('');
      $$('.stage-card', wrap).forEach((c) =>
        c.addEventListener('click', () => {
          this.audio.play('tap');
          this.showMap(Number(c.dataset.stage));
        })
      );
      $('.carousel-nav.prev').addEventListener('click', () => this.stepCard(-1));
      $('.carousel-nav.next').addEventListener('click', () => this.stepCard(1));
      $('.carousel-dots').innerHTML = STAGES.map(() => '<span></span>').join('');
      wrap.addEventListener('scroll', () => this.updateDots(), { passive: true });
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') this.stepCard(1);
        if (e.key === 'ArrowLeft') this.stepCard(-1);
      });
    }
    cardIndex() {
      const wrap = $('.stage-cards');
      const cards = $$('.stage-card', wrap);
      const mid = wrap.scrollLeft + wrap.clientWidth / 2;
      let best = 0;
      cards.forEach((c, i) => {
        if (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - mid)) best = i;
      });
      return best;
    }
    scrollToCard(i, smooth) {
      const wrap = $('.stage-cards');
      const cards = $$('.stage-card', wrap);
      i = Math.max(0, Math.min(cards.length - 1, i));
      const c = cards[i];
      wrap.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - wrap.clientWidth / 2, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
      setTimeout(() => this.updateDots(), 350);
    }
    stepCard(d) {
      this.audio.play('tap');
      this.scrollToCard(this.cardIndex() + d, true);
    }
    updateDots() {
      const i = this.cardIndex();
      $$('.carousel-dots span').forEach((d, k) => d.classList.toggle('on', k === i));
      $('.carousel-nav.prev').disabled = i === 0;
      $('.carousel-nav.next').disabled = i === STAGES.length - 1;
    }
    refreshStageCards() {
      STAGES.forEach((st) => {
        const card = $(`.stage-card[data-stage="${st.id}"]`);
        const total = Play.levelCount(st.id);
        const n = this.store.clearedCount(st.id);
        $('.card-progress-text', card).textContent = `클리어 ${n} / ${total}`;
        $('.fill', card).style.width = (100 * n) / total + '%';
        card.setAttribute('aria-label', `${st.id}스테이지 ${st.title}, ${total}단계 중 ${n}단계 클리어`);
      });
      requestAnimationFrame(() => this.updateDots());
    }

    // ---------- level map ----------
    buildMap(stage) {
      const st = STAGES[stage - 1];
      const count = Play.levelCount(stage);
      const scene = Art.mapScene(stage, count);
      $('#screen-map').dataset.stage = stage;
      $('.map-title').innerHTML = `<span>${stage}스테이지</span> ${st.title}`;
      const inner = $('.map-inner');
      inner.style.aspectRatio = `${scene.width} / ${scene.height}`;
      let html = scene.svg;
      scene.points.forEach((p, i) => {
        const cleared = this.store.isCleared(stage, i);
        html += `<button type="button" class="level-btn ${cleared ? 'cleared' : ''}" data-level="${i}"
            style="left:${(100 * p.x) / scene.width}%;top:${(100 * p.y) / scene.height}%"
            aria-label="${i + 1}단계 ${Play.levelName(stage, i)}${cleared ? ', 클리어함' : ''}">
            <span class="lv-num">${i + 1}</span>${cleared ? '<span class="lv-star" aria-hidden="true">★</span>' : ''}
            <span class="lv-name desc ${p.y < 300 ? 'above' : 'below'}">${Play.levelName(stage, i)}</span>
          </button>`;
      });
      inner.innerHTML = html;
      $$('.level-btn', inner).forEach((b) =>
        b.addEventListener('click', () => {
          this.audio.play('tap');
          this.startLevel(stage, Number(b.dataset.level));
        })
      );
      $('.map-guardian').innerHTML = Art.dino(Art.GUARDIANS[stage].kind);
      this._mapAspect = scene.width / scene.height;
      this.layoutMap();
      if (!this._mapResize) {
        this._mapResize = () => this.screen === 'map' && this.layoutMap();
        root.addEventListener('resize', this._mapResize);
      }
      // Scroll horizontally with a mouse wheel too.
      if (!this._wheelBound) {
        this._wheelBound = true;
        $('.map-scroll').addEventListener('wheel', (e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            $('.map-scroll').scrollLeft += e.deltaY;
            e.preventDefault();
          }
        }, { passive: false });
      }
    }

    layoutMap() {
      const sc = $('.map-scroll');
      const inner = $('.map-inner');
      const h = sc.clientHeight || root.innerHeight * 0.85;
      inner.style.width = Math.round(h * this._mapAspect) + 'px';
      inner.style.setProperty('--mh', h + 'px');
    }

    // ---------- clear modal ----------
    showClear(stage, level) {
      const m = $('#clear-modal');
      const count = Play.levelCount(stage);
      $('#clear-title').textContent = `${level + 1}단계 클리어!`;
      $('.clear-guardian', m).innerHTML = Art.dino(Art.GUARDIANS[stage].kind, 'laugh');
      const next = $('[data-act="next"]', m);
      const last = level >= count - 1;
      next.textContent = last ? (stage < 3 ? '다음 스테이지 ▶' : '스테이지 선택') : '다음 단계 ▶';
      m.hidden = false;
      this.hideCelebrate();
      this.audio.play('clear');
      m._next = () => {
        if (!last) this.startLevel(stage, level + 1);
        else if (stage < 3) this.showMap(stage + 1);
        else this.showStages(3);
      };
      setTimeout(() => next.focus({ preventScroll: true }), 50);
    }

    // ---------- feedback overlays ----------
    celebrate(stage) {
      const c = $('#celebrate');
      $('.celebrate-dino', c).innerHTML = Art.dino(Art.GUARDIANS[stage].kind, 'laugh');
      c.hidden = false;
      c.classList.remove('go');
      void c.offsetWidth;
      c.classList.add('go');
      this.fireworks($('.fireworks', c));
      clearTimeout(this._celebT);
      this._celebT = setTimeout(() => this.hideCelebrate(), 1850);
    }
    hideCelebrate() {
      const c = $('#celebrate');
      c.hidden = true;
      c.classList.remove('go');
      if (this._fwRaf) cancelAnimationFrame(this._fwRaf);
      this._fwRaf = 0;
    }
    fireworks(cv) {
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
      const ctx = cv.getContext('2d');
      const colors = ['#ffd23f', '#ff6b6b', '#4dd0e1', '#a3e635', '#f472b6', '#fb923c', '#ffffff'];
      const parts = [];
      const reduce = reducedMotion();
      const bursts = reduce ? 3 : 6;
      for (let b = 0; b < bursts; b++) {
        const cx = W * (0.15 + Math.random() * 0.7), cy = H * (0.15 + Math.random() * 0.4);
        const col = colors[b % colors.length];
        const n = reduce ? 14 : 46;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, sp = (reduce ? 0.4 : 1) * (2 + Math.random() * 4) * dpr;
          parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, delay: b * 9, col, r: (2 + Math.random() * 3) * dpr });
        }
      }
      const tick = () => {
        ctx.clearRect(0, 0, W, H);
        let alive = 0;
        for (const p of parts) {
          if (p.delay > 0) { p.delay--; alive++; continue; }
          p.x += p.vx; p.y += p.vy; p.vy += 0.06 * dpr; p.vx *= 0.985; p.life -= 0.013;
          if (p.life <= 0) continue;
          alive++;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.col;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (alive) this._fwRaf = requestAnimationFrame(tick);
      };
      if (this._fwRaf) cancelAnimationFrame(this._fwRaf);
      this._fwRaf = requestAnimationFrame(tick);
    }
    flashWrong() {
      const w = $('#wrong-flash');
      w.classList.remove('go');
      void w.offsetWidth;
      w.classList.add('go');
      const s = $('#screen-play');
      s.classList.remove('shake');
      void s.offsetWidth;
      if (!reducedMotion()) s.classList.add('shake');
    }

    // ---------- menu ----------
    buildMenu() {
      $('#menu-btn').addEventListener('click', () => (this.menuOpen ? this.closeMenu() : this.openMenu()));
      $('#menu').addEventListener('click', (e) => {
        if (e.target.id === 'menu') this.closeMenu();
      });
      $$('#menu [data-act]').forEach((b) => b.addEventListener('click', () => this.menuAction(b.dataset.act)));
      $$('#menu .m-toggle').forEach((b) => b.addEventListener('click', () => this.toggleSetting(b.dataset.setting)));
      const rs = $('#confirm-reset');
      $('[data-act="cancel"]', rs).addEventListener('click', () => {
        this.audio.play('tap');
        rs.hidden = true;
        $('#menu [data-act="reset"]').focus();
      });
      $('[data-act="confirm"]', rs).addEventListener('click', () => {
        this.store.resetProgress();
        this.audio.play('whoosh');
        rs.hidden = true;
        this.closeMenu(true);
        this.showStages();
      });
      const cm = $('#clear-modal');
      $('[data-act="map"]', cm).addEventListener('click', () => {
        this.audio.play('tap');
        this.showMap(this.currentStage);
      });
      $('[data-act="next"]', cm).addEventListener('click', () => {
        this.audio.play('tap');
        if (cm._next) cm._next();
      });
    }
    openMenu() {
      this.menuOpen = true;
      $('#menu').hidden = false;
      $$('#menu .menu-view').forEach((v) => (v.hidden = v.dataset.view !== 'main'));
      $('#menu-btn').setAttribute('aria-label', '메뉴 닫기');
      $('#menu-btn').classList.add('open');
      this.updateMenuState();
      if (this.runner) this.runner.pause('menu');
      this.audio.play('tap');
      setTimeout(() => $('#menu [data-act="continue"]').focus({ preventScroll: true }), 30);
    }
    closeMenu(silent) {
      if (!this.menuOpen) return;
      this.menuOpen = false;
      $('#menu').hidden = true;
      $('#confirm-reset').hidden = true;
      $('#menu-btn').setAttribute('aria-label', '메뉴 열기');
      $('#menu-btn').classList.remove('open');
      if (!silent) this.audio.play('tap');
      if (this.runner) this.runner.resume('menu'); // restores canvas focus
    }
    updateMenuState() {
      const skip = $('#menu [data-act="skip"]');
      if (skip) skip.disabled = this.screen !== 'play';
      const map = $('#menu [data-act="map"]');
      if (map) map.textContent = `현재 스테이지 지도 (${this.currentStage}스테이지)`;
    }
    menuAction(act) {
      switch (act) {
        case 'continue': this.closeMenu(); break;
        case 'cover': this.closeMenu(true); this.audio.play('tap'); this.show('cover'); break;
        case 'stages': this.closeMenu(true); this.audio.play('tap'); this.showStages(this.currentStage); break;
        case 'map': this.closeMenu(true); this.audio.play('tap'); this.showMap(this.currentStage); break;
        case 'skip': this.closeMenu(true); this.play.skip(); break;
        case 'calc': this.closeMenu(true); this.audio.play('tap'); this.showCalc(); break;
        case 'picker': this.openPicker(this.currentStage); break;
        case 'back-main':
          this.audio.play('tap');
          $$('#menu .menu-view').forEach((v) => (v.hidden = v.dataset.view !== 'main'));
          break;
        case 'reset':
          this.audio.play('tap');
          $('#confirm-reset').hidden = false;
          setTimeout(() => $('#confirm-reset [data-act="cancel"]').focus(), 30);
          break;
      }
    }
    openPicker(stage) {
      this.audio.play('tap');
      $$('#menu .menu-view').forEach((v) => (v.hidden = v.dataset.view !== 'picker'));
      const tabs = $('.picker-stages');
      tabs.innerHTML = STAGES.map((st) => `<button type="button" role="tab" class="p-tab s${st.id}" aria-selected="${st.id === stage}" data-stage="${st.id}">${st.id}스테이지<br><small>${st.title}</small></button>`).join('');
      $$('.p-tab', tabs).forEach((t) => t.addEventListener('click', () => this.openPicker(Number(t.dataset.stage))));
      const lv = $('.picker-levels');
      const n = Play.levelCount(stage);
      let h = '';
      for (let i = 0; i < n; i++) {
        const c = this.store.isCleared(stage, i);
        h += `<button type="button" class="p-level ${c ? 'cleared' : ''}" data-level="${i}" aria-label="${stage}스테이지 ${i + 1}단계 ${Play.levelName(stage, i)}${c ? ', 클리어함' : ''}">${i + 1}${c ? '<span aria-hidden="true">★</span>' : ''}</button>`;
      }
      lv.innerHTML = h;
      $$('.p-level', lv).forEach((b) =>
        b.addEventListener('click', () => {
          this.closeMenu(true);
          this.audio.play('tap');
          this.startLevel(stage, Number(b.dataset.level));
        })
      );
    }

    // ---------- standalone calculator & secret ----------
    buildCalc() {
      $('.calc-bg').innerHTML = Art.grassland();
      $('.f-brachio').innerHTML = Art.dino('brachio');
      $('.f-stego').innerHTML = Art.dino('stego');
      $('.f-tyranno').innerHTML = Art.dino('tyranno');
      this.calc = CalcUI.createCalculator({
        displayMount: $('.calc-mount-display'),
        keysMount: $('.calc-mount-keys'),
        isLocked: () => this.breaking,
        onEvent: (ev) => {
          if (ev.type === 'result' && ev.secret && this.screen === 'calc') this.breakCalculator();
        },
      });
    }
    showCalc() {
      this.breaking = false;
      $('#standalone-calc').classList.remove('cracking', 'broken');
      this.calc.reset();
      this.show('calc');
    }
    breakCalculator() {
      this.breaking = true;
      const body = $('#standalone-calc');
      const reduce = reducedMotion();
      this.audio.play('crack');
      body.classList.add('cracking');
      setTimeout(() => {
        if (this.screen !== 'calc') return;
        this.audio.play('shatter');
        if (!reduce) this.scatter(body);
        body.classList.add('broken');
      }, reduce ? 300 : 750);
      setTimeout(() => {
        if (this.screen !== 'calc') return;
        $('#shards').innerHTML = '';
        this.startRunner();
      }, reduce ? 700 : 1700);
    }
    scatter(body) {
      const r = body.getBoundingClientRect();
      const host = $('#shards');
      host.innerHTML = '';
      const cols = 3, rows = 4;
      const pts = [];
      for (let y = 0; y <= rows; y++) {
        pts.push([]);
        for (let x = 0; x <= cols; x++) {
          const jx = x > 0 && x < cols ? (Math.random() - 0.5) * 18 : 0;
          const jy = y > 0 && y < rows ? (Math.random() - 0.5) * 14 : 0;
          pts[y].push([(100 * x) / cols + jx, (100 * y) / rows + jy]);
        }
      }
      const tris = [];
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const a = pts[y][x], b = pts[y][x + 1], c = pts[y + 1][x + 1], d = pts[y + 1][x];
          tris.push([a, b, c], [a, c, d]);
        }
      tris.forEach((t) => {
        const s = document.createElement('div');
        s.className = 'shard';
        s.style.left = r.left + 'px';
        s.style.top = r.top + 'px';
        s.style.width = r.width + 'px';
        s.style.height = r.height + 'px';
        s.style.clipPath = `polygon(${t.map((p) => `${p[0]}% ${p[1]}%`).join(',')})`;
        const clone = body.cloneNode(true);
        clone.removeAttribute('id');
        clone.classList.remove('cracking', 'broken');
        clone.classList.add('shard-clone');
        s.append(clone);
        const cx = (t[0][0] + t[1][0] + t[2][0]) / 3 - 50, cy = (t[0][1] + t[1][1] + t[2][1]) / 3 - 50;
        s.style.setProperty('--dx', cx * (6 + Math.random() * 6) + 'px');
        s.style.setProperty('--dy', cy * (5 + Math.random() * 5) + 160 + 'px');
        s.style.setProperty('--rot', (Math.random() - 0.5) * 220 + 'deg');
        host.append(s);
      });
    }
    startRunner() {
      this.breaking = false;
      this.show('runner');
      this.runner = new DME.RunnerGame($('#screen-runner'), {
        audio: this.audio,
        onExit: () => {
          this.audio.play('tap');
          this.showCalc();
        },
      });
      if (this.menuOpen) this.runner.pause('menu');
      if (document.visibilityState === 'hidden') this.runner.pause('hidden');
    }

    // ---------- global input ----------
    bindGlobal() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (!$('#confirm-reset').hidden) {
            $('#confirm-reset').hidden = true;
            return;
          }
          if (this.menuOpen) {
            this.closeMenu();
            return;
          }
        }
        if (this.menuOpen || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
        let calc = null;
        if (this.screen === 'calc' && !this.breaking) calc = this.calc;
        else if (this.screen === 'play' && this.play.calc) calc = this.play.calc;
        if (!calc) return;
        const k = CalcUI.keyFromEvent(e);
        if (!k) return;
        if ((k === '=' && e.key === 'Enter') && e.target && e.target.tagName === 'BUTTON') return; // let Enter press the focused button
        e.preventDefault();
        calc.press(k);
      });
      document.addEventListener('gesturestart', (e) => e.preventDefault());
      document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
    }
  }

  function safeLocalStorage() {
    try {
      const k = '__dme_test__';
      root.localStorage.setItem(k, '1');
      root.localStorage.removeItem(k);
      return root.localStorage;
    } catch (e) {
      return Storage.memoryStorage();
    }
  }

  function boot() {
    try {
      DME.app = new App();
    } catch (err) {
      console.error(err);
      document.body.insertAdjacentHTML('beforeend', '<div class="fatal">앗! 게임을 여는 중에 문제가 생겼어요. 페이지를 새로 고침해 주세요.</div>');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof self !== 'undefined' ? self : this);
