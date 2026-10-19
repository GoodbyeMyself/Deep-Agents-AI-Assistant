export function loaderStylesheet(accent: string, zIndex: number): string {
  return `
    :host { display: contents; pointer-events: none; color-scheme: light; --assistant-accent: ${accent}; }
    *, *::before, *::after { box-sizing: border-box; }
    .assistant-loader-launcher {
      position: fixed; right: 24px; bottom: 22px; z-index: ${zIndex + 1};
      display: flex; align-items: center; gap: 10px; min-width: 150px; height: 54px;
      padding: 0 18px 0 9px; border: 1px solid color-mix(in srgb, var(--assistant-accent) 35%, white);
      border-radius: 18px; color: white; background: #12241f;
      box-shadow: 0 18px 42px rgb(5 30 24 / 28%); cursor: pointer;
      pointer-events: auto;
      font: 600 14px/1.2 "Microsoft YaHei", "PingFang SC", sans-serif;
      transition: transform 180ms ease, box-shadow 180ms ease, opacity 160ms ease;
    }
    .assistant-loader-launcher:hover { transform: translateY(-2px); box-shadow: 0 22px 48px rgb(5 30 24 / 34%); }
    .assistant-loader-launcher[hidden] { display: none; }
    .assistant-loader-mark {
      display: grid; place-items: center; width: 38px; height: 38px; border-radius: 13px;
      color: #10251f; background: var(--assistant-accent); font-size: 13px; font-weight: 900;
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 48%);
    }
    .floating-assistant-panel {
      position: fixed; right: 24px; bottom: 22px; z-index: ${zIndex};
      width: min(448px, calc(100vw - 32px)); height: min(740px, calc(100vh - 44px));
      overflow: hidden; border: 1px solid rgb(20 87 70 / 18%); border-radius: 22px;
      background: #f8fbfa; box-shadow: 0 28px 80px rgb(6 31 25 / 30%);
      opacity: 0; visibility: hidden; pointer-events: none;
      transform: translateY(18px) scale(.975); transform-origin: right bottom;
      transition: opacity 180ms ease, transform 220ms cubic-bezier(.2,.8,.2,1), visibility 180ms ease;
    }
    .floating-assistant-panel.is-open {
      opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(0) scale(1);
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
      .assistant-loader-launcher { right: 14px; bottom: 14px; min-width: 54px; padding-right: 9px; }
      .assistant-loader-launcher strong { display: none; }
      .floating-assistant-panel { right: 8px; bottom: 8px; width: calc(100vw - 16px); height: calc(100vh - 16px); border-radius: 18px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .assistant-loader-launcher, .floating-assistant-panel, .assistant-loader-close { transition: none; }
    }
  `;
}
