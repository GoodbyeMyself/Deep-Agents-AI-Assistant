# M4 · 页面上下文感知与 React / JS / iframe 三种接入（V2.0）

> **本阶段最核心的业务差异化：当前页面、当前对象和授权上下文与 Agent 的准确绑定。**

## 工作包

### M4-T01 SDK 公共接口

- 定义 `mount/open/close/destroy/updateContext/getState`、`getContext()`、`getAccessCredential()`。
- 助手 UI 形态支持 floating/drawer/inline，默认复用 M3 的 `ChatWorkspace`。
- React SDK 组件/Hooks、Vanilla JS SDK 对外暴露统一行为；不得让业务方理解 Deep Agents。

### M4-T02 Host Context 协议

- 宿主上报 `page.route/title/type`、`object.type/id/name`、`business.domain/module` 等**原始业务上下文**。
- 原平台 Context Adapter 归一化；身份/权限从服务端可信会话获取，**不信任前端权限字段**。
- UI 当前页面改变可以更新后续提问上下文，但正在执行的 Run 固定旧快照。

### M4-T03 iframe Bridge

- Host SDK 和 iframe `postMessage` 双向协议，精确 `targetOrigin`、校验 `event.origin/event.source`、channelId、请求 ID 和版本。
- 短期一次性嵌入票据，不在 URL 或消息中发送原平台长期 Token。
- 校验 CSP `frame-ancestors`、`sandbox` 配置；对 Shadow DOM/Portal/跨域 cookie 限制写明测试结果。
- 默认提供声明式 `assistant-loader.js`：业务入口 HTML 配置 iframe URL 和 Ticket Endpoint，Loader 在 Shadow DOM 中统一管理悬浮按钮、固定窗口、iframe 生命周期与 Bridge；业务页面只负责提供业务 Context，不实现助手容器。

### M4-T04 兼容及测试

- 在 React 宿主、Vue/原生 JS 宿主、跨域 iframe 宿主运行同一业务操作。
- 模拟当前数据表从 X 切到 Y，Run1 查询仍指向 X、Run2 指向 Y；禁止上下文串写。
- 在不同 CSS 主题、页面复杂布局中验证样式隔离和抽屉层级。

## 退出条件

三种方式接入同一部署的 Agent Server，能把当前页面业务语义传入标准 Context，安全通信、权限继承与证据引用正常，前端聊天核心没有复制三份。

## Codex 指令

```text
只执行 M4-T01~T04；优先验证页面上下文实时更新与 Run 快照一致性。
React/JS/iframe 统一调用 Shared Chat Core + Assistant Transport；跨域 iframe 要校验来源与短期凭证。
提供三种宿主演示和安全负面测试，提交 M4 报告后停止。
```
