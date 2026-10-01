// Shared by browser and server so both enforce identical rules.
(function (root) {
  const LIM = { text: 200, textarea: 10000, research: 50000, rows: 200, note: 300 };
  const clean = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  const listKey = s => s.list === true ? s.key : s.list;
  const fieldsOf = s => (s.groups || []).flatMap(g => g.fields).filter(f => f.k);
  function cell(f, v, path, errs, reqNow) {
    const bad = m => { errs.push({ path, message: m }); return ''; }, need = () => f.req && reqNow ? bad('This field is required') : '';
    if (v == null || v === '') return need();
    if (f.type === 'number') { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 1e12 ? n : bad('Enter a number from 0 to 1,000,000,000,000'); }
    if (typeof v !== 'string') return bad('Invalid value');
    v = clean(v); if (!v) return need();
    if (f.type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? v : bad('Enter a valid date');
    if (f.type === 'select') return (f.opts || []).includes(v) ? v : bad('Choose one of the listed options');
    const max = f.max || (f.type === 'textarea' ? LIM.textarea : LIM.text);
    return v.length <= max ? v : bad(`Maximum ${max} characters (currently ${v.length})`);
  }
  const check = (f, v, reqNow) => { const e = []; cell(f, v, '', e, reqNow); return e.length ? e[0].message : ''; };
  function validateSection(s, data, lists, strict) {
    const errs = [], out = { f: {}, checks: {}, research: '' };
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { errs: [{ path: '', message: 'Invalid payload' }], out };
    const src = data.f && typeof data.f === 'object' ? data.f : {};
    for (const f of fieldsOf(s)) {
      if (f.type === 'table') {
        const rows = Array.isArray(src[f.k]) ? src[f.k] : [], max = f.fixed || LIM.rows;
        if (rows.length > max) errs.push({ path: f.k, message: `At most ${max} rows allowed` });
        out.f[f.k] = rows.slice(0, max).map((r, i) => { const o = {}; f.cols.filter(c => c.type !== 'calc').forEach(c => { o[c.k] = cell(c, r && r[c.k], `${f.k}.${i}.${c.k}`, errs, false); }); return o; });
      } else out.f[f.k] = cell(f, src[f.k], f.k, errs, strict);
    }
    if (s.list) {
      const valid = new Set(); Object.entries(lists[listKey(s)] || {}).forEach(([g, items]) => items.forEach((_, i) => valid.add(g + '|' + i)));
      Object.entries(data.checks && typeof data.checks === 'object' ? data.checks : {}).forEach(([k, c]) => { if (valid.has(k) && c && typeof c === 'object') out.checks[k] = { done: c.done === true, note: clean(c.note || '').slice(0, LIM.note) }; });
    }
    const r = data.research == null ? '' : data.research;
    if (typeof r !== 'string' || r.length > LIM.research) errs.push({ path: 'research', message: `Research notes must be text up to ${LIM.research} characters` }); else out.research = clean(r);
    return { errs, out };
  }
  const api = { validateSection, check, listKey, fieldsOf, LIM };
  if (typeof module !== 'undefined') module.exports = api; else root.Validate = api;
})(this);
