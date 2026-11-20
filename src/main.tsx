import { createRoot } from 'react-dom/client';
const Analytics = () => null;
import App from './App.tsx';
import ReaderDock from './ReaderDock.tsx';
import RotationDock from './RotationDock.tsx';
import ProDock from './pro/ProDock.tsx';
import TimerApp from './timer/TimerApp.tsx';
import { ensureBankInStorage } from './quizbank/bootstrap';
import { installSceneClockGate } from './sceneClock';
import { installStreamMode } from './streamMode';
import './index.css';

// The timer edition is now the DEFAULT experience: it owns `/` and `/timer`.
// The original engine is still reachable, but only at `/classic` — it is no
// longer what a first-time visitor (or an installed PWA) lands on.
//
// This is the fix for "the old interface still persists": the old app used to
// be the root route, and the PWA manifest's start_url was `/`, so every launch
// opened the old UI no matter how many times the timer edition was deployed.
const path = window.location.pathname;
const wantsClassic = path === '/classic' || path.startsWith('/classic/');

if (wantsClassic) {
  void start();
} else {
  createRoot(document.getElementById('root')!).render(
    <>
      <TimerApp />
      {/* Licensing lives outside the timer engine, so an expired key can
          never interrupt a broadcast — it only hides Pro-only controls. */}
      <ProDock />
    </>
  );
}

// A single root, rendered as a fragment so App stays completely untouched.
//
// ReaderDock is the onscreen voice reader: it sits OUTSIDE the broadcast frame
// and narrates whatever quiz content is currently on screen. It also registers
// the hold that makes the scene wait for the voice.
// RotationDock owns automatic engine rotation, including the seamless switch.
//
// The question bank is installed into localStorage BEFORE the first render,
// because App.tsx reads its questions from there in a useState initialiser.
// That is what lets us ship 801 questions without editing App.tsx at all.
async function start() {
  // Install BEFORE the first render, so App's own timers are already gated
  // when it mounts. Doing it later would leave the first scene ungated.
  installSceneClockGate();
  installStreamMode();

  await ensureBankInStorage();

  createRoot(document.getElementById('root')!).render(
    <>
      <App />
      <RotationDock />
      <ReaderDock />
      <Analytics />
    </>
  );
}
