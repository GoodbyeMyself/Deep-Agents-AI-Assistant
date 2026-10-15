# Demo 工程

本目录集中保存所有可执行演示工程，避免演示页面、Fake Model Server 和启动脚本混入正式 `apps/`、`packages/`。

## 目录

- `product-a/`：Product A 数据质量运营台。
- `product-b/`：Product B 数据资产驾驶舱。
- `product-shell/`：A/B 共用的业务页面壳和助手接入层。
- `sdk-host/`：React SDK、JavaScript SDK 与 iframe 接入宿主。
- `server/`：M3、M4 和 A/B 使用的离线 Fake Model Server 入口。
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

演示使用 Mock Identity、Fake Model 和模拟业务数据；生产接入边界见 `docs/dual-product-demo-guide.md`。
