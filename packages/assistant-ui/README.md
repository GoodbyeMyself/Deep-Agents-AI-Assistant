# Assistant UI

独立 Web、React SDK、JavaScript SDK 和 iframe 共用的聊天核心与安全视图组件，基于 React、Ant Design 和 Ant Design X。

包名：`@assistant/assistant-ui`。

## 在架构中的位置

```text
@assistant/contracts            →  AssistantView、SSE 事件等共享契约
@assistant/assistant-transport  →  Session / Run / Evidence API 客户端
@assistant/assistant-ui         →  ChatWorkspace、消息流与安全渲染（本包）
@assistant/assistant-sdk        →  壳层与 createAssistant，内部挂载本包组件
```

## 目录结构（`src/`）

```text
src/
├── index.ts              # 对外 barrel 导出
├── styles.css            # 聊天区与 View 卡片样式（子路径 @assistant/assistant-ui/styles.css）
├── chat/                 # 会话工作区、消息列表、输入与聊天状态
│   ├── ChatWorkspace.tsx
│   ├── MessageList.tsx
│   ├── ChatComposer.tsx
│   ├── store.ts          # chatReducer，消费 AssistantEvent 流
│   └── types.ts
├── execution/            # Tool / Subagent 执行过程展示
│   └── ExecutionTimeline.tsx
├── evidence/             # 引用资料解析（服务端再次授权）
│   └── EvidencePanel.tsx
├── view/                 # 白名单结构化 View 与安全 Markdown
│   ├── AssistantViewRenderer.tsx
│   └── SafeContent.tsx
└── theme/                # 品牌主色解析
    └── theme.ts
```

## 主要导出

| 导出 | 说明 |
| --- | --- |
| `ChatWorkspace` | 会话列表、消息区、Run 与上下文的主工作区；依赖 `AssistantApiTransport`。 |
| `MessageList`、`ChatComposer` | 流式气泡与 Sender 输入区。 |
| `ExecutionTimeline` | Tool / Subagent 执行步骤（ThoughtChain）。 |
| `EvidencePanel` | 按引用 ID 拉取并展示 Evidence。 |
| `AssistantViewRenderer` | 校验并渲染契约内 `AssistantView`。 |
| `SafeContent` | 转义 HTML 的 Markdown 展示。 |
| `chatReducer`、`initialChatState` | 将 Transport SSE 事件合并为 `ChatState`。 |
| `ChatMessage`、`ChatState`、`PublicExecutionStep` | 聊天 UI 状态类型。 |
| `DEFAULT_ASSISTANT_COLOR_PRIMARY`、`resolveAssistantColorPrimary` | Ant Design `colorPrimary` 默认值与解析。 |
| `@assistant/assistant-ui/styles.css` | 组件配套样式。 |

## 安全边界

本包只渲染白名单 View 类型，不执行后端或插件提供的 HTML/JavaScript。`SafeContent` 开启 `escapeRawHtml`；UI 中的权限提示不替代服务端授权。

## 验证

```bash
pnpm --filter @assistant/assistant-ui build
pnpm --filter @assistant/assistant-ui typecheck
pnpm --filter @assistant/assistant-ui test
```
