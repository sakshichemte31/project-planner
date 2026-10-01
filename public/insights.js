// Extra pages built on top of app.js: Dashboard (what's left + budget insights), Proposal preview (print / Word), plan import.
const SPECIAL = { dashboard: 'Dashboard', proposal: 'Proposal preview' };
const blank = v => Array.isArray(v) ? !v.some(r => Object.values(r).some(x => String(x).trim())) : !String(v ?? '').trim();
const labelMap = s => { // labels repeated within a section (e.g. three "KPI's") get their group name prepended
  const all = (s.groups || []).flatMap(g => g.fields.filter(f => f.k).map(f => [f, g])), cnt = {}; all.forEach(([f]) => cnt[f.label] = (cnt[f.label] || 0) + 1);
  const m = {}; all.forEach(([f, g]) => m[f.k] = !f.label ? (g.title || f.k) : cnt[f.label] > 1 && g.title ? `${g.title} – ${f.label}` : f.label); return m; };
const listsOf = () => SCHEMA.filter(s => s.list), planOf = () => SCHEMA.filter(s => !s.list);
const pctOf = s => Math.round(progress(s) * 100);
const num = v => +v || 0;
const volTotal = () => (sec('hr').f.vol || []).reduce((a, r) => a + num(r.n), 0);

async function renderSpecial(key) {
  drawTracker(key);
  const page = $('#page'); page.oninput = page.onchange = page.onclick = null; page.innerHTML = '<p style="padding:24px;color:var(--mut)">Loading…</p>';
  const counts = await fetch('/api/files/summary').then(r => r.json()).catch(() => ({}));
  if (location.hash.slice(1) !== key) return; // user navigated away while loading
  page.innerHTML = key === 'dashboard' ? dashboardHTML(counts) : proposalHTML();
  window.scrollTo(0, 0); setStatus(dirty.size ? 'dirty' : 'saved');
  if (key === 'proposal') wireProposal();
}

