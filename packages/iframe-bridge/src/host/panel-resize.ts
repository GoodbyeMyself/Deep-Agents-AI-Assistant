/** 默认浮层宽度：原 448px + 120px */
export const ASSISTANT_PANEL_DEFAULT_WIDTH = 568;

export const ASSISTANT_PANEL_MIN_WIDTH = 360;

const VIEWPORT_GUTTER = 32;

function clampPanelWidth(width: number): number {
  const max = Math.max(ASSISTANT_PANEL_MIN_WIDTH, window.innerWidth - VIEWPORT_GUTTER);
  return Math.min(max, Math.max(ASSISTANT_PANEL_MIN_WIDTH, width));
}

/**
 * 左侧拖拽调整浮层宽度（面板锚定在右下角，向左拖即变宽）。
 */
export function attachPanelWidthResize(panel: HTMLElement, handle: HTMLElement): () => void {
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = panel.getBoundingClientRect().width;
    panel.classList.add("is-resizing");

    const onPointerMove = (moveEvent: PointerEvent) => {
      const next = clampPanelWidth(startWidth + (startX - moveEvent.clientX));
      panel.style.setProperty("--assistant-panel-width", `${Math.round(next)}px`);
    };

    const finish = (pointerId: number) => {
      handle.releasePointerCapture(pointerId);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", onPointerUp);
      panel.classList.remove("is-resizing");
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      finish(upEvent.pointerId);
    };

    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerUp);
  };

  handle.addEventListener("pointerdown", onPointerDown);
  return () => handle.removeEventListener("pointerdown", onPointerDown);
}
