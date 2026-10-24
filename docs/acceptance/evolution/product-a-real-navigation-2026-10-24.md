# Product A 真实接口与宿主导航验收（2026-10-24）

## 修复与边界

| 问题 | 原因与修复 |
| --- | --- |
| 管理端无助手 | Vite输出ES Module，宿主却使用普通script加载；改为module脚本，登录后挂载，退出时销毁。 |
| 门户无法登录 | 请求baseURL仍指向proapi.azurewebsites.net，另有token=123模板拦截器；删除公网baseURL和假Token，使用同源真实业务Cookie。 |
| 页面数据404 | 活跃路由仍引用Ant Design Pro模板fake接口；路由切换为复用的真实工作台、资源列表和账户查询组件，未增加假数据后端。Nginx直接返回导出页面，避免目录301跳往内部9001/9002端口。 |
| MCP遗留内容 | Product A旧四个Mock Tool、clients、services、Schema和注册器已删除；移除默认假身份、开发Token回退和4320旧演示目标。运行包只包含dist、config、README，健康接口标明upstream-api。Product B独立项目不受影响。 |
| 无导航扩展 | Compose未转发PLATFORM_EXTENSIONS；现传入固定摘要批准的host-navigation@1.0.0。Product A声明五个不透明动作键，并在本产品内解析实际路由。 |

七个真实查询工具由MCP仓product-a-mcp/config/tools/product-a.yaml维护：数据源列表/详情、元数据任务列表/详情、工作台统计、设备列表、设备采集任务列表。YAML审核摘要为`c768f176feef1e4e6cf6b599c85e918bf348836fdc098cf1be33035dbfebf759`。

平台不维护业务路由。MCP描述提供页面语义和动作键，不产生可信Host Action视图；只有批准的平台扩展可以产生该视图。宿主只执行白名单中的路径，不接受模型URL、任意路径或额外导航参数。

## 实际执行结果

- Govern/Portal类型检查、生产构建成功；Product A宿主路由、拒绝非法参数、module加载及门户同源请求回归4/4通过。
- MCP TypeScript检查通过；清理后Product A协议/身份/YAML/输出投影等测试11/11，Product B7/7；pack:product-a成功。
- 平台lint通过；Platform Extension10/10、AG-UI Host Action4/4；pack:local与三个分组更新成功。平台核心代码本轮未改，未重新运行全量test/typecheck；上轮全量门禁已通过。
- verify-local通过，覆盖管理端和门户入口、直接业务路由、平台页面/API及未登录401。真实网关数据源、元数据、工作台、设备和设备采集接口返回200；当前数据库为空，未生成业务记录或Evidence。
- 管理端浏览器使用真实admin账号、图形验证码登录，工作台统计加载成功；助手入口可见、iframe握手和票据认证成功。
- 门户浏览器单独提交账号、密码和图形验证码，登录成功；首页以System Admin身份显示真实工作台统计。

## 查询到导航的真实场景

1. 管理端`/workplace`中打开右下角助手，新建会话。
2. 输入“查询真实数据源列表，并提供打开数据源管理页面的按钮”。
3. 真实模型调用`mcp_product-a-mcp_list_data_sources`及`platform_host-navigation_present_navigation`。
4. 返回空列表的事实说明，并生成`action.navigate`视图，目标`product-a.data-sources`。
5. 实际激活按钮，宿主URL变为`/data-governance/data-source`，页面标题为“数据源管理”，真实GET /api/data-source返回200。

浏览器成功Run为`56550c45-8d16-4794-b04e-d5fc8c081d52`；数据库事件含两个tool.started、两个tool.completed、view.created、run.completed。此前独立HTTP验收Run `a2c3cd7c-3132-449d-be4b-ebbdfe371a21`也已生成导航视图；其一次性校验脚本把viewType误写为type，脚本断言失败，不是产品视图生成失败，已按真实结构核对。

浏览器第一次请求Run `f7f548c2-30e6-4167-9155-b44413987f4d`在工具执行前返回AGENT_EXECUTION_FAILED；同一会话重试后上述成功Run完成。现有日志未保留底层异常原因，不能断言为网络或模型供应商故障；未增加自动重试或放宽发布门禁。

界面截图保留在本次任务的visualizations目录：product-a-navigation-verified.png、product-a-portal-login-verified.png。

## 剩余范围

当前资源页面提供真实查询展示；本轮不实现资源新增、修改、删除表单。详情工具的非空对象、非零统计和原业务写入流程需要已有业务记录后另行验证。若浏览器保存了旧301缓存，可从根地址重新进入或清除重定向缓存。
