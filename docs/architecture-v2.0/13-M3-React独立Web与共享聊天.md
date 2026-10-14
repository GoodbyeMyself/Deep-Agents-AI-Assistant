# M3 · React + Ant Design X Shared Chat Core 与独立 Web（V2.0）

> 依赖：M2 会话、SSE 与 Result/Evidence 协议稳定。核心是**复用、可信展示、少量必要管理**。

## 工作包

### M3-T01 Shared Chat Core

- React + TypeScript + Ant Design X / Ant Design，组件含 MessageList、ChatComposer、ExecutionTimeline、EvidencePanel、AssistantViewRenderer。
- `ChatWorkspace` 不依赖产品 A/B/C，不直接解析 Deep Agents 原生事件；统一消费 `assistant-transport` 的业务 SSE 协议。

### M3-T02 消息与结构化结果

- 文本和增量输出；工具进度展示的是可公开的调用摘要，不展示模型内部私有推理。
- 先支持 `text / metric / table / chart.line / references` 的可信渲染器；所有 ViewModel Zod 校验、HTML/Markdown 安全净化。
- Evidence 可展开对象、范围、统计口径、查询时间，点击再次鉴权。

### M3-T03 独立 Web Shell

- 基础工作区、聊天/会话、模型配置、插件与 Capability 状态查看；管理员能力和普通用户会话视图分开。
- 产品 A/B/C 不需要统一管理入口；当前实例仅管理自己的会话和模型。
- 业务对象选择器可在没有宿主页面时建立标准 Context。

### M3-T04 Transport 与会话

- 提交问题、关联 Run、SSE 去重和状态、取消执行、会话切换与历史恢复。
- 网络中断至少能通过服务端查询当前 Run 状态，不得伪造已完成。

### M3-T05 UI 测试

- mock SSE、运行失败、数据不足、越权、来源缺失等状态；多会话切换不串消息。
- 源数据字段经 Adapter 归一化后，A/B 在相同测试数据上展示同样 UI ViewModel。

## 退出条件

独立 Web 使用真实 Agent Server API 完成数据质量查询与可追溯结果展示。模型管理和插件界面仅实现 MVP 所需能力，不建立插件商店或多 Provider 高级策略。

## Codex 指令

```text
执行新版 M3-T01~T05；以 React + Ant Design X 构建共享 ChatWorkspace 和薄 Standalone Shell。
严格复用 09 的 SSE/Result/Evidence 协议，禁止直接暴露 Deep Agents 原生内部结构。
完成测试与可复现演示后停止，不提前开始 SDK/iframe 开发。
```
