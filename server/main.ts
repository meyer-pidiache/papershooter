import { createServer } from 'node:http';
import { resolve } from 'node:path';
import sirv from 'sirv';
import { createApiHandler } from './app.js';
import { loadServerConfig } from './config.js';

const config = loadServerConfig(process.env);
const api = createApiHandler(config);
const staticFiles = sirv(resolve(process.env.STATIC_DIR || 'dist'), {
  etag: true,
  setHeaders(res, path) {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'cache-control',
      path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
  },
});

const server = createServer((req, res) => {
  api(req, res, () =>
    staticFiles(req, res, () => {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }),
  );
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(config.port, config.host, () =>
  console.log(`Paper Shooter listening on ${config.host}:${config.port}`),
);
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close();
    server.closeIdleConnections();
    setTimeout(() => server.closeAllConnections(), 10000).unref();
  });
}
