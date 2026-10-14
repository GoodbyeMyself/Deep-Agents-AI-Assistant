# AI Assistant 企业业务智能体集成架构基线 V2.0

> **定位：企业业务智能体集成框架**（Enterprise AI Agent Integration Framework）  
> **状态：新设计基线，准备从 M0 重新实施；不依赖既有 M0 产物**  
> **日期：2026-10-13**  
> **核心价值：标准业务能力契约、原业务权限继承、页面上下文感知、可信结果与数据可追溯**  
> **重要约束：插件自动发现与挂载为 V1.0 MVP 的 P0 必备能力，不得删除或延期。**

## 1. 一句话目标

以官方 **Deep Agents TypeScript SDK** 为 Harness，为现有企业产品提供一套**可独立部署、易嵌入、业务能力标准化、权限受控**的 AI 智能助手。不同产品通过**安装符合契约的 Adapter 插件**接入，Agent 不需要知道产品 A/B/C。**不以复刻 OpenClaw 为目标**。

## 2. 谁先读什么

- 架构师/负责人：`01`、`02`、`03`、`18`。
- 业务插件研发：`04`、`05`、`08`、`16`。
- Agent 研发：`04`、`06`、`08`、`09`。
- Web 研发：`07`、`09`、`08`。
- Codex：仓库根目录 `AGENTS.md`、本文件、`01`～`03`、当前 Mx 对应文档，执行前查阅相关规范；从 `CODEX-START-HERE.md` 开始。

## 3. 文档索引

| 文件                              | 内容                                              | 类型     |
| --------------------------------- | ------------------------------------------------- | -------- |
| `00-README.md`                    | 导航、优先级、迁移说明                            | 入口     |
| `01-架构基线与边界.md`            | 产品定位、总体架构、非目标、核心决策              | 规范     |
| `02-需求追踪矩阵.md`              | 原始 17 项需求与 MVP/后续阶段映射                 | 规范     |
| `03-工程结构与依赖规则.md`        | Monorepo 结构与依赖方向                           | 规范     |
| `04-核心领域契约与上下文.md`      | Capability/Context/Policy/Evidence/Result         | 规范     |
| `05-插件系统与能力注册.md`        | SDK、Manifest、Loader、Registry、Tool Factory     | 核心规范 |
| `06-DeepAgents运行时设计.md`      | Agent Factory、Runner、Skills、Subagents、Backend | 支撑规范 |
| `07-前端与SDK设计.md`             | React + Ant Design X、双 Web 模式、三种 SDK       | 支撑规范 |
| `08-安全权限证据与审计.md`        | 授权强制执行、审计与证据可信                      | 核心规范 |
| `09-API数据模型与事件协议.md`     | Session/Run/Context HTTP 与 SSE                   | 支撑规范 |
| `10-M0-工程初始化与框架验证.md`   | **从头重新执行** Deep Agents 框架验证             | 阶段任务 |
| `11-M1-插件自动挂载POC.md`        | 必备自动挂载和双插件契约 POC                      | 阶段任务 |
| `12-M2-Agent服务与会话闭环.md`    | 身份、业务授权、证据、会话与 SSE                  | 阶段任务 |
| `13-M3-React独立Web与共享聊天.md` | Shared Chat、独立模式与基础管理                   | 阶段任务 |
| `14-M4-嵌入助手与三类SDK.md`      | 业务页面感知、React/JS/iframe                     | 阶段任务 |
| `15-M5-独立部署与系统验收.md`     | 两套独立部署和业务契约一致性验收                  | 阶段任务 |
| `16-测试体系与质量门禁.md`        | 自动测试、越权与适配一致性用例                    | 全阶段   |
| `17-Codex执行手册.md`             | 逐阶段指令、报告与基线变更规则                    | 开发入口 |
| `18-架构决策记录.md`              | ADR 与明确暂缓项                                  | 规范     |
| `19-原始需求全文.md`              | 用户原始 17 条需求                                | 需求来源 |
| `20-业务领域扩展路线图.md`        | 其余业务领域后续扩展                              | 后续规划 |
| `AGENTS.md`                       | Codex 常驻规则（复制至仓库根）                    | 开发入口 |
| `CODEX-START-HERE.md`             | 第一次重执行 M0 的提示词                          | 开发入口 |

## 4. 开发优先级与完成标志

### 核心不可妥协

1. **标准业务能力契约**：平台定义 `Capability Contract` 及版本，具体产品实现；不得同名不同义。
2. **业务权限继承**：模型不能自行决定授权；工具调用执行时调用原平台业务授权，敏感数据沿用原平台脱敏规则。
3. **页面上下文感知**：React/JS/iframe 对同一标准 Context 协议提供当前页面/对象；每次 Run 固定 ContextSnapshot，身份由服务端确认。
4. **可信结果**：来源、范围、统计时间、口径与数据不足状态与回答一起交付。
5. **启动自动挂载插件**：可信插件目录发现→校验→注册 Capability→Tool Factory→Deep Agents。

### 为实现上述价值服务，不建设 OpenClaw 式通用平台

复用 Deep Agents 的执行、Skills、Subagents、状态；实现薄 Agent Server、必要模型和会话配置、双 Web 模式；**不做**通用 IM 渠道、插件市场、未审核第三方代码热加载、跨产品会话迁移、全自动业务写入或复杂任务调度。

## 5. V2.0 对旧基线的变化

- **重新定位**：从泛化智能体平台，收敛为企业业务智能体集成框架。
- **保留插件**：自动发现、Capability 注册、Tool 装配依然是 V1.0 首版必须可演示的关键路径。
- **核心顺序调整**：契约一致性、权限继承、页面感知、证据追溯的优先级高于模型/插件后台高级管理功能。
- **M0 可重做**：本包不假设旧 M0 已完成，不要求迁移旧 M0 代码；Codex 在当前仓库工作时仍必须先核对现状、保护未授权修改的数据。
- **部署模式不变**：同一代码发行版，可安装不同 Adapter，A/B/C 各自独立部署、会话和存储互不互通。

## 6. 版本与参考资料

所有 API 的实际参数**以 M0 安装包类型定义、真实测试和版本锁为准**，不得把本文件的伪代码当作官方实现。参考：

- [Deep Agents TypeScript Overview](https://docs.langchain.com/oss/javascript/deepagents/overview)
- [Deep Agents Customization](https://docs.langchain.com/oss/javascript/deepagents/customization)
- [Deep Agents Skills](https://docs.langchain.com/oss/javascript/deepagents/skills)
- [Deep Agents Subagents](https://docs.langchain.com/oss/javascript/deepagents/subagents)
- [Deep Agents Streaming](https://docs.langchain.com/oss/javascript/deepagents/streaming)
- [Ant Design X](https://x.ant.design/)
