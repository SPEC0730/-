/*
 * Educational play screen controller for all three stages.
 *  Stage 1: drag operator tokens into equation slots, confirm with "=".
 *  Stage 2: calculator + result tokens + answer slot (+ scratch slot for
 *           mixed expressions), confirm with "확인".
 *  Stage 3: story problems with the same calculator workbench.
 */
(function (root) {
  'use strict';
  const DME = (root.DME = root.DME || {});
  const { MathGen, Stories, Progress, Boards, Art, Drag, CalcUI } = DME;
  const SYM = MathGen.SYMBOL;
  const OP_CLASS = { '+': 'op-add', '-': 'op-sub', '*': 'op-mul', '/': 'op-div' };
  const OP_ARIA = { '+': '더하기', '-': '빼기', '*': '곱하기', '/': '나누기' };
  const OP_WORD = { '+': '더하기', '-': '빼기', '*': '곱하기', '/': '나누기' };

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function levelCount(stage) {
    return stage === 1 ? MathGen.STAGE1_LEVELS.length : stage === 2 ? MathGen.STAGE2_LEVELS.length : Stories.LEVELS.length;
  }
  function levelName(stage, idx) {
    if (stage === 1) return MathGen.STAGE1_LEVELS[idx].name;
    if (stage === 2) return MathGen.STAGE2_LEVELS[idx].name;
    return Stories.LEVELS[idx].name;
  }

  class PlayController {
    constructor(app, screen) {
      this.app = app;
      this.screen = screen;
      this.stage = 1;
      this.level = 0;
      this.locked = false;
      this.genState = {};
      this.selected = null; // tap-selected token id
      this.timers = [];
      this._onResize = () => this.layoutTokens();
      window.addEventListener('resize', this._onResize);
      window.addEventListener('orientationchange', () => setTimeout(this._onResize, 250));
    }

    get settings() {
      return this.app.store.settings;
    }
    sfx(name) {
      if (DME.audio) DME.audio.play(name);
    }
    later(fn, ms) {
      const t = setTimeout(fn, ms);
      this.timers.push(t);
      return t;
    }
    clearTimers() {
      this.timers.forEach(clearTimeout);
      this.timers = [];
    }

    start(stage, level) {
      this.clearTimers();
      Drag.cancelAll();
      this.stage = stage;
      this.level = level;
      this.session = new Progress.LevelSession();
      this.genState = {};
      this.locked = false;
      this.buildFrame();
      this.nextQuestion();
    }

    leave() {
      this.clearTimers();
      Drag.cancelAll();
      this.locked = false;
      this.question = null;
      if (this.calc) this.calc = null;
    }

    buildFrame() {
      const s = this.screen;
      s.innerHTML = '';
      s.dataset.stage = this.stage;
      const top = el('div', 'play-top');
      const back = el('button', 'btn btn-small btn-back', '<span aria-hidden="true">◀</span> 지도');
      back.type = 'button';
      back.setAttribute('aria-label', '지도로 돌아가기');
      back.addEventListener('click', () => this.app.showMap(this.stage));
      this.starsEl = el('div', 'stars');
      this.starsEl.setAttribute('role', 'status');
      const guardian = el('div', 'mini-guardian dino walk', Art.dino(Art.GUARDIANS[this.stage].kind));
      guardian.setAttribute('aria-hidden', 'true');
      top.append(back, this.starsEl, guardian);
      this.body = el('div', 'play-body');
      this.feedback = el('div', 'feedback-bubble');
      this.feedback.setAttribute('role', 'status');
      this.feedback.setAttribute('aria-live', 'assertive');
      this.tokenLayer = el('div', 'token-layer');
      s.append(top, this.body, this.feedback, this.tokenLayer);
      this.renderStars();
    }

    renderStars() {
      const n = this.session.correct;
      let h = '';
      for (let i = 0; i < 3; i++) h += `<span class="star ${i < n ? 'on' : ''}" aria-hidden="true">★</span>`;
      this.starsEl.innerHTML = h;
      this.starsEl.setAttribute('aria-label', `맞힌 문제 ${n}개, 3개를 맞히면 클리어`);
    }

    say(text, kind) {
      const f = this.feedback;
      f.textContent = text;
      f.className = 'feedback-bubble show ' + (kind || '');
      clearTimeout(this._sayT);
      this._sayT = setTimeout(() => f.classList.remove('show'), 1900);
    }

    nextQuestion() {
      this.clearTimers();
      Drag.cancelAll();
      this.selected = null;
      this.locked = false;
      this.feedback.classList.remove('show');
      this.tokenLayer.innerHTML = '';
      this.body.innerHTML = '';
      if (this.stage === 1) {
        const lv = MathGen.STAGE1_LEVELS[this.level];
        this.question = MathGen.generate(lv, this.genState);
        this.buildStage1();
      } else {
        if (this.stage === 2) {
          const lv = MathGen.STAGE2_LEVELS[this.level];
          this.question = MathGen.generate(lv, this.genState);
        } else {
          this.question = Stories.generate(this.level, this.genState);
        }
        this.buildCalcStage();
      }
      if (DME.__onQuestion) DME.__onQuestion(this);
    }

    skip() {
      if (this.locked) return;
      this.session.skip();
      this.sfx('whoosh');
      this.nextQuestion();
      this.say('새 문제예요!', 'info');
    }

    // ================= Stage 1 =================
    buildStage1() {
      const q = this.question;
      const wrap = el('div', 's1-play');
      wrap.append(el('p', 'instruction desc', '알맞은 기호를 끌어서 빈칸에 넣어요. 기호를 누른 다음 빈칸을 눌러도 돼요.'));
      const eq = el('div', 'equation');
      eq.setAttribute('aria-label', '문제 식');
      this.slotEls = [];
      q.nums.forEach((n, i) => {
        eq.append(el('span', 'eq-num', String(n)));
        if (i < q.ops.length) {
          const slot = el('div', 'op-slot');
          slot.dataset.slot = i;
          slot.setAttribute('role', 'button');
          slot.setAttribute('tabindex', '0');
          slot.setAttribute('aria-label', `${i + 1}번째 기호 빈칸`);
          const ghost = el('span', 'slot-ghost ' + OP_CLASS[q.ops[i]], SYM[q.ops[i]]);
          ghost.setAttribute('aria-hidden', 'true');
          slot.append(ghost);
          slot.addEventListener('click', () => this.s1TapSlot(i));
          slot.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              this.s1TapSlot(i);
            }
          });
          eq.append(slot);
          this.slotEls.push(slot);
        }
      });
      eq.append(el('span', 'eq-sign', '='), el('span', 'eq-num eq-result', String(q.answer)));
      wrap.append(eq);

      const bottom = el('div', 's1-bottom');
      const tray = el('div', 'op-tray');
      tray.setAttribute('aria-label', '기호 고르기');
      const copies = q.ops.length;
      const order = ['+', '-', '*', '/'];
      const trayOps = [];
      for (let c = 0; c < copies; c++) order.forEach((op) => trayOps.push(op));
      tray.style.setProperty('--rows', copies);
      this.board = new Boards.OperatorBoard(q.ops.length, trayOps);
      this.homeEls = [];
      this.opEls = {};
      this.board.tokens.forEach((t) => {
        const cell = el('div', 'tray-cell');
        cell.addEventListener('click', () => this.s1TapHome(t.id));
        tray.append(cell);
        this.homeEls.push(cell);
        const tok = el('button', `op-token ${OP_CLASS[t.op]}`, SYM[t.op]);
        tok.type = 'button';
        tok.dataset.id = t.id;
        tok.setAttribute('aria-label', `${OP_ARIA[t.op]} 기호`);
        this.opEls[t.id] = tok;
        Drag.makeDraggable(tok, {
          canStart: () => !this.locked,
          onStart: () => {
            this.sfx('pickup');
            this.setSelected(null);
            this.slotEls.forEach((s) => s.classList.add('drop-ready'));
          },
          onDrop: (x, y) => this.s1Drop(t.id, x, y),
          onCancel: () => this.s1Render(),
          onTap: () => this.s1TapToken(t.id),
        });
      });
      const confirm = el('button', 'btn-confirm btn-equals', '=');
      confirm.type = 'button';
      confirm.setAttribute('aria-label', '정답 확인');
      confirm.addEventListener('click', () => this.s1Confirm());
      bottom.append(tray, confirm);
      wrap.append(bottom);
      this.body.append(wrap);
      this.eqEl = eq;
      this.s1Render();
      this.applyHints();
      requestAnimationFrame(() => fitWidth(eq));
    }

    s1Render() {
      this.board.tokens.forEach((t) => {
        const tok = this.opEls[t.id];
        const target = t.slot === null ? this.homeEls[t.home] : this.slotEls[t.slot];
        if (tok.parentNode !== target) target.append(tok);
        tok.classList.toggle('placed', t.slot !== null);
        tok.classList.toggle('selected', this.selected === t.id);
      });
      this.slotEls.forEach((s, i) => {
        s.classList.toggle('filled', !!this.board.slots[i]);
        s.classList.remove('drop-ready');
      });
      this.homeEls.forEach((h, i) => h.classList.toggle('empty', this.board.tokens[i].slot !== null));
    }

    s1Drop(id, x, y) {
      let target = -1;
      let best = Infinity;
      this.slotEls.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const margin = r.width * 0.45;
        if (Boards.nearRect(x, y, r, margin)) {
          const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
          if (d < best) {
            best = d;
            target = i;
          }
        }
      });
      if (target >= 0) {
        this.board.place(id, target);
        this.sfx('snap');
      } else {
        this.board.returnHome(id);
        this.sfx('drop');
      }
      this.s1Render();
    }

    setSelected(id) {
      this.selected = id;
      if (this.stage === 1) this.s1Render();
      else this.layoutTokens();
      this.screen.classList.toggle('has-selection', !!id);
      if (this.stage !== 1 && this.baby) this.baby.classList.toggle('open', !!id);
    }

    s1TapToken(id) {
      if (this.locked) return;
      if (this.selected === id) {
        this.setSelected(null);
        this.sfx('tap');
        return;
      }
      const t = this.board.token(id);
      // A selected token tapped onto a placed token's slot: swap into that slot.
      if (this.selected && t.slot !== null) {
        this.s1TapSlot(t.slot);
        return;
      }
      this.sfx('pickup');
      this.setSelected(id);
    }
    s1TapSlot(i) {
      if (this.locked) return;
      if (this.selected) {
        this.board.place(this.selected, i);
        this.selected = null;
        this.sfx('snap');
        this.s1Render();
        this.screen.classList.remove('has-selection');
      } else if (this.board.slots[i]) {
        this.s1TapToken(this.board.slots[i]);
      }
    }
    s1TapHome(id) {
      if (this.locked) return;
      if (this.selected && this.selected === id) {
        this.board.returnHome(id);
        this.setSelected(null);
        this.sfx('drop');
      }
    }

    s1Confirm() {
      if (this.locked) return;
      this.sfx('tap');
      if (!this.board.isComplete()) {
        this.say('빈칸에 기호를 모두 넣어 주세요.', 'info');
        this.slotEls.forEach((s) => !s.classList.contains('filled') && pulse(s));
        return;
      }
      const ok = MathGen.checkOperators(this.question.nums, this.board.placedOps(), this.question.answer);
      this.handleResult(ok);
    }

    // ================= Stage 2 & 3 =================
    buildCalcStage() {
      const q = this.question;
      const wrap = el('div', 'calc-play');
      const qa = el('div', 'question-area');
      this.answerSlot = el('div', 'answer-slot');
      this.answerSlot.setAttribute('role', 'button');
      this.answerSlot.setAttribute('tabindex', '0');
      this.answerSlot.setAttribute('aria-label', '정답 칸. 숫자 카드를 여기에 넣어요.');
      this.answerSlot.addEventListener('click', () => this.tapSlot('answer'));
      this.scratchSlot = null;

      if (this.stage === 2) {
        qa.append(el('p', 'instruction desc', '계산기로 계산하고, 나온 숫자 카드를 정답 칸에 넣어요.'));
        const eq = el('div', 'equation calc-eq');
        eq.setAttribute('aria-label', '문제 식');
        q.nums.forEach((n, i) => {
          eq.append(el('span', 'eq-num', String(n)));
          if (i < q.ops.length) {
            const o = el('span', 'eq-op ' + OP_CLASS[q.ops[i]], SYM[q.ops[i]]);
            o.dataset.opIndex = i;
            o.setAttribute('aria-label', OP_WORD[q.ops[i]]);
            eq.append(o);
          }
        });
        eq.append(el('span', 'eq-sign', '='), this.answerSlot);
        qa.append(eq);
        this.eqEl = eq;
        if (q.ops.length > 1) {
          const sc = el('div', 'scratch-wrap');
          this.scratchSlot = el('div', 'scratch-slot');
          this.scratchSlot.setAttribute('role', 'button');
          this.scratchSlot.setAttribute('tabindex', '0');
          this.scratchSlot.setAttribute('aria-label', '중간 계산 보관 칸. 채점하지 않아요.');
          this.scratchSlot.addEventListener('click', () => this.tapSlot('scratch'));
          sc.append(el('span', 'scratch-label desc', '중간 계산'), this.scratchSlot);
          this.hintEl = el('p', 'order-hint hint-only');
          sc.append(this.hintEl);
          qa.append(sc);
        }
      } else {
        const card = el('div', 'story-card');
        const icon = el('div', 'story-icon', q.icon);
        icon.setAttribute('aria-hidden', 'true');
        const text = el('p', 'story-text');
        text.innerHTML = escapeHtml(q.text).replace(/(\d+)/g, '<b class="num">$1</b>');
        const ans = el('div', 'story-answer');
        ans.append(el('span', 'answer-label desc', '정답'), this.answerSlot, el('span', 'answer-unit', q.unit));
        card.append(icon, text, ans);
        this.hintEl = el('p', 'story-hint hint-only', '이야기 속 숫자를 찾아 계산기로 하나씩 눌러 보세요.');
        qa.append(card, this.hintEl);
      }

      const wb = el('div', 'workbench');
      const dispMount = el('div', 'wb-display');
      const belt = el('div', 'conveyor');
      belt.setAttribute('aria-label', '숫자 카드 컨베이어');
      const beltTrack = el('div', 'belt-track');
      this.beltCells = [];
      this.ws = new Boards.ResultWorkspace({ capacity: 4 });
      for (let i = 0; i < this.ws.capacity; i++) {
        const c = el('div', 'belt-cell');
        beltTrack.append(c);
        this.beltCells.push(c);
      }
      belt.append(el('div', 'belt-gear left'), beltTrack, el('div', 'belt-gear right'));
      const keysMount = el('div', 'wb-keys');
      const side = el('div', 'wb-side');
      this.baby = el('div', 'baby-nest', Art.babyNest());
      this.baby.setAttribute('aria-label', '아기 공룡. 숫자 카드를 입에 넣으면 먹어서 없애요.');
      const mouthZone = this.baby.querySelector('#mouth-zone');
      mouthZone.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selected) this.eatToken(this.selected);
      });
      const confirm = el('button', 'btn-confirm btn-check', '확인');
      confirm.type = 'button';
      confirm.setAttribute('aria-label', '정답 확인');
      confirm.addEventListener('click', () => this.calcConfirm());
      side.append(this.baby, confirm);
      wb.append(dispMount, belt, keysMount, side);
      wrap.append(qa, wb);
      this.body.append(wrap);
      this.tokenEls = {};
      this.calc = CalcUI.createCalculator({
        displayMount: dispMount,
        keysMount,
        isLocked: () => this.locked,
        onEvent: (ev) => {
          if (ev.type === 'result') this.addResultToken(ev.value);
        },
      });
      this.applyHints();
      requestAnimationFrame(() => {
        if (this.eqEl) fitWidth(this.eqEl);
        this.layoutTokens();
      });
    }

    addResultToken(value) {
      const { id, dropped } = this.ws.create(value);
      dropped.forEach((d) => {
        const e = this.tokenEls[d];
        if (e) {
          e.classList.add('fall-off');
          setTimeout(() => e.remove(), 500);
          delete this.tokenEls[d];
        }
      });
      const tok = el('button', 'num-token', '');
      tok.type = 'button';
      tok.dataset.id = id;
      const label = DME.CalcEngine.formatNumber(value);
      tok.innerHTML = `<span>${label}</span>`;
      tok.style.setProperty('--len', String(label.length));
      tok.setAttribute('aria-label', `숫자 카드 ${label}`);
      tok.classList.add('new');
      this.tokenLayer.append(tok);
      this.tokenEls[id] = tok;
      Drag.makeDraggable(tok, {
        canStart: () => !this.locked && this.ws.get(id) !== null,
        onStart: () => {
          this.sfx('pickup');
          this.selected = null;
          this.baby.classList.add('open');
          this.screen.classList.add('is-dragging');
        },
        onMove: (x, y) => {
          const near = Boards.isPointInMouth(x, y, this.mouthRect(), 1.35);
          this.baby.classList.toggle('hungry', near);
        },
        onDrop: (x, y) => this.dropToken(id, x, y),
        onCancel: () => {
          this.baby.classList.remove('open', 'hungry');
          this.screen.classList.remove('is-dragging');
          this.layoutTokens();
        },
        onTap: () => this.tapToken(id),
      });
      this.layoutTokens();
      setTimeout(() => tok.classList.remove('new'), 450);
    }

    mouthRect() {
      const m = this.baby && this.baby.querySelector('#mouth-zone');
      return m ? m.getBoundingClientRect() : null;
    }

    screenPoint(x, y) {
      const r = this.screen.getBoundingClientRect();
      return { x: x - r.left, y: y - r.top, w: r.width, h: r.height };
    }

    dropToken(id, x, y) {
      this.screen.classList.remove('is-dragging');
      this.baby.classList.remove('hungry');
      // 1) Only the MOUTH deletes (ellipse hit area that scales with the art).
      if (Boards.isPointInMouth(x, y, this.mouthRect(), 1.35)) {
        this.eatToken(id);
        return;
      }
      this.baby.classList.remove('open');
      // 2) Answer slot, 3) scratch slot (snap when dropped nearby)
      const tokSize = this.tokenEls[id].getBoundingClientRect().width || 80;
      for (const [name, slotEl, m] of [['answer', this.answerSlot, 0.6], ['scratch', this.scratchSlot, 0.45]]) {
        if (!slotEl) continue;
        const r = slotEl.getBoundingClientRect();
        if (Boards.nearRect(x, y, r, tokSize * m)) {
          this.putInSlot(id, name);
          return;
        }
      }
      // 4) Anywhere else: stay where dropped (clamped to the screen).
      const p = this.screenPoint(x, y);
      const half = tokSize / 2;
      this.ws.moveFree(id, clamp(p.x, half, p.w - half), clamp(p.y, half + 8, p.h - half));
      this.sfx('drop');
      this.layoutTokens();
    }

    putInSlot(id, name) {
      const slotEl = name === 'answer' ? this.answerSlot : this.scratchSlot;
      const r = slotEl.getBoundingClientRect();
      const p = this.screenPoint(r.left + r.width / 2, r.bottom + r.height * 0.75);
      const half = 45;
      const { displaced } = this.ws.placeInSlot(id, name, clamp(p.x + 30, half, p.w - half), clamp(p.y, half, p.h - half));
      this.sfx('snap');
      this.selected = null;
      this.baby.classList.remove('open');
      this.screen.classList.remove('has-selection');
      this.layoutTokens();
      if (displaced && this.tokenEls[displaced]) pulse(this.tokenEls[displaced]);
    }

    eatToken(id) {
      const tok = this.tokenEls[id];
      if (!tok || !this.ws.remove(id)) return;
      delete this.tokenEls[id];
      this.selected = null;
      this.screen.classList.remove('has-selection');
      const mr = this.mouthRect();
      const p = this.screenPoint(mr.left + mr.width / 2, mr.top + mr.height / 2);
      tok.classList.add('eaten');
      tok.style.left = p.x + 'px';
      tok.style.top = p.y + 'px';
      setTimeout(() => tok.remove(), 400);
      this.sfx('crunch');
      this.baby.classList.remove('open');
      this.baby.classList.add('chewing');
      clearTimeout(this._chewT);
      this._chewT = setTimeout(() => this.baby.classList.remove('chewing'), 1000);
      this.layoutTokens();
    }

    tapToken(id) {
      if (this.locked) return;
      if (this.selected === id) {
        this.setSelected(null);
        this.sfx('tap');
        return;
      }
      this.sfx('pickup');
      this.setSelected(id);
    }

    tapSlot(name) {
      if (this.locked) return;
      if (this.selected) this.putInSlot(this.selected, name);
      else {
        const occ = this.ws.slots[name];
        if (occ) this.tapToken(occ);
      }
    }

    layoutTokens() {
      if (!this.ws || !this.tokenEls) return;
      const sr = this.screen.getBoundingClientRect();
      const center = (e) => {
        const r = e.getBoundingClientRect();
        return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 };
      };
      for (const [id, t] of this.ws.tokens) {
        const tok = this.tokenEls[id];
        if (!tok) continue;
        let pos;
        tok.classList.remove('on-belt', 'in-answer', 'in-scratch');
        if (t.loc === 'conveyor') {
          const idx = this.ws.conveyor.indexOf(id);
          pos = center(this.beltCells[idx]);
          tok.classList.add('on-belt');
        } else if (t.loc === 'answer') {
          pos = center(this.answerSlot);
          tok.classList.add('in-answer');
        } else if (t.loc === 'scratch') {
          pos = center(this.scratchSlot);
          tok.classList.add('in-scratch');
        } else pos = { x: t.x, y: t.y };
        tok.style.left = pos.x + 'px';
        tok.style.top = pos.y + 'px';
        tok.classList.toggle('selected', this.selected === id);
      }
      if (this.answerSlot) this.answerSlot.classList.toggle('filled', !!this.ws.slots.answer);
      if (this.scratchSlot) this.scratchSlot.classList.toggle('filled', !!this.ws.slots.scratch);
    }

    calcConfirm() {
      if (this.locked) return;
      this.sfx('tap');
      const v = this.ws.slotValue('answer');
      if (v === null) {
        this.say('정답 칸에 숫자 카드를 넣어 주세요.', 'info');
        pulse(this.answerSlot);
        return;
      }
      this.handleResult(Math.abs(v - this.question.answer) < 1e-9);
    }

    // ================= shared feedback =================
    handleResult(ok) {
      const q = this.question;
      const r = this.session.confirm(q.id, ok);
      if (!ok) {
        this.sfx('wrong');
        this.app.flashWrong();
        this.say('삐빅! 다시 해 볼까요?', 'wrong');
        return;
      }
      this.locked = true;
      this.renderStars();
      this.sfx('correct');
      this.app.celebrate(this.stage);
      this.say('딩동댕! 정답이에요!', 'good');
      if (r.cleared) {
        this.app.store.markCleared(this.stage, this.level);
        this.later(() => this.app.showClear(this.stage, this.level), 1900);
      } else {
        this.later(() => this.nextQuestion(), 1900);
      }
    }

    applyHints() {
      const on = this.settings.hints;
      this.screen.classList.toggle('hints-on', on);
      if (this.stage === 2 && this.question && this.question.ops.length > 1 && this.eqEl) {
        const q = this.question;
        this.eqEl.querySelectorAll('.order-badge').forEach((b) => b.remove());
        this.eqEl.querySelectorAll('.eq-op').forEach((o) => o.classList.remove('first-op'));
        if (on) {
          q.order.forEach((opIdx, k) => {
            const o = this.eqEl.querySelector(`.eq-op[data-op-index="${opIdx}"]`);
            if (!o) return;
            const b = el('span', 'order-badge', k === 0 ? '①' : '②');
            b.setAttribute('aria-hidden', 'true');
            o.append(b);
            if (k === 0) o.classList.add('first-op');
          });
          const first = q.ops[q.order[0]], second = q.ops[q.order[1]];
          this.hintEl.textContent = `① ${OP_WORD[first]}를 먼저 계산하고, ② ${OP_WORD[second]}는 그다음에 해요.`;
        } else this.hintEl.textContent = '';
      }
    }
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function pulse(e) {
    e.classList.remove('pulse');
    void e.offsetWidth;
    e.classList.add('pulse');
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  /** Shrink an equation's font until it fits its container width. */
  function fitWidth(e) {
    e.style.fontSize = '';
    let size = parseFloat(getComputedStyle(e).fontSize);
    let guard = 0;
    while (e.scrollWidth > e.clientWidth + 2 && guard++ < 25 && size > 20) {
      size *= 0.92;
      e.style.fontSize = size + 'px';
    }
  }

  DME.Play = { PlayController, levelCount, levelName, fitWidth };
})(typeof self !== 'undefined' ? self : this);
