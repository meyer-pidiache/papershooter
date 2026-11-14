import { defineConfig, loadEnv } from 'vite';
import { createApiHandler } from './server/app.ts';
import { loadServerConfig } from './server/config.ts';

export default defineConfig(({ mode }) => ({
  plugins: [{
    name: 'local-credential-api',
    configureServer(server) {
      const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
      server.middlewares.use(createApiHandler(loadServerConfig(env)));
    },
  }],
  build: {
    sourcemap: true,
    rolldownOptions: { output: { codeSplitting: { groups: [
      { name: 'three', test: /node_modules\/three\// },
      { name: 'peerjs', test: /node_modules\/(peerjs|webrtc-adapter|@msgpack|peerjs-js-binarypack|eventemitter3)\// },
    ] } } },
  },
}));
