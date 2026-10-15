# Product A / Product B 双产品演示指南

演示工程统一位于仓库根目录 `demo/`；正式的 Core、Agent Server、SDK、UI 和插件运行时不包含产品演示页面或 Fake Model 启动入口。

## 演示目标

用两个外观、业务术语和原始 Adapter 不同的产品，说明同一个企业助手如何通过标准 Capability、服务端权限、页面 ContextSnapshot 和 Evidence 接入业务系统。

本演示使用 Mock Identity、离线 Fake Model 和模拟业务数据，不调用真实 DeepSeek 或企业 API。它验证的是接入方式和工程闭环，不代表生产数据已经联通。

## 一键启动

在仓库根目录执行：

```bash
pnpm demo
```

启动完成后打开：

- Product A 数据质量运营台：<http://127.0.0.1:5411>
- Product B 数据资产驾驶舱：<http://127.0.0.1:5412>

按 `Ctrl+C` 停止四个演示进程。端口对应关系：A Web `5411`、A Agent Server `3411`、B Web `5412`、B Agent Server `3412`。

启动器包含父进程与心跳监控；在 Windows 上即使启动器异常退出，四个子服务也会自动清理，避免演示结束后继续占用端口。

## 推荐演示流程

1. 先打开 Product A，指出页面右上角的“助手当前感知”和右侧嵌入式助手。
2. 在“订单明细表”上下文输入“当前数据质量怎么样？”。说明助手调用的是 `data_quality.get_trend@1.0.0`，结果来自 Product A Adapter。
3. 展示 96% 结果、Partial/缺失日期限制、质量趋势卡片和 Evidence；强调模型文本不是授权依据。
4. 切换到“客户主数据表”，观察助手输入框和当前对象随下一次请求更新，已有 Run 的 Snapshot 不变化。
5. 打开 Product B，重复订单资产查询。指出 Product B 原始分数字段为比例 `0.96`，经其 Adapter 映射后仍得到标准 `96 percent`。
6. 对比两个页面：Agent Server、SDK、Chat Core 和 Capability Contract 相同；品牌页面、插件、原始字段、进程、会话与 Checkpointer 独立。

## 自动化验收

```bash
pnpm demo:e2e
```

浏览器测试分别验证：

- A/B 业务页面可以加载并显示各自品牌；
- Shared Assistant SDK 已嵌入页面；
- 当前页面对象进入助手 Context；
- Tool 调用返回插件对应结果及可信依据；
- 宿主从订单切换到客户对象后，下一次助手上下文同步更新。

## 演示边界

- 页面指标和业务活动属于明确标识的演示数据。
- Bearer Token 是本地 Mock Identity 的固定测试凭证，不是生产鉴权方案。
- Fake Model 的演示问答按“订单 → 客户”顺序准备；自由问答和真实自然语言推理需要配置 DeepSeek。
- Session/Event/Audit 和 LangGraph `MemorySaver` 仍在内存中，重启后不会恢复。
- 生产接入必须替换企业 IdP、真实业务 API、持久化 Store/Checkpointer、密钥管理、TLS/CSP 与指标告警。
