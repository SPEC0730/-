/*
 * Calculator widget: two stacked display rows (expression, result) and a
 * large keypad. The display and the keypad can be mounted in different
 * containers so a conveyor can sit beside the display.
 */
(function (root) {
  'use strict';
  const DME = (root.DME = root.DME || {});

  const KEYS = [
    { k: 'AC', label: 'AC', aria: '모두 지우기', cls: 'k-ac' },
    { k: 'BS', label: '⌫', aria: '한 글자 지우기', cls: 'k-fn' },
    { k: '/', label: '÷', aria: '나누기', cls: 'k-op op-div' },
    { k: '*', label: '×', aria: '곱하기', cls: 'k-op op-mul' },
    { k: '7', label: '7' }, { k: '8', label: '8' }, { k: '9', label: '9' },
    { k: '-', label: '−', aria: '빼기', cls: 'k-op op-sub' },
    { k: '4', label: '4' }, { k: '5', label: '5' }, { k: '6', label: '6' },
    { k: '+', label: '+', aria: '더하기', cls: 'k-op op-add' },
    { k: '1', label: '1' }, { k: '2', label: '2' }, { k: '3', label: '3' },
    { k: '=', label: '=', aria: '계산하기', cls: 'k-eq' },
    { k: '0', label: '0', cls: 'k-zero' },
  ];

  function createCalculator(opts) {
    const engine = new DME.CalcEngine.CalcEngine();
    const display = document.createElement('div');
    display.className = 'calc-display';
    display.innerHTML = `<div class="calc-row calc-expr" aria-live="polite" aria-label="입력한 식"></div>
      <div class="calc-row calc-result" aria-live="polite" aria-label="계산 결과"></div>`;
    const keys = document.createElement('div');
    keys.className = 'calc-keys';
    keys.setAttribute('role', 'group');
    keys.setAttribute('aria-label', '계산기 버튼');
    const btns = {};
    KEYS.forEach((d) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'calc-key ' + (d.cls || 'k-num');
      b.textContent = d.label;
      b.setAttribute('aria-label', d.aria || d.label);
      b.dataset.key = d.k;
      b.addEventListener('click', () => press(d.k));
      keys.appendChild(b);
      btns[d.k] = b;
    });
    opts.displayMount.appendChild(display);
    opts.keysMount.appendChild(keys);

    const exprEl = display.querySelector('.calc-expr');
    const resEl = display.querySelector('.calc-result');

    function render() {
      exprEl.textContent = engine.expressionText() || ' ';
      resEl.textContent = engine.resultText() || ' ';
      resEl.classList.toggle('is-error', !!engine.error);
      btns.AC.classList.toggle('flash', engine.flashAC);
      btns.AC.setAttribute('aria-label', engine.flashAC ? '모두 지우기 (눌러서 새로 계산하기)' : '모두 지우기');
      fit(exprEl);
      fit(resEl);
    }
    function fit(el) {
      el.style.fontSize = '';
      let guard = 0;
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 1 && guard++ < 20 && size > 14) {
        size *= 0.9;
        el.style.fontSize = size + 'px';
      }
    }
    function press(k) {
      if (opts.isLocked && opts.isLocked()) return;
      const ev = engine.press(k);
      const audio = DME.audio;
      if (ev.type === 'result') audio && audio.play('equals');
      else if (ev.type === 'error') audio && audio.play('wrong');
      else if (ev.type === 'ignored' && ev.reason === 'locked') {
        btns.AC.classList.remove('nudge');
        void btns.AC.offsetWidth;
        btns.AC.classList.add('nudge');
        audio && audio.play('tap');
      } else audio && audio.play('key');
      const b = btns[k];
      if (b) {
        b.classList.remove('pressed');
        void b.offsetWidth;
        b.classList.add('pressed');
      }
      render();
      if (opts.onEvent) opts.onEvent(ev, k);
    }
    render();
    return {
      engine,
      press,
      render,
      reset() {
        engine.clear();
        render();
      },
      display,
      keys,
      destroy() {
        display.remove();
        keys.remove();
      },
    };
  }

  /** Map a keyboard event to a calculator key, or null. */
  function keyFromEvent(e) {
    if (/^[0-9]$/.test(e.key)) return e.key;
    switch (e.key) {
      case '+': return '+';
      case '-': return '-';
      case '*': case 'x': case 'X': return '*';
      case '/': return '/';
      case '=': case 'Enter': return '=';
      case 'Backspace': return 'BS';
      case 'Escape': case 'Delete': case 'c': case 'C': return 'AC';
      default: return null;
    }
  }

  DME.CalcUI = { createCalculator, keyFromEvent };
})(typeof self !== 'undefined' ? self : this);
