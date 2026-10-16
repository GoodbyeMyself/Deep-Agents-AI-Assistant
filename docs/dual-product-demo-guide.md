# Product A / Product B 双产品演示指南

演示工程统一位于仓库根目录 `demo/`；正式的 Core、Agent Server、SDK、UI 和插件运行时不包含产品演示页面或 Fake Model 启动入口。

## 演示目标

用两个宿主框架、外观、业务术语和原始 Adapter 不同的产品，说明同一个企业助手如何通过标准 Capability、服务端权限、页面 ContextSnapshot 和 Evidence 接入业务系统。Product A 使用 React + Ant Design，Product B 使用 Vue 3 + Element Plus + Vite；iframe 内仍是同一套 React/Ant Design X Assistant。

本演示使用 Mock Identity 和模拟业务数据，但模型调用强制使用根目录 `.env` 中配置的真实 DeepSeek。缺少 `DEEPSEEK_API_KEY` 时 Agent Server 明确启动失败，不回退到离线模型。真实模型已接通不代表真实企业 API 或生产身份已经联通。

## 一键启动

在仓库根目录执行：

```bash
pnpm demo
```

启动完成后打开：

- Product A 数据质量运营台：<http://127.0.0.1:5411>
- Product B 数据资产驾驶舱：<http://127.0.0.1:5412>

按 `Ctrl+C` 停止六个演示进程。端口对应关系：A Web `5411`、A Agent Server `3411`、A iframe Assistant `5511`；B Web `5412`、B Agent Server `3412`、B iframe Assistant `5512`。

启动器包含父进程与心跳监控；在 Windows 上即使启动器异常退出，六个子服务也会自动清理，避免演示结束后继续占用端口。

页面左下角及顶部只读取服务端安全模型元数据，显示 `LIVE DEEPSEEK` 和模型名；API Key 不会返回浏览器。A/B 宿主通过一次性票据、固定 Origin 和 channelId 与各自的跨 Origin iframe 建立短期会话，长期凭证不会进入 iframe URL 或 `postMessage`。

## 推荐演示流程

1. 先打开 Product A，指出“当前治理对象”下方的上下文同步条和右侧 iframe 助手；助手头部与消息输入区固定，中间对话区滚动。
2. 在“订单明细表”上下文输入“当前数据质量怎么样？”。说明助手调用的是 `data_quality.get_trend@1.0.0`，结果来自 Product A Adapter。
3. 展示 96% 结果、Partial/缺失日期限制、质量趋势卡片和 Evidence；强调模型文本不是授权依据。
4. 切换到“客户主数据表”，观察助手输入框和当前对象随下一次请求更新，已有 Run 的 Snapshot 不变化。
5. 打开 Product B，重复订单资产查询。指出 Product B 原始分数字段为比例 `0.96`，经其 Adapter 映射后仍得到标准 `96 percent`。
6. 对比两个页面：A 是 React/Ant Design 治理控制台，B 是 Vue/Element Plus 资产运营驾驶舱；Agent Server、iframe Assistant、SDK、Chat Core 和 Capability Contract 相同，品牌页面、插件、原始字段、进程、会话与 Checkpointer 独立。

## 自动化验收

```bash
pnpm demo:e2e
```

浏览器测试分别验证：

- A/B 业务页面可以加载并显示各自品牌；
- Shared Assistant SDK 已通过跨 Origin iframe 嵌入页面；
- 一次性票据成功交换短期凭证，Host Context 通过受校验 Bridge 更新；
- 当前页面对象进入助手 Context；
- Tool 调用返回插件对应结果及可信依据；
- 宿主从订单切换到客户对象后，下一次助手上下文同步更新。

## 演示边界

- 页面指标和业务活动属于明确标识的演示数据。
- Bearer Token 是本地 Mock Identity 的固定测试凭证，不是生产鉴权方案。
- 交互式演示只允许真实 DeepSeek 自然语言回答和 Tool Calling；测试套件中的固定 Test Double 不对用户开放。
- Session/Event/Audit 和 LangGraph `MemorySaver` 仍在内存中，重启后不会恢复。
- 生产接入必须替换企业 IdP、真实业务 API、持久化 Store/Checkpointer、密钥管理、TLS/CSP 与指标告警。
