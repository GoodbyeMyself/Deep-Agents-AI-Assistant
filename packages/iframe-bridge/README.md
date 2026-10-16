# iframe Bridge

宿主页面与跨 Origin iframe 助手之间的版本化 `postMessage` 协议实现。

## 协议能力

- iframe 主动发送 `assistant.loaded`，避免错过快速加载事件。
- Host 使用一次性票据和初始 Context 完成 hello 握手。
- 支持 Context 更新、打开、关闭、ready 和错误事件。
- 使用 requestId 防止重复消息处理。

## 安全校验

所有消息必须同时匹配 Origin、`event.source`、channelId、协议版本和 Zod Schema。不得在 URL 或消息中发送模型 Key、长期业务 Token 或未过滤权限数据。

## 验证

```bash
pnpm --filter @assistant/iframe-bridge build
pnpm --filter @assistant/iframe-bridge typecheck
pnpm --filter @assistant/iframe-bridge test
```
