'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../../js/math/generator.js');
const Stories = require('../../js/math/stories.js');
const { LevelSession } = require('../../js/math/progress.js');

test('evaluate uses normal precedence and reports order', () => {
  assert.equal(G.evaluate([2, 3, 4], ['+', '*']).value, 14);
  assert.deepEqual(G.evaluate([2, 3, 4], ['+', '*']).order, [1, 0]);
  assert.equal(G.evaluate([20, 8, 2], ['-', '/']).value, 16);
  assert.equal(G.evaluate([12, 4, 3], ['/', '*']).value, 9); // left to right
  assert.equal(G.evaluate([10, 4, 3], ['-', '+']).value, 9); // left to right
  assert.equal(G.evaluate([10, 4, 3], ['+', '-']).value, 11);
  assert.equal(G.evaluate([7, 2], ['/']).exact, false);
  assert.equal(G.evaluate([7, 0], ['/']).value, null);
  assert.deepEqual(G.evaluate([5, 6, 2], ['*', '-']).order, [0, 1]);
});

test('level counts: stage1 16, stage2 30, stage3 30', () => {
  assert.equal(G.STAGE1_LEVELS.length, 16);
  assert.equal(G.STAGE2_LEVELS.length, 30);
  assert.equal(Stories.LEVELS.length, 30);
});

test('stage 1 level order matches the curriculum', () => {
  const sig = G.STAGE1_LEVELS.map((l) => `${l.mode}:${l.ops.join('')}:${l.d}`);
  assert.deepEqual(sig, [
    'single:+:1', 'single:-:1', 'single:+:2', 'single:-:2', 'single:+:3', 'single:-:3',
    'single:*:1', 'single:/:1', 'single:*:2', 'single:/:2',
    'mixed:+-:1', 'mixed:+-:2', 'mixed:+*:1', 'mixed:+-*:1', 'mixed:+-*/:1', 'mixed:+*-:2',
  ]);
});

test('stage 2 structure: 18 introductory + 12 mixed levels', () => {
  const modes = G.STAGE2_LEVELS.map((l) => l.mode + ':' + l.ops.join('') + ':' + l.d);
  for (const [i, d] of [[0, 1], [6, 2], [12, 3]]) {
    assert.deepEqual(modes.slice(i, i + 6), [
      `single:+:${d}`, `single:-:${d}`, `rotate:+-:${d}`, `weighted:+-*/:${d}`, `single:*:${d}`, `single:/:${d}`,
    ]);
  }
  for (const [i, d] of [[18, 1], [22, 2], [26, 3]]) {
    assert.deepEqual(modes.slice(i, i + 4), [`mixed:+-:${d}`, `mixed:+*:${d}`, `mixed:-/:${d}`, `mixed:+-*/:${d}`]);
  }
});

function digits(n) {
  return String(n).length;
}

test('all generated questions are exact, non-negative integers with the right shape', () => {
  const rng = G.makeRng(1234);
  for (const levels of [G.STAGE1_LEVELS, G.STAGE2_LEVELS]) {
    levels.forEach((lv) => {
      const state = {};
      for (let k = 0; k < 150; k++) {
        const q = G.generate(lv, state, rng);
        const ev = G.evaluate(q.nums, q.ops);
        assert.ok(ev.exact, `exact ${q.key}`);
        assert.ok(ev.nonNegative, `nonneg ${q.key}`);
        assert.ok(Number.isInteger(q.answer) && q.answer >= 0, `answer ${q.key}`);
        assert.equal(q.answer, ev.value);
        if (lv.mode === 'mixed') {
          assert.equal(q.ops.length, 2, 'mixed uses exactly two operators');
          assert.equal(q.nums.length, 3, 'three operands');
          q.ops.forEach((op) => assert.ok(lv.ops.includes(op), 'operator from pool'));
        } else assert.equal(q.ops.length, 1);
        q.nums.forEach((n) => assert.equal(digits(n), lv.d, `operand digits ${q.key} in ${lv.name}`));
      }
    });
  }
});

test('mixed levels vary operator positions (× ÷ after + − too)', () => {
  const rng = G.makeRng(99);
  const lv = G.STAGE2_LEVELS[18 + 1]; // 1-digit add/mul
  const seen = new Set();
  const state = {};
  for (let i = 0; i < 200; i++) seen.add(G.generate(lv, state, rng).ops.join(''));
  assert.ok(seen.has('+*') && seen.has('*+'), [...seen].join(','));
  const lv2 = G.STAGE2_LEVELS[18 + 2]; // sub/div
  const seen2 = new Set();
  for (let i = 0; i < 300; i++) seen2.add(G.generate(lv2, state, rng).ops.join(''));
  assert.ok(seen2.has('-/') && seen2.has('/-'), [...seen2].join(','));
  const lv3 = G.STAGE2_LEVELS[18]; // add/sub
  const seen3 = new Set();
  for (let i = 0; i < 200; i++) seen3.add(G.generate(lv3, state, rng).ops.join(''));
  assert.ok(seen3.has('+-') && seen3.has('-+'), [...seen3].join(','));
});

