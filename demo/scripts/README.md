# Demo Scripts

双产品演示的进程编排和生命周期清理脚本。

## 脚本

- `start-dual-demo.mjs`：同时启动 A/B 的 Agent Server、Web 和 iframe Assistant，共六个进程。
- `run-demo-child.mjs`：监控父进程与心跳；启动器退出时递归清理子进程。

## 使用

从仓库根目录执行：

```bash
pnpm demo
```

按 `Ctrl+C` 停止全部演示进程。脚本不得记录或打印模型 API Key；密钥只由服务端从根目录 `.env` 读取。
