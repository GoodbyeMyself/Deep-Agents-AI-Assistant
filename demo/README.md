# Demo 工程

本目录集中保存所有可执行演示工程，避免演示页面、测试模型入口和启动脚本混入正式 `apps/`、`packages/`。

## 目录

- `product-a/`：React + Ant Design 的 Product A 数据质量运营台。
- `product-b/`：Vue 3 + Element Plus + Vite 的 Product B 数据资产驾驶舱。
- `product-shell/`：Product A 的 React 业务页面壳和安全 iframe 助手接入层。
- `sdk-host/`：React SDK、JavaScript SDK 与 iframe 接入宿主。
- `server/`：M3、M4 和 A/B 使用的 Demo Server 入口；A/B 交互演示强制使用真实 DeepSeek，Test Double 仅供 E2E。
- `scripts/`：双产品一键启动及跨平台子进程清理。

演示工程可以依赖正式模块；正式 Core、Runtime、Server、SDK 和 UI 不得反向依赖本目录。

## 运行

在仓库根目录执行：

```bash
pnpm demo
```

打开 Product A `http://127.0.0.1:5411` 和 Product B `http://127.0.0.1:5412`。按 `Ctrl+C` 停止全部进程。

浏览器验收：

```bash
pnpm demo:e2e
```

演示始终使用 Mock Identity 和模拟业务数据。A/B 必须从根目录 `.env` 读取真实 DeepSeek Key，缺少配置时启动失败；两套业务页分别在 `5511`、`5512` 通过 iframe 加载助手。生产接入边界见 `docs/dual-product-demo-guide.md`。
