# Demo Scripts

双产品演示的进程编排和生命周期清理脚本。

## 脚本

- `start-dual-demo.mjs`：启动 A/B 的 Agent Server、Web、iframe Assistant，以及独立 Web（`assistant-web`）与其 Agent Server，共八个进程；端口就绪后自动打开浏览器（可用 `DEMO_OPEN_BROWSER=0` 关闭）。
- `wait-for-port.mjs` / `open-browser.mjs`：演示就绪检测与跨平台打开默认浏览器。
- `run-demo-child.mjs`：监控父进程与心跳；启动器退出时递归清理子进程。

## 使用

从仓库根目录执行：

```bash
pnpm demo
```

按 `Ctrl+C` 停止全部演示进程。脚本不得记录或打印模型 API Key；密钥只由服务端从根目录 `.env` 读取。
