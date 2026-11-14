import { createApplication } from './application/application.js';

const canvas = document.querySelector<HTMLCanvasElement>('#c');
const hudRoot = document.querySelector<HTMLElement>('#hud');
if (!canvas || !hudRoot) throw new Error('Game root elements are missing');
const application = createApplication({ canvas, hudRoot });
const onPageHide = (event: PageTransitionEvent) => {
  if (!event.persisted) application.dispose();
};
window.addEventListener('pagehide', onPageHide);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    window.removeEventListener('pagehide', onPageHide);
    application.dispose();
  });
