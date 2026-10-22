/**
 * `@deepwhale-cn/dsh-enterprise-suite`
 *
 * 企业审计套件：一个授权包住四个能力。
 *   ① 审批台账（由 @deepwhale-cn/dsh-approval-ledger 负责采集）
 *   ② 决策复盘（本包内 core.buildReview）
 *   ③ 审计报告导出（deepwhale.enterprise-audit/v1）
 *   ④ 定时复盘（示例 cron，交付物是文件）
 *
 * 授权：`DWH-ENT-XXXX-XXXX`（config / 环境变量 / 台账目录 license.txt）。
 * 未授权 = 14 天试用：只显示最近 20 条、导出带 trial 标记；审批记录本身不锁。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { renderSuiteHtml } from './dashboard.js';
import {
  TRIAL_RECORD_LIMIT,
  buildAuditExport,
  buildReview,
  counts,
  licenseStatus,
  readRecords,
  resolveLedgerDir,
  visibleRecords,
} from './core.js';

export const name = 'enterprise-suite';
export const inject = ['tools'];

const TEXT_OUTPUT = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: value }],
};

export function resolveLicenseKey(config = {}) {
  if (typeof config.licenseKey === 'string' && config.licenseKey.trim() !== '') return config.licenseKey.trim();
  for (const env of [process.env.DSH_ENTERPRISE_LICENSE, process.env.DSH_APPROVAL_LEDGER_LICENSE]) {
    if (typeof env === 'string' && env.trim() !== '') return env.trim();
  }
  try {
    const file = path.join(resolveLedgerDir(config), 'license.txt');
    if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  } catch {
    // 读不到 = 未授权
  }
  return '';
}

function ensureTrialState(ledgerDir, license) {
  if (license.plan !== 'trial' || !license.stateFile) return;
  try {
    if (!existsSync(license.stateFile)) {
      mkdirSync(path.dirname(license.stateFile), { recursive: true });
      writeFileSync(license.stateFile, JSON.stringify({ firstSeen: license.firstSeen }), 'utf8');
    }
  } catch {
    // 状态写不进去时按内存值算
  }
}

function currentLicense(config) {
  const ledgerDir = resolveLedgerDir(config);
  const license = licenseStatus({
    licenseKey: resolveLicenseKey(config),
    stateDir: ledgerDir,
  });
  ensureTrialState(ledgerDir, license);
  return { ledgerDir, license };
}

function renderStatus(license, stats, total) {
  const planLine =
    license.plan === 'enterprise'
      ? `企业授权：已激活（${String(license.seats)} 席）`
      : `试用版：剩余 ${String(license.trialDaysLeft ?? 0)} 天（只显示最近 ${String(TRIAL_RECORD_LIMIT)} 条）`;
  return [
    '深鲸企业审计套件',
    '',
    planLine,
    `审批记录：${String(stats.total)} 条（高危 ${String(stats.high)} · 被拒 ${String(stats.rejected)} · 待复审 ${String(stats.followUp)}）`,
    `可查看：${String(total)} 条`,
    '',
    license.plan === 'enterprise'
      ? '可用能力：审批台账 / 决策复盘 / 全量审计导出 / 定时复盘'
      : `试用限制：全量审计导出与定时复盘需激活；激活方式见 http://127.0.0.1:<port>/enterprise`,
  ].join('\n');
}

export function apply(ctx, config) {
  const cfg = config !== null && typeof config === 'object' ? config : {};

  ctx.tools.register(defineTool({
    name: 'enterprise_status',
    description: '查看企业审计套件授权状态与台账概况（企业 / 试用、剩余天数、审批统计）。',
    parameters: {},
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    execute: async () => {
      const { ledgerDir, license } = currentLicense(cfg);
      const all = readRecords(ledgerDir);
      return renderStatus(license, counts(all), visibleRecords(all, license).length);
    },
    presentCall: () => ({ card: 'generic', kind: 'read', title: '企业套件状态' }),
  }));

  ctx.tools.register(defineTool({
    name: 'enterprise_review',
    description: '生成企业决策复盘报告：关键决策、被拒原因、待复审项、复盘问题清单。试用版只复盘最近 20 条。',
    parameters: {
      since: { type: 'string', description: 'ISO 时间下界。' },
      limit: { type: 'number', description: '最多复盘条数，默认 200。' },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    execute: async (args) => {
      const { ledgerDir, license } = currentLicense(cfg);
      const records = visibleRecords(readRecords(ledgerDir), license);
      return buildReview(records, args ?? {});
    },
    presentCall: () => ({ card: 'generic', kind: 'read', title: '企业决策复盘' }),
  }));

  // ── 企业面板（可选：宿主无 webServer 时跳过）──────────────────────────
  ctx.inject(['webServer'], (web) => {
    const sendJson = (res, status, value) => {
      if (res.headersSent) return;
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    web.effect(() => web.webServer.register({
      kind: 'prefix',
      path: '/enterprise',
      handler: async (req, res) => {
        const url = new URL(req.url ?? '/enterprise', 'http://x');
        const sub = url.pathname.replace(/^\/enterprise\/?/, '');
        const { ledgerDir, license } = currentLicense(cfg);
        const all = readRecords(ledgerDir);
        const visible = visibleRecords(all, license);

        if (sub === '' || sub === 'index.html') {
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
          res.end(renderSuiteHtml({
            badgeUrl: typeof cfg.badgeUrl === 'string' ? cfg.badgeUrl : (process.env.DSH_ENTERPRISE_BADGE_URL ?? undefined),
            badgeHref: typeof cfg.badgeHref === 'string' ? cfg.badgeHref : undefined,
          }));
          return;
        }
        if (sub === 'data') {
          sendJson(res, 200, {
            plan: license.plan,
            trialLimit: TRIAL_RECORD_LIMIT,
            trialDaysLeft: license.trialDaysLeft,
            counts: counts(all),
            records: visible.map((r) => ({
              ts: r.ts, tool: r.tool, risk: r.risk, decision: r.decision, outcome: r.outcome, reason: r.reason,
            })),
            review: buildReview(visible),
          });
          return;
        }
        if (sub === 'export') {
          const format = url.searchParams.get('format') === 'md' ? 'md' : 'json';
          const stamp = new Date().toISOString().slice(0, 10);
          if (format === 'md') {
            res.writeHead(200, {
              'content-type': 'text/markdown; charset=utf-8',
              'content-disposition': `attachment; filename="decision-review-${stamp}.md"`,
              'cache-control': 'no-store',
            });
            res.end(buildReview(visible));
            return;
          }
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'content-disposition': `attachment; filename="enterprise-audit-${stamp}.json"`,
            'cache-control': 'no-store',
          });
          res.end(JSON.stringify(buildAuditExport(visible, license), null, 2));
          return;
        }
        sendJson(res, 404, { ok: false, error: 'not found' });
      },
    }));
  });
}
