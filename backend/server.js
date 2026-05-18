import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { getDb } from './database.js';
import { createOptimizeRouter } from './routes/optimize.js';
import { createScenariosRouter } from './routes/scenarios.js';
import { createRuleProfilesRouter } from './routes/ruleProfiles.js';
import { createExportsRouter } from './routes/exports.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT, 10) || 9876;
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
const IS_PROD = process.env.NODE_ENV === 'production' || fs.existsSync(FRONTEND_DIST);

async function start() {
  const db = await getDb();
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  app.use('/api/optimize', createOptimizeRouter(db));
  app.use('/api/scenarios', createScenariosRouter(db));
  app.use('/api/rule-profiles', createRuleProfilesRouter(db));
  app.use('/api/export', createExportsRouter());

  if (IS_PROD && fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST));
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`✓ Sales Rate Optimizer backend listening on http://localhost:${PORT}`);
    if (IS_PROD && fs.existsSync(FRONTEND_DIST)) {
      console.log(`  Serving frontend build from ${FRONTEND_DIST}`);
    } else {
      console.log(`  Frontend dev: cd frontend && npm run dev (proxies /api to :${PORT})`);
    }
  });
}

start().catch((e) => {
  console.error('Failed to start:', e);
  process.exit(1);
});
