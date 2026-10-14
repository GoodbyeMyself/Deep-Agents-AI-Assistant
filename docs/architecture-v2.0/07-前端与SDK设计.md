> **V2.0 适用说明：** 本章 V2.0 支撑规范：React + Ant Design X，两个应用壳复用 Chat Core；优先页面上下文感知与安全接入。 章节与 `01-架构基线与边界.md` 如有冲突，以后者为准。

# 07 · React + Ant Design X 前端与三类 Web SDK

## 1. UI 技术与模式

- React + TypeScript；Ant Design 负责企业基础组件；Ant Design X 负责 Bubble、Sender、Conversations、ThoughtChain、Attachments、Sources 等 AI 交互；版本在 M3 锁定并核对 API。
- `assistant-ui` 实现一个 **ChatWorkspace/ChatStore/ViewRenderer**；`assistant-web` 实现完整独立应用 Shell；`assistant-embed` 实现 iframe 页面；`assistant-sdk` 暴露 React/JS 接入 API。
- **Assistant Mode**：悬浮按钮、右侧抽屉、页面 Inline；只有 Chat/Context/可选历史，不显示模型/插件/系统后台管理。
- **Standalone Mode**：完整导航、会话工作台与基础管理页（模型、会话、Agent 配置、插件和能力状态、基础设置）；权限菜单由后端控制。

## 2. 组件树（目标）

```text
Application Shell
├── AssistantShell (floating/drawer/inline)    OR
└── StandaloneShell (Header, Sider, Router)
    └── Shared ChatWorkspace
        ├── ConversationSidebar (Ant Design X Conversations)
        ├── MessageList (Bubble + Markdown renderer)
        ├── ExecutionTimeline (Tool/Subagent status, not private reasoning)
        ├── EvidencePanel (Sources + revalidated source links)
        ├── AssistantViewRenderer (text/metric/table/chart.line/references)
        └── ChatComposer (Sender/Attachments)
```

**构建体积**：Assistant UI 不引入管理路由，管理页面不进入 SDK Bundle。图表推荐已有受控渲染器实现，而不是让插件注入任意前端 JS/JSX。

## 3. 前端与 Deep Agents 解耦

`AssistantTransport` 只处理当前部署的标准 Session/Run/Event API；React 组件不依赖 LangGraph 的 chunk、toolCall 内部类型。`useXChat` 或 X SDK 作为可选集成验证；避免 Ant Design X SDK 与自研 ChatStore 两套状态同步。优先**自研事件归一化 ChatStore + 复用 Ant Design X UI 组件**。

## 4. 稳定 SDK 公共接口（平台自研）

```ts
export type Presentation = "floating" | "drawer" | "inline";
export interface AssistantSdkOptions {
  apiBaseUrl: string;
  presentation: Presentation;
  container?: HTMLElement;
  getAccessCredential(): Promise<string>; // 短期凭证
  getContext?(): RawHostContext | Promise<RawHostContext>;
  onReady?(): void;
  onError?(error: Error): void;
}
export interface AssistantInstance {
  mount(): Promise<void>;
  open(): void;
  close(): void;
  toggle(): void;
  updateContext(ctx: RawHostContext): void;
  destroy(): void;
}
```

`createAssistant()`（JS SDK）和 `<AssistantProvider> / <AssistantWidget>`（React SDK）可以共用内部实例和 ChatWorkspace，外部 API 尽量保持跨框架一致。

## 5. iframe 交互与安全

Bridge Message 建议 `{protocol:'assistant-bridge', version:'1', channelId, requestId?, type, payload}`。  
必需事件：`HOST_HELLO`、`ASSISTANT_READY`、`CONTEXT_UPDATE`、`OPEN`、`CLOSE`、`ASSISTANT_ERROR`。  
安全检查：`event.origin` + `event.source` + 通道随机数 + 消息 Schema + 目标 origin 白名单；不要 `postMessage(..., '*')`；CSP `frame-ancestors` 限定允许宿主；短时一次性 embed ticket 由服务端兑换会话认证，不通过 URL 明文长期令牌。

**页面切换**：已有 Run 固定提问当时 ContextSnapshot，后续切换只更新下一次提问。**独立部署** 不等于跨产品共享 Context。

## 6. Shared Chat Store 状态

```ts
interface ChatUIState {
  sessionId?: string;
  activeRunId?: string;
  inputDraft: string;
  messages: AssistantMessage[];
  tools: Record<string, { status: "started" | "completed" | "failed"; label: string }>;
  views: AssistantView[];
  evidenceRefs: string[];
  lastEventSeq?: number;
}
```

`sessionId`、`runId`、`messageId`、`toolCallId` 必须区分；支持 optimistic 用户消息与失败重试、不重复显示重连的事件。不允许原始 ToolResult 隐含用户敏感数据而直接渲染。

## 7. 独立 Web 管理菜单首版

| 菜单          | M3 最小功能                                      | 后端            |
| ------------- | ------------------------------------------------ | --------------- |
| 智能对话      | 创建/继续、流式消息、Tool 状态                   | Session/Run     |
| 会话管理      | 我的会话搜索/归档/删除（软删除或明确策略）       | Session Service |
| 模型管理      | 查询/新增/启停/默认模型/连接测试（仅管理员）     | Model Registry  |
| 插件与能力    | 当前实例插件、Capabilities、版本、健康和加载失败 | Plugin Registry |
| Agent 管理    | V1 展示配置与只读列表，可逐步扩展                | Agent Registry  |
| 系统配置/审计 | V1 可先基础只读，后续完善                        | Settings/Audit  |

菜单隐藏**不能代替服务器管理 API 的角色权限控制**。

## 8. 结构化渲染与证据

`AssistantView` 采用版本化判别联合类型：`text`、`metric`、`table`、`chart.line`、`references`。前端 `ViewRendererRegistry` 仅登记可信组件；Source 引用调用受控证据解析 API 返回允许用户访问的数据范围，不直接用未授权对象地址。

## 9. UI 验收重点

- 共享 ChatWorkspace 在独立 Web、React 宿主、原生 JS 宿主、iframe 中均有统一消息/进度/证据呈现。
- Floating / Drawer / Inline 的布局和容器销毁无事件泄露；iframe/Shadow DOM 不污染宿主样式。
- 长回答、Markdown 代码块、中文、错误/超时、数据部分成功、空状态、断流恢复、浏览器刷新都可交互。
- 管理页普通用户直接访问 URL / API 无法越权访问。
