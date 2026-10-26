# dsh-insurance-advisor

面向 DeepSeek Harness 的**个人保险代理人（个险渠道）**展业预设：需求分析、计划书、适当性匹配、双录检查与保全理赔协同。

内置 **10 个确定性工具**与 **5 个技能**，并**刻意不挂载 shell 工具** —— 保留文件读写，但模型无法对客户资料执行任意命令。

[English](README.md) | 中文

## 安装

```sh
dsh plugin --profile <profile> add dsh-insurance-advisor
```

重启后打开 **设置 → Agent presets**，选择「保险顾问（个险展业）」。

包内声明了 `dsh.bundle`，`dsh plugin add` 会把它作为 profile 层合并。如果想直接跟随 `main`，也可从仓库安装：

```sh
dsh plugin --profile <profile> add github:MagicTangOps/dsh-insurance-advisor
```

本仓库同时是一个 DSH 插件市场索引源 —— 在 **插件 → 发现 → 添加索引源** 里加入下面的 URL，就能在 Harness 内直接浏览安装：

```
https://cdn.jsdelivr.net/gh/MagicTangOps/dsh-insurance-advisor@main/index.json
```

## 包含什么

### Agent 预设

一个预设（`insurance-advisor`，order 20），由标准工具集（文件、联网、待办、日程、交付、压缩、委派）加下面三个领域插件组成。**不含** `tool-bash`、`tool-pwsh` 与 terminal 组。

### 适当性匹配与销售授权 —— `insurance_check_suitability`、`insurance_authorized_products`

把「产品分级 / 代理人能力等级 / 客户风险等级」三元矩阵固化为确定性规则，不交给模型推断：

| 能力等级 | 可售最高分级 |
|---|---|
| none | P1 |
| 4 级 | P2 |
| 3 级 | P3 |
| 2 级 | P4 |
| 1 级 | P5 |

- **组合销售**按组合中最高分级判定（从高不从低）。
- **P4 / P5** 还要求客户风险等级（R1–R5）不低于产品风险评级。
- `insurance_authorized_products` 回答反向问题：该代理人可售哪些分级。

### 客户与保单台账 —— `insurance_crm_*`

六个工具，数据落在 `storageDomain` 支撑的表里：`insurance_upsert_client`、`insurance_list_clients`、`insurance_add_policy`、`insurance_list_policies`、`insurance_service_due`、`insurance_record_touchpoint`。

犹豫期自**回执签收日**起算，**含当日**：

| 渠道 | 犹豫期 |
|---|---|
| `individual`（个险） | 10 日 |
| `bancassurance`（银保） | 15 日 |
| `internet`（网销） | 15 日 |
| `telemarketing`（电销） | 10 日 |

`insurance_service_due` 列出仍在犹豫期内（欠新单回访）的保单，以及未来窗口内到期的续期缴费。

### 双录清单 —— `insurance_dual_record_*`

`insurance_dual_record_checklist` 生成定制化的五环节录音录像清单；`insurance_dual_record_validate` 校验录制结果，缺 `identity`、`materials`、`product`、`disclosure`、`no-extra-benefit` 中任一环节即判定不合格。

### 技能

`insurance-needs-analysis`、`insurance-proposal`、`insurance-dual-record`、`insurance-compliance`、`insurance-servicing` —— 从本包的 `skills/` 目录加载。

## Host 级与 preset 级的分层

`insurance-crm` 插在 **Host** 层而不是预设内部，因为它依赖 Host 的 `storageDomain` 服务。放进预设作用域会一直处于等待状态，预设被判为损坏。另外两个插件留在预设内，只有用户选中「保险顾问」时才激活。

两个需要知道的后果：六个 `insurance_crm_*` 工具对同 profile 内所有 agent 可见；台账按 profile 共享，不按预设隔离。

## 兼容性

- `engines.dsh`：`>=0.2.1-rc.1 <0.3.0-0`
- `@deepseek-ai/dsh-tools` 与 `@deepseek-ai/dsh-storage-domain` 为 **peer** 依赖，且带显式预发布分支，避免 node-semver 静默排除预发布构建。
- `zod` `^4.4.3` 为普通依赖。

## 刻意不包含

- **监管全文**。规则只覆盖适当性矩阵、犹豫期与双录五环节。产品报备、保司条款等必须核对现行官方原文；预设指示模型联网检索而非直接断言。
- **佣金、利益演示与报价计算**。这不是报价引擎。
- **客户数据不出本机**。台账是本地存储；只有模型主动联网检索时才会访问网络。

## 测试

```sh
npm test
```

四个规则模块共 73 条断言（适当性 25、日期 13、域模型 12、双录 23），均为纯函数测试，不需要 harness 运行时。

## 许可

MIT。