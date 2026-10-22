/**
 * 企业套件核心（无 DSH 依赖，纯函数，便于测试与复用）：
 * 台账读取、决策复盘生成、授权状态与试用限制。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const TRIAL_DAYS = 14;
export const TRIAL_RECORD_LIMIT = 20;
const LICENSE_RE = /^DWH-ENT-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function resolveLedgerDir(config = {}) {
  if (typeof config.ledgerDir === 'string' && config.ledgerDir.trim() !== '') return config.ledgerDir;
  const home = process.env.DSH_HOME;
  return home !== undefined && home !== ''
    ? path.join(home, 'approval-ledger')
    : path.join(os.homedir(), '.dsh', 'approval-ledger');
}

export function readRecords(dir) {
  const file = path.join(dir, 'ledger.jsonl');
  if (!existsSync(file)) return [];
  const records = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // 坏行跳过
    }
  }
  return records.sort((a, b) => String(b.ts ?? '').localeCompare(String(a.ts ?? '')));
}

/**
 * 授权状态：企业 / 试用（试用从首次启动起算 14 天，状态文件里记录首启时间）。
 * @param {{licenseKey?: string, stateDir?: string, now?: Date}} input
 */
export function licenseStatus(input = {}) {
  const key = typeof input.licenseKey === 'string' ? input.licenseKey.trim() : '';
  if (LICENSE_RE.test(key)) {
    return { plan: 'enterprise', key: `${key.slice(0, 8)}****${key.slice(-4)}`, seats: key.split('-')[2] ?? '', trialDaysLeft: null, trialExpired: false };
  }
  const stateDir = input.stateDir ?? resolveLedgerDir({});
  const stateFile = path.join(stateDir, 'enterprise-trial.json');
  const now = input.now ?? new Date();
  let firstSeen = now.toISOString();
  try {
    if (existsSync(stateFile)) {
      const saved = JSON.parse(readFileSync(stateFile, 'utf8'));
      if (typeof saved.firstSeen === 'string' && Number.isFinite(Date.parse(saved.firstSeen))) firstSeen = saved.firstSeen;
    }
  } catch {
    // 坏状态当作首次
  }
  const elapsedDays = (now.getTime() - Date.parse(firstSeen)) / 86_400_000;
  const daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - elapsedDays));
  return {
    plan: 'trial',
    key: '',
    seats: '',
    trialDaysLeft: daysLeft,
    trialExpired: elapsedDays > TRIAL_DAYS,
    stateFile,
    firstSeen,
  };
}

/** 试用/企业两种模式下可读的记录（试用只给最近 N 条） */
export function visibleRecords(records, license) {
  return license.plan === 'enterprise' ? records : records.slice(0, TRIAL_RECORD_LIMIT);
}

export function counts(records) {
  const out = { total: records.length, high: 0, rejected: 0, followUp: 0, unavailable: 0 };
  for (const r of records) {
    if (r.risk === 'high') out.high += 1;
    if (r.outcome === 'rejected') out.rejected += 1;
    if (r.risk === 'high' && r.outcome === 'allowed-once') out.followUp += 1;
    if (r.outcome === 'unavailable' || r.outcome === 'cancelled') out.unavailable += 1;
  }
  return out;
}

function fmtTs(ts) {
  return String(ts ?? '').slice(0, 19).replace('T', ' ');
}

/** 决策复盘报告（与单插件一致的口径） */
export function buildReview(records, options = {}) {
  const since = options.since ? Date.parse(options.since) : null;
  const filtered = records.filter((r) => since === null || Date.parse(r.ts) >= since);
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 200;
  const scoped = filtered.slice(-limit);
  const high = scoped.filter((r) => r.risk === 'high');
  const rejected = scoped.filter((r) => r.outcome === 'rejected');
  const followUp = high.filter((r) => r.outcome === 'allowed-once');
  const unavailable = scoped.filter((r) => r.outcome === 'unavailable' || r.outcome === 'cancelled');
  const lines = ['# 决策复盘报告', ''];
  if (scoped.length === 0) {
    lines.push('台账里没有可复盘的审批记录。', '', '说明：数据来源是审批台账，agent 触发需要审批的操作时才会产生记录。');
    return lines.join('\n');
  }
  lines.push(
    `时间范围：${fmtTs(scoped[0].ts)} ~ ${fmtTs(scoped[scoped.length - 1].ts)}`,
    `审批决策：${String(scoped.length)} 次 · 高危 ${String(high.length)} · 被拒 ${String(rejected.length)} · 待复审 ${String(followUp.length)}`,
    '',
    '## 关键决策',
    '',
  );
  if (high.length === 0 && rejected.length === 0) lines.push('- 本时间段没有高危操作，也没有被拒绝的操作。');
  for (const r of [...new Set([...high, ...rejected])]) {
    lines.push(
      `- ${r.outcome === 'rejected' ? '⛔' : '⚠️'} ${fmtTs(r.ts)} · ${String(r.tool ?? '?')} · 风险 ${String(r.risk ?? '?')} · 结果 ${String(r.outcome ?? '?')}`,
      `  - 理由：${String(r.reason ?? '（未给出）').slice(0, 200)}`,
    );
  }
  lines.push('', '## 待跟进', '');
  const follow = [];
  for (const r of followUp) follow.push(`- 🔎 高危已放行，需补复审：${fmtTs(r.ts)} · ${String(r.tool ?? '?')} · ${String(r.reason ?? '').slice(0, 120)}`);
  for (const r of unavailable) follow.push(`- ❓ 审批未完成（${String(r.outcome ?? '?')}），需补审批或补证据：${fmtTs(r.ts)} · ${String(r.tool ?? '?')}`);
  if (follow.length === 0) follow.push('- 没有需要跟进的项。');
  lines.push(...follow, '', '## 复盘问题清单', '');
  lines.push(
    '- 这轮拍板的关键决策是什么？每个决策的依据是被验证过的事实，还是假设？',
    '- 高危操作有没有更安全的替代方案（先 dry-run / 缩小范围 / 分步执行）？',
    '- 被拒绝的操作，是规则过严还是操作本身就该拒？规则要不要调？',
    '- 如果今天这个高危动作真出了问题，回滚与取证路径是什么？',
    '- 哪些决策下次可以固化成规则或检查，避免重复人工判断？',
    '',
    '## 口径说明',
    '',
    '本报告只基于审批台账，不包含模型推理过程与计划变更；报告为复盘辅助材料，不构成合规结论。',
  );
  return lines.join('\n');
}

/** 审计报告导出（企业交付物格式） */
export function buildAuditExport(records, license) {
  return {
    format: 'deepwhale.enterprise-audit/v1',
    plan: license.plan,
    generatedAt: new Date().toISOString(),
    counts: counts(records),
    records: records.map((r) => ({
      ts: r.ts ?? null,
      tool: r.tool ?? null,
      risk: r.risk ?? null,
      decision: r.decision ?? null,
      outcome: r.outcome ?? null,
      reason: r.reason ?? null,
      sessionId: r.sessionId ?? null,
    })),
    note: license.plan === 'enterprise' ? '' : `trial: 仅导出最近 ${TRIAL_RECORD_LIMIT} 条（企业授权解锁全量）`,
  };
}