// ================= DASHBOARD =================
function readinessChecks(counts) {
  const o = sec('overview').f, B = sec('beneficiary'), im = sec('impact').f, b = budget(), docs = Object.values(counts).reduce((a, n) => a + n, 0);
  const ovErr = Validate.validateSection(SCHEMA.find(s => s.key === 'overview'), sec('overview'), LISTS, true).errs;
  return [
    ['Project overview complete (name, sector, problem, status)', !ovErr.length, 'overview'],
    ['“Why” and problem statement written', !blank(o.why) && !blank(o.problem), 'overview'],
    ['KPIs defined for direct, indirect and societal impact', !blank(im.dirKpi) && !blank(im.indKpi) && !blank(im.socKpi), 'impact'],
    ['Beneficiary numbers entered (direct)', num(o.dirN) > 0, 'overview'],
    ['Beneficiary selection process described', !blank(B.f.process), 'beneficiary'],
    ['Core team defined', !blank(sec('hr').f.core), 'hr'],
    ['Annual budget calculated (A+B+C is above zero)', b.grand > 0, 'budget'],
    ['Primary funding source identified', !blank(sec('funding').f.p1), 'funding'],
    ['At least 80% of the Admin & Legal documents ready', progress(SCHEMA.find(s => s.key === 'admin')) >= 0.8, 'admin'],
    ['Supporting documents uploaded', docs > 0, 'overview'] ];
}
function remainingHTML(counts) {
  return SCHEMA.map(s => ({ s, p: progress(s) })).sort((a, b) => a.p - b.p).map(({ s, p }) => {
    let items = [], note = '';
    if (s.list) {
      const d = sec(s.key); Object.entries(LISTS[listKey(s)]).forEach(([g, arr]) => arr.forEach((t, i) => { if (!d.checks[g + '|' + i]?.done) items.push(t); }));
      note = items.length ? `${items.length} item${items.length > 1 ? 's' : ''} pending` : 'All items ticked';
    } else {
      const lm = labelMap(s), d = sec(s.key), req = new Set(Validate.validateSection(s, d, LISTS, true).errs.map(e => e.path));
      fieldsOf(s).forEach(f => { if (blank(d.f[f.k])) items.push(lm[f.k] + (req.has(f.k) ? ' — required' : '')); });
      note = items.length ? `${items.length} field${items.length > 1 ? 's' : ''} blank` : 'Everything filled in';
    }
    const docN = counts[s.key] || 0, shown = items.slice(0, 8);
    return `<details class="rem"><summary><span class="rn">${esc(s.title)}</span><span class="rb"><i style="width:${Math.round(p * 100)}%"></i></span><span class="rp">${Math.round(p * 100)}%</span><span class="rt">${note}${docN ? ` · ${docN} doc${docN > 1 ? 's' : ''}` : ''}</span></summary>
      ${items.length ? `<ul>${shown.map(t => `<li class="${t.endsWith('required') ? 'rq' : ''}">${esc(t)}</li>`).join('')}${items.length > 8 ? `<li class="more">+ ${items.length - 8} more</li>` : ''}</ul>` : '<p class="ok">✓ Nothing left here.</p>'}
      <a class="btn ghost sm" href="#${s.key}">Open ${esc(s.title)} →</a></details>`;
  }).join('');
}
function donutHTML(b) {
  const parts = [['Salaries (A)', b.Salary, 'var(--teal)'], ['Operations (B)', b.Operations, 'var(--gold)'], ['Assets (C)', b.Assets, 'var(--ink)']], R = 40, C = 2 * Math.PI * R; let off = 0;
  if (!b.grand) return '<p class="muted">Add positions, operations and assets on the Budget page to see the split.</p>';
  const arcs = parts.map(([, v, c]) => { const len = v / b.grand * C, el = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${c}" stroke-width="20" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`; off += len; return el; }).join('');
  return `<div class="donutwrap"><svg viewBox="0 0 120 120" class="donut" role="img" aria-label="Budget split">${arcs}<text x="60" y="64" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${inr(b.grand).replace('₹ ', '₹')}</text></svg>
    <ul class="legend">${parts.map(([n, v, c]) => `<li><i style="background:${c}"></i>${n}<b>${inr(v)}</b><small>${Math.round(v / b.grand * 100)}%</small></li>`).join('')}</ul></div>`;
}
function dashboardHTML(counts) {
  const b = budget(), o = sec('overview').f, dirN = num(o.dirN), indN = num(o.indN), docs = Object.values(counts).reduce((a, n) => a + n, 0);
  const overall = Math.round(SCHEMA.reduce((a, s) => a + progress(s), 0) / SCHEMA.length * 100), checks = readinessChecks(counts), passed = checks.filter(c => c[1]).length;
  const plan = Math.round(planOf().reduce((a, s) => a + progress(s), 0) / planOf().length * 100), prep = Math.round(listsOf().reduce((a, s) => a + progress(s), 0) / listsOf().length * 100);
  const notes = [];
  if (b.grand) {
    const share = Math.round(b.Salary / b.grand * 100); notes.push(`Salaries make up <b>${share}%</b> of the budget${share > 60 ? ' — check this against your funder’s guidelines and be ready to justify it' : ''}.`);
    if (dirN) notes.push(`That is about <b>${inr(Math.round(b.grand / dirN))}</b> per direct beneficiary per year${indN ? ` (<b>${inr(Math.round(b.grand / (dirN + indN)))}</b> counting indirect beneficiaries too)` : ''}.`);
    else notes.push('Enter the number of direct beneficiaries on the Overview page to see cost per beneficiary.');
    if (volTotal()) notes.push(`<b>${volTotal()}</b> volunteer${volTotal() > 1 ? 's' : ''} planned alongside <b>${b.Staff}</b> paid staff.`);
  }
  const stages = ['Need assessment', 'Planning', 'Preparedness', 'Execute & M&E', 'Restructure', 'Scale & replicate'];
  return `<div class="head"><span class="pill">Live from your saved data</span><h1>Dashboard</h1><p>Where the proposal stands, what is left, and what the budget says.</p></div>
  <section class="card"><div class="kpis">
    <div class="kpi"><b>${overall}%</b><span>Overall complete</span></div><div class="kpi"><b>${plan}%</b><span>Plan sections</span></div><div class="kpi"><b>${prep}%</b><span>Execution readiness</span></div>
    <div class="kpi"><b>${passed}/${checks.length}</b><span>Proposal-ready checks</span></div><div class="kpi"><b>${b.grand ? inr(b.grand) : '—'}</b><span>Annual budget</span></div>
    <div class="kpi"><b>${b.grand && dirN ? inr(Math.round(b.grand / dirN)) : '—'}</b><span>Per direct beneficiary</span></div><div class="kpi"><b>${docs}</b><span>Documents uploaded</span></div></div></section>
  <section class="card"><h2>Proposal-ready checks</h2><ul class="rl">${checks.map(([t, ok, to]) => `<li class="${ok ? 'y' : 'n'}"><span aria-hidden="true">${ok ? '✓' : '○'}</span>${esc(t)}${ok ? '' : `<a href="#${to}">Fix →</a>`}</li>`).join('')}</ul></section>
  <section class="card"><h2>Budget insights</h2>${donutHTML(b)}${notes.length ? `<ul class="notes">${notes.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}</section>
  <section class="card"><h2>Project maturity ladder</h2><p class="muted" style="margin:0 0 10px">A stage lights up once you have described it on the Beneficiary page.</p><ol class="ladder">${stages.map((n, i) => `<li class="${blank(sec('beneficiary').f['s' + i]) ? '' : 'on'}"><b>${i}</b><span>${n}</span></li>`).join('')}</ol></section>
  <section class="card"><h2>What’s left</h2><p class="muted" style="margin:0 0 10px">Least complete first. Open a row to see exactly what is missing.</p>${remainingHTML(counts)}</section>`;
}

// ================= PROPOSAL PREVIEW =================
const para = v => blank(v) ? '' : String(v).trim().split(/\n{2,}/).map(x => `<p>${esc(x.trim()).replace(/\n/g, '<br>')}</p>`).join('');
const GAP = '<p class="gap">Not yet provided</p>';
const pf = (label, v) => `<div class="pf"><h4>${esc(label)}</h4>${para(v) || GAP}</div>`;
function tblHTML(S, fk) {
  const f = fieldsOf(S).find(x => x.k === fk), rows = (sec(S.key).f[fk] || []).filter(r => Object.values(r).some(x => String(x).trim()));
  if (!rows.length) return GAP;
  const cell = (c, r) => c.type === 'calc' ? inr(rowTotal(c, r)) : c.type === 'number' ? (r[c.k] === '' || r[c.k] == null ? '' : num(r[c.k]).toLocaleString('en-IN')) : esc(r[c.k]);
  const foot = f.cols.some(c => c.sum) ? `<tfoot><tr>${f.cols.map((c, i) => c.sum ? `<td>${c.type === 'calc' ? inr(sumCol(f, c.k, rows)) : sumCol(f, c.k, rows)}</td>` : `<td>${i === 0 ? 'Total' : ''}</td>`).join('')}</tr></tfoot>` : '';
  return `<table class="pt"><thead><tr>${f.cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${f.cols.map(c => `<td>${cell(c, r)}</td>`).join('')}</tr>`).join('')}</tbody>${foot}</table>`;
}
function proposalHTML() {
  const S = k => SCHEMA.find(s => s.key === k), ov = sec('overview').f, im = sec('impact').f, be = sec('beneficiary').f, hr = sec('hr').f, fu = sec('funding').f, b = budget();
  const meta = [ov.sector, ov.status, ov.sdg && 'SDG ' + ov.sdg, ov.duration, ov.since && 'Active since ' + ov.since].filter(Boolean).map(esc).join(' · ');
  const geo = [ov.geo1, ov.geo2, ov.geo3].map((g, i) => g && `<li>Stage ${i + 1}: ${esc(g)}</li>`).filter(Boolean).join('');
  const ben = (l, t, n) => blank(t) && !n ? '' : `<li><b>${l}:</b> ${esc(t)}${n ? (blank(t) ? num(n).toLocaleString('en-IN') : ` (${num(n).toLocaleString('en-IN')})`) : ''}</li>`;
  const bens = ben('Direct', ov.dir, ov.dirN) + ben('Indirect', ov.ind, ov.indN);
  const stageT = ['Stage 0 – Need assessment', 'Stage 1 – Planning', 'Stage 2 – Preparedness', 'Stage 3 – Execution & M&E', 'Stage 4 – Restructure', 'Stage 5 – Scale'];
  const budTables = [['auth', 'Authority positions'], ['off', 'Office positions'], ['fld', 'Field positions'], ['freq', 'Operations – frequent'], ['infreq', 'Operations – infrequent'], ['small', 'Small assets'], ['big', 'Big assets']]
    .filter(([k]) => !blank(sec('budget').f[k])).map(([k, t]) => `<h4>${t}</h4>${tblHTML(S('budget'), k)}`).join('');
  const readiness = `<table class="pt"><thead><tr><th>Area</th><th>Items ready</th><th>Complete</th></tr></thead><tbody>${listsOf().map(s => { let t = 0, d = 0; Object.entries(LISTS[listKey(s)]).forEach(([g, a]) => a.forEach((_, i) => { t++; if (sec(s.key).checks[g + '|' + i]?.done) d++; })); return `<tr><td>${esc(s.title)}</td><td>${d} of ${t}</td><td>${t ? Math.round(d / t * 100) : 0}%</td></tr>`; }).join('')}</tbody></table>`;
  return `<div class="toolbar"><div><b>Proposal preview</b><small>Compiled from everything you have entered. Grey “Not yet provided” notes show on screen only.</small></div>
    <div><button id="pr-print">Print / Save as PDF</button><button id="pr-word" class="ghost">Download Word (.doc)</button></div></div>
  <article class="doc" id="doc">
    <header><h1>${esc(ov.name || 'Untitled project')}</h1>${meta ? `<p class="meta">${meta}</p>` : ''}<p class="meta">Prepared ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p></header>
    <h2>1. Project overview</h2>${pf('Why this project', ov.why)}${pf('Problem statement', ov.problem)}
      ${geo ? `<div class="pf"><h4>Geographic rollout</h4><ul>${geo}</ul></div>` : ''}${bens ? `<div class="pf"><h4>Beneficiaries</h4><ul>${bens}</ul></div>` : ''}
    <h2>2. Expected impact</h2>${pf('Direct beneficiaries – impact', im.dirImp)}${pf('Direct beneficiaries – KPIs', im.dirKpi)}${pf('Indirect beneficiaries – impact', im.indImp)}${pf('Indirect beneficiaries – KPIs', im.indKpi)}${pf('Benefit to society', im.socImp)}${pf('Societal KPIs', im.socKpi)}
    <h2>3. Beneficiary selection & project stages</h2>${pf('Selection process', be.process)}${pf('Data source', be.source)}${pf('Special remark', be.remark)}${stageT.map((t, i) => pf(t, be['s' + i])).join('')}
    <h2>4. Team, stakeholders & partners</h2>${pf('Core team', hr.core)}${pf('Advisory team', hr.adv)}${pf('Working team', hr.work)}${pf('Key stakeholders', hr.keyS)}${pf('Other stakeholders', hr.othS)}${pf('Working partners', hr.partner)}
      <div class="pf"><h4>Other NGOs working in this field</h4>${tblHTML(S('hr'), 'ngos')}</div><div class="pf"><h4>Volunteers</h4>${tblHTML(S('hr'), 'vol')}</div>
    <h2>5. Budget</h2>${b.grand ? `<table class="pt"><tbody><tr><td>Total staff</td><td>${b.Staff}</td></tr><tr><td>Salaries per year (A)</td><td>${inr(b.Salary)}</td></tr><tr><td>Operations (B)</td><td>${inr(b.Operations)}</td></tr><tr><td>Assets (C)</td><td>${inr(b.Assets)}</td></tr></tbody><tfoot><tr><td>Total annual budget (A+B+C)</td><td>${inr(b.grand)}</td></tr></tfoot></table>${budTables}` : GAP}
    <h2>6. Funding plan</h2>${pf('Priority 1', fu.p1)}${pf('Priority 2', fu.p2)}${pf('Priority 3', fu.p3)}${pf('Public call to action', fu.call)}${pf('Potential donors', fu.donors)}${pf('Sponsorship – material', fu.mat)}${pf('Sponsorship – events', fu.evt)}${pf('Sponsorship – marketing', fu.mkt)}
    <h2>7. Department responsibilities</h2>${tblHTML(S('responsibility'), 'dept')}
    <h2>8. Execution readiness</h2>${readiness}
  </article>`;
}
function wireProposal() {
  $('#pr-print').onclick = () => window.print();
  $('#pr-word').onclick = () => { // Word opens HTML saved as .doc; drop on-screen placeholders first
    const c = $('#doc').cloneNode(true); c.querySelectorAll('.pf').forEach(x => x.querySelector('.gap') && x.remove()); c.querySelectorAll('.gap').forEach(x => x.remove());
    const css = 'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#14233a}h1{font-size:22pt}h2{font-size:15pt;border-bottom:1px solid #999;margin-top:18pt}h4{font-size:11pt;margin:10pt 0 2pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:3pt 5pt;text-align:left}.meta{color:#555}';
    const url = URL.createObjectURL(new Blob(['<html><head><meta charset="utf-8"><title>Proposal</title><style>' + css + '</style></head><body>' + c.innerHTML + '</body></html>'], { type: 'application/msword' }));
    const a = document.createElement('a'); a.href = url; a.download = ((sec('overview').f.name || 'project-proposal').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'project-proposal') + '.doc'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
}

// ================= IMPORT =================
document.addEventListener('change', async e => {
  if (e.target.id !== 'imp') return; const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  let plan; try { plan = JSON.parse(await file.text()); } catch { return toast('That file is not valid JSON'); }
  if (!plan || !plan.sections) return toast('This is not an exported plan file');
  if (!confirm(`Import ${Object.keys(plan.sections).length} section(s) from this file?\nSections in the file will REPLACE what you have now. (Uploaded documents are not part of the export.)`)) return;
  const r = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plan) }).catch(() => null), j = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok) return toast(j.error ? j.error + (j.errors ? ` (${j.errors[0].section}: ${j.errors[0].message})` : '') : 'Import failed – check your connection');
  dirty.clear(); DATA = await fetch('/api/sections').then(x => x.json()); toast(`Imported ${j.imported} section(s)`); render();
});
document.addEventListener('click', e => { if (e.target.id === 'impbtn') $('#imp').click(); });
