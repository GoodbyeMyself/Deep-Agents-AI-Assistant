# Runtime Policy 与可信回答发布验收报告

日期：2026-10-21  
状态：专项自动化通过，其余质量门禁待用户执行

## 实现范围

- `@assistant/agent-runtime` 新增统一 `AgentRuntimePolicy`、默认值、Zod 校验和官方 Middleware 工厂。
- 显式替换 Deep Agents 1.14.2 的默认摘要实例，使用固定 token/message 阈值。
- 增加每 Run Tool/Model 调用预算；Runner 增加统一 recursion limit 和 Run 总超时。
- 新增服务端 `AnswerValidator`，模型 Draft 通过 Evidence 和发布契约后才进入事件日志与消息历史。
- 新增 `test:runtime-policy` 并加入根测试序列。

## 默认策略

| 策略 | 默认值 |
| --- | ---: |
| 摘要触发 | 40,000 tokens |
| 摘要保留 | 最近 24 条消息 |
| 摘要最大输入 | 32,000 tokens |
| Tool 调用 | 每 Run 12 次 |
| Model 调用 | 每 Run 10 次 |
| LangGraph recursion limit | 50 |
| Run 总超时 | 120 秒 |
| 最终回答长度 | 50,000 字符 |

## 安全与可信边界

- Runtime Policy 不携带身份、权限或凭证，不进入模型 Tool Schema。
- 摘要是模型生成的非可信上下文，不生成或提升 Evidence。
- 业务 Tool 产生 success/partial 结果时必须至少有一个服务端 Evidence；引用必须属于当前 Run，
  且发布时按当前主体、租户和对象范围再次鉴权。
- partial 披露由服务端追加，不能由模型 Prompt 删除。
- Tool/Model 超限和超时只返回稳定公开错误，不返回内部异常、Tool 参数或 Runtime Context。

## 门禁结果

首次执行 `pnpm test:runtime-policy` 时，`@assistant/agent-runtime` 编译发现
`langchain@1.5.10` 三个 Middleware 工厂的发布声明在当前 Zod 4 / `exactOptionalPropertyTypes`
组合下把参数错误收窄为 `never`/`undefined`。已在第三方导入边界按锁定官方源码增加无 `any` 的窄
签名适配。用户于 2026-10-21 重新执行 `pnpm test:runtime-policy` 并确认通过。

本阶段其余质量门禁仍须由用户本人执行并提供真实输出：

```text
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

还需在具备模型配置的环境验证长会话确实触发摘要，且摘要前后 Tool/Evidence 语义不丢失。未取得
上述其余结果前，本报告不宣称完整质量门禁通过。
