# 更新日志

[English](CHANGELOG.md) · **中文** · [Français](CHANGELOG.fr.md)

英文是原文。本文件记迭代，不替换 [README.zh-CN.md](README.zh-CN.md) 里的产品章节，也不替换第一份完成度说明 [docs/index.html](docs/index.html)。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。版本号遵循语义化版本。

## [0.2.0] - 2026-10-24

### 新增

- `MONIME_SECRET` 和 `MONIME_SPACE_ID` 都配上之后，付款转到 Monime 托管页。买家回到 `APP_ORIGIN`。付款结果仍只认服务端回调。
- 财务可以拉取近 36 小时的 Monime 入账。结算文件可以用利昂的 `external_ref,amount_sle`，或用分的 `reference,value`。
- Monime 接通后，Orange Money 和 AfriMoney 的退款走原路。银行卡和银行转账改开财务工单。
- `BSP_TOKEN` 和 `BSP_URL` 都在时发送 WhatsApp。`SMS_TOKEN` 和 `SMS_URL` 都在时，短信只发提货码和支付异常。
- `POST /api/cron/daily`，请求头 `Authorization: Bearer <CRON_SECRET>`。它做备份、发出排队的退款和消息，并在密钥已配置时拉取 Monime 入账。
- 标成已采购必须写下采购记录。入货源仓必须有称重照片。这一步可以记下克重。
- v0.2.0 说明（中文、英文、法文）：[docs/v0.2.0.html](docs/v0.2.0.html)。v0.1.0 仍是 [docs/index.html](docs/index.html)。

### 修复

- `reportNote` 和 `desk` 必须有员工会话。
- 顾客会话 30 天过期。员工会话 12 小时过期。
- 员工第二组验证码 10 分钟内最多 5 次。
- 正式环境拒绝仓库里公开的回调密钥。
- Monime 一旦配好，演示推进订单和演示清空数据库都会拒绝。
- 员工角色只限管理员、运营、采购、仓库、客服、财务。不能改自己的席位。最后一个在职管理员留着。
- 设置项不能再写入回调密钥和流水号。
- 没有登记的上传文件不再提供下载。
- 订单照片、首页图和直播地址只接受站内路径，或没有账号密码的 https 地址。
- 健康检查只回答有没有备份，不返回目录名。
- 登录验证码按等长比较。
- 演示密码只在演示模式开着时出现在登录页。
- 响应头拦住被换掉的 base 地址、插件，以及把表单提交到别的网站。正式环境另发 HSTS。

### 未改

- 新密钥留空时，演示收银台、站内收件箱和钱包退款仍按 0.1.0 运行。
- 1688 目录、以图搜图、直播间和原生应用按钮仍用样本数据。

[0.2.0]: https://github.com/bigbrogbpwin-ux/Ledirect-shop/releases/tag/v0.2.0
