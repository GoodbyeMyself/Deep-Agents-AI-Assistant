# 独立部署、升级与回滚

`product-a` 与 `product-b` 使用同一构建产物，但各自在独立进程和独立配置中运行。每个实例只批准自己的插件 ID，并使用自己的插件安装目录、模型密钥注入、Session Repository 与 LangGraph Checkpointer。当前仓库的可运行服务器仍使用内存 Store/Checkpointer，因此只适合本地验收；生产部署必须注入独立的持久化实现后才具备重启恢复能力。

## 启动

1. 先执行 `pnpm install --frozen-lockfile`、`pnpm build` 和四项质量门禁。
2. 从对应目录复制 `.env.example` 到不受版本控制的密钥环境；填入该实例自己的 `DEEPSEEK_API_KEY`，不要复用业务系统长期 Token。
3. 将 `PLUGINS_DIR` 指向已审批、只读的插件发布目录，并核验 `plugin.json` 和入口文件哈希。
4. 在仓库根目录执行 `node --env-file=<实例环境文件> --import tsx apps/agent-server/src/m2-server-main.ts`。
5. 通过 `/api/v1/openapi.json`、管理员插件状态和一次受权能力调用完成启动探针。A/B 必须使用不同端口、密钥环境、存储和 Checkpointer 命名空间。

反向代理负责 TLS、请求体上限和生产 CSP。服务默认仅绑定 `127.0.0.1`；只有在受控网络和反向代理配置完成后才设置其他 `SERVER_HOST`。

## 插件接入

以 `adapters/demo-product-a` 或 `adapters/demo-product-b` 为样例：实现 `plugin-sdk` 的 `definePlugin`/`implementCapability`，只映射标准 Capability 输入输出；在 Adapter 和原业务 API 再次执行对象、行列和脱敏授权。构建后生成 manifest 完整性值，将插件放入实例安装目录并加入批准列表。Agent、Tool Factory 与 Shared Chat Core 不应增加产品名分支。

## 升级

1. 在隔离环境对新构建执行契约测试、安全测试、A/B 系统测试和浏览器 E2E。
2. 备份数据库并检查迁移的向前/回滚策略；先部署一个独立实例或金丝雀。
3. 停止接收新 Run，等待运行中 Run 进入终态，再替换应用和已审批插件产物。
4. 启动后核验插件状态、标准能力集合、模型版本、错误率、超时和 Evidence 解引用。

## 回滚

保留上一版本应用、插件产物、manifest 和数据库备份。发生契约、权限、Evidence 或错误率异常时停止新流量，恢复上一组经过校验的产物；数据库仅按已演练的向下迁移或备份恢复。不得只回滚 Adapter 而保留不兼容的契约版本。内存实现重启会丢失会话，不能作为生产回滚方案。

## 可观测性与告警

至少采集 Run 终态和耗时、Tool/Provider 耗时与超时、SSE 断开/重连、插件启动失败、Capability 标准错误码、Evidence 二次鉴权拒绝以及模型调用失败。日志只记录 trace/run/session/plugin/capability 标识与安全错误码，不记录密钥、完整 Prompt、业务原始响应或 PII。当前仓库已提供结构化 Run 事件和 Capability Audit，但尚未接入生产指标后端与告警平台。

