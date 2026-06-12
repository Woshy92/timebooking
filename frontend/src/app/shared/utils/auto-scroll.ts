const EDGE_ZONE = 40;
const MAX_SPEED = 8;

/**
 * Starts an rAF-driven auto-scroll loop on `container`, scrolling when the
 * pointer (reported by `getClientY`) nears the top/bottom edge.
 *
 * The returned stop function is idempotent. The loop is also self-guarding:
 * it stops automatically on `window` `pointerup` and `blur`. This guarantees
 * the loop ends even when the mouse button is released *outside* the browser
 * window, where `document`-level `mouseup` listeners never fire.
 *
 * @param onStop Optional cleanup invoked exactly once when the loop stops
 *               (caller's stop call, pointerup, or blur). Use it to reset any
 *               drag-related document state (e.g. body cursor / userSelect).
 */
export function startAutoScroll(
  container: HTMLElement,
  getClientY: () => number,
  onStop?: () => void
): () => void {
  let animationId: number | null = null;
  let stopped = false;

  const tick = () => {
    const rect = container.getBoundingClientRect();
    const y = getClientY();
    const topDist = y - rect.top;
    const bottomDist = rect.bottom - y;

    if (topDist < EDGE_ZONE && container.scrollTop > 0) {
      const speed = Math.round(MAX_SPEED * (1 - topDist / EDGE_ZONE));
      container.scrollTop -= speed;
    } else if (bottomDist < EDGE_ZONE && container.scrollTop < container.scrollHeight - container.clientHeight) {
      const speed = Math.round(MAX_SPEED * (1 - bottomDist / EDGE_ZONE));
      container.scrollTop += speed;
    }

    animationId = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;

    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    window.removeEventListener('pointerup', stop);
    window.removeEventListener('blur', stop);

    onStop?.();
  };

  // Safety net: a mouseup outside the window (or losing window focus mid-drag)
  // would otherwise leave this loop running forever.
  window.addEventListener('pointerup', stop);
  window.addEventListener('blur', stop);

  animationId = requestAnimationFrame(tick);

  return stop;
}
