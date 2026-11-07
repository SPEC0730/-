/*
 * End-to-end checks in a real browser (Playwright + Chromium).
 * Usage: start a static server on :8080 (npm start), then `npm run test:e2e`.
 * Optional: SHOTS=<dir> to save screenshots.
 */
'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const URL = process.env.URL || 'http://localhost:8080/index.html';
const SHOTS = process.env.SHOTS || '';
let passed = 0;
const results = [];

async function step(name, fn) {
  try {
    await fn();
    passed++;
    results.push('✔ ' + name);
  } catch (e) {
    results.push('✘ ' + name + '\n    ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n    '));
    process.exitCode = 1;
  }
}

async function center(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  assert.ok(b, 'no box for ' + sel);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
}
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
  await page.mouse.up();
  await page.waitForTimeout(120);
}
const OPNAME = { '+': 'op-add', '-': 'op-sub', '*': 'op-mul', '/': 'op-div' };

async function solveStage1ByDrag(page) {
  const q = await page.evaluate(() => DME.app.play.question);
  for (let i = 0; i < q.ops.length; i++) {
    const tokSel = `.op-tray .op-token.${OPNAME[q.ops[i]]}`;
    const from = await center(page, tokSel);
    const to = await center(page, `.op-slot[data-slot="${i}"]`);
    await drag(page, from, to);
  }
  await page.click('.btn-equals');
}
async function pressKeys(page, scope, keys) {
  for (const k of keys) await page.click(`${scope} .calc-key[data-key="${k}"]`);
}
async function typeAnswerAndPlace(page, value) {
  await pressKeys(page, '#screen-play', [...String(value), '=']);
  await page.waitForTimeout(350);
  const id = await page.evaluate(() => DME.app.play.ws.conveyor[0]);
  const from = await center(page, `.num-token[data-id="${id}"]`);
  const to = await center(page, '.answer-slot');
  await drag(page, from, to);
  return id;
}
async function waitNextQuestion(page, prevId) {
  await page.waitForFunction((p) => DME.app.play.question && DME.app.play.question.id !== p && !DME.app.play.locked, prevId, { timeout: 5000 });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(m.text()));
  await page.goto(URL);
  await page.waitForTimeout(800);

  await step('cover: Korean logo, centered start button', async () => {
    const t = await page.textContent('#btn-start');
    assert.equal(t.trim(), '시작하기');
    const b = (await center(page, '#btn-start')).b;
    const vp = page.viewportSize();
    assert.ok(Math.abs(b.x + b.width / 2 - vp.width / 2) < 3);
    assert.ok(Math.abs(b.y + b.height / 2 - vp.height / 2) < 3);
  });

  await step('audio unlocks on first interaction and plays the theme', async () => {
    await page.click('#btn-start', { force: true });
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => ({ running: DME.audio.running, track: DME.audio.seq && DME.audio.seq.name, desired: DME.audio.desired }));
    assert.equal(st.running, true);
    assert.equal(st.desired, 'theme');
    assert.equal(st.track, 'theme');
  });

  await step('stage cards: 3 cards, two-line Korean headings, nav buttons', async () => {
    const heads = await page.$$eval('.stage-card', (cs) => cs.map((c) => [c.querySelector('.card-num').textContent, c.querySelector('.card-name').textContent]));
    assert.deepEqual(heads, [['1스테이지', '울창한 숲'], ['2스테이지', '바위 협곡'], ['3스테이지', '용암 화산']]);
    await page.click('.carousel-nav.next');
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => DME.app.cardIndex()), 1);
  });

  await step('map: 16 level buttons, guardian walking, stage music continues into play', async () => {
    await page.click('.stage-card[data-stage="1"]');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.level-btn').count(), 16);
    assert.ok(await page.locator('.map-guardian.walk svg').count());
    const seq1 = await page.evaluate(() => DME.audio.seq && DME.audio.seq.name);
    assert.equal(seq1, 'forest');
    await page.evaluate(() => (window.__seqRef = DME.audio.seq));
    await page.click('.level-btn[data-level="0"]');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => DME.audio.seq === window.__seqRef), true, 'same sequencer object = continuous');
  });

  await step('stage 1: drag places token, source empties, no duplicates; can move again', async () => {
    await page.evaluate(() => DME.app.startLevel(1, 10)); // mixed: two slots
    await page.waitForTimeout(200);
    const from = await center(page, '.op-tray .op-token.op-add');
    const s0 = await center(page, '.op-slot[data-slot="0"]');
    await drag(page, from, s0);
    let st = await page.evaluate(() => ({ placed: DME.app.play.board.placedOps(), inSlot: document.querySelectorAll('.op-slot .op-token').length, total: document.querySelectorAll('.op-token').length, emptyCells: document.querySelectorAll('.tray-cell.empty').length, inv: DME.app.play.board.checkInvariant() }));
    assert.deepEqual(st.placed, ['+', null]);
    assert.equal(st.inSlot, 1);
    assert.equal(st.total, 8);
    assert.equal(st.emptyCells, 1);
    // move the placed token to the other slot
    const placed = await center(page, '.op-slot[data-slot="0"] .op-token');
    const s1 = await center(page, '.op-slot[data-slot="1"]');
    await drag(page, placed, s1);
    st = await page.evaluate(() => ({ placed: DME.app.play.board.placedOps(), inSlot: document.querySelectorAll('.op-slot .op-token').length, inv: DME.app.play.board.checkInvariant() }));
    assert.deepEqual(st.placed, [null, '+']);
    assert.equal(st.inSlot, 1);
    assert.ok(st.inv);
    // replace: drop a − onto slot 1, the + goes home
    await drag(page, await center(page, '.op-tray .op-token.op-sub'), s1);
    st = await page.evaluate(() => ({ placed: DME.app.play.board.placedOps(), inSlot: document.querySelectorAll('.op-slot .op-token').length, emptyCells: document.querySelectorAll('.tray-cell.empty').length }));
    assert.deepEqual(st.placed, [null, '-']);
    assert.equal(st.inSlot, 1);
    assert.equal(st.emptyCells, 1);
    // drag out of the slot onto empty space returns it to the tray
    await drag(page, await center(page, '.op-slot[data-slot="1"] .op-token'), { x: 60, y: 400 });
    assert.deepEqual(await page.evaluate(() => DME.app.play.board.placedOps()), [null, null]);
  });

  await step('stage 1: tap alternative (tap token, then tap slot)', async () => {
    await page.click('.op-tray .op-token.op-mul');
    assert.equal(await page.locator('.op-token.selected').count(), 1);
    await page.click('.op-slot[data-slot="0"]');
    assert.deepEqual(await page.evaluate(() => DME.app.play.board.placedOps()), ['*', null]);
    assert.equal(await page.locator('.op-token.selected').count(), 0);
  });

  await step('stage 1: hint ghost at ~30% opacity, hidden when hints off', async () => {
    const op = await page.$eval('.op-slot[data-slot="1"] .slot-ghost', (e) => getComputedStyle(e).opacity);
    assert.equal(Number(op), 0.3);
    await page.evaluate(() => DME.app.toggleSetting('hints'));
    assert.equal(await page.$eval('.op-slot[data-slot="1"] .slot-ghost', (e) => getComputedStyle(e).display), 'none');
    await page.evaluate(() => DME.app.toggleSetting('hints'));
  });

  await step('stage 1: wrong answer = 삐빅 + red flash, no count; 3 correct clears and persists', async () => {
    await page.evaluate(() => DME.app.startLevel(1, 0));
    await page.waitForTimeout(150);
    // wrong: put − into "a + b" question
    await drag(page, await center(page, '.op-tray .op-token.op-sub'), await center(page, '.op-slot[data-slot="0"]'));
    const q = await page.evaluate(() => DME.app.play.question);
    const wrongIsActuallyRight = q.nums[0] - q.nums[1] === q.answer;
    if (!wrongIsActuallyRight) {
      await page.click('.btn-equals');
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => DME.app.play.session.correct), 0);
      assert.ok(await page.$eval('#wrong-flash', (e) => e.classList.contains('go')));
    }
    // skip does not count
    await page.evaluate(() => DME.app.play.skip());
    assert.equal(await page.evaluate(() => DME.app.play.session.correct), 0);
    for (let i = 0; i < 3; i++) {
      const id = await page.evaluate(() => DME.app.play.question.id);
      await solveStage1ByDrag(page);
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => DME.app.play.session.correct), i + 1);
      assert.equal(await page.locator('#celebrate:not([hidden]) .celebrate-dino svg').count(), 1, 'guardian celebration');
      // pressing = again on the same solved question cannot count twice
      await page.click('.btn-equals', { force: true });
      assert.equal(await page.evaluate(() => DME.app.play.session.correct), i + 1);
      if (i < 2) await waitNextQuestion(page, id);
    }
    await page.waitForSelector('#clear-modal:not([hidden])', { timeout: 4000 });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dinoMathExplorer.v2')).progress[1]);
    assert.deepEqual(saved, [0]);
  });

  await step('stage 2: "=" once makes one token; repeats do nothing; AC flash until AC', async () => {
    await page.evaluate(() => DME.app.startLevel(2, 0));
    await page.waitForTimeout(150);
    await pressKeys(page, '#screen-play', ['7', '+', '8', '=', '=', '=']);
    const st = await page.evaluate(() => ({ n: DME.app.play.ws.tokens.size, res: document.querySelector('#screen-play .calc-result').textContent.trim(), flash: document.querySelector('#screen-play .k-ac').classList.contains('flash') }));
    assert.equal(st.n, 1);
    assert.equal(st.res, '15');
    assert.equal(st.flash, true);
    await page.click('#screen-play .calc-key[data-key="AC"]');
    assert.equal(await page.$eval('#screen-play .k-ac', (e) => e.classList.contains('flash')), false);
    assert.equal(await page.$eval('#screen-play .calc-expr', (e) => e.textContent.trim()), '');
  });

  await step('stage 2: conveyor shifts, snap into answer, replacement without duplicates, zero tokens', async () => {
    await pressKeys(page, '#screen-play', ['5', '-', '5', '=', 'AC', '9', '=', 'AC']);
    await page.waitForTimeout(450); // let the conveyor finish sliding
    let st = await page.evaluate(() => ({ conv: DME.app.play.ws.conveyor.map((id) => DME.app.play.ws.get(id).value) }));
    assert.deepEqual(st.conv.slice(0, 3), [9, 0, 15]);
    const zeroId = await page.evaluate(() => DME.app.play.ws.conveyor[1]);
    await drag(page, await center(page, `.num-token[data-id="${zeroId}"]`), await center(page, '.answer-slot'));
    assert.equal(await page.evaluate(() => DME.app.play.ws.slotValue('answer')), 0, 'zero token usable');
    const nineId = await page.evaluate(() => DME.app.play.ws.conveyor[0]);
    await drag(page, await center(page, `.num-token[data-id="${nineId}"]`), await center(page, '.answer-slot'));
    st = await page.evaluate(() => ({ ans: DME.app.play.ws.slotValue('answer'), inv: DME.app.play.ws.checkInvariant(), dom: document.querySelectorAll('.num-token').length, model: DME.app.play.ws.tokens.size }));
    assert.equal(st.ans, 9);
    assert.ok(st.inv);
    assert.equal(st.dom, st.model, 'DOM tokens == model tokens');
    assert.equal(await page.evaluate((z) => DME.app.play.ws.get(z).loc, zeroId), 'free');
    // drag out of answer to remove it from the slot
    await drag(page, await center(page, '.num-token.in-answer'), { x: 600, y: 470 });
    assert.equal(await page.evaluate(() => DME.app.play.ws.slotValue('answer')), null);
  });

  await step('baby dinosaur: opens mouth on pickup; only the mouth deletes', async () => {
    const id = await page.evaluate(() => [...DME.app.play.ws.tokens.keys()][0]);
    const tok = await center(page, `.num-token[data-id="${id}"]`);
    // drop on nest (bottom of the illustration) -> not deleted
    const nest = await center(page, '.baby-nest');
    const nestPoint = { x: nest.x, y: nest.b.y + nest.b.height * 0.92 };
    await page.mouse.move(tok.x, tok.y);
    await page.mouse.down();
    await page.mouse.move(tok.x + 20, tok.y + 20);
    assert.ok(await page.$eval('.baby-nest', (e) => e.classList.contains('open')), 'mouth opens when token is picked up');
    await page.mouse.move(nestPoint.x, nestPoint.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(120);
    assert.ok(await page.evaluate((i) => !!DME.app.play.ws.get(i), id), 'nest drop must not delete');
    // body (belly) -> not deleted
    const body = await page.$eval('.baby-svg ellipse[cx="100"][cy="132"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await drag(page, await center(page, `.num-token[data-id="${id}"]`), body);
    assert.ok(await page.evaluate((i) => !!DME.app.play.ws.get(i), id), 'body drop must not delete');
    // empty area beside the baby -> not deleted
    await drag(page, await center(page, `.num-token[data-id="${id}"]`), { x: nest.b.x - 40, y: nest.y });
    assert.ok(await page.evaluate((i) => !!DME.app.play.ws.get(i), id), 'empty area must not delete');
    // mouth -> deleted + chewing
    const mouth = await center(page, '#mouth-zone');
    await drag(page, await center(page, `.num-token[data-id="${id}"]`), mouth);
    assert.equal(await page.evaluate((i) => DME.app.play.ws.get(i), id), null);
    assert.ok(await page.$eval('.baby-nest', (e) => e.classList.contains('chewing')));
    await page.waitForTimeout(450);
    assert.equal(await page.locator(`.num-token[data-id="${id}"]`).count(), 0);
  });

  await step('stage 2 & 3: three correct answers clear; formula not shown in stage 3', async () => {
    await page.evaluate(() => DME.app.startLevel(2, 21)); // mixed with scratch slot
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.scratch-slot').count(), 1);
    assert.ok((await page.textContent('.order-hint')).includes('먼저'));
    for (let i = 0; i < 3; i++) {
      const q = await page.evaluate(() => DME.app.play.question);
      await typeAnswerAndPlace(page, q.answer);
      await page.click('.btn-check');
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => DME.app.play.session.correct), i + 1);
      if (i < 2) await waitNextQuestion(page, q.id);
    }
    await page.waitForSelector('#clear-modal:not([hidden])', { timeout: 4000 });
    await page.evaluate(() => DME.app.startLevel(3, 18));
    await page.waitForTimeout(150);
    const text = await page.textContent('.story-text');
    assert.ok(!/[=×÷+]/.test(text), 'no formula: ' + text);
    assert.ok(/모두 \d+명이에요/.test(text));
    assert.equal(await page.locator('.story-card .answer-slot').count(), 1, 'answer slot inside the story card');
    assert.ok(['개', '조각'].includes((await page.textContent('.answer-unit')).trim()));
    for (let i = 0; i < 3; i++) {
      const q = await page.evaluate(() => DME.app.play.question);
      // wrong first
      await typeAnswerAndPlace(page, q.answer + 1);
      await page.click('.btn-check');
      assert.equal(await page.evaluate(() => DME.app.play.session.correct), i);
      await page.click('#screen-play .calc-key[data-key="AC"]');
      await typeAnswerAndPlace(page, q.answer);
      await page.click('.btn-check');
      assert.equal(await page.evaluate(() => DME.app.play.session.correct), i + 1);
      if (i < 2) await waitNextQuestion(page, q.id);
    }
    await page.waitForSelector('#clear-modal:not([hidden])', { timeout: 4000 });
  });

  await step('level name is not visible during a question', async () => {
    await page.evaluate(() => DME.app.startLevel(2, 4));
    await page.waitForTimeout(100);
    const body = await page.$eval('#screen-play', (e) => e.innerText);
    assert.ok(!body.includes('한 자리 곱셈'), 'level name leaked');
  });

  await step('explanatory text toggle hides supplementary text everywhere', async () => {
    await page.evaluate(() => DME.app.toggleSetting('desc'));
    assert.equal(await page.$eval('#screen-play .instruction', (e) => getComputedStyle(e).display), 'none');
    await page.evaluate(() => DME.app.show('cover'));
    assert.equal(await page.$eval('.cover-desc', (e) => getComputedStyle(e).display), 'none');
    await page.evaluate(() => DME.app.showStages());
    assert.equal(await page.$eval('.card-progress', (e) => getComputedStyle(e).display), 'none');
    await page.evaluate(() => DME.app.toggleSetting('desc'));
    assert.notEqual(await page.$eval('.card-progress', (e) => getComputedStyle(e).display), 'none');
  });

  await step('menu: reset progress with confirmation; persists after reload; settings kept', async () => {
    await page.evaluate(() => DME.app.toggleSetting('hints')); // hints off
    await page.click('#menu-btn');
    await page.click('#menu [data-act="reset"]');
    assert.ok(await page.isVisible('#confirm-reset'));
    await page.click('#confirm-reset [data-act="cancel"]');
    assert.ok(await page.evaluate(() => DME.app.store.clearedCount(1) > 0), 'cancel keeps records');
    await page.click('#menu [data-act="reset"]');
    await page.click('#confirm-reset [data-act="confirm"]');
    assert.equal(await page.evaluate(() => DME.app.screen), 'stages');
    // simulate stale legacy data, then refresh
    await page.evaluate(() => localStorage.setItem('dinoMathExplorer', JSON.stringify({ cleared: { '1-1': true, '2-22': true } })));
    await page.reload();
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => ({ c: [1, 2, 3].map((s) => DME.app.store.clearedCount(s)), hints: DME.app.store.settings.hints }));
    assert.deepEqual(st.c, [0, 0, 0]);
    assert.equal(st.hints, false);
    await page.evaluate(() => DME.app.toggleSetting('hints'));
  });

  await step('menu: skip, level picker, current map', async () => {
    await page.click('#btn-start', { force: true });
    await page.click('#menu-btn');
    assert.ok(await page.isDisabled('#menu [data-act="skip"]'), 'skip disabled outside questions');
    await page.click('#menu [data-act="picker"]');
    await page.click('.p-tab[data-stage="3"]');
    assert.equal(await page.locator('.p-level').count(), 30);
    await page.click('.p-level[data-level="29"]');
    assert.deepEqual(await page.evaluate(() => [DME.app.screen, DME.app.play.stage, DME.app.play.level]), ['play', 3, 29]);
    const before = await page.evaluate(() => DME.app.play.question.id);
    await page.click('#menu-btn');
    await page.click('#menu [data-act="skip"]');
    assert.notEqual(await page.evaluate(() => DME.app.play.question.id), before);
    assert.equal(await page.evaluate(() => DME.app.play.session.correct), 0);
    await page.click('#menu-btn');
    await page.click('#menu [data-act="map"]');
    assert.equal(await page.evaluate(() => DME.app.screen), 'map');
    assert.equal(await page.evaluate(() => DME.audio.desired), 'volcano');
  });

  await step('standalone calculator: computed 2243003 does NOT trigger the secret', async () => {
    await page.click('#menu-btn');
    await page.click('#menu [data-act="calc"]');
    await pressKeys(page, '#screen-calc', ['2', '2', '4', '3', '0', '0', '2', '+', '1', '=']);
    assert.equal((await page.textContent('#screen-calc .calc-result')).trim(), '2243003');
    await page.waitForTimeout(900);
    assert.equal(await page.evaluate(() => DME.app.screen), 'calc');
    await page.click('#screen-calc .calc-key[data-key="AC"]');
    // repeated equals cannot grow the result
    await pressKeys(page, '#screen-calc', ['2', '*', '3', '=', '=', '=']);
    assert.equal((await page.textContent('#screen-calc .calc-result')).trim(), '6');
    assert.ok(await page.$eval('#screen-calc .k-ac', (e) => e.classList.contains('flash')));
    await page.click('#screen-calc .calc-key[data-key="AC"]');
    assert.ok(!(await page.$eval('#screen-calc .k-ac', (e) => e.classList.contains('flash'))));
  });

  await step('secret: typing 2243003 then "=" breaks the calculator and opens the runner', async () => {
    await page.keyboard.type('2243003');
    await page.keyboard.press('=');
    await page.waitForTimeout(250);
    assert.ok(await page.$eval('#standalone-calc', (e) => e.classList.contains('cracking')));
    await page.waitForTimeout(800);
    assert.ok((await page.locator('#shards .shard').count()) > 10, 'shards scatter');
    await page.waitForFunction(() => DME.app.screen === 'runner', null, { timeout: 3000 });
    assert.equal((await page.textContent('.runner-title')).trim(), '스피노의 대탈출');
    assert.equal(await page.evaluate(() => DME.audio.desired), 'runner');
  });

  await step('runner: jump with Space (no double jump), menu pauses, focus restored', async () => {
    await page.keyboard.press('Space'); // start + jump
    await page.waitForTimeout(120);
    const s1 = await page.evaluate(() => ({ state: DME.app.runner.sim.state, y: DME.app.runner.sim.y, jumps: DME.app.runner.sim.jumps }));
    assert.equal(s1.state, 'running');
    assert.ok(s1.y > 0);
    await page.keyboard.press('ArrowUp'); // in the air: must not jump again
    assert.equal(await page.evaluate(() => DME.app.runner.sim.jumps), 1);
    await page.click('#menu-btn');
    const t0 = await page.evaluate(() => DME.app.runner.sim.t);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => DME.app.runner.sim.t), t0, 'paused while menu open');
    await page.click('#menu [data-act="continue"]');
    await page.waitForTimeout(300);
    const t1 = await page.evaluate(() => DME.app.runner.sim.t);
    assert.ok(t1 > t0 && t1 - t0 < 0.45, 'resumed without a time jump: ' + (t1 - t0));
    assert.ok(await page.evaluate(() => document.activeElement.classList.contains('runner-canvas')), 'canvas focus restored');
  });

  await step('runner: music rate follows speed; game over shows buttons; return restores calculator', async () => {
    await page.evaluate(() => {
      const r = DME.app.runner;
      r.sim.t = 30; // jump ahead in difficulty (speed 640)
    });
    await page.waitForTimeout(400);
    const rate = await page.evaluate(() => DME.audio.rate);
    const max = await page.evaluate(() => DME.Audio.MAX_RATE);
    assert.ok(rate > 2 && rate <= max, 'rate ' + rate);
    // force a collision
    await page.evaluate(() => {
      const r = DME.app.runner;
      r.sim.y = 0; r.sim.vy = 0; r.sim.grounded = true;
      r.sim.obstacles = DME.RunnerLogic.makeGroup(1, DME.RunnerLogic.CFG.playerX + 5, Math.random, { forceTypes: ['skull'] });
    });
    await page.waitForSelector('.runner-panel.over:not([hidden])', { timeout: 3000 });
    assert.equal(await page.evaluate(() => DME.audio.rate), 1);
    await page.click('[data-act="retry"]');
    assert.equal(await page.evaluate(() => DME.app.runner.sim.state), 'running');
    await page.evaluate(() => {
      const r = DME.app.runner;
      r.sim.obstacles = DME.RunnerLogic.makeGroup(1, DME.RunnerLogic.CFG.playerX + 5, Math.random, { forceTypes: ['brachio'] });
    });
    await page.waitForSelector('.runner-panel.over:not([hidden])', { timeout: 3000 });
    await page.click('[data-act="exit"]');
    const st = await page.evaluate(() => ({ screen: DME.app.screen, runner: DME.app.runner, desired: DME.audio.desired, rate: DME.audio.rate, expr: document.querySelector('#screen-calc .calc-expr').textContent.trim() }));
    assert.equal(st.screen, 'calc');
    assert.equal(st.runner, null, 'runner loop destroyed');
    assert.equal(st.desired, 'theme');
    assert.equal(st.rate, 1);
    assert.equal(st.expr, '');
    await pressKeys(page, '#screen-calc', ['4', '+', '4', '=']);
    assert.equal((await page.textContent('#screen-calc .calc-result')).trim(), '8');
  });

  await step('no runtime errors', async () => {
    assert.deepEqual(errors, []);
  });

  // ---------- layouts on several tablet sizes ----------
  const sizes = [[820, 1180], [1180, 820], [768, 1024], [1024, 768], [744, 1133], [1133, 744], [1024, 1366], [1366, 1024], [800, 1280], [1280, 800]];
  for (const [w, h] of sizes) {
    await step(`layout ${w}x${h}: cover parts do not overlap; play screens fit`, async () => {
      const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
      await p.goto(URL);
      await p.waitForTimeout(1600);
      const boxes = await p.evaluate(() => {
        const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
        const logo = (() => { const a = document.querySelector('.logo-line1').getBoundingClientRect(), b = document.querySelector('.logo-line2').getBoundingClientRect(); return { l: Math.min(a.left, b.left), t: a.top, r: Math.max(a.right, b.right), b: b.bottom + b.height * 0.12 }; })();
        const dinos = [...document.querySelectorAll('.cover-dino svg g.bob')].map((g) => { const b = g.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; });
        return { logo, btn: r('#btn-start'), dinos, vw: innerWidth, vh: innerHeight };
      });
      const ov = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
      assert.ok(!ov(boxes.logo, boxes.btn), 'logo/button');
      boxes.dinos.forEach((d) => {
        assert.ok(!ov(d, boxes.btn), 'dino/button');
        assert.ok(!ov(d, boxes.logo), 'dino/logo');
      });
      assert.ok(boxes.logo.l >= 0 && boxes.logo.r <= boxes.vw, 'logo inside viewport');
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/cover-${w}x${h}.png` });
      for (const [stage, level] of [[1, 15], [2, 29], [3, 28]]) {
        await p.evaluate(([s, l]) => DME.app.startLevel(s, l), [stage, level]);
        await p.waitForTimeout(300);
        const fit = await p.evaluate(() => {
          const out = [];
          const vw = innerWidth, vh = innerHeight;
          document.querySelectorAll('#screen-play button, #screen-play .op-slot, #screen-play .answer-slot, #screen-play .equation, #screen-play .story-card').forEach((e) => {
            const b = e.getBoundingClientRect();
            if (b.width && (b.left < -1 || b.right > vw + 1 || b.top < -1 || b.bottom > vh + 1)) out.push(e.className + ' ' + JSON.stringify([b.left, b.top, b.right, b.bottom]));
          });
          const eq = document.querySelector('#screen-play .equation');
          if (eq && eq.scrollWidth > eq.clientWidth + 2) out.push('equation overflow');
          const small = [...document.querySelectorAll('#screen-play .calc-key, #screen-play .op-token, #screen-play .btn-confirm')].filter((e) => { const b = e.getBoundingClientRect(); return b.width < 48 || b.height < 44; }).map((e) => e.className);
          return { out, small };
        });
        assert.deepEqual(fit.out, [], `stage ${stage} elements off-screen`);
        assert.deepEqual(fit.small, [], `stage ${stage} touch targets too small`);
        if (SHOTS) await p.screenshot({ path: `${SHOTS}/play${stage}-${w}x${h}.png` });
      }
      await p.close();
    });
  }

  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n${passed}/${results.length} passed`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
