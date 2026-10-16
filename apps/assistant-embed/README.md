# Assistant Embed

运行在 iframe 内的 React 助手页面。它通过安全 Bridge 接收宿主上下文，用一次性票据换取短期凭证，并复用 Assistant SDK、Transport 与 Shared Chat Core。

## 页面结构

- 头部固定显示助手与当前业务对象。
- 中间消息区独立滚动。
- 输入区固定在容器底部。

## 运行配置

Vite 开发服务支持以下环境变量：

- `ASSISTANT_EMBED_PORT`：iframe 页面端口。
- `ASSISTANT_API_TARGET`：对应部署的 Agent Server。
- `ASSISTANT_HOST_ORIGIN`：允许嵌入该页面的宿主 Origin。

## 安全边界

URL 只携带宿主 Origin 和随机 channelId，不携带 API Key 或长期业务 Token。消息必须通过 Origin、source、channelId、requestId 和协议版本校验。

## 验证

```bash
pnpm --filter @assistant/assistant-embed build
pnpm --filter @assistant/assistant-embed typecheck
```
