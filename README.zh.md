# DSH Plugin: LLM Provider - Anti Gravity

中文 | [English](README.md)

将 **Google Anti Gravity** Coding Plan 接入 [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness)，用于聊天和编程。当前经过评审的对比模型为 Claude Opus 5.5 High（`claude-opus-5-5-high`）和 Gemini 3.8 Flash Low（`gemini-3.8-flash-low`）；实际模型清单与剩余额度取决于账号权益。

## 适用人群与场景

适合安装了 Google Anti Gravity IDE 或拥有 Cloud Code Assist 权限，希望在 DeepSeek Harness 统一工作台里直接调用这些高性能模型进行日常编码、复杂推理与工具调用的开发者。

## 核心特性

- **轻量原生直连**：直接通过 HTTPS 请求官方 Cloud Code Assist 服务，无需在后台挂起繁重的 `agy` 子进程或 IDE。
- **macOS 一键授权**：自动验证并读取本地签名的 Anti Gravity 客户端配置，点击浏览器授权即可完成登录，免去手工复制 Client ID / Secret 的麻烦。
- **模型自动发现**：通过在线 `fetchAvailableModels` 实时核对账号可用的 Gemini、Claude 与 GPT-OSS 系列模型。
- **独立供应商路由**：插件自行注册 `google-antigravity` adapter、维护目录并解析 OAuth；仅复用官方导出的 `PiAiAdapter` 做 Harness 消息与流转换。
- **自带登录页面**：插件通过自己的 Typert Remote 提供登录启动、状态轮询和退出登录，并把入口注册到独立的 Anti Gravity 设置页。
- **纯净原生体验**：完整保留模型的深度思考过程（Thinking）、流式打字与工具调用能力，不掺杂任何隐藏系统提示词、伪造消息或多余请求头。

## 极简安装与使用

请把经过评审的提交安装进指定的 DeepSeek Harness profile。仓库自带 `dsh.bundle` 配置和预构建运行文件，通过 Git 安装无需在本地执行构建：

```sh
dsh plugin --profile <profile> add github:OpenSaozi/dsh-antigravity#<commit-sha>
```

安装后，插件会自动在 Cordis 配置中注入以下内容：

```yaml
- id: llm-pi-ai-antigravity
  name: '@deepseek-ai/dsh-llm-pi-ai-antigravity'
  config:
    oauthCredentialEnv: GOOGLE_ANTIGRAVITY_OAUTH_CREDENTIAL
    oauthClientConfigRef: GOOGLE_ANTIGRAVITY_OAUTH_CLIENT_CONFIG
    displayName: Google Anti Gravity
```

配置说明：`oauthCredentialEnv` 与 `oauthClientConfigRef` 都是凭据引用名称。本地凭据提供方默认将文档保存在 `$DSH_HOME/.credentials.yaml` 中，也可切换至其他凭据后端。

## 额度查询（本地 fork）

在已挂载 Harness 命令注册表的界面中使用 `/antigravity-usage` 或
`/antigravity-usage --refresh`。命令仅按需读取 `fetchAvailableModels` 的额度元数据，
不发送推理请求，不启动模型回合。宿主服务提供
`ctx.antiGravityUsage.snapshot({ refresh?, signal? })`，无需新的 Remote 或网页客户端构建。
未知参数会被拒绝；原有命令权限仍然生效，输出会作为命令结果记录在会话中。

缓存有效期为 60 秒，总截止时间为 10 秒，响应上限为 1 MiB；并发调用共享一次请求。
取消一个调用者不会取消其他调用者。账号引用更新或退出登录会清除缓存并使待完成的观察失效。
若 OAuth 刷新在查询期间更新引用，本次查询保守地失败；请手动再次运行命令。
OAuth 续期仍可能写入更新后的凭据。不新增启动查询或额度轮询。

剩余比例仅表示近似额度百分比，**不是精确剩余 Token、请求数或金额**。
0% 与未知不同，缺失或无效的数据保持未知。此接口未明确说明额度窗口，
不能仅凭接近的重置时间或 0% 推断五小时或每周限制；模型可能共享额度，因此不相加。
错误只显示安全类别，不含响应正文、账号标识或凭据。查询失败不影响推理。
此功能不修改重试、模型、账号、积分或超额设置，也不会等待下一额度窗口。
当前 TUI 的取消按键未必连接到命令信号；命令自己的截止时间仍限制等待时间。

