# @deepwhale-cn/dsh-enterprise-suite

给需要「审批留痕 + 事后复盘 + 可导出审计材料」的团队：一个授权，四个能力。

**关键词**：企业审计 · 审批台账 · 决策复盘 · 审计报告导出 · 合规留痕 · DeepSeek Harness 插件

## 四个能力

| # | 能力 | 说明 |
|---|---|---|
| ① | 审批台账 | 由 `@deepwhale-cn/dsh-approval-ledger` 采集，写 `ledger.jsonl` |
| ② | 决策复盘 | 关键决策、被拒原因、待复审项、复盘问题清单 |
| ③ | 审计报告导出 | `deepwhale.enterprise-audit/v1` JSON 或 Markdown，带授权与试用标记 |
| ④ | 定时复盘 | 示例 cron，交付物是文件——报告落盘，不用人来点 |

## 授权

- 授权码形如 `DWH-ENT-XXXX-XXXX`，可放插件 config、环境变量 `DSH_ENTERPRISE_LICENSE`，或台账目录下的 `license.txt`。
- **未授权 = 14 天试用**：只显示最近 20 条、导出带 trial 标记；**审批记录本身不锁**——试用期也不耽误你看自己的数据。
- 企业版说明：https://deepwhale.org.cn/enterprise.html

## 安装

```bash
dsh plugin --profile web add @deepwhale-cn/dsh-enterprise-suite
```

## 用法

装好后直接对 agent 说：

> 用 enterprise_status 看下授权和台账概况，再用 enterprise_review 复盘最近这批审批。

| 工具 | 作用 |
|---|---|
| `enterprise_status` | 授权状态（企业 / 试用、剩余天数）+ 审批统计 |
| `enterprise_review` | 决策复盘报告（可选 `since` / `limit`） |

宿主支持 webServer 时还会注册一个本地面板：

| 路径 | 内容 |
|---|---|
| `/enterprise` | 企业审计面板（HTML） |
| `/enterprise/data` | 面板数据 JSON |
| `/enterprise/export?format=json` | 审计材料导出（`deepwhale.enterprise-audit/v1`） |
| `/enterprise/export?format=md` | 复盘报告 Markdown |

## 边界（重要）

- **它是交付辅助，不是法律意见**：导出材料只把系统里的事实整理成文档，是否提交、怎么解读由使用方及其法务判断。
- 试用限制只在**展示条数与导出标记**上，不改台账数据、不影响审批本身。
- 与单插件的关系：台账、复盘也可以单独装（`dsh-approval-ledger`、`dsh-decision-review`）；套件的价值是**一处授权 + 一键导出**。

本插件是一个工具。使用者必须遵守所在地区法律法规，**对使用本项目造成的任何后果自行承担责任。**

---

[![](https://img.shields.io/badge/powered_by-dwh-005A8C?style=flat&logoColor=white)](https://deepwhale.org.cn)
