import express from 'express';
import postgres from 'postgres';

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Database — connect lazily and resiliently. The app must NEVER crash just
// because the DB is unreachable; it should stay up and report the problem so
// the frontend can show a helpful message. (The previous version did a
// top-level `await` + un-try/caught queries, so any DB hiccup crash-looped
// the whole container.)
// ---------------------------------------------------------------------------
let sql = null;
let dbError = null;
let schemaReady = false;

if (DATABASE_URL) {
  // `postgres` connects lazily on first query, so this never throws here.
  sql = postgres(DATABASE_URL, { connect_timeout: 10 });
} else {
  dbError = 'DATABASE_URL is not set — add it in DeployIt → Env Vars';
}

async function ensureSchema() {
  if (!sql || schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS visits (
      id SERIAL PRIMARY KEY,
      path TEXT NOT NULL,
      visited_at TIMESTAMP DEFAULT NOW()
    )
  `;
  schemaReady = true;
}

// ---------------------------------------------------------------------------
// Backend API (JSON)
// ---------------------------------------------------------------------------
app.get('/api/status', async (req, res) => {
  console.log('[INFO] GET /api/status');
  let db = 'no DATABASE_URL';
  if (sql) {
    try {
      await sql`SELECT 1`;
      db = 'connected';
    } catch (e) {
      db = `error: ${e.message}`;
    }
  }
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), db });
});

app.get('/api/visits', async (req, res) => {
  console.log('[INFO] GET /api/visits');
  if (!sql) return res.status(503).json({ error: dbError });
  try {
    await ensureSchema();
    const rows = await sql`SELECT * FROM visits ORDER BY visited_at DESC LIMIT 10`;
    res.json({ visits: rows });
  } catch (e) {
    console.error('[ERROR] /api/visits:', e.message);
    res.status(503).json({ error: e.message });
  }
});

app.post('/api/visit', async (req, res) => {
  console.log('[INFO] POST /api/visit');
  if (!sql) return res.status(503).json({ error: dbError });
  try {
    await ensureSchema();
    await sql`INSERT INTO visits (path) VALUES ('/')`;
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM visits`;
    res.json({ ok: true, total: count });
  } catch (e) {
    console.error('[ERROR] /api/visit:', e.message);
    res.status(503).json({ error: e.message });
  }
});

// ---------------------------------------------------------------------------
// Frontend (HTML) — single page that talks to the API above.
// ---------------------------------------------------------------------------
app.get('/', (req, res) => {
  console.log('[INFO] GET /');
  res.type('html').send(PAGE);
});

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DeployIt Full-Stack Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           background:#0a0a0b; color:#e5e7eb; max-width:40rem; margin:3rem auto; padding:0 1rem; }
    h1 { font-size:1.4rem; }
    .card { background:#18181b; border:1px solid #27272a; border-radius:.6rem; padding:1.2rem; margin:1rem 0; }
    .pill { font-size:.75rem; padding:.15rem .5rem; border-radius:.4rem; }
    .ok { background:#14532d; color:#bbf7d0; }
    .bad { background:#7f1d1d; color:#fecaca; }
    button { background:#fff; color:#18181b; border:0; border-radius:.4rem; padding:.5rem 1rem;
             font-weight:600; cursor:pointer; }
    code { background:#27272a; padding:.1rem .3rem; border-radius:.3rem; font-size:.85rem; }
    ul { padding-left:1.1rem; } li { margin:.2rem 0; color:#9ca3af; font-size:.85rem; }
  </style>
</head>
<body>
  <h1>🚀 DeployIt Full-Stack Demo</h1>
  <p>Frontend + backend API + Postgres, all in one deployed container.</p>

  <div class="card">
    <strong>Database</strong> <span id="db" class="pill">checking…</span>
    <div style="margin-top:.6rem;color:#9ca3af;font-size:.85rem">uptime: <span id="uptime">–</span>s</div>
  </div>

  <div class="card">
    <button id="btn">Record a visit</button>
    <span id="total" style="margin-left:.8rem;color:#9ca3af"></span>
    <h3 style="font-size:.95rem;margin-bottom:.4rem">Recent visits (from DB)</h3>
    <ul id="visits"><li>loading…</li></ul>
  </div>

  <script>
    async function refresh() {
      const s = await fetch('/api/status').then(r => r.json());
      const db = document.getElementById('db');
      const ok = s.db === 'connected';
      db.textContent = s.db; db.className = 'pill ' + (ok ? 'ok' : 'bad');
      document.getElementById('uptime').textContent = s.uptime;

      const v = await fetch('/api/visits').then(r => r.json());
      const ul = document.getElementById('visits');
      if (v.visits) {
        ul.innerHTML = v.visits.length
          ? v.visits.map(x => '<li>#' + x.id + ' · ' + new Date(x.visited_at).toLocaleString() + '</li>').join('')
          : '<li>no visits yet — click the button</li>';
      } else {
        ul.innerHTML = '<li>DB unavailable: ' + (v.error || '') + '</li>';
      }
    }
    document.getElementById('btn').onclick = async () => {
      const r = await fetch('/api/visit', { method: 'POST' }).then(r => r.json());
      if (r.ok) document.getElementById('total').textContent = 'total: ' + r.total;
      refresh();
    };
    refresh();
  </script>
</body>
</html>`;

app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(sql ? '✓ DATABASE_URL is set' : `✗ ${dbError}`);
});
