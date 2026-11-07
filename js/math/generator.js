/*
 * Math core: seeded RNG, precedence-aware evaluation, level definitions for
 * Stage 1 (operator drag) and Stage 2 (calculator arithmetic), and question
 * generation. Pure logic: no DOM access, usable from Node tests.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.DME = root.DME || {}).MathGen = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const OP_NAME = { '+': '덧셈', '-': '뺄셈', '*': '곱셈', '/': '나눗셈' };
  const DIGIT_NAME = { 1: '한 자리', 2: '두 자리', 3: '세 자리' };
  const RANGE = { 1: [1, 9], 2: [10, 99], 3: [100, 999] };

  // ---------- RNG helpers ----------
  function makeRng(seed) {
    if (seed === undefined || seed === null) return Math.random;
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }
  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }
  function weightedPick(rng, pairs) {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = rng() * total;
    for (const [v, w] of pairs) {
      if ((r -= w) < 0) return v;
    }
    return pairs[pairs.length - 1][0];
  }
  function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- Evaluation with normal precedence ----------
  /**
   * Evaluate nums[0] ops[0] nums[1] ops[1] ... with × ÷ before + −.
   * Returns { value, order, exact, nonNegative } where `order` lists the
   * operator indices in the order they are computed (used by hints).
   * `exact` is false when a division leaves a remainder; `value` is null
   * on division by zero.
   */
  function evaluate(nums, ops) {
    let vals = nums.map(Number);
    let opList = ops.map((op, i) => ({ op, idx: i }));
    const order = [];
    let exact = true;
    let nonNegative = vals.every((v) => v >= 0);
    // multiplicative pass
    let i = 0;
    while (i < opList.length) {
      const { op, idx } = opList[i];
      if (op === '*' || op === '/') {
        const a = vals[i];
        const b = vals[i + 1];
        let r;
        if (op === '*') r = a * b;
        else {
          if (b === 0) return { value: null, order, exact: false, nonNegative: false };
          r = a / b;
          if (!Number.isInteger(r)) exact = false;
        }
        order.push(idx);
        vals.splice(i, 2, r);
        opList.splice(i, 1);
      } else i++;
    }
    // additive pass, left to right
    let acc = vals[0];
    for (let k = 0; k < opList.length; k++) {
      const { op, idx } = opList[k];
      acc = op === '+' ? acc + vals[k + 1] : acc - vals[k + 1];
      if (acc < 0) nonNegative = false;
      order.push(idx);
    }
    return { value: acc, order, exact, nonNegative };
  }

  function isEducational(nums, ops) {
    const r = evaluate(nums, ops);
    return r.value !== null && r.exact && r.nonNegative && Number.isInteger(r.value) && r.value >= 0;
  }

  // ---------- Level definitions ----------
  function single(op, d) {
    return { mode: 'single', ops: [op], d, name: `${DIGIT_NAME[d]} ${OP_NAME[op]}` };
  }
  function mixed(ops, d, label) {
    return { mode: 'mixed', ops, d, name: `${DIGIT_NAME[d]} ${label}` };
  }

  const STAGE1_LEVELS = [
    single('+', 1), single('-', 1), single('+', 2), single('-', 2),
    single('+', 3), single('-', 3), single('*', 1), single('/', 1),
    single('*', 2), single('/', 2),
    mixed(['+', '-'], 1, '덧셈·뺄셈 섞기'),
    mixed(['+', '-'], 2, '덧셈·뺄셈 섞기'),
    mixed(['+', '*'], 1, '덧셈·곱셈 섞기'),
    mixed(['+', '-', '*'], 1, '덧셈·뺄셈·곱셈 섞기'),
    mixed(['+', '-', '*', '/'], 1, '사칙연산 섞기'),
    mixed(['+', '*', '-'], 2, '덧셈·곱셈·뺄셈 섞기'),
  ];

  const STAGE2_LEVELS = (function () {
    const out = [];
    for (const d of [1, 2, 3]) {
      out.push(single('+', d));
      out.push(single('-', d));
      out.push({ mode: 'rotate', ops: ['+', '-'], d, name: `${DIGIT_NAME[d]} 덧셈·뺄셈 번갈아` });
      out.push({ mode: 'weighted', ops: ['+', '-', '*', '/'], d, name: `${DIGIT_NAME[d]} 골고루 연습` });
      out.push(single('*', d));
      out.push(single('/', d));
    }
    for (const d of [1, 2, 3]) {
      out.push(mixed(['+', '-'], d, '덧셈·뺄셈 식'));
      out.push(mixed(['+', '*'], d, '덧셈·곱셈 식'));
      out.push(mixed(['-', '/'], d, '뺄셈·나눗셈 식'));
      out.push(mixed(['+', '-', '*', '/'], d, '사칙연산 식'));
    }
    return out;
  })();

  // ---------- Single-operation generation ----------
  function genSingle(op, d, rng) {
    const [lo, hi] = RANGE[d];
    let a, b;
    switch (op) {
      case '+':
        a = randInt(rng, lo, hi);
        b = randInt(rng, lo, hi);
        break;
      case '-':
        a = randInt(rng, lo, hi);
        b = randInt(rng, lo, hi);
        if (b > a) [a, b] = [b, a];
        break;
      case '*':
        a = randInt(rng, lo, hi);
        b = randInt(rng, lo, hi);
        break;
      case '/': {
        // Dividend and divisor both have d digits, quotient >= 2 (exact).
        const bLo = Math.max(2, lo);
        const bHi = Math.floor(hi / 2);
        b = randInt(rng, bLo, bHi);
        const q = randInt(rng, 2, Math.floor(hi / b));
        a = b * q;
        if (a < lo) a = b * Math.ceil(lo / b);
        break;
      }
      default:
        throw new Error('unknown op ' + op);
    }
    return { nums: [a, b], ops: [op] };
  }

  // ---------- Mixed (two operator) generation ----------
  function chooseMixedOps(pool, rng) {
    if (pool.length > 1 && rng() < 0.82) {
      const [x, y] = shuffle(rng, pool).slice(0, 2);
      return [x, y];
    }
    return [pick(rng, pool), pick(rng, pool)];
  }

  function divisorsInRange(v, lo, hi) {
    const out = [];
    if (!Number.isInteger(v) || v <= 0) return out;
    const top = Math.min(hi, v);
    for (let k = Math.max(2, lo); k <= top; k++) if (v % k === 0) out.push(k);
    return out;
  }

  function tryBuildMixed(ops, d, rng) {
    const [lo, hi] = RANGE[d];
    const nums = [randInt(rng, lo, hi)];
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (op === '/') {
        const chainStart = i === 0 || ops[i - 1] === '+' || ops[i - 1] === '-';
        if (chainStart) {
          // Re-pick the dividend so that it is a multiple of a d-digit divisor.
          const bLo = Math.max(2, lo);
          const bHi = Math.floor(hi / 2);
          if (bHi < bLo) return null;
          const b = randInt(rng, bLo, bHi);
          const qMax = Math.floor(hi / b);
          const qMin = Math.max(1, Math.ceil(lo / b));
          if (qMax < qMin) return null;
          nums[i] = b * randInt(rng, Math.max(qMin, Math.min(2, qMax)), qMax);
          nums.push(b);
        } else {
          // Chain like a × b ÷ c or a ÷ b ÷ c: divide the chain value exactly.
          const cv = evaluate(nums.slice(i - 1, i + 1), [ops[i - 1]]).value;
          const divs = divisorsInRange(cv, lo, hi);
          if (!divs.length) return null;
          nums.push(pick(rng, divs));
        }
      } else {
        nums.push(randInt(rng, lo, hi));
      }
    }
    return nums;
  }

  function genMixed(pool, d, rng) {
    for (let attempt = 0; attempt < 600; attempt++) {
      const ops = chooseMixedOps(pool, rng);
      const nums = tryBuildMixed(ops, d, rng);
      if (nums && isEducational(nums, ops)) return { nums, ops };
    }
    // Deterministic safe fallback (always valid): a + b - c with a >= c.
    const [lo, hi] = RANGE[d];
    const a = randInt(rng, lo, hi);
    const c = randInt(rng, lo, a);
    return { nums: [a, randInt(rng, lo, hi), c], ops: ['+', '-'] };
  }

  // ---------- Public question API ----------
  let qSerial = 0;
  function questionKey(nums, ops) {
    let s = String(nums[0]);
    ops.forEach((op, i) => (s += op + nums[i + 1]));
    return s;
  }

  /**
   * Generate a question for a level definition.
   * state: { serial, lastKey } (mutated) to rotate operators and avoid repeats.
   */
  function generate(level, state, rng) {
    rng = rng || Math.random;
    state = state || {};
    state.serial = state.serial || 0;
    let q;
    for (let attempt = 0; attempt < 30; attempt++) {
      let built;
      if (level.mode === 'single') built = genSingle(level.ops[0], level.d, rng);
      else if (level.mode === 'rotate') built = genSingle(level.ops[state.serial % 2], level.d, rng);
      else if (level.mode === 'weighted')
        built = genSingle(weightedPick(rng, [['+', 0.33], ['-', 0.33], ['*', 0.17], ['/', 0.17]]), level.d, rng);
      else built = genMixed(level.ops, level.d, rng);
      const key = questionKey(built.nums, built.ops);
      if (key !== state.lastKey || attempt === 29) {
        const ev = evaluate(built.nums, built.ops);
        q = {
          id: 'q' + ++qSerial,
          nums: built.nums,
          ops: built.ops,
          answer: ev.value,
          order: ev.order,
          key,
        };
        break;
      }
    }
    state.lastKey = q.key;
    state.serial++;
    return q;
  }

  /** Stage 1 check: any operator assignment producing the shown result is correct. */
  function checkOperators(nums, placedOps, target) {
    if (placedOps.some((op) => !op)) return false;
    const r = evaluate(nums, placedOps);
    return r.value !== null && r.exact && r.value === target;
  }

  return {
    SYMBOL,
    OP_NAME,
    RANGE,
    STAGE1_LEVELS,
    STAGE2_LEVELS,
    makeRng,
    randInt,
    pick,
    weightedPick,
    shuffle,
    evaluate,
    isEducational,
    genSingle,
    genMixed,
    generate,
    checkOperators,
    questionKey,
  };
});
