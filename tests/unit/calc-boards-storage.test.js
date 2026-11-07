'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CalcEngine, SECRET_CODE } = require('../../js/calc/calc-engine.js');
const { OperatorBoard, ResultWorkspace, isPointInMouth } = require('../../js/ui/boards.js');
const { Store, STORAGE_KEY, LEGACY_KEYS, memoryStorage } = require('../../js/core/storage.js');

function type(c, s) {
  const evs = [];
  for (const ch of s) evs.push(c.press(ch === 'C' ? 'AC' : ch === 'B' ? 'BS' : ch));
  return evs;
}

test('calculator: precedence and formatting', () => {
  const c = new CalcEngine();
  const ev = type(c, '12+7*3=').pop();
  assert.equal(ev.type, 'result');
  assert.equal(ev.value, 33);
  assert.equal(c.expressionText(), '12 + 7 × 3 =');
  assert.equal(c.resultText(), '33');
  c.press('AC');
  assert.equal(type(c, '7/2=').pop().value, 3.5);
  c.press('AC');
  assert.equal(type(c, '5-9=').pop().value, -4);
  c.press('AC');
  assert.equal(type(c, '0*5=').pop().value, 0);
});

test('calculator: repeated "=" never repeats, changes, or re-emits', () => {
  const c = new CalcEngine();
  const ev = type(c, '5+3=').pop();
  assert.equal(ev.type, 'result');
  assert.equal(ev.value, 8);
  for (let i = 0; i < 5; i++) {
    const r = c.press('=');
    assert.equal(r.type, 'ignored');
    assert.equal(r.reason, 'repeat-equals');
  }
  assert.equal(c.resultText(), '8');
  assert.equal(c.flashAC, true, 'AC flashes after success');
  // further input is locked until AC
  assert.equal(c.press('4').type, 'ignored');
  const cl = c.press('AC');
  assert.equal(cl.type, 'clear');
  assert.equal(cl.wasFlashing, true);
  assert.equal(c.flashAC, false, 'one AC press stops flashing');
  assert.equal(c.expressionText(), '');
});

test('calculator: operator replacement, backspace, incomplete "="', () => {
  const c = new CalcEngine();
  assert.equal(c.press('+').type, 'ignored');
  type(c, '9+-');
  assert.equal(c.expressionText(), '9 −');
  assert.equal(c.press('=').type, 'ignored');
  type(c, '45B');
  assert.equal(c.expressionText(), '9 − 4');
  type(c, 'BB');
  assert.equal(c.expressionText(), '9');
  type(c, '00');
  assert.equal(c.expressionText(), '900');
  c.press('AC');
  type(c, '007');
  assert.equal(c.expressionText(), '7', 'no leading zeros');
});

test('calculator: division by zero is an error, not a result', () => {
  const c = new CalcEngine();
  const ev = type(c, '8/0=').pop();
  assert.equal(ev.type, 'error');
  assert.equal(c.flashAC, false);
  assert.match(c.resultText(), /0으로/);
});

test('secret: only the directly typed number 2243003 triggers', () => {
  const c = new CalcEngine();
  assert.equal(SECRET_CODE, '2243003');
  let ev = type(c, '2243003=').pop();
  assert.equal(ev.secret, true);
  assert.equal(ev.directEntry, true);
  c.press('AC');
  ev = type(c, '2243002+1=').pop();
  assert.equal(ev.value, 2243003);
  assert.equal(ev.secret, false, 'computed result must not trigger');
  c.press('AC');
  ev = type(c, '2243003*1=').pop();
  assert.equal(ev.secret, false);
  c.press('AC');
  ev = type(c, '22430030=').pop();
  assert.equal(ev.secret, false);
  c.press('AC');
  ev = type(c, '224300=').pop();
  assert.equal(ev.secret, false);
});

test('operator board: placing, moving, replacing without duplicates', () => {
  const b = new OperatorBoard(2, ['+', '-', '*', '/', '+', '-', '*', '/']);
  b.place('t0', 0);
  assert.deepEqual(b.placedOps(), ['+', null]);
  assert.equal(b.token('t0').slot, 0);
  // move the same token to slot 1: slot 0 empties
  b.place('t0', 1);
  assert.deepEqual(b.placedOps(), [null, '+']);
  // replace: t1 into slot 1, t0 returns home
  const r = b.place('t1', 1);
  assert.equal(r.displaced, 't0');
  assert.equal(b.token('t0').slot, null);
  assert.deepEqual(b.placedOps(), [null, '-']);
  b.place('t4', 0);
  assert.equal(b.isComplete(), true);
  b.returnHome('t4');
  assert.equal(b.isComplete(), false);
  assert.ok(b.checkInvariant());
  // random stress
  for (let i = 0; i < 2000; i++) {
    const id = 't' + Math.floor(Math.random() * 8);
    if (Math.random() < 0.8) b.place(id, Math.floor(Math.random() * 2));
    else b.returnHome(id);
    assert.ok(b.checkInvariant());
  }
});

