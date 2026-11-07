/*
 * Local persistence for settings and stage completion.
 * Current format lives under STORAGE_KEY. Legacy keys are migrated ONCE and
 * then deleted, so a progress reset can never be undone by re-migration
 * after a refresh.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else (root.DME = root.DME || {}).Storage = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'dinoMathExplorer.v2';
  const LEGACY_KEYS = ['dinoMathExplorer', 'dinoMathExplorer.v1', 'dino-math-progress'];
  const DEFAULT_SETTINGS = { hints: true, desc: true, sfx: true, music: true };

  function memoryStorage() {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }

  function safeParse(s) {
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }

  function emptyProgress() {
    return { 1: [], 2: [], 3: [] };
  }

  function normalizeProgress(p) {
    const out = emptyProgress();
    if (p && typeof p === 'object') {
      for (const s of [1, 2, 3]) {
        const list = Array.isArray(p[s]) ? p[s] : [];
        out[s] = Array.from(new Set(list.filter((n) => Number.isInteger(n) && n >= 0))).sort((a, b) => a - b);
      }
    }
    return out;
  }

  /** Convert a legacy record (v1: { cleared: {"1-3": true}, sound, music }) */
  function fromLegacy(raw) {
    const progress = emptyProgress();
    const settings = Object.assign({}, DEFAULT_SETTINGS);
    if (raw && typeof raw === 'object') {
      const cleared = raw.cleared || raw.progress || {};
      if (Array.isArray(cleared)) {
        cleared.forEach((k) => addKey(k));
      } else {
        Object.keys(cleared).forEach((k) => cleared[k] && addKey(k));
      }
      if (typeof raw.sound === 'boolean') settings.sfx = raw.sound;
      if (typeof raw.music === 'boolean') settings.music = raw.music;
      if (typeof raw.hints === 'boolean') settings.hints = raw.hints;
    }
    function addKey(k) {
      const m = /^(\d)-(\d+)$/.exec(String(k));
      if (m && progress[m[1]]) progress[m[1]].push(Number(m[2]) - 1);
    }
    return { progress: normalizeProgress(progress), settings };
  }

  class Store {
    constructor(storage) {
      this.storage = storage || memoryStorage();
      this.data = this.load();
    }
    _get(k) {
      try {
        return this.storage.getItem(k);
      } catch (e) {
        return null;
      }
    }
    _remove(k) {
      try {
        this.storage.removeItem(k);
      } catch (e) {
        /* ignore */
      }
    }
    purgeLegacy() {
      LEGACY_KEYS.forEach((k) => this._remove(k));
    }
    load() {
      const cur = safeParse(this._get(STORAGE_KEY));
      let data;
      if (cur && cur.version === 2) {
        data = {
          version: 2,
          settings: Object.assign({}, DEFAULT_SETTINGS, cur.settings || {}),
          progress: normalizeProgress(cur.progress),
        };
      } else {
        // First run in this format: migrate the first legacy record found.
        let migrated = null;
        for (const k of LEGACY_KEYS) {
          const raw = safeParse(this._get(k));
          if (raw) {
            migrated = fromLegacy(raw);
            break;
          }
        }
        data = { version: 2, settings: migrated ? migrated.settings : Object.assign({}, DEFAULT_SETTINGS), progress: migrated ? migrated.progress : emptyProgress() };
      }
      this.data = data;
      // Legacy data is never consulted again once the current format exists.
      this.purgeLegacy();
      this.save();
      return data;
    }
    save() {
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        return true;
      } catch (e) {
        return false;
      }
    }
    get settings() {
      return this.data.settings;
    }
    setSetting(name, value) {
      this.data.settings[name] = !!value;
      this.save();
    }
    isCleared(stage, levelIdx) {
      return this.data.progress[stage].includes(levelIdx);
    }
    markCleared(stage, levelIdx) {
      if (!this.isCleared(stage, levelIdx)) {
        this.data.progress[stage].push(levelIdx);
        this.data.progress[stage].sort((a, b) => a - b);
        this.save();
      }
    }
    clearedCount(stage) {
      return this.data.progress[stage].length;
    }
    /** Clear completion records only; settings are kept. */
    resetProgress() {
      this.data.progress = emptyProgress();
      this.purgeLegacy();
      this.save();
    }
  }

  return { Store, STORAGE_KEY, LEGACY_KEYS, DEFAULT_SETTINGS, memoryStorage };
});
