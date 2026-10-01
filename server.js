const express = require('express'), multer = require('multer'), path = require('path'), fs = require('fs'), crypto = require('crypto');
const Database = require('better-sqlite3');
const SCHEMA = require('./public/schema.js'), LISTS = require('./public/checklists.json'), V = require('./public/validate.js');
const SEC = Object.assign(Object.create(null), Object.fromEntries(SCHEMA.map(s => [s.key, s]))); // null-prototype: 'constructor' etc. are not sections
const UP = path.join(__dirname, 'uploads'); fs.mkdirSync(UP, { recursive: true });
const db = new Database(process.env.DB_FILE || path.join(__dirname, 'planner.db')); db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS sections(key TEXT PRIMARY KEY, data TEXT NOT NULL, updated TEXT);
CREATE TABLE IF NOT EXISTS files(id INTEGER PRIMARY KEY AUTOINCREMENT, section TEXT NOT NULL, category TEXT NOT NULL, original TEXT NOT NULL, stored TEXT NOT NULL UNIQUE, size INTEGER, uploaded TEXT);
CREATE INDEX IF NOT EXISTS idx_files_section ON files(section);`);
const q = { all: db.prepare('SELECT key,data FROM sections'), put: db.prepare('INSERT INTO sections(key,data,updated) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated=excluded.updated'),
  list: db.prepare('SELECT id,section,category,original,stored,size,uploaded FROM files WHERE section=? ORDER BY id DESC'), count: db.prepare('SELECT COUNT(*) n FROM files WHERE section=?'),
  add: db.prepare('INSERT INTO files(section,category,original,stored,size,uploaded) VALUES(?,?,?,?,?,?)'), byId: db.prepare('SELECT * FROM files WHERE id=?'), byName: db.prepare('SELECT * FROM files WHERE stored=?'), del: db.prepare('DELETE FROM files WHERE id=?'), allFiles: db.prepare('SELECT * FROM files'), counts: db.prepare('SELECT section, COUNT(*) n FROM files GROUP BY section') };

const CATS = ['Case study', 'Project proposal writing', 'Other'], MAX_FILE = 15 * 1024 * 1024, MAX_PER_SECTION = 30;
const PK = [0x50, 0x4b], OLE = [0xd0, 0xcf, 0x11, 0xe0], TEXT = ['txt', 'csv'];
const MAGIC = { pdf: [0x25, 0x50, 0x44, 0x46], png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], jpeg: [0xff, 0xd8, 0xff], docx: PK, xlsx: PK, pptx: PK, doc: OLE, xls: OLE, ppt: OLE };
function sniff(file) { // extension must be allowed AND file contents must match it
  const ext = path.extname(file).slice(1).toLowerCase(), buf = Buffer.alloc(1024), fd = fs.openSync(file, 'r'), n = fs.readSync(fd, buf, 0, 1024, 0); fs.closeSync(fd);
  if (TEXT.includes(ext)) return !buf.subarray(0, n).includes(0);
  return !!MAGIC[ext] && n >= MAGIC[ext].length && MAGIC[ext].every((b, i) => buf[i] === b);
}
const hits = new Map(); setInterval(() => { const t = Date.now(); hits.forEach((v, k) => v.t < t && hits.delete(k)); }, 60000).unref();
const limiter = (name, max, ms) => (req, res, next) => { const k = name + req.ip, now = Date.now(), h = hits.get(k);
  if (!h || now > h.t) { hits.set(k, { n: 1, t: now + ms }); return next(); } if (++h.n > max) return res.status(429).json({ error: 'Too many requests – please slow down.' }); next(); };
const upload = multer({ storage: multer.diskStorage({ destination: UP, filename: (_, f, cb) => cb(null, crypto.randomBytes(12).toString('hex') + path.extname(f.originalname).toLowerCase()) }), limits: { fileSize: MAX_FILE, files: 1 } });

const app = express(); app.disable('x-powered-by'); app.set('trust proxy', 'loopback');
app.use((_, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'" }); next(); });
app.use('/api', limiter('api', 600, 60000), express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_, res) => res.json({ ok: true, sections: SCHEMA.length }));
app.get('/api/sections', (_, res) => { const o = {}; q.all.all().forEach(r => o[r.key] = JSON.parse(r.data)); res.json(o); });
app.put('/api/sections/:key', (req, res) => {
  const s = SEC[req.params.key]; if (!s) return res.status(404).json({ error: 'Unknown section' });
  const { errs, out } = V.validateSection(s, req.body, LISTS, req.query.strict === '1');
  if (errs.length) return res.status(422).json({ error: 'Validation failed', errors: errs });
  q.put.run(s.key, JSON.stringify(out), new Date().toISOString()); res.json({ ok: true });
});
app.get('/api/files', (req, res) => SEC[req.query.section] ? res.json(q.list.all(req.query.section)) : res.status(400).json({ error: 'Unknown section' }));
app.post('/api/files', limiter('up', 40, 10 * 60000), (req, res, next) => upload.single('file')(req, res, err => { // multer errors → clean JSON
  if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 15 MB' : 'Upload failed' });
  const f = req.file, fail = (code, msg) => { if (f) fs.rmSync(f.path, { force: true }); return res.status(code).json({ error: msg }); };
  if (!f) return fail(400, 'No file received');
  if (!SEC[req.body.section]) return fail(400, 'Unknown section');
  if (!CATS.includes(req.body.category)) return fail(400, 'Choose a valid document category');
  if (!sniff(f.path)) return fail(400, 'Unsupported or corrupted file. Allowed: PDF, Word, Excel, PowerPoint, TXT, CSV, PNG, JPG');
  if (q.count.get(req.body.section).n >= MAX_PER_SECTION) return fail(400, `Limit of ${MAX_PER_SECTION} documents per section reached`);
  const name = Buffer.from(f.originalname, 'latin1').toString('utf8').replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 150);
  q.add.run(req.body.section, req.body.category, name, f.filename, f.size, new Date().toISOString()); res.json({ ok: true });
}));
app.get('/files/:stored', (req, res) => { // only files registered in the DB can be served (no path traversal)
  const f = q.byName.get(req.params.stored); if (!f) return res.status(404).end();
  res.download(path.join(UP, f.stored), f.original, { headers: { 'X-Content-Type-Options': 'nosniff' } });
});
app.delete('/api/files/:id', (req, res) => {
  const f = /^\d+$/.test(req.params.id) && q.byId.get(+req.params.id); if (!f) return res.status(404).json({ error: 'File not found' });
  fs.rmSync(path.join(UP, f.stored), { force: true }); q.del.run(f.id); res.json({ ok: true });
});
app.get('/api/files/summary', (_, res) => { const o = {}; q.counts.all().forEach(r => o[r.section] = r.n); res.json(o); });
app.post('/api/import', (req, res) => { // restore a plan exported via /api/export; same validation as normal saves, all-or-nothing
  const src = req.body && req.body.sections;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return res.status(400).json({ error: 'This does not look like an exported plan (missing "sections")' });
  const out = [], errs = [];
  for (const [k, v] of Object.entries(src)) { const s = SEC[k]; if (!s) continue; const r = V.validateSection(s, v, LISTS, false);
    if (r.errs.length) errs.push(...r.errs.map(e => ({ section: k, ...e }))); else out.push([k, r.out]); }
  if (errs.length) return res.status(422).json({ error: 'Import failed validation', errors: errs.slice(0, 20) });
  if (!out.length) return res.status(400).json({ error: 'No known sections found in file' });
  const now = new Date().toISOString(); db.transaction(() => out.forEach(([k, d]) => q.put.run(k, JSON.stringify(d), now)))();
  res.json({ ok: true, imported: out.length });
});
app.get('/api/export', (_, res) => { const o = { exported: new Date().toISOString(), sections: {}, files: q.allFiles.all().map(({ stored, ...r }) => r) };
  q.all.all().forEach(r => o.sections[r.key] = JSON.parse(r.data)); res.attachment('project-plan.json').json(o); });

app.use('/api', (_, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => { if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' }); console.error(err); res.status(500).json({ error: 'Server error' }); });
if (require.main === module) app.listen(process.env.PORT || 3000, () => console.log('Running at http://localhost:' + (process.env.PORT || 3000)));
module.exports = app;
