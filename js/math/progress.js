/*
 * Level session: a level is cleared after THREE distinct correct answers.
 * Wrong answers and skipped questions never count, and the same question id
 * can only be counted once.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.DME = root.DME || {}).Progress = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const REQUIRED_CORRECT = 3;

  class LevelSession {
    constructor(required) {
      this.required = required || REQUIRED_CORRECT;
      this.correct = 0;
      this.solved = new Set();
      this.wrong = 0;
      this.skipped = 0;
    }
    get cleared() {
      return this.correct >= this.required;
    }
    /** Record an explicit confirmation result for question `qid`. */
    confirm(qid, isCorrect) {
      if (this.cleared) return { counted: false, correct: this.correct, cleared: true };
      if (!isCorrect) {
        this.wrong++;
        return { counted: false, correct: this.correct, cleared: false };
      }
      if (this.solved.has(qid)) return { counted: false, correct: this.correct, cleared: this.cleared };
      this.solved.add(qid);
      this.correct++;
      return { counted: true, correct: this.correct, cleared: this.cleared };
    }
    skip() {
      this.skipped++;
      return { counted: false, correct: this.correct, cleared: this.cleared };
    }
  }

  return { LevelSession, REQUIRED_CORRECT };
});
