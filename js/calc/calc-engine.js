/*
 * Calculator engine (no DOM). Entry rules:
 *  - digits build the current number (max 9 digits, no leading zeros)
 *  - operators + − × ÷ (a second operator replaces the previous one)
 *  - "=" evaluates with normal precedence exactly once; repeated "=" is
 *    ignored (no repeated operation, no result change, no new token)
 *  - after a result, only AC continues (AC also stops the red flash)
 *  - secret: the exact number 2243003 typed directly (no operator) then "="
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.DME = root.DME || {}).CalcEngine = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SECRET_CODE = '2243003';
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const MAX_DIGITS = 9;

  function evalTokens(tokens) {
    const nums = [];
    const ops = [];
    tokens.forEach((t, i) => (i % 2 === 0 ? nums.push(Number(t)) : ops.push(t)));
    // × ÷ first
    let i = 0;
    while (i < ops.length) {
      if (ops[i] === '*' || ops[i] === '/') {
        const a = nums[i], b = nums[i + 1];
        if (ops[i] === '/' && b === 0) return { error: '0으로 나눌 수 없어요' };
        nums.splice(i, 2, ops[i] === '*' ? a * b : a / b);
        ops.splice(i, 1);
      } else i++;
    }
    let acc = nums[0];
    for (let k = 0; k < ops.length; k++) acc = ops[k] === '+' ? acc + nums[k + 1] : acc - nums[k + 1];
    if (!Number.isFinite(acc) || Math.abs(acc) > 1e15) return { error: '숫자가 너무 커요' };
    return { value: Number(acc.toFixed(6)) === 0 ? 0 : Number(acc.toFixed(6)) };
  }

  function formatNumber(v) {
    if (typeof v !== 'number') return String(v);
    if (Number.isInteger(v)) return String(v);
    return String(Number(v.toFixed(6)));
  }

  class CalcEngine {
    constructor() {
      this.clear();
    }
    clear() {
      this.tokens = []; // completed numbers and operators, alternating
      this.current = ''; // number being typed
      this.done = false;
      this.result = null;
      this.error = null;
      this.flashAC = false;
    }
    expressionText() {
      const parts = this.tokens.map((t, i) => (i % 2 === 1 ? SYM[t] : t));
      if (this.current) parts.push(this.current);
      let s = parts.join(' ');
      if (this.done) s += ' =';
      return s;
    }
    resultText() {
      if (this.error) return this.error;
      if (this.result === null) return '';
      return formatNumber(this.result);
    }
    /**
     * Press a key: '0'-'9', '+', '-', '*', '/', '=', 'AC', 'BS'.
     * Returns an event describing what happened.
     */
    press(key) {
      if (key === 'AC') {
        const wasFlashing = this.flashAC;
        this.clear();
        return { type: 'clear', wasFlashing };
      }
      if (this.done) return { type: 'ignored', reason: key === '=' ? 'repeat-equals' : 'locked' };

      if (/^[0-9]$/.test(key)) {
        if (this.current.length >= MAX_DIGITS) return { type: 'ignored', reason: 'max-digits' };
        if (this.current === '0') this.current = key;
        else this.current += key;
        return { type: 'input' };
      }
      if (key === 'BS') {
        if (this.current) this.current = this.current.slice(0, -1);
        else if (this.tokens.length) {
          // With no number in progress the last token is an operator: remove
          // it and make the previous number editable again.
          this.tokens.pop();
          this.current = this.tokens.pop() || '';
        } else return { type: 'ignored', reason: 'empty' };
        return { type: 'input' };
      }
      if (key in SYM) {
        if (this.current) {
          this.tokens.push(this.current);
          this.current = '';
          this.tokens.push(key);
          return { type: 'input' };
        }
        if (this.tokens.length && this.tokens.length % 2 === 0) {
          this.tokens[this.tokens.length - 1] = key; // replace operator
          return { type: 'input' };
        }
        return { type: 'ignored', reason: 'no-number' };
      }
      if (key === '=') {
        if (!this.current) return { type: 'ignored', reason: 'incomplete' };
        const all = this.tokens.concat([this.current]);
        const directEntry = all.length === 1;
        const out = evalTokens(all);
        this.tokens = all;
        this.current = '';
        this.done = true;
        if (out.error) {
          this.error = out.error;
          return { type: 'error', message: out.error };
        }
        this.result = out.value;
        this.flashAC = true;
        return {
          type: 'result',
          value: out.value,
          directEntry,
          secret: directEntry && all[0] === SECRET_CODE,
        };
      }
      return { type: 'ignored', reason: 'unknown' };
    }
  }

  return { CalcEngine, SECRET_CODE, formatNumber, evalTokens };
});
