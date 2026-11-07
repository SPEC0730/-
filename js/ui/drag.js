/*
 * Pointer-event drag helper for tablets and mice. A press that moves less
 * than `threshold` px is a tap (tap-to-select alternative); otherwise a
 * visual "ghost" copy follows the pointer in a fixed drag layer while the
 * original stays in place (hidden) and keeps pointer capture. This avoids
 * losing capture by re-parenting the element mid-gesture.
 * Only one pointer can drag at a time.
 */
(function (root) {
  'use strict';
  const DME = (root.DME = root.DME || {});
  let active = null;

  function layer() {
    let l = document.getElementById('drag-layer');
    if (!l) {
      l = document.createElement('div');
      l.id = 'drag-layer';
      document.body.appendChild(l);
    }
    return l;
  }

  /**
   * opts: { threshold, canStart(), onStart(), onMove(x,y), onDrop(cx,cy,el), onTap(), onCancel() }
   * onDrop receives the dragged token's centre point.
   */
  function makeDraggable(el, opts) {
    const threshold = opts.threshold || 8;
    let st = null;

    function down(e) {
      if (active || (e.button !== undefined && e.button > 0)) return;
      if (opts.canStart && !opts.canStart()) return;
      e.preventDefault();
      st = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dragging: false };
      active = st;
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
    }
    function lift(e) {
      const r = el.getBoundingClientRect();
      st.dragging = true;
      // Grab offset is measured on the visible box; the ghost uses the
      // untransformed layout size so a shrunken token (on the belt) grows back.
      st.offX = 0;
      st.offY = 0;
      st.w = el.offsetWidth || r.width;
      st.h = el.offsetHeight || r.height;
      const cs = getComputedStyle(el);
      const g = el.cloneNode(true);
      g.removeAttribute('id');
      g.classList.add('drag-ghost');
      g.classList.remove('selected', 'on-belt', 'in-answer', 'in-scratch', 'new');
      g.setAttribute('aria-hidden', 'true');
      g.style.width = st.w + 'px';
      g.style.height = st.h + 'px';
      g.style.fontSize = cs.fontSize;
      layer().appendChild(g);
      st.ghost = g;
      el.classList.add('drag-source');
      if (opts.onStart) opts.onStart(e);
      place(e.clientX, e.clientY);
    }
    function place(x, y) {
      st.ghost.style.left = x - st.offX - st.w / 2 + 'px';
      st.ghost.style.top = y - st.offY - st.h / 2 + 'px';
    }
    function move(e) {
      if (!st || e.pointerId !== st.id) return;
      e.preventDefault();
      if (!st.dragging) {
        if (Math.hypot(e.clientX - st.x0, e.clientY - st.y0) < threshold) return;
        lift(e);
      }
      place(e.clientX, e.clientY);
      if (opts.onMove) opts.onMove(e.clientX - st.offX, e.clientY - st.offY);
    }
    function finish(e, cancelled) {
      if (!st || e.pointerId !== st.id) return;
      const s = st;
      st = null;
      active = null;
      try {
        if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      if (!s.dragging) return; // a tap: handled by the click listener below
      el._dragEndedAt = performance.now();
      if (s.ghost) s.ghost.remove();
      el.classList.remove('drag-source');
      const cx = e.clientX - s.offX;
      const cy = e.clientY - s.offY;
      if (cancelled) {
        if (opts.onCancel) opts.onCancel(el);
      } else if (opts.onDrop) opts.onDrop(cx, cy, el);
    }
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', (e) => finish(e, false));
    el.addEventListener('pointercancel', (e) => finish(e, true));
    el.addEventListener('lostpointercapture', (e) => {
      if (st && e.pointerId === st.id) finish(e, false);
    });
    // Taps (and keyboard Enter/Space on the button) arrive as clicks. The
    // click that follows a finished drag is swallowed. Clicks never bubble
    // to the container, so a tap is handled exactly once.
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (el._dragEndedAt && performance.now() - el._dragEndedAt < 450) return;
      if (opts.canStart && !opts.canStart()) return;
      if (opts.onTap) opts.onTap(e);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.style.touchAction = 'none';
  }

  function isDragging() {
    return !!(active && active.dragging);
  }

  /** Abort any gesture (e.g. when the screen changes). */
  function cancelAll() {
    active = null;
    const l = document.getElementById('drag-layer');
    if (l) l.innerHTML = '';
    document.querySelectorAll('.drag-source').forEach((n) => n.classList.remove('drag-source'));
  }

  DME.Drag = { makeDraggable, isDragging, cancelAll };
})(typeof self !== 'undefined' ? self : this);
