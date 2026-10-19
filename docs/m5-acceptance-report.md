# M5 独立部署与系统验收报告

日期：2026-10-15

## 1. 任务完成情况

| 任务                        | 状态              | 结果                                                                                                                  |
| --------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| M5-T01 A/B 独立部署         | 完成              | 同一代码分别批准 `demo-product-a`、`demo-product-b`，实例 Store、MemorySaver、插件状态与会话隔离；提供独立配置样例    |
| M5-T02 多产品能力一致性     | 完成              | 两个 Adapter 暴露相同 Capability；标准质量趋势、对象搜索、Partial/缺失日期与 Evidence 语义通过系统测试                |
| M5-T03 安全与可信结果验收   | 完成（Mock 边界） | 双产品对象拒绝、跨实例/跨用户会话拒绝、Context 归一化、Evidence 二次鉴权及范围/方法/来源已验证                        |
| M5-T04 前端、异常与可观测性 | 完成（本地验收）  | M3/M4 独立 Web、React/JS/iframe E2E 保持通过；取消、标准错误、Provider 超时、插件失败记录与重启边界有自动化或明确记录 |
| M5-T05 质量门禁与交付       | 完成              | 提供部署、插件接入、升级/回滚和可观测性说明；全量命令结果记录于本报告                                                 |

## 2. 独立部署拓扑

- Product A：`deployments/product-a/.env.example`，只批准 `demo-product-a`，默认端口 3101。
- Product B：`deployments/product-b/.env.example`，只批准 `demo-product-b`，默认端口 3102。
- 两者复用 `apps/agent-server/src/server-main.ts`、标准契约、Tool Factory、Shared Chat Core 和 SDK；Agent 与 Tool Factory 中没有 A/B 分支。
- 每个进程创建自己的 `InMemoryAgentStore` 与官方 LangGraph `MemorySaver`。系统测试证明 A 创建的 Session 在 B 中返回 404。
- 配置样例不包含真实密钥。生产必须由各实例分别注入模型/业务凭证，并使用独立持久化 Repository 和 Checkpointer；当前内存实现的重启不恢复已被测试固定，不被误报为生产能力。

## 3. 能力、权限、Context 与 Evidence

- A/B 都注册 `data_map.search_objects@1.0.0` 与 `data_quality.get_trend@1.0.0`。
- Product A 的分数原值为 `96`，Product B 原值为 `0.96`；两者标准输出均为 `96 percent`、`daily`。跨两天查询只返回真实的一天并标记 `partial`、`MISSING_DATES`，没有补造数据点。
- 两个 Adapter 都在原业务边界再次校验 `authorizationRef` 和对象范围；平台 Policy 在 Provider 前校验 Scope。未授权对象返回 `FORBIDDEN`。
- 浏览器提交的用户和权限字段不会进入可信 Context；每个 Run 引用固定 Snapshot。Evidence 包含来源、采集时间、数据范围、方法和引用 ID，解析时按当前主体/租户/对象再次鉴权。
- Schema 拒绝额外输入字段；不符合标准输出的 Provider 结果转换为 `SCHEMA_MISMATCH`，避免 PII/未声明字段透传。
- Catalog 已知但部署没有 Provider 时返回不可重试 `UNSUPPORTED`；上游临时失败仍保留 `PROVIDER_UNAVAILABLE`/`UPSTREAM_*` 语义。

## 4. 异常、恢复与可观测性

- 已验证 Run 取消、并发 Run 冲突、SSE 游标重放、Subagent 生命周期、标准无堆栈错误和限流。
- `HttpCapabilityDriver` 强制批准 Origin、手动重定向、1 MiB 响应上限和 5 秒默认超时；新增超时中止测试。
- Plugin Runtime 记录发现、校验、初始化、ready/degraded/failed 事件与安全错误码；Capability Audit 记录主体、能力、结果和 Evidence 引用。
- 当前尚无生产指标后端、Tracing 导出或告警平台。上线至少接入 Run/Tool 耗时、模型与 Provider 错误率、超时、SSE 重连、插件启动失败、授权拒绝和 Evidence 解析拒绝，并禁止记录密钥、完整 Prompt、原始业务响应和 PII。
- 重启策略验证结果：内存 Session/事件与 `MemorySaver` 状态不会恢复。生产必须替换为持久化 Repository 和官方持久化 Checkpointer，并演练恢复；这是上线阻断项，不是本地 M5 工程门禁的伪通过项。

## 5. 测试和性能记录

| 命令                                         | 结果                                               | 本机墙钟时间               |
| -------------------------------------------- | -------------------------------------------------- | -------------------------- |
| `pnpm lint`                                  | 通过，0 warning / 0 error                          | 约 21.0 秒                 |
| `pnpm typecheck`                             | 通过；包含全工作区预构建及 19 个工作区项目类型检查 | 约 31.7 秒                 |
| `pnpm test`                                  | 通过；27 个 Vitest 文件、75 个测试，无失败         | 约 35.6 秒                 |
| `pnpm build`                                 | 通过；19 个工作区项目构建成功                      | 约 17.8 秒                 |
| `pnpm format:check`                          | 通过                                               | 约 3 秒                    |
| `pnpm --filter @assistant/assistant-web e2e` | 3/3 Chromium 用例通过                              | 9.4 秒（Playwright 报告）  |
| `pnpm --filter @assistant/demo-host e2e`     | 3/3 Chromium 用例通过                              | 11.6 秒（Playwright 报告） |

新增/重点验收覆盖：A/B 独立启动和 Session 隔离、相同能力集合、标准结果等价、Partial/缺失日期、Evidence 范围/方法/来源、双 Adapter 对象拒绝、Context 固定、未安装 Provider 的 `UNSUPPORTED`、HTTP Provider 超时和内存重启边界。

测试全部使用离线 Fake Model、Mock Identity 和模拟 Product A/B API；本阶段没有调用真实 DeepSeek、企业 IdP 或真实业务 API。Vitest 的 jsdom 输出两条 `getComputedStyle` 伪元素“Not implemented”提示，但相关 UI 测试全部通过；构建还报告三个前端入口单包约 1.2 MB 的 chunk 告警，属于已知性能风险，不影响本阶段退出门禁。

## 6. 架构一致性与偏差

- 遵守 ADR-005/006：同一代码、独立部署，Agent 只看到标准 Capability。
- 遵守 ADR-007/008/009：权限在服务端与 Adapter 执行，Context 固定 Snapshot，结果携带 Evidence/Scope/Methodology/Partial。
- 遵守 ADR-010/017/018/019：独立 Web 与三种嵌入方式复用 Chat Core，浏览器只消费版本化 REST/SSE，一次性 iframe 票据和提交时 Context 捕获不变。
- 新增 ADR-020，澄清未安装 Provider 的 `UNSUPPORTED` 语义。
- 没有插件市场、热加载、跨实例路由或自研 Agent Loop；没有恢复用户已删除的 CI workflow。

## 7. 结论与生产阻断项

M5 的工程实现和离线退出门禁可通过，项目已完成 V2.0 M0–M5 的本地可复现闭环。以下事项仍阻止直接宣称生产上线：企业 IdP/委派 Token、真实 A/B 业务 API 和行列脱敏、独立持久化 Store/Checkpointer、生产密钥管理、TLS/CSP/Origin 白名单、指标告警与灾备恢复演练。它们需要真实部署环境与外部系统配合，不能用 Mock 冒充完成。
