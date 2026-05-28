import express from 'express';
const app = express();
const PORT = process.env.PORT || 3000;

let visitCount = 0;

app.get('/', (req, res) => {
  visitCount++;
  console.log(`[INFO] GET / — visit #${visitCount}`);
  res.json({
    message: 'Deployed via webhook! 🔥 🚀',
    visits: visitCount,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/status', (req, res) => {
  console.log('[INFO] GET /api/status');
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/hello', (req, res) => {
  const name = req.query.name || 'World';
  console.log(`[INFO] GET /api/hello?name=${name}`);
  res.json({ message: `Hello, ${name}!` });
});

// Logs both a warning and an error so the runtime-logs panel shows red lines.
app.get('/api/warn', (req, res) => {
  console.warn('[WARN] /api/warn called — this is a warning');
  console.error('[ERROR] also logging to stderr for testing');
  res.json({ message: 'check the runtime logs for warning + error' });
});

// Throws and catches a runtime error so we can see stack traces in stderr.
app.get('/api/boom', (req, res) => {
  try {
    throw new Error('Intentional error from /api/boom');
  } catch (e) {
    console.error('[ERROR] caught:', e.message);
    console.error(e.stack);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET /            — root, increments visit counter`);
  console.log(`  GET /api/status  — uptime`);
  console.log(`  GET /api/hello   — hello world`);
  console.log(`  GET /api/warn    — logs warning + error`);
  console.log(`  GET /api/boom    — caught runtime error`);
});
