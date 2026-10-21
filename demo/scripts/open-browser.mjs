import { spawn } from "node:child_process";

/**
 * @param {string} url
 */
export function openBrowser(url) {
  if (process.env["DEMO_OPEN_BROWSER"] === "0") return;
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true });
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" });
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
}
