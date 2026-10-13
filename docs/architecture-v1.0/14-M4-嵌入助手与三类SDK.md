# M4 · 助手模式、React SDK、JS SDK 与 iframe Bridge

> 依赖：M3 `ChatWorkspace` + Transport 已稳定。  
> 允许改动：`apps/assistant-embed`、`apps/demo-host`、`packages/assistant-sdk`、`packages/iframe-bridge`、`packages/assistant-ui` Shell 相关代码、SDK 文档与 E2E。

## 1. 成功目标

在 React、非 React 和 iframe 三种宿主环境接入**同一套**助手，支持 Floating/Drawer/Inline、当前页面与对象上下文、双向容器控制、独立会话和响应式布局，且不对宿主页面产生样式/全局事件污染。

注意：宿主可以是产品 A/B/C，但**每套部署只访问其自身 Agent Server**，不做跨部署会话迁移。

## 2. 工作包

### M4-T01：Shared Assistant Shell

- 创建 `AssistantShell`，负责 floating trigger、Drawer/Inline 容器、展开收起、Resize 与销毁。
- 只复用 `ChatWorkspace`；不得新写一套消息管理 Store。
- 模式切换不改变 Transport 协议；宿主插入目标容器需可定制。

### M4-T02：React SDK

- 提供 `AssistantProvider`、`AssistantWidget`、`useAssistant`（名称以最终设计为准）。
- 提供 `getContext`、`getAccessCredential`、`theme`、`onReady/onError` 等接口。
- 处理容器卸载、事件清理、AccessCredential 失效和 Context 更新。

### M4-T03：Vanilla JS SDK

- 提供 `createAssistant(opts)`、`mount/open/close/toggle/updateContext/destroy`。
- 通过独立挂载点渲染复用 React UI；非 React 宿主无需安装 React 开发依赖（SDK 可自带运行时构建但须控制体积和兼容）。
- 默认验证 Shadow DOM + Ant Design Portal 容器兼容；出现不兼容可采用隔离 CSS/iframe fallback，但需记录原因和测试。

### M4-T04：iframe Bridge

- Host SDK 创建 iframe，基于消息协议握手；iframe 页面来自当前部署的允许域名。
- 消息 `{protocol,version,channelId,requestId?,type,payload}`；核验 `origin/source/schema/channel`，目标 origin 精确指定。
- 设计服务器生成的短期一次性 embed ticket 与 iframe 的后端兑换流程；URL 中不得放长期 Bearer Token。
- CSP `frame-ancestors` 白名单；跨域认证、Cookie SameSite、CORS/CSRF 策略实测。
- `CONTEXT_UPDATE` 只能更新之后的 Run；当前 Run 固定快照。

### M4-T05：三类宿主演示

- `demo-host/react`：React 组件挂载、上下文切换、Tool Timeline。
- `demo-host/vanilla`：普通 HTML + JS SDK 挂载、打开/关闭/销毁。
- `demo-host/iframe`：跨域（至少通过不同开发 origin 模拟）双向消息与安全检查。

## 3. 核心接口验收

```ts
const assistant = createAssistant({
  apiBaseUrl: '/api/v1',
  presentation: 'drawer',
  getAccessCredential: async () => shortLivedCredential,
  getContext: () => ({page:{route:'/quality',type:'quality-detail'},object:{type:'data_table',rawId:'table-A'}}),
});
await assistant.mount();
assistant.open();
assistant.updateContext({object:{type:'data_table',rawId:'table-B'}});
assistant.destroy();
```

该例是**计划中的平台 SDK API**，M4 实施时需真正实现并在类型测试中验证。示例的 Credential 必须真实通过受信任服务端获得，不使用硬编码 Token。

## 4. 安全与边界测试

- 非白名单 Host 发送 iframe 消息被拒绝；`targetOrigin='*'` 不得出现。
- 另一浏览器用户复制 `sessionId` 访问事件返回拒绝。
- 宿主直接伪造 `permissions:['admin']` 不会提升权限。
- iframe 页面导航到异常来源时 Host 不接受消息。
- 多实例挂载互不影响；调用 destroy 后无悬挂消息监听/定时器。
- UI 的 Drawer/Modal/Tooltip/Select 均不溢出 Shadow DOM 或污染宿主 CSS。

## 5. 验收

- 三个 Demo 宿主都显示同一个 ChatWorkspace，并能与同一当前部署后端对话。
- 三种表现（floating/drawer/inline）按需求正常工作；独立 Web 管理菜单不被打包进入嵌入式 SDK。
- Host Context 更新后下一次请求能使用新对象，而正在执行的 Run 不漂移。
- 异常、跨域、超时、认证过期、重复挂载/卸载有明确可测试表现。

## 6. Codex 阶段指令

> 阅读 07、08、09、14、16 和 AGENTS.md，基于 M3 共享 Chat UI 实现助手 Shell、React SDK、Vanilla JS SDK 和 iframe Bridge。避免复制聊天逻辑；只用受信任接入凭证，不让 Host 自报权限生效。构造 React/Vanilla/iframe 三个 Demo，执行 origin/权限/上下文/样式隔离 E2E，提供 SDK 集成说明。完成后停止。
