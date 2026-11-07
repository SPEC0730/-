/*
 * Interaction models (no DOM):
 *  - OperatorBoard: Stage 1 operator tokens in tray homes or equation slots.
 *  - ResultWorkspace: calculator result tokens on a conveyor, free on the
 *    workspace, or inside the answer / scratch slots.
 *  - isPointInMouth: ellipse hit test used for baby-dinosaur deletion.
 * Each model guarantees a token occupies exactly one location.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.DME = root.DME || {}).Boards = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class OperatorBoard {
    /**
     * @param {number} slotCount number of operator slots in the equation
     * @param {string[]} trayOps operator per tray home position
     */
    constructor(slotCount, trayOps) {
      this.slots = new Array(slotCount).fill(null);
      this.tokens = trayOps.map((op, i) => ({ id: 't' + i, op, home: i, slot: null }));
    }
    token(id) {
      const t = this.tokens.find((x) => x.id === id);
      if (!t) throw new Error('unknown token ' + id);
      return t;
    }
    /** Place token into slot; an occupant returns to its own tray home. */
    place(id, slotIdx) {
      if (slotIdx < 0 || slotIdx >= this.slots.length) throw new Error('bad slot');
      const t = this.token(id);
      if (t.slot === slotIdx) return { displaced: null };
      if (t.slot !== null) this.slots[t.slot] = null;
      const occupantId = this.slots[slotIdx];
      let displaced = null;
      if (occupantId) {
        const o = this.token(occupantId);
        o.slot = null;
        displaced = o.id;
      }
      this.slots[slotIdx] = id;
      t.slot = slotIdx;
      return { displaced };
    }
    returnHome(id) {
      const t = this.token(id);
      if (t.slot !== null) this.slots[t.slot] = null;
      t.slot = null;
    }
    placedOps() {
      return this.slots.map((id) => (id ? this.token(id).op : null));
    }
    isComplete() {
      return this.slots.every(Boolean);
    }
    /** True when every token is in exactly one location. */
    checkInvariant() {
      const seen = new Set();
      for (let i = 0; i < this.slots.length; i++) {
        const id = this.slots[i];
        if (!id) continue;
        if (seen.has(id)) return false;
        seen.add(id);
        if (this.token(id).slot !== i) return false;
      }
      for (const t of this.tokens) if (t.slot !== null && this.slots[t.slot] !== t.id) return false;
      return true;
    }
  }

  class ResultWorkspace {
    constructor(opts) {
      opts = opts || {};
      this.capacity = opts.capacity || 4;
      this.tokens = new Map();
      this.conveyor = []; // index 0 = newest, closest to the calculator
      this.slots = { answer: null, scratch: null };
      this.serial = 0;
    }
    /** Add a result token on the conveyor; older tokens shift one position. */
    create(value) {
      const id = 'r' + ++this.serial;
      this.tokens.set(id, { id, value, loc: 'conveyor', x: 0, y: 0 });
      this.conveyor.unshift(id);
      const dropped = [];
      while (this.conveyor.length > this.capacity) {
        const old = this.conveyor.pop();
        this.tokens.delete(old);
        dropped.push(old);
      }
      return { id, dropped };
    }
    get(id) {
      return this.tokens.get(id) || null;
    }
    _detach(id) {
      const t = this.tokens.get(id);
      if (!t) return null;
      const ci = this.conveyor.indexOf(id);
      if (ci >= 0) this.conveyor.splice(ci, 1);
      for (const k of Object.keys(this.slots)) if (this.slots[k] === id) this.slots[k] = null;
      return t;
    }
    moveFree(id, x, y) {
      const t = this._detach(id);
      if (!t) return false;
      t.loc = 'free';
      t.x = x;
      t.y = y;
      return true;
    }
    /** Put a token into a slot. An existing occupant becomes free at (fx, fy). */
    placeInSlot(id, slot, fx, fy) {
      if (!(slot in this.slots)) throw new Error('bad slot ' + slot);
      const t = this._detach(id);
      if (!t) return { displaced: null };
      let displaced = null;
      const occ = this.slots[slot];
      if (occ && occ !== id) {
        const o = this.tokens.get(occ);
        o.loc = 'free';
        o.x = fx || 0;
        o.y = fy || 0;
        displaced = occ;
      }
      this.slots[slot] = id;
      t.loc = slot;
      return { displaced };
    }
    remove(id) {
      const t = this._detach(id);
      if (!t) return false;
      this.tokens.delete(id);
      return true;
    }
    slotValue(slot) {
      const id = this.slots[slot];
      return id ? this.tokens.get(id).value : null;
    }
    checkInvariant() {
      const where = new Map();
      const mark = (id, loc) => {
        if (where.has(id)) return false;
        where.set(id, loc);
        return true;
      };
      for (const id of this.conveyor) if (!mark(id, 'conveyor')) return false;
      for (const k of Object.keys(this.slots)) if (this.slots[k] && !mark(this.slots[k], k)) return false;
      for (const [id, t] of this.tokens) {
        if (t.loc === 'free') {
          if (!mark(id, 'free')) return false;
        } else if (where.get(id) !== t.loc) return false;
      }
      return where.size === this.tokens.size;
    }
  }

  /**
   * Ellipse hit test. rect = {left, top, width, height} of the mouth shape
   * (measured from the rendered illustration so it scales with it).
   * tolerance > 1 enlarges the ellipse slightly to mean "near the mouth".
   */
  function isPointInMouth(x, y, rect, tolerance) {
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    tolerance = tolerance || 1.3;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rx = (rect.width / 2) * tolerance;
    const ry = (rect.height / 2) * tolerance;
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  function nearRect(x, y, rect, margin) {
    margin = margin || 0;
    return x >= rect.left - margin && x <= rect.left + rect.width + margin && y >= rect.top - margin && y <= rect.top + rect.height + margin;
  }

  return { OperatorBoard, ResultWorkspace, isPointInMouth, nearRect };
});
