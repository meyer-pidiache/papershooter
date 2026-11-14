import { defineConfig } from 'vite';

// Bundle the HTTP/static service so the runtime needs no node_modules or build tools.
export default defineConfig({
  publicDir: false,
  ssr: { noExternal: true },
  build: {
    ssr: 'server/main.ts',
    outDir: 'dist-server',
    sourcemap: true,
    rolldownOptions: { output: { entryFileNames: 'server.mjs' } },
  },
});
