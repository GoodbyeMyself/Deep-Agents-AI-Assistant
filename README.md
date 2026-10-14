# Deep-Agents-AI-Assistant

面向企业业务系统的 AI 智能助手集成框架，以官方 Deep Agents TypeScript SDK
作为 Agent Harness。

## 当前工程（M0 + M1）

当前已完成 M0 框架验证和 M1 插件自动挂载 POC：

- `core/capability`：两项标准业务契约、Catalog、Registry 与 Capability Executor。
- `packages/plugin-sdk`：自研 `definePlugin()` / `implementCapability()` 插件开发 API。
- `packages/plugin-runtime`：受信任 Manifest、Loader、Local/HTTP Driver 与生命周期。
- `adapters/demo-product-a`、`adapters/demo-product-b`：字段不同、标准结果一致的模拟适配器。
- `packages/agent-runtime`：Deep Agents 装配、Runtime Context 与动态 Tool Factory。
- `apps/agent-server`：使用 OpenAI 兼容模型的真实模型烟测入口。
- `skills/poc-data-quality`：通过 `FilesystemBackend` 加载的领域 Skill。

## 开发命令

要求 Node.js 22+ 与 pnpm 10.32.1。

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

离线测试使用 LangChain 官方测试模型，真实执行 Agent 图、Tool、Backend、Subagent、
Checkpointer 与 Streaming，不会请求模型供应商。DeepSeek 真实模型烟测需要在根目录
`.env` 中配置 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL` 和 `MODEL_NAME`，然后执行：

```bash
pnpm --filter @assistant/agent-server smoke:deepseek
```

不要提交 `.env` 或任何模型/业务密钥。详细兼容性结论见
`docs/deepagents-compatibility.md`，阶段验收见 `docs/m0-acceptance-report.md` 和
`docs/m1-acceptance-report.md`。

M1 的 A/B 独立安装与 Agent 自动挂载由以下测试复现：

```bash
pnpm --filter @assistant/agent-server test
pnpm --filter @assistant/plugin-runtime test
pnpm --filter @assistant/demo-product-a test
pnpm --filter @assistant/demo-product-b test
```

开发测试直接把各 Adapter 包目录作为受信任安装根，只加载其 `plugin.json` 指向的
`dist/index.js`。生产部署应复制 `plugin.json` 与构建产物到实例独立的插件安装目录，
不得扫描或执行未经批准的 TypeScript 源码。
