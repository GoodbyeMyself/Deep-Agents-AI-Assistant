# M1 · 插件自动发现、标准 Capability 契约与双 Adapter 验证（V2.0）

> **不可降级为 P1：这是新版架构必须完成的关键阶段。**  
> 依赖：M0 验收通过。规范：`04`、`05`、`08`、`16`。

## 阶段目标

通过“安装一个可信 Adapter 插件，Agent Server 重启自动发现并注册 Capability，随后 Deep Agents 能调用对应 Tool”的完整链路，验证业务能力扩展不修改主 Agent。实现两套字段和接口不同的模拟插件，输出同一个标准业务结果。

## 工作包

### M1-T01 标准能力目录

- 定义 `data_map.search_objects@1` 和 `data_quality.get_trend@1` 的输入输出 Zod Schema、数据范围、错误码和 `partial/insufficient` 语义。
- 能力契约的描述、版本由平台维护，不能由任意插件偷偷改成另一个含义。
- 建立契约共享测试包，确保两个 Provider 都通过同一测试集。

### M1-T02 Plugin SDK

- 实现 `definePlugin()`、`implementCapability()`、`PluginHostServices` 和插件入口接口。
- 自研 API 必须明确标注，不把它当作 Deep Agents 官方 API。
- 插件只依赖 Plugin SDK/Core 公共类型，不直接使用 `deepagents`。

### M1-T03 Manifest 与 Loader

- 约定 `plugin.json`、包 ID、协议版本、入口、Capability 声明和运行类型（Local 必须支持，HTTP 可在本阶段做受控 Adapter）。
- 扫描当前部署**已安装、已批准**插件目录；路径逃逸、重复插件、未知协议版本、声明实现不一致必须失败关闭。
- `discover → validate → load → initialize → register → verify → ready`；支持失败隔离和状态日志。
- **无需热加载**；安装目录重启自动生效。

### M1-T04 Registry、执行与 Tool Factory

- Capability Catalog 是定义；Registry 是当前可用实现绑定；Tool Factory 将授权范围的能力转换为 LangChain Tool。
- 工具实际执行走 `Capability Executor`，不能绕过输入输出校验、权限接口和审计钩子。
- 同契约同版本重复 Provider 默认冲突，不能靠后注册覆盖。

### M1-T05 双插件、双部署模拟

- `demo-product-a` 原始返回如 `qualityScore/statDate/tableCode`；`demo-product-b` 为 `qualityRate/date/assetId`。
- 两套 Adapter 返回相同 `QualityTrendResultV1`，业务含义和统计口径一致；不能编造缺失日数据。
- A/B 环境分别只安装对应插件；独立运行同一 Agent Factory/Tool Factory，无 `if (product === A)` 代码。

### M1-T06 契约、安全和负面测试

- 未批准模块不可加载、`../../` 路径无效、插件声明与实现不一致、未知契约版本、重复 Provider 均有测试。
- Tool 真的调用到插件的执行函数；不存在的能力不能被 Agent 自动幻想出来。
- 缺少权限调用时被拒绝；M2 再与实际身份/原平台集成。

## 阶段退出条件

安装/替换受信任插件并重启后，Capability Registry 自动变化、Agent Tools 自动变化；不修改主 Agent、AgentFactory 或 UI。双插件通过统一契约测试，并保留安全测试、日志和 M1 报告。

## 阶段 Codex 指令

```text
读取 AGENTS.md、04、05、08、11、16 和 M0 兼容性报告，
按 M1-T01~T06 实现插件 SDK/Loader/Registry/Tool Factory，
必须证明启动自动挂载及 A/B 两套独立安装能跑相同标准契约。
不做插件市场、热加载、跨产品路由，不扩大到 M2。执行测试、
输出文件变更和安全负面测试报告后停止。
```
