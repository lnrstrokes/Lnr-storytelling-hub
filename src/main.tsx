import { createRoot } from 'react-dom/client';
import ProDock from './pro/ProDock.tsx';
import TimerApp from './timer/TimerApp.tsx';
import './index.css';

// The timer edition owns `/`. The legacy /classic gateway has been removed, so
// every visitor lands on the one homepage and the one studio.
createRoot(document.getElementById('root')!).render(
  <>
    <TimerApp />
    {/* Licensing lives outside the timer engine, so an expired key can never
        interrupt a broadcast — it only hides Pro-only controls. */}
    <ProDock />
  </>
);