本地源码需要经过评审的宿主构建产物才能生效；上游固定提交不会自动包含本地功能。
替换正在使用的 `lib/index.js` 前，先验证独立候选产物。

## 共享推理恢复能力（本地 fork）

Claude 与 Gemini 使用同一个有界 SSE 生命周期，支持 UTF-8 分片、CR/LF、多行事件与
无末尾换行的数据。`[DONE]` 或 EOF 不代表成功：必须有有效 STOP/MAX_TOKENS 终止标记及
可执行的文本或客户端工具调用。流错误、无效或截断的数据、策略停止与仅思考的输出不会被
当作成功的部分回合。不透明的文本、思考和工具签名保留在正确的逻辑块上：跨 SSE 事件的
兼容同类型连续增量在同一 run 内追加，明确标记为 thought 的纯签名增量更新该 run，
而不是另建空的带签名思考块。同一事件中的不同 part、候选、类型、工具或不同签名不会被
任意合并。仅有签名不能把空响应或仅思考的响应升级为成功。
单事件上限 1 MiB、整条流 16 MiB、4,096 个块，HTTP 错误元数据 64 KiB；
`timeoutMs` 默认 600 秒。调用者取消、hook 截止时间和消费者提前退出都会清理传输；
Harness 原有空闲 watchdog 不变。

在 payload hook 及序列化校验之后，请求明确发送根字段 `enabledCreditTypes: []`，
拒绝积分 opt-in 以及模型或账号替换。这是客户端明确的仅使用基础额度意图，不是服务端
通用计费保证；不会切换积分设置、账号或模型。只有端点不存在（404）才允许端点 fallback；
提供方传输不会自行重试 429、授权错误或 5xx。每个请求的安全错误保留状态及验证过的
Retry-After/RetryInfo，供官方 Harness 恢复接缝使用。普通 429、RESOURCE_EXHAUSTED 或
QuotaFailure 也可能是 RPM/TPM，而不是账号额度耗尽；仅已知结构化耗尽原因映射为
永久 QUOTA_EXCEEDED，额度窗口始终未知。不启用等待五小时或每周额度。
部分输出标记用于恢复诊断，客户端工具是否派发由 Harness agent loop 决定；
托管工具与远端副作用不保证恰好执行一次。Mock 关口不代表后端长期稳定或真实计费验证。

## 官方重试策略与本地验证结果

可选 `retryPolicy` 使用 Harness 的公共 schema；省略时保留原默认值。经过评审的
本机 profile 仅对 **Antigravity** 使用以下策略，原搜索与模型配置保持不变：

```yaml
retryPolicy:
  mode: normal
  maxRetries: 9
  backoff:
    initialDelayMs: 5000
    maxDelayMs: 1200000
    jitterRatio: 0.1
```

九次重试最多十次尝试。等待、预算和取消只由官方恢复引擎管理，不增加提供方本地重试循环。
normal 模式下，合法的服务端提示若超过 20 分钟上限，会立即失败，不缩短提示或无限等待额度。
授权、计费、策略等永久失败及不明确的远端副作用不会因此重新执行。此策略与整回合自愈预算
相互独立；已观察到的整回合预算问题由 Task43 单独跟踪，此次提供方发布不声称已修复。

本地 Tasks36/42 验证（2026-10-13）：**310 项 mock 包测试、26 项真实 Harness/
官方重试原生循环测试**通过；严格 TypeScript6.0.3、14 个声明产物、外部依赖宿主 bundle
及公共类型使用方检查也通过；独立 root contracts76/76、grammar 配置检查及真实 profile
公共 YAML/wiring 校验也通过。类型检查保留评审过的 `skipLibCheck`，不代表验证所有依赖声明。
测试运行于 Node26.10.0；编译目标 Node22 不等于所有 LTS 运行环境或提供方长期稳定性认证。

已安装的 V4 修复逻辑签名关联。离线 SDK 对比使用假的 base64 签名，只证明 replay 形状，
不证明密码学验证。固定 Claude 模型的真实测试接受了五次编程响应和一次同会话短 follow-up
（六次 HTTP200）。后续请求中一个带签名逻辑思考块与一个文本 part 被接受，没有未签名
思考或空签名 part。五个编程响应中四个到达探针的 16,384 Token 上限：可用文本及成功
replay **不证明程序完整、代码已执行或语义正确**。Gemini 的恢复/replay 验证为离线测试，
未进行真实额度消耗测试。此前 V3 HTTP400 的正文未保留，实际原因仍未知。

