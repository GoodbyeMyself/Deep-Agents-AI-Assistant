# Repository Codex Instructions — AI Assistant V1.0

## 1. 首先阅读

进入当前任务前必须读取：
- `docs/architecture-v1.0/00-README.md`
- `docs/architecture-v1.0/01-架构基线与边界.md`
- `docs/architecture-v1.0/18-架构决策记录.md`
- 当前阶段 `10-M0`~`15-M5` 之一，以及该文件明确指向的相关规范。

若实际复制的目录路径不同，应使用项目中实际位置；**不要猜测不存在的目录**。

## 2. 硬性架构约束

1. 直接依赖官方 `deepagents`，不重写 Agent Loop/LangGraph Runtime。
2. 每套产品独立部署，共用代码而不共享数据库、会话、模型配置、凭证或跨部署动态路由。
3. Plugin SDK/Runtime 自研；已批准插件启动自动发现/挂载；Agent 只调用标准 Capability。
4. `core/*` 不依赖具体 A/B/C 产品，不依赖前端；`adapters/*` 不导入 `deepagents`。
5. React + Ant Design X 一个 Chat Core；独立 Web 管理 Shell 与嵌入式助手 Shell 分离；React/JS/iframe 复用。
6. 权限、脱敏、Evidence、Audit 由服务端执行；不把模型提示词或浏览器上报视为授权。
7. 插件属于受信任代码；不能加载任意用户上传 JS 作为已批准插件。
8. 实际 SDK API 以**安装版本的官方源码/类型定义/测试**为准，不使用臆造的框架函数。

## 3. 本阶段工作规则

- 开始先检查 repo、Git status、现有实现与依赖；列简短计划后实施。
- 只实现用户明确指定的 **一个阶段**，按 T01... 顺序；未经明确要求不跳到下阶段。
- 先实现核心行为及测试，再补辅助文件；不生成大量无内容模块。
- 优先单元测试/契约测试证明能力，不可用注释/静态假数据假装实现。
- 若任务依赖真实模型/外部 API/DB 且不可用，使用 Mock 同时标注未真实验证。
- 确保 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`（若存在）通过。
- 不删除失败测试掩盖问题；不要破坏未明确要求修改的代码。
- 新增契约版本/安全策略/架构变更须更新 `docs/decisions.md` 和相关测试。

## 4. 安全与日志

不得在源码、日志、Fixture、屏幕截图、HTTP 响应中明文泄漏模型 API Key、业务永久 Token 或用户敏感数据。Tool 和 SSE 访问必须检查会话所属用户/租户。Plugin Loader 必须拒绝目录逃逸和未批准安装包。

## 5. 结束反馈格式

```text
阶段：Mx
已实现：任务 ID 与文件列表
测试：逐条列命令 + Pass/Fail/Not Run
真实验证与 Mock 验证区别：
未完成/风险/阻断：
与基线差异/ADR：
是否满足阶段退出条件：
```

完成后停止，不要自动开始下一阶段。
