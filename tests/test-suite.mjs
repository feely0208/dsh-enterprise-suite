import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apply } from '../lib/index.js';
import {
  TRIAL_RECORD_LIMIT,
  buildAuditExport,
  buildReview,
  counts,
  licenseStatus,
  readRecords,
  visibleRecords,
} from '../lib/core.js';

function makeDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-enterprise-'));
  return dir;
}
function seed(dir, n = 30) {
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    rows.push({
      ts: `2026-10-22T${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00Z`,
      tool: i % 3 === 0 ? 'bash' : 'fs_write',
      risk: i % 4 === 0 ? 'high' : 'medium',
      decision: 'delegated',
      outcome: i % 5 === 0 ? 'rejected' : 'allowed-once',
      reason: `操作 ${i}`,
    });
  }
  fs.writeFileSync(path.join(dir, 'ledger.jsonl'), `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
  return rows;
}

test('licenseStatus：企业 key / 试用', () => {
  const dir = makeDir();
  const ent = licenseStatus({ licenseKey: 'DWH-ENT-0008-2026', stateDir: dir, now: new Date('2026-10-22T00:00:00Z') });
  assert.equal(ent.plan, 'enterprise');
  assert.equal(ent.seats, '0008');
  const trial = licenseStatus({ licenseKey: '', stateDir: dir, now: new Date('2026-10-22T00:00:00Z') });
  assert.equal(trial.plan, 'trial');
  assert.ok(trial.trialDaysLeft <= 14);
  fs.writeFileSync(path.join(dir, 'enterprise-trial.json'), JSON.stringify({ firstSeen: '2026-10-01T00:00:00Z' }));
  const expired = licenseStatus({ licenseKey: '', stateDir: dir, now: new Date('2026-11-30T00:00:00Z') });
  assert.equal(expired.trialExpired, true);
});

test('试用只给最近 20 条；企业全量', () => {
  const records = seed(makeDir(), 30);
  const trial = { plan: 'trial' };
  const ent = { plan: 'enterprise' };
  assert.equal(readRecords(makeDir()).length, 0);
  assert.equal(visibleRecords(records, trial).length, TRIAL_RECORD_LIMIT);
  assert.equal(visibleRecords(records, ent).length, 30);
});

test('counts / buildReview / buildAuditExport', () => {
  const records = seed(makeDir(), 12);
  const c = counts(records);
  assert.equal(c.total, 12);
  assert.ok(c.high >= 1);
  const review = buildReview(records);
  assert.match(review, /决策复盘报告/);
  const audit = buildAuditExport(records, { plan: 'enterprise' });
  assert.equal(audit.format, 'deepwhale.enterprise-audit/v1');
  assert.equal(audit.plan, 'enterprise');
  assert.equal(audit.records.length, 12);
  const trialAudit = buildAuditExport(records, { plan: 'trial' });
  assert.match(trialAudit.note, /trial/);
});

function fakeRes() {
  return { headersSent: false, writeHead(status, headers) { this.status = status; this.headers = headers ?? {}; this.headersSent = true; }, end(body) { this.body = body; } };
}

function mount(config = {}) {
  const tools = [];
  const routes = [];
  const webServer = { register: (route) => { routes.push(route); return () => {}; } };
  const ctx = {
    tools: { register: (t) => tools.push(t) },
    inject(deps, cb) { if (deps.includes('webServer')) cb({ webServer, effect: (fn) => { fn(); return () => {}; } }); },
  };
  apply(ctx, config);
  return { tools, route: routes.find((r) => r.path === '/enterprise') };
}

test('企业面板：试用受限 / 企业全量 / 导出两种格式', async () => {
  const dir = makeDir();
  seed(dir, 30);
  const { route } = mount({ ledgerDir: dir });
  assert.ok(route, '注册了 /enterprise 路由');

  const html = fakeRes();
  await route.handler({ url: '/enterprise', headers: {} }, html);
  assert.equal(html.status, 200);
  assert.match(String(html.body), /深鲸企业审计套件/);
  assert.match(String(html.body), /deepwhale-badge\.png/);

  const data = fakeRes();
  await route.handler({ url: '/enterprise/data?view=all', headers: {} }, data);
  const parsed = JSON.parse(data.body);
  assert.equal(parsed.plan, 'trial');
  assert.equal(parsed.records.length, TRIAL_RECORD_LIMIT);
  assert.match(parsed.review, /决策复盘报告/);

  const expJson = fakeRes();
  await route.handler({ url: '/enterprise/export?format=json', headers: {} }, expJson);
  assert.match(expJson.headers['content-disposition'], /enterprise-audit-.*\.json/);
  const audit = JSON.parse(expJson.body);
  assert.equal(audit.records.length, TRIAL_RECORD_LIMIT);
  assert.match(audit.note, /trial/);

  const expMd = fakeRes();
  await route.handler({ url: '/enterprise/export?format=md', headers: {} }, expMd);
  assert.match(expMd.headers['content-disposition'], /decision-review-.*\.md/);
  assert.match(String(expMd.body), /复盘问题清单/);
});

test('企业授权：全量数据 + 无 trial 提示', async () => {
  const dir = makeDir();
  seed(dir, 30);
  const { route } = mount({ ledgerDir: dir, licenseKey: 'DWH-ENT-0100-2026' });
  const data = fakeRes();
  await route.handler({ url: '/enterprise/data?view=all', headers: {} }, data);
  const parsed = JSON.parse(data.body);
  assert.equal(parsed.plan, 'enterprise');
  assert.equal(parsed.records.length, 30);
  const exp = fakeRes();
  await route.handler({ url: '/enterprise/export?format=json', headers: {} }, exp);
  assert.equal(JSON.parse(exp.body).note, '');
});

test('两个工具：状态与复盘', async () => {
  const dir = makeDir();
  seed(dir, 8);
  const { tools } = mount({ ledgerDir: dir, licenseKey: 'DWH-ENT-0008-2026' });
  const names = tools.map((t) => t.name);
  assert.deepEqual(names, ['enterprise_status', 'enterprise_review']);
  const status = await tools[0].execute({});
  assert.match(status, /企业授权：已激活/);
  assert.match(status, /审批记录：8 条/);
  const review = await tools[1].execute({});
  assert.match(review, /决策复盘报告/);
});
