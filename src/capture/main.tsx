/**
 * Dev-only page used to render the hero sequence to a video file.
 *
 * Vite serves any root-level .html in dev but only builds `index.html`, so
 * this entry never reaches production. It mounts the sky on its own, with no
 * hero copy or nav over it, and flags the component into capture mode so the
 * renderer can step the timeline frame by frame.
 *
 * Drive it with `npm run capture:sky`.
 */
import { createRoot } from 'react-dom/client';
import MountainSkyline from '../components/MountainSkyline';
import '../index.css';

// Must be set before the component's effect runs.
(window as unknown as Record<string, unknown>).__SKY_CAPTURE__ = true;

createRoot(document.getElementById('sky')!).render(
  <div style={{ position: 'fixed', inset: 0 }}>
    <MountainSkyline playIntro />
  </div>,
);
