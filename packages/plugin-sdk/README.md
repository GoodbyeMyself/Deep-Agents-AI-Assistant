# Plugin SDK

业务 Adapter 开发 API，帮助插件以类型安全方式实现标准 Capability，而无需依赖 Agent Server 内部实现。

## 主要导出

- `definePlugin`：声明插件工厂。
- `implementCapability`：绑定标准契约并校验输入。
- `PluginHostServices`：日志、配置和凭证引用服务。
- `AssistantPlugin`：V2 可导出的 Contract、能力、初始化、健康检查和释放生命周期。

## 边界

插件应通过凭证引用获取 Secret，不得把 Secret 写入 Manifest、日志或源码。SDK 不负责插件发现；加载、来源校验和注册由 `plugin-runtime` 负责。

## 验证

```bash
pnpm --filter @assistant/plugin-sdk build
pnpm --filter @assistant/plugin-sdk typecheck
pnpm --filter @assistant/plugin-sdk test
```
