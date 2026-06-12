import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startAutoScroll } from './auto-scroll';

describe('startAutoScroll', () => {
  let container: HTMLElement;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let nextRafId: number;

  const flushFrame = () => {
    const pending = [...rafCallbacks.entries()];
    rafCallbacks.clear();
    pending.forEach(([, cb]) => cb(performance.now()));
  };

  beforeEach(() => {
    rafCallbacks = new Map();
    nextRafId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextRafId++;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });
    container = document.createElement('div');
    container.getBoundingClientRect = () =>
      ({ top: 0, bottom: 200, left: 0, right: 100, width: 100, height: 200, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.unstubAllGlobals();
  });

  it('keeps scheduling frames until the returned stop function is called', () => {
    const stop = startAutoScroll(container, () => 100);
    expect(rafCallbacks.size).toBe(1);
    flushFrame();
    expect(rafCallbacks.size).toBe(1);

    stop();
    expect(rafCallbacks.size).toBe(0);
  });

  it('invokes onStop exactly once even when stop is called repeatedly', () => {
    const onStop = vi.fn();
    const stop = startAutoScroll(container, () => 100, onStop);

    stop();
    stop();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('stops the loop and runs onStop on window pointerup (mouse released outside the window)', () => {
    const onStop = vi.fn();
    startAutoScroll(container, () => 100, onStop);
    expect(rafCallbacks.size).toBe(1);

    window.dispatchEvent(new Event('pointerup'));

    expect(rafCallbacks.size).toBe(0);
    expect(onStop).toHaveBeenCalledTimes(1);
    flushFrame();
    expect(rafCallbacks.size).toBe(0);
  });

  it('stops the loop and runs onStop on window blur (focus lost mid-drag)', () => {
    const onStop = vi.fn();
    startAutoScroll(container, () => 100, onStop);

    window.dispatchEvent(new Event('blur'));

    expect(rafCallbacks.size).toBe(0);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('does not call onStop again via pointerup after a manual stop', () => {
    const onStop = vi.fn();
    const stop = startAutoScroll(container, () => 100, onStop);

    stop();
    window.dispatchEvent(new Event('pointerup'));

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('scrolls the container when the pointer is in the bottom edge zone', () => {
    container.scrollTop = 0;
    Object.defineProperty(container, 'scrollHeight', { value: 1000 });
    Object.defineProperty(container, 'clientHeight', { value: 200 });

    const stop = startAutoScroll(container, () => 195);
    flushFrame();

    expect(container.scrollTop).toBeGreaterThan(0);
    stop();
  });
});
