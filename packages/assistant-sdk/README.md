# Assistant SDK

业务产品接入助手的 **React 组件**与 **命令式 `createAssistant()` 入口**（内部仍挂载同一套 `AssistantSurface` + Shared Chat Core）。统一提供 mount、open、close、`updateContext`、`getState`、`destroy` 生命周期，以及通过 `AssistantApiTransport` 访问当前部署的 Session / Run API。

包名：`@assistant/assistant-sdk`。

## 在架构中的位置

```text
@assistant/context              →  RawHostContext Schema（宿主页面上下文）
@assistant/assistant-transport  →  HTTP / SSE 与 Agent Server 通信
@assistant/assistant-ui         →  ChatWorkspace、主题 token
@assistant/assistant-sdk        →  Controller + Shell 形态（本包）
apps/assistant-embed            →  iframe 内使用 AssistantReact
demo/sdk-host                   →  React 内联接入联调示例
```

设计约束见 `docs/architecture-v2.0/07-前端与SDK设计.md`：Transport 只面向平台 HTTP 契约，不暴露 LangGraph / Deep Agents 类型；宿主传入的 Context 经 Schema 校验后上传，**不构成授权依据**（鉴权在服务端与原业务系统）。

## 目录结构（`src/`）

```text
src/
├── index.tsx       # createAssistant、再导出 React 与主题工具
├── react.tsx       # AssistantProvider / AssistantSurface / useAssistant / AssistantReact
├── controller.ts   # AssistantController、AssistantSdkOptions、状态订阅
└── styles.css      # floating / drawer / inline 壳层样式（子路径导出）
```

## 主要导出

| 导出 | 说明 |
| --- | --- |
| `createAssistant` | 在非 React 宿主中创建实例：`mount()` 渲染 `AssistantProvider` + `AssistantSurface`；可传 `container` 选择器或元素，省略时自动在 `document.body` 下创建根节点。 |
| `AssistantInstance` | `mount` / `open` / `close` / `updateContext` / `getState` / `destroy`。 |
| `AssistantController` | 共享状态中心：持有 `AssistantApiTransport`、`getContext` / `updateContext`、open/close 与 `subscribe`。 |
| `AssistantProvider` | React 上下文；可传 `options` 或外部创建的 `controller`（便于与宿主状态共存）。 |
| `AssistantSurface` | 默认 Shell：launcher（floating）、面板、内联区，内部使用 `ChatWorkspace`。 |
| `AssistantReact` | `options` → Provider + Surface 的一站式组件。 |
| `useAssistant` | 订阅 `AssistantSdkState`，暴露 `open` / `close` / `updateContext` / `controller`。 |
| `DEFAULT_ASSISTANT_COLOR_PRIMARY`、`resolveAssistantColorPrimary`、`AssistantColorTheme` | 从 `@assistant/assistant-ui` 再导出，用于品牌主色。 |
| `@assistant/assistant-sdk/styles.css` | SDK 壳层样式；使用前通常还需 `antd/dist/reset.css` 与 `@assistant/assistant-ui` 样式（见下方示例）。 |

### `AssistantSdkOptions`

| 字段 | 说明 |
| --- | --- |
| `getAccessCredential` | **必填**。返回短期访问凭证（同步或 Promise），由 Transport 写入请求。 |
| `apiBaseUrl` | 可选，Agent Server API 根路径。 |
| `presentation` | `floating`（默认） \| `drawer` \| `inline`；`inline` 始终展开且无悬浮按钮。 |
| `container` | `createAssistant` 挂载目标：`HTMLElement` 或 CSS 选择器。 |
| `getContext` / `initialContext` | 宿主业务上下文（`RawHostContext`）；Surface 挂载后会尝试 `getContext` 并 `updateContext`。 |
| `initiallyOpen` | 非 `inline` 时是否默认打开面板。 |
| `title` | 面板无障碍名称与 Chat 标题。 |
| `layout` | 传给 `ChatWorkspace`：`default` \| `panel`。 |
| `theme` | Ant Design `colorPrimary` 与 `--assistant-brand`。 |

## 展示形态

三种 `presentation` 共用同一 `AssistantController`、`AssistantApiTransport` 与 `ChatWorkspace`：

- **floating**：右下角 launcher + 固定位置面板（`assistant-sdk-panel--floating`）。
- **drawer**：右侧抽屉面板（`assistant-sdk-panel--drawer`）。
- **inline**：页面内嵌，无 open/close 壳层逻辑（适合 demo 分栏或 iframe 全屏聊天）。

## 接入示例

**React（推荐，可复用 Controller）** — `demo/sdk-host/src/main.tsx`：

```tsx
import "antd/dist/reset.css";
import "@assistant/assistant-ui/styles.css"; // 或开发时指向 workspace 源码样式
import "@assistant/assistant-sdk/styles.css";

const controller = new AssistantController({
  presentation: "inline",
  layout: "panel",
  getAccessCredential: () => credential,
  initialContext: hostContext,
});

<AssistantProvider controller={controller}>
  <AssistantSurface />
</AssistantProvider>;
```

**命令式（无 React 根组件的宿主）**：

```ts
import "@assistant/assistant-sdk/styles.css";

const assistant = createAssistant({
  presentation: "floating",
  getAccessCredential: () => fetchToken(),
  getContext: () => ({ page: { route: location.pathname } }),
});
assistant.mount();
assistant.open();
```

**iframe 内嵌页** — `apps/assistant-embed` 在票据兑换后使用 `AssistantReact` + `inline` + `layout: "panel"`；跨 Origin 宿主与 Context 同步由 `@assistant/iframe-bridge` 与 Loader 负责，不在本包内实现。

## 边界（本包不做的事）

- 不实现 embed Ticket、iframe Bridge 或 `postMessage` 协议（见 `iframe-bridge`、`assistant-embed`）。
- 不包含独立 Web 管理壳（模型、插件后台等见 `assistant-web`）。
- 不信任前端 Context 中的权限字段；凭证与 Capability 执行鉴权在 Agent Server 与业务 API。

## 验证

```bash
pnpm --filter @assistant/assistant-sdk build
pnpm --filter @assistant/assistant-sdk typecheck
```

联调：`pnpm dev:sdk-host` 或 `pnpm --filter @assistant/demo-host dev`（需本地 Agent Server）。本包 `package.json` 未配置独立 `test` script；相关单测若在仓库其他包中维护，以根目录 `pnpm test` 为准。
