# iframe Bridge

宿主页面与跨 Origin iframe 助手之间的版本化 `postMessage` 协议实现。

包名：`@assistant/iframe-bridge`。

## 目录结构（`src/`）

```text
src/
├── index.ts                    # 对外 barrel 导出
├── protocol/                   # 协议常量、Schema、信封与消息校验
│   ├── constants.ts
│   ├── envelope.ts
│   ├── schema.ts
│   └── parse.ts
├── bridge/                     # Host / iframe 两侧 postMessage 桥接
│   ├── host-bridge.ts
│   └── assistant-bridge.ts
└── host/                       # 业务宿主 Shadow DOM 一键挂载
    ├── constants.ts
    ├── types.ts
    ├── embed-ticket.ts
    ├── loader-styles.ts
    └── mount-iframe-assistant.ts
```

## 协议能力

- iframe 主动发送 `assistant.loaded`，避免错过快速加载事件。
- Host 使用一次性票据和初始 Context 完成 hello 握手。
- 支持 Context 更新、打开、关闭、ready 和错误事件。
- 使用 requestId 防止重复消息处理。

## 主要导出

| 导出 | 说明 |
| --- | --- |
| `createIframeHostBridge` / `createIframeAssistantBridge` | 低层桥接，供自定义 iframe 集成。 |
| `mountIframeAssistant` | 浮层 + 票据 + 桥接的一站式挂载。 |
| `parseTrustedBridgeEvent`、`bridgeMessageSchema` | 消息校验与类型。 |
| `BRIDGE_PROTOCOL`、`BRIDGE_VERSION` | 协议标识。 |
| `ASSISTANT_CONTEXT_EVENT` | 宿主 `CustomEvent` 更新 Context 的事件名。 |

## 安全校验

所有消息必须同时匹配 Origin、`event.source`、channelId、协议版本和 Zod Schema。不得在 URL 或消息中发送模型 Key、长期业务 Token 或未过滤权限数据。

## 验证

```bash
pnpm --filter @assistant/iframe-bridge build
pnpm --filter @assistant/iframe-bridge typecheck
pnpm --filter @assistant/iframe-bridge test
```
