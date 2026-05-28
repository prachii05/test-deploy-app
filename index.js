import express from 'express';
import postgres from 'postgres';

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to DB — will fail if DATABASE_URL is not set
const DATABASE_URL = process.env.DATABASE_URL;
let sql = null;
let dbError = null;

if (!DATABASE_URL) {
  dbError = 'DATABASE_URL environment variable is not set';
  console.error('[ERROR] DATABASE_URL is not set — database features will not work');
} else {
  try {
    sql = postgres(DATABASE_URL);
    // Create visits table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        path TEXT NOT NULL,
        visited_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('[INFO] Connected to database and created tables');
  } catch (e) {
    dbError = e.message;
    console.error('[ERROR] Failed to connect to database:', e.message);
  }
}

app.get('/', async (req, res) => {
  console.log('[INFO] GET /');
  if (!sql) {
    return res.status(500).json({
      message: 'Database not connected',
      error: dbError,
      hint: 'Set DATABASE_URL in DeployIt → Project → Env Vars'
    });
  }
  await sql`INSERT INTO visits (path) VALUES ('/')`;
  const [{ count }] = await sql`SELECT COUNT(*) as count FROM visits WHERE path = '/'`;
  res.json({ message: 'Hello from DeployIt! 🚀', visits: Number(count) });
});

app.get('/api/status', async (req, res) => {
  console.log('[INFO] GET /api/status');
  const dbStatus = sql ? 'connected' : `error: ${dbError}`;
  res.json({ status: 'ok', uptime: process.uptime(), db: dbStatus });
});

app.get('/api/visits', async (req, res) => {
  console.log('[INFO] GET /api/visits');
  if (!sql) {
    return res.status(500).json({ error: dbError });
  }
  const rows = await sql`SELECT * FROM visits ORDER BY visited_at DESC LIMIT 10`;
  res.json({ visits: rows });
});

app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  if (dbError) {
    console.error(`✗ Database: ${dbError}`);
  } else {
    console.log(`✓ Database: connected`);
  }
});
