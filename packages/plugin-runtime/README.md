# Plugin Runtime

可信业务插件的发现、Manifest 校验、生命周期管理、Capability 注册和 HTTP Provider 驱动。

包名：`@assistant/plugin-runtime`。

## 目录结构（`src/`）

```text
src/
├── index.ts                    # 对外 barrel 导出
├── manifest/
│   └── schema.ts               # plugin.json Zod Schema
├── driver/
│   └── http-capability.ts      # HTTP 插件远程 invoke
├── lifecycle/
│   ├── types.ts                # 状态、记录与 Runtime 配置
│   └── record.ts               # 生命周期事件与失败记录构造
├── registry/
│   └── plugin-registry.ts      # 按 pluginId 索引的运行记录
├── install/
│   ├── discover.ts             # 安装目录扫描
│   ├── validate-candidate.ts   # Manifest / 路径 / 完整性校验
│   └── plugin-shape.ts         # Capability 声明与实现一致性
└── runtime/
    ├── plugin-runtime.ts       # 发现 → 校验 → 加载 → 注册
    └── host-services.ts        # 注入 plugin-sdk 的 HostServices
```

## 主要导出

- `PluginRuntime`、`PluginRegistry`
- `pluginManifestSchema`
- `HttpCapabilityDriver`、`HttpCapabilityProvider`
- 插件生命周期事件和状态类型

## 安全边界

- 只从配置的可信安装目录加载已批准插件。
- 校验入口路径，拒绝路径逃逸。
- 校验 Manifest、API 版本、Capability 声明和构建产物哈希。
- 当前设计是启动发现，不支持任意上传 JavaScript 或运行时热加载。

## 验证

```bash
pnpm --filter @assistant/plugin-runtime build
pnpm --filter @assistant/plugin-runtime typecheck
pnpm --filter @assistant/plugin-runtime test
```
