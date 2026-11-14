import { createApiHandler } from './app.js';
import { loadServerConfig } from './config.js';

// Each serverless instance owns its limiter and credential cache; apply a distributed edge limit.
export default createApiHandler(loadServerConfig(process.env));
