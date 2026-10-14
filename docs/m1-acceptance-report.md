# M1 开发与验收报告

- 日期：2026-10-14
- 基线：V2.0，M0 Exit Criteria 已通过
- 范围：M1-T01～M1-T06；未进入 M2

## 任务完成情况

| 任务                                 | 状态 | 完成证据                                                                       |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------ |
| M1-T01 标准能力目录                  | 完成 | 两项 `1.0.0` Zod 契约、标准 Result/Error/Evidence、范围与 partial 规则         |
| M1-T02 Plugin SDK                    | 完成 | 自研 `definePlugin()`、`implementCapability()`、Host Services 与强类型实现接口 |
| M1-T03 Manifest 与 Loader            | 完成 | Manifest V1、批准名单、路径/哈希校验、Local/HTTP、失败隔离和生命周期事件       |
| M1-T04 Registry、执行与 Tool Factory | 完成 | Catalog/Registry/Executor/Audit Hook 与 LangChain Tool 自动生成                |
| M1-T05 双插件、双部署模拟            | 完成 | A/B 独立安装根自动产生相同 Tool；原始字段不同、标准数据语义一致                |
| M1-T06 契约、安全和负面测试          | 完成 | 未批准、逃逸、冲突、版本、哈希、声明、权限、Schema 与未安装能力测试            |

## 工程实现清单

- `core/capability`：契约、Catalog、Capability Registry、Policy-aware Executor。
- `packages/plugin-sdk`：插件作者公共 API；不依赖 Deep Agents。
- `packages/plugin-runtime`：Manifest、受信任发现/动态加载、Local/HTTP Driver、Plugin Registry。
- `packages/agent-runtime`：从当前 Capability Registry 创建稳定 LangChain Tools。
- `adapters/demo-product-a`：映射 `qualityScore/statDate/tableCode` 等 Product A 字段。
- `adapters/demo-product-b`：映射 `qualityRate/date/assetId` 等 Product B 字段，并将比率转百分比。
- `tests/capability-contract-testkit`：A/B 共用的标准契约测试套件。
- `apps/agent-server/src/m1-bootstrap.ts`：唯一 Composition Root 的启动自动装配函数。

## 自动挂载与契约验证

Agent Server 启动时按以下顺序执行：

`discover → validate → load → initialize → register → verify → ready`

测试分别以 `adapters/demo-product-a`、`adapters/demo-product-b` 作为当前实例唯一安装根。
Loader 只 import `plugin.json` 指向且位于真实插件根内的 `dist/index.js`。两次独立启动均得到：

- `data_map_search_objects`
- `data_quality_get_trend`

同一 Agent Factory 使用官方 Deep Agents 执行动态 Tool，ToolMessage 中包含标准
`quality_score / percent / daily / value=96` 结果。没有 `if (product === ...)` 路由。

共享契约测试证明 A/B 的数据地图对象含义、质量分值、单位、聚合与缺失日期语义一致。
跨日查询只返回已有数据点，并以 `partial + MISSING_DATES` 明确缺口，不补造每日数据。

## 安全验证

- 未列入 `approvedPluginIds` 的模块在动态 import 前失败；副作用标记文件未产生。
- `../../` entry、符号链接 entry 和 realpath 越界均被拒绝。
- 记录 Local 构建产物 SHA-256；Manifest 声明 integrity 时必须匹配。
- 未知 Manifest/API/契约版本、声明与实现不一致、重复插件 ID 均失败关闭。
- 同一契约的第二 Provider 不覆盖第一个绑定；冲突插件失败隔离。
- Capability Executor 在调用 Provider 前执行输入和 permission scope 校验；拒绝有审计事件。
- Tool Schema 不包含 principal、permission、tenant 或 secret；这些来自服务端 Runtime Context。
- HTTP Driver 使用精确 Origin 白名单、禁止 URL 凭证、禁止非回环明文 HTTP、禁止自动重定向、
  设置超时和 1 MiB 响应上限。HTTP 测试未访问外网。

安全边界：Local 动态 import 是可信同进程代码，不是沙箱；本项目不支持运行时任意 JS 上传。

## 测试记录

最终阶段门禁：

- `pnpm install --force --no-frozen-lockfile`：Pass；按锁定版本修复一次被中止离线重建造成的
  本地 Zod 文件缺失，未升级已锁版本。
- `pnpm lint`：Pass，0 errors、0 warnings。
- `pnpm typecheck`：Pass，8 个有脚本的 workspace package 全部完成。
- `pnpm test`：Pass，12 个 test files、42 个 tests。
- `pnpm build`：Pass，8 个有构建脚本的 workspace package 全部完成。

测试中的模型响应使用 LangChain 官方 `fakeModel()`，但 Deep Agents 图、动态 Tool、Loader、
Adapter、Registry 和 Executor 均执行真实工程代码。A/B 上游数据为模拟值，不宣称真实产品接入。
M0 已另行完成 DeepSeek 真实模型 Tool Calling；M1 的离线 CI 不依赖模型 Key。

## 架构一致性与偏差

- 依赖方向符合 `core → plugin-sdk/runtime → adapters/composition root`；Adapter 不导入
  `deepagents`，Agent Runtime 不导入 A/B。
- 未实现热加载、插件市场、跨产品路由、MCP、Session/SSE 或真实业务身份委派。
- HTTP Driver 按 M1 要求实现简单协议，但只做受控本地测试，未连接真实 Java/HTTP 服务。
- 开发环境直接使用 Adapter 包根中的构建产物；生产复制/镜像安装流程留给部署阶段。
- 没有改变已接受 ADR，因此未修改 V2.0 架构基线文件。

## 剩余问题与 M2 准备情况

- M2 需把当前 scope policy 接到真实 Gateway 身份、原平台授权和对象/行列权限。
- Audit Hook 当前为接口与测试 Sink，尚未持久化。
- Evidence 当前是标准引用句柄，解析和再次授权尚未实现。
- HTTP Provider 的真实凭证委派、重试/幂等和上游错误映射需结合目标业务系统验证。
- 生产插件制品打包、批准清单和 integrity 注入需纳入部署流水线。

是否通过 M1 Exit Criteria：**YES**。安装根替换并重新启动后，Registry 与 Agent Tools 自动
变化；A/B 使用相同主 Agent 和 Tool Factory 通过共享契约，安全负例与权限拒绝均有自动化证据。
