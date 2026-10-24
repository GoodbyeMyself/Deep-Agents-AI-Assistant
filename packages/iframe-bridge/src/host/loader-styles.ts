import { ASSISTANT_PANEL_DEFAULT_WIDTH } from "./panel-resize.js";

export function loaderStylesheet(accent: string, zIndex: number): string {
  return `
    :host { display: contents; pointer-events: none; color-scheme: light; --assistant-accent: ${accent}; }
    *, *::before, *::after { box-sizing: border-box; }
    .assistant-loader-launcher {
      position: fixed; right: max(24px, env(safe-area-inset-right)); bottom: max(22px, env(safe-area-inset-bottom)); z-index: ${zIndex + 1};
      display: grid; place-items: center; width: 56px; height: 56px; padding: 0;
      border: 1px solid #b9d3ff;
      border-radius: 50%; color: #1261ed; background: linear-gradient(145deg, #fff, #e8f2ff);
      box-shadow: 0 8px 24px rgb(18 97 237 / 18%); cursor: pointer;
      pointer-events: auto;
      font: 600 14px/1.2 "Microsoft YaHei", "PingFang SC", sans-serif;
      transition: transform 180ms ease, box-shadow 180ms ease, opacity 160ms ease;
    }
    .assistant-loader-launcher:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgb(18 97 237 / 25%); }
    .assistant-loader-launcher[hidden] { display: none; }
    .assistant-loader-launcher:focus-visible { outline: 3px solid #1261ed; outline-offset: 4px; }
    .assistant-loader-mark {
      display: grid; place-items: center; width: 36px; height: 36px;
    }
    .assistant-loader-mark svg { width: 36px; height: 36px; }
    .assistant-loader-standalone {
      position: absolute; top: 8px; right: 120px; z-index: 3;
      display: grid; place-items: center; width: 36px; height: 36px;
      border-radius: 6px; color: #1f1f1f; text-decoration: none;
    }
    .assistant-loader-standalone svg { width: 17px; height: 17px; }
    .assistant-loader-standalone:hover { color: #1f1f1f; background: #f3f3f3; }
    .assistant-loader-standalone:focus-visible { outline: 2px solid #1677ff; outline-offset: -2px; }
    .floating-assistant-panel {
      position: fixed; right: 24px; bottom: 22px; z-index: ${zIndex};
      --assistant-panel-width: ${ASSISTANT_PANEL_DEFAULT_WIDTH}px;
      width: min(var(--assistant-panel-width), calc(100vw - 32px)); height: min(740px, calc(100vh - 44px));
      overflow: hidden; border: 1px solid rgb(20 87 70 / 18%); border-radius: 14px;
      background: #f8fbfa; box-shadow: 0 28px 80px rgb(6 31 25 / 30%);
      opacity: 0; visibility: hidden; pointer-events: none;
      transform: translateY(18px) scale(.975); transform-origin: right bottom;
      transition: opacity 180ms ease, transform 220ms cubic-bezier(.2,.8,.2,1), visibility 180ms ease;
    }
    .floating-assistant-panel.is-open {
      opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(0) scale(1);
    }
    .floating-assistant-panel.is-resizing {
      transition: none;
      user-select: none;
    }
    .assistant-panel-resize-handle {
      position: absolute; left: 0; top: 0; bottom: 0; z-index: 4;
      width: 10px; margin: 0; padding: 0; border: 0; background: transparent;
      cursor: ew-resize; touch-action: none; pointer-events: auto;
    }
    .assistant-panel-resize-handle::after {
      content: ""; position: absolute; left: 3px; top: 50%; width: 3px; height: 56px;
      border-radius: 2px; transform: translateY(-50%);
      background: #d9d9d9;
      opacity: 0; transition: opacity 160ms ease;
    }
    .floating-assistant-panel.is-open .assistant-panel-resize-handle::after,
    .assistant-panel-resize-handle:hover::after,
    .assistant-panel-resize-handle:focus-visible::after {
      opacity: 1;
    }
    .assistant-panel-resize-handle:focus-visible {
      outline: 2px solid #bfbfbf;
      outline-offset: -2px;
    }
    .assistant-loader-frame { width: 100%; height: 100%; border: 0; background: #f8fbfa; }
    .assistant-loader-close {
      position: absolute; top: 8px; right: 8px; z-index: 3; display: grid; place-items: center;
      width: 36px; height: 36px; padding: 0; border: 0; border-radius: 6px;
      color: #1f1f1f; background: transparent; cursor: pointer;
      font: 400 18px/1 "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
      transition: background 160ms ease, color 160ms ease;
    }
    .assistant-loader-close:hover { color: #1f1f1f; background: #f3f3f3; }
    .assistant-loader-close:focus-visible {
      outline: 3px solid #f0b429; outline-offset: 2px;
    }
    .assistant-loader-status {
      position: absolute; inset: 0; z-index: 2; display: grid; place-items: center;
      color: #3b5c53; background: #f8fbfa; font: 600 14px/1.5 "Microsoft YaHei", sans-serif;
    }
    .assistant-loader-status[hidden] { display: none; }
    .assistant-loader-status.is-error { color: #a33b32; }
    @media (max-width: 640px) {
      .assistant-loader-launcher { right: max(14px, env(safe-area-inset-right)); bottom: max(14px, env(safe-area-inset-bottom)); }
      .floating-assistant-panel {
        right: 8px; bottom: 8px; width: calc(100vw - 16px); height: calc(100vh - 16px);
        border-radius: 10px;
      }
      .assistant-panel-resize-handle { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .assistant-loader-launcher, .floating-assistant-panel, .assistant-loader-close { transition: none; }
    }
  `;
}
