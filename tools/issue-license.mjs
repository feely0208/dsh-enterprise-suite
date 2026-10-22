#!/usr/bin/env node
/**
 * 深鲸企业套件 · 授权签发工具（本地跑，不联网）
 *
 *   node tools/issue-license.mjs --customer "某某公司" --seats 10 --expires 2027-10-22
 *   node tools/issue-license.mjs --list
 *
 * 生成的 key 形如 DWH-ENT-0010-A7K3：
 *   - 中间 4 位 = 席位数（套件面板与工具会显示）
 *   - 末尾 4 位 = 随机校验段
 * 签发明细写 tools/licenses.jsonl（本地留档，勿提交到仓库）。
 *
 * 说明：当前 v0.1 是"格式校验 + 本地留档"的离线授权；企业客户拿 key 放到
 * $DSH_HOME/approval-ledger/license.txt 即激活。后续版本可升级为签名授权
 * （非对称签名，客户端只验签，无法伪造席位与到期日）。
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LEDGER = path.join(HERE, 'licenses.jsonl');
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSeg(n = 4) {
  let out = '';
  for (let i = 0; i < n; i += 1) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (key === 'list') {
      args.list = true;
      continue;
    }
    args[key] = argv[i + 1];
    i += 1;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.list) {
  if (!existsSync(LEDGER)) {
    console.log('还没有签发过授权。');
    process.exit(0);
  }
  const rows = readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  console.log(`共 ${String(rows.length)} 张授权：\n`);
  for (const r of rows) {
    console.log(`${r.key}  ${r.customer}  ${String(r.seats)} 席  到期 ${r.expires}  签发于 ${String(r.issuedAt).slice(0, 10)}`);
  }
  process.exit(0);
}

const customer = String(args.customer ?? '').trim();
const seats = Number.parseInt(args.seats ?? '', 10);
const expires = String(args.expires ?? '').trim();
if (customer === '' || !Number.isInteger(seats) || seats <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
  console.error('用法：node tools/issue-license.mjs --customer "公司名" --seats 10 --expires 2027-10-22');
  process.exit(2);
}

const key = `DWH-ENT-${String(seats).padStart(4, '0')}-${randomSeg()}`;
const record = { key, customer, seats, expires, issuedAt: new Date().toISOString() };
appendFileSync(LEDGER, `${JSON.stringify(record)}\n`, 'utf8');

console.log('✅ 授权已生成并留档');
console.log('');
console.log('  客户   ：' + customer);
console.log('  席位数 ：' + String(seats));
console.log('  到期   ：' + expires);
console.log('  授权码 ：' + key);
console.log('');
console.log('发给客户：把下面这一行写进 $DSH_HOME/approval-ledger/license.txt（或设环境变量 DSH_ENTERPRISE_LICENSE），重启 DSH 即激活：');
console.log('');
console.log('  ' + key);
console.log('');
console.log('留档文件：' + LEDGER);