test('rotation level alternates + and −', () => {
  const lv = G.STAGE2_LEVELS[2];
  const st = {};
  const ops = [];
  for (let i = 0; i < 6; i++) ops.push(G.generate(lv, st).ops[0]);
  assert.deepEqual(ops, ['+', '-', '+', '-', '+', '-']);
});

test('weighted level mixes all four single operations', () => {
  const lv = G.STAGE2_LEVELS[3];
  const st = {};
  const rng = G.makeRng(5);
  const c = { '+': 0, '-': 0, '*': 0, '/': 0 };
  for (let i = 0; i < 600; i++) c[G.generate(lv, st, rng).ops[0]]++;
  assert.ok(c['+'] > c['*'] && c['-'] > c['/'], JSON.stringify(c));
  Object.values(c).forEach((v) => assert.ok(v > 40));
});

test('no immediate repeats', () => {
  const rng = G.makeRng(7);
  [G.STAGE1_LEVELS[7], G.STAGE2_LEVELS[5], G.STAGE2_LEVELS[0]].forEach((lv) => {
    const st = {};
    let prev = null;
    for (let i = 0; i < 200; i++) {
      const q = G.generate(lv, st, rng);
      assert.notEqual(q.key, prev);
      prev = q.key;
    }
  });
});

test('stage 1 check accepts any correct operator assignment only', () => {
  assert.equal(G.checkOperators([10, 8], ['-'], 2), true);
  assert.equal(G.checkOperators([10, 8], ['+'], 2), false);
  assert.equal(G.checkOperators([2, 2], ['*'], 4), true);
  assert.equal(G.checkOperators([2, 2], ['+'], 4), true);
  assert.equal(G.checkOperators([3, 4, 2], ['+', '*'], 11), true);
  assert.equal(G.checkOperators([3, 4, 2], ['*', '+'], 11), false);
  assert.equal(G.checkOperators([3, 4, 2], [null, '+'], 9), false);
  assert.equal(G.checkOperators([7, 2], ['/'], 3), false); // inexact
});

test('stage 3: every level has >= 2 templates producing valid answers with units', () => {
  const rng = G.makeRng(42);
  Stories.LEVELS.forEach((lv, i) => {
    assert.ok(lv.templates.length >= 2, `level ${i + 1}`);
    lv.templates.forEach((t, ti) => {
      for (let k = 0; k < 120; k++) {
        const q = t(rng);
        assert.ok(Number.isInteger(q.answer) && q.answer >= 0, `L${i + 1}T${ti} answer ${q.answer}: ${q.text}`);
        assert.ok(q.unit && q.text && q.icon);
        assert.ok(!/[=×÷]/.test(q.text), 'no formula in text');
        assert.ok(!/\d\s*[+\-*/]\s*\d/.test(q.text), 'no inline arithmetic');
        assert.ok(!/NaN|undefined/.test(q.text));
      }
    });
  });
});

test('stage 3 sharing story states the total number of people', () => {
  const rng = G.makeRng(3);
  for (let k = 0; k < 50; k++) {
    const q = Stories.LEVELS[18].templates[0](rng);
    const m = /나와 친구 (\d+)명/.exec(q.text);
    const all = /모두 (\d+)명이에요/.exec(q.text);
    assert.ok(m && all);
    assert.equal(Number(all[1]), Number(m[1]) + 1);
  }
});

test('stage 3 first half add/sub, second half introduces mul/div', () => {
  const rng = G.makeRng(11);
  // Verify by checking that answers in the second half need × or ÷:
  // the sharing level answer times people equals the total in its text.
  const q = Stories.LEVELS[16].templates[0](rng); // notebooks
  const [p, n] = q.text.match(/\d+/g).map(Number);
  assert.equal(q.answer, p * n);
  const q2 = Stories.LEVELS[0].templates[0](rng);
  const [a, b] = q2.text.match(/\d+/g).map(Number);
  assert.equal(q2.answer, a + b);
});

test('level session: 3 distinct correct confirmations clear the level', () => {
  const s = new LevelSession();
  assert.equal(s.confirm('a', false).counted, false);
  assert.equal(s.correct, 0);
  s.skip();
  assert.equal(s.correct, 0);
  assert.equal(s.confirm('a', true).counted, true);
  assert.equal(s.confirm('a', true).counted, false, 'same question counted once');
  assert.equal(s.correct, 1);
  s.confirm('b', true);
  assert.equal(s.cleared, false);
  const r = s.confirm('c', true);
  assert.equal(r.cleared, true);
  assert.equal(s.correct, 3);
  assert.equal(s.confirm('d', true).counted, false);
});
