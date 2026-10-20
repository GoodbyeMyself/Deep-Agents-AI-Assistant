# Manifest V2 Plugin Bundle template

1. 在仓库根目录执行脚手架命令，把模板生成到 `adapters/<plugin-id>`。
2. 实现 Provider，并让原业务 API 再次执行对象、行列与字段授权；不要信任 Prompt/Skill。
3. 构建并运行本包契约测试。
4. 对独立发布产物执行 `hash`，由部署负责人核对并填写批准文件。
5. 停止实例接收新 Run 后安装，重启实例，再检查插件诊断与一次受权/拒绝调用。

`plugin-release.json` 声明配置格式版本兼容范围。配置迁移必须在安装前由受审查的独立步骤完成；
发布工具不会执行 Bundle 中的迁移脚本，也不会读取或复制明文密钥。

本模板只支持可信、只读、本地 Manifest V2 Bundle，不提供上传市场、远程下载或热加载。
