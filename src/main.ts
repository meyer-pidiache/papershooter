import { createApplication } from './application/application.js';

const canvas = document.querySelector<HTMLCanvasElement>('#c');
const hudRoot = document.querySelector<HTMLElement>('#hud');
if (!canvas || !hudRoot) throw new Error('Game root elements are missing');
const application = createApplication({ canvas, hudRoot });
if (import.meta.hot) import.meta.hot.dispose(() => application.dispose());
