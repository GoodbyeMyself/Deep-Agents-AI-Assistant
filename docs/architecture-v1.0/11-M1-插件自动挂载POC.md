# M1 · 插件自动发现、标准能力契约与 Tool 装配 POC

> 依赖：M0 验收通过并锁定 SDK。  
> 允许改动：`packages/plugin-sdk`、`packages/plugin-runtime`、`core/capability`、`core/result`（最小）、`adapters/demo-product-*`、`packages/agent-runtime` Tool Factory 适配、`tests/`。  
> 本阶段最大成功指标：**换插件而不改 Agent 代码**。

## 1. 目标

开发 `plugin.json` + `definePlugin()`/`implementCapability()` + Loader + Plugin Registry + Capability Catalog/Registry + Dispatcher + Tool Factory；两个业务 API 返回格式完全不同的模拟产品插件能够在**各自独立环境**注册并执行相同标准能力。

V1 范围：受信任 Local 插件 + 简单 HTTP Driver；MCP/插件商店/热加载不做。

## 2. 工作包

### M1-T01：Catalog 与标准 Schema

- 定义 `data_map.search_objects@1.0.0` 和 `data_quality.get_trend@1.0.0` Zod 输入输出标准；版本与固定测试向量。
- 定义 `CapabilityResult<T>`、`CapabilityErrorCode`、`CapabilityBinding` 及 `CapabilityContract`。
- 定义错误情况：不存在、权限拒绝、数据缺失、单位不兼容、Schema 不合格、超时。

### M1-T02：Plugin SDK

- 实现 Manifest Zod Schema、`definePlugin()`、`implementCapability()`、PluginFactory/PluginHostServices 类型。
- 插件注册时静态/运行时检查声明的 ID/contractVersion 与 Catalog 一致。
- 不允许 Plugin SDK 导入 `deepagents` 或业务产品实现代码。

### M1-T03：Plugin Loader

- 扫描受信任目录，仅加载白名单/审批通过的 `dist/index.js` 等构建产物；验证 entry 在插件根目录内；限制 symlink/path traversal。
- 状态记录：discovered/validated/ready/degraded/failed、初始化与 dispose；重复插件/能力、版本不兼容强制报错。
- 启动失败日志不得包含密钥；必需插件失败阻断启动、可选插件失败安全降级。

### M1-T04：Registry / Dispatcher / Tool Factory

- Capability Registry 支持 List/Resolve/Register，但**不负责模型推理**。
- Dispatcher 隔离 Local/HTTP 驱动；执行器统一校验输入、输出 Schema；M1 可以使用 stub policy，但必须有注入接口，为 M2 真正授权保留位置。
- Tool Factory 按稳定名称转换 `Capability` → 官方 LangChain `tool()`，运行时上下文来自 M0 验证的可信机制。
- Agent Factory 使用 Registry 可用能力创建 Deep Agent，无 `if(product A/B)` 判断。

### M1-T05：两个模拟插件与独立安装测试

```text
adapters/demo-product-a/  raw={tableCode, qualityScore, statDate}
adapters/demo-product-b/  raw={assetId, qualityRate, observedOn}
```

两个插件分别转换为统一 `QualityTrendData`，使用相同 Query Schema；创建测试 fixture 模拟各自 API。利用不同的插件安装目录进行两次独立启动，**不是在一个实例中依次动态切换产品**。

### M1-T06：HTTP Driver

- 配置允许的 API BaseURL、HTTPS/TLS 与认证引用、超时与错误映射。
- 不强制改造原 Java API；允许受控本地包装把原 API 映射为标准 HTTP Capability 协议。
- 模拟超时、非法 JSON、错误状态、缺失字段及部分结果。

## 3. 数据质量测试向量

- 正常：A/B 用同一等价七天序列返回 `points[]`，输出一致。
- 口径冲突：B 返回按月质量评分；**不能变成伪造的每日数据**，需 `UNSUPPORTED` 或 `partial`。
- 缺失：部分日期缺数据，`missingDates` 与 warning 完整。
- 越权：Stub 拒绝非法对象的查询；M2 替换真实业务授权。
- 非法：插件输出超过 [0,100] 的指标，Schema 拒绝，不返回给 Agent 作有效事实。

## 4. 验收

- 添加一个有效插件并重启，能自动出现在 Registry/Tool 清单；无代码硬编码产品 ID。
- 替换 A 插件安装包为 B 插件，构建出的 LangChain Tool 名称、描述、输入契约保持一致。
- 插件冲突、目录逃逸、版本不兼容、不可信模块不执行。
- 有完整的 `test:contract`，覆盖输入输出、错误和 Manifest。
- `agent-runtime` 不 import `adapters/demo-product-a` 或 B。
- 提供 `docs/plugin-development.md` 开发新插件步骤以及示例。

## 5. 阶段结束 Codex 指令

> 先阅读 04、05、06、08、11、16 和 AGENTS.md。遵守 M0 的 Deep Agents 兼容性记录，实现 M1-T01~T06，至少用 A/B 两个插件分别启动并证明 Agent Factory 不修改。添加插件路径安全、Schema、冲突、HTTP 异常与执行器测试。不要开发 UI，也不要把所有业务权限依赖模型或 stub 当作最终实现；M2 的授权接口须留清楚 TODO。报告是否真正调用插件的可核验证据，完成后停止。
