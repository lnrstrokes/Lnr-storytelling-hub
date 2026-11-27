import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import adminHandler from './api/admin';
import airtimeHandler from './api/airtime';
import verifyLicenseHandler from './api/verify-license';
import { forwardApi } from './local-api';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.all('/api/admin', (req, res, next) => {
    void forwardApi(adminHandler, req, res).catch(next);
  });

  app.all('/api/verify-license', (req, res, next) => {
    void forwardApi(verifyLicenseHandler, req, res).catch(next);
  });

  app.all('/api/airtime', (req, res, next) => {
    void forwardApi(airtimeHandler, req, res).catch(next);
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    /* Mirrors the headers vercel.json sets, so the bundled `npm start` server
       enforces the same policy instead of silently running without it. */
    app.use((_req, res, next) => {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://*.google-analytics.com https://www.googletagmanager.com; media-src 'self' blob: data:; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.google.com; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests"
      );
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });
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
