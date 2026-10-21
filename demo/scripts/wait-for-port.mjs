import net from "node:net";

/**
 * @param {number} port
 * @param {string} [host]
 * @param {number} [timeoutMs]
 */
export function waitForPort(port, host = "127.0.0.1", timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = () => {
      const socket = net.connect({ port, host }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}
