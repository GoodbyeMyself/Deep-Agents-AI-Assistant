# Demo Product A Adapter

Product A 的可信本地 Adapter 样例。它把 Product A 的资源编码、质量分数等原始字段映射为平台标准 Capability，供插件运行时在启动阶段发现和注册。

## 提供的能力

- `data_map.search_objects@1.0.0`
- `data_quality.get_trend@1.0.0`
- 对象级授权校验、缺失日期告警和 Evidence 生成

## 主要文件

- `plugin.json`：插件身份、入口和能力声明。
- `src/index.ts`：字段映射、权限检查和标准结果构造。
- `src/contract.test.ts`：复用契约测试套件验证标准语义。

## 边界

这里只处理 Product A API 与标准契约之间的映射。Agent、UI 和公共 Tool 不应出现 Product A 的字段名或分支判断。当前数据和授权实现仅用于演示，不代表真实业务系统已经接入。

## 验证

```bash
pnpm --filter @assistant/demo-product-a build
pnpm --filter @assistant/demo-product-a typecheck
pnpm --filter @assistant/demo-product-a test
```
