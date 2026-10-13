# AI Assistant 技术架构基线 V1.0 · 文档导航

> 状态：**设计基线，尚未实现**  
> 编写日期：2026-10-13  
> 面向读者：产品负责人、架构师、前后端工程师、Codex 自动化开发代理  
> 主路线：**TypeScript + Deep Agents + Plugin-based Capability + React / Ant Design X**  
> 实际项目包名、依赖版本须在 M0 验证后锁定。

## 一、如何使用这套文档

这是一份**可用于实施**的多文件技术设计，而不是已可运行的代码仓库。建议先阅读架构与契约，再让 Codex 按 M0→M5 顺序生成代码。每个阶段有范围、待开发文件、测试、验收、退出条件。**不要跳过依赖阶段，也不要未经同意扩大范围**。

1. 先读本文件、`01-架构基线与边界.md`、`02-需求追踪矩阵.md` 和 `AGENTS.md`。
2. 按顺序读 `03`～`09` 的设计规范；这些是 Codex 编码时必须遵守的公共边界。
3. 每次只把一个 `M*` 阶段文件作为当前执行任务，先检查现有代码与锁定依赖，再实施、测试、更新阶段报告。
4. 执行提示词参考 `17-Codex执行手册.md`；每个阶段完成后让 Codex 提供“变更清单、测试结果、遗留问题”。
5. `18-架构决策记录.md` 记录已确认决策、候选实现与待验证项；不要将待验证内容伪装为框架已支持。

## 二、文档索引

| 文件 | 职责 | 使用时机 |
|---|---|---|
| `00-README.md` | 总索引、阅读路径与快速使用 | 首先阅读 |
| `01-架构基线与边界.md` | 架构目标、总体分层、部署原则、职责边界 | 全阶段 |
| `02-需求追踪矩阵.md` | 原始 17 条业务需求的逐项映射与验收策略 | 需求变更/验收 |
| `03-工程结构与依赖规则.md` | pnpm Monorepo、代码结构、包依赖、配置与部署 | M0 起 |
| `04-核心领域契约与上下文.md` | Context/Capability/Policy/Evidence/Result 契约 | M1/M2 |
| `05-插件系统与能力注册.md` | Manifest、插件生命周期、Local/HTTP/MCP、自动挂载 | M1 |
| `06-DeepAgents运行时设计.md` | Agent Factory、Runner、Tool、Skills、Subagents、Checkpoint | M0/M2 |
| `07-前端与SDK设计.md` | React、Ant Design X、双模式、React/JS/iframe SDK | M3/M4 |
| `08-安全权限证据与审计.md` | 多层认证授权、插件可信性、证据溯源、威胁模型 | 全阶段 |
| `09-API数据模型与事件协议.md` | HTTP API、数据库建议、状态机、SSE 事件协议 | M2/M3 |
| `10-M0-工程初始化与框架验证.md` | 锁定 Deep Agents SDK，完成最小 Harness POC | 第 1 个开发阶段 |
| `11-M1-插件自动挂载POC.md` | Plugin SDK/Loader/Registry、双适配器验证 | 第 2 个开发阶段 |
| `12-M2-Agent服务与会话闭环.md` | 认证、Session/Run、能力授权、持久化和 SSE | 第 3 个开发阶段 |
| `13-M3-React独立Web与共享聊天.md` | Chat Core + 独立 Web 管理模式 | 第 4 个开发阶段 |
| `14-M4-嵌入助手与三类SDK.md` | React SDK、JS SDK、iframe、Context Bridge | 第 5 个开发阶段 |
| `15-M5-独立部署与系统验收.md` | A/B 两套独立部署、端到端测试、交付核查 | 第 6 个开发阶段 |
| `16-测试体系与质量门禁.md` | 单元/契约/集成/安全/E2E/性能测试标准 | 全阶段 |
| `17-Codex执行手册.md` | Codex 阶段指令、提交规范、失败处理模板 | 执行每个阶段 |
| `18-架构决策记录.md` | ADR、已确定/未确定/暂缓范围 | 全阶段 |
| `19-原始需求全文.md` | 用户上传的 17 条功能要点全文 | 需求回溯 |
| `20-业务领域扩展路线图.md` | 数据服务/标准/血缘/工单等后续迭代 | MVP 后 |
| `CODEX-START-HERE.md` | 可直接复制的 Codex M0 启动提示词 | 开始开发 |
| `AGENTS.md` | Codex 在此工程工作的常驻规则 | 放在仓库根目录 |

## 三、不可更改的业务前提

- **一套代码，多产品独立部署**。A/B/C 部署各自管理用户、会话、模型配置、凭证和业务 API；不做跨产品会话迁移、联合搜索或动态产品识别。
- Agent **只理解标准 Capability**，不应在主提示词、核心 Tool 或 UI 中判断 A/B/C 产品。
- 部署时扫描**当前实例已安装的可信插件**，自动发现并注册其能力；不需要 `PRODUCT_ADAPTER=...` 人工分流。
- Plugins 执行业务适配，Skills 提供知识/流程规范，Subagents 承担专业任务；**三者不是一回事**。
- Deep Agents 是真实 npm 依赖，不 Fork、不复制 Agent Loop、不重复造 LangGraph Runtime。
- 前端 React + Ant Design + Ant Design X；助手模式（React/JS/iframe）与独立 Web 模式共享 Chat Core/Transport。
- 权限、脱敏、审计、证据引用必须在服务端落实；模型提示词不构成安全边界。
- 原始需求要求以**查询/分析/推荐/草稿**为主；高风险写操作、流程发布、自动删除均不属于首版默认能力。

## 四、V1.0 实施范围与技术风险

**V1.0 MVP：** M0—M5 构成最小可交付演示与基础平台。首次端到端业务仅选数据地图查询 + 数据质量趋势分析。完整 17 条需求是最终覆盖范围，**不是要求 MVP 全部完成**。

**首版支持：** Local / HTTP 插件驱动；MCP 放在后续扩展；插件启动时装载而非热加载；至少两个 API 结构不同的模拟插件完成独立部署验证。

**必须先验证：** 当前选定版本的 `deepagents` TypeScript 公共参数（尤其 `skills`、`subagents`、`backend`、`checkpointer`、`stream`、`contextSchema`）、Node/React 依赖兼容、流式事件实际结构和 Ant Design X 组件 API。以安装的包的类型定义、锁文件及真实测试为准。

## 五、外部依据（2026-10-13 核对）

- [Deep Agents TypeScript Overview](https://docs.langchain.com/oss/javascript/deepagents/overview)
- [Customize Deep Agents](https://docs.langchain.com/oss/javascript/deepagents/customization)
- [Deep Agents Skills](https://docs.langchain.com/oss/javascript/deepagents/skills)
- [Deep Agents Subagents](https://docs.langchain.com/oss/javascript/deepagents/subagents)
- [Deep Agents Streaming](https://docs.langchain.com/oss/javascript/deepagents/streaming)
- [Deep Agents GitHub（TypeScript）](https://github.com/langchain-ai/deepagentsjs)
- [Ant Design X 官方站点](https://x.ant.design/)
- [LangChain 官方 TypeScript Deep Agent Template](https://github.com/langchain-ai/deep-agent-template-js)

本文档中标记为**平台自定义设计**的 API 和类型（例如 `definePlugin()`、`CapabilityRegistry`、`AssistantTransport`）不是以上开源项目已经提供的 API。不得未经实现就直接导入使用。
