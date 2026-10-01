let LISTS = {}, DATA = {}, FILECOUNT = {}, timer;
const $ = (s, r = document) => r.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = n => '₹ ' + (+n || 0).toLocaleString('en-IN');
const listKey = s => s.list === true ? s.key : s.list;
const sec = k => (DATA[k] ||= { f: {}, checks: {}, research: '' });
const fieldsOf = s => (s.groups || []).flatMap(g => g.fields).filter(f => f.k);

// ---------- calculations ----------
const rowTotal = (c, r, cols) => (+r[c.mul[0]] || 0) * (+r[c.mul[1]] || 0);
function sumCol(f, colKey, rows) { const c = f.cols.find(c => c.k === colKey); return (rows || []).reduce((a, r) => a + (c.type === 'calc' ? rowTotal(c, r) : +r[colKey] || 0), 0); }
function budget() {
  const f = sec('budget').f, S = SCHEMA.find(s => s.key === 'budget'); const t = { Staff: 0, Salary: 0, Operations: 0, Assets: 0 };
  fieldsOf(S).forEach(fd => fd.cols.filter(c => c.sum).forEach(c => t[c.sum] += sumCol(fd, c.k, f[fd.k])));
  t.grand = t.Salary + t.Operations + t.Assets; return t;
}
// ---------- progress ----------
function progress(s) {
  const d = sec(s.key); let done = 0, total = 0;
  if (s.list) { const L = LISTS[listKey(s)]; Object.entries(L).forEach(([g, items]) => items.forEach((_, i) => { total++; if (d.checks[g + '|' + i]?.done) done++; })); }
  else fieldsOf(s).forEach(f => { total++; const v = d.f[f.k]; if (f.type === 'table' ? (v || []).some(r => Object.values(r).some(x => String(x).trim())) : String(v ?? '').trim()) done++; });
  return total ? done / total : 0;
}
function drawTracker(cur) {
  let all = 0, idx = -1; const tr = $('#tracker');
  tr.innerHTML = SCHEMA.map((s, i) => { const p = progress(s), pc = Math.round(p * 100); all += p; if (s.key === cur) idx = i;
    return `<a href="#${s.key}" class="step ${s.key === cur ? 'on' : ''} ${p >= 1 ? 'done' : ''}" title="${esc(s.title)} – ${pc}% complete"><span class="dot" style="--p:${pc}"><b>${p >= 1 ? '✓' : i + 1}</b></span><span class="lbl">${esc(s.title)}</span><span class="pc">${pc}%</span></a>`; }).join('');
  const pct = Math.round(all / SCHEMA.length * 100); $('#overall-bar').style.width = pct + '%'; $('#overall-pct').textContent = pct + '%';
  $('#overall-label').textContent = idx < 0 ? (typeof SPECIAL !== 'undefined' && SPECIAL[cur]) || '' : `Step ${idx + 1} of ${SCHEMA.length} · ${SCHEMA[idx].title}`;
  const on = $('.step.on', tr); if (on) tr.scrollLeft = on.offsetLeft - tr.clientWidth / 2 + on.offsetWidth / 2;
  const pill = $('#pill'); if (pill && idx >= 0) pill.textContent = Math.round(progress(SCHEMA[idx]) * 100) + '% of this section complete';
}
// ---------- rendering ----------
function fieldHTML(f) {
  const v = sec(f.sec).f[f.k] ?? '';
  if (f.type === 'budgetTotal') return `<div class="wide"><label>${esc(f.label)}</label><input readonly value="${inr(budget().grand)}"></div>`;
  if (f.type === 'budgetSummary') { const t = budget(); return `<div class="sum wide"><span>Total staff</span><b data-bs="Staff">${t.Staff}</b><span>Total salaries per year (A)</span><b data-bs="Salary">${inr(t.Salary)}</b><span>Total operations budget (B)</span><b data-bs="Operations">${inr(t.Operations)}</b><span>Total assets budget (C)</span><b data-bs="Assets">${inr(t.Assets)}</b><span class="g">Salary + Operation + Assets (A+B+C)</span><b class="g" data-bs="grand">${inr(t.grand)}</b></div>`; }
  if (f.type === 'table') return `<div class="wide tw">${tableHTML(f)}</div>`;
  const id = `${f.sec}.${f.k}`, w = f.type === 'textarea' ? 'wide' : '';
  const ctl = f.type === 'textarea' ? `<textarea data-f="${f.k}" placeholder="${esc(f.ph)}">${esc(v)}</textarea>`
    : f.type === 'select' ? `<select data-f="${f.k}"><option value="">Select…</option>${f.opts.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`
    : `<input data-f="${f.k}" type="${f.type}" value="${esc(v)}" placeholder="${esc(f.ph)}">`;
  return `<div class="${w}"><label for="${id}">${esc(f.label)}${f.req ? ' <span class="req" title="Required">*</span>' : ''}</label>${ctl.replace('data-f', `id="${id}" aria-describedby="${id}-e" ${f.req ? 'required ' : ''}${f.type === 'number' ? 'min="0" step="any" ' : `maxlength="${f.max || (f.type === 'textarea' ? 10000 : 200)}" `}data-f`)}<div class="err" id="${id}-e" role="alert"></div></div>`;
}
function tableHTML(f) {
  let rows = sec(f.sec).f[f.k] || []; if (f.fixed) while (rows.length < f.fixed) rows.push({}); if (!rows.length) rows = [{}];
  sec(f.sec).f[f.k] = rows;
  const body = rows.map((r, i) => `<tr>${f.cols.map(c => c.type === 'calc' ? `<td class="calc" data-calc="${f.k}|${i}|${c.k}">${inr(rowTotal(c, r))}</td>`
    : `<td>${c.type === 'select' ? `<select data-t="${f.k}" data-i="${i}" data-c="${c.k}"><option value="">Select…</option>${c.opts.map(o => `<option ${o === r[c.k] ? 'selected' : ''}>${o}</option>`).join('')}</select>`
    : `<input data-t="${f.k}" data-i="${i}" data-c="${c.k}" type="${c.type === 'number' ? 'number' : 'text'}" min="0" step="any" maxlength="200" value="${esc(r[c.k])}" aria-label="${esc(c.label)}">`}</td>`).join('')}${f.fixed ? '' : `<td><button class="x" data-del="${f.k}" data-i="${i}" aria-label="Remove row">✕</button></td>`}</tr>`).join('');
  const sums = f.cols.filter(c => c.sum), foot = sums.length ? `<tfoot><tr>${f.cols.map((c, ci) => c.sum ? `<td data-sum="${f.k}|${c.k}"${c.type === 'calc' ? ' class="calc"' : ''}>${c.type === 'calc' ? inr(sumCol(f, c.k, rows)) : sumCol(f, c.k, rows)}</td>` : `<td>${ci === 0 ? 'Total' : ''}</td>`).join('')}${f.fixed ? '' : '<td></td>'}</tr></tfoot>` : '';
  return `<table><thead><tr>${f.cols.map(c => `<th>${esc(c.label)}</th>`).join('')}${f.fixed ? '' : '<th></th>'}</tr></thead><tbody>${body}</tbody>${foot}</table>${f.fixed ? '' : `<button class="ghost sm" data-add="${f.k}">+ ${f.add}</button>`}`;
}
function listHTML(s) {
  const d = sec(s.key);
  return Object.entries(LISTS[listKey(s)]).map(([g, items]) => `<section class="card"><h2>${esc(s.list === true && s.key === 'admin' ? g : 'Execution preparedness')}</h2>${items.map((t, i) => { const c = d.checks[g + '|' + i] || {}; return `<div class="chk ${c.done ? 'd' : ''}"><input type="checkbox" data-ck="${esc(g + '|' + i)}" ${c.done ? 'checked' : ''} aria-label="${esc(t)}"><div class="t"><span class="l">${esc(t)}</span><input class="note" data-nk="${esc(g + '|' + i)}" placeholder="Status, owner or link (optional)" value="${esc(c.note)}"></div></div>`; }).join('')}</section>`).join('');
}
async function render() {
  flush();
  const key = location.hash.slice(1) || SCHEMA[0].key;
  if (typeof SPECIAL !== 'undefined' && SPECIAL[key]) return renderSpecial(key);
  const i = Math.max(0, SCHEMA.findIndex(s => s.key === key)), s = SCHEMA[i], d = sec(s.key);
  SCHEMA.forEach(x => fieldsOf(x).forEach(f => f.sec = x.key));
  const body = s.list ? listHTML(s) : s.groups.map(g => `<section class="card">${g.title ? `<h2>${esc(g.title)}</h2>` : ''}<div class="grid">${g.fields.map(fieldHTML).join('')}</div></section>`).join('');
  $('#page').innerHTML = `<div class="head"><span class="pill" id="pill"></span><h1>${esc(s.title)}</h1><p>${esc(s.sub)}</p></div>${body}
  <section class="card"><h2>Survey & research notes</h2><label for="rs">Paste survey responses (e.g. Google Form), interview notes or research findings for this section</label><textarea id="rs" style="min-height:140px">${esc(d.research)}</textarea></section>
  <section class="card"><h2>Important documents</h2><div class="up"><select id="cat"><option>Case study</option><option>Project proposal writing</option><option>Other</option></select><input type="file" id="file" aria-label="Choose file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg"><button id="upbtn">Upload</button></div><ul class="files" id="files" style="list-style:none;padding:0;margin:0"></ul></section>
  <div class="nav">${i ? `<a class="btn ghost" href="#${SCHEMA[i - 1].key}">← ${esc(SCHEMA[i - 1].title)}</a>` : '<span></span>'}<button id="save" class="ghost">Save now</button>${i < SCHEMA.length - 1 ? `<a class="btn" data-next href="#${SCHEMA[i + 1].key}">Next: ${esc(SCHEMA[i + 1].title)}</a>` : '<span></span>'}</div>`;
  drawTracker(s.key); setStatus(dirty.size ? 'dirty' : 'saved'); window.scrollTo(0, 0); loadFiles(s.key); wire(s);
}
function wire(s) {
  const d = sec(s.key), p = $('#page'), find = k => fieldsOf(s).find(f => f.k === k), refresh = () => { save(s.key); drawTracker(s.key); };
  const rerender = () => { const y = scrollY; render().then(() => scrollTo(0, y)); };
  p.oninput = p.onchange = e => { const t = e.target;
    if (t.dataset.f) { d.f[t.dataset.f] = t.value; showErr(t, find(t.dataset.f), t.value, e.type === 'change'); }
    else if (t.dataset.t) { d.f[t.dataset.t][t.dataset.i][t.dataset.c] = t.value; showErr(t, find(t.dataset.t).cols.find(c => c.k === t.dataset.c), t.value); if (s.key === 'budget' || find(t.dataset.t).cols.some(c => c.sum)) return (refresh(), updateCalcs(s)); }
    else if (t.dataset.ck) { (d.checks[t.dataset.ck] ||= {}).done = t.checked; t.closest('.chk').classList.toggle('d', t.checked); }
    else if (t.dataset.nk) (d.checks[t.dataset.nk] ||= {}).note = t.value;
    else if (t.id === 'rs') d.research = t.value; else return; refresh(); };
  p.onclick = e => { const t = e.target;
    if (t.dataset.add) { d.f[t.dataset.add].push({}); rerender(); }
    if (t.dataset.del) { d.f[t.dataset.del].splice(+t.dataset.i, 1); refresh(); rerender(); }
    if (t.id === 'save') saveStrict(s);
    const nx = t.closest('a[data-next]'); if (nx) { e.preventDefault(); saveStrict(s, () => location.hash = nx.getAttribute('href')); }
    if (t.id === 'upbtn') upload(s.key);
    if (t.dataset.rm && confirm('Delete this document permanently?')) fetch('/api/files/' + t.dataset.rm, { method: 'DELETE' }).then(() => loadFiles(s.key)); };
}
function updateCalcs(s) { // refresh totals in place so the cursor never leaves the cell being edited
  const d = sec(s.key), money = ['Salary', 'Operations', 'Assets', 'grand'];
  document.querySelectorAll('[data-calc]').forEach(el => { const [k, i, ck] = el.dataset.calc.split('|'), f = fieldsOf(s).find(x => x.k === k), c = f && f.cols.find(x => x.k === ck), r = (d.f[k] || [])[i]; if (c && r) el.textContent = inr(rowTotal(c, r)); });
  document.querySelectorAll('[data-sum]').forEach(el => { const [k, ck] = el.dataset.sum.split('|'), f = fieldsOf(s).find(x => x.k === k), c = f && f.cols.find(x => x.k === ck); if (c) el.textContent = c.type === 'calc' ? inr(sumCol(f, ck, d.f[k])) : sumCol(f, ck, d.f[k]); });
  const t = budget(); document.querySelectorAll('[data-bs]').forEach(el => el.textContent = money.includes(el.dataset.bs) ? inr(t[el.dataset.bs]) : t[el.dataset.bs]);
}
// ---------- persistence & files ----------
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2400); }
const dirty = new Set(), curKey = () => location.hash.slice(1) || SCHEMA[0].key;
function setStatus(s) { const el = $('#savestate'); if (el) { el.dataset.s = s; el.textContent = { saving: 'Saving…', saved: '✓ All changes saved', error: '⚠ Offline – retrying', dirty: 'Unsaved changes' }[s]; } }
function save(key) { dirty.add(key); setStatus('dirty'); clearTimeout(timer); timer = setTimeout(() => flush(), 700); }
async function flush(strict) {
  clearTimeout(timer); const keys = [...dirty]; if (!keys.length) return true; setStatus('saving'); let ok = true;
  try { for (const k of keys) {
    const r = await fetch(`/api/sections/${k}${strict ? '?strict=1' : ''}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sec(k)) });
    if (r.status === 422) { ok = false; if (k === curKey()) showErrors(k, (await r.json()).errors); dirty.delete(k); }
    else if (r.ok) dirty.delete(k); else throw new Error(r.status); }
    setStatus(ok ? 'saved' : 'error'); return ok;
  } catch { setStatus('error'); timer = setTimeout(() => flush(), 4000); return false; }
}
function showErr(t, def, val, reqNow) { const m = def ? Validate.check(def, val, reqNow) : ''; t.classList.toggle('bad', !!m); t.setAttribute('aria-invalid', !!m); const e = t.id && document.getElementById(t.id + '-e'); if (e) e.textContent = m; t.title = m; return m; }
function clearErrors() { document.querySelectorAll('.bad').forEach(x => { x.classList.remove('bad'); x.removeAttribute('aria-invalid'); }); document.querySelectorAll('.err').forEach(x => x.textContent = ''); }
function showErrors(key, errs) {
  clearErrors(); let first;
  errs.forEach(({ path, message }) => { const [k, i, c] = path.split('.'); const el = i === undefined ? document.getElementById(`${key}.${k}`) : document.querySelector(`[data-t="${k}"][data-i="${i}"][data-c="${c}"]`);
    if (el) { el.classList.add('bad'); el.setAttribute('aria-invalid', 'true'); const m = document.getElementById(el.id + '-e'); if (m) m.textContent = message; el.title = message; first ||= el; } });
  toast(`${errs.length} field${errs.length > 1 ? 's' : ''} need attention`); if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); }
}
async function saveStrict(s, then) { // validate whole section (required fields included) before saving / moving on
  const { errs } = Validate.validateSection(s, sec(s.key), LISTS, true); if (errs.length) return showErrors(s.key, errs);
  dirty.add(s.key); if (await flush(true)) { toast('Saved'); then && then(); }
}
addEventListener('beforeunload', e => { if (dirty.size) { e.preventDefault(); e.returnValue = ''; } });
async function loadFiles(key) {
  const fs = await (await fetch('/api/files?section=' + key)).json(), ul = $('#files'); if (!ul) return;
  ul.innerHTML = fs.length ? fs.map(f => `<li><span class="cat">${esc(f.category)}</span><a href="/files/${encodeURIComponent(f.stored)}" target="_blank" rel="noopener">${esc(f.original)}</a><small>${(f.size / 1024).toFixed(0)} KB</small><button class="x" data-rm="${f.id}">Delete</button></li>`).join('') : '<li>No documents uploaded for this section yet.</li>';
}
async function upload(key) {
  const file = $('#file').files[0]; if (!file) return toast('Choose a file first');
  if (!/\.(pdf|docx?|xlsx?|pptx?|txt|csv|png|jpe?g)$/i.test(file.name)) return toast('Allowed: PDF, Word, Excel, PowerPoint, TXT, CSV, PNG, JPG');
  if (file.size > 15 * 1024 * 1024) return toast('File is larger than 15 MB');
  const fd = new FormData(); fd.append('section', key); fd.append('category', $('#cat').value); fd.append('file', file);
  const r = await fetch('/api/files', { method: 'POST', body: fd }).catch(() => null), j = r ? await r.json().catch(() => ({})) : {}; toast(r && r.ok ? 'Uploaded' : (j.error || 'Upload failed – check your connection')); $('#file').value = ''; loadFiles(key);
}
(async () => { [LISTS, DATA] = await Promise.all([fetch('checklists.json').then(r => r.json()), fetch('/api/sections').then(r => r.json())]);
  addEventListener('hashchange', render); render(); })();
