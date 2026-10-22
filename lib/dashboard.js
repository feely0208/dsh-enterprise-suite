/**
 * 企业审计套件面板（多标签：概览 / 审批台账 / 决策复盘 / 交付与任务）
 * 服务端渲染 HTML + 同源 JSON；试用与企业在同一套 UI，差异只在数据量与导出能力。
 */
export function renderSuiteHtml(branding = {}) {
  const badgeUrl = branding.badgeUrl ?? 'https://www.deepwhale.org.cn/images/badge/deepwhale-badge.png';
  const badgeHref = branding.badgeHref ?? 'https://deepwhale.org.cn';
  const badgeHtml = badgeUrl === ''
    ? ''
    : `<a class="dwh-brand" href="${badgeHref}" target="_blank" rel="noopener"><img src="${badgeUrl}" alt="powered by dwh" height="20"></a>`;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>深鲸企业审计套件</title>
<style>
 :root{--bg:#f2f5fa;--card:#fff;--line:#dbe3ee;--fg:#111827;--fg2:#5b6b82;--teal:#0f9b8e;--red:#d92d20;--amber:#b45309;--blue:#1d4ed8}
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.65 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
 .top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 28px;background:#fff;border-bottom:1px solid var(--line)}
 .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:17px}
 .dot{width:10px;height:10px;border-radius:50%;background:var(--teal)}
 .right{display:flex;gap:10px;align-items:center}
 .plan{font-size:12.5px;padding:5px 12px;border-radius:999px;background:#f8fafc;border:1px solid var(--line);color:var(--fg2)}
 .plan.ent{background:#0f9b8e;border-color:#0f9b8e;color:#fff;font-weight:700}
 .btn{background:#fff;border:1px solid #cbd5e1;border-radius:9px;padding:8px 14px;font-size:13.5px;cursor:pointer}
 .btn.primary{background:#111827;border-color:#111827;color:#fff;font-weight:700}
 .tabs{display:flex;gap:6px;padding:0 28px;background:#fff;border-bottom:1px solid var(--line)}
 .tab{padding:12px 16px;font-size:14px;color:var(--fg2);cursor:pointer;border-bottom:2px solid transparent}
 .tab.on{color:var(--fg);border-bottom-color:#111827;font-weight:700}
 main{max-width:1160px;margin:0 auto;padding:22px 28px 60px}
 .banner{display:none;background:#fffbeb;border:1px solid #f6d48a;color:#7a4a06;border-radius:12px;padding:12px 16px;font-size:13.5px;margin-bottom:18px}
 .banner.show{display:block}
 .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px}
 .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
 .card .k{color:var(--fg2);font-size:13px} .card .v{font-size:34px;font-weight:800;margin-top:6px}
 .card.high .v{color:var(--red)} .card.rej .v{color:var(--amber)} .card.fu .v{color:var(--blue)}
 .panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px 22px;margin-bottom:18px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
 .panel h2{margin:0 0 14px;font-size:16px}
 table{width:100%;border-collapse:collapse;font-size:14px}
 th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
 th{color:var(--fg2);font-size:13px;font-weight:700;background:#f8fafc}
 .tag{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12.5px;border:1px solid var(--line);background:#f8fafc}
 .tag.high{color:var(--red);border-color:#f3b8b2;background:#fef2f1}
 .tag.medium{color:var(--amber);border-color:#f2d19a;background:#fffbeb}
 .tag.low{color:var(--teal);border-color:#a7e3da;background:#effcf9}
 .tag.rejected{color:var(--red)} .tag.allowed-once{color:var(--teal)}
 .md h1{font-size:21px;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid var(--line)}
 .md h2{font-size:16px;margin:20px 0 8px;padding-left:10px;border-left:4px solid var(--teal)}
 .md p,.md .li{margin:5px 0} .md .sub{margin:2px 0 2px 16px;color:var(--fg2)}
 .grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
 .task{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:14px 16px;font-size:13.5px}
 .task b{display:block;margin-bottom:6px}
 code{background:#f1f5f9;border-radius:5px;padding:2px 6px;font-size:12.5px}
 .foot{color:var(--fg2);font-size:12.5px;margin-top:10px}
 .dwh-brand{position:fixed;right:20px;bottom:16px;z-index:60;opacity:.85;transition:opacity .15s}
 .dwh-brand:hover{opacity:1}
 .dwh-brand img{display:block;width:auto}
 @media print{.dwh-brand{position:static;display:block;margin-top:14px}}
 .empty{color:var(--fg2);padding:22px 6px;text-align:center}
</style></head><body>
<div class="top">
  <div class="brand"><span class="dot"></span>深鲸企业审计套件</div>
  <div class="right">
    <span class="plan" id="plan">试用版</span>
    <button class="btn" id="refresh">刷新</button>
    <button class="btn primary" id="export-json">导出审计报告</button>
  </div>
</div>
<div class="tabs">
  <div class="tab on" data-view="overview">概览</div>
  <div class="tab" data-view="ledger">审批台账</div>
  <div class="tab" data-view="review">决策复盘</div>
  <div class="tab" data-view="deliver">交付与任务</div>
</div>
<main>
  <div class="banner" id="banner"></div>
  <div id="view-overview">
    <div class="cards">
      <div class="card"><div class="k">审批总数</div><div class="v" id="c-total">—</div></div>
      <div class="card high"><div class="k">高危操作</div><div class="v" id="c-high">—</div></div>
      <div class="card rej"><div class="k">被拒绝</div><div class="v" id="c-rej">—</div></div>
      <div class="card fu"><div class="k">待复审</div><div class="v" id="c-fu">—</div></div>
    </div>
    <div class="panel"><h2>套件包含</h2>
      <div class="grid2">
        <div class="task"><b>① 审批台账</b>记录每次需要审批的操作：谁、想做什么、风险多高、批没批、为什么。</div>
        <div class="task"><b>② 决策复盘</b>自动生成复盘报告：关键决策、被拒原因、待复审项、复盘问题清单。</div>
        <div class="task"><b>③ 审计报告</b>导出带格式版本号的 JSON 交付物，含风险统计与全量记录。</div>
        <div class="task"><b>④ 定时复盘</b>每天定时生成复盘与审计报告（cron / launchd / CI），无需人工操作。</div>
      </div>
    </div>
  </div>
  <div id="view-ledger" style="display:none">
    <div class="panel"><h2>审批台账</h2>
      <table><thead><tr><th>时间</th><th>工具</th><th>风险</th><th>决策</th><th>结果</th><th>理由</th></tr></thead>
      <tbody id="rows"><tr><td colspan="6" class="empty">加载中…</td></tr></tbody></table>
      <div class="foot" id="ledger-foot"></div>
    </div>
  </div>
  <div id="view-review" style="display:none">
    <div class="panel"><h2>决策复盘</h2><div class="md" id="review"></div></div>
  </div>
  <div id="view-deliver" style="display:none">
    <div class="panel"><h2>交付与定时任务</h2>
      <div class="grid2">
        <div class="task"><b>导出审计报告（JSON）</b>交给审计/合规归档，文件名带日期。<br><br><button class="btn primary" id="export-json2">立即导出</button></div>
        <div class="task"><b>导出复盘（Markdown）</b>可直接贴进周报/整改说明。<br><br><button class="btn" id="export-md">导出复盘</button></div>
        <div class="task"><b>每日自动复盘（示例 cron）</b>把下面这行加进 crontab，每天 09:00 自动归档：<br><br><code>0 9 * * * dsh enterprise export --out ~/audit-$(date +\\%F).json</code></div>
        <div class="task"><b>团队汇总（路线）</b>多台机器的台账合并到一个视图，按项目/人聚合——企业版下一阶段。</div>
      </div>
    </div>
  </div>
</main>
${badgeHtml}
<script>
(function(){
  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function tagClass(v){return ['high','medium','low','rejected','allowed-once'].indexOf(v)>=0?'tag '+v:'tag';}
  var tabs=document.querySelectorAll('.tab');
  function activate(view){
    tabs.forEach(function(x){x.classList.toggle('on', x.getAttribute('data-view')===view);});
    ['overview','ledger','review','deliver'].forEach(function(v){
      $('view-'+v).style.display = v===view?'block':'none';
    });
    load();
  }
  tabs.forEach(function(t){t.addEventListener('click',function(){
    var view=t.getAttribute('data-view');
    if(location.hash.slice(1)!==view) location.hash=view;
    activate(view);
  });});
  window.addEventListener('hashchange',function(){activate(location.hash.slice(1)||'overview');});
  function renderMd(md){
    return md.split('\\n').map(function(line){
      if(line.indexOf('# ')===0) return '<h1>'+esc(line.slice(2))+'</h1>';
      if(line.indexOf('## ')===0) return '<h2>'+esc(line.slice(3))+'</h2>';
      if(line.indexOf('  - ')===0) return '<div class="sub">– '+esc(line.slice(4))+'</div>';
      if(line.indexOf('- ')===0) return '<div class="li">• '+esc(line.slice(2))+'</div>';
      if(line.trim()==='') return '<div class="sp" style="height:6px"></div>';
      return '<p>'+esc(line)+'</p>';
    }).join('');
  }
  function setPlan(d){
    var p=d.plan||'trial';
    $('plan').textContent = p==='enterprise'?'企业授权':'试用版';
    if(p==='enterprise') $('plan').className='plan ent';
    var banner=$('banner');
    if(p!=='enterprise'){
      banner.className='banner show';
      banner.textContent='试用模式：只显示最近 '+d.trialLimit+' 条记录，导出带 trial 标记'+(d.trialDaysLeft!=null?('；试用剩余 '+d.trialDaysLeft+' 天'):'')+'。';
    } else { banner.className='banner'; }
  }
  function load(){
    fetch('/enterprise/data?view=all').then(function(r){return r.json();}).then(function(d){
      setPlan(d);
      var c=d.counts||{};
      $('c-total').textContent=c.total;$('c-high').textContent=c.high;$('c-rej').textContent=c.rejected;$('c-fu').textContent=c.followUp;
      var tbody=$('rows');tbody.innerHTML='';
      var rows=d.records||[];
      if(rows.length===0){tbody.innerHTML='<tr><td colspan="6" class="empty">还没有审批记录。agent 触发需要审批的操作后，这里会自动出现。</td></tr>';}
      rows.forEach(function(r){
        var tr=document.createElement('tr');
        tr.innerHTML='<td>'+esc(String(r.ts||'').slice(0,19).replace('T',' '))+'</td><td>'+esc(r.tool)+'</td><td><span class="'+tagClass(r.risk)+'">'+esc(r.risk)+'</span></td><td>'+esc(r.decision)+'</td><td><span class="'+tagClass(r.outcome)+'">'+esc(r.outcome)+'</span></td><td>'+esc(r.reason)+'</td>';
        tbody.appendChild(tr);
      });
      $('ledger-foot').textContent='显示 '+rows.length+' 条'+(d.plan==='enterprise'?'（全量）':'（试用仅最近 '+d.trialLimit+' 条）');
      $('review').innerHTML=renderMd(d.review||'');
    }).catch(function(e){
      $('rows').innerHTML='<tr><td colspan="6" class="empty">读取失败：'+esc(e&&e.message)+'</td></tr>';
    });
  }
  $('refresh').addEventListener('click',load);
  $('export-json').addEventListener('click',function(){window.location.href='/enterprise/export?format=json';});
  $('export-json2').addEventListener('click',function(){window.location.href='/enterprise/export?format=json';});
  $('export-md').addEventListener('click',function(){window.location.href='/enterprise/export?format=md';});
  activate(['overview','ledger','review','deliver'].indexOf(location.hash.slice(1))>=0?location.hash.slice(1):'overview');
})();
</script>
</body></html>`;
}