受限序列在首次真实 HTTP429（`RATE_LIMIT`）处停止。合法提示为 373,203,889ms
（约 4.32 天），超过 normal 的 1,200,000ms 上限，因此 **零次重试**是正确结果。
累计 18 次推理 POST、26 次元数据请求和 2 次 OAuth 刷新，未超过 32/40/4 次及
45 分钟活跃工作预算（约使用 21 分钟）；没有重置预算或切换账号、模型、路由、积分。
根字段 `enabledCreditTypes: []` 校验通过，但客户端意图不等于服务端通用计费保证。
最后缺失的额度比例是 **未知，不是 0%**；重置时间和长等待提示不能证明五小时或每周窗口。
真实重置后的正向恢复仍需未来单独验证。

V4 只替换编译生成的 `lib/index.js`；四个相关声明、其余 21 个库文件、包元数据及六个
受保护 TUI OAuth 产物保持不变。独占的持久备份/receipt 与前后哈希检查支持单文件回滚，
拒绝覆盖后续修改。rename 仅保证单文件原子性，不是针对并发外部写入的操作系统 CAS。
没有替换历史 pin 或已发布产物。建议使用新 TUI/worker 确认 SDK/模块加载；已观察到的插件
热挂载不意味着现有 SDK 模块缓存被刷新，也不能仅凭进程年龄判断哪些 hook 已生效。
没有自动重启。本地详细证据保存在
`../../.dumps/antigravity-resilience-20261013/promotion-live-result-v4.md`（gitignored）。

## 安全与凭据管理

- 插件使用两条凭据引用：`GOOGLE_ANTIGRAVITY_OAUTH_CLIENT_CONFIG`（保存应用配置）与 `GOOGLE_ANTIGRAVITY_OAUTH_CREDENTIAL`（保存用户 OAuth 凭据）。
- 所有凭据均保存在 Harness 宿主安全存储中，不会随源码分发，也不会泄露至设置页面、模型清单、日志或前端响应。
- 推理时，插件调用 OAuth handler 的 `toAuth()`，把得到的 JSON 鉴权值作为单次请求 override 交给 pi-ai；pi-ai 的模型集合不持有 CredentialStore。

## 参与贡献

欢迎提交 issue 和范围明确的 pull request。请说明观察到的提供方响应，删除凭据和账号标识，同时更新中英文 README，并在版本匹配的 DeepSeek Harness 工作区中运行包测试。

## 许可证与声明

采用 MIT 许可证。该独立集成与 Google、DeepMind、DeepSeek 或 pi-ai 维护者无隶属或背书关系。Google Anti Gravity 及相关模型名称是其各自所有者的商标。

## 模型体验

### Anti Gravity 推理

#### 模型看到的内容

所选模型会收到作为 `systemInstruction` 的 Harness 系统提示词、转换后的对话消息和工具声明。插件不添加供应商提示词或说明性文本。传输层保持 Cloud Code Assist 原生封装：默认只发送经过授权的 JSON/SSE 必要请求头，以及官方 `project`、`model`、`request`、`requestType`、`userAgent` 和 `requestId` 外层字段，不注入兼容性请求头、身份消息或伪造的对话内容。

#### Token 影响

除请求中的系统提示词、历史与工具外，插件不增加模型可见 Token。Cloud Code Assist 会报告提示词、候选、思考和缓存 Token 用量；适配器只映射这些字段，不估算缺失用量。

#### KV Cache 影响

逻辑消息顺序保持不变。思考签名和工具调用标识会保留到后续轮次，但供应商侧缓存复用仍由 Cloud Code Assist 控制；模型或更早的请求内容变化时，复用可能改变。

## 已知限制与暂缓事项

- Google 通过内部 `v1internal` Cloud Code Assist 端点提供这条订阅路径，而不是公开 Gemini API。端点或权益变化可能在公开 Gemini 服务正常时单独破坏该插件。
- OAuth 从插件自己的 Anti Gravity 设置页发起，且账号必须拥有底层服务的使用权限。
- OAuth 应用自动导入目前支持由 Google 签名的 macOS `Antigravity IDE.app`。非标准安装路径可以通过 `macosApplicationPath` 指定；其他操作系统在拥有对应的签名客户端导入器之前，需要从外部预置凭据服务值。
- 清单值描述提供方能力，不保证账号剩余额度。额度耗尽仍会在推理时作为提供方错误返回。
