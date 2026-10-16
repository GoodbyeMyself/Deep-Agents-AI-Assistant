# Plugin Runtime

可信业务插件的发现、Manifest 校验、生命周期管理、Capability 注册和 HTTP Provider 驱动。

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