test('result workspace: conveyor shift, slot snap, replacement, zero values, deletion', () => {
  const w = new ResultWorkspace({ capacity: 3 });
  const a = w.create(5).id;
  const b = w.create(0).id;
  assert.deepEqual(w.conveyor, [b, a], 'new token at the front, older shift');
  const c = w.create(9).id;
  const { id: d, dropped } = w.create(12);
  assert.deepEqual(w.conveyor, [d, c, b]);
  assert.deepEqual(dropped, [a]);
  assert.equal(w.get(a), null);
  // zero value token works in the answer slot
  w.placeInSlot(b, 'answer', 100, 100);
  assert.equal(w.slotValue('answer'), 0);
  assert.deepEqual(w.conveyor, [d, c]);
  // replacement: c replaces b, b becomes free (not duplicated)
  const r = w.placeInSlot(c, 'answer', 50, 60);
  assert.equal(r.displaced, b);
  assert.equal(w.get(b).loc, 'free');
  assert.equal(w.slotValue('answer'), 9);
  // remove from slot by dragging out
  w.moveFree(c, 10, 10);
  assert.equal(w.slotValue('answer'), null);
  // scratch is independent of answer
  w.placeInSlot(d, 'scratch');
  assert.equal(w.slotValue('scratch'), 12);
  assert.equal(w.slotValue('answer'), null);
  assert.ok(w.checkInvariant());
  assert.equal(w.remove(d), true);
  assert.equal(w.slotValue('scratch'), null);
  assert.ok(w.checkInvariant());
  for (let i = 0; i < 3000; i++) {
    const ids = [...w.tokens.keys()];
    const op = Math.random();
    if (op < 0.25 || !ids.length) w.create(Math.floor(Math.random() * 10));
    else {
      const id = ids[Math.floor(Math.random() * ids.length)];
      if (op < 0.5) w.placeInSlot(id, 'answer', 1, 1);
      else if (op < 0.65) w.placeInSlot(id, 'scratch', 1, 1);
      else if (op < 0.85) w.moveFree(id, 3, 3);
      else w.remove(id);
    }
    assert.ok(w.checkInvariant());
  }
});

test('mouth hit area: only near the mouth ellipse, scales with rect', () => {
  const mouth = { left: 100, top: 100, width: 40, height: 30 };
  assert.ok(isPointInMouth(120, 115, mouth));
  assert.ok(isPointInMouth(145, 115, mouth), 'slightly outside = near');
  assert.ok(!isPointInMouth(120, 160, mouth), 'body below mouth');
  assert.ok(!isPointInMouth(120, 200, mouth), 'nest');
  assert.ok(!isPointInMouth(60, 115, mouth), 'empty area');
  assert.ok(!isPointInMouth(145, 135, mouth), 'corner of bounding box is not the mouth');
  const big = { left: 200, top: 200, width: 80, height: 60 };
  assert.ok(isPointInMouth(285, 230, big));
  assert.ok(!isPointInMouth(120, 115, null));
});

test('storage: progress reset persists and legacy data cannot return', () => {
  const mem = memoryStorage();
  mem.setItem('dinoMathExplorer', JSON.stringify({ cleared: { '1-1': true, '2-3': true }, sound: false }));
  let s = new Store(mem);
  assert.equal(s.isCleared(1, 0), true, 'legacy migrated');
  assert.equal(s.isCleared(2, 2), true);
  assert.equal(s.settings.sfx, false);
  assert.equal(mem.getItem('dinoMathExplorer'), null, 'legacy key removed after migration');
  s.setSetting('hints', false);
  s.setSetting('desc', false);
  s.markCleared(3, 5);
  s.resetProgress();
  assert.equal(s.clearedCount(1) + s.clearedCount(2) + s.clearedCount(3), 0);
  // A stale legacy record re-appearing (e.g. another tab) must not be re-imported.
  mem.setItem('dinoMathExplorer.v1', JSON.stringify({ cleared: { '1-2': true } }));
  s = new Store(mem); // "refresh"
  assert.equal(s.clearedCount(1), 0);
  assert.equal(s.settings.hints, false, 'settings kept');
  assert.equal(s.settings.desc, false);
  assert.equal(s.settings.sfx, false);
  LEGACY_KEYS.forEach((k) => assert.equal(mem.getItem(k), null));
  assert.ok(mem.getItem(STORAGE_KEY));
});

test('storage: survives broken JSON and storage exceptions', () => {
  const mem = memoryStorage();
  mem.setItem(STORAGE_KEY, '{oops');
  const s = new Store(mem);
  assert.equal(s.settings.music, true);
  const throwing = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  const s2 = new Store(throwing);
  s2.markCleared(1, 1);
  assert.equal(s2.isCleared(1, 1), true);
});
