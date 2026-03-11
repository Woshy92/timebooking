const EDGE_ZONE = 40;
const MAX_SPEED = 8;

export function startAutoScroll(
  container: HTMLElement,
  getClientY: () => number
): () => void {
  let animationId: number | null = null;

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

  animationId = requestAnimationFrame(tick);

  return () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
}
