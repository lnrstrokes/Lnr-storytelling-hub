import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import adminHandler from './api/admin';
import verifyLicenseHandler from './api/verify-license';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.all('/api/admin', (req, res, next) => {
    void adminHandler(req, res).catch(next);
  });

  app.all('/api/verify-license', (req, res, next) => {
    void verifyLicenseHandler(req, res).catch(next);
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
